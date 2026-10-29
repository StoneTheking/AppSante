package com.stonetheking.appsante;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
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
        SleepWidgetProvider.setState(getContext(), sleeping, since);
        call.resolve();
    }

    /** Propose d'ajouter le widget à l'écran d'accueil (Android 8+ si le lanceur le permet). */
    @PluginMethod
    public void pin(PluginCall call) {
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager m = getContext().getSystemService(AppWidgetManager.class);
            if (m != null && m.isRequestPinAppWidgetSupported()) {
                m.requestPinAppWidget(new ComponentName(getContext(), SleepWidgetProvider.class), null, null);
                r.put("requested", true);
                call.resolve(r);
                return;
            }
        }
        r.put("requested", false);
        call.resolve(r);
    }
}
