package com.stonetheking.appsante;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Lit les données « Bien-être numérique » (temps d'écran par appli, déverrouillages, usage tardif)
 * via UsageStatsManager. Nécessite l'autorisation spéciale « Accès aux données d'utilisation ».
 */
@CapacitorPlugin(name = "UsageStats")
public class UsageStatsPlugin extends Plugin {

    private static final Set<String> SOCIAL = new HashSet<>(Arrays.asList(
        "com.instagram.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.facebook.katana",
        "com.facebook.lite", "com.snapchat.android", "com.twitter.android", "com.google.android.youtube",
        "com.reddit.frontpage", "com.pinterest", "com.linkedin.android", "com.facebook.orca", "com.whatsapp",
        "org.telegram.messenger", "com.discord", "tv.twitch.android.app", "com.bereal.ft", "com.instagram.barcelona",
        "com.tumblr", "com.vkontakte.android", "com.zzkko", "com.einnovation.temu"));

    private boolean hasAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName())
            : appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", hasAccess());
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
        call.resolve();
    }

    /** Fiche « Infos sur l'appli » : menu ⋮ → « Autoriser les paramètres restreints » (Android 13+). */
    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    // Health Connect : ouvre directement la page des autorisations de Diana Health.
    // Utile quand Android n'affiche plus la fenêtre d'autorisation (après deux refus, elle ne s'ouvre plus).
    @PluginMethod
    public void openHealthPermissions(PluginCall call) {
        String pkg = getContext().getPackageName();
        String[][] tries = {
            {"android.health.connect.action.MANAGE_HEALTH_PERMISSIONS", "pkg"},
            {"androidx.health.ACTION_MANAGE_HEALTH_PERMISSIONS", "pkg"},
            {"android.health.connect.action.HEALTH_HOME_SETTINGS", ""},
            {"androidx.health.ACTION_HEALTH_CONNECT_SETTINGS", ""},
        };
        for (String[] t : tries) {
            Intent i = new Intent(t[0]);
            if (!t[1].isEmpty()) i.putExtra(Intent.EXTRA_PACKAGE_NAME, pkg);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(i);
                JSObject r = new JSObject();
                r.put("opened", t[0]);
                call.resolve(r);
                return;
            } catch (Exception ignored) { }
        }
        try {
            Intent store = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata"));
            store.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(store);
            JSObject r = new JSObject();
            r.put("opened", "store");
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Impossible d'ouvrir Health Connect");
        }
    }

    // Health Connect : demande d'accès, résolue quand l'utilisateur a répondu (MainActivity relaie le résultat).
    // Android 14+ : les accès santé sont des autorisations système, demandées avec requestPermissions
    // (l'intent du contrat androidx « REQUEST_PERMISSIONS » n'est pas une vraie activité et ne s'ouvrait jamais).
    // Android 13 et moins : fenêtre de l'appli Health Connect, ouverte avec startActivityForResult.
    static final int HEALTH_REQUEST = 7311;
    private static PluginCall healthCall;
    private static UsageStatsPlugin healthPlugin;

    @PluginMethod
    public void requestHealth(PluginCall call) {
        JSArray arr = call.getArray("permissions");
        Set<String> perms = new HashSet<>();
        try { for (int i = 0; i < arr.length(); i++) perms.add(arr.getString(i)); } catch (Exception e) { call.reject("Liste d'autorisations invalide"); return; }
        final String[] list = perms.toArray(new String[0]);
        healthCall = call;
        healthPlugin = this;
        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= 34) {
                    androidx.core.app.ActivityCompat.requestPermissions(getActivity(), list, HEALTH_REQUEST);
                } else {
                    Intent intent = androidx.health.connect.client.PermissionController.createRequestPermissionResultContract()
                        .createIntent(getContext(), perms);
                    getActivity().startActivityForResult(intent, HEALTH_REQUEST);
                }
            } catch (Throwable e) {
                healthCall = null;
                call.reject("La fenêtre d'autorisation ne s'ouvre pas : " + e.getMessage());
            }
        });
    }

    /** Appelé par MainActivity quand la fenêtre de Health Connect se ferme. */
    static void onHealthResult() {
        PluginCall call = healthCall;
        UsageStatsPlugin p = healthPlugin;
        healthCall = null;
        if (call == null || p == null) return;
        JSObject r = p.grantedHealth(call.getArray("permissions"));
        r.put("answered", true);
        call.resolve(r);
    }

    // Accès santé accordés, lus directement auprès d'Android (14+) : ne dépend pas du plugin Health Connect.
    private JSObject grantedHealth(JSArray arr) {
        JSArray granted = new JSArray();
        boolean known = Build.VERSION.SDK_INT >= 34;
        if (known && arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                try {
                    String perm = arr.getString(i);
                    if (getContext().checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED) granted.put(perm);
                } catch (Exception ignored) { }
            }
        }
        JSObject r = new JSObject();
        r.put("known", known);
        r.put("granted", granted);
        return r;
    }

    @PluginMethod
    public void healthGranted(PluginCall call) {
        call.resolve(grantedHealth(call.getArray("permissions")));
    }

    // Informations utiles au diagnostic de Health Connect (version d'Android, profil géré, application installée).
    @PluginMethod
    public void healthInfo(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("release", Build.VERSION.RELEASE);
        r.put("maker", Build.MANUFACTURER);
        boolean managed = false;
        try {
            android.os.UserManager um = (android.os.UserManager) getContext().getSystemService(Context.USER_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) managed = um.isManagedProfile();
        } catch (Exception ignored) { }
        r.put("managedProfile", managed);
        boolean app = false;
        try { getContext().getPackageManager().getPackageInfo("com.google.android.apps.healthdata", 0); app = true; } catch (Exception ignored) { }
        r.put("hcApp", app);
        call.resolve(r);
    }

    @PluginMethod
    public void getDaily(PluginCall call) {
        if (!hasAccess()) {
            call.reject("Autorisation « Accès aux données d'utilisation » manquante", "NO_PERMISSION");
            return;
        }
        int days = call.getInt("days", 7);
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getContext().getPackageManager();
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        JSArray out = new JSArray();

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        cal.add(Calendar.DAY_OF_YEAR, -(days - 1));

        for (int d = 0; d < days; d++) {
            long start = cal.getTimeInMillis();
            cal.add(Calendar.DAY_OF_YEAR, 1);
            long end = Math.min(cal.getTimeInMillis(), System.currentTimeMillis());
            if (start >= end) break;
            long lateFrom = start + 22L * 3600_000L; // usage après 22 h

            UsageEvents events = usm.queryEvents(start, end);
            UsageEvents.Event e = new UsageEvents.Event();
            Map<String, Long> fg = new HashMap<>();
            Map<String, Long> openSince = new HashMap<>();
            int unlocks = 0;
            long lateMs = 0;
            long lastUse = -1;

            while (events.hasNextEvent()) {
                events.getNextEvent(e);
                String pkg = e.getPackageName();
                int type = e.getEventType();
                long t = e.getTimeStamp();
                if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                    openSince.put(pkg, t);
                } else if (type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED) {
                    Long s = openSince.remove(pkg);
                    if (s != null && t > s) {
                        long dur = t - s;
                        fg.put(pkg, (fg.containsKey(pkg) ? fg.get(pkg) : 0L) + dur);
                        if (t > lateFrom) lateMs += t - Math.max(s, lateFrom);
                        lastUse = Math.max(lastUse, t);
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && type == UsageEvents.Event.KEYGUARD_HIDDEN) {
                    unlocks++;
                }
            }
            // applis encore ouvertes en fin de période
            for (Map.Entry<String, Long> o : openSince.entrySet()) {
                long dur = end - o.getValue();
                if (dur > 0 && dur < 3 * 3600_000L) fg.put(o.getKey(), (fg.containsKey(o.getKey()) ? fg.get(o.getKey()) : 0L) + dur);
            }

            long total = 0, social = 0;
            List<Map.Entry<String, Long>> sorted = new ArrayList<>();
            for (Map.Entry<String, Long> en : fg.entrySet()) {
                String pkg = en.getKey();
                // Diana Health compte aussi dans le temps d'écran (comme dans Bien-être numérique de Samsung)
                if (isLauncherOrSystemUi(pkg) && !pkg.equals(getContext().getPackageName())) continue;
                total += en.getValue();
                if (SOCIAL.contains(pkg) || isSocialCategory(pm, pkg)) social += en.getValue();
                sorted.add(en);
            }
            sorted.sort((a, b) -> Long.compare(b.getValue(), a.getValue()));
            JSArray top = new JSArray();
            for (int i = 0; i < Math.min(5, sorted.size()); i++) {
                JSObject app = new JSObject();
                app.put("package", sorted.get(i).getKey());
                app.put("name", label(pm, sorted.get(i).getKey()));
                app.put("minutes", Math.round(sorted.get(i).getValue() / 60000.0));
                top.put(app);
            }

            JSObject day = new JSObject();
            day.put("date", fmt.format(start));
            day.put("totalMs", total);
            day.put("socialMs", social);
            day.put("unlocks", unlocks);
            day.put("lateMs", lateMs);
            if (lastUse > 0) {
                Calendar lc = Calendar.getInstance();
                lc.setTimeInMillis(lastUse);
                int minute = lc.get(Calendar.HOUR_OF_DAY) * 60 + lc.get(Calendar.MINUTE);
                day.put("lastUseMinute", minute < 4 * 60 ? minute + 24 * 60 : minute);
            }
            day.put("topApps", top);
            out.put(day);
        }
        JSObject r = new JSObject();
        r.put("days", out);
        call.resolve(r);
    }

    /** Événements d'écran entre deux instants : allumage ("on"), extinction ("off"), déverrouillage ("unlock"). */
    @PluginMethod
    public void screenEvents(PluginCall call) {
        if (!hasAccess()) {
            call.reject("Autorisation « Accès aux données d'utilisation » manquante", "NO_PERMISSION");
            return;
        }
        long from = call.getLong("from", System.currentTimeMillis() - 12 * 3600_000L);
        long to = call.getLong("to", System.currentTimeMillis());
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents events = usm.queryEvents(from, to);
        UsageEvents.Event e = new UsageEvents.Event();
        JSArray out = new JSArray();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            String type = null;
            int t = e.getEventType();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (t == UsageEvents.Event.SCREEN_INTERACTIVE) type = "on";
                else if (t == UsageEvents.Event.SCREEN_NON_INTERACTIVE) type = "off";
                else if (t == UsageEvents.Event.KEYGUARD_HIDDEN) type = "unlock";
            } else if (t == UsageEvents.Event.ACTIVITY_RESUMED && !isLauncherOrSystemUi(e.getPackageName())) {
                type = "on";
            }
            if (type == null) continue;
            JSObject o = new JSObject();
            o.put("type", type);
            o.put("t", e.getTimeStamp());
            out.put(o);
        }
        JSObject r = new JSObject();
        r.put("events", out);
        call.resolve(r);
    }

    // Catégorie déclarée par l'appli sur le Play Store (Android 8+) : rattrape les réseaux sociaux absents de la liste.
    private boolean isSocialCategory(PackageManager pm, String pkg) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        try {
            return pm.getApplicationInfo(pkg, 0).category == ApplicationInfo.CATEGORY_SOCIAL;
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean isLauncherOrSystemUi(String pkg) {
        return pkg.equals("com.android.systemui") || pkg.contains("launcher") || pkg.equals(getContext().getPackageName());
    }

    private String label(PackageManager pm, String pkg) {
        try {
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception ex) {
            return pkg;
        }
    }
}
