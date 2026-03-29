# Google Play Data Safety Draft

Last reviewed: March 24, 2026

This draft is based on the current VELLIN app as it exists in this repository today.
Review it again before submission if billing, analytics, crash reporting, ads, or new SDKs are added.

## High-level answers

- Data shared with third parties:
  - No
- Data collected:
  - Yes
- Data processed ephemerally:
  - No
- Is all user data encrypted in transit:
  - Yes
- Can users request deletion of their data:
  - Yes

## Data that should currently be marked as collected

### Personal info

1. Email address
- Collected: Yes
- Shared: No
- Required or optional:
  - Optional for guest mode
  - Required for account features
- Purpose:
  - App functionality
  - Account management
  - Developer communications / support

2. Name
- Collected: Yes
- Shared: No
- Required or optional:
  - Optional
- Purpose:
  - App functionality
  - Personalization

3. User IDs
- Collected: Yes
- Shared: No
- Required or optional:
  - Required for signed-in account features
- Purpose:
  - App functionality
  - Account management

## App activity

4. In-app interactions / app activity
- Collected: Yes
- Shared: No
- Examples in VELLIN:
  - focus sessions
  - completed tasks
  - progress state
  - streaks
  - saved roadmap/session data
- Purpose:
  - App functionality
  - Personalization

## App info and performance

5. Crash logs
- Collected: No

6. Diagnostics
- Collected: No

## Device or other IDs

7. Device or other IDs
- Collected: No, unless a future SDK adds them

## Financial info

8. Payment card / financial data
- Collected: No in the current build

## Messages

9. Emails, SMS, or in-app messages
- Collected: No

## Photos, videos, files, audio

10. Photos and videos
- Collected: No

11. Audio files
- Collected: No

12. Files and docs
- Collected: No

## Location

13. Approximate location
- Collected: No

14. Precise location
- Collected: No

## Health and fitness

15. Health info
- Collected: No

## Contacts / calendar / web browsing

16. Contacts
- Collected: No

17. Calendar
- Collected: No

18. Web browsing history
- Collected: No

## Android Usage Access note

VELLIN currently supports optional Android Usage Access so the app can read app-usage totals needed for user-facing focus insights and Reality Check style summaries.

Recommended treatment:
- Mark as collected only if Google Play Data Safety requires it under app activity or another matching category at the time of submission.
- Do not mark it as shared.
- Purpose:
  - App functionality
  - Personalization

## Important review notes before submission

1. If RevenueCat, Google Play Billing, analytics, crash reporting, ad SDKs, or attribution SDKs are added, this draft must be updated.
2. If app-side logging or performance tooling is added later, crash/diagnostics answers may need to change.
3. If you add file uploads, profile photo uploads, phone auth, or social login providers later, update this draft before submitting a new release.
