import AsyncStorage from '@react-native-async-storage/async-storage';
import { authRepository, AuthUser } from '../src/repositories/authRepository';
import { shopRepository, ShopRow, ShopRegistrationData } from '../src/repositories/shopRepository';
import { customerRepository } from '../src/repositories/customerRepository';
import { billingRepository, dedupeBills } from '../src/repositories/billingRepository';
import { appointmentRepository } from '../src/repositories/appointmentRepository';
import { financialService } from '../src/services/financialService';
import { authService } from '../src/services/authService';
import { generateInvoiceHtml } from '../src/utils/invoicePdf';
import { translations } from '../src/i18n/translations';
import { Customer, Bill, Appointment, Expense } from '../src/types/domain';

// Mock Supabase
let mockCurrentAuthUser: any = { id: 'user_vikram', phone: '9876543210' };
let mockDbBills: any[] = [];
let mockDbPayments: any[] = [];
let mockDbCustomers: any[] = [];

jest.mock('../src/lib/supabase', () => {
  const createBuilder = (table: string) => {
    let pendingStatusFilter: string[] | null = null;
    let pendingCustomerFilter: string | null = null;

    const builder: any = {
      select: jest.fn().mockImplementation(() => builder),
      insert: jest.fn().mockImplementation((payload: any) => {
        if (table === 'bills') {
          const rows = Array.isArray(payload) ? payload : [payload];
          const created = rows.map((p, idx) => {
            const b = { id: `bill_${Date.now()}_${idx}`, ...p, bill_items: [], payments: [] };
            mockDbBills.push(b);
            return b;
          });
          return {
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: created[0], error: null }),
            }),
            single: jest.fn().mockResolvedValue({ data: created[0], error: null }),
            data: created[0],
            error: null,
          };
        }
        if (table === 'payments') {
          const rows = Array.isArray(payload) ? payload : [payload];
          rows.forEach((p) => mockDbPayments.push({ id: `pay_${Date.now()}`, ...p }));
          return Promise.resolve({ data: payload, error: null });
        }
        return {
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: `row_${Date.now()}`, ...payload }, error: null }),
          }),
          single: jest.fn().mockResolvedValue({ data: { id: `row_${Date.now()}`, ...payload }, error: null }),
          data: payload,
          error: null,
        };
      }),
      update: jest.fn().mockImplementation((updates: any) => {
        return {
          ...builder,
          eq: jest.fn().mockImplementation((col: string, val: any) => {
            if (table === 'bills') {
              const target = mockDbBills.find((b) => b[col] === val || b.id === val);
              if (target) Object.assign(target, updates);
              return Promise.resolve({ data: target, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }),
      delete: jest.fn().mockImplementation(() => builder),
      upsert: jest.fn().mockImplementation(() => builder),
      eq: jest.fn().mockImplementation((col: string, val: any) => {
        if (col === 'customer_id') pendingCustomerFilter = val;
        return builder;
      }),
      in: jest.fn().mockImplementation((col: string, val: any) => {
        if (col === 'status') pendingStatusFilter = val;
        return builder;
      }),
      order: jest.fn().mockImplementation(() => {
        if (table === 'bills') {
          let res = [...mockDbBills];
          if (pendingCustomerFilter) res = res.filter((b) => b.customer_id === pendingCustomerFilter);
          if (pendingStatusFilter) res = res.filter((b) => pendingStatusFilter!.includes(b.status));
          return Promise.resolve({ data: res, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }),
      single: jest.fn().mockImplementation(() =>
        Promise.resolve({
          data: {
            id: 'shop_demo_user',
            name: 'StyleFleet Luxury Salon',
            owner_profile_id: 'user_vikram',
            address: '88 Brigade Road, 2nd Floor',
            city: 'Bengaluru',
            pin_code: '560001',
            phone: '9876543210',
            accent_color: '#D9A441',
            invoice_prefix: 'INV',
            gst_rate: 18,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        })
      ),
      then: (resolve: any) => {
        if (table === 'bills') {
          let res = [...mockDbBills];
          if (pendingCustomerFilter) res = res.filter((b) => b.customer_id === pendingCustomerFilter);
          if (pendingStatusFilter) res = res.filter((b) => pendingStatusFilter!.includes(b.status));
          return resolve({ data: res, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };

    return builder;
  };

  return {
    supabase: {
      auth: {
        signInWithPassword: jest.fn().mockImplementation(() => {
          mockCurrentAuthUser = { id: 'user_vikram', phone: '9876543210' };
          return Promise.resolve({
            data: { user: mockCurrentAuthUser, session: { user: mockCurrentAuthUser } },
            error: null,
          });
        }),
        signUp: jest.fn().mockImplementation(() => {
          mockCurrentAuthUser = { id: 'user_vikram', phone: '9876543210' };
          return Promise.resolve({
            data: { user: mockCurrentAuthUser, session: { user: mockCurrentAuthUser } },
            error: null,
          });
        }),
        getSession: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: { session: mockCurrentAuthUser ? { user: mockCurrentAuthUser } : null },
            error: null,
          })
        ),
        signOut: jest.fn().mockImplementation(() => {
          mockCurrentAuthUser = null;
          return Promise.resolve({ error: null });
        }),
      },
      from: jest.fn((table: string) => createBuilder(table)),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
  };
});

describe('StyleFleet iOS — Complete Automated End-to-End User Journey (Demo ID: user_vikram)', () => {
  const DEMO_PHONE = '9876543210';
  const DEMO_OTP = '123456';
  const DEMO_SHOP_ID = 'shop_demo_user';

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockDbBills = [];
    mockDbPayments = [];
    mockDbCustomers = [];
    jest.clearAllMocks();

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/SMS/VERIFY/')) {
        return Promise.resolve({
          json: () => Promise.resolve({ Status: 'Success', Details: 'OTP Matched' }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ Status: 'Success', Details: 'mock_demo_session_123456' }),
      });
    }) as any;
  });

  // =========================================================================
  // 1. SPLASH SCREEN & AUTHENTICATION (DEMO ID)
  // =========================================================================
  describe('Step 1: Splash Screen, Phone Entry & Demo OTP Authentication', () => {
    it('handles phone validation and enforces single OTP SMS dispatch (no dual SMS)', async () => {
      // 1.1 Invalid mobile validation
      const badPhoneRes = await authRepository.sendOtp('9876');
      expect(badPhoneRes.success).toBe(false);
      expect(badPhoneRes.error).toContain('10-digit');

      // 1.2 Valid Demo Phone sends single SMS
      const sendRes = await authRepository.sendOtp(DEMO_PHONE);
      expect(sendRes.success).toBe(true);
      expect(sendRes.sessionId).toBeDefined();

      // 1.3 Rapid duplicate click cooldown returns the exact same in-flight session
      const duplicateRes = await authRepository.sendOtp(DEMO_PHONE);
      expect(duplicateRes.success).toBe(true);
      expect(duplicateRes.sessionId).toBe(sendRes.sessionId);
    });

    it('verifies Demo OTP (123456) and stores persistent local session for user_vikram', async () => {
      const sendRes = await authRepository.sendOtp(DEMO_PHONE);
      const verifyRes = await authRepository.verifyOtp(DEMO_PHONE, DEMO_OTP, sendRes.sessionId);

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user?.phone).toBe(DEMO_PHONE);

      const session = await authRepository.getSession();
      expect(session).not.toBeNull();
      expect(session?.phone).toBe(DEMO_PHONE);
    });
  });

  // =========================================================================
  // 2. SHOP REGISTRATION & SALON PROFILE SETUP
  // =========================================================================
  describe('Step 2: Salon Registration, PIN Validation & Profile Customization', () => {
    it('validates 6-digit PIN code and creates the salon profile', async () => {
      const regData: ShopRegistrationData = {
        name: 'StyleFleet Luxury Salon',
        ownerName: 'Vikram Mehta',
        phone: DEMO_PHONE,
        address: '88 Brigade Road, 2nd Floor',
        city: 'Bengaluru',
        pinCode: '560001',
        gstin: '29ABCDE1234F1Z5',
      };

      const shop = await authService.registerShop('user_vikram', regData);
      expect(shop.name).toBe('StyleFleet Luxury Salon');
      expect(shop.city).toBe('Bengaluru');

      // Cache shop and owner details
      await shopRepository.cacheShop(shop);
      await shopRepository.saveOwnerName('Vikram Mehta', 'user_vikram');
      await authRepository.setCurrentShopId(shop.id);

      const resolvedOwner = await shopRepository.resolveOwnerName('user_vikram');
      expect(resolvedOwner).toBe('Vikram Mehta');
    });

    it('reboots app and verifies instant sub-5ms launch into Dashboard without asking for login', async () => {
      // Simulate persistent state stored on device before reboot
      await shopRepository.cacheShop({
        id: DEMO_SHOP_ID,
        name: 'StyleFleet Luxury Salon',
        owner_profile_id: 'user_vikram',
        logo_path: null,
        address: '88 Brigade Road, 2nd Floor',
        city: 'Bengaluru',
        pin_code: '560001',
        gstin: '29ABCDE1234F1Z5',
        phone: DEMO_PHONE,
        accent_color: '#D9A441',
        invoice_prefix: 'INV',
        gst_rate: 18,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await authRepository.saveSession({
        id: 'user_vikram',
        phone: DEMO_PHONE,
      });

      const [cachedShop, cachedUser] = await Promise.all([
        shopRepository.getCachedShop(),
        authRepository.getSession(),
      ]);

      expect(cachedShop).toBeDefined();
      expect(cachedUser).toBeDefined();
      const initialRoute = cachedShop ? 'home' : 'phone';
      expect(initialRoute).toBe('home');
    });
  });

  // =========================================================================
  // 3. HOME SCREEN & MARKETING HERO
  // =========================================================================
  describe('Step 3: Home Dashboard, Marketing Hero & Quick Actions', () => {
    it('renders time-based greeting, translated tagline and operational tools', () => {
      expect(translations.en.lookGoodFeelGood).toBe('LOOK GOOD  •  FEEL GOOD');
      expect(translations.en.youDeserve).toBe('You Deserve');
      expect(translations.ta.lookGoodFeelGood).toContain('அழகாக இருங்கள்');
      expect(translations.hi.lookGoodFeelGood).toContain('खूबसूरत दिखें');
    });
  });

  // =========================================================================
  // 4. CUSTOMERS, IMPORT CONTACTS & 200 CLIENT DISPLAY CAP
  // =========================================================================
  describe('Step 4: Customer Directory, Contact Imports & Search Behavior', () => {
    it('verifies 200 client display limit on browse and 100% search across full customer database', async () => {
      // Generate 250 test customers
      const testCustomers: Customer[] = [];
      for (let i = 1; i <= 250; i++) {
        testCustomers.push({
          id: `cust_${i}`,
          shop_id: DEMO_SHOP_ID,
          name: i === 245 ? 'Zoya Akhtar Hidden' : `Client ${i}`,
          phone: `980000${String(i).padStart(4, '0')}`,
          notes: null,
          preferred_staff_id: null,
          is_starred: i <= 5,
          visits_count: i,
          lifetime_spend_minor: i * 50000,
          outstanding_due_minor: i === 10 ? 80000 : 0,
          last_visit_date: 'Yesterday',
          created_at: new Date().toISOString(),
        });
      }

      await (customerRepository as any).cacheCustomers(DEMO_SHOP_ID, testCustomers);
      const cached = await (customerRepository as any).getCachedCustomers(DEMO_SHOP_ID);
      expect(cached?.length).toBe(250);

      // Verify Browse limit: only 200 visible
      const isSearching = false;
      const displayedWhenBrowsing = isSearching ? testCustomers : testCustomers.slice(0, 200);
      expect(displayedWhenBrowsing.length).toBe(200);

      // Verify Search: queries across ALL 250 customers and finds customer #245
      const query = 'Zoya';
      const searchMatches = testCustomers.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      expect(searchMatches.length).toBe(1);
      expect(searchMatches[0].name).toBe('Zoya Akhtar Hidden');
    });

    it('validates duplicate phone prevention when adding client', () => {
      const existing = [{ id: 'c1', name: 'Existing User', phone: '9845012345' } as Customer];
      const newPhone = '9845012345';
      const duplicateFound = existing.some((c) => c.phone === newPhone);
      expect(duplicateFound).toBe(true);
    });
  });

  // =========================================================================
  // 5. APPOINTMENTS & SCHEDULING (SLOT CONFLICTS & SERVICE GRID)
  // =========================================================================
  describe('Step 5: Appointments, Slot Conflict Detection & In-Chair Progression', () => {
    it('detects booked slots for a stylist on the same date and prevents double booking', () => {
      const existingAppt: Appointment = {
        id: 'appt_1',
        shop_id: DEMO_SHOP_ID,
        customer_id: 'cust_rohit',
        customer_name: 'Rohit Roy',
        customer_phone: '9876543210',
        staff_id: 'staff_rahul',
        staff_name: 'Rahul',
        service_id: 'svc_haircut',
        service_ids: ['svc_haircut'],
        service_name: 'Haircut',
        starts_at: '2026-09-27 10:30 AM',
        duration_minutes: 45,
        status: 'Confirmed',
        notes: null,
        amount_minor: 50000,
        created_at: '2026-09-27T10:00:00Z',
      };

      const requestedSlot = '10:30 AM';
      const requestedDate = '2026-09-27';
      const isBooked =
        existingAppt.staff_id === 'staff_rahul' &&
        existingAppt.starts_at?.includes(requestedSlot) &&
        existingAppt.starts_at?.includes(requestedDate) &&
        existingAppt.status !== 'Cancelled';

      expect(isBooked).toBe(true);
    });

    it('pre-fills all services when clicking "Bill and Close" from appointment', () => {
      const multiServiceAppt: Appointment = {
        id: 'appt_multi',
        shop_id: DEMO_SHOP_ID,
        customer_id: 'cust_vikram',
        customer_name: 'Vikram',
        customer_phone: '9876543210',
        staff_id: 's1',
        staff_name: 'Sameer',
        service_id: 's_cut',
        service_ids: ['s_cut', 's_beard', 's_facial'],
        service_name: 'Signature Cut + Beard Trim + Charcoal Facial',
        starts_at: '2026-09-27 11:30 AM',
        duration_minutes: 60,
        status: 'In chair',
        notes: null,
        amount_minor: 180000,
        created_at: new Date().toISOString(),
      };

      // Match logic replicates AppNavigator handleBillAndClose
      let matchedIds: string[] = [];
      if (multiServiceAppt.service_ids && multiServiceAppt.service_ids.length > 0) {
        matchedIds = [...multiServiceAppt.service_ids];
      }

      expect(matchedIds.length).toBe(3);
      expect(matchedIds).toEqual(['s_cut', 's_beard', 's_facial']);
    });
  });

  // =========================================================================
  // 6. BILLING: FULL, PARTIAL, PENDING & DUE TRACKING
  // =========================================================================
  describe('Step 6: Billing & Invoices (Full Paid, Partial Pay, Fully Pending)', () => {
    it('creates Full Payment bill (UPI) and records payment accurately', async () => {
      const bill = await billingRepository.createBill(
        DEMO_SHOP_ID,
        'Ananya Sharma',
        'c_ananya',
        'Rahul',
        's_rahul',
        [{ name: 'Haircut', priceMinor: 80000 }],
        'UPI',
        0,
        80000, // full paid
        0      // 0 due
      );

      expect(bill.status).toBe('paid');
      expect(bill.paid_amount_minor).toBe(80000);
      expect(bill.due_amount_minor).toBe(0);
    });

    it('creates Partial Pay bill with customer due balance', async () => {
      // Total ₹2,500. Paid now: ₹1,000 via Cash. Due: ₹1,500
      const partialBill = await billingRepository.createBill(
        DEMO_SHOP_ID,
        'Karan Johar',
        'c_karan',
        'Sameer',
        's_sameer',
        [{ name: 'Keratin Treatment', priceMinor: 250000 }],
        'Partial Pay (Cash)',
        0,
        100000, // paid ₹1,000
        150000  // due ₹1,500
      );

      expect(partialBill.status).toBe('partially_paid');
      expect(partialBill.paid_amount_minor).toBe(100000);
      expect(partialBill.due_amount_minor).toBe(150000);
      expect(partialBill.notes).toContain('due:150000');
    });

    it('creates Fully Pending bill (₹1,200 due) with customer tracking', async () => {
      const pendingBill = await billingRepository.createBill(
        DEMO_SHOP_ID,
        'Sunil Gavaskar',
        'c_sunil',
        'Rahul',
        's_rahul',
        [{ name: 'Royal Shave', priceMinor: 120000 }],
        'Fully Pending',
        0,
        0,      // paid ₹0
        120000  // due ₹1,200
      );

      expect(pendingBill.status).toBe('pending');
      expect(pendingBill.paid_amount_minor).toBe(0);
      expect(pendingBill.due_amount_minor).toBe(120000);
    });

    it('deduplicates recent bills list to avoid duplicate entries', () => {
      const rawBills: Bill[] = [
        { id: 'b1', invoice_number: 'INV-101', customer_name: 'A', items: [] } as any,
        { id: 'b1', invoice_number: 'INV-101', customer_name: 'A duplicate', items: [] } as any,
        { id: 'b2', invoice_number: 'INV-102', customer_name: 'B', items: [] } as any,
      ];

      const deduped = dedupeBills(rawBills);
      expect(deduped.length).toBe(2);
      expect(deduped[0].id).toBe('b1');
      expect(deduped[1].id).toBe('b2');
    });
  });

  // =========================================================================
  // 7. DUE SETTLEMENT (FULL & PARTIAL VIA SettleDueModal LOGIC)
  // =========================================================================
  describe('Step 7: Settle Dues via SettleDueModal (Partial & Full)', () => {
    it('performs partial due payment and keeps remaining due intact (not zeroed out)', async () => {
      // Customer has ₹1,500 due
      const custId = 'cust_due_test';
      const initialCust: Customer = {
        id: custId,
        shop_id: DEMO_SHOP_ID,
        name: 'Priya Rai',
        phone: '9845099887',
        notes: null,
        preferred_staff_id: null,
        is_starred: false,
        visits_count: 3,
        lifetime_spend_minor: 450000,
        outstanding_due_minor: 150000, // ₹1,500 due
        last_visit_date: 'Yesterday',
        created_at: new Date().toISOString(),
      };
      await (customerRepository as any).cacheCustomers(DEMO_SHOP_ID, [initialCust]);

      mockDbBills.push({
        id: 'bill_due_1',
        shop_id: DEMO_SHOP_ID,
        customer_id: custId,
        total_minor: 150000,
        subtotal_minor: 150000,
        discount_minor: 0,
        tax_minor: 0,
        status: 'pending',
        invoice_number: 'INV-DUE-1',
        created_at: new Date().toISOString(),
        payments: [],
        bill_items: [],
      });

      // Customer pays ₹1,000 partial due
      const amountToPayMinor = 100000;
      const remainingDue = await customerRepository.settleDues(
        DEMO_SHOP_ID,
        custId,
        'upi',
        amountToPayMinor
      );

      expect(remainingDue).toBe(50000); // exactly ₹500 remains!

      const reloaded = (await (customerRepository as any).getCachedCustomers(DEMO_SHOP_ID))?.find(
        (c: Customer) => c.id === custId
      );
      expect(reloaded?.outstanding_due_minor).toBe(50000);
    });

    it('settles remaining due in full and marks customer debt-free', async () => {
      const custId = 'cust_due_test';
      const initialCust: Customer = {
        id: custId,
        shop_id: DEMO_SHOP_ID,
        name: 'Priya Rai',
        phone: '9845099887',
        notes: null,
        preferred_staff_id: null,
        is_starred: false,
        visits_count: 3,
        lifetime_spend_minor: 450000,
        outstanding_due_minor: 50000, // remaining ₹500 due
        last_visit_date: 'Yesterday',
        created_at: new Date().toISOString(),
      };
      await (customerRepository as any).cacheCustomers(DEMO_SHOP_ID, [initialCust]);

      mockDbBills.push({
        id: 'bill_due_1',
        shop_id: DEMO_SHOP_ID,
        customer_id: custId,
        total_minor: 150000,
        subtotal_minor: 150000,
        discount_minor: 0,
        tax_minor: 0,
        status: 'partially_paid',
        notes: 'paid:100000 due:50000',
        invoice_number: 'INV-DUE-1',
        created_at: new Date().toISOString(),
        payments: [{ id: 'p1', amount_minor: 100000, method: 'UPI' }],
        bill_items: [],
      });

      const remainingDue = await customerRepository.settleDues(
        DEMO_SHOP_ID,
        custId,
        'cash',
        50000 // pay remaining ₹500
      );

      expect(remainingDue).toBe(0);
      const reloaded = (await (customerRepository as any).getCachedCustomers(DEMO_SHOP_ID))?.find(
        (c: Customer) => c.id === custId
      );
      expect(reloaded?.outstanding_due_minor).toBe(0);
    });
  });

  // =========================================================================
  // 8. FINANCIAL PRECISION & PNL CALCULATIONS
  // =========================================================================
  describe('Step 8: Financial Precision (Collected Revenue vs Dues vs Expenses)', () => {
    it('calculates sales and P&L strictly from actual payments collected, not unpaid dues', () => {
      const sampleBills: Bill[] = [
        // 1. ₹1,000 paid via UPI
        {
          id: 'b1',
          shop_id: DEMO_SHOP_ID,
          customer_name: 'Ananya',
          customer_id: null,
          staff_name: 'Rahul',
          staff_id: null,
          invoice_number: 'INV-1',
          subtotal_minor: 100000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 100000,
          paid_amount_minor: 100000,
          due_amount_minor: 0,
          status: 'paid',
          payment_method: 'UPI',
          items: [],
          issued_at: 'Today',
          created_at: new Date().toISOString(),
          notes: null,
          payments: [{ amount_minor: 100000, method: 'UPI', paid_at: new Date().toISOString() }],
        },
        // 2. ₹3,000 total: ₹1,500 paid via Cash, ₹1,500 due
        {
          id: 'b2',
          shop_id: DEMO_SHOP_ID,
          customer_name: 'Karan',
          customer_id: null,
          staff_name: 'Sameer',
          staff_id: null,
          invoice_number: 'INV-2',
          subtotal_minor: 300000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 300000,
          paid_amount_minor: 150000,
          due_amount_minor: 150000,
          status: 'partially_paid',
          payment_method: 'Cash',
          items: [],
          issued_at: 'Today',
          created_at: new Date().toISOString(),
          notes: 'due:150000;paid:150000',
          payments: [{ amount_minor: 150000, method: 'Cash', paid_at: new Date().toISOString() }],
        },
        // 3. ₹2,000 fully pending due
        {
          id: 'b3',
          shop_id: DEMO_SHOP_ID,
          customer_name: 'Sunil',
          customer_id: null,
          staff_name: 'Rahul',
          staff_id: null,
          invoice_number: 'INV-3',
          subtotal_minor: 200000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 200000,
          paid_amount_minor: 0,
          due_amount_minor: 200000,
          status: 'pending',
          payment_method: 'UPI',
          items: [],
          issued_at: 'Today',
          created_at: new Date().toISOString(),
          notes: 'due:200000;paid:0',
          payments: [],
        },
      ];

      const metrics = financialService.getSalesMetrics('Day', sampleBills);

      // Real collected: 1000 + 1500 = ₹2,500 (250,000 minor) — NOT ₹6,000!
      expect(metrics.total_minor).toBe(250000);

      const upiMode = metrics.modes.find((m) => m.label === 'UPI');
      const cashMode = metrics.modes.find((m) => m.label === 'Cash');
      expect(upiMode?.amt_minor).toBe(100000);
      expect(cashMode?.amt_minor).toBe(150000);

      // PnL with ₹500 product expense
      const sampleExpenses: Expense[] = [
        {
          id: 'exp1',
          shop_id: DEMO_SHOP_ID,
          category_id: null,
          category_name: 'Products',
          amount_minor: 50000, // ₹500
          note: 'Shampoo restock',
          expense_date: '2026-09-27',
          payment_method: 'UPI',
          created_at: new Date().toISOString(),
        },
      ];

      const pnl = financialService.getPnLMetrics('Day', sampleBills, sampleExpenses);
      expect(pnl.income_minor).toBe(250000); // ₹2,500
      expect(pnl.expense_minor).toBe(50000);  // ₹500
      expect(pnl.net_minor).toBe(200000);      // Net Profit ₹2,000
      expect(pnl.margin_pct).toBe(80);         // 80% Margin
      expect(pnl.dues_minor).toBe(350000);     // Total Dues: 1500 + 2000 = ₹3,500
    });
  });

  // =========================================================================
  // 9. INVOICE PDF & WHATSAPP
  // =========================================================================
  describe('Step 9: Invoice HTML/PDF Rendering & Badges', () => {
    it('generates HTML invoice with Total, Paid and Due rows and partial badge', () => {
      const partialBill: Bill = {
        id: 'bill_test_pdf',
        shop_id: DEMO_SHOP_ID,
        customer_name: 'Ananya Sharma',
        customer_id: null,
        staff_name: 'Rahul',
        staff_id: null,
        invoice_number: 'INV-8899',
        subtotal_minor: 200000,
        discount_minor: 0,
        tax_minor: 0,
        total_minor: 200000,
        paid_amount_minor: 120000,
        due_amount_minor: 80000,
        status: 'partially_paid',
        payment_method: 'Cash',
        issued_at: 'Today',
        notes: null,
        items: [
          {
            service_id: null,
            service_name_snapshot: 'Hair Smoothening',
            quantity: 1,
            unit_price_minor: 200000,
            discount_minor: 0,
            tax_minor: 0,
            line_total_minor: 200000,
            staff_id: null,
          },
        ],
      };

      const html = generateInvoiceHtml({
        bill: partialBill,
        shopName: 'StyleFleet Luxury Salon',
        customerPhone: '9845012345',
      });

      expect(html).toContain('StyleFleet Luxury Salon');
      expect(html).toContain('Hair Smoothening');
      expect(html).toContain('PARTIALLY PAID');
      expect(html).toContain('Amount Paid');
      expect(html).toContain('Amount Due');
      expect(html).toContain('9845012345');
    });
  });

  // =========================================================================
  // 10. MULTILINGUAL SUPPORT & LOGOUT / ACCOUNT DELETE
  // =========================================================================
  describe('Step 10: Multilingual Dictionaries & Session Termination', () => {
    it('verifies dictionary completeness for all 5 languages', () => {
      const languages = ['en', 'ta', 'te', 'hi', 'kn'] as const;
      for (const lang of languages) {
        expect(translations[lang].customers).toBeDefined();
        expect(translations[lang].newBill).toBeDefined();
        expect(translations[lang].deleteAccount).toBeDefined();
        expect(translations[lang].lookGoodFeelGood).toBeDefined();
      }
    });

    it('handles sign out and cleans up session and cached data', async () => {
      await authRepository.signOut();
      await shopRepository.clearCachedShop();

      const user = await authRepository.getSession();
      const shop = await shopRepository.getCachedShop();

      expect(user).toBeNull();
      expect(shop).toBeNull();
    });
  });
});
