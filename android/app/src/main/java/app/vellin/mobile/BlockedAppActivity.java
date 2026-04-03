package app.vellin.mobile;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

public class BlockedAppActivity extends Activity {

    public static final String EXTRA_PACKAGE_NAME = "blockedPackageName";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_blocked_app);

        TextView subtitleView = findViewById(R.id.blocked_app_subtitle);
        TextView titleView = findViewById(R.id.blocked_app_title);
        Button stayFocusedButton = findViewById(R.id.blocked_app_stay_button);
        Button endFocusButton = findViewById(R.id.blocked_app_end_button);

        String packageName = getIntent() != null ? getIntent().getStringExtra(EXTRA_PACKAGE_NAME) : null;
        String appLabel = resolveAppLabel(packageName);
        titleView.setText("Blocked by VELLIN");
        subtitleView.setText(appLabel + " is blocked right now. Stay with your plan or end the session if you really need to go back.");

        stayFocusedButton.setOnClickListener((view) -> {
            Intent homeIntent = new Intent(Intent.ACTION_MAIN);
            homeIntent.addCategory(Intent.CATEGORY_HOME);
            homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(homeIntent);
            finish();
        });

        endFocusButton.setOnClickListener((view) -> {
            FocusBlockerStore.requestEndFocus(this);
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(launchIntent);
            finish();
        });
    }

    private String resolveAppLabel(String packageName) {
        if (packageName == null || packageName.isEmpty()) {
            return "This app";
        }

        try {
            PackageManager packageManager = getPackageManager();
            ApplicationInfo applicationInfo = packageManager.getApplicationInfo(packageName, 0);
            CharSequence label = packageManager.getApplicationLabel(applicationInfo);
            if (label != null) {
                String resolved = label.toString().trim();
                if (!resolved.isEmpty()) {
                    return resolved;
                }
            }
        } catch (Exception ignored) {
            // Fall through to package name.
        }

        return packageName;
    }
}
