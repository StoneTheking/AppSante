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

export function recordNight(bed, wake, extra = {}) {
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
    s.days[key] = { ...(s.days[key] || {}), bed: hhmm(bed), wake: hhmm(wake), sleepMinutes, sleepSource: extra.source || 'bouton', ...(extra.nightWakes != null ? { nightWakes: extra.nightWakes } : {}) };
  });
  return { key, bed: hhmm(bed), wake: hhmm(wake), inBedMin, sleepMinutes, ...extra };
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

// ---------- Détection automatique du réveil ----------
// À partir des événements d'écran du téléphone (allumage, déverrouillage) enregistrés par Android,
// comme l'algorithme validé iSenseSleep (Ciman 2019) :
// - le réveil = premier déverrouillage suivi d'une utilisation continue (autre activité dans l'heure),
//   ou proche de l'alarme programmée ;
// - un déverrouillage isolé en pleine nuit, suivi d'une longue inactivité, compte comme un réveil nocturne.
const MIN = 60000;
export function detectWake(bedMs, events, { alarmMs = null, nowMs = Date.now(), wakeTarget = '07:00' } = {}) {
  const ev = events.filter((e) => e.t > bedMs + 30 * MIN && e.t <= nowMs).sort((a, b) => a.t - b.t);
  const unlocks = ev.filter((e) => e.type === 'unlock');
  // les écrans allumés seuls (notifications) ne comptent que s'il n'y a aucune donnée de déverrouillage
  const primary = unlocks.length ? unlocks : ev.filter((e) => e.type === 'on');
  const [th, tm] = wakeTarget.split(':').map(Number);
  const nightWakes = [];
  // 1) Alarme : premier signal (sonnerie qui allume l'écran ou déverrouillage) suivi d'un déverrouillage dans l'heure
  if (alarmMs) {
    const a = ev.find((e) => e.type !== 'off' && e.t >= alarmMs - 5 * MIN && e.t <= alarmMs + 90 * MIN);
    if (a && primary.some((x) => x.t >= a.t && x.t <= a.t + 60 * MIN)) {
      const before = primary.filter((x) => x.t < a.t);
      return { wake: a.t, nightWakes: countNightWakes(before, bedMs), source: 'alarme' };
    }
  }
  // 2) Sans alarme : premier déverrouillage du matin suivi d'une autre utilisation dans l'heure
  for (const { t } of primary) {
    const d = new Date(t);
    const hour = d.getHours() + d.getMinutes() / 60;
    const sinceBed = (t - bedMs) / 3600e3;
    const followUp = primary.some((x) => x.t > t + 2 * MIN && x.t <= t + 60 * MIN);
    const plausibleMorning = sinceBed >= 3 && hour >= Math.min(4.5, th + tm / 60 - 2) && hour < 14;
    if (plausibleMorning && followUp) return { wake: t, nightWakes: countNightWakes(nightWakes, bedMs), source: 'téléphone' };
    nightWakes.push({ t });
  }
  return { wake: null, nightWakes: countNightWakes(nightWakes, bedMs) };
}

// Réveils nocturnes : déverrouillages espacés d'au moins 20 min.
function countNightWakes(list, bedMs) {
  let n = 0, last = -Infinity;
  for (const { t } of list) if (t - bedMs >= 30 * MIN && t - last >= 20 * MIN) { n++; last = t; }
  return n;
}
