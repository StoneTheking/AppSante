package com.stonetheking.appsante;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import java.util.Locale;

/**
 * Nuit en cours : notification discrète avec chronomètre, et arrêt automatique
 * au premier déverrouillage du téléphone (après 10 min de délai de grâce pour régler un réveil).
 */
public class SleepService extends Service {

    static final String CHANNEL = "sleep";
    static final int ONGOING_ID = 4201;
    static final int MORNING_ID = 4202;
    static final long GRACE_MS = 10 * 60 * 1000L;

    private BroadcastReceiver unlock;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences p = getSharedPreferences(SleepWidgetProvider.PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("sleeping", false)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        long since = p.getLong("since", System.currentTimeMillis());
        channel();
        Notification n = builder()
            .setSmallIcon(R.drawable.ic_stat_appsante)
            .setContentTitle("Nuit en cours 🌙")
            .setContentText("Déverrouille ton téléphone au réveil : la nuit s’arrête toute seule.")
            .setWhen(since)
            .setUsesChronometer(true)
            .setShowWhen(true)
            .setOngoing(true)
            .setContentIntent(openApp())
            .addAction(0, "Je suis réveillé", toggle())
            .build();
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ONGOING_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else startForeground(ONGOING_ID, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (unlock == null) {
            unlock = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent i) {
                    SharedPreferences sp = c.getSharedPreferences(SleepWidgetProvider.PREFS, Context.MODE_PRIVATE);
                    long start = sp.getLong("since", System.currentTimeMillis());
                    long now = System.currentTimeMillis();
                    if (!sp.getBoolean("sleeping", false) || now - start < GRACE_MS) return;
                    SleepWidgetProvider.wake(c, now, "déverrouillage");
                    morning(c, now - start);
                }
            };
            registerReceiver(unlock, new IntentFilter(Intent.ACTION_USER_PRESENT));
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (unlock != null) {
            try { unregisterReceiver(unlock); } catch (Exception ignored) { }
            unlock = null;
        }
        super.onDestroy();
    }

    private Notification.Builder builder() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
    }

    private void channel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.sleep_channel), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        }
    }

    private PendingIntent openApp() {
        Intent i = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent toggle() {
        Intent i = new Intent(this, SleepWidgetProvider.class).setAction(SleepWidgetProvider.ACTION_TOGGLE);
        return PendingIntent.getBroadcast(this, 2, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Résumé du matin, avec « Je me rendors » si le déverrouillage n'était pas le vrai réveil. */
    private void morning(Context c, long ms) {
        long min = ms / 60000;
        Intent resume = new Intent(c, SleepWidgetProvider.class).setAction(SleepWidgetProvider.ACTION_RESUME);
        PendingIntent rp = PendingIntent.getBroadcast(c, 3, resume, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = builder()
            .setSmallIcon(R.drawable.ic_stat_appsante)
            .setContentTitle("Bonjour ☀ " + (min / 60) + " h " + String.format(Locale.FRANCE, "%02d", min % 60) + " au lit")
            .setContentText("Nuit enregistrée. Ouvre Diana Health pour noter ton ressenti.")
            .setAutoCancel(true)
            .setContentIntent(openApp())
            .addAction(0, "Je me rendors", rp)
            .build();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(MORNING_ID, n);
    }
}
