package com.stonetheking.appsante;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Relevé du podomètre en arrière-plan, toutes les ~15 min (et au démarrage du téléphone) :
 * sans lui, seuls les pas entre deux ouvertures de l'appli étaient comptés.
 * Les relevés { t, v } sont gardés 3 jours dans les préférences et lus par StepsPlugin.history().
 */
public class StepsSampler extends BroadcastReceiver {
    static final String PREFS = "steps_sampler";

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, StepsSampler.class).setAction("com.stonetheking.appsante.STEPS_SAMPLE");
        PendingIntent pi = PendingIntent.getBroadcast(c, 41, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_FIFTEEN_MINUTES,
            AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi);
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("on", true).apply();
    }

    static synchronized void save(Context c, long t, long v) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray old = new JSONArray(p.getString("samples", "[]")), out = new JSONArray();
            for (int k = 0; k < old.length(); k++) {
                JSONObject o = old.getJSONObject(k);
                if (t - o.getLong("t") < 3L * 86400000L) out.put(o);
            }
            out.put(new JSONObject().put("t", t).put("v", v));
            p.edit().putString("samples", out.toString()).apply();
        } catch (Exception ignored) { }
    }

    static JSONArray samples(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("samples", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            if (!c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("on", false)) return;
            schedule(c);
        }
        final SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        final Sensor s = sm != null ? sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) : null;
        if (s == null) return;
        final PendingResult pr = goAsync();
        final boolean[] done = { false };
        final SensorEventListener l = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                if (done[0]) return;
                done[0] = true;
                sm.unregisterListener(this);
                save(c, System.currentTimeMillis(), (long) e.values[0]);
                pr.finish();
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        try { sm.registerListener(l, s, SensorManager.SENSOR_DELAY_NORMAL); } catch (Exception e) { pr.finish(); return; }
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (done[0]) return;
            done[0] = true;
            sm.unregisterListener(l);
            pr.finish();
        }, 8000);
    }
}
