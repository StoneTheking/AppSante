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

    /** Widgets « Photo ou code-barres » et « Quêtes du jour » : l'application agit dès qu'elle reçoit l'événement. */
    private void handle(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String a = intent.getAction();
        long now = System.currentTimeMillis();
        if (PhotoWidgetProvider.ACTION_PHOTO.equals(a)) SleepWidgetProvider.addEvent(this, "photo", now, null);
        else if (PhotoWidgetProvider.ACTION_SCAN.equals(a)) SleepWidgetProvider.addEvent(this, "scan", now, null);
        else if (QuestsWidgetProvider.ACTION_QUEST.equals(a)) {
            String q = intent.getStringExtra("quest");
            SleepWidgetProvider.addEvent(this, "quest", now, q != null ? q : "home");
        } else return;
        intent.setAction(Intent.ACTION_MAIN); // pas de nouvelle action à la rotation de l'écran
    }
}
