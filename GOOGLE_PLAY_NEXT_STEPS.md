# Google Play Next Steps

## What Codex Has Already Done
- The app builds locally.
- The mobile bundle syncs into Android.
- The home screen and shared surfaces have been visually tightened to feel more like one product.
- Privacy, terms, and support pages exist.
- Play Store metadata and Data safety drafts already exist:
  - `C:\Users\doggy\Documents\VELLIN - Codex\PLAY_STORE_METADATA_TEMPLATE.md`
  - `C:\Users\doggy\Documents\VELLIN - Codex\GOOGLE_PLAY_DATA_SAFETY_DRAFT.md`

## What You Need To Do In Play Console
1. Create the VELLIN app entry in Play Console.
2. Fill in the store listing using:
   - `C:\Users\doggy\Documents\VELLIN - Codex\PLAY_STORE_METADATA_TEMPLATE.md`
3. Upload your screenshots.
4. Add the privacy policy URL and support details.
5. Complete:
   - App content
   - Data safety
   - Content rating
6. If this is a new personal developer account, complete Google Play's closed testing requirement before production.
7. After the store app exists, create the subscription product for billing later:
   - Product ID: `vellin_pro_monthly`
   - Billing period: monthly
   - Intro offer: `3-day free trial`

## What We Will Do After That
1. Generate the signed Android release bundle (`.aab`).
2. Wire the real Android billing flow.
3. Test the production-like Android flow before release.
