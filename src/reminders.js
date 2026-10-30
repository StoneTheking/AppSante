// Rappels issus du plan de la journée.
// Application Android : notifications locales programmées (fonctionnent application fermée).
// Navigateur : notifications tant que l'application est ouverte ou en arrière-plan récent (limite du web).
import { isNative } from './native.js';

// keys : clés des étapes du plan (voir coach.dailyPlan) ; on suit la clé et non le titre, que l'utilisateur peut renommer.
export const KINDS = {
  light: { label: 'Lumière du matin', desc: 'Peu après ton réveil : ouvrir les volets et passer 10–15 min dehors. La lumière du jour le matin règle ton horloge interne, tu t’endors plus facilement le soir.', keys: ['☀️'] },
  meal: { label: 'Repas', desc: 'À l’heure prévue de chaque repas (petit-déj, déjeuner, collation, dîner) pour penser à manger à heures régulières et à noter ce que tu manges.', keys: ['🍳', '🥗', '🍎', '🍽️'] },
  coffee: { label: 'Dernier café', desc: '8 h avant ton coucher : après, la caféine abîme encore ton sommeil. Le rappel te dit que c’est le moment de passer au déca ou à l’eau.', keys: ['☕'] },
  walk: { label: 'Marche après le repas', desc: '30 min après le déjeuner : 10–15 min de marche légère font baisser le pic de sucre dans le sang.', keys: ['🚶'] },
  sport: { label: 'Séance de sport', desc: 'Au créneau choisi pour ta séance du jour (selon ton travail, ton agenda et la météo).', keys: ['🏃'] },
  screens: { label: 'Coupure des écrans', desc: '1 h avant le coucher : poser le téléphone, idéalement hors de la chambre, pour t’endormir plus vite.', keys: ['📵'] },
  bed: { label: 'Heure du coucher', desc: '30 min avant (routine de détente) puis à ton heure de coucher, pour garder des horaires réguliers.', keys: ['🌙', '🧘'] },
  custom: { label: 'Mes étapes ajoutées', desc: 'Les étapes que tu as ajoutées toi-même (vitamines, méditation…), à l’heure que tu as choisie.', keys: [] },
  water: { label: 'Boire de l’eau (toutes les 2 h)', desc: 'Un petit rappel toutes les 2 h dans la journée pour boire un verre d’eau.', keys: null },
  streak: { label: 'Série en jeu (19 h 30)', desc: 'À 19 h 30, seulement s’il te manque encore des quêtes du jour : pour ne pas perdre ta série de jours 🔥.', keys: null },
  weigh: { label: 'Pesée toutes les 2 semaines', desc: 'À 8 h 15, quand ta dernière pesée date de 2 semaines : à jeun, pour comparer ton poids réel à l’estimation de tes repas.', keys: null },
};

export const defaultReminders = () => ({ enabled: false, kinds: { light: true, meal: false, coffee: true, walk: true, sport: true, screens: true, bed: true, custom: true, water: false, streak: true, weigh: true } });

// Construit la liste des rappels (aujourd'hui et demain) à partir des plans.
export function buildReminders(plans, settings, now = new Date()) {
  const out = [];
  plans.forEach((plan, dayOffset) => {
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dayOffset);
    for (const item of plan) {
      if (item.done) continue;
      const kind = item.custom ? 'custom' : Object.entries(KINDS).find(([, k]) => k.keys?.includes(item.key))?.[0];
      if (!kind || settings.kinds[kind] === false || (kind !== 'custom' && !settings.kinds[kind])) continue;
      const at = new Date(base.getTime() + item.min * 60000 - (kind === 'sport' || kind === 'screens' ? 10 * 60000 : 0));
      if (at > now) out.push({ at, title: item.title, body: item.note || (item.text ? item.text.split('. ')[0] + '.' : 'C’est l’heure.'), kind });
    }
    if (settings.kinds.water) {
      const wake = plan[0]?.min ?? 420, bed = plan.at(-1)?.min ?? 1380;
      for (let m = wake + 120; m < bed - 60; m += 120) {
        const at = new Date(base.getTime() + m * 60000);
        if (at > now) out.push({ at, title: 'Un verre d’eau 💧', body: 'Pense à t’hydrater (≈ 1,5–2 L de boissons par jour).', kind: 'water' });
      }
    }
  });
  return out.sort((a, b) => a.at - b.at);
}

let webTimers = [];

export async function requestPermission() {
  if (isNative) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  }
  if (!('Notification' in window)) return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function schedule(reminders) {
  if (isNative) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!reminders.length) return 0;
    await LocalNotifications.schedule({
      notifications: reminders.slice(0, 60).map((r, i) => ({
        id: 1000 + i,
        title: r.title,
        body: r.body,
        schedule: { at: r.at, allowWhileIdle: true },
        smallIcon: 'ic_stat_appsante',
      })),
    });
    return reminders.length;
  }
  webTimers.forEach(clearTimeout);
  webTimers = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return 0;
  const reg = await navigator.serviceWorker?.getRegistration();
  for (const r of reminders) {
    const delay = r.at - Date.now();
    if (delay > 2 ** 31 - 1) continue;
    webTimers.push(setTimeout(() => {
      if (reg) reg.showNotification(r.title, { body: r.body, icon: 'icon-192.png', badge: 'icon-192.png', tag: r.kind });
      else new Notification(r.title, { body: r.body, icon: 'icon-192.png' });
    }, delay));
  }
  return reminders.length;
}
