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

    // Fenêtre d'autorisation Health Connect fermée : Android 14+ (autorisations système) ou appli Health Connect.
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == UsageStatsPlugin.HEALTH_REQUEST) UsageStatsPlugin.onHealthResult();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == UsageStatsPlugin.HEALTH_REQUEST) UsageStatsPlugin.onHealthResult();
    }

    /** Widget « Photo du repas » : l'application ouvre la caméra dès qu'elle reçoit l'événement. */
    private void handle(Intent intent) {
        if (intent != null && PhotoWidgetProvider.ACTION_PHOTO.equals(intent.getAction())) {
            SleepWidgetProvider.addEvent(this, "photo", System.currentTimeMillis(), null);
            intent.setAction(Intent.ACTION_MAIN); // pas de nouvelle photo à la rotation de l'écran
        }
    }
}
