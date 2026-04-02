package app.vellin.mobile;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.content.Intent;
import android.os.SystemClock;

import java.util.Set;

public class FocusAccessibilityService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = event.getPackageName().toString();
        if (packageName.isEmpty() || packageName.equals(getPackageName())) {
            return;
        }

        if (!FocusBlockerStore.isFocusActive(this)) {
            return;
        }

        Set<String> blockedPackages = FocusBlockerStore.getBlockedPackages(this);
        if (!blockedPackages.contains(packageName)) {
            return;
        }

        long nowElapsed = SystemClock.elapsedRealtime();
        String lastInterceptedPackage = FocusBlockerStore.getPreferences(this).getString(FocusBlockerStore.KEY_LAST_INTERCEPTED_PACKAGE, null);
        long lastInterceptedElapsed = FocusBlockerStore.getPreferences(this).getLong(FocusBlockerStore.KEY_LAST_INTERCEPTED_ELAPSED, 0L);
        if (packageName.equals(lastInterceptedPackage) && nowElapsed - lastInterceptedElapsed < 1200L) {
            return;
        }

        FocusBlockerStore.getPreferences(this)
          .edit()
          .putString(FocusBlockerStore.KEY_LAST_INTERCEPTED_PACKAGE, packageName)
          .putLong(FocusBlockerStore.KEY_LAST_INTERCEPTED_ELAPSED, nowElapsed)
          .apply();
        FocusBlockerStore.recordBlockedPackage(this, packageName, System.currentTimeMillis());

        Intent blockedIntent = new Intent(this, BlockedAppActivity.class);
        blockedIntent.putExtra(BlockedAppActivity.EXTRA_PACKAGE_NAME, packageName);
        blockedIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        startActivity(blockedIntent);
    }

    @Override
    public void onInterrupt() {
        // No-op.
    }
}
