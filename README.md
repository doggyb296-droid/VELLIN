# VELLIN

VELLIN is now set up on:
- `Next.js`
- `Tailwind CSS`
- `Supabase`
- `Netlify`

## Local Run

1. Install packages:
```bash
npm install
```

2. Add env vars to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Start the app:
```bash
npm run dev
```

4. Open:
- [http://localhost:3000](http://localhost:3000)

## Supabase Setup

In Supabase:

1. Go to `Authentication > Providers`
2. Make sure `Email` is enabled
3. Decide whether `Confirm email` should be on or off
- `Off` is easiest for testing
- `On` is better for production

Then go to `SQL Editor` and run:
- `C:\Users\doggy\Documents\VELLIN - Codex\supabase\setup.sql`

That script creates:
- `public.profiles`
- `public.user_app_state`
- update triggers
- row level security policies

## What Supabase Stores

`profiles` stores structured account data:
- display name
- Pro status
- daily goal
- notifications
- sound
- break reminders
- theme
- distraction apps

`user_app_state` stores richer app progress as JSON:
- focus stats
- achievements
- tasks
- review data
- plan state

## Netlify Deploy

1. Push this repo to GitHub
2. In Netlify, create a new site from that repo
3. Add environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Build command:
- `npm run build`
5. Publish command:
- leave blank for Next.js on Netlify

There is already a basic Netlify config in:
- `C:\Users\doggy\Documents\VELLIN - Codex\netlify.toml`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run android:assembleDebug`
- `npm run android:assembleRelease`
- `npm run android:bundleRelease`

## Android Release Prep

Helpful files:

- `C:\Users\doggy\Documents\VELLIN - Codex\PLAY_STORE_RELEASE.md`
- `C:\Users\doggy\Documents\VELLIN - Codex\PLAY_STORE_METADATA_TEMPLATE.md`
- `C:\Users\doggy\Documents\VELLIN - Codex\ANDROID_UPLOAD_KEY.md`
- `C:\Users\doggy\Documents\VELLIN - Codex\android\keystore.properties.example`

## Security Audit Prep

The security-review scope is tracked here:

- `C:\Users\doggy\Documents\VELLIN - Codex\SECURITY_AUDIT_PLAN.md`

## Official Docs

- [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation)
- [Tailwind with PostCSS](https://tailwindcss.com/docs/installation/using-postcss)
- [Supabase Next.js Auth](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Netlify Next.js](https://docs.netlify.com/frameworks/next-js/overview/)
