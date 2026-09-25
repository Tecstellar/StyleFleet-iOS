import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '../types/domain';

const STORAGE_KEY_CUSTOMERS = '@salon_os_customers_cache';

export class CustomerRepository {
  /**
   * Fetch all real customers for a shop from Supabase (with offline fallback cache)
   */
  async getCustomers(shopId: string): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

      if (!error && data) {
        // Fetch actual bill totals to accurately aggregate visits, spend, and dues
        const { data: billsData } = await supabase
          .from('bills')
          .select('customer_id, total_minor, status, created_at, issued_at')
          .eq('shop_id', shopId);

        const billsByCustomer: Record<
          string,
          {
            visits: number;
            spend: number;
            dues: number;
            lastDate: string | null;
            dueStartDate: string | null;
          }
        > = {};

        if (billsData) {
          for (const b of billsData) {
            if (!b.customer_id) continue;
            if (!billsByCustomer[b.customer_id]) {
              billsByCustomer[b.customer_id] = {
                visits: 0,
                spend: 0,
                dues: 0,
                lastDate: null,
                dueStartDate: null,
              };
            }
            const agg = billsByCustomer[b.customer_id];
            const billDate = b.issued_at || b.created_at;

            if (b.status === 'paid') {
              agg.visits += 1;
              agg.spend += b.total_minor || 0;
              if (!agg.lastDate || new Date(billDate) > new Date(agg.lastDate)) {
                agg.lastDate = billDate;
              }
            } else if (b.status === 'pending' || b.status === 'partially_paid') {
              agg.dues += b.total_minor || 0;
              if (!agg.dueStartDate || new Date(billDate) < new Date(agg.dueStartDate)) {
                agg.dueStartDate = billDate;
              }
            }
          }
        }

        const mapped: Customer[] = data.map((c) => {
          const stats = billsByCustomer[c.id] || {
            visits: 0,
            spend: 0,
            dues: 0,
            lastDate: null,
            dueStartDate: null,
          };

          let formattedLastVisit: string | null = null;
          if (stats.lastDate) {
            const d = new Date(stats.lastDate);
            formattedLastVisit = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
          }

          let formattedDueStart: string | null = null;
          if (stats.dueStartDate) {
            const d = new Date(stats.dueStartDate);
            formattedDueStart = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
          }

          return {
            id: c.id,
            shop_id: c.shop_id,
            name: c.name,
            phone: c.phone,
            notes: c.notes,
            preferred_staff_id: c.preferred_staff_id,
            preferred_stylist_name: undefined,
            is_starred: !!c.is_starred,
            visits_count: stats.visits,
            lifetime_spend_minor: stats.spend,
            outstanding_due_minor: stats.dues,
            last_visit_date: formattedLastVisit,
            due_start_date: formattedDueStart,
            created_at: c.created_at,
          };
        });

        await this.cacheCustomers(shopId, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('CustomerRepository: Offline fallback active');
    }

    // Return cached real customers, or empty array if none exist
    const cached = await this.getCachedCustomers(shopId);
    return cached || [];
  }

  /**
   * Add a real customer and persist directly to Supabase
   */
  async addCustomer(
    shopId: string,
    name: string,
    phone: string,
    initialDueMinor = 0,
    isStarred = false,
    notes?: string
  ): Promise<Customer> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      shop_id: shopId,
      name,
      phone: cleanPhone,
      notes: notes || null,
      preferred_staff_id: null,
      is_starred: isStarred,
      visits_count: 0,
      lifetime_spend_minor: 0,
      outstanding_due_minor: initialDueMinor,
      last_visit_date: null,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          shop_id: shopId,
          name,
          phone: cleanPhone,
          notes: notes || null,
          is_starred: isStarred,
        } as any)
        .select()
        .single();

      if (!error && data) {
        newCust.id = data.id;
        newCust.created_at = data.created_at;

        // If there is an initial due, record it as a pending bill in Supabase
        if (initialDueMinor > 0) {
          const invNum = `DUE-${Date.now().toString().slice(-6)}`;
          await supabase.from('bills').insert({
            shop_id: shopId,
            customer_id: data.id,
            total_minor: initialDueMinor,
            subtotal_minor: initialDueMinor,
            discount_minor: 0,
            tax_minor: 0,
            status: 'pending',
            invoice_number: invNum,
            notes: 'Initial opening balance due',
          } as any);
        }
      } else if (error) {
        console.error('Supabase customer insert error:', error);
      }
    } catch (e) {
      console.warn('Supabase customer add error:', e);
    }

    const current = (await this.getCachedCustomers(shopId)) || [];
    const updated = [newCust, ...current];
    await this.cacheCustomers(shopId, updated);
    return newCust;
  }

  /**
   * Import multiple contacts from phone directly into Supabase
   */
  async importContacts(
    shopId: string,
    contacts: { name: string; phone: string; initialDueMinor?: number }[]
  ): Promise<Customer[]> {
    if (contacts.length === 0) return [];

    const rowsToInsert = contacts.map((c) => ({
      shop_id: shopId,
      name: c.name.trim(),
      phone: c.phone.replace(/\D/g, '').slice(-10),
      is_starred: false,
    }));

    const createdCustomers: Customer[] = [];

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(rowsToInsert as any)
        .select();

      if (!error && data) {
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const due = contacts[i]?.initialDueMinor || 0;

          if (due > 0) {
            const invNum = `DUE-${(Date.now() + i).toString().slice(-6)}`;
            await supabase.from('bills').insert({
              shop_id: shopId,
              customer_id: row.id,
              total_minor: due,
              subtotal_minor: due,
              discount_minor: 0,
              tax_minor: 0,
              status: 'pending',
              invoice_number: invNum,
              notes: 'Imported opening balance due',
            } as any);
          }

          createdCustomers.push({
            id: row.id,
            shop_id: row.shop_id,
            name: row.name,
            phone: row.phone,
            notes: row.notes,
            preferred_staff_id: null,
            is_starred: false,
            visits_count: 0,
            lifetime_spend_minor: 0,
            outstanding_due_minor: due,
            last_visit_date: null,
            created_at: row.created_at,
          });
        }
      } else if (error) {
        console.error('Supabase contacts batch import error:', error);
      }
    } catch (e) {
      console.warn('Batch import contacts error:', e);
    }

    const current = (await this.getCachedCustomers(shopId)) || [];
    const updated = [...createdCustomers, ...current];
    await this.cacheCustomers(shopId, updated);
    return createdCustomers;
  }

  /**
   * Update an existing customer's profile in Supabase
   */
  async updateCustomer(
    shopId: string,
    customerId: string,
    updates: { name?: string; phone?: string; notes?: string; is_starred?: boolean; dueMinor?: number }
  ): Promise<Customer | null> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const targetIdx = list.findIndex((c) => c.id === customerId);
    if (targetIdx === -1) return null;

    const updatedCust = { ...list[targetIdx], ...updates };
    if (updates.name) {
      updatedCust.name = updates.name.trim();
    }
    if (updates.phone) {
      updatedCust.phone = updates.phone.replace(/\D/g, '').slice(-10);
    }
    if (updates.dueMinor !== undefined) {
      updatedCust.outstanding_due_minor = updates.dueMinor;
    }
    list[targetIdx] = updatedCust;

    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updatedCust.name;
      if (updates.phone !== undefined) payload.phone = updatedCust.phone;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.is_starred !== undefined) payload.is_starred = updates.is_starred;

      await supabase
        .from('customers')
        .update(payload)
        .eq('id', customerId);

      // Handle due balance update in database
      if (updates.dueMinor !== undefined) {
        const { data: existingDues } = await supabase
          .from('bills')
          .select('id, total_minor')
          .eq('shop_id', shopId)
          .eq('customer_id', customerId)
          .in('status', ['pending', 'partially_paid'])
          .order('created_at', { ascending: false });

        if (updates.dueMinor === 0) {
          // If due set to 0, mark any pending bills as settled
          if (existingDues && existingDues.length > 0) {
            for (const b of existingDues) {
              await supabase.from('bills').update({ status: 'paid' }).eq('id', b.id);
            }
          }
        } else if (existingDues && existingDues.length > 0) {
          // Update the latest pending due bill to match the new due amount
          await supabase
            .from('bills')
            .update({
              total_minor: updates.dueMinor,
              subtotal_minor: updates.dueMinor,
            })
            .eq('id', existingDues[0].id);
        } else {
          // Create new pending bill for the due
          const invNum = `DUE-${Date.now().toString().slice(-6)}`;
          await supabase.from('bills').insert({
            shop_id: shopId,
            customer_id: customerId,
            total_minor: updates.dueMinor,
            subtotal_minor: updates.dueMinor,
            discount_minor: 0,
            tax_minor: 0,
            status: 'pending',
            invoice_number: invNum,
            notes: 'Adjusted customer due balance',
          } as any);
        }
      }
    } catch (e) {
      console.warn('Supabase customer update error:', e);
    }

    await this.cacheCustomers(shopId, list);
    return updatedCust;
  }

  /**
   * Settle all outstanding dues for a customer
   */
  async settleDues(
    shopId: string,
    customerId: string,
    method: 'cash' | 'upi' = 'cash'
  ): Promise<boolean> {
    try {
      // Find all pending bills for this customer
      const { data: pendingBills, error } = await supabase
        .from('bills')
        .select('*')
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .in('status', ['pending', 'partially_paid']);

      if (!error && pendingBills && pendingBills.length > 0) {
        for (const bill of pendingBills) {
          const now = new Date().toISOString();
          // Record payment with reference, method, and paid_at
          const { error: payError } = await supabase.from('payments').insert({
            shop_id: shopId,
            bill_id: bill.id,
            amount_minor: bill.total_minor,
            method,
            status: 'completed',
            reference: 'Settled customer due',
            paid_at: now,
          } as any);

          if (payError) {
            console.error('Supabase payment insert error:', payError);
          }

          // Mark bill as paid
          await supabase
            .from('bills')
            .update({ status: 'paid', updated_at: now } as any)
            .eq('id', bill.id);
        }
      }
    } catch (e) {
      console.warn('Supabase settle dues error:', e);
    }

    // Update local cached customer
    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (target) {
      target.outstanding_due_minor = 0;
      target.due_start_date = null;
      await this.cacheCustomers(shopId, list);
    }
    return true;
  }

  /**
   * Fetch detailed due and payment records for a customer directly from Supabase
   */
  async getCustomerDueHistory(shopId: string, customerId: string) {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          id,
          invoice_number,
          total_minor,
          status,
          notes,
          issued_at,
          created_at,
          updated_at,
          payments (
            id,
            amount_minor,
            method,
            reference,
            paid_at,
            status
          )
        `)
        .eq('shop_id', shopId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Error fetching customer due history:', e);
    }
    return [];
  }

  /**
   * Toggle starred status for VIP customer
   */
  async toggleStar(shopId: string, customerId: string): Promise<boolean> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (!target) return false;

    const nextState = !target.is_starred;
    target.is_starred = nextState;

    try {
      await supabase
        .from('customers')
        .update({ is_starred: nextState } as any)
        .eq('id', customerId);
    } catch (e) {
      console.warn('Supabase star toggle error:', e);
    }

    await this.cacheCustomers(shopId, list);
    return nextState;
  }

  /**
   * Update customer notes
   */
  async updateNotes(shopId: string, customerId: string, notes: string): Promise<void> {
    const list = (await this.getCachedCustomers(shopId)) || [];
    const target = list.find((c) => c.id === customerId);
    if (target) {
      target.notes = notes;
      await this.cacheCustomers(shopId, list);
    }

    try {
      await supabase
        .from('customers')
        .update({ notes } as any)
        .eq('id', customerId);
    } catch {
      // ignore
    }
  }

  private async cacheCustomers(shopId: string, customers: Customer[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_CUSTOMERS}_${shopId}`, JSON.stringify(customers));
  }

  private async getCachedCustomers(shopId: string): Promise<Customer[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_CUSTOMERS}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const customerRepository = new CustomerRepository();
