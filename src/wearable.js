// Données de montre (Fitbit, Galaxy Watch, Pixel Watch… via Health Connect) : phases du sommeil,
// cœur minute par minute (zones d'effort, cœur pendant la nuit) et « forme du jour » (récupération).
// Fonctions pures : elles ne dépendent ni de Capacitor ni du stockage (testées dans tests/wearable.test.js).

const localKey = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => { const m = mean(xs); return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : null; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Applications connues qui écrivent dans Health Connect (nom affiché).
export const SOURCES = {
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'capteur du téléphone',
  'com.withings.wiscale2': 'Withings',
  'com.garmin.android.apps.connectmobile': 'Garmin',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.huawei.health': 'Huawei Santé',
  'com.ouraring.oura': 'Oura',
  'com.polar.polarflow': 'Polar',
  android: 'capteur du téléphone',
};
export const sourceLabel = (id, name) => SOURCES[id] || (/fitbit/i.test(`${id} ${name}`) ? 'Fitbit' : name && name !== id ? name : id) || '?';
export const isFitbit = (s) => /fitbit/i.test(`${s?.sourceId || ''} ${s?.sourceName || ''}`);

// ---------- Sommeil ----------
// Sessions Health Connect → une nuit par jour de réveil : horaires, temps endormi, phases (profond, paradoxal,
// léger), éveils, efficacité. Plusieurs applis peuvent écrire la même nuit : on garde la plus détaillée
// (avec phases, puis la plus longue) au lieu de les additionner. Les siestes sont comptées à part.
export function nightsFromSessions(samples = []) {
  const groups = {};
  for (const s of samples) {
    const start = new Date(s.startDate).getTime(), end = new Date(s.endDate).getTime();
    if (!(end > start)) continue;
    const src = s.sourceId || s.sourceName || '?';
    const k = localKey(new Date(end));
    const durH = (end - start) / 3600e3;
    const endH = new Date(end).getHours() + new Date(end).getMinutes() / 60;
    const nap = durH < 3 && endH >= 10 && endH < 20; // sieste : courte et terminée en journée
    (groups[`${k}|${nap ? 'nap' : 'night'}|${src}`] ||= { k, nap, src, name: s.sourceName, items: [] }).items.push({ s, start, end });
  }
  const nights = {}, naps = {};
  for (const g of Object.values(groups)) {
    const n = summarizeNight(g.items);
    n.source = sourceLabel(g.src, g.name);
    if (g.nap) { const cur = naps[g.k]; if (!cur || n.asleep > cur.asleep) naps[g.k] = n; continue; }
    const cur = nights[g.k];
    const better = !cur || (n.staged && !cur.staged) || (n.staged === cur.staged && n.asleep > cur.asleep);
    if (better) nights[g.k] = n;
  }
  const out = {};
  for (const [k, n] of Object.entries(nights)) {
    if (n.end - n.start < 3 * 3600e3) continue; // trop court pour être la nuit principale
    out[k] = {
      bed: hhmm(n.start), wake: hhmm(n.end), sleepMinutes: Math.round(n.asleep), sleepSource: n.source,
      inBedMin: Math.round((n.end - n.start) / 60000),
      sleepEfficiency: Math.round((n.asleep / ((n.end - n.start) / 60000)) * 100),
      sleepStart: new Date(n.start).toISOString(), sleepEnd: new Date(n.end).toISOString(),
      ...(n.staged ? { deepMin: Math.round(n.deep), remMin: Math.round(n.rem), lightMin: Math.round(n.light), awakeMin: Math.round(n.awake), wakeups: n.wakeups } : {}),
    };
  }
  for (const [k, n] of Object.entries(naps)) if (n.asleep >= 10) (out[k] ||= {}).napMin = Math.round(n.asleep);
  return out;
}

function summarizeNight(items) {
  const n = { start: Infinity, end: -Infinity, asleep: 0, deep: 0, rem: 0, light: 0, awake: 0, wakeups: 0, staged: false };
  for (const { s, start, end } of items) {
    n.start = Math.min(n.start, start); n.end = Math.max(n.end, end);
    const stages = (s.stages || []).map((x) => ({ ...x, a: new Date(x.startDate).getTime(), b: new Date(x.endDate).getTime() })).filter((x) => x.b > x.a).sort((x, y) => x.a - y.a);
    if (stages.length) {
      n.staged = n.staged || stages.some((x) => ['deep', 'rem', 'light'].includes(x.stage));
      stages.forEach((x, i) => {
        const m = (x.b - x.a) / 60000;
        if (x.stage === 'awake' || x.stage === 'inBed') {
          n.awake += m;
          // éveil nocturne : plus de 5 min, ni au tout début ni à la toute fin de la nuit (critère Ohayon 2017)
          if (m >= 5 && i > 0 && i < stages.length - 1) n.wakeups++;
        } else {
          n.asleep += m;
          if (x.stage === 'deep') n.deep += m; else if (x.stage === 'rem') n.rem += m; else if (x.stage === 'light') n.light += m;
        }
      });
    } else if (s.sleepState) { // relevés déjà découpés par phase (une ligne par phase)
      const m = (end - start) / 60000;
      if (['awake', 'inBed'].includes(s.sleepState)) n.awake += m;
      else { n.asleep += m; if (['deep', 'rem', 'light'].includes(s.sleepState)) { n.staged = true; n[s.sleepState] += m; } }
    } else n.asleep += s.value || (end - start) / 60000;
  }
  return n;
}

// ---------- Cœur minute par minute ----------
// Relevés de fréquence cardiaque → moyenne par minute : Map(début de la minute en ms → bpm).
export function hrByMinute(samples = []) {
  const acc = new Map();
  for (const s of samples) {
    const v = s.value;
    if (!(v >= 30 && v <= 230)) continue; // valeurs aberrantes du capteur
    const t = Math.floor(new Date(s.startDate).getTime() / 60000) * 60000;
    const a = acc.get(t) || [0, 0];
    a[0] += v; a[1]++;
    acc.set(t, a);
  }
  return new Map([...acc].sort((x, y) => x[0] - y[0]).map(([t, [s, n]]) => [t, s / n]));
}

// Minutes passées en zone d'effort, par jour local : modérée (64–76 % de la FC max) et soutenue (≥ 77 %),
// les seuils OMS/ACSM utilisés pour les zones de l'appli. Seules les périodes d'au moins 3 minutes d'affilée
// au-dessus de 64 % comptent (une montée isolée — stress, escalier — n'est pas une activité) ; un trou d'une
// minute sans relevé ne coupe pas la période.
export function zoneMinutes(byMin, hrMax) {
  const out = {};
  if (!hrMax) return out;
  const modT = hrMax * 0.64, vigT = hrMax * 0.77;
  let bout = [], lastT = null;
  const flush = () => {
    if (bout.length >= 3) for (const [t, v] of bout) {
      const d = (out[localKey(new Date(t))] ||= { zoneMod: 0, zoneVig: 0, peakMin: 0 });
      if (v >= vigT) d.zoneVig++; else d.zoneMod++;
      if (v >= hrMax * 0.85) d.peakMin++;
    }
    bout = [];
  };
  for (const [t, v] of byMin) {
    if (lastT != null && t - lastT > 2 * 60000) flush();
    if (v >= modT) bout.push([t, v]); else flush();
    lastT = t;
  }
  flush();
  return out;
}

// Cœur pendant la nuit (entre l'heure d'endormissement et le réveil) : moyenne et plus bas (moyenne glissante
// sur 5 min, moins sensible à un relevé isolé). L'alcool, un repas tardif, la fièvre ou le surentraînement le font monter.
export function nightHR(byMin, startMs, endMs) {
  const xs = [...byMin].filter(([t]) => t >= startMs && t <= endMs).map(([, v]) => v);
  if (xs.length < 30) return null;
  let low = Infinity;
  for (let i = 0; i + 5 <= xs.length; i++) low = Math.min(low, mean(xs.slice(i, i + 5)));
  return { sleepHR: Math.round(mean(xs)), sleepHRMin: Math.round(low) };
}

// ---------- Minutes d'activité ----------
// Séances enregistrées ou minutes en zone cardiaque (montre) : on garde la source qui compte le plus
// (en équivalent modéré, 1 min soutenue = 2 min modérées), sans additionner les deux — la même séance
// apparaît souvent dans chacune.
export function activeMin(d = {}) {
  const a = { mod: d.modMin || 0, vig: d.vigMin || 0 };
  const b = { mod: d.zoneMod || 0, vig: d.zoneVig || 0 };
  return b.mod + 2 * b.vig > a.mod + 2 * a.vig ? b : a;
}
export const modOf = (d) => activeMin(d).mod;
export const vigOf = (d) => activeMin(d).vig;

// ---------- Forme du jour (récupération) ----------
// Compare la nuit et le cœur de ce matin à TES valeurs habituelles (28 jours précédents), comme le
// « Daily Readiness » des montres : variabilité cardiaque (plus haute = mieux récupéré), FC de repos et cœur
// de la nuit (plus bas = mieux), durée et efficacité du sommeil, charge d'effort de la veille.
// Renvoie null tant qu'il n'y a pas assez d'historique pour une comparaison fiable.
export function readiness(days, key, { need = { min: 7, max: 9 } } = {}) {
  const d = days[key] || {};
  const prior = Array.from({ length: 28 }, (_, i) => { const x = new Date(key + 'T12:00'); x.setDate(x.getDate() - 1 - i); return days[localKey(x)] || {}; });
  const parts = [];
  const z = (field, higherBetter, label, unit, w) => {
    const v = d[field];
    const hist = prior.map((x) => x[field]).filter((x) => x > 0);
    if (!(v > 0) || hist.length < 7) return;
    const m = mean(hist), s = Math.max(sd(hist) || 0, m * 0.04); // écart-type plancher : évite qu'un écart minime pèse trop
    const zz = clamp(((v - m) / s) * (higherBetter ? 1 : -1), -2.5, 2.5);
    parts.push({ k: field, label, value: Math.round(v), usual: Math.round(m), unit, score: 70 + zz * 20, w, z: zz });
  };
  z('hrv', true, 'Variabilité cardiaque', 'ms', 0.35);
  z('restingHR', false, 'Cœur au repos', 'bpm', 0.25);
  z('sleepHR', false, 'Cœur pendant la nuit', 'bpm', 0.1);
  if (d.sleepMinutes) {
    const h = d.sleepMinutes / 60;
    const dur = h >= need.min ? 100 : clamp(100 - (need.min - h) * 30, 0, 100);
    parts.push({ k: 'sleep', label: 'Durée du sommeil', value: Math.round(h * 10) / 10, usual: need.min, unit: 'h', score: dur, w: 0.2 });
    if (d.sleepEfficiency) parts.push({ k: 'eff', label: 'Efficacité du sommeil', value: d.sleepEfficiency, usual: 85, unit: '%', score: clamp(100 - (85 - d.sleepEfficiency) * 5, 0, 100), w: 0.1 });
  }
  const y = prior[0];
  const load = vigOf(y) * 2 + modOf(y);
  // seulement une grosse journée d'effort compte (elle demande de la récupération)
  if (load > 60) parts.push({ k: 'load', label: 'Effort d’hier', value: load, usual: 60, unit: 'min', score: clamp(100 - Math.max(0, load - 60) * 0.5, 30, 100), w: 0.1 });
  // il faut au moins un signal cardiaque comparé à ta référence, sinon ce n'est qu'un score de sommeil
  if (!parts.some((p) => ['hrv', 'restingHR', 'sleepHR'].includes(p.k))) return null;
  const den = parts.reduce((a, p) => a + p.w, 0);
  const score = Math.round(clamp(parts.reduce((a, p) => a + clamp(p.score, 0, 100) * p.w, 0) / den, 0, 100));
  const level = score >= 70 ? 'haute' : score >= 50 ? 'moyenne' : 'basse';
  const worst = [...parts].sort((a, b) => a.score - b.score)[0];
  const advice = level === 'haute' ? 'Bien récupéré : bonne journée pour une séance soutenue ou du fractionné.'
    : level === 'moyenne' ? 'Récupération correcte : séance prévue possible, sans chercher la performance.'
      : `Récupération faible (${worst.label.toLowerCase()} en retrait) : privilégie une activité douce (marche, mobilité) et une nuit complète.`;
  return { score, level, parts, advice };
}

// ---------- Analyse des phases du sommeil ----------
// Moyennes de la semaine et constats (repères : profond 13–23 %, paradoxal 20–25 % du sommeil chez l'adulte ;
// efficacité ≥ 85 % et au plus un éveil de plus de 5 min, Ohayon 2017).
export function stageSummary(nights) {
  const st = nights.filter((d) => d.deepMin != null && d.sleepMinutes > 0);
  const eff = nights.map((d) => d.sleepEfficiency).filter((x) => x > 0);
  if (!st.length && !eff.length) return null;
  const pct = (f) => (st.length ? Math.round(mean(st.map((d) => (d[f] / d.sleepMinutes) * 100))) : null);
  return {
    nights: st.length,
    deepPct: pct('deepMin'), remPct: pct('remMin'), lightPct: pct('lightMin'),
    deepMin: st.length ? Math.round(mean(st.map((d) => d.deepMin))) : null,
    remMin: st.length ? Math.round(mean(st.map((d) => d.remMin))) : null,
    wakeups: st.length ? Math.round(mean(st.map((d) => d.wakeups || 0)) * 10) / 10 : null,
    efficiency: eff.length ? Math.round(mean(eff)) : null,
  };
}
