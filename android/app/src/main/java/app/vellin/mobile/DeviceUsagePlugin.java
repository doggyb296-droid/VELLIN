package app.vellin.mobile;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "DeviceUsage")
public class DeviceUsagePlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("status", hasUsageAccess() ? "granted" : "unknown");
        call.resolve(result);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (hasUsageAccess()) {
            JSObject result = new JSObject();
            result.put("status", "granted");
            call.resolve(result);
            return;
        }

        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        JSObject result = new JSObject();
        result.put("status", "requested");
        call.resolve(result);
    }

    @PluginMethod
    public void getWeeklyUsage(PluginCall call) {
        JSArray packages = call.getArray("packages", new JSArray());
        JSArray usage = new JSArray();
        JSObject result = new JSObject();

        if (!hasUsageAccess()) {
          result.put("status", "unknown");
          result.put("usage", usage);
          call.resolve(result);
          return;
        }

        UsageStatsManager usageStatsManager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        long endTime = System.currentTimeMillis();
        long startTime = endTime - (7L * 24L * 60L * 60L * 1000L);

        List<UsageStats> stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
        Map<String, Long> totals = new HashMap<>();

        for (int i = 0; i < packages.length(); i++) {
            String pkg = packages.optString(i, "");
            if (!pkg.isEmpty()) {
                totals.put(pkg, 0L);
            }
        }

        for (UsageStats stat : stats) {
            String packageName = stat.getPackageName();
            if (!totals.containsKey(packageName)) continue;
            long current = totals.containsKey(packageName) ? totals.get(packageName) : 0L;
            long foregroundMs = getForegroundTime(stat);
            totals.put(packageName, current + foregroundMs);
        }

        for (Map.Entry<String, Long> entry : totals.entrySet()) {
            JSObject item = new JSObject();
            item.put("packageName", entry.getKey());
            item.put("totalMs", entry.getValue());
            usage.put(item);
        }

        result.put("status", "granted");
        result.put("usage", usage);
        call.resolve(result);
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);

        List<ResolveInfo> activities = packageManager.queryIntentActivities(launcherIntent, PackageManager.MATCH_ALL);
        List<JSObject> entries = new ArrayList<>();
        Set<String> seenPackages = new HashSet<>();
        String selfPackage = getContext().getPackageName();

        for (ResolveInfo resolveInfo : activities) {
            if (resolveInfo.activityInfo == null) continue;

            String packageName = resolveInfo.activityInfo.packageName;
            if (packageName == null || packageName.isEmpty() || packageName.equals(selfPackage) || seenPackages.contains(packageName)) {
                continue;
            }

            CharSequence labelSequence = resolveInfo.loadLabel(packageManager);
            String label = labelSequence == null ? packageName : labelSequence.toString().trim();
            if (label.isEmpty()) {
                label = packageName;
            }

            JSObject item = new JSObject();
            item.put("label", label);
            item.put("packageName", packageName);
            entries.add(item);
            seenPackages.add(packageName);
        }

        Collections.sort(entries, new Comparator<JSObject>() {
            @Override
            public int compare(JSObject left, JSObject right) {
                String leftLabel = left.getString("label", "");
                String rightLabel = right.getString("label", "");
                return leftLabel.compareToIgnoreCase(rightLabel);
            }
        });

        JSArray apps = new JSArray();
        for (JSObject entry : entries) {
            apps.put(entry);
        }

        JSObject result = new JSObject();
        result.put("apps", apps);
        call.resolve(result);
    }

    private boolean hasUsageAccess() {
        try {
            Context context = getContext();
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.getPackageName());
            } else {
                mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.getPackageName());
            }
            if (mode == AppOpsManager.MODE_ALLOWED) {
                return true;
            }

            UsageStatsManager usageStatsManager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usageStatsManager == null) return false;
            long endTime = System.currentTimeMillis();
            long startTime = endTime - (60L * 1000L);
            List<UsageStats> stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
            return stats != null && !stats.isEmpty();
        } catch (Exception ignored) {
            return false;
        }
    }

    private long getForegroundTime(UsageStats stat) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return stat.getTotalTimeVisible();
        }
        return stat.getTotalTimeInForeground();
    }
}
