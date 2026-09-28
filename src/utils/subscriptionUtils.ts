import { SubscriptionRecord, SubscriptionStateCategory } from '../types/domain';
import { getPlanById } from '../config/planConfig';

export interface TrialCalculationResult {
  state: SubscriptionStateCategory;
  isExpired: boolean;
  isExpiringSoon: boolean;
  totalDays: number;
  completedDays: number;
  remainingDays: number;
  progress: number; // 0.0 to 1.0
  displayTitle: string;
  displaySubtitle: string;
  actionButtonLabel: string;
}

export interface SubscriptionCalculationResult {
  state: SubscriptionStateCategory;
  planName: string;
  planId: string;
  startDateFormatted: string;
  endDateFormatted: string;
  totalDays: number;
  completedDays: number;
  remainingDays: number;
  progress: number; // 0.0 to 1.0
  isExpired: boolean;
}

export const TRIAL_TOTAL_DAYS = 30;
export const TRIAL_EXPIRING_THRESHOLD_DAYS = 5;

/**
 * Normalizes a date to UTC midnight for consistent day-count calculations
 * regardless of the user device's local timezone.
 */
export function normalizeDateToUtcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calculates Free Trial status and progress from the authoritative registration date.
 */
export function calculateTrialStatus(
  registrationDateIso: string,
  currentDate: Date = new Date()
): TrialCalculationResult {
  let regDate = new Date(registrationDateIso);
  if (isNaN(regDate.getTime())) {
    regDate = new Date(); // fallback safe
  }

  const regUtc = normalizeDateToUtcMidnight(regDate);
  const curUtc = normalizeDateToUtcMidnight(currentDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.max(0, Math.floor((curUtc - regUtc) / msPerDay));

  // Day 31 onward = Expired
  if (daysElapsed >= 31) {
    return {
      state: 'TRIAL_EXPIRED',
      isExpired: true,
      isExpiringSoon: false,
      totalDays: TRIAL_TOTAL_DAYS,
      completedDays: TRIAL_TOTAL_DAYS,
      remainingDays: 0,
      progress: 1,
      displayTitle: 'Free Trial Expired',
      displaySubtitle: 'Your 30-day free trial has ended. Subscribe to continue using StyleFleet.',
      actionButtonLabel: 'View Plans',
    };
  }

  // Active or near expiration trial
  const isDayOne = daysElapsed === 0;
  const completedDays = isDayOne ? 0 : Math.min(TRIAL_TOTAL_DAYS, daysElapsed);
  const remainingDays = isDayOne ? TRIAL_TOTAL_DAYS : Math.max(0, TRIAL_TOTAL_DAYS - daysElapsed);
  const progress = Math.min(1, Math.max(0.03, completedDays / TRIAL_TOTAL_DAYS));

  const isExpiringSoon = remainingDays <= TRIAL_EXPIRING_THRESHOLD_DAYS && remainingDays > 0;

  const state: SubscriptionStateCategory = isExpiringSoon
    ? 'TRIAL_EXPIRING_SOON'
    : 'TRIAL_ACTIVE';

  const subtitle = isDayOne
    ? `Day 1 of ${TRIAL_TOTAL_DAYS} · ${remainingDays} days remaining`
    : `${completedDays} / ${TRIAL_TOTAL_DAYS} days completed · ${remainingDays} days remaining`;

  return {
    state,
    isExpired: false,
    isExpiringSoon,
    totalDays: TRIAL_TOTAL_DAYS,
    completedDays,
    remainingDays,
    progress,
    displayTitle: isExpiringSoon ? 'Free Trial Ending Soon' : '30-Day Free Trial',
    displaySubtitle: subtitle,
    actionButtonLabel: 'View Plans',
  };
}

/**
 * Calculates paid subscription status from an active SubscriptionRecord.
 */
export function calculateSubscriptionStatus(
  record: SubscriptionRecord,
  currentDate: Date = new Date()
): SubscriptionCalculationResult {
  const plan = getPlanById(record.plan_id);
  const planName = plan ? plan.name : 'Premium Plan';

  const start = record.subscription_start_date ? new Date(record.subscription_start_date) : new Date(record.created_at);
  const end = record.subscription_end_date ? new Date(record.subscription_end_date) : new Date();

  const startUtc = normalizeDateToUtcMidnight(start);
  const endUtc = normalizeDateToUtcMidnight(end);
  const curUtc = normalizeDateToUtcMidnight(currentDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((endUtc - startUtc) / msPerDay));
  const daysElapsed = Math.max(0, Math.floor((curUtc - startUtc) / msPerDay));
  const remainingDays = Math.max(0, Math.ceil((endUtc - curUtc) / msPerDay));
  const completedDays = Math.min(totalDays, daysElapsed);

  const progress = Math.min(1, Math.max(0.02, completedDays / totalDays));
  const isExpired = curUtc > endUtc || record.status === 'expired';

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return {
    state: 'ACTIVE_SUBSCRIPTION',
    planName,
    planId: record.plan_id,
    startDateFormatted: formatDate(start),
    endDateFormatted: formatDate(end),
    totalDays,
    completedDays,
    remainingDays,
    progress,
    isExpired,
  };
}
