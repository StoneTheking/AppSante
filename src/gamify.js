// Motivation : quêtes du jour, série de jours (avec gel), XP, niveaux et badges.
// Mécaniques fondées sur l'auto-surveillance (Michie 2009, Harkin 2016), la gamification (Mazeas 2022, Patel 2019)
// et la formation des habitudes (Lally 2010). Tout est recalculé à partir des données : rien de « perdu ».
import * as S from './science.js';

const localKey = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const dayKeyOffset = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return localKey(d); };

// Les 5 quêtes quotidiennes, chacune alignée sur une recommandation.
export function dayGoals(st, key) {
  const d = st.days[key] || {};
  const t = S.targets(st.profile);
  const meals = st.meals.filter((m) => m.date === key);
  const tot = S.sumNutrients(meals);
  const moveMin = (d.modMin || 0) + 2 * (d.vigMin || 0) + st.workouts.filter((w) => w.date === key && !(d.modMin || d.vigMin)).reduce((a, w) => a + w.minutes, 0);
  const sleepH = d.sleepMinutes ? d.sleepMinutes / 60 : S.sleepHours(d.bed, d.wake);
  const diet = S.dietScore(tot, t);
  return [
    { id: 'move', label: 'Bouger 30 min', icon: 'steps', color: 'var(--c-move)', progress: Math.min(1, Math.max(moveMin / 30, (d.steps || 0) / t.steps)), hint: `${Math.round(moveMin)} min · ${d.steps ? d.steps + ' pas' : 'pas non renseignés'}` },
    { id: 'food', label: 'Assiette équilibrée', icon: 'salad', color: 'var(--c-food)', progress: Math.min(1, Math.max(tot.fruitVeg / t.fruitVeg, diet != null ? diet / 70 : 0)), hint: `${Math.round(tot.fruitVeg)} g de fruits & légumes` },
    { id: 'sleep', label: 'Nuit de 7 h', icon: 'moon', color: 'var(--c-sleep)', progress: sleepH ? Math.min(1, sleepH / 7) : 0, hint: sleepH ? `${S.round(sleepH, 1)} h` : 'nuit non notée' },
    { id: 'water', label: 'Bien s’hydrater', icon: 'water', color: 'var(--c-water)', progress: Math.min(1, (d.waterMl || 0) / t.waterMl), hint: `${((d.waterMl || 0) / 1000).toLocaleString('fr-FR')} / ${t.waterMl / 1000} L` },
    { id: 'mood', label: 'Check-in humeur', icon: 'smile', color: 'var(--c-mood)', progress: d.mood ? 1 : 0, hint: d.mood ? 'fait' : 'à faire' },
  ].map((g) => ({ ...g, done: g.progress >= 1 }));
}

export const VALIDATE = 3; // quêtes nécessaires pour valider la journée
const validated = (st, key) => dayGoals(st, key).filter((g) => g.done).length >= VALIDATE;

// Série : jours validés consécutifs. Un « gel » (gagné tous les 7 jours validés, 2 max) protège un jour manqué.
export function streak(st, now = new Date()) {
  const todayOk = validated(st, dayKeyOffset(0, now));
  // jours anciens → récents pour accumuler les gels dans l'ordre
  const days = [];
  for (let i = 365; i >= 1; i--) days.push(dayKeyOffset(-i, now));
  let run = 0, freezes = 0, best = 0, sinceFreeze = 0, frozenDays = [];
  for (const k of days) {
    if (validated(st, k)) {
      run++; sinceFreeze++;
      if (sinceFreeze >= 7) { freezes = Math.min(2, freezes + 1); sinceFreeze = 0; }
    } else if (run > 0 && freezes > 0) {
      freezes--; frozenDays.push(k); // la série continue
    } else { run = 0; sinceFreeze = 0; frozenDays = []; }
    best = Math.max(best, run);
  }
  const current = run + (todayOk ? 1 : 0);
  return { current, best: Math.max(best, current), todayOk, atRisk: !todayOk && run > 0, freezes, frozenDays };
}

// XP d'une journée validée : quêtes (10 chacune, +20 si journée parfaite), séances (1/min, 60 max/jour), repas notés (2, 10 max/jour).
export function xpForDay(st, key) {
  const g = dayGoals(st, key);
  const done = g.filter((x) => x.done).length;
  const sport = Math.min(60, st.workouts.filter((w) => w.date === key).reduce((a, w) => a + w.minutes, 0));
  const meals = Math.min(10, st.meals.filter((m) => m.date === key).length * 2);
  return done * 10 + (done === g.length ? 20 : 0) + sport + meals;
}

const LEVELS = ['Graine', 'Pousse', 'Jeune arbre', 'Arbre', 'Chêne', 'Forêt', 'Montagne', 'Légende'];
// niveau n atteint à 50 × n × (n − 1) XP (100, 300, 600, 1000…)
const levelOf = (xp) => { let l = 1; while (xp >= 50 * (l + 1) * l) l++; return l; };
// Journée ratée : on perd des XP pour chaque quête manquante sous le seuil, et plus le niveau est haut, plus ça coûte.
export const missPenalty = (level, done) => Math.max(0, VALIDATE - done) * 8 * level;

// Les jours passés se jouent jour par jour : journée validée = XP gagnés, journée ratée = XP perdus
// (sauf si un gel de série la protège). Aujourd'hui ne compte qu'en positif tant que la journée n'est pas finie.
export function progress(st, now = new Date()) {
  const today = dayKeyOffset(0, now);
  const keys = [...Object.keys(st.days), ...st.meals.map((m) => m.date), ...st.workouts.map((w) => w.date)].filter((k) => k < today).sort();
  const frozen = new Set(streak(st, now).frozenDays);
  let xp = 0, yesterday = 0;
  if (keys.length) {
    const d = new Date(`${keys[0]}T12:00:00`);
    const from = new Date(now); from.setDate(from.getDate() - 365);
    if (d < from) d.setTime(from.getTime());
    for (let k = localKey(d); k < today; d.setDate(d.getDate() + 1), k = localKey(d)) {
      const done = dayGoals(st, k).filter((g) => g.done).length;
      const delta = done >= VALIDATE ? xpForDay(st, k) : frozen.has(k) ? 0 : -missPenalty(levelOf(xp), done);
      xp = Math.max(0, xp + delta);
      yesterday = delta;
    }
  }
  const doneToday = dayGoals(st, today).filter((g) => g.done).length;
  const todayXp = doneToday >= VALIDATE ? xpForDay(st, today) : 0;
  const level0 = levelOf(xp);
  xp += todayXp;
  const level = levelOf(xp);
  const floor = 50 * level * (level - 1), next = 50 * (level + 1) * level;
  return {
    xp, level, title: LEVELS[Math.min(LEVELS.length - 1, level - 1)], into: xp - floor, need: next - floor,
    today: todayXp, yesterday, atStake: doneToday >= VALIDATE ? 0 : missPenalty(level0, doneToday),
  };
}

export const BADGES = [
  { id: 'first-workout', label: 'Première séance', icon: 'dumbbell', test: (st) => st.workouts.length >= 1 },
  { id: 'workouts-10', label: '10 séances', icon: 'dumbbell', test: (st) => st.workouts.length >= 10 },
  { id: 'workouts-50', label: '50 séances', icon: 'target', test: (st) => st.workouts.length >= 50 },
  { id: 'streak-3', label: 'Série de 3 jours', icon: 'flame', test: (st, s) => s.best >= 3 },
  { id: 'streak-7', label: 'Une semaine parfaite', icon: 'flame', test: (st, s) => s.best >= 7 },
  { id: 'streak-30', label: 'Série de 30 jours', icon: 'flame', test: (st, s) => s.best >= 30 },
  { id: 'habit-66', label: 'Habitude ancrée (66 j)', icon: 'leaf', test: (st, s) => s.best >= 66 },
  { id: 'meals-20', label: '20 repas notés', icon: 'utensils', test: (st) => st.meals.length >= 20 },
  { id: 'veggies', label: 'Jour 400 g de légumes', icon: 'salad', test: (st) => Object.keys(st.days).some((k) => dayGoals(st, k).find((g) => g.id === 'food').done) },
  { id: 'perfect', label: 'Journée parfaite', icon: 'sparkles', test: (st) => Object.keys(st.days).some((k) => dayGoals(st, k).every((g) => g.done)) },
  { id: 'sleep-week', label: '7 nuits notées', icon: 'moon', test: (st) => st.sleepLog.length >= 7 },
  { id: 'receipt', label: 'Premier ticket analysé', icon: 'receipt', test: (st) => st.receipts.length >= 1 },
  { id: 'scan', label: 'Premier produit scanné', icon: 'barcode', test: (st) => st.meals.some((m) => m.barcode) },
];

export function badges(st) {
  const s = streak(st);
  return BADGES.map((b) => ({ ...b, unlocked: !!b.test(st, s) }));
}

// Message du soir si la série est en jeu (pour les rappels).
export function streakReminder(st) {
  const s = streak(st);
  const goals = dayGoals(st, dayKeyOffset(0));
  const missing = goals.filter((g) => !g.done).map((g) => g.label.toLowerCase());
  if (s.todayOk) return null;
  const need = VALIDATE - goals.filter((g) => g.done).length;
  return {
    title: s.current > 0 || s.atRisk ? `🔥 Ta série est en jeu !` : '🔥 Lance ta série aujourd’hui',
    body: `Encore ${need} quête${need > 1 ? 's' : ''} : ${missing.slice(0, 3).join(', ')}.`,
  };
}
