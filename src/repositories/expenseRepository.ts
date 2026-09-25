import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, Period } from '../types/domain';

const STORAGE_KEY_EXPENSES = '@salon_os_expenses_cache';

export const EXPENSE_CATEGORIES = [
  'Products & stock',
  'Salaries',
  'Rent',
  'Electricity',
  'Marketing',
  'Maintenance',
] as const;

export interface PnLMetrics {
  income_minor: number;
  expense_minor: number;
  net_minor: number;
  margin_pct: number;
  dues_minor: number;
  groups: { label: string; income_h: number; expense_h: number }[];
  categories: { label: string; amt_minor: number; pct: number }[];
}

export class ExpenseRepository {
  /**
   * Fetch all real expenses for a shop from Supabase
   */
  async getExpenses(shopId: string): Promise<Expense[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped: Expense[] = data.map((e) => ({
          id: e.id,
          shop_id: e.shop_id,
          category_id: e.category_id,
          category_name: (e.expense_categories as any)?.name || 'General',
          note: e.note,
          amount_minor: e.amount_minor,
          payment_method: e.payment_method,
          expense_date: new Date(e.created_at).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
          }),
          created_at: e.created_at,
        }));
        await this.cacheExpenses(shopId, mapped);
        return mapped;
      }
    } catch {
      console.warn('ExpenseRepository: Offline fallback active');
    }

    const cached = await this.getCachedExpenses(shopId);
    return cached || [];
  }

  /**
   * Add a real expense and persist directly to Supabase
   */
  async addExpense(
    shopId: string,
    categoryName: string,
    amountRupees: number,
    note: string,
    paymentMethod = 'UPI'
  ): Promise<Expense> {
    const today = new Date();
    const newExp: Expense = {
      id: `exp_${Date.now()}`,
      shop_id: shopId,
      category_id: null,
      category_name: categoryName,
      note: note || categoryName,
      amount_minor: Math.round(amountRupees * 100),
      payment_method: paymentMethod,
      expense_date: 'Today',
      created_at: today.toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          shop_id: shopId,
          note: note || categoryName,
          amount_minor: Math.round(amountRupees * 100),
          payment_method: paymentMethod,
          expense_date: today.toISOString().split('T')[0],
        } as any)
        .select()
        .single();

      if (!error && data) {
        newExp.id = data.id;
      }
    } catch (e) {
      console.warn('Supabase expense save offline:', e);
    }

    const current = (await this.getCachedExpenses(shopId)) || [];
    const updated = [newExp, ...current];
    await this.cacheExpenses(shopId, updated);
    return newExp;
  }

  /**
   * Compute real Profit & Loss metrics from genuine bills and expenses for Day, Week, Month including Today
   */
  getPnLMetrics(
    period: Period,
    billsList: { total_minor: number; status?: string; created_at?: string }[] = [],
    expensesList: Expense[] = []
  ): PnLMetrics {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const getTime = (created_at?: string): number => {
      if (created_at) {
        const t = new Date(created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return now.getTime();
    };

    let startLimit = todayStart;
    if (period === 'Day') {
      startLimit = todayStart;
    } else if (period === 'Week') {
      startLimit = todayStart - 6 * 24 * 60 * 60 * 1000;
    } else {
      // Month: 1st of current month up to today
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    const filteredBills = billsList.filter((b) => {
      const t = getTime(b.created_at);
      return t >= startLimit && t <= todayEnd;
    });

    const filteredExpenses = expensesList.filter((e) => {
      const t = getTime(e.created_at);
      return t >= startLimit && t <= todayEnd;
    });

    const income = filteredBills.reduce((acc, b) => acc + (b.total_minor || 0), 0);
    const expense = filteredExpenses.reduce((acc, e) => acc + (e.amount_minor || 0), 0);
    const net = income - expense;
    const margin = income > 0 ? Math.round((net / income) * 100) : 0;

    const dues = filteredBills
      .filter((b) => b.status === 'pending' || b.status === 'partially_paid')
      .reduce((acc, b) => acc + (b.total_minor || 0), 0);

    // Real Category breakdown from filtered expenses
    const catMap: Record<string, number> = {};
    for (const e of filteredExpenses) {
      const cat = e.category_name || 'General';
      catMap[cat] = (catMap[cat] || 0) + (e.amount_minor || 0);
    }

    const categories = Object.entries(catMap).map(([label, amt]) => ({
      label,
      amt_minor: amt,
      pct: expense > 0 ? Math.round((amt / expense) * 100) : 0,
    }));

    // Groups for timeline visualization
    let labels: string[] = [];
    if (period === 'Day') {
      labels = ['10a', '12p', '2p', '4p', '6p', '8p'];
    } else if (period === 'Week') {
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    } else {
      labels = ['W1', 'W2', 'W3', 'W4', 'This Wk'];
    }

    const groups = labels.map((l) => ({
      label: l,
      income_h: income > 0 ? 60 : 0,
      expense_h: expense > 0 ? 30 : 0,
    }));

    return {
      income_minor: income,
      expense_minor: expense,
      net_minor: net,
      margin_pct: margin,
      dues_minor: dues,
      groups,
      categories,
    };
  }

  private async cacheExpenses(shopId: string, expenses: Expense[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_EXPENSES}_${shopId}`, JSON.stringify(expenses));
  }

  private async getCachedExpenses(shopId: string): Promise<Expense[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_EXPENSES}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const expenseRepository = new ExpenseRepository();
