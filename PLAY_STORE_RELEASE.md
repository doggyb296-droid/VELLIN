## Android Play Store Release

Last updated: 2026-03-23

### What is already done

- Android debug APK builds successfully.
- Android Usage Access native bridge is implemented.
- Release build is wired to use a dedicated upload key once you add one.
- Minification and resource shrinking are enabled for release builds.

### Files involved

- `C:\Users\doggy\Documents\VELLIN - Codex\android\app\build.gradle`
- `C:\Users\doggy\Documents\VELLIN - Codex\android\keystore.properties.example`

### One-time signing setup

1. Create an upload keystore.
2. Copy `android/keystore.properties.example` to `android/keystore.properties`.
3. Replace the placeholder values with your real upload key info.
4. Keep the `.jks` file private and backed up.

Example `keystore.properties`:

```properties
storeFile=upload-keystore.jks
storePassword=your-store-password
keyAlias=upload
keyPassword=your-key-password
```

### Release commands

Debug APK:

```bash
npm run android:assembleDebug
```

Release APK:

```bash
npm run android:assembleRelease
```

Release App Bundle for Play Store:

```bash
npm run android:bundleRelease
```

### Expected output paths

Debug APK:
- `C:\Users\doggy\Documents\VELLIN - Codex\android\app\build\outputs\apk\debug\app-debug.apk`

Release APK:
- `C:\Users\doggy\Documents\VELLIN - Codex\android\app\build\outputs\apk\release\app-release.apk`

Release AAB:
- `C:\Users\doggy\Documents\VELLIN - Codex\android\app\build\outputs\bundle\release\app-release.aab`

### Play Store console checklist

1. App name
2. Short description
3. Full description
4. Screenshots
5. App icon
6. Feature graphic
7. Privacy policy URL
8. Support email
9. Data safety form
10. Content rating
11. Target audience
12. Sensitive permissions explanation

### Policy-sensitive areas for VELLIN

- `PACKAGE_USAGE_STATS` is sensitive. The Play listing and in-app wording should clearly explain that it is used only to show the user their own app-usage patterns for focus and craving insights.
- Do not claim device-wide app blocking that Android does not actually enforce.
- Keep Pro language honest until billing is live.
