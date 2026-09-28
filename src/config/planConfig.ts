/**
 * StyleFleet Centralized Subscription Plan Configuration
 * All pricing, durations, savings, and discounts are calculated mathematically
 * from this single source of truth.
 */

export type PlanId =
  | '1_month'
  | '3_months'
  | '6_months'
  | '12_months'
  | 'sf_plan_1m'
  | 'sf_plan_3m'
  | 'sf_plan_6m'
  | 'sf_plan_12m';

export interface SubscriptionPlanConfig {
  id: PlanId;
  name: string;
  durationMonths: number;
  durationDays: number;
  price: number; // in INR
  priceInRupees: number; // alias for compatibility
  originalPrice: number; // in INR (regular price before duration discount)
  perDayAmount: number;
  perDayDisplay: string;
  isPopular?: boolean;
  isBestValue?: boolean;
  badge?: string;
  discountPercent: number;
  effectiveMonthlyRateMinor: number;
  features: string[];
}

export type SubscriptionPlan = SubscriptionPlanConfig;

export interface PlanPricingCalculation {
  plan: SubscriptionPlanConfig;
  savings: number;
  discountPercentage: number;
  effectiveMonthlyPrice: number;
  formattedPrice: string;
  formattedOriginalPrice: string;
  formattedSavings: string;
}

// Baseline single-month price in INR
export const BASELINE_MONTHLY_PRICE = 499;

export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    id: '3_months',
    name: '3 Months',
    durationMonths: 3,
    durationDays: 90,
    price: 1499,
    priceInRupees: 1499,
    originalPrice: 1499,
    perDayAmount: 17,
    perDayDisplay: '₹17 / day',
    discountPercent: 0,
    effectiveMonthlyRateMinor: 50000,
    features: [
      'Unlimited bills & invoices',
      'Client management & WhatsApp bill sending',
      'Staff sales & commission reports',
      'Advanced sales analytics & reports',
    ],
  },
  {
    id: '6_months',
    name: '6 Months',
    durationMonths: 6,
    durationDays: 180,
    price: 2799,
    priceInRupees: 2799,
    originalPrice: 2994, // 499 * 6
    perDayAmount: 15.5,
    perDayDisplay: '₹15.5 / day',
    isPopular: true,
    badge: 'MOST POPULAR (7% OFF)',
    discountPercent: 7,
    effectiveMonthlyRateMinor: 46650,
    features: [
      'Everything in 3 Months plan',
      'Custom salon branding on bills',
      'Automated client recall nudges',
      'VIP customer segmentation',
    ],
  },
  {
    id: '12_months',
    name: '1 Year',
    durationMonths: 12,
    durationDays: 365,
    price: 4999,
    priceInRupees: 4999,
    originalPrice: 5988, // 499 * 12
    perDayAmount: 13.7,
    perDayDisplay: '₹13.7 / day',
    isBestValue: true,
    badge: 'BEST VALUE (17% OFF)',
    discountPercent: 17,
    effectiveMonthlyRateMinor: 41658,
    features: [
      'Everything in 6 Months plan',
      'Maximum savings (₹989 OFF)',
      'Dedicated account manager',
      'Free data backup & export',
    ],
  },
];

/**
 * Formats a number to Indian Rupee representation (e.g. ₹1,299)
 */
export function formatPriceInRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculates raw savings in Rupees for a given plan
 */
export function calculateSavingsRupees(plan: SubscriptionPlanConfig): number {
  return Math.max(0, plan.originalPrice - plan.price);
}

/**
 * Calculates discount percentage for a given plan
 */
export function calculateSavingsPercent(plan: SubscriptionPlanConfig): number {
  if (plan.originalPrice <= plan.price) return 0;
  return Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100);
}

/**
 * Calculates mathematical discounts, savings, and effective monthly prices for a plan
 */
export function calculatePlanPricing(plan: SubscriptionPlanConfig): PlanPricingCalculation {
  const savings = calculateSavingsRupees(plan);
  const discountPercentage = calculateSavingsPercent(plan);
  const effectiveMonthlyPrice = Math.round(plan.price / plan.durationMonths);

  return {
    plan,
    savings,
    discountPercentage,
    effectiveMonthlyPrice,
    formattedPrice: formatPriceInRupees(plan.price),
    formattedOriginalPrice: formatPriceInRupees(plan.originalPrice),
    formattedSavings: formatPriceInRupees(savings),
  };
}

/**
 * Find plan by its unique plan ID (supporting both legacy sf_plan_X and direct IDs)
 */
export function getPlanById(planId: string): SubscriptionPlanConfig | undefined {
  const normalizedId = planId
    .replace('sf_plan_', '')
    .replace('1m', '1_month')
    .replace('3m', '3_months')
    .replace('6m', '6_months')
    .replace('12m', '12_months');
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId || p.id === normalizedId);
}
