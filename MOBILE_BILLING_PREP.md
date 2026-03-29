# VELLIN Mobile Billing Prep

## Apple
- Product type: Auto-renewable subscription
- Product ID: `vellin.pro.monthly`
- Trial: 3 days
- Billing owner: Apple App Store
- Cancellation model:
  - user cancels in Apple subscription settings
  - access remains until the current period ends

## Google Play
- Product type: Subscription
- Product ID: `vellin_pro_monthly`
- Trial: 3 days
- Billing owner: Google Play
- Cancellation model:
  - user cancels in Google Play subscriptions
  - access remains until the current period ends

## Supabase source of truth
- Table: `public.subscriptions`
- Store the latest synced state from Apple/Google here
- App UI should read Pro access from this table, not from a local toggle

## Before live billing
1. Run the updated SQL
2. Create the Apple product
3. Create the Google Play product
4. Add Apple StoreKit client code
5. Add Google Play Billing client code
6. Add purchase restore flow
7. Add server-side subscription sync / notifications
8. Test:
   - trial start
   - cancel during trial
   - renew
   - cancel at period end
   - expire
