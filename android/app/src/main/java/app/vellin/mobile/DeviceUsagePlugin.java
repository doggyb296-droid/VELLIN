package app.vellin.mobile;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
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
