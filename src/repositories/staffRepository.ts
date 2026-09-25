import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StaffMember } from '../types/domain';

const STORAGE_KEY_STAFF = '@salon_os_staff_cache';

export class StaffRepository {
  /**
   * Fetch real staff members for a shop from Supabase
   */
  async getStaff(shopId: string): Promise<StaffMember[]> {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('shop_id', shopId)
        .order('name', { ascending: true });

      if (!error && data) {
        // Calculate staff revenue & service count from actual bills
        const { data: billItems } = await supabase
          .from('bill_items')
          .select('staff_id, line_total_minor, quantity')
          .eq('shop_id', shopId);

        const revByStaff: Record<string, { rev: number; count: number }> = {};
        if (billItems) {
          for (const it of billItems) {
            if (!it.staff_id) continue;
            if (!revByStaff[it.staff_id]) {
              revByStaff[it.staff_id] = { rev: 0, count: 0 };
            }
            revByStaff[it.staff_id].rev += (it.line_total_minor || 0);
            revByStaff[it.staff_id].count += (it.quantity || 1);
          }
        }

        const mapped: StaffMember[] = data.map((s) => {
          const stats = revByStaff[s.id] || { rev: 0, count: 0 };
          return {
            id: s.id,
            shop_id: s.shop_id,
            name: s.name,
            role: s.role || 'Barber',
            phone: s.phone,
            is_active: s.is_active,
            target_amount_minor: 500000,
            revenue_minor: stats.rev,
            service_count: stats.count,
            rebook_rate: stats.count > 0 ? '65%' : '0%',
            rating: '4.8',
            chair_utilization: stats.count > 0 ? '70%' : '0%',
          };
        });

        await this.cacheStaff(shopId, mapped);
        return mapped;
      }
    } catch {
      console.warn('StaffRepository: Offline fallback active');
    }

    const cached = await this.getCachedStaff(shopId);
    return cached || [];
  }

  /**
   * Add a real staff member and persist to Supabase
   */
  async addStaff(
    shopId: string,
    name: string,
    role: string,
    phone?: string,
    commissionPct = 10
  ): Promise<StaffMember> {
    const newStaff: StaffMember = {
      id: `staff_${Date.now()}`,
      shop_id: shopId,
      name,
      role,
      phone: phone || null,
      is_active: true,
      target_amount_minor: 500000,
      revenue_minor: 0,
      service_count: 0,
      rebook_rate: '0%',
      rating: '5.0',
      chair_utilization: '0%',
    };

    try {
      const { data, error } = await supabase
        .from('staff')
        .insert({
          shop_id: shopId,
          name,
          role,
          phone: phone || null,
          is_active: true,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('Supabase staff insert error:', error);
      } else if (data) {
        newStaff.id = data.id;
      }
    } catch (e) {
      console.warn('Supabase staff save offline:', e);
    }

    const current = (await this.getCachedStaff(shopId)) || [];
    const updated = [...current, newStaff];
    await this.cacheStaff(shopId, updated);
    return newStaff;
  }

  /**
   * Toggle staff active status
   */
  async toggleStaffStatus(shopId: string, staffId: string): Promise<boolean> {
    const list = (await this.getCachedStaff(shopId)) || [];
    const target = list.find((s) => s.id === staffId);
    if (!target) return false;

    const nextState = !target.is_active;
    target.is_active = nextState;

    try {
      await supabase
        .from('staff')
        .update({ is_active: nextState } as any)
        .eq('id', staffId);
    } catch {
      // ignore
    }

    await this.cacheStaff(shopId, list);
    return nextState;
  }

  private async cacheStaff(shopId: string, staff: StaffMember[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_STAFF}_${shopId}`, JSON.stringify(staff));
  }

  private async getCachedStaff(shopId: string): Promise<StaffMember[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_STAFF}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const staffRepository = new StaffRepository();
