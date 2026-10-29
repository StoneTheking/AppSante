// Sport : catalogue d'activités, dépense énergétique, zones cardiaques, plan de la semaine, séances.
import * as store from './store.js';
import { age as ageOf } from './science.js';

// MET de référence d'après le Compendium 2024 des activités physiques (valeurs typiques d'intensité modérée).
export const ACTIVITIES = [
  { id: 'marche', label: 'Marche rapide', icon: 'steps', met: 4.3, kind: 'cardio' },
  { id: 'course', label: 'Course à pied', icon: 'activity', met: 9.8, kind: 'cardio' },
  { id: 'velo', label: 'Vélo', icon: 'bike', met: 6.8, kind: 'cardio' },
  { id: 'natation', label: 'Natation', icon: 'water', met: 6.0, kind: 'cardio' },
  { id: 'renfo', label: 'Musculation / renforcement', icon: 'dumbbell', met: 5.0, kind: 'renfo' },
  { id: 'hiit', label: 'Fractionné (HIIT)', icon: 'zap', met: 8.0, kind: 'cardio' },
  { id: 'yoga', label: 'Yoga / mobilité', icon: 'brain', met: 2.5, kind: 'souplesse' },
  { id: 'randonnee', label: 'Randonnée', icon: 'leaf', met: 6.0, kind: 'cardio' },
  { id: 'collectif', label: 'Sport collectif', icon: 'users', met: 7.0, kind: 'cardio' },
  { id: 'raquette', label: 'Tennis / padel / badminton', icon: 'target', met: 6.8, kind: 'cardio' },
  { id: 'danse', label: 'Danse', icon: 'sparkles', met: 5.0, kind: 'cardio' },
  { id: 'autre', label: 'Autre activité', icon: 'activity', met: 4.0, kind: 'cardio' },
];
export const activity = (id) => ACTIVITIES.find((a) => a.id === id) || ACTIVITIES.at(-1);

export const INTENSITY = {
  legere: { label: 'Légère', factor: 0.75, talk: 'tu peux chanter' },
  moderee: { label: 'Modérée', factor: 1, talk: 'tu peux parler, pas chanter' },
  intense: { label: 'Intense', factor: 1.3, talk: 'quelques mots seulement' },
};

// Dépense ≈ MET × poids (kg) × durée (h).
export function kcal(activityId, intensity, minutes, weightKg = 70) {
  const met = activity(activityId).met * (INTENSITY[intensity]?.factor || 1);
  return Math.round(met * weightKg * (minutes / 60));
}

// Classe OMS : intense ≥ 6 MET, modérée 3–5,9 MET.
export function whoClass(activityId, intensity) {
  const met = activity(activityId).met * (INTENSITY[intensity]?.factor || 1);
  return met >= 6 ? 'vig' : met >= 3 ? 'mod' : 'light';
}

// Zones cardiaques : FC max = 208 − 0,7 × âge (Tanaka 2001).
export function hrZones(birthYear) {
  const max = Math.round(208 - 0.7 * ageOf(birthYear));
  return { max, mod: [Math.round(max * 0.64), Math.round(max * 0.76)], vig: [Math.round(max * 0.77), Math.round(max * 0.95)] };
}

// Recalcule les minutes d'activité d'une journée à partir des séances enregistrées.
export function recomputeDay(s, date) {
  const list = s.workouts.filter((w) => w.date === date);
  if (!list.length) return;
  const tot = { modMin: 0, vigMin: 0, strengthMin: 0 };
  for (const w of list) {
    const c = whoClass(w.type, w.intensity);
    if (c === 'vig') tot.vigMin += w.minutes;
    else if (c === 'mod') tot.modMin += w.minutes;
    if (activity(w.type).kind === 'renfo') tot.strengthMin += w.minutes;
  }
  s.days[date] = { ...(s.days[date] || {}), ...tot };
}

const localKey = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function addWorkout(w) {
  const weight = store.get().profile.weight || 70;
  const start = new Date(w.start);
  const entry = { id: w.id || crypto.randomUUID(), type: w.type, intensity: w.intensity || 'moderee', start: start.toISOString(), date: localKey(start), minutes: Math.max(1, Math.round(w.minutes)), kcal: w.kcal ?? kcal(w.type, w.intensity, w.minutes, weight), note: w.note || '', source: w.source || 'manuel' };
  store.update((s) => {
    s.workouts = [...s.workouts.filter((x) => x.id !== entry.id), entry];
    recomputeDay(s, entry.date);
  });
  return entry;
}

export function removeWorkout(id) {
  store.update((s) => {
    const w = s.workouts.find((x) => x.id === id);
    s.workouts = s.workouts.filter((x) => x.id !== id);
    if (w) {
      if (s.workouts.some((x) => x.date === w.date)) recomputeDay(s, w.date);
      else s.days[w.date] = { ...(s.days[w.date] || {}), modMin: 0, vigMin: 0, strengthMin: 0 };
    }
  });
}

// ---------- Chronomètre ----------
export function startWorkout(type, intensity = 'moderee') {
  store.update((s) => { s.workoutNow = { type, intensity, start: new Date().toISOString() }; });
}
export function stopWorkout() {
  const cur = store.get().workoutNow;
  if (!cur) return null;
  const minutes = (Date.now() - new Date(cur.start)) / 60000;
  store.update((s) => { s.workoutNow = null; });
  if (minutes < 1) return null;
  return addWorkout({ ...cur, minutes, source: 'chrono' });
}

// ---------- Semaine ----------
export function weekStats(workouts, days, now = new Date()) {
  const keys = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - i); return localKey(d); });
  const sum = (f) => keys.reduce((a, k) => a + (Number(days[k]?.[f]) || 0), 0);
  const mod = sum('modMin'), vig = sum('vigMin');
  return {
    modEq: mod + 2 * vig,
    mod,
    vig,
    strengthSessions: keys.filter((k) => (days[k]?.strengthMin || 0) > 0).length,
    sessions: workouts.filter((w) => keys.includes(w.date)),
    kcal: workouts.filter((w) => keys.includes(w.date)).reduce((a, w) => a + (w.kcal || 0), 0),
  };
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
// Semaine type selon l'objectif (OMS : 150–300 min modérées + 2 séances de renforcement ; ACSM : 48 h entre deux séances d'un même muscle).
const TEMPLATES = {
  perdre: [['cardio', 40, 'moderee'], ['renfo', 35, 'moderee'], ['marche', 45, 'moderee'], ['renfo', 35, 'moderee'], ['hiit', 20, 'intense'], ['randonnee', 75, 'moderee'], ['yoga', 25, 'legere']],
  maintenir: [['cardio', 35, 'moderee'], ['renfo', 40, 'moderee'], ['yoga', 25, 'legere'], ['hiit', 20, 'intense'], ['renfo', 40, 'moderee'], ['loisir', 60, 'moderee'], ['marche', 30, 'legere']],
  prendre: [['renfo', 50, 'intense'], ['cardio', 25, 'moderee'], ['renfo', 50, 'intense'], ['yoga', 25, 'legere'], ['renfo', 50, 'intense'], ['loisir', 45, 'moderee'], ['repos', 0, 'legere']],
};
const PREFERRED = { course: 'course', courir: 'course', running: 'course', footing: 'course', velo: 'velo', vélo: 'velo', natation: 'natation', nage: 'natation', piscine: 'natation', tennis: 'raquette', padel: 'raquette', badminton: 'raquette', foot: 'collectif', basket: 'collectif', hand: 'collectif', rugby: 'collectif', volley: 'collectif', danse: 'danse', yoga: 'yoga', muscu: 'renfo', musculation: 'renfo', rando: 'randonnee', marche: 'marche', crossfit: 'hiit' };

export function preferredActivity(profile) {
  const p = (profile.preferredSport || '').toLowerCase();
  const hit = Object.keys(PREFERRED).find((k) => p.includes(k));
  return hit ? PREFERRED[hit] : null;
}

export function weekPlan(profile, workouts, now = new Date(), days = {}) {
  const fav = preferredActivity(profile);
  const tpl = TEMPLATES[profile.goal] || TEMPLATES.maintenir;
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return tpl.map(([slot, minutes, intensity], i) => {
    const d = new Date(monday); d.setDate(d.getDate() + i);
    const date = localKey(d);
    const type = slot === 'cardio' ? fav && activity(fav).kind === 'cardio' ? fav : 'course' : slot === 'loisir' ? fav || 'velo' : slot === 'repos' ? null : slot;
    const done = workouts.filter((w) => w.date === date);
    // séance enregistrée du même type, ou minutes saisies à la main / synchronisées pour ce jour
    const d0 = days[date] || {};
    const matches = done.some((w) => !type || activity(w.type).kind === activity(type).kind) || (type && (activity(type).kind === 'renfo' ? d0.strengthMin > 0 : (d0.modMin || 0) + (d0.vigMin || 0) >= minutes * 0.6));
    return { day: DAYS[i], date, type, minutes, intensity, done, matches, today: date === localKey(now), past: d < new Date(now.toDateString()) };
  });
}
