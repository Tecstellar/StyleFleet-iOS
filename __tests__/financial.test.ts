import { billingService } from '../src/services/billingService';
import { inr, inrFromMinor, shortInr, shortInrFromMinor, getInitials } from '../src/utils/format';

describe('Financial Correctness and Billing Service', () => {
  it('calculates deterministic line totals, 20% weekday colour discount, and 18% GST', () => {
    // Prototype example: Global colour (1800) + Head massage (350)
    // Subtotal: 2150
    // Colour discount: 20% of 1800 = 360
    // Taxable: 2150 - 360 = 1790
    // GST: 18% of 1790 = 322.2 -> 322
    // Total: 1790 + 322 = 2112
    const items = [
      { name: 'Global colour', priceMinor: 180000, isColour: true },
      { name: 'Head massage', priceMinor: 35000, isColour: false },
    ];

    const result = billingService.calculateCart(items, true);

    expect(result.subtotalMinor).toBe(215000);
    expect(result.colourSubtotalMinor).toBe(180000);
    expect(result.discountMinor).toBe(36000);
    expect(result.taxableMinor).toBe(179000);
    expect(result.taxMinor).toBe(32220); // Math.round(179000 * 0.18) = 32220 paise (₹322.20)
    expect(result.totalMinor).toBe(211220);
    expect(result.hasOffer).toBe(true);
  });

  it('formats INR currency accurately according to Indian numbering system', () => {
    expect(inr(14280)).toBe('₹14,280');
    expect(inr(450)).toBe('₹450');
    expect(inrFromMinor(211200)).toBe('₹2,112');
    expect(inrFromMinor(4260000)).toBe('₹42,600');
  });

  it('formats short INR values for dashboard summaries with 1-decimal precision', () => {
    expect(shortInr(1800)).toBe('₹1.8k');
    expect(shortInr(14280)).toBe('₹14.3k');
    expect(shortInr(86400)).toBe('₹86.4k');
    expect(shortInr(1000)).toBe('₹1k');
    expect(shortInr(361400)).toBe('₹3.6L');
    expect(shortInrFromMinor(180000)).toBe('₹1.8k');
    expect(shortInrFromMinor(860000)).toBe('₹8.6k');
    expect(shortInrFromMinor(36140000)).toBe('₹3.6L');
  });

  it('generates uppercase initials correctly', () => {
    expect(getInitials('Vikram Rao')).toBe('VR');
    expect(getInitials('Sameer Khan')).toBe('SK');
    expect(getInitials('Deepak')).toBe('D');
    expect(getInitials('')).toBe('');
  });

  it('computes Day, Week, and Month PnL metrics inclusive of Today from real records', () => {
    const { financialService } = require('../src/services/financialService');
    const now = new Date();
    const todayIso = now.toISOString();

    const sampleBills = [
      { id: 'b1', total_minor: 50000, status: 'completed', created_at: todayIso },
      { id: 'b2', total_minor: 30000, status: 'pending', created_at: todayIso },
    ];
    const sampleExpenses = [
      { id: 'e1', amount_minor: 20000, category_name: 'Products & stock', created_at: todayIso },
    ];

    const pnl = financialService.getPnLMetrics('Day', sampleBills, sampleExpenses);
    expect(pnl.income_minor).toBe(80000);
    expect(pnl.expense_minor).toBe(20000);
    expect(pnl.net_minor).toBe(60000);
    expect(pnl.dues_minor).toBe(30000);
    expect(pnl.margin_pct).toBe(75);
    expect(pnl.categories.length).toBe(1);
    expect(pnl.categories[0].label).toBe('Products & stock');
  });

  it('provides complete translations across all 6 supported languages', () => {
    const { translations, SUPPORTED_LANGUAGES } = require('../src/i18n/translations');
    expect(SUPPORTED_LANGUAGES).toHaveLength(6);

    const requiredKeys = ['customers', 'sales', 'accounts', 'newBill', 'appointments', 'reminders', 'expenses', 'team'];
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      expect(dict).toBeDefined();
      for (const k of requiredKeys) {
        expect(dict[k]).toBeDefined();
        expect(dict[k].length).toBeGreaterThan(0);
      }
    }
  });
});
