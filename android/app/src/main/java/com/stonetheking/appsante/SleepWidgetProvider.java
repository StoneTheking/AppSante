package com.stonetheking.appsante;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget « Je vais dormir » : un appui démarre la nuit (chronomètre en direct),
 * le déverrouillage du téléphone au réveil l'arrête (voir SleepService).
 * Chaque événement est mémorisé ; l'application les récupère à sa prochaine ouverture.
 */
public class SleepWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "appsante_sleep";
    static final String ACTION_TOGGLE = "com.stonetheking.appsante.SLEEP_TOGGLE";
    static final String ACTION_RESUME = "com.stonetheking.appsante.SLEEP_RESUME";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (ACTION_TOGGLE.equals(action)) {
            boolean sleeping = p.getBoolean("sleeping", false);
            long now = System.currentTimeMillis();
            if (sleeping) {
                wake(context, now, "bouton");
            } else {
                addEvent(context, "bed", now, null);
                setState(context, true, now);
                Toast.makeText(context, "Bonne nuit 🌙 coucher noté à " + hhmm(now), Toast.LENGTH_SHORT).show();
            }
        } else if (ACTION_RESUME.equals(action)) {
            // « Je me rendors » : on annule le réveil détecté et la nuit continue
            long since = p.getLong("lastSince", 0);
            if (since > 0) {
                removeLastWake(context);
                addEvent(context, "resume", since, null);
                setState(context, true, since);
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.cancel(SleepService.MORNING_ID);
            }
        }
    }

    /** Fin de nuit : enregistre le réveil, arrête le service et met à jour le widget. */
    static void wake(Context context, long t, String source) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long since = p.getLong("since", t);
        addEvent(context, "wake", t, source);
        p.edit().putLong("lastSince", since).apply();
        setState(context, false, t);
        long min = (t - since) / 60000;
        if ("bouton".equals(source)) {
            Toast.makeText(context, "Bonjour ☀ " + (min / 60) + " h " + String.format(Locale.FRANCE, "%02d", min % 60) + " au lit", Toast.LENGTH_LONG).show();
        }
    }

    static String hhmm(long t) {
        return new SimpleDateFormat("HH:mm", Locale.FRANCE).format(new Date(t));
    }

    static void addEvent(Context context, String type, long t, String source) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray events = new JSONArray(p.getString("events", "[]"));
            JSONObject e = new JSONObject();
            e.put("type", type);
            e.put("t", t);
            if (source != null) e.put("source", source);
            events.put(e);
            p.edit().putString("events", events.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static void removeLastWake(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray events = new JSONArray(p.getString("events", "[]"));
            if (events.length() > 0 && "wake".equals(events.getJSONObject(events.length() - 1).optString("type"))) {
                events.remove(events.length() - 1);
                p.edit().putString("events", events.toString()).apply();
            }
        } catch (Exception ignored) {
        }
    }

    static void setState(Context context, boolean sleeping, long since) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("sleeping", sleeping).putLong("since", since).apply();
        try {
            Intent svc = new Intent(context, SleepService.class);
            if (sleeping) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(svc);
                else context.startService(svc);
            } else {
                context.stopService(svc);
            }
        } catch (Exception ignored) {
            // démarrage refusé en arrière-plan : le réveil sera détecté à l'ouverture de l'application
        }
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
            long since = p.getLong("since", System.currentTimeMillis());
            long base = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - since);
            v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_night);
            v.setTextViewText(R.id.widget_kicker, context.getString(R.string.widget_kicker_night));
            v.setViewVisibility(R.id.widget_title, View.GONE);
            v.setViewVisibility(R.id.widget_chrono, View.VISIBLE);
            v.setChronometer(R.id.widget_chrono, base, null, true);
            v.setTextViewText(R.id.widget_subtitle, "Depuis " + hhmm(since) + " · s’arrête au déverrouillage");
            v.setTextViewText(R.id.widget_action, context.getString(R.string.widget_action_wake));
            v.setImageViewResource(R.id.widget_icon, R.drawable.ic_widget_sun);
        } else {
            v.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg);
            v.setTextViewText(R.id.widget_kicker, context.getString(R.string.widget_kicker_day));
            v.setViewVisibility(R.id.widget_title, View.VISIBLE);
            v.setViewVisibility(R.id.widget_chrono, View.GONE);
            v.setChronometer(R.id.widget_chrono, SystemClock.elapsedRealtime(), null, false);
            String target = p.getString("target", null);
            v.setTextViewText(R.id.widget_title, context.getString(R.string.widget_go_to_bed));
            v.setTextViewText(R.id.widget_subtitle, target != null ? "Coucher visé " + target : context.getString(R.string.widget_tap_hint));
            v.setTextViewText(R.id.widget_action, context.getString(R.string.widget_action_sleep));
            v.setImageViewResource(R.id.widget_icon, R.drawable.ic_widget_moon);
        }
        Intent i = new Intent(context, SleepWidgetProvider.class).setAction(ACTION_TOGGLE);
        PendingIntent pi = PendingIntent.getBroadcast(context, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);
        manager.updateAppWidget(ids, v);
    }
}
