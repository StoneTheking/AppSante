// Ce qui joue sur ton sommeil et ton humeur : comparaison de tes propres jours (ex. « tu dors 40 min de plus
// les nuits qui suivent un jour à plus de 8 000 pas »). Corrélations personnelles, pas des preuves de cause.
import { sleepHours } from './science.js';

const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs) => { const m = mean(xs); return xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1); };

// Minutes de sommeil de la nuit qui se termine le jour k.
const sleepMin = (d) => (d?.sleepMinutes ? d.sleepMinutes : sleepHours(d?.bed, d?.wake) != null ? sleepHours(d.bed, d.wake) * 60 : null);

export function correlations(st, { days = 60, now = new Date() } = {}) {
  const keys = Array.from({ length: days }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (days - 1) + i); return key(d); });
  const day = (k) => st.days[k] || {};
  const next = (k) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + 1); return key(d); };
  const prev = (k) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() - 1); return key(d); };
  const late = new Set((st.meals || []).filter((m) => (m.time || '') >= '21:00').map((m) => m.date));
  const trained = new Set((st.workouts || []).map((w) => w.date));
  const screens = keys.map((k) => day(k).screenMin).filter((x) => x != null).sort((a, b) => a - b);
  const screenCut = screens.length ? screens[Math.floor(screens.length / 2)] : null;
  const h = (m) => `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;

  // Facteurs (vrai / faux / inconnu pour un jour donné)
  const drivers = [
    { id: 'steps', on: 'un jour à plus de 8 000 pas', days: 'les jours à plus de 8 000 pas', f: (k) => (day(k).steps ? day(k).steps >= 8000 : null) },
    { id: 'workout', on: 'un jour avec une séance de sport', days: 'les jours où tu fais du sport', f: (k) => (trained.has(k) || (day(k).modMin || 0) + (day(k).vigMin || 0) + (day(k).strengthMin || 0) >= 20 ? true : day(k).steps != null || Object.keys(day(k)).length ? false : null) },
    { id: 'alcohol', on: 'un soir avec de l’alcool', days: 'les jours avec de l’alcool', f: (k) => (Object.keys(day(k)).length ? (day(k).alcohol || 0) > 0 : null) },
    { id: 'late', on: 'un dîner après 21 h', days: 'les jours de dîner tardif', f: (k) => ((st.meals || []).some((m) => m.date === k) ? late.has(k) : null) },
    { id: 'screen', on: `plus de ${screenCut != null ? h(screenCut) : '?'} d’écran`, days: `les jours à plus de ${screenCut != null ? h(screenCut) : '?'} d’écran`, f: (k) => (screenCut != null && day(k).screenMin != null ? day(k).screenMin > screenCut : null) },
    { id: 'social', on: 'plus d’1 h de réseaux sociaux', days: 'les jours à plus d’1 h de réseaux sociaux', f: (k) => (day(k).socialMin != null ? day(k).socialMin > 60 : null) },
    { id: 'slept', on: 'une nuit de 7 h ou plus', days: 'après une nuit de 7 h ou plus', f: (k) => { const m = sleepMin(day(k)); return m != null ? m >= 420 : null; }, sameDayOnly: true },
  ];
  // Résultats : sommeil de la nuit suivante, humeur / énergie du jour même
  const outcomes = [
    { id: 'sleep', what: 'sommeil', g: (k) => sleepMin(day(next(k))), min: 15, night: true },
    { id: 'sleepQ', what: 'qualité du sommeil', g: (k) => day(next(k)).sleepQuality ?? null, min: 0.35, night: true },
    { id: 'mood', what: 'humeur', g: (k) => day(k).mood ?? null, min: 0.35 },
    { id: 'energy', what: 'énergie', g: (k) => day(k).energy ?? null, min: 0.35 },
  ];
  const out = [];
  for (const dr of drivers) for (const oc of outcomes) {
    if (dr.sameDayOnly && oc.night) continue;
    const yes = [], no = [];
    for (const k of keys) {
      const x = dr.f(k), y = oc.g(k);
      if (x == null || y == null) continue;
      (x ? yes : no).push(y);
    }
    if (yes.length < 4 || no.length < 4) continue;
    const diff = mean(yes) - mean(no);
    const t = diff / Math.sqrt(variance(yes) / yes.length + variance(no) / no.length || 1e-9);
    if (Math.abs(diff) < oc.min || Math.abs(t) < 1.5) continue;
    const up = diff > 0;
    let text;
    if (oc.id === 'sleep') text = `Tu dors ${h(Math.round(Math.abs(diff) / 5) * 5)} de ${up ? 'plus' : 'moins'} les nuits qui suivent ${dr.on}.`;
    else if (oc.id === 'sleepQ') text = `Ton sommeil est ${up ? 'meilleur' : 'moins bon'} (${up ? '+' : '−'}${Math.abs(diff).toFixed(1).replace('.', ',')} pt sur 5) après ${dr.on}.`;
    else text = `${oc.id === 'mood' ? 'Ton humeur est' : 'Ton énergie est'} ${up ? 'meilleure' : 'moins bonne'} ${dr.days} (${up ? '+' : '−'}${Math.abs(diff).toFixed(1).replace('.', ',')} pt sur 5).`;
    out.push({ driver: dr.id, outcome: oc.id, diff, t, nYes: yes.length, nNo: no.length, good: (dr.id === 'alcohol' || dr.id === 'late' || dr.id === 'screen' || dr.id === 'social') ? !up : up, text });
  }
  return out.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
}
