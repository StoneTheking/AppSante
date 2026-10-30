// Moteur de coaching : synthèse des données, plan de la journée, recommandations, projections.
import * as S from './science.js';
import { suggestMeals } from './meals.js';
import { bestOutdoorHour, envInsights, aqiLabel } from './env.js';
import { busyBlocks, suggestSlot, usualHour, DEFAULT_WORK } from './schedule.js';
import { weekPlan, activity as sportActivity, substitute, adaptation, adaptedMinutes } from './sport.js';
import { sunTimes, PARIS } from './sun.js';

const avg = (xs) => {
  const v = xs.filter((x) => x != null && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const sum = (xs) => xs.reduce((a, b) => a + (Number(b) || 0), 0);
const hm = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const toMin = (hhmm) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return h * 60 + m;
};

// keys : liste de dates (anciennes → récentes), days : objet date → check-in, meals : tous les repas
export function summarize({ profile, days, meals, weights, env, household = [], stools = [], workouts = [], calEvents = [], location = null, sportFeedback = [] }, keys) {
  const t = S.targets(profile);
  const todayKey = keys[keys.length - 1];
  const week = keys.slice(-7);
  const two = keys.slice(-14);
  const d = (k) => days[k] || {};
  const mealsOf = (k) => meals.filter((m) => m.date === k);

  const sleepH = (k) => (d(k).sleepMinutes ? d(k).sleepMinutes / 60 : S.sleepHours(d(k).bed, d(k).wake));
  const today = d(todayKey);
  const lastNight = sleepH(todayKey);
  const totToday = S.sumNutrients(mealsOf(todayKey));

  const dietDays = two.map((k) => S.sumNutrients(mealsOf(k))).filter((x) => x.kcal > 600);
  const dietAvg = avg(dietDays.map((x) => S.dietScore(x, t)));
  const kcalAvg = avg(dietDays.map((x) => x.kcal));

  const latestWeight = [...weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg || profile.weight;
  const p = { ...profile, weight: latestWeight };

  const w = {
    // journée en cours comptée seulement le soir (à 8 h, 0 pas ne dit rien) ; 0 pas du podomètre = pas de relevé
    steps: avg(week.filter((k) => k !== todayKey || new Date().getHours() >= 20).map((k) => (d(k).steps === 0 && d(k).stepsSource === 'téléphone' ? null : d(k).steps))),
    sleepH: avg(week.map(sleepH)),
    sleepQ: avg(week.map((k) => d(k).sleepQuality)),
    bedVar: S.bedtimeVariability(week.map((k) => d(k).bed)),
    modMin: sum(week.map((k) => d(k).modMin)),
    vigMin: sum(week.map((k) => d(k).vigMin)),
    strength: week.filter((k) => (d(k).strengthMin || 0) > 0).length,
    screenMin: avg(week.map((k) => d(k).screenMin)),
    socialMin: avg(week.map((k) => d(k).socialMin)),
    unlocks: avg(week.map((k) => d(k).unlocks)),
    phoneInBedDays: week.filter((k) => d(k).phoneInBed ?? d(k).phoneInBedGuess).length,
    mood: avg(week.map((k) => d(k).mood)),
    energy: avg(week.map((k) => d(k).energy)),
    stress: avg(week.map((k) => d(k).stress)),
    alcohol: sum(week.map((k) => d(k).alcohol)),
    restingHR: avg(week.map((k) => d(k).restingHR)),
    hrv: avg(week.map((k) => d(k).hrv)),
    loggedDays: week.filter((k) => Object.keys(d(k)).length > 0).length,
  };

  const scores = {
    sommeil: S.sleepScore(w.sleepH, w.sleepQ, w.bedVar),
    activite: w.steps == null && !w.modMin && !w.vigMin && !w.strength ? null : S.activityScore({ steps: w.steps, modMin: w.modMin / 7, vigMin: w.vigMin / 7, strengthMin: w.strength >= 2 ? 1 : 0 }, t),
    alimentation: dietAvg != null ? Math.round(dietAvg) : null,
    humeur: S.moodScore({ mood: w.mood, energy: w.energy, stress: w.stress }),
    numerique: S.digitalScore({ screenMin: w.screenMin, socialMin: w.socialMin, phoneInBed: w.phoneInBedDays >= 3, unlocks: w.unlocks }),
  };
  const weights_ = SCORE_WEIGHTS;
  let num = 0, den = 0;
  for (const [k, v] of Object.entries(scores)) if (v != null) { num += v * weights_[k]; den += weights_[k]; }
  scores.global = den ? Math.round(num / den) : null;

  const bmiV = S.bmi(latestWeight, profile.height);
  const body = {
    weight: latestWeight,
    bmi: bmiV,
    bmiCat: S.bmiCategory(bmiV),
    bmr: S.bmr(p),
    tdee: S.tdee(p),
    bodyFat: S.bodyFat(p),
    whtr: S.waistToHeight(profile.waist, profile.height),
    age: S.age(profile.birthYear),
  };

  const ctx = {
    poorSleep: lastNight != null ? lastNight < 6.5 || (today.sleepQuality || 5) <= 2 : (w.sleepH || 8) < 6.5,
    lowMood: (today.mood || w.mood || 3) <= 2.5,
    lowEnergy: (today.energy || w.energy || 3) <= 2,
    highStress: (today.stress || w.stress || 2) >= 4,
    workout: (today.vigMin || 0) + (today.strengthMin || 0) + (today.modMin || 0) >= 30,
    goal: profile.goal,
  };

  const lateMeals = week.flatMap(mealsOf).filter((m) => (m.time || '') >= '21:00').length;
  // les données air/météo de plus de 6 h sont ignorées
  const envFresh = env && Date.now() - new Date(env.fetched) < 6 * 3600e3 ? env : null;
  const busy = busyBlocks(new Date(), profile.work || DEFAULT_WORK, calEvents);
  const sportToday = weekPlan(profile, workouts, new Date(), days).find((x) => x.today) || null;
  const workoutsToday = workouts.filter((x) => x.date === todayKey);
  const sun = { ...sunTimes(new Date(), location || PARIS), approx: !location };
  return { sun, busy, usualHour: usualHour(workouts), env: envFresh, mealsToday: mealsOf(todayKey), sportToday, sportFeedback, workoutsToday, household, stools, lateMeals, t, p, body, today, todayKey, lastNight, totToday, w, scores, dietAvg, kcalAvg, dietDaysCount: dietDays.length, ctx };
}

// ---------- Activité physique recommandée ----------
// Libellé d'une suggestion à partir des activités acceptées (les sports exclus sont retirés ou remplacés).
export function activityLabel(ids, profile = {}, fallback = 'Activité au choix') {
  const ex = profile.excludedSports || [];
  const ok = [...new Set(ids.map((id) => (ex.includes(id) ? substitute(id, profile) : id)))].filter((id) => id && !ex.includes(id));
  const names = ok.map((id) => ({ marche: 'marche rapide', course: 'footing', velo: 'vélo', yoga: 'yoga doux', natation: 'natation' }[id] || sportActivity(id).label.toLowerCase()));
  if (!names.length) return fallback;
  const txt = names.length > 1 ? `${names.slice(0, -1).join(', ')} ou ${names.at(-1)}` : names[0];
  return txt[0].toUpperCase() + txt.slice(1);
}

// Séance du jour d'après la semaine type : la même dans « Ma journée » (accueil) et « Ta semaine » (sport).
export function sportOfDay(sm, profile) {
  const slot = sm.sportToday;
  let type = slot?.type || 'marche', minutes = slot?.minutes || 30, intensity = slot?.intensity || 'moderee';
  const why = [];
  const easy = () => sportActivity(substitute('marche', profile)).label.toLowerCase();
  if (!slot?.type) { type = 'marche'; minutes = 30; intensity = 'legere'; why.push(`Jour de récupération dans ta semaine type : ${easy()} en douceur suffit.`); }
  if (sm.ctx.poorSleep && intensity === 'intense') { type = 'marche'; intensity = 'moderee'; minutes = 30; why.push(`Nuit courte : on remplace la séance intense par ${easy()} à allure modérée.`); }
  if (slot?.matches) { type = 'yoga'; intensity = 'legere'; minutes = 20; why.length = 0; why.push('Séance du jour déjà faite 👏 : mobilité ou étirements pour récupérer.'); }
  if (sm.env && (sm.env.aqi > 60 || sm.env.tMax >= 33) && ['course', 'velo', 'randonnee', 'marche'].includes(type)) why.push('Air ou chaleur défavorables : fais-la en intérieur (tapis, vélo d’appartement, salle).');
  type = substitute(type, profile);
  const ad = adaptation(sm.sportFeedback || [], type);
  if (!slot?.matches) {
    minutes = adaptedMinutes(minutes, ad);
    if (ad.easier && intensity === 'intense') intensity = 'moderee';
    if (ad.note) why.unshift(ad.note);
  }
  return { type, minutes, intensity, ad, why, planned: !!slot?.type && !slot.matches };
}

export function recommendActivity(sm, profile) {
  const { w, ctx, t, today } = sm;
  const why = [];
  const src = ['who2020'];
  const remainingMod = Math.max(0, t.modMinWeek - w.modMin - 2 * w.vigMin);
  const L = (ids, fb) => activityLabel(ids, profile, fb);
  let r;
  if (ctx.poorSleep) {
    r = { title: L(['marche', 'yoga']), duration: 30, intensity: 'légère à modérée' };
    why.push('Nuit courte : on privilégie une activité modérée, l’effort intense après une privation de sommeil augmente le risque de blessure et le ressenti d’effort.');
  } else if (ctx.workout) {
    r = { title: `Récupération active : ${L(['marche', 'yoga'], 'étirements').toLowerCase()}`, duration: 20, intensity: 'légère' };
    why.push('Tu as déjà fait ta séance aujourd’hui 👏 : une activité douce favorise la récupération.');
  } else if (w.strength < t.strengthPerWeek) {
    r = { title: 'Renforcement musculaire (corps entier)', duration: 40, intensity: 'modérée à soutenue' };
    why.push(`Seulement ${w.strength} séance(s) de renforcement cette semaine : l’OMS en recommande 2, associées à −10 à −17 % de mortalité.`);
    src.push('momma2022');
  } else if (remainingMod > 0) {
    r = { title: `Cardio : ${L(['marche', 'velo', 'course']).toLowerCase()}`, duration: Math.min(45, Math.max(20, Math.round(remainingMod / 3))), intensity: 'modérée' };
    why.push(`Il te reste ~${Math.round(remainingMod)} min d’activité modérée pour atteindre les 150 min/semaine.`);
  } else {
    r = { title: 'Séance plaisir ou intervalles (HIIT court)', duration: 25, intensity: 'soutenue' };
    why.push('Objectifs OMS de la semaine atteints : tu peux varier les plaisirs ou progresser en intensité.');
  }
  if (ctx.lowMood) {
    why.push('Humeur basse : marche/footing en extérieur, yoga et musculation font partie des interventions les plus efficaces contre les symptômes dépressifs.');
    src.push('noetel2024', 'burns2023');
    if (!ctx.poorSleep) r.title += ' — de préférence dehors';
  }
  if (ctx.highStress) why.push('Stress élevé : une activité rythmique (marche, vélo, yoga) aide à faire redescendre la tension.');
  if (profile.preferredSport) why.push(`Tu peux remplacer par ton sport favori (${profile.preferredSport}) à intensité équivalente.`);
  if ((w.steps || 0) < t.steps) {
    why.push(`Moyenne de ${Math.round(w.steps || 0)} pas/j : chaque +1000 pas/j est associé à environ −15 % de mortalité toutes causes.`);
    src.push('banach2023');
  }
  return { ...r, why, src };
}

// ---------- Plan horaire de la journée ----------
// Le plan se recale sur ce qui a déjà été fait : repas enregistrés (heure et calories), grignotages, séance du jour.
const SLOT_NAME = { 'petit-dej': 'Petit-déjeuner', dejeuner: 'Déjeuner', collation: 'Goûter', diner: 'Dîner' };
export function dailyPlan(sm, profile, date = new Date()) {
  const wake = toMin(profile.wakeTime || '07:00');
  let bed = toMin(profile.bedTime || '23:00');
  if (bed <= wake) bed += 1440;
  const items = [];
  const add = (min, icon, title, text, src = [], done = false) => items.push({ key: icon, min, time: hm(min), icon, title, text, src, done });
  const { ctx, t } = sm;
  const eaten = (sm.mealsToday || []).filter((m) => !m.snack);
  const snacks = (sm.mealsToday || []).filter((m) => m.snack);
  const logged = (slot) => eaten.filter((m) => m.slot === slot).sort((a, b) => a.time.localeCompare(b.time));
  const kcalOf = (ms) => Math.round(ms.reduce((a, m) => a + (m.nutrients?.kcal || 0), 0));
  const tot = sm.totToday || { kcal: 0, protein: 0 };
  const leftKcal = Math.max(0, t.kcal - tot.kcal), leftProt = Math.max(0, t.protein - tot.protein);
  const SHARE = { 'petit-dej': 0.25, dejeuner: 0.35, collation: 0.1, diner: 0.3 };
  const pending = Object.keys(SHARE).filter((k) => !logged(k).length);
  const shareLeft = pending.reduce((a, k) => a + SHARE[k], 0) || 1;
  const target = (slot) => Math.round((leftKcal * SHARE[slot]) / shareLeft / 10) * 10;
  const mealDone = (slot) => {
    const ms = logged(slot);
    const k = kcalOf(ms);
    const p = Math.round(ms.reduce((a, m) => a + (m.nutrients?.protein || 0), 0));
    add(toMin(ms[0].time), slot === 'collation' ? '🍎' : slot === 'petit-dej' ? '🍳' : slot === 'diner' ? '🍽️' : '🥗', `${SLOT_NAME[slot]} · ${k} kcal`, `${ms.map((m) => m.title).join(', ')} — ${p} g de protéines.`, [], true);
    return toMin(ms.at(-1).time);
  };
  const budget = (slot) => (tot.kcal > 0 ? ` Il te reste ~${Math.round(leftKcal)} kcal et ${Math.round(leftProt)} g de protéines aujourd’hui : vise ~${target(slot)} kcal à ce repas.` : '');

  // Lever / coucher du soleil : ville choisie (sinon Paris par défaut)
  const sun = sm.sun?.rise != null ? sm.sun : null;
  const where = sm.sun?.approx ? ' (heure de Paris : choisis ta ville dans Profil pour la tienne)' : '';
  if (sun) {
    add(sun.rise, '🌅', `Lever du soleil`, sun.rise > wake + 10
      ? `Le soleil se lève après ton réveil${where}. En attendant, allume une lumière vive ; dès qu’il fait jour, 10–15 min dehors.`
      : `Il fait déjà jour à ton réveil${where} : ouvre les volets tout de suite.`, ['burns2023']);
    add(sun.set, '🌇', 'Coucher du soleil', `Après le coucher du soleil, tamise les lumières et baisse la luminosité des écrans : la lumière vive le soir retarde la mélatonine${where}.`, ['chang2015', 'burns2023']);
  }
  const light = sun && sun.rise > wake + 10 && sun.rise < wake + 180 ? sun.rise + 15 : wake + 15;
  add(light, '☀️', 'Lumière du jour (10–15 min dehors)', ctx.lowMood
    ? 'Sors 15–30 min à la lumière naturelle le matin : la lumière du matin stabilise l’horloge biologique et est associée à une meilleure humeur.'
    : 'Ouvre les volets et sors 10–15 min : la lumière du matin cale ton horloge interne et améliore le sommeil du soir.', ['burns2023']);

  // Petit-déjeuner
  let breakfast = wake + 45;
  if (logged('petit-dej').length) breakfast = mealDone('petit-dej');
  else add(breakfast, '🍳', 'Petit-déjeuner protéiné', `Vise ~${Math.round(t.protein * 0.25)} g de protéines et des fibres. Manger plus tôt dans la journée améliore la sensibilité à l’insuline.`, ['sutton2018']);

  const caffeineCut = bed - 8 * 60;
  add(caffeineCut, '☕', 'Dernier café', 'Après cette heure, la caféine réduit encore la durée et la qualité du sommeil (≈ 8 h avant le coucher).', ['gardiner2023']);

  // Déjeuner : au moins ~4 h après le petit-déjeuner réel
  let lunch = Math.max(wake + 4.5 * 60, 12 * 60 + 15, breakfast + 4 * 60);
  if (logged('dejeuner').length) lunch = mealDone('dejeuner');
  else add(lunch, '🥗', 'Déjeuner — repas principal', `Moitié légumes, un quart protéines, un quart féculents complets. Concentrer l’apport calorique le midi plutôt que le soir favorise la perte de poids.${budget('dejeuner')}`, ['garaulet2013']);
  if ((sm.w.screenMin ?? 0) > 180 || ['sedentaire', 'leger'].includes(profile.activityLevel)) add(wake + 150, '⚡', 'Snack d’exercice (2 min)', 'Monte des escaliers ou marche très vite 1–2 min, à refaire 3× dans la journée. Et lève-toi 5 min toutes les 30 min assis.', ['stamatakis2022', 'duran2023']);
  if ((profile.excludedSports || []).includes('marche')) add(lunch + 30, '🚶', 'Bouger 10 min après le repas', 'Rester debout et bouger un peu (rangement, vaisselle, escaliers) après le repas abaisse le pic de glycémie.', ['buffey2022']);
  else add(lunch + 30, '🚶', 'Marche digestive 10–15 min', 'Une marche légère après le repas abaisse nettement le pic de glycémie.', ['buffey2022']);

  if (ctx.poorSleep && sm.lastNight != null) add(Math.min(lunch + 60, 15 * 60), '😴', 'Micro-sieste (10–20 min)', 'Nuit courte : une sieste brève avant 15 h restaure la vigilance sans perturber la nuit suivante.', ['watson2015']);

  // Sport : séance déjà faite, sinon séance prévue dans la semaine type (ou recommandation du jour)
  const act = recommendActivity(sm, profile);
  const sod = sportOfDay(sm, profile);
  const pType = sod.planned ? sod : null;
  const sess = { title: sportActivity(sod.type).label, duration: sod.minutes, intensity: sod.intensity === 'intense' ? 'soutenue' : sod.intensity === 'legere' ? 'légère' : 'modérée' };
  let actStart = Math.min(Math.max(wake + 9 * 60, 17 * 60 + 30), bed - 2 * 60 - sess.duration);
  if (ctx.lowMood) actStart = Math.min(actStart, 16 * 60 + 30);
  const env = sm.env;
  const doneW = (sm.workoutsToday || []).sort((a, b) => a.start.localeCompare(b.start));
  if (doneW.length) {
    const d0 = new Date(doneW[0].start);
    actStart = d0.getHours() * 60 + d0.getMinutes();
    add(actStart, '🏃', `Séance faite · ${doneW.map((w) => `${sportActivity(w.type).label.split(' ')[0]} ${w.minutes} min`).join(', ')}`, 'Bravo 👏 Pense à boire et à prendre des protéines au repas suivant (≈ 20–40 g) pour la récupération.', ['morton2018'], true);
  } else {
    const slot = suggestSlot({ duration: sess.duration, intensity: sess.intensity === 'soutenue' ? 'intense' : 'moderee', wake: profile.wakeTime, bed: profile.bedTime, busy: sm.busy || [], pref: profile.sportPref || 'auto', usualHour: sm.usualHour, env });
    const slotChosen = !!slot && ((sm.busy || []).length > 0 || (profile.sportPref && profile.sportPref !== 'auto') || sm.usualHour != null);
    if (slotChosen) actStart = slot.start;
    let actText = [pType ? 'Séance prévue dans ta semaine type.' : '', ...sod.why, ...(pType || sod.why.length ? [] : act.why.slice(0, 2))].filter(Boolean).join(' ');
    const actSrc = [...act.src];
    if (env) {
      if (env.aqi > 60 || env.tMax >= 33) {
        actText += ` Aujourd’hui : ${env.aqi > 60 ? `air ${aqiLabel(env.aqi).label.toLowerCase()} (indice ${Math.round(env.aqi)})` : `forte chaleur (${Math.round(env.tMax)} °C)`}, fais ta séance en intérieur.`;
        actSrc.push(env.aqi > 60 ? 'sinharay2018' : 'ebi2021');
      } else {
        const best = bestOutdoorHour(env, Math.max(wake + 60, 7 * 60), bed - 150 - sess.duration);
        if (!slotChosen && best && Math.abs(best.hour * 60 - actStart) > 60 && (best.aqi ?? 0) + 15 < (env.hours.find((h) => h.hour === Math.floor(actStart / 60))?.aqi ?? 0)) {
          actStart = best.hour * 60;
          actText += ` Créneau choisi pour la meilleure qualité de l’air (indice ${Math.round(best.aqi)}).`;
          actSrc.push('who2021air');
        }
        actSrc.push('andersen2015');
      }
    }
    if (slotChosen && slot.why.length) { actText = `Créneau choisi ${slot.why.join(', ')}. ` + actText; actSrc.push('belanger2011', 'knaier2021', 'bruggisser2023'); }
    // pas d'effort juste après un gros repas
    const lastBig = eaten.filter((m) => (m.nutrients?.kcal || 0) > 500).map((m) => toMin(m.time)).filter((m) => m <= actStart).at(-1);
    if (lastBig != null && actStart - lastBig < 90 && sess.intensity !== 'légère') { actStart = lastBig + 90; actText += ' Décalé pour laisser ~1 h 30 de digestion après ton repas.'; }
    add(actStart, '🏃', `${sess.title} (${sess.duration} min)`, actText, actSrc);
  }

  // Collation : seulement si utile et si le déjeuner n'a pas été tardif
  if (logged('collation').length) mealDone('collation');
  else if ((ctx.workout || profile.goal === 'prendre' || actStart < 18 * 60) && lunch < 14.5 * 60) add(Math.max(lunch + 3.5 * 60, actStart - 75), '🍎', 'Goûter', `Fruit + source de protéines (yaourt, amandes) pour arriver en forme à la séance et éviter les fringales.${budget('collation')}`, []);

  const snackKcal = kcalOf(snacks);
  if (logged('diner').length) mealDone('diner');
  else {
    const dinner = Math.min(Math.max(actStart + sess.duration + 45, 19 * 60, lunch + 5 * 60), bed - 3 * 60);
    add(dinner, '🍽️', 'Dîner léger', `Au moins 3 h avant le coucher, plus léger que le déjeuner : manger tard est associé à une moins bonne glycémie et une perte de poids plus difficile.${snackKcal > 200 ? ` Grignotages du jour : ~${snackKcal} kcal, allège d’autant le dîner.` : ''}${budget('diner')}`, ['garaulet2013', 'sutton2018']);
  }

  add(bed - 60, '📵', 'Écrans off — téléphone hors de la chambre', 'L’usage du téléphone au lit est associé à un endormissement plus tardif et un sommeil de moins bonne qualité.', ['exelmans2016']);
  add(bed - 30, '🧘', 'Routine de détente', ctx.highStress || ctx.lowMood
    ? '5 min de « soupir cyclique » : deux inspirations par le nez, une longue expiration par la bouche. Améliore l’humeur et apaise (essai randomisé).'
    : 'Lumière tamisée, lecture, respiration lente ou étirements.', ctx.highStress || ctx.lowMood ? ['balban2023'] : []);
  const dow = date.getDay();
  if (dow === 0 || dow === 6 || ctx.lowMood) add(Math.max(wake + 3 * 60, 10 * 60 + 30), '🌳', 'Temps dans la nature', 'Parc, forêt, bord de l’eau : viser 120 min sur la semaine est associé à une meilleure santé et un meilleur moral.', ['white2019']);
  add(bed, '🌙', 'Coucher', `Même heure chaque soir (±30 min) : la régularité du sommeil prédit la mortalité mieux que sa durée. Vise ${t.sleepMin}–${t.sleepMax} h.`, ['windred2024', 'watson2015']);

  fitAroundWork(items, profile, { wake, bed, add, dow });
  for (const i of items) i.time = hm(i.min);
  return items.sort((a, b) => a.min - b.min);
}

// Journée de travail : on ajoute le bloc « Travail » et on déplace ce qui ne peut pas se faire au bureau.
function fitAroundWork(items, profile, { wake, bed, add, dow }) {
  const w = profile.work;
  if (!w?.enabled || !(w.days || []).includes(dow)) return;
  const start = toMin(w.start), commute = w.commute || 0;
  let end = toMin(w.end);
  if (end <= start) end += 1440; // travail de nuit
  const leave = start - commute, back = end + commute;
  const at = (it) => !it.done && it.min >= leave && it.min < back;
  const one = (k) => items.find((i) => i.key === k);
  const drop = (it) => items.splice(items.indexOf(it), 1);
  const bf = one('🍳');
  if (bf && !bf.done && bf.min > leave - 20) { bf.min = Math.max(wake + 15, leave - 25); bf.text = `Avant de partir. ${bf.text}`; }
  const light = one('☀️');
  if (light && at(light)) { light.min = commute ? leave : Math.max(wake + 15, leave - 15); light.title = commute ? 'Lumière du jour sur le trajet' : light.title; light.text = commute ? 'Fais une partie du trajet dehors, à pied ou à vélo si possible : 10–15 min de lumière du matin calent ton horloge interne.' : light.text; }
  for (const it of [...items]) {
    if (!at(it)) continue;
    if (it.key === '🥗') it.text = `À ta pause. ${it.text}`;
    else if (it.key === '🚶') { it.title = 'Marche 10 min à la pause déjeuner'; }
    else if (it.key === '⚡') it.text = `Au travail : escaliers plutôt qu’ascenseur, appels debout. ${it.text}`;
    else if (it.key === '😴') drop(it);
    else if (it.key === '🌳') { it.min = back + 30; if (it.min > bed - 120) drop(it); }
    else if (it.key === '🏃') {
      const dur = Number((it.title.match(/\((\d+) min\)/) || [])[1] || 30);
      if (back + 15 + dur <= bed - 75) { it.min = back + 15; it.text = `Après le travail. ${it.text}`; }
      else if (leave - dur - 15 >= wake + 30) { it.min = leave - dur - 15; it.text = `Avant le travail. ${it.text}`; }
      else { it.min = start + 5 * 60 > end ? end - 60 : start + 4 * 60; it.title = it.title.replace(/\(\d+ min\)/, '(20 min)'); it.text = `Journée chargée : version courte à la pause déjeuner. ${it.text}`; }
    }
  }
  const sport = one('🏃'), dinner = one('🍽️');
  if (dinner && !dinner.done) {
    const after = sport && !sport.done && sport.min >= back ? sport.min + Number((sport.title.match(/\((\d+) min\)/) || [])[1] || 30) + 30 : back + 30;
    if (dinner.min < after) dinner.min = Math.min(after, bed - 120);
  }
  const snack = one('🍎');
  if (snack && !snack.done && sport && sport.min >= back && snack.min < back - 60) snack.min = Math.max(snack.min, back - 60);
  add(leave, '💼', `Travail ${hm(start)}–${hm(end)}`, commute ? `${commute} min de trajet à l’aller et au retour. Le plan place le reste autour.` : 'Le plan place le reste autour de ta journée de travail.');
}

// Retouches de l'utilisateur sur le plan :
// edits = { hidden: { clé: titre }, hiddenOn: { date: [clés] },
//           over: { clé: { title, time, text, days } }, overOn: { date: { clé: {…} } },
//           custom: [{ id, time, title, text, date|null, days|null }] }
// days = jours de la semaine (0 = dimanche) où l'étape apparaît ; absent = tous les jours.
export function applyPlanEdits(plan, edits = {}, dateKey) {
  const dow = new Date(`${dateKey}T12:00:00`).getDay();
  const off = new Set([...Object.keys(edits.hidden || {}), ...((edits.hiddenOn || {})[dateKey] || [])]);
  const today = (edits.overOn || {})[dateKey] || {};
  const out = [];
  for (const p of plan) {
    if (off.has(p.key)) continue;
    const o = { ...(edits.over || {})[p.key], ...today[p.key] };
    if (o.days && !o.days.includes(dow) && !today[p.key]) continue;
    out.push(Object.keys(o).length ? { ...p, ...(o.title ? { title: o.title } : {}), ...(o.text != null ? { note: o.text } : {}), ...(o.time ? { time: o.time, min: toMin(o.time) } : {}), days: o.days || null, edited: today[p.key] ? 'today' : 'always' } : p);
  }
  const custom = (edits.custom || [])
    .filter((c) => (c.date ? c.date === dateKey : !c.days || c.days.includes(dow)))
    .map((c) => ({ key: 'c:' + c.id, id: c.id, custom: true, daily: !c.date, days: c.days || null, min: toMin(c.time), time: c.time, icon: '⭐', title: c.title, text: '', note: c.text || '', src: [] }));
  return [...out, ...custom].sort((a, b) => a.min - b.min);
}

// Durée lisible à partir d'heures : 6.6 → « 6 h 36 ».
const hmDur = (h) => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };

// ---------- Score d'hygiène de vie expliqué ----------
// L’humeur est suivie mais ne compte pas : on ne la commande pas directement, on agit sur ce qui la fait bouger.
export const SCORE_WEIGHTS = { sommeil: 0.3, activite: 0.3, alimentation: 0.25, humeur: 0, numerique: 0.15 };
export const scoreWord = (v) => (v == null ? ['Pas de données', 'var(--muted)'] : v >= 80 ? ['Excellent', 'var(--good)'] : v >= 65 ? ['Bon', 'var(--good)'] : v >= 50 ? ['À améliorer', 'var(--warn)'] : ['Faible', 'var(--bad)']);
export function scoreBreakdown(sm) {
  const { w, t, scores } = sm;
  const r = (x, d = 0) => (x == null ? '—' : S.round(x, d).toLocaleString('fr-FR'));
  return [
    { k: 'sommeil', what: w.sleepH != null ? `${hmDur(w.sleepH)} par nuit en moyenne${w.bedVar != null ? `, coucher ±${Math.round(w.bedVar)} min` : ''}${w.sleepQ ? `, qualité ${r(w.sleepQ, 1)}/5` : ''}` : 'Continue à noter ton sommeil chaque nuit', how: 'Durée (7–9 h), qualité ressentie et régularité de l’heure de coucher.', tip: w.sleepH != null && w.sleepH < 7 ? 'Avance ton coucher de 20 min.' : 'Garde la même heure de coucher, week-end compris.', src: ['watson2015', 'windred2024'] },
    { k: 'activite', what: w.steps != null || w.modMin ? `${r(w.steps)} pas/j, ${Math.round(w.modMin + 2 * w.vigMin)} min d’activité/sem, ${w.strength} séance(s) de renfo` : 'Synchronise tes pas ou note une séance', how: `Pas (objectif ${t.steps}/j), 150 min d’activité modérée par semaine, 2 séances de renforcement.`, tip: (w.steps || 0) < t.steps ? 'Ajoute une marche de 15 min après le déjeuner.' : 'Ajoute une séance de renforcement.', src: ['paluch2022', 'who2020'] },
    { k: 'alimentation', what: sm.dietDaysCount ? `${sm.dietDaysCount} jour(s) de repas notés sur 14` : 'Photographie tes repas', how: 'Fibres, fruits & légumes, protéines, sucres, graisses saturées, sel et part d’ultra-transformés.', tip: 'Une portion de légumes en plus à chaque repas.', src: ['gbd2019', 'lane2024'] },
    { k: 'humeur', what: w.mood != null ? `humeur ${r(w.mood, 1)}/5, énergie ${r(w.energy, 1)}/5, stress ${r(w.stress, 1)}/5` : 'Réponds à la question du jour', how: 'Moyenne de ton humeur, ton énergie et ton stress déclarés chaque jour.', tip: '15 min dehors à la lumière du jour.', src: ['noetel2024', 'burns2023'] },
    { k: 'numerique', what: w.screenMin != null ? `${Math.floor(w.screenMin / 60)} h ${String(Math.round(w.screenMin % 60)).padStart(2, '0')} d’écran/j dont ${Math.round(w.socialMin || 0)} min de réseaux sociaux` : 'Autorise le temps d’écran', how: 'Temps d’écran, réseaux sociaux (> 30 min/j), téléphone au lit et déverrouillages.', tip: 'Téléphone hors de la chambre ce soir.', src: ['hunt2018', 'exelmans2016'] },
  ].map((x) => ({ ...x, v: scores[x.k], weight: SCORE_WEIGHTS[x.k] }));
}

// ---------- Messages personnalisés ----------
export function insights(sm) {
  const out = [...envInsights(sm.env, sm.p)];
  const { w, t, body, ctx, totToday, kcalAvg, dietAvg } = sm;
  const push = (level, title, text, src = []) => out.push({ level, title, text, src });

  if (w.sleepH != null) {
    if (w.sleepH < 7) push('alerte', 'Dette de sommeil', `Tu dors ${hmDur(w.sleepH)} en moyenne (objectif ${t.sleepMin}–${t.sleepMax} h). Le manque de sommeil augmente l’appétit pour les aliments sucrés et diminue la motivation à bouger.`, ['watson2015', 'cappuccio2010']);
    else push('bon', 'Durée de sommeil OK', `${hmDur(w.sleepH)} par nuit en moyenne cette semaine.`, ['watson2015']);
  }
  if (w.bedVar != null && w.bedVar > 45) push('attention', 'Horaires de coucher irréguliers', `Ton heure de coucher varie de ±${Math.round(w.bedVar)} min. Fixe une heure de coucher constante, même le week-end.`, ['windred2024']);
  if (w.socialMin != null && w.socialMin > 30) push('attention', 'Réseaux sociaux', `${Math.round(w.socialMin)} min/j en moyenne. Limiter à 30 min/j a réduit solitude et symptômes dépressifs en 3 semaines dans un essai contrôlé.`, ['hunt2018']);
  if (w.screenMin != null && w.screenMin > 240) push('attention', 'Temps d’écran élevé', `${hmDur(w.screenMin / 60)} par jour sur le téléphone. Remplacer 30 min d’écran par 30 min de marche = ~3000 pas de plus.`, ['banach2023']);
  if (w.phoneInBedDays >= 3) push('attention', 'Téléphone au lit', `Téléphone utilisé au lit ${w.phoneInBedDays} soirs sur 7.`, ['exelmans2016']);
  if (w.steps != null) {
    if (w.steps < t.steps) push('attention', 'Pas quotidiens', `${Math.round(w.steps)} pas/j en moyenne. Le bénéfice sur la mortalité continue jusqu’à ~${t.steps} pas/j pour ton âge.`, ['paluch2022']);
    else push('bon', 'Bien actif', `${Math.round(w.steps)} pas/j : tu es dans la zone de bénéfice maximal.`, ['paluch2022']);
  }
  const modEq = w.modMin + 2 * w.vigMin;
  if (w.loggedDays >= 3 && modEq < 150) push('attention', 'Activité modérée à soutenue', `${Math.round(modEq)} min cette semaine (équivalent modéré) sur 150 min recommandées.`, ['who2020']);
  if (w.loggedDays >= 3 && w.strength < 2) push('attention', 'Renforcement musculaire', `${w.strength} séance(s) cette semaine, 2 recommandées.`, ['who2020', 'momma2022']);
  if (body.whtr != null && body.whtr >= 0.5) push('alerte', 'Tour de taille', `Rapport tour de taille/taille = ${S.round(body.whtr, 2).toLocaleString('fr-FR')} (≥ 0,5) : signe de graisse abdominale, facteur de risque cardio-métabolique.`, ['ashwell2012']);
  if (dietAvg != null && dietAvg < 60) push('attention', 'Qualité alimentaire à améliorer', `Score moyen ${Math.round(dietAvg)}/100. Les 3 premiers risques alimentaires mondiaux : trop de sel, pas assez de céréales complètes, pas assez de fruits.`, ['gbd2019']);
  if (totToday.kcal && totToday.sodium > t.sodiumMax) push('attention', 'Sel', `Déjà ${Math.round(totToday.sodium)} mg de sodium aujourd’hui (max ${t.sodiumMax} mg).`, ['who2012sodium']);
  if (totToday.kcal && totToday.upfShare > 0.4) push('attention', 'Ultra-transformés', `${Math.round(totToday.upfShare * 100)} % des calories du jour viennent d’aliments ultra-transformés.`, ['lane2024']);
  if (kcalAvg != null && body.tdee) {
    const bal = kcalAvg - body.tdee;
    if (Math.abs(bal) > 250) push(bal > 0 ? 'attention' : 'bon', bal > 0 ? 'Excédent calorique' : 'Déficit calorique', `Environ ${bal > 0 ? '+' : ''}${Math.round(bal)} kcal/j par rapport à ta dépense estimée.`, ['hall2011']);
  }
  if (ctx.lowMood) push('attention', 'Humeur basse', 'Activité physique (surtout dehors), lumière du jour, contacts sociaux et alimentation de type méditerranéen ont tous un effet démontré. Si cela dure plus de 2 semaines, parles-en à un médecin ou appelle le 3114 (France) en cas d’idées noires.', ['noetel2024', 'jacka2017']);
  if (w.restingHR != null && w.restingHR > 80) push('attention', 'Fréquence cardiaque au repos élevée', `${Math.round(w.restingHR)} bpm en moyenne. Chaque +10 bpm est associé à environ +9 % de mortalité ; l’endurance régulière la fait baisser.`, ['zhang2016', 'mandsager2018']);
  else if (w.restingHR != null && w.restingHR < 60) push('bon', 'Cœur entraîné', `FC de repos de ${Math.round(w.restingHR)} bpm : signe d’une bonne forme cardio-respiratoire.`, []);
  if (w.sleepH != null && w.sleepH < 7) push('attention', 'Sommeil et appétit', 'Le manque de sommeil fait manger en moyenne ~385 kcal de plus par jour ; dormir plus longtemps a réduit l’apport d’environ 270 kcal/j dans un essai randomisé. Ton sommeil est un levier de poids.', ['alkhatib2017', 'tasali2022']);
  if ((w.screenMin != null && w.screenMin > 180) || (w.steps != null && w.steps < 6000)) push('attention', 'Casser la sédentarité', '5 min de marche toutes les 30 min assis réduisent glycémie et tension ; 3 « snacks d’exercice » d’1–2 min intenses par jour (escaliers, marche très rapide) sont associés à −38 % de mortalité.', ['duran2023', 'stamatakis2022']);
  if (sm.lateMeals >= 3) push('attention', 'Dîners tardifs', `${sm.lateMeals} repas pris après 21 h cette semaine. Manger tard augmente la faim du lendemain et réduit la dépense énergétique.`, ['vujovic2022', 'garaulet2013']);
  if (ctx.lowMood || (w.stress != null && w.stress >= 3.5)) push('attention', 'Recharger le moral', '120 min/semaine dans la nature, voir des proches (les liens sociaux pèsent autant que le tabac sur la longévité) et 5 min/jour de respiration lente (« soupir cyclique ») ont des effets démontrés.', ['white2019', 'holtlunstad2010', 'balban2023']);
  if (w.alcohol > 10) push('attention', 'Alcool', `${w.alcohol} verres cette semaine. Il n’existe pas de seuil sans risque ; l’alcool dégrade aussi le sommeil profond.`, ['gbd2018alcohol']);
  return out;
}

// ---------- Projection santé ----------
export function projection(sm, profile, improve = {}) {
  const { w, body, dietAvg, kcalAvg } = sm;
  const balance = kcalAvg != null && body.tdee ? kcalAvg - body.tdee : 0;
  const base = {
    steps: w.steps,
    sleepH: w.sleepH,
    diet: dietAvg,
    strengthWeek: w.loggedDays >= 3 ? w.strength : null,
    alcoholWeek: w.alcohol,
    smoker: profile.smoker,
    restingHR: w.restingHR,
  };
  const h = profile.height;
  const at = (years, bal, extra = {}) => {
    const wt = body.weight ? S.projectWeight(body.weight, bal, years * 365) : null;
    const f = S.riskFactors({ ...base, ...extra, bmiV: S.bmi(wt, h) });
    return { years, weight: wt, bmi: S.bmi(wt, h), factors: f, rr: S.combinedRR(f) };
  };
  const better = {
    steps: base.steps != null ? Math.max(base.steps, sm.t.steps) : sm.t.steps,
    sleepH: base.sleepH != null ? S.clamp(base.sleepH, 7, 8.5) : 7.5,
    diet: Math.max(base.diet || 0, 80),
    strengthWeek: 2,
    alcoholWeek: Math.min(base.alcoholWeek || 0, 3),
    ...improve,
  };
  // scénario amélioré : on vise l'équilibre (ou −500 kcal si objectif perte de poids)
  const betterBal = profile.goal === 'perdre' ? -400 : profile.goal === 'prendre' ? 200 : Math.min(balance, 0);
  return {
    balance,
    reliable: sm.dietDaysCount >= 3,
    current: [0, 1, 5, 10].map((y) => at(y, balance)),
    improved: [0, 1, 5, 10].map((y) => at(y, betterBal, better)),
    curveCurrent: body.weight ? S.weightCurve(body.weight, balance, 5) : [],
    curveImproved: body.weight ? S.weightCurve(body.weight, betterBal, 5) : [],
  };
}

export function mealSuggestions(sm, profile, slot, taste) {
  const { t, totToday, ctx } = sm;
  const remaining = {
    kcal: Math.max(0, t.kcal - totToday.kcal),
    protein: Math.max(0, t.protein - totToday.protein),
    fiber: Math.max(0, t.fiber - totToday.fiber),
    fruitVeg: Math.max(0, t.fruitVeg - totToday.fruitVeg),
  };
  return suggestMeals(slot, { remaining, ctx, diet: profile.diet, allergies: profile.allergies, taste });
}

export function currentSlot(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 10.5) return 'petit-dej';
  if (h < 14.5) return 'dejeuner';
  if (h < 18) return 'collation';
  return 'diner';
}
