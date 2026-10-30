package com.stonetheking.appsante;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/**
 * Widget « Photo ou code-barres » : ouvre directement la caméra de Diana Health
 * (un code-barres visible sur la photo est reconnu) ou le scanner de produit.
 */
public class PhotoWidgetProvider extends AppWidgetProvider {

    static final String ACTION_PHOTO = "com.stonetheking.appsante.PHOTO";
    static final String ACTION_SCAN = "com.stonetheking.appsante.SCAN";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_photo);
        Intent i = new Intent(context, MainActivity.class).setAction(ACTION_PHOTO).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 10, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.photo_btn, pi);
        Intent sc = new Intent(context, MainActivity.class).setAction(ACTION_SCAN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.scan_btn, PendingIntent.getActivity(context, 11, sc, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(ids, v);
    }
}
