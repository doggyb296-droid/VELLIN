## iPhone Screen Time Integration Status

Last updated: 2026-03-23

### What is already prepared in this repo

- The app already asks the user once whether VELLIN can use screen time data.
- The profile page has a dedicated place to manage device usage access.
- The mobile app already supports native deep links for auth with the `vellin://auth/callback` scheme.
- The React app is ready to consume real per-app usage data once the iOS bridge is finished.

### What still must be done on a Mac with Xcode

1. Open the Capacitor iOS project in Xcode.
2. Add the Apple Screen Time frameworks:
   - `FamilyControls`
   - `DeviceActivity`
   - `ManagedSettings`
3. Request the Apple entitlement/capability path required for Family Controls / Screen Time APIs.
4. Create the native iOS bridge that:
   - requests authorization with `AuthorizationCenter`
   - stores the authorization result
   - reads the allowed report data for the selected distraction apps
   - returns those values back to the React app
5. Add any required report/monitor extension targets if VELLIN needs richer Screen Time reporting.
6. Test on a real iPhone from Xcode.
7. Validate the feature in TestFlight before App Store review.

### Why this cannot be fully finished on this Windows machine

- Apple's Screen Time frameworks are iOS-only and require Xcode.
- Apple entitlement/capability setup happens in the Apple Developer / Xcode toolchain.
- The native iPhone build cannot be compiled or signed from this Windows environment alone.

### What the user can expect right now

- Android can move ahead with Usage Access.
- iPhone still needs one Mac/Xcode pass before true Screen Time data is live inside the native app.
