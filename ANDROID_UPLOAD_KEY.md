## Android Upload Key

This is the final manual step before generating the Play Store release bundle.

### Recommended approach

Create a dedicated Play Store upload key instead of using the debug key.

### Example command

Run this from a terminal:

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

### Then

1. Move `upload-keystore.jks` into:
   - `C:\Users\doggy\Documents\VELLIN - Codex\android`
2. Copy:
   - `C:\Users\doggy\Documents\VELLIN - Codex\android\keystore.properties.example`
   to:
   - `C:\Users\doggy\Documents\VELLIN - Codex\android\keystore.properties`
3. Fill in the real passwords

### After that

These commands are ready:

```bash
npm run android:assembleRelease
npm run android:bundleRelease
```

### Important

- Keep the keystore and passwords backed up safely.
- Do not commit the keystore or `keystore.properties`.
