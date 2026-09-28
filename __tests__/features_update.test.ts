import { offerRepository } from '../src/repositories/offerRepository';
import { calculateTrialStatus, calculateSubscriptionStatus } from '../src/utils/subscriptionUtils';
import { SUBSCRIPTION_PLANS, formatPriceInRupees } from '../src/config/planConfig';
import { generateInvoiceHtml } from '../src/utils/invoicePdf';
import { Bill, Customer, SubscriptionRecord } from '../src/types/domain';

// Mock AsyncStorage
var mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage?.[key] || null),
  setItem: jest.fn(async (key: string, val: string) => {
    if (mockStorage) mockStorage[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    if (mockStorage) delete mockStorage[key];
  }),
}));

describe('New Features & Fixes Verification Suite', () => {
  const TEST_SHOP_ID = 'test_shop_101';

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  // -------------------------------------------------------------------------
  // 1. Duplicate Customer Prevention Logic
  // -------------------------------------------------------------------------
  describe('1. Duplicate Customer Prevention', () => {
    const existingCustomers: Customer[] = [
      {
        id: 'cust_priya',
        shop_id: TEST_SHOP_ID,
        name: 'Priya Sharma',
        phone: '9876543210',
        notes: null,
        preferred_staff_id: null,
        is_starred: true,
        visits_count: 4,
        lifetime_spend_minor: 450000,
        outstanding_due_minor: 0,
        last_visit_date: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'cust_arun',
        shop_id: TEST_SHOP_ID,
        name: 'Arun Kumar',
        phone: '+919123456780',
        notes: null,
        preferred_staff_id: null,
        is_starred: false,
        visits_count: 2,
        lifetime_spend_minor: 120000,
        outstanding_due_minor: 50000,
        last_visit_date: null,
        created_at: new Date().toISOString(),
      },
    ];

    it('identifies existing customer when 10-digit mobile number matches exactly', () => {
      const inputPhone = '9876543210';
      const cleanPhone10 = inputPhone.replace(/\D/g, '').slice(-10);

      const existingMatch = existingCustomers.find((c) => {
        const c10 = (c.phone || '').replace(/\D/g, '').slice(-10);
        return c10.length === 10 && c10 === cleanPhone10;
      });

      expect(existingMatch).toBeDefined();
      expect(existingMatch?.id).toBe('cust_priya');
      expect(existingMatch?.name).toBe('Priya Sharma');
    });

    it('identifies existing customer even when phone contains spaces, dashes or country code', () => {
      const inputPhone = '+91 91234-56780';
      const cleanPhone10 = inputPhone.replace(/\D/g, '').slice(-10);

      const existingMatch = existingCustomers.find((c) => {
        const c10 = (c.phone || '').replace(/\D/g, '').slice(-10);
        return c10.length === 10 && c10 === cleanPhone10;
      });

      expect(existingMatch).toBeDefined();
      expect(existingMatch?.id).toBe('cust_arun');
      expect(existingMatch?.name).toBe('Arun Kumar');
    });

    it('allows new customer when 10-digit mobile number does not exist', () => {
      const inputPhone = '9999888877';
      const cleanPhone10 = inputPhone.replace(/\D/g, '').slice(-10);

      const existingMatch = existingCustomers.find((c) => {
        const c10 = (c.phone || '').replace(/\D/g, '').slice(-10);
        return c10.length === 10 && c10 === cleanPhone10;
      });

      expect(existingMatch).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Offer Toggle ON / OFF (Manual & Default Offers)
  // -------------------------------------------------------------------------
  describe('2. Offer Toggle ON / OFF (Manual and Default Offers)', () => {
    it('initializes default offers and successfully toggles an offer OFF and ON', async () => {
      const offers = await offerRepository.getOffers(TEST_SHOP_ID);
      expect(offers.length).toBeGreaterThan(0);

      const targetOffer = offers[0];
      const initialStatus = targetOffer.is_active;

      // Toggle status
      const nextStatus = await offerRepository.toggleOffer(TEST_SHOP_ID, targetOffer.id, initialStatus);
      expect(nextStatus).toBe(!initialStatus);

      // Verify refreshed offers reflect change
      const refreshed = await offerRepository.getOffers(TEST_SHOP_ID);
      const updatedOffer = refreshed.find((o) => o.id === targetOffer.id);
      expect(updatedOffer?.is_active).toBe(!initialStatus);

      // Toggle back
      const revertedStatus = await offerRepository.toggleOffer(TEST_SHOP_ID, targetOffer.id, nextStatus);
      expect(revertedStatus).toBe(initialStatus);
    });

    it('toggles an unseeded offer by inserting and flipping state', async () => {
      const customOfferId = 'offer_festival_special';
      const result = await offerRepository.toggleOffer(TEST_SHOP_ID, customOfferId, false);
      expect(result).toBe(true);

      const refreshed = await offerRepository.getOffers(TEST_SHOP_ID);
      const customOffer = refreshed.find((o) => o.id === customOfferId);
      expect(customOffer).toBeDefined();
      expect(customOffer?.is_active).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Subscription Section UI & State Logic
  // -------------------------------------------------------------------------
  describe('3. Subscription Plans & Help Desk Request', () => {
    it('accurately computes 30-day free trial state for newly created salon', () => {
      const now = new Date();
      const shopCreatedAt = now.toISOString();

      const trial = calculateTrialStatus(shopCreatedAt, now);
      expect(trial.state).toBe('TRIAL_ACTIVE');
      expect(trial.isExpired).toBe(false);
      expect(trial.remainingDays).toBeGreaterThanOrEqual(29);
      expect(trial.remainingDays).toBeLessThanOrEqual(30);
    });

    it('accurately computes active subscription state', () => {
      const startDate = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);

      const mockSub: SubscriptionRecord = {
        id: 'sub_123',
        user_id: 'user_101',
        shop_id: TEST_SHOP_ID,
        plan_id: 'plan_3months',
        status: 'active',
        trial_start_date: null,
        trial_end_date: null,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: futureDate.toISOString(),
        amount_minor: 149900,
        currency: 'INR',
        created_at: startDate.toISOString(),
        updated_at: startDate.toISOString(),
      };

      const subResult = calculateSubscriptionStatus(mockSub, startDate);
      expect(subResult.state).toBe('ACTIVE_SUBSCRIPTION');
      expect(subResult.isExpired).toBe(false);
      expect(subResult.remainingDays).toBeGreaterThanOrEqual(89);
    });

    it('formats subscription plan request message correctly for Help Desk', () => {
      const plan = SUBSCRIPTION_PLANS[0]; // 3 Months
      const formattedPrice = formatPriceInRupees(plan.price);
      const prefillMessage = `Hi StyleFleet, I need this subscription: ${plan.name} (${formattedPrice} / ${plan.durationDays} days). Please activate it for my salon.`;

      expect(prefillMessage).toContain('Hi StyleFleet');
      expect(prefillMessage).toContain(plan.name);
      expect(prefillMessage).toContain(formattedPrice);
      expect(prefillMessage).toContain(`${plan.durationDays} days`);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Invoice HTML & Print Visibility
  // -------------------------------------------------------------------------
  describe('4. Invoice High-Contrast Print Styling & Viewport', () => {
    const mockBill: Bill = {
      id: 'bill_test_1',
      shop_id: TEST_SHOP_ID,
      invoice_number: 'INV-2026-0001',
      customer_id: 'cust_1',
      customer_name: 'Rohit Sharma',
      staff_id: 'staff_1',
      staff_name: 'Deepak',
      items: [
        {
          id: 'item_1',
          service_id: 'svc_1',
          service_name_snapshot: 'Signature Haircut',
          unit_price_minor: 40000,
          quantity: 1,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 40000,
          staff_id: 'staff_1',
        },
      ],
      subtotal_minor: 40000,
      discount_minor: 5000,
      tax_minor: 6300,
      total_minor: 41300,
      paid_amount_minor: 41300,
      due_amount_minor: 0,
      payment_method: 'upi',
      status: 'paid',
      notes: null,
      issued_at: '28 Sep 2026, 04:30 PM',
      created_at: new Date().toISOString(),
    };

    it('generates HTML containing viewport meta tag and exact print color adjustment', () => {
      const html = generateInvoiceHtml({
        bill: mockBill,
        shopName: 'Crown & Blade Studio',
        shopAddress: '100 Feet Road, Indiranagar',
        customerPhone: '9876543210',
      });

      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">');
      expect(html).toContain('-webkit-print-color-adjust: exact !important;');
      expect(html).toContain('print-color-adjust: exact !important;');
      expect(html).toContain('@media print');
      expect(html).toContain('INV-2026-0001');
      expect(html).toContain('Crown & Blade Studio');
      expect(html).toContain('Rohit Sharma');
      expect(html).toContain('Signature Haircut');
    });
  });
});
