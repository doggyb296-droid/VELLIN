## Security Audit Plan

Last updated: 2026-03-23

This is the follow-up audit pass we should run before store submission and before turning on real billing.

### 1. Authentication

- Supabase auth flows
- session persistence
- logout and guest transitions
- email confirmation callback handling
- account deletion route

### 2. Secrets and environment handling

- confirm `SUPABASE_SECRET_KEY` is server-only
- confirm no secrets leak into client bundles
- confirm `.env.local`, `keystore.properties`, and release keys are ignored properly

### 3. API surface

- `app/api/account/delete/route.ts`
- auth callback route
- any future billing routes
- input validation and auth checks

### 4. Data protection

- profile data persistence
- social/friends data access rules
- delete-account cascade behavior
- least-privilege review for Supabase tables and policies

### 5. Mobile-specific review

- Android Usage Access explanation and handling
- deep-link/auth callback abuse cases
- notification permission handling
- release build configuration

### 6. Dependency review

- Next.js
- Capacitor plugins
- Supabase packages
- Android Gradle dependencies

### 7. Store-policy security/privacy alignment

- privacy policy matches actual data use
- no misleading claims about device access
- platform permissions explained clearly and narrowly

### 8. Hardening follow-ups likely needed

- stricter server-side validation
- rate limiting on future mutation routes
- safer error messaging
- audit logging for destructive actions

### Output we should produce after the audit

1. prioritized findings list
2. concrete fixes
3. residual risks
4. publish/no-publish recommendation
