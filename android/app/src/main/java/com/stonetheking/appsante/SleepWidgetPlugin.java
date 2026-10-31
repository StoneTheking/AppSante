package com.stonetheking.appsante;

import android.app.AlarmManager;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Pont entre l'application et le widget « Je vais dormir ». */
@CapacitorPlugin(name = "SleepWidget")
public class SleepWidgetPlugin extends Plugin {

    /** Renvoie les appuis faits sur le widget depuis la dernière lecture, puis les efface. */
    @PluginMethod
    public void takeEvents(PluginCall call) {
        SharedPreferences p = getContext().getSharedPreferences(SleepWidgetProvider.PREFS, Context.MODE_PRIVATE);
        try {
            JSArray events = new JSArray(p.getString("events", "[]"));
            p.edit().putString("events", "[]").apply();
            JSObject r = new JSObject();
            r.put("events", events);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Aligne le widget sur l'état de l'application (appui sur le bouton dans l'appli). */
    @PluginMethod
    public void setState(PluginCall call) {
        boolean sleeping = Boolean.TRUE.equals(call.getBoolean("sleeping", false));
        long since = call.getLong("since", System.currentTimeMillis());
        String target = call.getString("target");
        if (target != null) getContext().getSharedPreferences(SleepWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString("target", target).apply();
        SleepWidgetProvider.setState(getContext(), sleeping, since);
        call.resolve();
    }

    static final int WORKOUT_ID = 4200;
    static final String WORKOUT_CHANNEL = "workout";

    /**
     * Séance de sport en cours : notification permanente avec le chronomètre qui tourne (comme une appli de course).
     * Un appui rouvre l'onglet Sport.
     */
    @PluginMethod
    public void workoutShow(PluginCall call) {
        Context c = getContext();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) { call.resolve(); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(WORKOUT_CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(WORKOUT_CHANNEL, "Séance en cours", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Chronomètre de la séance de sport en cours");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        long start = call.getLong("start", System.currentTimeMillis());
        Intent open = new Intent(c, MainActivity.class).setAction(QuestsWidgetProvider.ACTION_QUEST)
            .setData(Uri.parse("dianahealth://quest/move"))
            .putExtra("quest", "move")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 42, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(c, WORKOUT_CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat_appsante)
            .setContentTitle(call.getString("title", "Séance en cours"))
            .setContentText(call.getString("text", "Touchez pour revenir à votre séance"))
            .setWhen(start)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setColor(0xFFFB923C)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setContentIntent(pi);
        try { nm.notify(WORKOUT_ID, b.build()); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void workoutHide(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(WORKOUT_ID);
        call.resolve();
    }

    /** État des quêtes du jour pour le widget (JSON préparé par l'application). */
    @PluginMethod
    public void setQuests(PluginCall call) {
        String data = call.getString("data");
        if (data != null) {
            getContext().getSharedPreferences(QuestsWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString("data", data).apply();
            QuestsWidgetProvider.refresh(getContext());
        }
        call.resolve();
    }

    /** Heure de la prochaine alarme programmée dans l'application Horloge (ou null). */
    @PluginMethod
    public void nextAlarm(PluginCall call) {
        JSObject r = new JSObject();
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        AlarmManager.AlarmClockInfo info = am != null ? am.getNextAlarmClock() : null;
        if (info != null) r.put("at", info.getTriggerTime());
        call.resolve(r);
    }

    /** Propose d'ajouter le widget à l'écran d'accueil (Android 8+ si le lanceur le permet). */
    @PluginMethod
    public void pin(PluginCall call) {
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager m = getContext().getSystemService(AppWidgetManager.class);
            if (m != null && m.isRequestPinAppWidgetSupported()) {
                String kind = call.getString("kind");
                Class<?> cls = "photo".equals(kind) ? PhotoWidgetProvider.class : "quests".equals(kind) ? QuestsWidgetProvider.class : SleepWidgetProvider.class;
                m.requestPinAppWidget(new ComponentName(getContext(), cls), null, null);
                r.put("requested", true);
                call.resolve(r);
                return;
            }
        }
        r.put("requested", false);
        call.resolve(r);
    }
}
