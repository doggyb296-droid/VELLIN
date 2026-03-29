import { PRO_MONTHLY_PLAN, type BillingProvider, type BillingStatus } from './plans';

export interface SubscriptionRow {
  user_id: string;
  provider: BillingProvider;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan_code: string;
  status: BillingStatus;
  currency: string;
  amount_minor: number;
  billing_country: string | null;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
}

export type MembershipSnapshot = {
  hasProAccess: boolean;
  status: BillingStatus;
  cancelAtPeriodEnd: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  provider: BillingProvider;
};

const parseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const deriveMembershipSnapshot = (subscription: SubscriptionRow | null): MembershipSnapshot => {
  if (!subscription) {
    return {
      hasProAccess: false,
      status: 'inactive',
      cancelAtPeriodEnd: false,
      trialActive: false,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      provider: 'manual_preview',
    };
  }

  const now = Date.now();
  const trialEndsAt = parseDate(subscription.trial_ends_at);
  const currentPeriodEndsAt = parseDate(subscription.current_period_end);
  const trialActive = subscription.status === 'trialing' && Boolean(trialEndsAt && trialEndsAt.getTime() > now);
  const paidAccessActive = subscription.status === 'active' && Boolean(currentPeriodEndsAt && currentPeriodEndsAt.getTime() > now);

  return {
    hasProAccess: trialActive || paidAccessActive,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialActive,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    currentPeriodEndsAt: currentPeriodEndsAt?.toISOString() ?? null,
    provider: subscription.provider,
  };
};

export const createManualPreviewSubscription = ({
  userId,
  countryCode,
  currency,
  amountMinor,
}: {
  userId: string;
  countryCode: string | null;
  currency: string;
  amountMinor: number;
}): SubscriptionRow => {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + PRO_MONTHLY_PLAN.trialDays * 24 * 60 * 60 * 1000);

  return {
    user_id: userId,
    provider: 'manual_preview',
    provider_customer_id: null,
    provider_subscription_id: null,
    plan_code: PRO_MONTHLY_PLAN.code,
    status: 'trialing',
    currency,
    amount_minor: amountMinor,
    billing_country: countryCode,
    cancel_at_period_end: false,
    current_period_start: now.toISOString(),
    current_period_end: trialEndsAt.toISOString(),
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    canceled_at: null,
  };
};
