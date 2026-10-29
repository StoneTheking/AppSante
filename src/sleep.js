// « Je vais dormir » / « Je suis réveillé » : journal de sommeil en un geste.
// Durée estimée = temps au lit − latence d'endormissement typique (≤ 30 min chez le bon dormeur, Ohayon 2017).
import * as store from './store.js';
import { bedtimeVariability } from './science.js';

export const LATENCY_MIN = 15;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const localKey = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const isSleeping = () => !!store.get().sleepNow;

export function goToBed(at = new Date()) {
  store.update((s) => { s.sleepNow = at.toISOString(); });
}

export function cancelSleep() {
  store.update((s) => { s.sleepNow = null; });
}

// Clôture la nuit en cours ; renvoie le résumé.
export function wakeUp(at = new Date()) {
  const st = store.get();
  if (!st.sleepNow) return null;
  return recordNight(new Date(st.sleepNow), at);
}

export function recordNight(bed, wake) {
  const inBedMin = Math.round((wake - bed) / 60000);
  if (inBedMin < 60) {
    // moins d'une heure : on considère que c'était une fausse manip ou une sieste
    store.update((s) => { s.sleepNow = null; });
    return { tooShort: true, inBedMin };
  }
  const sleepMinutes = Math.max(0, inBedMin - LATENCY_MIN);
  const key = localKey(wake);
  store.update((s) => {
    s.sleepNow = null;
    s.sleepLog = [...s.sleepLog.filter((n) => n.bed !== bed.toISOString()), { bed: bed.toISOString(), wake: wake.toISOString() }].slice(-120);
    s.days[key] = { ...(s.days[key] || {}), bed: hhmm(bed), wake: hhmm(wake), sleepMinutes, sleepSource: 'bouton' };
  });
  return { key, bed: hhmm(bed), wake: hhmm(wake), inBedMin, sleepMinutes };
}

// Applique les appuis faits sur le widget Android pendant que l'application était fermée.
export function applyWidgetEvents(events = []) {
  let summary = null;
  for (const e of events.sort((a, b) => a.t - b.t)) {
    if (e.type === 'bed') goToBed(new Date(e.t));
    else if (e.type === 'wake') summary = wakeUp(new Date(e.t)) || summary;
  }
  return summary;
}

// Régularité : écart-type de l'heure de coucher sur les 7 dernières nuits enregistrées (Phillips 2017, Windred 2024).
export function regularity() {
  const beds = store.get().sleepLog.slice(-7).map((n) => hhmm(new Date(n.bed)));
  return bedtimeVariability(beds);
}

// Minutes restantes avant l'heure de coucher visée (négatif = en retard).
export function minutesToTarget(target, now = new Date()) {
  const [h, m] = target.split(':').map(Number);
  let t = h * 60 + m;
  let n = now.getHours() * 60 + now.getMinutes();
  if (t < 12 * 60) t += 1440;
  if (n < 12 * 60) n += 1440;
  return t - n;
}
