## Store Submission Checklist

### Google Play

Repo-side status:
- Android debug build works
- release signing flow is wired
- release bundle command is ready once the upload key exists
- privacy/support pages exist

Manual/store-account tasks:
- create the Play Console app entry
- create upload key
- create signed release AAB
- upload to Play Console
- complete Data safety form
- complete Content rating
- add screenshots and graphics
- add privacy policy/support URLs
- copy in the text from `C:\Users\doggy\Documents\VELLIN - Codex\PLAY_STORE_METADATA_TEMPLATE.md`
- use `C:\Users\doggy\Documents\VELLIN - Codex\GOOGLE_PLAY_DATA_SAFETY_DRAFT.md` to answer the Data safety questions
- follow `C:\Users\doggy\Documents\VELLIN - Codex\GOOGLE_PLAY_NEXT_STEPS.md` for the concrete order
- if your Play account is a new personal account, complete the required closed testing period before production access
- use `C:\Users\doggy\Documents\VELLIN - Codex\GOOGLE_PLAY_CLOSED_TEST_CHECKLIST.md` for the testing requirement
- use `C:\Users\doggy\Documents\VELLIN - Codex\TESTER_INVITE_TEMPLATE.md` and `C:\Users\doggy\Documents\VELLIN - Codex\TESTER_INSTRUCTIONS.md` when you recruit testers

### Apple App Store

Repo-side status:
- iOS Capacitor shell exists
- auth deep-link flow is prepared
- legal/support pages exist

Still blocked outside this Windows machine:
- Mac + Xcode build pass
- Apple signing
- Family Controls / Screen Time entitlement path
- TestFlight build and on-device validation

### Billing

Not done yet by design.
