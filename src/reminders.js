// Rappels issus du plan de la journée.
// Application Android : notifications locales programmées (fonctionnent application fermée).
// Navigateur : notifications tant que l'application est ouverte ou en arrière-plan récent (limite du web).
import { isNative } from './native.js';

export const KINDS = {
  light: { label: 'Lumière du matin', match: /Lumière/ },
  meal: { label: 'Repas', match: /Petit-déjeuner|Déjeuner|Dîner|Collation/ },
  coffee: { label: 'Dernier café', match: /café/ },
  walk: { label: 'Marche après le repas', match: /Marche digestive/ },
  sport: { label: 'Séance de sport', match: /min\)$/ },
  screens: { label: 'Coupure des écrans', match: /Écrans off/ },
  bed: { label: 'Heure du coucher', match: /^Coucher|Routine/ },
  water: { label: 'Boire de l’eau (toutes les 2 h)', match: null },
  streak: { label: 'Série en jeu (19 h 30)', match: null },
};

export const defaultReminders = () => ({ enabled: false, kinds: { light: true, meal: false, coffee: true, walk: true, sport: true, screens: true, bed: true, water: false, streak: true } });

// Construit la liste des rappels (aujourd'hui et demain) à partir des plans.
export function buildReminders(plans, settings, now = new Date()) {
  const out = [];
  plans.forEach((plan, dayOffset) => {
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + dayOffset);
    for (const item of plan) {
      const kind = Object.entries(KINDS).find(([, k]) => k.match?.test(item.title))?.[0];
      if (!kind || !settings.kinds[kind]) continue;
      const at = new Date(base.getTime() + item.min * 60000 - (kind === 'sport' || kind === 'screens' ? 10 * 60000 : 0));
      if (at > now) out.push({ at, title: item.title, body: item.text.split('. ')[0] + '.', kind });
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
