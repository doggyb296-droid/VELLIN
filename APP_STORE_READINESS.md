# VELLIN App Store Readiness

## What is now safer for review

- Guest mode is available during onboarding.
- The fake instant Pro purchase flow has been removed from the user-facing path.
- Privacy, Terms, and Support pages now exist:
  - `/privacy`
  - `/terms`
  - `/support`
- Delete account supports either:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_SECRET_KEY`

## What still requires store-side work

### Apple App Store

- Apple Developer account
- App Store Connect app record
- Privacy nutrition labels
- Privacy policy URL
- Support URL
- Screenshots and app icon set
- A native iOS wrapper or native app target

### Google Play

- Google Play Console app record
- Data safety form
- Privacy policy URL
- Screenshots and app icon set
- A native Android wrapper or native app target

## Important technical note

This project is currently a Next.js app with server routes. That is excellent for the web, but a store submission still needs a real mobile container strategy.

If we want the current codebase in the stores, the next big technical choice is:

1. Wrap the app in Capacitor and adapt any server-only features.
2. Keep the web app for web and build mobile shells with a mobile-specific architecture.

The current repo is closer to "web product ready" than "store binary ready."

## Mobile wrapper work added in this repo

The repo now includes:

- `C:\Users\doggy\Documents\VELLIN - Codex\capacitor.config.ts`
- `C:\Users\doggy\Documents\VELLIN - Codex\mobile-web\index.html`
- `C:\Users\doggy\Documents\VELLIN - Codex\android`
- `C:\Users\doggy\Documents\VELLIN - Codex\ios`
- npm scripts for:
  - `npm run mobile:sync`
  - `npm run mobile:add:android`
  - `npm run mobile:add:ios`
  - `npm run mobile:open:android`
  - `npm run mobile:open:ios`

To point the mobile shell at your live site, add this to `.env.local`:

```env
CAPACITOR_SERVER_URL=https://your-live-vellin-site.com
```

That prepares the project for the hosted-web + Capacitor route. It still needs the native platform projects to be created on the correct machine:

- Android can be opened where Android Studio is installed.
- iOS must still be built and signed on a Mac with Xcode.

## Supabase server key for delete account

Add one of these to `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=your_server_side_key
```

or

```env
SUPABASE_SECRET_KEY=your_server_side_key
```

Restart the app after saving:

```bash
npm run dev
```
