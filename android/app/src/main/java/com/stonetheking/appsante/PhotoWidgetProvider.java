package com.stonetheking.appsante;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget « Photo du repas » : ouvre directement la caméra de Diana Health. */
public class PhotoWidgetProvider extends AppWidgetProvider {

    static final String ACTION_PHOTO = "com.stonetheking.appsante.PHOTO";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_photo);
        Intent i = new Intent(context, MainActivity.class).setAction(ACTION_PHOTO).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 10, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.photo_root, pi);
        manager.updateAppWidget(ids, v);
    }
}
