import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appointment, AppointmentStatus } from '../types/domain';

const STORAGE_KEY_APPTS = '@salon_os_appts_cache';

export const STANDARD_SLOTS = [
  '9:30', '10:00', '10:30', '11:00', '11:30', '12:00',
  '2:00', '2:30', '3:00', '4:00', '4:30', '5:30'
] as const;

export class AppointmentRepository {
  /**
   * Fetch all real appointments for a shop from Supabase
   */
  async getAppointments(shopId: string, dayIndex = 1): Promise<Appointment[]> {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(name, phone), staff(name), services(name, price_minor)')
        .eq('shop_id', shopId)
        .order('starts_at', { ascending: true });

      if (!error && data) {
        const mapped: Appointment[] = data.map((a) => {
          let parsedServiceIds: string[] = [];
          let storedServiceName = '';
          if (a.notes) {
            try {
              const parsed = JSON.parse(a.notes);
              if (Array.isArray(parsed?.service_ids)) {
                parsedServiceIds = parsed.service_ids;
              }
              if (parsed?.service_name) {
                storedServiceName = parsed.service_name;
              }
            } catch {
              // plain text notes, keep empty
            }
          }
          if (parsedServiceIds.length === 0 && a.service_id) {
            parsedServiceIds = [a.service_id];
          }

          return {
            id: a.id,
            shop_id: a.shop_id,
            customer_id: a.customer_id,
            customer_name: (a.customers as any)?.name || 'Customer',
            customer_phone: (a.customers as any)?.phone,
            staff_id: a.staff_id,
            staff_name: (a.staff as any)?.name || 'Stylist',
            service_id: a.service_id,
            service_ids: parsedServiceIds,
            service_name: storedServiceName || (a.services as any)?.name || 'Service',
            starts_at: a.starts_at,
            duration_minutes: a.duration_minutes,
            status: a.status as AppointmentStatus,
            notes: a.notes,
            amount_minor: (a.services as any)?.price_minor || 0,
            created_at: a.created_at,
          };
        });
        await this.cacheAppointments(shopId, mapped);
        return mapped;
      }
    } catch {
      console.warn('AppointmentRepository: Offline fallback active');
    }

    const cached = await this.getCachedAppointments(shopId);
    return cached || [];
  }

  /**
   * Add a real appointment and persist directly to Supabase
   */
  async addAppointment(params: {
    shopId: string;
    customerName: string;
    customerId?: string | null;
    customerPhone?: string | null;
    serviceName: string;
    serviceId?: string | null;
    serviceIds?: string[] | null;
    stylistName: string;
    stylistId?: string | null;
    slot: string;
    dateStr?: string;
    amountRupees: number;
    sendConfirm?: boolean;
  }): Promise<Appointment> {
    const {
      shopId,
      customerName,
      customerId = null,
      customerPhone = null,
      serviceName,
      serviceId = null,
      serviceIds = null,
      stylistName,
      stylistId = null,
      slot,
      dateStr,
      amountRupees,
      sendConfirm = true,
    } = params;

    const startsAtDisplay = dateStr ? `${dateStr} ${slot}` : slot;

    const allServiceIds =
      serviceIds && serviceIds.length > 0
        ? serviceIds
        : serviceId
        ? [serviceId]
        : [];

    const notesData = JSON.stringify({
      client: customerId ? null : customerName,
      service_ids: allServiceIds,
      service_name: serviceName,
    });

    const newAppt: Appointment = {
      id: `appt_${Date.now()}`,
      shop_id: shopId,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: customerPhone,
      staff_id: stylistId,
      staff_name: stylistName,
      service_id: allServiceIds[0] || serviceId,
      service_ids: allServiceIds,
      service_name: serviceName,
      starts_at: startsAtDisplay,
      duration_minutes: 45,
      status: 'Confirmed',
      notes: notesData,
      amount_minor: Math.round(amountRupees * 100),
      created_at: new Date().toISOString(),
    };

    try {
      const payload: any = {
        shop_id: shopId,
        starts_at: startsAtDisplay,
        duration_minutes: 45,
        status: 'Confirmed',
        notes: notesData,
      };

      if (customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
        payload.customer_id = customerId;
      }
      if (stylistId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stylistId)) {
        payload.staff_id = stylistId;
      }
      const primarySvcId = allServiceIds[0] || serviceId;
      if (primarySvcId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(primarySvcId)) {
        payload.service_id = primarySvcId;
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        newAppt.id = data.id;
      } else if (error) {
        console.warn('Supabase appointment insert error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase appointment save offline:', e);
    }

    const current = (await this.getCachedAppointments(shopId)) || [];
    const updated = [newAppt, ...current];
    await this.cacheAppointments(shopId, updated);
    return newAppt;
  }

  /**
   * Update appointment status
   */
  async updateStatus(
    shopId: string,
    apptId: string,
    newStatus: AppointmentStatus
  ): Promise<void> {
    const current = (await this.getCachedAppointments(shopId)) || [];
    const target = current.find((a) => a.id === apptId);
    if (target) {
      target.status = newStatus;
      await this.cacheAppointments(shopId, current);
    }

    try {
      await supabase
        .from('appointments')
        .update({ status: newStatus } as any)
        .eq('id', apptId);
    } catch {
      // ignore
    }
  }

  /**
   * Advance appointment to next lifecycle status
   */
  async advanceStatus(shopId: string, apptId: string): Promise<AppointmentStatus | null> {
    const current = (await this.getCachedAppointments(shopId)) || [];
    const target = current.find((a) => a.id === apptId);
    if (!target) return null;
    const order: AppointmentStatus[] = ['Not confirmed', 'Confirmed', 'In chair', 'Done'];
    const curIdx = order.indexOf(target.status);
    const nextStatus = curIdx < order.length - 1 ? order[curIdx + 1] : order[0];
    await this.updateStatus(shopId, apptId, nextStatus);
    return nextStatus;
  }


  private async cacheAppointments(shopId: string, appts: Appointment[]): Promise<void> {
    await AsyncStorage.setItem(`${STORAGE_KEY_APPTS}_${shopId}`, JSON.stringify(appts));
  }

  private async getCachedAppointments(shopId: string): Promise<Appointment[] | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_APPTS}_${shopId}`);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }
}

export const appointmentRepository = new AppointmentRepository();
