package com.stonetheking.appsante;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget « Quêtes du jour » : les 5 anneaux de l'accueil, la série et le message du jour.
 * L'application envoie l'état à chaque mise à jour (SleepWidgetPlugin.setQuests) ;
 * un appui sur « Eau » ajoute 25 cL tout de suite (repris par l'application à sa prochaine ouverture),
 * « Repas » ouvre directement l'appareil photo, « Sommeil » note le coucher (comme le widget sommeil),
 * les autres quêtes ouvrent l'écran qui permet de les faire.
 * Les appuis sur l'eau sont gardés à part (« taps ») et ajoutés à l'affichage tant que l'application ne les a pas
 * encore comptés (waterSeen) : un état envoyé entre-temps par l'application ne fait plus reculer la jauge.
 */
public class QuestsWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "appsante_quests";
    static final String ACTION_WATER = "com.stonetheking.appsante.QUEST_WATER";
    static final String ACTION_QUEST = "com.stonetheking.appsante.QUEST";
    static final int WATER_ML = 250;

    static final String[] IDS = { "move", "food", "sleep", "water", "mood" };
    static final int[] COLORS = { 0xFFFB923C, 0xFF4ADE80, 0xFF818CF8, 0xFF60A5FA, 0xFFF472B6 };
    static final int[] ICONS = { R.drawable.ic_w_steps, R.drawable.ic_w_salad, R.drawable.ic_w_moonq, R.drawable.ic_w_water, R.drawable.ic_w_smile };
    static final int[] CELL = { R.id.q_move, R.id.q_food, R.id.q_sleep, R.id.q_water, R.id.q_mood };
    static final int[] RING = { R.id.q_move_ring, R.id.q_food_ring, R.id.q_sleep_ring, R.id.q_water_ring, R.id.q_mood_ring };
    static final int[] DOT = { R.id.q_move_dot, R.id.q_food_dot, R.id.q_sleep_dot, R.id.q_water_dot, R.id.q_mood_dot };
    static final int[] ICON = { R.id.q_move_icon, R.id.q_food_icon, R.id.q_sleep_icon, R.id.q_water_icon, R.id.q_mood_icon };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (!ACTION_WATER.equals(intent.getAction())) return;
        long now = System.currentTimeMillis();
        SleepWidgetProvider.addEvent(context, "water", now, null);
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray taps = new JSONArray(p.getString("taps", "[]"));
            taps.put(now);
            while (taps.length() > 60) taps.remove(0);
            p.edit().putString("taps", taps.toString()).apply();
        } catch (Exception ignored) {
        }
        Toast.makeText(context, "+25 cL 💧", Toast.LENGTH_SHORT).show();
        refresh(context);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    static JSONObject load(Context context) {
        try {
            String s = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null);
            return s != null ? new JSONObject(s) : null;
        } catch (Exception e) {
            return null;
        }
    }

    static void save(Context context, JSONObject d) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", d.toString()).apply();
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, QuestsWidgetProvider.class));
        if (ids.length == 0) return;
        JSONObject d = load(context);
        // nouvelle journée sans ouverture de l'application : anneaux vides, la série reste affichée
        boolean fresh = d != null && today().equals(d.optString("date"));
        JSONArray items = fresh ? d.optJSONArray("items") : null;
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_quests);
        // eau ajoutée depuis le widget et pas encore reprise par l'application
        int extraMl = 0;
        if (fresh) {
            long seen = d.optLong("waterSeen", 0);
            String day = today();
            try {
                JSONArray taps = new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("taps", "[]"));
                SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                for (int j = 0; j < taps.length(); j++) {
                    long t = taps.optLong(j);
                    if (t > seen && day.equals(f.format(new Date(t)))) extraMl += WATER_ML;
                }
            } catch (Exception ignored) {
            }
        }
        int target = d != null ? Math.max(1, d.optInt("waterTarget", 2000)) : 2000;
        int waterMl = (d != null ? d.optInt("waterMl") : 0) + extraMl;
        int done = 0;
        for (int i = 0; i < IDS.length; i++) {
            double p = 0;
            boolean ok = false;
            if (items != null) {
                for (int j = 0; j < items.length(); j++) {
                    JSONObject q = items.optJSONObject(j);
                    if (q != null && IDS[i].equals(q.optString("id"))) {
                        p = q.optDouble("progress", 0);
                        ok = q.optBoolean("done", false);
                    }
                }
            }
            if ("water".equals(IDS[i]) && extraMl > 0) {
                p = Math.max(p, Math.min(1.0, waterMl / (double) target));
                ok = ok || waterMl >= target;
            }
            if (ok) done++;
            v.setProgressBar(RING[i], 100, (int) Math.round(Math.max(0, Math.min(1, p)) * 100), false);
            v.setViewVisibility(DOT[i], ok ? View.VISIBLE : View.GONE);
            if (ok) v.setInt(DOT[i], "setColorFilter", COLORS[i]);
            v.setImageViewResource(ICON[i], ok ? R.drawable.ic_w_check : ICONS[i]);

            PendingIntent pi;
            if ("water".equals(IDS[i])) {
                Intent w = new Intent(context, QuestsWidgetProvider.class).setAction(ACTION_WATER);
                pi = PendingIntent.getBroadcast(context, 30, w, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            } else if ("sleep".equals(IDS[i])) {
                // même action que le widget sommeil : « je vais dormir » (ou « je me réveille » si la nuit est en cours)
                Intent s = new Intent(context, SleepWidgetProvider.class).setAction(SleepWidgetProvider.ACTION_TOGGLE);
                pi = PendingIntent.getBroadcast(context, 36, s, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            } else if ("food".equals(IDS[i])) {
                // repas : l'appareil photo s'ouvre directement (photo du plat ou du code-barres)
                Intent ph = new Intent(context, MainActivity.class).setAction(PhotoWidgetProvider.ACTION_PHOTO)
                    .setData(Uri.parse("dianahealth://photo/quest"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                pi = PendingIntent.getActivity(context, 37, ph, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            } else {
                Intent open = new Intent(context, MainActivity.class).setAction(ACTION_QUEST)
                    .setData(Uri.parse("dianahealth://quest/" + IDS[i]))
                    .putExtra("quest", IDS[i])
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                pi = PendingIntent.getActivity(context, 31 + i, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            }
            v.setOnClickPendingIntent(CELL[i], pi);
        }
        int need = d != null ? d.optInt("need", 3) : 3;
        int streak = d != null ? d.optInt("streak", 0) : 0;
        if (fresh && done >= need && d.optInt("done", 0) < need && !d.optBoolean("validated", false)) streak++; // validée depuis le widget (eau)
        v.setTextViewText(R.id.q_count, done + "/" + IDS.length);
        v.setTextViewText(R.id.q_streak, String.valueOf(streak));
        String msg;
        boolean risk = false;
        if (!fresh) msg = context.getString(R.string.widget_quests_empty);
        else if (done >= need) msg = done == IDS.length ? "Journée parfaite ! +20 XP bonus" : "Journée validée · série de " + streak + " jour" + (streak > 1 ? "s" : "");
        else {
            int left = need - done;
            risk = d.optBoolean("atRisk", false);
            msg = (risk ? "🔥 " : "") + "Encore " + left + " quête" + (left > 1 ? "s" : "") + " pour " + (risk ? "sauver" : "valider") + " ta série";
        }
        v.setTextViewText(R.id.q_msg, msg);
        v.setInt(R.id.q_msg, "setBackgroundResource", risk ? R.drawable.widget_chip_risk : R.drawable.widget_chip);
        v.setTextColor(R.id.q_msg, risk ? 0xFFFB923C : 0xFFC4CCD8);

        Intent home = new Intent(context, MainActivity.class).setAction(ACTION_QUEST)
            .setData(Uri.parse("dianahealth://quest/home"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.quests_root, PendingIntent.getActivity(context, 40, home, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(ids, v);
    }
}
