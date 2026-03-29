## Android Usage Access Status

Last updated: 2026-03-23

### What is already implemented

- Capacitor Android app includes the `PACKAGE_USAGE_STATS` permission declaration.
- Native Android bridge:
  - opens Usage Access settings
  - checks whether access is granted
  - reads weekly usage totals for selected distraction apps
- The React app uses that data in Reality Check when Android access has been granted.

### What still needs to happen on a device

1. Install Android Studio and a Java runtime on the build machine.
2. Open the Android project.
3. Build and install the app on a real Android device.
4. In the app, allow screen time data.
5. Grant `Usage Access` in Android system settings.
6. Reopen VELLIN and confirm the Reality Check shows real last-week usage for the selected apps.

### Current environment blocker

- This Windows workspace does not currently have Java configured, so Gradle cannot produce a debug build yet.
- The exact local blocker was:
  - `JAVA_HOME is not set and no 'java' command could be found in your PATH.`
