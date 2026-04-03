package app.vellin.mobile;

import android.accessibilityservice.AccessibilityService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public final class FocusBlockerStore {
    public static final String PREFS_NAME = "vellin_focus_blocker";
    public static final String KEY_ACTIVE = "active";
    public static final String KEY_BLOCKED_PACKAGES = "blocked_packages";
    public static final String KEY_LAST_BLOCKED_PACKAGE = "last_blocked_package";
    public static final String KEY_LAST_BLOCKED_AT = "last_blocked_at";
    public static final String KEY_LAST_INTERCEPTED_PACKAGE = "last_intercepted_package";
    public static final String KEY_LAST_INTERCEPTED_ELAPSED = "last_intercepted_elapsed";
    public static final String KEY_PENDING_ACTION = "pending_action";
    public static final String ACTION_END_FOCUS = "end_focus";

    private FocusBlockerStore() {}

    public static SharedPreferences getPreferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static boolean isBlockerEnabled(Context context) {
        ComponentName serviceName = new ComponentName(context, FocusAccessibilityService.class);
        String enabledServices = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabledServices == null || enabledServices.isEmpty()) {
            return false;
        }

        String expected = serviceName.flattenToString();
        for (String enabled : enabledServices.split(":")) {
            if (expected.equalsIgnoreCase(enabled)) {
                return true;
            }
        }
        return false;
    }

    public static boolean isFocusActive(Context context) {
        return getPreferences(context).getBoolean(KEY_ACTIVE, false);
    }

    public static Set<String> getBlockedPackages(Context context) {
        Set<String> packages = getPreferences(context).getStringSet(KEY_BLOCKED_PACKAGES, Collections.emptySet());
        return new HashSet<>(packages);
    }

    public static void saveConfig(Context context, boolean active, Set<String> blockedPackages) {
        SharedPreferences.Editor editor = getPreferences(context).edit();
        editor.putBoolean(KEY_ACTIVE, active);
        editor.putStringSet(KEY_BLOCKED_PACKAGES, new HashSet<>(blockedPackages));
        editor.apply();
    }

    public static void recordBlockedPackage(Context context, String packageName, long blockedAt) {
        SharedPreferences.Editor editor = getPreferences(context).edit();
        editor.putString(KEY_LAST_BLOCKED_PACKAGE, packageName);
        editor.putLong(KEY_LAST_BLOCKED_AT, blockedAt);
        editor.apply();
    }

    public static void clearLastBlockedPackage(Context context) {
        SharedPreferences.Editor editor = getPreferences(context).edit();
        editor.remove(KEY_LAST_BLOCKED_PACKAGE);
        editor.remove(KEY_LAST_BLOCKED_AT);
        editor.apply();
    }

    public static void requestEndFocus(Context context) {
        SharedPreferences.Editor editor = getPreferences(context).edit();
        editor.putBoolean(KEY_ACTIVE, false);
        editor.putString(KEY_PENDING_ACTION, ACTION_END_FOCUS);
        editor.apply();
    }

    public static String consumePendingAction(Context context) {
        SharedPreferences preferences = getPreferences(context);
        String action = preferences.getString(KEY_PENDING_ACTION, null);
        if (action == null) {
            return null;
        }

        preferences.edit().remove(KEY_PENDING_ACTION).apply();
        return action;
    }
}
