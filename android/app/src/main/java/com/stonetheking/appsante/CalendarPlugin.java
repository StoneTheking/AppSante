package com.stonetheking.appsante;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.util.TimeZone;

/**
 * Agenda du téléphone (dont Google Agenda synchronisé) : lecture des créneaux occupés
 * et ajout des séances de sport planifiées.
 */
@CapacitorPlugin(name = "Calendar", permissions = {
    @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
})
public class CalendarPlugin extends Plugin {

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (getPermissionState("calendar") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
        } else {
            requestPermissionForAlias("calendar", call, "accessCallback");
        }
    }

    @PermissionCallback
    private void accessCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState("calendar") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState("calendar") == PermissionState.GRANTED);
        call.resolve(r);
    }

    /** Agendas modifiables (Google en premier). */
    @PluginMethod
    public void calendars(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) { call.reject("NO_PERMISSION"); return; }
        ContentResolver cr = getContext().getContentResolver();
        String[] proj = { CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.Calendars.ACCOUNT_NAME, CalendarContract.Calendars.IS_PRIMARY };
        Cursor c = cr.query(CalendarContract.Calendars.CONTENT_URI, proj,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + ">=" + CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR + " AND " + CalendarContract.Calendars.VISIBLE + "=1", null, null);
        JSArray out = new JSArray();
        if (c != null) {
            while (c.moveToNext()) {
                JSObject o = new JSObject();
                o.put("id", c.getLong(0));
                o.put("name", c.getString(1));
                o.put("google", "com.google".equals(c.getString(2)));
                o.put("account", c.getString(3));
                o.put("primary", c.getInt(4) == 1);
                out.put(o);
            }
            c.close();
        }
        JSObject r = new JSObject();
        r.put("calendars", out);
        call.resolve(r);
    }

    /** Événements (occurrences) entre deux instants, tous agendas visibles confondus. */
    @PluginMethod
    public void events(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) { call.reject("NO_PERMISSION"); return; }
        long from = call.getLong("from", System.currentTimeMillis());
        long to = call.getLong("to", from + 7L * 86400_000L);
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, from);
        ContentUris.appendId(b, to);
        String[] proj = { CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.TITLE, CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.AVAILABILITY };
        Cursor c = getContext().getContentResolver().query(b.build(), proj, null, null, CalendarContract.Instances.BEGIN + " ASC");
        JSArray out = new JSArray();
        if (c != null) {
            while (c.moveToNext()) {
                if (c.getInt(4) == CalendarContract.Events.AVAILABILITY_FREE) continue;
                JSObject o = new JSObject();
                o.put("start", c.getLong(0));
                o.put("end", c.getLong(1));
                o.put("title", c.getString(2));
                o.put("allDay", c.getInt(3) == 1);
                out.put(o);
            }
            c.close();
        }
        JSObject r = new JSObject();
        r.put("events", out);
        call.resolve(r);
    }

    /** Ajoute des événements (avec rappel 30 min avant) dans l'agenda choisi. */
    @PluginMethod
    public void insert(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) { call.reject("NO_PERMISSION"); return; }
        long calId = call.getLong("calendarId", -1L);
        JSArray list = call.getArray("events", new JSArray());
        ContentResolver cr = getContext().getContentResolver();
        int n = 0;
        try {
            for (int i = 0; i < list.length(); i++) {
                JSONObject e = list.getJSONObject(i);
                ContentValues v = new ContentValues();
                v.put(CalendarContract.Events.CALENDAR_ID, calId);
                v.put(CalendarContract.Events.TITLE, e.getString("title"));
                v.put(CalendarContract.Events.DESCRIPTION, e.optString("details", ""));
                v.put(CalendarContract.Events.DTSTART, e.getLong("start"));
                v.put(CalendarContract.Events.DTEND, e.getLong("end"));
                v.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
                Uri uri = cr.insert(CalendarContract.Events.CONTENT_URI, v);
                if (uri == null) continue;
                long eventId = Long.parseLong(uri.getLastPathSegment());
                ContentValues rem = new ContentValues();
                rem.put(CalendarContract.Reminders.EVENT_ID, eventId);
                rem.put(CalendarContract.Reminders.MINUTES, 30);
                rem.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                cr.insert(CalendarContract.Reminders.CONTENT_URI, rem);
                n++;
            }
        } catch (Exception ex) {
            call.reject(ex.getMessage());
            return;
        }
        JSObject r = new JSObject();
        r.put("inserted", n);
        call.resolve(r);
    }
}
