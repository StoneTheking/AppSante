package com.stonetheking.appsante;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageStatsPlugin.class);
        registerPlugin(SleepWidgetPlugin.class);
        registerPlugin(CalendarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
