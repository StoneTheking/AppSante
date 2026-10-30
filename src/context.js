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
import * as SP from './sport.js';
import * as G from './gamify.js';
import { weighDue } from './energy.js';

export const taste = () => F.tasteProfile(store.get().profile, store.get().meals);

// Rafraîchit air & météo (au plus toutes les heures) si un lieu est défini.
export async function refreshEnv(force = false) {
  const st = store.get();
  if (!st.location) return null;
  // air et météo : rafraîchis toutes les 10 min ; « Ma position » suit l'endroit où l'on se trouve
  if (!force && st.env && Date.now() - new Date(st.env.fetched) < 10 * 60e3) return st.env;
  try {
    let loc = st.location;
    if (loc.auto || loc.name === 'Ma position') {
      const p = await E.currentPosition(10 * 60e3).catch(() => null);
      if (p && (p.lat !== loc.lat || p.lon !== loc.lon)) { loc = p; store.update((s) => { s.location = p; }); }
    }
    const env = await E.fetchEnv(loc);
    store.update((s) => { s.env = env; });
    return env;
  } catch { return st.env; }
}

export function summary() {
  return C.summarize(store.get(), store.lastDays(14));
}

// Moment de la journée, explicite pour que les conseils collent à l'heure (pas de petit-déj proposé à 21 h).
export function momentOfDay(profile = {}, now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes();
  const hm = (s, def) => { const [h, mi] = String(s || def).split(':').map(Number); return h * 60 + (mi || 0); };
  const wake = hm(profile.wakeTime, '07:00');
  let bed = hm(profile.bedTime, '23:00');
  if (bed < wake) bed += 24 * 60;
  const mm = m < wake - 120 ? m + 24 * 60 : m; // après minuit : encore la nuit de la veille
  const name = mm < wake ? 'nuit (avant le réveil prévu)' : m < 11 * 60 ? 'matin' : m < 14 * 60 ? 'midi' : m < 18 * 60 ? 'après-midi' : mm < bed - 90 ? 'soirée' : mm < bed ? 'fin de soirée, coucher proche' : 'nuit (après l’heure de coucher prévue)';
  const left = bed - mm;
  const fmtH = (x) => `${Math.floor(x / 60)} h ${String(x % 60).padStart(2, '0')}`;
  const meals = store.mealsOn().map((x) => x.slot).filter(Boolean);
  return `Moment de la journée : ${name}${left > 0 && mm >= wake ? `, coucher prévu dans ${fmtH(left)}` : ''}. Repas déjà notés : ${meals.join(', ') || 'aucun'}.`;
}

// Contexte textuel transmis à l'IA (profil + 7 derniers jours + repas du jour).
export function personContext(sm = summary()) {
  const st = store.get();
  const { profile } = st;
  const days = store.lastDays(7).map((k) => {
    const d = st.days[k] || {};
    const tot = S.sumNutrients(store.mealsOn(k));
    const extra = [d.walkMin && `marche ${d.walkMin} min`, d.distanceM && `distance ${fmt(d.distanceM / 1000, 1)} km`, d.activeKcalHC && `calories actives ${d.activeKcalHC} kcal`, d.floors && `étages ${d.floors}`, d.hrAvg && `FC moyenne ${d.hrAvg} bpm`, d.spo2 && `SpO2 ${d.spo2} %`, d.vo2max && `VO2max ${d.vo2max}`, d.restingHR && `FC repos ${d.restingHR} bpm`, d.hrv && `VFC ${d.hrv} ms`, d.lateMin != null && `écran après 22 h ${d.lateMin} min`].filter(Boolean).join(', ');
    return `${k}: sommeil ${d.bed || '?'}→${d.wake || '?'}${d.sleepMinutes ? ` (${Math.round(d.sleepMinutes / 6) / 10} h endormi)` : ''} qualité ${d.sleepQuality ?? '?'}/5, humeur ${d.mood ?? '?'}/5, énergie ${d.energy ?? '?'}/5, stress ${d.stress ?? '?'}/5, pas ${d.steps ?? '?'}, activité modérée ${d.modMin ?? 0} min, intense ${d.vigMin ?? 0} min, renfo ${d.strengthMin ?? 0} min, écran ${d.screenMin ?? '?'} min dont réseaux sociaux ${d.socialMin ?? '?'} min, déverrouillages ${d.unlocks ?? '?'}, téléphone avant de dormir ${(d.phoneInBed ?? d.phoneInBedGuess) ? 'oui' : 'non'}, alcool ${d.alcohol ?? 0}, eau ${d.waterMl ?? '?'} mL, apports ${Math.round(tot.kcal)} kcal${extra ? ', ' + extra : ''}`;
  });
  const meals = store.mealsOn().map((m) => `${m.time} ${m.title} (${Math.round(m.nutrients?.kcal || 0)} kcal, prot ${Math.round(m.nutrients?.protein || 0)} g, fibres ${Math.round(m.nutrients?.fiber || 0)} g${m.nutriscore ? `, Nutri-Score ${m.nutriscore.toUpperCase()}` : ''})`);
  return [
    `Date et heure : ${new Date().toLocaleString('fr-FR')}`,
    momentOfDay(profile),
    `Profil : ${profile.name || 'utilisateur'}, ${profile.sex === 'f' ? 'femme' : 'homme'}, ${sm.body.age} ans, ${profile.height || '?'} cm, ${fmt(sm.body.weight, 1)} kg (IMC ${fmt(sm.body.bmi, 1)}, ${sm.body.bmiCat}), tour de taille ${profile.waist || '?'} cm, activité ${profile.activityLevel}, objectif « ${profile.goal} », régime ${profile.diet}, allergies/aversions : ${profile.allergies || 'aucune'}, pathologies/traitements : ${profile.conditions || 'aucun déclaré'}, fumeur : ${profile.smoker ? 'oui' : 'non'}, sport préféré : ${profile.preferredSport || 'non précisé'}, réveil ${profile.wakeTime}, coucher ${profile.bedTime}.`,
    `Besoins estimés : métabolisme de base ${fmt(sm.body.bmr)} kcal, dépense ${fmt(sm.body.tdee)} kcal, cible ${sm.t.kcal} kcal, protéines ${sm.t.protein} g, fibres ${sm.t.fiber} g, sucres libres < ${sm.t.sugarMax} g, sodium < ${sm.t.sodiumMax} mg, fruits & légumes ≥ ${sm.t.fruitVeg} g.`,
    `Consommé aujourd'hui : ${Math.round(sm.totToday.kcal)} kcal, protéines ${Math.round(sm.totToday.protein)} g, fibres ${Math.round(sm.totToday.fiber)} g, sucres ${Math.round(sm.totToday.sugar)} g, sodium ${Math.round(sm.totToday.sodium)} mg, fruits & légumes ${Math.round(sm.totToday.fruitVeg)} g.`,
    `Repas du jour : ${meals.join(' ; ') || 'aucun'}`,
    `Foyer : ${F.describeHousehold(profile, st.household)}`,
    (() => { const t = F.topTastes(taste()); const sel = F.tasteLists(profile); return `Goûts : aime ${[...sel.likes, profile.likes, ...t.likes].filter(Boolean).join(', ') || 'non renseigné'} ; évite ${[...sel.dislikes, profile.dislikes, ...t.dislikes].filter(Boolean).join(', ') || 'non renseigné'} ; cuisines préférées : ${(profile.cuisines || []).join(', ') || 'non renseignées'}.`; })(),
    st.pantry.length ? `Garde-manger (d'après les tickets de caisse) : ${pantryText(st.pantry)}` : 'Garde-manger : inconnu',
    sm.env ? `Environnement (${sm.env.place}) : air ${E.aqiLabel(sm.env.aqi).label} (indice européen ${Math.round(sm.env.aqi)}, PM2,5 ${Math.round(sm.env.pm25)} µg/m³), ${Math.round(sm.env.temp)} °C (max ${Math.round(sm.env.tMax)}, nuit ${Math.round(sm.env.tMin)}), UV max ${Math.round(sm.env.uvMax)}, lever ${sm.env.sunrise}, coucher ${sm.env.sunset}${sm.env.pollen[0] ? `, pollen dominant ${sm.env.pollen[0].name} (${Math.round(sm.env.pollen[0].value)} grains/m³)` : ''}.` : 'Environnement : lieu non renseigné',
    (() => { const d = D.digestionSummary(st.stools); if (!d) return 'Transit : non suivi'; const sus = D.suspects(st.stools, st.meals); return `Transit (14 j) : ${d.perWeek} selles/semaine, types Bristol lents ${d.zones.lent}, normaux ${d.zones.ok}, rapides ${d.zones.rapide}${sus.length ? ` ; aliments suspects : ${sus.map((x) => `${x.word} (${x.bad}/${x.total})`).join(', ')}` : ''}.`; })(),
    (() => { const w = SP.weekStats(st.workouts, st.days); return `Sport (7 j) : ${w.modEq} min équivalent modéré, ${w.strengthSessions} séance(s) de renforcement ; séances : ${w.sessions.map((s) => `${s.date} ${SP.activity(s.type).label} ${s.minutes} min (${s.intensity})`).join(', ') || 'aucune'}. Sport préféré : ${profile.preferredSport || 'non précisé'}. FC max estimée ${SP.hrZones(profile.birthYear).max} bpm.`; })(),
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
  // mêmes retouches que sur l'accueil : étapes masquées, déplacées, renommées ou ajoutées
  const t1 = new Date(); t1.setDate(t1.getDate() + 1);
  const today = C.applyPlanEdits(C.dailyPlan(sm, st.profile), st.planEdits, store.today());
  const tomorrow = C.applyPlanEdits(C.dailyPlan({ ...sm, today: {}, mealsToday: [], workoutsToday: [], lastNight: null, ctx: { ...sm.ctx, workout: false } }, st.profile, t1), st.planEdits, store.today(t1));
  const list = R.buildReminders([today, tomorrow], rs);
  // rappel du soir si la série est en jeu (recalculé à chaque ouverture)
  const sr = rs.kinds.streak && G.streakReminder(st);
  const at = new Date(); at.setHours(19, 30, 0, 0);
  if (sr && at > new Date()) list.push({ at, title: sr.title, body: sr.body, kind: 'streak' });
  // pesée : toutes les 2 semaines, le matin
  const wd = weighDue(st);
  if (rs.kinds.weigh && (wd.due || wd.days >= 13)) {
    const w = new Date(); w.setHours(8, 15, 0, 0);
    if (w < new Date()) w.setDate(w.getDate() + 1);
    list.push({ at: w, title: 'Jour de pesée ⚖️', body: 'À jeun, après les toilettes : on compare ton poids réel à l’estimation de tes repas.', kind: 'weigh' });
  }
  return R.schedule(list.sort((a, b) => a.at - b.at));
}
