export const PRO_MONTHLY_PLAN = {
  code: 'pro_monthly',
  trialDays: 3,
  appleProductId: 'vellin.pro.monthly',
  googleProductId: 'vellin_pro_monthly',
} as const;

export const BILLING_PROVIDERS = ['manual_preview', 'apple', 'google'] as const;
export type BillingProvider = typeof BILLING_PROVIDERS[number];

export const BILLING_STATUSES = ['inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired'] as const;
export type BillingStatus = typeof BILLING_STATUSES[number];
