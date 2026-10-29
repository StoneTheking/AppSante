package com.stonetheking.appsante;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageStatsPlugin.class);
        registerPlugin(SleepWidgetPlugin.class);
        registerPlugin(CalendarPlugin.class);
        registerPlugin(StepsPlugin.class);
        super.onCreate(savedInstanceState);
        handle(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handle(intent);
    }

    /** Widget « Photo du repas » : l'application ouvre la caméra dès qu'elle reçoit l'événement. */
    private void handle(Intent intent) {
        if (intent != null && PhotoWidgetProvider.ACTION_PHOTO.equals(intent.getAction())) {
            SleepWidgetProvider.addEvent(this, "photo", System.currentTimeMillis(), null);
            intent.setAction(Intent.ACTION_MAIN); // pas de nouvelle photo à la rotation de l'écran
        }
    }
}
