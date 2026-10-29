package com.stonetheking.appsante;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget d'écran d'accueil « Je vais dormir » / « Je suis réveillé ».
 * Chaque appui est mémorisé ; l'application les récupère à sa prochaine ouverture.
 */
public class SleepWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "appsante_sleep";
    static final String ACTION_TOGGLE = "com.stonetheking.appsante.SLEEP_TOGGLE";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (!ACTION_TOGGLE.equals(intent.getAction())) return;
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean sleeping = p.getBoolean("sleeping", false);
        long now = System.currentTimeMillis();
        String time = new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date(now));
        addEvent(context, sleeping ? "wake" : "bed", now);
        setState(context, !sleeping, now);
        if (sleeping) {
            long since = p.getLong("since", now);
            long min = (now - since) / 60000;
            Toast.makeText(context, "Bonjour ! " + (min / 60) + " h " + String.format(Locale.FRANCE, "%02d", min % 60) + " au lit", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(context, "Bonne nuit 🌙 coucher noté à " + time, Toast.LENGTH_LONG).show();
        }
    }

    static void addEvent(Context context, String type, long t) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray events = new JSONArray(p.getString("events", "[]"));
            JSONObject e = new JSONObject();
            e.put("type", type);
            e.put("t", t);
            events.put(e);
            p.edit().putString("events", events.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static void setState(Context context, boolean sleeping, long since) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("sleeping", sleeping).putLong("since", since).apply();
        refresh(context);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SleepWidgetProvider.class));
        if (ids.length == 0) return;
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean sleeping = p.getBoolean("sleeping", false);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_sleep);
        if (sleeping) {
            String since = new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date(p.getLong("since", 0)));
            v.setTextViewText(R.id.widget_title, context.getString(R.string.widget_wake_up));
            v.setTextViewText(R.id.widget_subtitle, "Au lit depuis " + since);
            v.setImageViewResource(R.id.widget_icon, R.drawable.ic_widget_sun);
        } else {
            v.setTextViewText(R.id.widget_title, context.getString(R.string.widget_go_to_bed));
            v.setTextViewText(R.id.widget_subtitle, context.getString(R.string.widget_tap_hint));
            v.setImageViewResource(R.id.widget_icon, R.drawable.ic_widget_moon);
        }
        Intent i = new Intent(context, SleepWidgetProvider.class).setAction(ACTION_TOGGLE);
        PendingIntent pi = PendingIntent.getBroadcast(context, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        manager.updateAppWidget(ids, v);
    }
}
