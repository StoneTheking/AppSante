package com.stonetheking.appsante;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Podomètre intégré du téléphone (capteur TYPE_STEP_COUNTER) : pas cumulés depuis le démarrage.
 * Sert de repli quand Health Connect n'est pas disponible.
 */
@CapacitorPlugin(name = "Steps", permissions = {
    @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
})
public class StepsPlugin extends Plugin {

    private boolean granted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || getPermissionState("activity") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = granted() && sensor() != null;
        if (ok) StepsSampler.schedule(getContext());
        r.put("granted", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (granted()) {
            JSObject r = new JSObject();
            r.put("granted", sensor() != null);
            call.resolve(r);
        } else {
            requestPermissionForAlias("activity", call, "accessCallback");
        }
    }

    @PermissionCallback
    private void accessCallback(PluginCall call) {
        if (granted() && sensor() != null) StepsSampler.schedule(getContext());
        JSObject r = new JSObject();
        r.put("granted", granted() && sensor() != null);
        call.resolve(r);
    }

    /** Relevés pris en arrière-plan par StepsSampler : { samples: [{ t, v }] }. */
    @PluginMethod
    public void history(PluginCall call) {
        JSObject r = new JSObject();
        try { r.put("samples", new com.getcapacitor.JSArray(StepsSampler.samples(getContext()).toString())); }
        catch (Exception e) { r.put("samples", new com.getcapacitor.JSArray()); }
        call.resolve(r);
    }

    private Sensor sensor() {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        return sm != null ? sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) : null;
    }

    /** Lit une valeur du compteur (le capteur livre sa valeur courante dès l'abonnement). */
    @PluginMethod
    public void read(PluginCall call) {
        if (!granted()) { call.reject("Autorisation « activité physique » refusée"); return; }
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor s = sensor();
        if (sm == null || s == null) { call.reject("Pas de podomètre sur ce téléphone"); return; }
        final boolean[] done = { false };
        final Handler h = new Handler(Looper.getMainLooper());
        SensorEventListener l = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                if (done[0]) return;
                done[0] = true;
                sm.unregisterListener(this);
                JSObject r = new JSObject();
                long t = System.currentTimeMillis();
                StepsSampler.save(getContext(), t, (long) e.values[0]);
                r.put("value", (long) e.values[0]);
                r.put("t", t);
                call.resolve(r);
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        sm.registerListener(l, s, SensorManager.SENSOR_DELAY_NORMAL);
        h.postDelayed(() -> {
            if (done[0]) return;
            done[0] = true;
            sm.unregisterListener(l);
            call.reject("Le podomètre n'a pas répondu");
        }, 4000);
    }
}
