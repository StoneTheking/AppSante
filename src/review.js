// Bilan du dimanche : la semaine résumée, les progrès par pilier, et un seul objectif mesurable pour la semaine suivante.
// Un objectif unique, précis et suivi chaque jour est plus efficace qu'une liste de résolutions (Harkin 2016).
import * as C from './coach.js';
import { sleepHours, sumNutrients } from './science.js';

const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const daysEnding = (end, n) => Array.from({ length: n }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (n - 1) + i); return key(d); });
const shift = (k, n) => { const d = new Date(k + 'T12:00'); d.setDate(d.getDate() + n); return key(d); };
const sleepMin = (d) => (d?.sleepMinutes ? d.sleepMinutes : sleepHours(d?.bed, d?.wake) != null ? sleepHours(d.bed, d.wake) * 60 : null);
const toMin = (hhmm) => { const [h, m] = (hhmm || '00:00').split(':').map(Number); return h * 60 + m; };

// Objectifs possibles : test(jour) dit si la journée compte ; target = nombre de jours visés sur 7.
export const GOALS = {
  sleep7: { pillar: 'sommeil', target: 5, text: () => 'Dormir 7 h ou plus au moins 5 nuits', test: (d) => (sleepMin(d) != null ? sleepMin(d) >= 420 : null) },
  bedReg: { pillar: 'sommeil', target: 5, text: (g, p) => `Te coucher vers ${p.bedTime} (±30 min) au moins 5 soirs`, test: (d, g, p) => { if (!d.bed) return null; const x = Math.abs(toMin(d.bed) - toMin(p.bedTime)); return Math.min(x, 1440 - x) <= 30; } },
  steps: { pillar: 'activite', target: 4, text: (g) => `Faire ${g.value.toLocaleString('fr-FR')} pas au moins 4 jours`, test: (d, g) => (d.steps != null ? d.steps >= g.value : null) },
  strength: { pillar: 'activite', target: 2, text: () => 'Faire 2 séances de renforcement', test: (d) => (d.strengthMin != null ? d.strengthMin > 0 : null) },
  logMeals: { pillar: 'alimentation', target: 5, text: () => 'Noter au moins 2 repas par jour, 5 jours', test: (d, g, p, meals) => meals.filter((m) => !m.snack).length >= 2 },
  veg: { pillar: 'alimentation', target: 4, text: () => '400 g de fruits et légumes au moins 4 jours', test: (d, g, p, meals) => (meals.length ? sumNutrients(meals).fruitVeg >= 400 : null) },
  active30: { pillar: 'humeur', target: 4, text: () => 'Bouger 30 min au moins 4 jours (le levier le mieux prouvé sur le moral)', test: (d) => ((d.modMin || 0) + (d.vigMin || 0) + (d.strengthMin || 0) >= 30 || (d.steps || 0) >= 8000) },
  screen: { pillar: 'numerique', target: 5, text: (g) => `Moins de ${Math.floor(g.value / 60)} h${g.value % 60 ? ' ' + String(g.value % 60).padStart(2, '0') : ''} d’écran par jour, 5 jours`, test: (d, g) => (d.screenMin != null ? d.screenMin <= g.value : null) },
};

// Objectif conseillé pour le pilier le plus faible.
export function pickGoal(pillar, sm) {
  const { w, t } = sm;
  if (pillar === 'sommeil') return w.sleepH != null && w.sleepH >= 7 ? { kind: 'bedReg' } : { kind: 'sleep7' };
  if (pillar === 'activite') return (w.steps || 0) < t.steps ? { kind: 'steps', value: Math.min(t.steps, Math.max(5000, Math.round(((w.steps || 4000) + 1500) / 500) * 500)) } : { kind: 'strength' };
  if (pillar === 'alimentation') return sm.dietDaysCount < 5 ? { kind: 'logMeals' } : { kind: 'veg' };
  if (pillar === 'humeur') return { kind: 'active30' };
  return { kind: 'screen', value: Math.max(60, Math.round(((w.screenMin || 180) - 30) / 15) * 15) };
}

export function weekReview(st, now = new Date()) {
  const cur = C.summarize(st, daysEnding(now, 14));
  const before = new Date(now); before.setDate(before.getDate() - 7);
  const prev = C.summarize(st, daysEnding(before, 14));
  const order = ['sommeil', 'activite', 'alimentation', 'humeur', 'numerique'];
  const pillars = order.map((k) => ({ k, v: cur.scores[k], prev: prev.scores[k], delta: cur.scores[k] != null && prev.scores[k] != null ? cur.scores[k] - prev.scores[k] : null }));
  const known = pillars.filter((p) => p.v != null);
  const weakest = [...known].sort((a, b) => a.v - b.v)[0]?.k || 'activite';
  const best = [...pillars].filter((p) => p.delta != null && p.delta > 0).sort((a, b) => b.delta - a.delta)[0] || null;
  const week = daysEnding(now, 7);
  const goal = pickGoal(weakest, cur);
  return {
    global: cur.scores.global,
    prevGlobal: prev.scores.global,
    pillars,
    best,
    weakest,
    stats: {
      sleepH: cur.w.sleepH,
      steps: cur.w.steps,
      sessions: (st.workouts || []).filter((x) => week.includes(x.date)).length,
      mealDays: week.filter((k) => (st.meals || []).some((m) => m.date === k)).length,
      mood: cur.w.mood,
      screenMin: cur.w.screenMin,
    },
    goal: { ...goal, pillar: GOALS[goal.kind].pillar, target: GOALS[goal.kind].target, text: GOALS[goal.kind].text(goal, st.profile) },
  };
}

// Le bilan est proposé le dimanche à partir de 17 h, et le lundi s'il n'a pas été vu. Renvoie l'id de la semaine (date du dimanche).
export function reviewDue(st, now = new Date()) {
  const dow = now.getDay();
  const sunday = dow === 0 ? key(now) : dow === 1 ? shift(key(now), -1) : null;
  if (!sunday || (dow === 0 && now.getHours() < 17)) return null;
  return st.reviewSeen === sunday ? null : sunday;
}

// Avancement de l'objectif de la semaine : jours réussis entre le début et aujourd'hui.
export function goalProgress(st, goal, now = new Date()) {
  if (!goal) return null;
  const G = GOALS[goal.kind];
  const days = Array.from({ length: 7 }, (_, i) => shift(goal.start, i)).filter((k) => k <= key(now));
  const ok = days.filter((k) => G.test(st.days[k] || {}, goal, st.profile, (st.meals || []).filter((m) => m.date === k)) === true).length;
  const end = shift(goal.start, 6);
  return { ok, target: goal.target, days: days.length, done: ok >= goal.target, over: key(now) > end, end };
}
