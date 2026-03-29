# VELLIN Store Publish Audit

Last checked: 2026-03-23

## Current state

- Web app builds successfully.
- Lint passes.
- Supabase auth, delete account flow, privacy page, terms page, and support page exist.
- Capacitor iOS and Android shells exist.
- Capacitor now uses a real bundled `mobile-web` build instead of the old placeholder shell.
- Android Usage Access bridge is wired in the Android app and the React app can read weekly usage for selected distraction apps after permission is granted.

## High-priority blockers before store submission

1. Real iPhone Screen Time integration is still not implemented end-to-end.
2. iOS Family Controls / DeviceActivity entitlement work is not present yet.
3. Android Usage Access is implemented in code, but still needs on-device QA and a proper debug/release build on a machine with Java/Android Studio.
4. Store-console work is still missing:
   - signing
   - screenshots
   - privacy/data disclosures
   - review notes
   - support/contact details in store dashboards

## Medium-priority work

1. Decide what Pro means in the first store release:
   - free unlock for now
   - hidden until billing is live
2. Final on-device QA for:
   - auth callback
   - notifications
   - onboarding
   - guest mode
   - delete account
    - Android Usage Access
3. Real app icon / launch assets review.
4. Add the Apple-only native Screen Time targets and entitlements from a Mac/Xcode environment.

## Suggested release strategy

### Fastest path
- Ship a first store version without true iPhone Screen Time integration.
- Keep language honest about tracked VELLIN activity.
- Keep Pro non-billable or hidden until native billing is ready.

### Stronger path
- Keep the Android UsageStats bridge and finish on-device QA.
- Add iOS Screen Time APIs with Family Controls / DeviceActivity / ManagedSettings from Xcode.
- Add platform billing.
- Submit after full native capability review.
