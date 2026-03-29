# VELLIN Billing Readiness

## App-side groundwork now in place
- Canonical monthly Pro plan identifiers
- Shared billing/subscription types
- Subscription entitlement helper
- Supabase `subscriptions` table schema
- Membership UI ready for:
  - trialing
  - active
  - cancel at period end
  - expired / canceled
- Billing country locked to detected/store region rather than a user-editable cheaper region

## Still needed before live billing is truly on
1. App Store Connect product creation
2. Google Play Console subscription creation
3. Mac/Xcode setup for iPhone StoreKit testing
4. Android Play Billing client integration
5. iPhone StoreKit integration
6. Server webhook / notification handlers
7. Subscription status sync into `public.subscriptions`
8. Restore purchases flow
9. Manage subscription / cancel flow wired to Apple / Google

## Recommended rollout
1. Finish UI localization sweep
2. Add provider-specific billing bridge
3. Add webhook/server notifications
4. Test trial start / cancel / renewal / expiry
5. Enable live pricing in stores
