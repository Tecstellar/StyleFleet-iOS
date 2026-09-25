/**
 * Domain types for Salon OS
 * Used across hooks, services, repositories, and UI screens
 */

export type Period = 'Day' | 'Week' | 'Month';

export type ScreenName =
  | 'splash'
  | 'phone'
  | 'otp'
  | 'register'
  | 'workers'
  | 'home'
  | 'customers'
  | 'customer'
  | 'sales'
  | 'bill'
  | 'invoice'
  | 'sent'
  | 'accounts'
  | 'expenses'
  | 'appointments'
  | 'booking'
  | 'reminders'
  | 'bulk'
  | 'bulksent'
  | 'staff'
  | 'pricing'
  | 'profile';

export type MainTab = 'home' | 'customers' | 'sales' | 'accounts';

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  notes: string | null;
  preferred_staff_id: string | null;
  preferred_stylist_name?: string;
  is_starred: boolean;
  visits_count: number;
  lifetime_spend_minor: number;
  outstanding_due_minor: number;
  last_visit_date: string | null;
  due_start_date?: string | null;
  created_at: string;
}

export interface StaffMember {
  id: string;
  shop_id: string;
  name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  target_amount_minor: number;
  revenue_minor: number;
  service_count: number;
  rebook_rate: string;
  rating: string;
  chair_utilization: string;
}

export interface ServiceCategory {
  id: string;
  shop_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  shop_id: string;
  category_id: string | null;
  category_name?: string;
  name: string;
  price_minor: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface Offer {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  conditions: Record<string, any>;
  is_active: boolean;
}

export type AppointmentStatus =
  | 'Not confirmed'
  | 'Confirmed'
  | 'In chair'
  | 'Done'
  | 'Cancelled';

export interface Appointment {
  id: string;
  shop_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone?: string | null;
  staff_id: string | null;
  staff_name: string;
  service_id: string | null;
  service_name: string;
  starts_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  amount_minor: number;
  created_at: string;
}

export interface BillItem {
  id?: string;
  service_id: string | null;
  service_name_snapshot: string;
  quantity: number;
  unit_price_minor: number;
  discount_minor: number;
  tax_minor: number;
  line_total_minor: number;
  staff_id: string | null;
}

export interface Bill {
  id: string;
  shop_id: string;
  customer_id: string | null;
  customer_name: string;
  staff_id: string | null;
  staff_name: string;
  invoice_number: string;
  status: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  notes: string | null;
  issued_at: string;
  created_at?: string;
  payment_method: string;
  items: BillItem[];
}

export interface Expense {
  id: string;
  shop_id: string;
  category_id: string | null;
  category_name: string;
  note: string;
  amount_minor: number;
  payment_method: string;
  expense_date: string;
  created_at: string;
}

export interface ReminderItem {
  id: string;
  group: 'Today' | 'Upcoming';
  kind: 'appt' | 'money' | 'close' | 'support';
  title: string;
  sub: string;
  when: string;
  action: string;
  reference_id?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  amount_minor?: number;
}
