// Moteur de coaching : synthèse des données, plan de la journée, recommandations, projections.
import * as S from './science.js';
import { suggestMeals } from './meals.js';

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
export function summarize({ profile, days, meals, weights }, keys) {
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
    steps: avg(week.map((k) => d(k).steps)),
    sleepH: avg(week.map(sleepH)),
    sleepQ: avg(week.map((k) => d(k).sleepQuality)),
    bedVar: S.bedtimeVariability(week.map((k) => d(k).bed)),
    modMin: sum(week.map((k) => d(k).modMin)),
    vigMin: sum(week.map((k) => d(k).vigMin)),
    strength: week.filter((k) => (d(k).strengthMin || 0) > 0).length,
    screenMin: avg(week.map((k) => d(k).screenMin)),
    socialMin: avg(week.map((k) => d(k).socialMin)),
    unlocks: avg(week.map((k) => d(k).unlocks)),
    phoneInBedDays: week.filter((k) => d(k).phoneInBed).length,
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
    activite: S.activityScore({ steps: w.steps, modMin: w.modMin / 7, vigMin: w.vigMin / 7, strengthMin: w.strength >= 2 ? 1 : 0 }, t),
    alimentation: dietAvg != null ? Math.round(dietAvg) : null,
    humeur: S.moodScore({ mood: w.mood, energy: w.energy, stress: w.stress }),
    numerique: S.digitalScore({ screenMin: w.screenMin, socialMin: w.socialMin, phoneInBed: w.phoneInBedDays >= 3, unlocks: w.unlocks }),
  };
  const weights_ = { sommeil: 0.25, activite: 0.25, alimentation: 0.25, humeur: 0.15, numerique: 0.1 };
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
  return { lateMeals, t, p, body, today, todayKey, lastNight, totToday, w, scores, dietAvg, kcalAvg, dietDaysCount: dietDays.length, ctx };
}

// ---------- Activité physique recommandée ----------
export function recommendActivity(sm, profile) {
  const { w, ctx, t, today } = sm;
  const why = [];
  const src = ['who2020'];
  const remainingMod = Math.max(0, t.modMinWeek - w.modMin - 2 * w.vigMin);
  let r;
  if (ctx.poorSleep) {
    r = { title: 'Marche rapide ou yoga doux', duration: 30, intensity: 'légère à modérée' };
    why.push('Nuit courte : on privilégie une activité modérée, l’effort intense après une privation de sommeil augmente le risque de blessure et le ressenti d’effort.');
  } else if (ctx.workout) {
    r = { title: 'Récupération active : marche ou étirements', duration: 20, intensity: 'légère' };
    why.push('Tu as déjà fait ta séance aujourd’hui 👏 : une activité douce favorise la récupération.');
  } else if (w.strength < t.strengthPerWeek) {
    r = { title: 'Renforcement musculaire (corps entier)', duration: 40, intensity: 'modérée à soutenue' };
    why.push(`Seulement ${w.strength} séance(s) de renforcement cette semaine : l’OMS en recommande 2, associées à −10 à −17 % de mortalité.`);
    src.push('momma2022');
  } else if (remainingMod > 0) {
    r = { title: 'Cardio : marche rapide, vélo ou footing', duration: Math.min(45, Math.max(20, Math.round(remainingMod / 3))), intensity: 'modérée' };
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
export function dailyPlan(sm, profile) {
  const wake = toMin(profile.wakeTime || '07:00');
  let bed = toMin(profile.bedTime || '23:00');
  if (bed <= wake) bed += 1440;
  const items = [];
  const add = (min, icon, title, text, src = []) => items.push({ min, time: hm(min), icon, title, text, src });
  const { ctx, t } = sm;

  add(wake, '☀️', 'Lumière du jour', ctx.lowMood
    ? 'Sors 15–30 min à la lumière naturelle dès le réveil : la lumière du matin stabilise l’horloge biologique et est associée à une meilleure humeur.'
    : 'Ouvre les volets / sors 10–15 min : la lumière du matin cale ton horloge interne et améliore le sommeil du soir.', ['burns2023']);
  add(wake + 45, '🍳', 'Petit-déjeuner protéiné', `Vise ~${Math.round(t.protein * 0.25)} g de protéines et des fibres. Manger plus tôt dans la journée améliore la sensibilité à l’insuline.`, ['sutton2018']);

  const caffeineCut = bed - 8 * 60;
  add(caffeineCut, '☕', 'Dernier café', 'Après cette heure, la caféine réduit encore la durée et la qualité du sommeil (≈ 8 h avant le coucher).', ['gardiner2023']);

  const lunch = Math.max(wake + 4.5 * 60, 12 * 60 + 15);
  add(lunch, '🥗', 'Déjeuner — repas principal', 'Moitié légumes, un quart protéines, un quart féculents complets. Concentrer l’apport calorique le midi plutôt que le soir favorise la perte de poids.', ['garaulet2013']);
  if ((sm.w.screenMin ?? 0) > 180 || ['sedentaire', 'leger'].includes(profile.activityLevel)) add(wake + 150, '⚡', 'Snack d’exercice (2 min)', 'Monte des escaliers ou marche très vite 1–2 min, à refaire 3× dans la journée. Et lève-toi 5 min toutes les 30 min assis.', ['stamatakis2022', 'duran2023']);
  add(lunch + 30, '🚶', 'Marche digestive 10–15 min', 'Une marche légère après le repas abaisse nettement le pic de glycémie.', ['buffey2022']);

  if (ctx.poorSleep && sm.lastNight != null) add(Math.min(lunch + 60, 15 * 60), '😴', 'Micro-sieste (10–20 min)', 'Nuit courte : une sieste brève avant 15 h restaure la vigilance sans perturber la nuit suivante.', ['watson2015']);

  const act = recommendActivity(sm, profile);
  // créneau : fin d’après-midi (pic de performance), au moins 2 h avant le coucher pour l’intense
  let actStart = Math.min(Math.max(wake + 9 * 60, 17 * 60 + 30), bed - 2 * 60 - act.duration);
  if (ctx.lowMood) actStart = Math.min(actStart, 16 * 60 + 30); // profiter de la lumière du jour
  add(actStart, '🏃', `${act.title} (${act.duration} min)`, act.why.join(' '), act.src);

  if (ctx.workout || profile.goal === 'prendre' || actStart < 18 * 60) add(Math.max(lunch + 3.5 * 60, actStart - 75), '🍎', 'Collation', 'Fruit + source de protéines (yaourt, amandes) pour arriver en forme à la séance et éviter les fringales.', []);

  const dinner = Math.min(Math.max(actStart + act.duration + 45, 19 * 60), bed - 3 * 60);
  add(dinner, '🍽️', 'Dîner léger', 'Au moins 3 h avant le coucher, plus léger que le déjeuner : manger tard est associé à une moins bonne glycémie et une perte de poids plus difficile.', ['garaulet2013', 'sutton2018']);

  add(bed - 60, '📵', 'Écrans off — téléphone hors de la chambre', 'L’usage du téléphone au lit est associé à un endormissement plus tardif et un sommeil de moins bonne qualité.', ['exelmans2016']);
  add(bed - 30, '🧘', 'Routine de détente', ctx.highStress || ctx.lowMood
    ? '5 min de « soupir cyclique » : deux inspirations par le nez, une longue expiration par la bouche. Améliore l’humeur et apaise (essai randomisé).'
    : 'Lumière tamisée, lecture, respiration lente ou étirements.', ctx.highStress || ctx.lowMood ? ['balban2023'] : []);
  const dow = new Date().getDay();
  if (dow === 0 || dow === 6 || ctx.lowMood) add(Math.max(wake + 3 * 60, 10 * 60 + 30), '🌳', 'Temps dans la nature', 'Parc, forêt, bord de l’eau : viser 120 min sur la semaine est associé à une meilleure santé et un meilleur moral.', ['white2019']);
  add(bed, '🌙', 'Coucher', `Même heure chaque soir (±30 min) : la régularité du sommeil prédit la mortalité mieux que sa durée. Vise ${t.sleepMin}–${t.sleepMax} h.`, ['windred2024', 'watson2015']);

  return items.sort((a, b) => a.min - b.min);
}

// ---------- Messages personnalisés ----------
export function insights(sm) {
  const out = [];
  const { w, t, body, ctx, totToday, kcalAvg, dietAvg } = sm;
  const push = (level, title, text, src = []) => out.push({ level, title, text, src });

  if (w.sleepH != null) {
    if (w.sleepH < 7) push('alerte', 'Dette de sommeil', `Tu dors ${S.round(w.sleepH, 1)} h en moyenne (objectif ${t.sleepMin}–${t.sleepMax} h). Le manque de sommeil augmente l’appétit pour les aliments sucrés et diminue la motivation à bouger.`, ['watson2015', 'cappuccio2010']);
    else push('bon', 'Durée de sommeil OK', `${S.round(w.sleepH, 1)} h/nuit en moyenne cette semaine.`, ['watson2015']);
  }
  if (w.bedVar != null && w.bedVar > 45) push('attention', 'Horaires de coucher irréguliers', `Ton heure de coucher varie de ±${Math.round(w.bedVar)} min. Fixe une heure de coucher constante, même le week-end.`, ['windred2024']);
  if (w.socialMin != null && w.socialMin > 30) push('attention', 'Réseaux sociaux', `${Math.round(w.socialMin)} min/j en moyenne. Limiter à 30 min/j a réduit solitude et symptômes dépressifs en 3 semaines dans un essai contrôlé.`, ['hunt2018']);
  if (w.screenMin != null && w.screenMin > 240) push('attention', 'Temps d’écran élevé', `${Math.round(w.screenMin / 60 * 10) / 10} h/j sur le téléphone. Remplacer 30 min d’écran par 30 min de marche = ~3000 pas de plus.`, ['banach2023']);
  if (w.phoneInBedDays >= 3) push('attention', 'Téléphone au lit', `Téléphone utilisé au lit ${w.phoneInBedDays} soirs sur 7.`, ['exelmans2016']);
  if (w.steps != null) {
    if (w.steps < t.steps) push('attention', 'Pas quotidiens', `${Math.round(w.steps)} pas/j en moyenne. Le bénéfice sur la mortalité continue jusqu’à ~${t.steps} pas/j pour ton âge.`, ['paluch2022']);
    else push('bon', 'Bien actif', `${Math.round(w.steps)} pas/j : tu es dans la zone de bénéfice maximal.`, ['paluch2022']);
  }
  const modEq = w.modMin + 2 * w.vigMin;
  if (w.loggedDays >= 3 && modEq < 150) push('attention', 'Activité modérée à soutenue', `${Math.round(modEq)} min cette semaine (équivalent modéré) sur 150 min recommandées.`, ['who2020']);
  if (w.loggedDays >= 3 && w.strength < 2) push('attention', 'Renforcement musculaire', `${w.strength} séance(s) cette semaine, 2 recommandées.`, ['who2020', 'momma2022']);
  if (body.whtr != null && body.whtr >= 0.5) push('alerte', 'Tour de taille', `Rapport tour de taille/taille = ${S.round(body.whtr, 2)} (≥ 0,5) : signe de graisse abdominale, facteur de risque cardio-métabolique.`, ['ashwell2012']);
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

export function mealSuggestions(sm, profile, slot) {
  const { t, totToday, ctx } = sm;
  const remaining = {
    kcal: Math.max(0, t.kcal - totToday.kcal),
    protein: Math.max(0, t.protein - totToday.protein),
    fiber: Math.max(0, t.fiber - totToday.fiber),
    fruitVeg: Math.max(0, t.fruitVeg - totToday.fruitVeg),
  };
  return suggestMeals(slot, { remaining, ctx, diet: profile.diet, allergies: profile.allergies });
}

export function currentSlot(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 10.5) return 'petit-dej';
  if (h < 14.5) return 'dejeuner';
  if (h < 18) return 'collation';
  return 'diner';
}
