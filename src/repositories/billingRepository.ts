import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bill, BillItem, Period } from '../types/domain';

const STORAGE_KEY_BILLS = '@salon_os_bills_cache';

export interface SalesMetrics {
  total_minor: number;
  prev_minor: number;
  bills_count: number;
  avg_bill_minor: number;
  top_service: string;
  sub_label: string;
  modes: { label: string; amt_minor: number; pct: number }[];
  bars: { label: string; amt_minor: number; height_pct: number }[];
}

export function dedupeBills(billsList: Bill[]): Bill[] {
  const seenIds = new Set<string>();
  const result: Bill[] = [];
  for (const b of billsList) {
    if (!b) continue;
    if (b.id && seenIds.has(b.id)) continue;
    if (b.id) seenIds.add(b.id);
    result.push(b);
  }
  return result;
}

export class BillingRepository {
  /**
   * Fetch all real bills for a shop from Supabase
   */
  async getBills(shopId: string): Promise<Bill[]> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          customers(name),
          staff(name),
          bill_items(*),
          payments(*)
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        let custMap = new Map<string, string>();
        try {
          const raw = await AsyncStorage.getItem(`@salon_os_customers_cache_${shopId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            custMap = new Map((parsed as any[]).map((c: any) => [c.id, c.name]));
          }
        } catch {}

        const mapped: Bill[] = data.map((b) => {
          const payments = (b.payments as any[]) || [];
          const primaryPayment = payments[0]?.method || (b.status === 'pending' ? 'Pending' : 'UPI');

          let paidMinor = b.total_minor;
          let dueMinor = 0;
          if (b.status === 'pending') {
            paidMinor = 0;
            dueMinor = b.total_minor;
          } else if (b.status === 'partially_paid') {
            if (payments.length > 0) {
              paidMinor = payments.reduce((acc: number, p: any) => acc + (p.amount_minor || 0), 0);
              dueMinor = Math.max(0, b.total_minor - paidMinor);
            } else if (b.notes && b.notes.includes('paid:')) {
              const m = b.notes.match(/paid:(\d+)/);
              paidMinor = m ? parseInt(m[1], 10) : 0;
              dueMinor = Math.max(0, b.total_minor - paidMinor);
            } else {
              paidMinor = 0;
              dueMinor = b.total_minor;
            }
          } else if (payments.length > 0) {
            paidMinor = payments.reduce((acc: number, p: any) => acc + (p.amount_minor || 0), 0);
            dueMinor = Math.max(0, b.total_minor - paidMinor);
          }

          const rawItems = ((b.bill_items as any[]) || []).map((i) => ({
            id: i.id,
            service_id: i.service_id,
            service_name_snapshot: i.service_name_snapshot,
            quantity: i.quantity,
            unit_price_minor: i.unit_price_minor,
            discount_minor: i.discount_minor,
            tax_minor: i.tax_minor,
            line_total_minor: i.line_total_minor,
            staff_id: i.staff_id,
          }));

          const items =
            rawItems.length > 0
              ? rawItems
              : [
                  {
                    id: undefined,
                    service_id: null,
                    service_name_snapshot:
                      b.notes?.includes('due') || b.invoice_number?.startsWith('DUE')
                        ? 'Opening Due / Settlement'
                        : 'Salon Service',
                    quantity: 1,
                    unit_price_minor: b.total_minor,
                    discount_minor: 0,
                    tax_minor: 0,
                    line_total_minor: b.total_minor,
                    staff_id: b.staff_id,
                  },
                ];

          const resolvedCustName =
            (b.customers as any)?.name || (b.customer_id ? custMap.get(b.customer_id) : null) || 'Walk-in';

          return {
            id: b.id,
            shop_id: b.shop_id,
            customer_id: b.customer_id,
            customer_name: resolvedCustName,
            staff_id: b.staff_id,
            staff_name: (b.staff as any)?.name || 'Reception',
            invoice_number: b.invoice_number,
            status: b.status,
            subtotal_minor: b.subtotal_minor,
            discount_minor: b.discount_minor,
            tax_minor: b.tax_minor,
            total_minor: b.total_minor,
            paid_amount_minor: paidMinor,
            due_amount_minor: dueMinor,
            notes: b.notes,
            issued_at: new Date(b.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).toLowerCase(),
            created_at: b.created_at,
            payment_method: primaryPayment,
            items,
            payments: payments.map((p: any) => ({
              id: p.id,
              amount_minor: p.amount_minor || 0,
              method: p.method || primaryPayment,
              paid_at: p.paid_at || b.created_at,
            })),
          };
        });

        const deduped = dedupeBills(mapped);
        await this.cacheBills(shopId, deduped);
        return deduped;
      }
    } catch (e) {
      console.warn('BillingRepository: Offline fallback active');
    }

    const cached = await this.getCachedBills(shopId);
    return dedupeBills(cached || []);
  }

  /**
   * Create a new real bill in Supabase
   */
  async createBill(
    shopId: string,
    customerName: string,
    customerId: string | null,
    staffName: string,
    staffId: string | null,
    items: { name: string; priceMinor: number; isColour?: boolean }[],
    paymentMethod: string,
    customDiscountMinor = 0,
    paidAmountMinor?: number,
    dueAmountMinor?: number
  ): Promise<Bill> {
    const subtotalMinor = items.reduce((acc, it) => acc + it.priceMinor, 0);
    const discountMinor = Math.min(subtotalMinor, Math.max(0, customDiscountMinor));
    const taxMinor = 0; // GST is disabled as per salon configuration
    const totalMinor = Math.max(0, subtotalMinor - discountMinor);

    let status = 'paid';
    let finalPaidMinor = totalMinor;
    let finalDueMinor = 0;

    if (paymentMethod === 'Fully Pending') {
      status = 'pending';
      finalPaidMinor = 0;
      finalDueMinor = totalMinor;
    } else if (paymentMethod === 'Partial Pay' || paymentMethod.startsWith('Partial Pay')) {
      finalPaidMinor = typeof paidAmountMinor === 'number' ? paidAmountMinor : 0;
      finalDueMinor = typeof dueAmountMinor === 'number' ? dueAmountMinor : Math.max(0, totalMinor - finalPaidMinor);
      if (finalDueMinor === 0 && finalPaidMinor >= totalMinor) {
        status = 'paid';
      } else if (finalPaidMinor === 0) {
        status = 'pending';
      } else {
        status = 'partially_paid';
      }
    }

    const todayDate = new Date();
    const invoiceNumber = `INV-${todayDate.toISOString().slice(5, 10).replace('-', '')}-${String(
      Math.floor(Math.random() * 900) + 100
    )}`;

    const notes = finalDueMinor > 0 ? `due:${finalDueMinor};paid:${finalPaidMinor}` : null;

    const resolvedPaymentMethod = paymentMethod.includes('Cash')
      ? 'Cash'
      : paymentMethod.includes('Card')
      ? 'Card'
      : 'UPI';

    const newBill: Bill = {
      id: `bill_${Date.now()}`,
      shop_id: shopId,
      customer_id: customerId,
      customer_name: customerName,
      staff_id: staffId,
      staff_name: staffName,
      invoice_number: invoiceNumber,
      status,
      subtotal_minor: subtotalMinor,
      discount_minor: discountMinor,
      tax_minor: taxMinor,
      total_minor: totalMinor,
      paid_amount_minor: finalPaidMinor,
      due_amount_minor: finalDueMinor,
      notes,
      issued_at: todayDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).toLowerCase(),
      created_at: todayDate.toISOString(),
      payment_method: paymentMethod,
      items: items.map((it) => ({
        service_id: null,
        service_name_snapshot: it.name,
        quantity: 1,
        unit_price_minor: it.priceMinor,
        discount_minor: 0,
        tax_minor: 0,
        line_total_minor: it.priceMinor,
        staff_id: staffId,
      })),
      payments: finalPaidMinor > 0 ? [
        {
          amount_minor: finalPaidMinor,
          method: resolvedPaymentMethod,
          paid_at: todayDate.toISOString(),
        }
      ] : [],
    };

    try {
      const { data: billData, error: billErr } = await supabase
        .from('bills')
        .insert({
          shop_id: shopId,
          customer_id: customerId || null,
          staff_id: staffId || null,
          invoice_number: invoiceNumber,
          subtotal_minor: subtotalMinor,
          discount_minor: discountMinor,
          tax_minor: taxMinor,
          total_minor: totalMinor,
          status,
          notes,
        } as any)
        .select()
        .single();

      if (!billErr && billData) {
        newBill.id = billData.id;

        // Insert bill items
        const itemInserts = items.map((it) => ({
          bill_id: billData.id,
          service_name_snapshot: it.name,
          quantity: 1,
          unit_price_minor: it.priceMinor,
          line_total_minor: it.priceMinor,
          staff_id: staffId || null,
        }));
        await supabase.from('bill_items').insert(itemInserts as any);

        // Insert payment with correct schema if any amount was paid upfront
        if (finalPaidMinor > 0) {
          await supabase.from('payments').insert({
            bill_id: billData.id,
            shop_id: shopId,
            amount_minor: finalPaidMinor,
            method: resolvedPaymentMethod,
            status: 'completed',
            reference: paymentMethod.startsWith('Partial Pay') ? `Partial upfront payment (${resolvedPaymentMethod})` : 'Salon billing invoice payment',
            paid_at: todayDate.toISOString(),
          } as any);
        }

        // Update customer's outstanding_due_minor in Supabase if there is a due
        if (finalDueMinor > 0 && customerId) {
          const { data: custRow } = await supabase
            .from('customers')
            .select('outstanding_due_minor')
            .eq('id', customerId)
            .single();
          const currentCustDue = (custRow?.outstanding_due_minor || 0);
          await supabase
            .from('customers')
            .update({ outstanding_due_minor: currentCustDue + finalDueMinor })
            .eq('id', customerId);
        }
      } else if (billErr) {
        console.error('Supabase bill insert error:', billErr);
      }
    } catch (e) {
      console.warn('BillingRepository: Supabase bill save offline:', e);
    }

    const current = (await this.getCachedBills(shopId)) || [];
    const updated = dedupeBills([newBill, ...current]);
    await this.cacheBills(shopId, updated);
    return newBill;
  }

  /**
   * Compute real sales metrics directly from genuine shop bills with Day, Week, Month including Today
   */
  getSalesMetrics(period: Period, billsList?: Bill[]): SalesMetrics {
    const allBills = billsList || [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    // Helper to get timestamp of a bill
    const getBillTime = (b: Bill): number => {
      if (b.created_at) {
        const t = new Date(b.created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return now.getTime();
    };

    // Helper to get collected revenue for a bill (financial correctness: only count actual paid amounts)
    const getBillCollectedMinor = (b: Bill): number => {
      if (b.status === 'pending') return 0;
      if (b.status === 'partially_paid') {
        return typeof b.paid_amount_minor === 'number' ? b.paid_amount_minor : (b.total_minor || 0);
      }
      return b.total_minor || 0;
    };

    // Flatten all collected payment transactions from bills
    interface CollectedPayment {
      amount_minor: number;
      method: string;
      time: number;
      bill: Bill;
    }

    const allPayments: CollectedPayment[] = [];
    for (const b of allBills) {
      if (b.payments && b.payments.length > 0) {
        for (const p of b.payments) {
          const pt = p.paid_at ? new Date(p.paid_at).getTime() : getBillTime(b);
          allPayments.push({
            amount_minor: p.amount_minor || 0,
            method: p.method || b.payment_method || 'UPI',
            time: isNaN(pt) ? getBillTime(b) : pt,
            bill: b,
          });
        }
      } else {
        const collected = getBillCollectedMinor(b);
        if (collected > 0) {
          allPayments.push({
            amount_minor: collected,
            method: b.payment_method || 'UPI',
            time: getBillTime(b),
            bill: b,
          });
        }
      }
    }

    let filteredPayments: CollectedPayment[] = [];
    let prevPayments: CollectedPayment[] = [];
    let bars: { label: string; amt_minor: number; height_pct: number }[] = [];
    let subLabel = '';

    if (period === 'Day') {
      // Current day (Today)
      filteredPayments = allPayments.filter((p) => p.time >= todayStart && p.time <= todayEnd);

      // Yesterday
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      prevPayments = allPayments.filter((p) => p.time >= yesterdayStart && p.time < todayStart);

      // Histogram buckets across operating hours for Today: 9am, 11am, 1pm, 3pm, 5pm, 7pm, 9pm
      const timeSlots = [
        { label: '9a', startHour: 0, endHour: 10 },
        { label: '11a', startHour: 10, endHour: 12 },
        { label: '1p', startHour: 12, endHour: 14 },
        { label: '3p', startHour: 14, endHour: 16 },
        { label: '5p', startHour: 16, endHour: 18 },
        { label: '7p', startHour: 18, endHour: 20 },
        { label: '9p', startHour: 20, endHour: 24 },
      ];

      const slotTotals = timeSlots.map((slot) => {
        const slotPayments = filteredPayments.filter((p) => {
          const d = new Date(p.time);
          const h = d.getHours();
          return h >= slot.startHour && h < slot.endHour;
        });
        const amt = slotPayments.reduce((acc, p) => acc + p.amount_minor, 0);
        return { label: slot.label, amt_minor: amt, height_pct: 10 };
      });

      const maxSlot = Math.max(...slotTotals.map((s) => s.amt_minor), 0);
      bars = slotTotals.map((s) => ({
        label: s.label,
        amt_minor: s.amt_minor,
        height_pct: maxSlot > 0 ? Math.max(10, Math.round((s.amt_minor / maxSlot) * 100)) : 10,
      }));

      const todayStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      subLabel = `Today (${todayStr}) vs yesterday`;
    } else if (period === 'Week') {
      // 7 days ending today (inclusive of today)
      const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
      filteredPayments = allPayments.filter((p) => p.time >= weekStart && p.time <= todayEnd);

      // Prior 7-day period
      const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
      prevPayments = allPayments.filter((p) => p.time >= prevWeekStart && p.time < weekStart);

      // 7 day bars ending with Today
      const dayBars: { label: string; amt_minor: number; height_pct: number }[] = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const dStart = todayStart - i * 24 * 60 * 60 * 1000;
        const dEnd = dStart + 24 * 60 * 60 * 1000 - 1;
        const targetDate = new Date(dStart);
        const dayLabel = i === 0 ? 'Today' : dayNames[targetDate.getDay()];

        const dayPayments = allPayments.filter((p) => p.time >= dStart && p.time <= dEnd);
        const amt = dayPayments.reduce((acc, p) => acc + p.amount_minor, 0);
        dayBars.push({ label: dayLabel, amt_minor: amt, height_pct: 10 });
      }

      const maxDay = Math.max(...dayBars.map((d) => d.amt_minor), 0);
      bars = dayBars.map((d) => ({
        label: d.label,
        amt_minor: d.amt_minor,
        height_pct: maxDay > 0 ? Math.max(10, Math.round((d.amt_minor / maxDay) * 100)) : 10,
      }));

      subLabel = `Last 7 days (including Today) vs prior week`;
    } else {
      // Month: 1st of current month up to today
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filteredPayments = allPayments.filter((p) => p.time >= monthStart && p.time <= todayEnd);

      // Previous month
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      const prevMonthEnd = monthStart - 1;
      prevPayments = allPayments.filter((p) => p.time >= prevMonthStart && p.time <= prevMonthEnd);

      // 4-5 weekly buckets for current month up to today
      const weekBuckets: { label: string; amt_minor: number; height_pct: number }[] = [];
      const daysInMonthSoFar = now.getDate();
      const numWeeks = Math.max(1, Math.ceil(daysInMonthSoFar / 7));

      for (let w = 1; w <= Math.max(4, numWeeks); w++) {
        const wStart = monthStart + (w - 1) * 7 * 24 * 60 * 60 * 1000;
        const wEnd = Math.min(todayEnd, wStart + 7 * 24 * 60 * 60 * 1000 - 1);

        const wPayments = allPayments.filter((p) => p.time >= wStart && p.time <= wEnd);
        const amt = wPayments.reduce((acc, p) => acc + p.amount_minor, 0);
        weekBuckets.push({
          label: w === numWeeks ? `W${w} (Now)` : `W${w}`,
          amt_minor: amt,
          height_pct: 10,
        });
      }

      const maxWeek = Math.max(...weekBuckets.map((w) => w.amt_minor), 0);
      bars = weekBuckets.map((w) => ({
        label: w.label,
        amt_minor: w.amt_minor,
        height_pct: maxWeek > 0 ? Math.max(10, Math.round((w.amt_minor / maxWeek) * 100)) : 10,
      }));

      const monthName = now.toLocaleString('en-US', { month: 'long' });
      subLabel = `${monthName} (up to Today) vs last month`;
    }

    const totalMinor = filteredPayments.reduce((acc, p) => acc + p.amount_minor, 0);
    const prevMinor = prevPayments.reduce((acc, p) => acc + p.amount_minor, 0);
    const billsCount = new Set(filteredPayments.map((p) => p.bill.id)).size;
    const avgBillMinor = billsCount > 0 ? Math.round(totalMinor / billsCount) : 0;

    // Service popularity from bills of collected payments
    const serviceCounts: Record<string, number> = {};
    const countedBills = new Set<string>();
    for (const p of filteredPayments) {
      if (countedBills.has(p.bill.id)) continue;
      countedBills.add(p.bill.id);
      if (p.bill.items) {
        for (const it of p.bill.items) {
          const name = it.service_name_snapshot || 'Service';
          serviceCounts[name] = (serviceCounts[name] || 0) + (it.quantity || 1);
        }
      }
    }
    const sortedServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);
    const topService =
      sortedServices.length > 0
        ? `${sortedServices[0][0]} · ${sortedServices[0][1]} sold`
        : 'No services yet';

    // Payment breakdown: UPI, Cash, Card calculated from genuine payments
    const paymentTotals: Record<string, number> = { UPI: 0, Cash: 0, Card: 0 };
    for (const p of filteredPayments) {
      const rawMode = (p.method || 'UPI').trim();
      let modeKey = 'UPI';
      if (/cash/i.test(rawMode)) modeKey = 'Cash';
      else if (/card/i.test(rawMode)) modeKey = 'Card';
      else if (/upi/i.test(rawMode)) modeKey = 'UPI';

      paymentTotals[modeKey] = (paymentTotals[modeKey] || 0) + p.amount_minor;
    }

    const modes = [
      {
        label: 'UPI',
        amt_minor: paymentTotals['UPI'] || 0,
        pct: totalMinor > 0 ? Math.round(((paymentTotals['UPI'] || 0) / totalMinor) * 100) : 0,
      },
      {
        label: 'Cash',
        amt_minor: paymentTotals['Cash'] || 0,
        pct: totalMinor > 0 ? Math.round(((paymentTotals['Cash'] || 0) / totalMinor) * 100) : 0,
      },
      {
        label: 'Card',
        amt_minor: paymentTotals['Card'] || 0,
        pct: totalMinor > 0 ? Math.round(((paymentTotals['Card'] || 0) / totalMinor) * 100) : 0,
      },
    ];

    return {
      total_minor: totalMinor,
      prev_minor: prevMinor,
      bills_count: billsCount,
      avg_bill_minor: avgBillMinor,
      top_service: topService,
      sub_label: subLabel,
      modes,
      bars,
    };
  }

  private async cacheBills(shopId: string, bills: Bill[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_BILLS}_${shopId}`, JSON.stringify(bills));
  }

  private async getCachedBills(shopId: string): Promise<Bill[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_BILLS}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const billingRepository = new BillingRepository();
