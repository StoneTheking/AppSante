// Données dérivées partagées entre les vues.
import * as store from './store.js';
import * as S from './science.js';
import * as C from './coach.js';
import * as R from './reminders.js';
import { fmt } from './ui.js';
import * as F from './family.js';
import * as D from './digestion.js';
import * as E from './env.js';
import { pantryText } from './pantry.js';

export const taste = () => F.tasteProfile(store.get().profile, store.get().meals);

// Rafraîchit air & météo (au plus toutes les heures) si un lieu est défini.
export async function refreshEnv(force = false) {
  const st = store.get();
  if (!st.location) return null;
  if (!force && st.env && Date.now() - new Date(st.env.fetched) < 3600e3) return st.env;
  try {
    const env = await E.fetchEnv(st.location);
    store.update((s) => { s.env = env; });
    return env;
  } catch { return st.env; }
}

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
    `Foyer : ${F.describeHousehold(profile, st.household)}`,
    (() => { const t = F.topTastes(taste()); return `Goûts : aime ${[profile.likes, ...t.likes].filter(Boolean).join(', ') || 'non renseigné'} ; n'aime pas ${[profile.dislikes, ...t.dislikes].filter(Boolean).join(', ') || 'non renseigné'} ; cuisines préférées : ${(profile.cuisines || []).join(', ') || 'non renseignées'}.`; })(),
    st.pantry.length ? `Garde-manger (d'après les tickets de caisse) : ${pantryText(st.pantry)}` : 'Garde-manger : inconnu',
    sm.env ? `Environnement (${sm.env.place}) : air ${E.aqiLabel(sm.env.aqi).label} (indice européen ${Math.round(sm.env.aqi)}, PM2,5 ${Math.round(sm.env.pm25)} µg/m³), ${Math.round(sm.env.temp)} °C (max ${Math.round(sm.env.tMax)}, nuit ${Math.round(sm.env.tMin)}), UV max ${Math.round(sm.env.uvMax)}, lever ${sm.env.sunrise}, coucher ${sm.env.sunset}${sm.env.pollen[0] ? `, pollen dominant ${sm.env.pollen[0].name} (${Math.round(sm.env.pollen[0].value)} grains/m³)` : ''}.` : 'Environnement : lieu non renseigné',
    (() => { const d = D.digestionSummary(st.stools); if (!d) return 'Transit : non suivi'; const sus = D.suspects(st.stools, st.meals); return `Transit (14 j) : ${d.perWeek} selles/semaine, types Bristol lents ${d.zones.lent}, normaux ${d.zones.ok}, rapides ${d.zones.rapide}${sus.length ? ` ; aliments suspects : ${sus.map((x) => `${x.word} (${x.bad}/${x.total})`).join(', ')}` : ''}.`; })(),
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
