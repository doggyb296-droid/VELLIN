package app.vellin.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceUsagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
