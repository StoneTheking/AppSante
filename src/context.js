// Données dérivées partagées entre les vues.
import * as store from './store.js';
import * as S from './science.js';
import * as C from './coach.js';
import * as R from './reminders.js';
import { fmt } from './ui.js';

export function summary() {
  return C.summarize(store.get(), store.lastDays(14));
}

// Contexte textuel transmis à l'IA (profil + 7 derniers jours + repas du jour).
export function personContext(sm = summary()) {
  const st = store.get();
  const { profile } = st;
  const days = store.lastDays(7).map((k) => {
    const d = st.days[k] || {};
    const tot = S.sumNutrients(store.mealsOn(k));
    const extra = [d.restingHR && `FC repos ${d.restingHR} bpm`, d.hrv && `VFC ${d.hrv} ms`, d.lateMin != null && `écran après 22 h ${d.lateMin} min`].filter(Boolean).join(', ');
    return `${k}: sommeil ${d.bed || '?'}→${d.wake || '?'}${d.sleepMinutes ? ` (${Math.round(d.sleepMinutes / 6) / 10} h endormi)` : ''} qualité ${d.sleepQuality ?? '?'}/5, humeur ${d.mood ?? '?'}/5, énergie ${d.energy ?? '?'}/5, stress ${d.stress ?? '?'}/5, pas ${d.steps ?? '?'}, activité modérée ${d.modMin ?? 0} min, intense ${d.vigMin ?? 0} min, renfo ${d.strengthMin ?? 0} min, écran ${d.screenMin ?? '?'} min dont réseaux sociaux ${d.socialMin ?? '?'} min, déverrouillages ${d.unlocks ?? '?'}, téléphone au lit ${d.phoneInBed ? 'oui' : 'non'}, alcool ${d.alcohol ?? 0}, eau ${d.waterMl ?? '?'} mL, apports ${Math.round(tot.kcal)} kcal${extra ? ', ' + extra : ''}`;
  });
  const meals = store.mealsOn().map((m) => `${m.time} ${m.title} (${Math.round(m.nutrients?.kcal || 0)} kcal, prot ${Math.round(m.nutrients?.protein || 0)} g, fibres ${Math.round(m.nutrients?.fiber || 0)} g${m.nutriscore ? `, Nutri-Score ${m.nutriscore.toUpperCase()}` : ''})`);
  return [
    `Date et heure : ${new Date().toLocaleString('fr-FR')}`,
    `Profil : ${profile.name || 'utilisateur'}, ${profile.sex === 'f' ? 'femme' : 'homme'}, ${sm.body.age} ans, ${profile.height || '?'} cm, ${fmt(sm.body.weight, 1)} kg (IMC ${fmt(sm.body.bmi, 1)}, ${sm.body.bmiCat}), tour de taille ${profile.waist || '?'} cm, activité ${profile.activityLevel}, objectif « ${profile.goal} », régime ${profile.diet}, allergies/aversions : ${profile.allergies || 'aucune'}, pathologies/traitements : ${profile.conditions || 'aucun déclaré'}, fumeur : ${profile.smoker ? 'oui' : 'non'}, sport préféré : ${profile.preferredSport || 'non précisé'}, réveil ${profile.wakeTime}, coucher ${profile.bedTime}.`,
    `Besoins estimés : métabolisme de base ${fmt(sm.body.bmr)} kcal, dépense ${fmt(sm.body.tdee)} kcal, cible ${sm.t.kcal} kcal, protéines ${sm.t.protein} g, fibres ${sm.t.fiber} g, sucres libres < ${sm.t.sugarMax} g, sodium < ${sm.t.sodiumMax} mg, fruits & légumes ≥ ${sm.t.fruitVeg} g.`,
    `Consommé aujourd'hui : ${Math.round(sm.totToday.kcal)} kcal, protéines ${Math.round(sm.totToday.protein)} g, fibres ${Math.round(sm.totToday.fiber)} g, sucres ${Math.round(sm.totToday.sugar)} g, sodium ${Math.round(sm.totToday.sodium)} mg, fruits & légumes ${Math.round(sm.totToday.fruitVeg)} g.`,
    `Repas du jour : ${meals.join(' ; ') || 'aucun'}`,
    `Scores (0-100) : ${Object.entries(sm.scores).map(([k, v]) => `${k} ${v ?? '?'}`).join(', ')}`,
    `7 derniers jours :\n${days.join('\n')}`,
  ].join('\n');
}

// Recalcule et reprogramme les rappels (aujourd'hui + demain).
export async function refreshReminders() {
  const st = store.get();
  const rs = st.settings.reminders;
  if (!rs.enabled) return R.schedule([]);
  const sm = summary();
  const today = C.dailyPlan(sm, st.profile);
  const tomorrow = C.dailyPlan({ ...sm, today: {}, lastNight: null, ctx: { ...sm.ctx, workout: false } }, st.profile);
  return R.schedule(R.buildReminders([today, tomorrow], rs));
}
