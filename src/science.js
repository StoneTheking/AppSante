// Base de connaissances scientifiques et calculs physiologiques.
// Toutes les fonctions sont pures (testées dans tests/science.test.js).

export const SOURCES = {
  who2020: { t: "OMS 2020 – Lignes directrices sur l'activité physique et la sédentarité (Bull et al., Br J Sports Med 2020)", u: 'https://doi.org/10.1136/bjsports-2020-102955' },
  paluch2022: { t: 'Paluch et al. – Pas quotidiens et mortalité, méta-analyse de 15 cohortes (Lancet Public Health 2022)', u: 'https://doi.org/10.1016/S2468-2667(21)00302-9' },
  banach2023: { t: 'Banach et al. – Nombre de pas et mortalité toutes causes / CV (Eur J Prev Cardiol 2023)', u: 'https://doi.org/10.1093/eurjpc/zwad229' },
  ekelund2019: { t: 'Ekelund et al. – Activité mesurée par accéléromètre, sédentarité et mortalité (BMJ 2019)', u: 'https://doi.org/10.1136/bmj.l4570' },
  momma2022: { t: 'Momma et al. – Renforcement musculaire et mortalité (Br J Sports Med 2022)', u: 'https://doi.org/10.1136/bjsports-2021-105061' },
  noetel2024: { t: "Noetel et al. – L'exercice contre la dépression, méta-analyse en réseau (BMJ 2024)", u: 'https://doi.org/10.1136/bmj-2023-075847' },
  buffey2022: { t: 'Buffey et al. – Marcher après le repas et glycémie (Sports Med 2022)', u: 'https://doi.org/10.1007/s40279-022-01649-4' },
  stutz2019: { t: 'Stutz et al. – Sport le soir et sommeil, méta-analyse (Sports Med 2019)', u: 'https://doi.org/10.1007/s40279-018-1015-0' },
  watson2015: { t: "Watson et al. – Durée de sommeil recommandée chez l'adulte, consensus AASM/SRS (Sleep 2015)", u: 'https://doi.org/10.5665/sleep.4716' },
  cappuccio2010: { t: 'Cappuccio et al. – Durée de sommeil et mortalité, méta-analyse (Sleep 2010)', u: 'https://doi.org/10.1093/sleep/33.5.585' },
  windred2024: { t: 'Windred et al. – La régularité du sommeil prédit mieux la mortalité que sa durée (Sleep 2024)', u: 'https://doi.org/10.1093/sleep/zsad253' },
  gardiner2023: { t: 'Gardiner et al. – Caféine et sommeil, méta-analyse (Sleep Med Rev 2023)', u: 'https://doi.org/10.1016/j.smrv.2023.101764' },
  exelmans2016: { t: "Exelmans & Van den Bulck – Téléphone au lit et sommeil de l'adulte (Soc Sci Med 2016)", u: 'https://doi.org/10.1016/j.socscimed.2016.01.022' },
  hunt2018: { t: 'Hunt et al. – Limiter les réseaux sociaux à 30 min/j réduit solitude et dépression (J Soc Clin Psychol 2018)', u: 'https://doi.org/10.1521/jscp.2018.37.10.751' },
  burns2023: { t: 'Burns et al. – Exposition à la lumière le jour/la nuit et santé mentale (Nature Mental Health 2023)', u: 'https://doi.org/10.1038/s44220-023-00135-8' },
  mifflin1990: { t: 'Mifflin et al. – Équation de dépense énergétique de repos (Am J Clin Nutr 1990)', u: 'https://doi.org/10.1093/ajcn/51.2.241' },
  hall2011: { t: "Hall et al. – Quantification de l'effet d'un déséquilibre énergétique sur le poids (Lancet 2011)", u: 'https://doi.org/10.1016/S0140-6736(11)60812-X' },
  gbmc2016: { t: 'Global BMI Mortality Collaboration – IMC et mortalité, 239 cohortes (Lancet 2016)', u: 'https://doi.org/10.1016/S0140-6736(16)30175-1' },
  ashwell2012: { t: 'Ashwell et al. – Rapport tour de taille / taille < 0,5 (Obes Rev 2012), repris par NICE 2022', u: 'https://doi.org/10.1111/j.1467-789X.2011.00952.x' },
  gbd2019: { t: 'GBD 2017 Diet Collaborators – Risques alimentaires dans 195 pays (Lancet 2019)', u: 'https://doi.org/10.1016/S0140-6736(19)30041-8' },
  lane2024: { t: 'Lane et al. – Aliments ultra-transformés et santé, umbrella review (BMJ 2024)', u: 'https://doi.org/10.1136/bmj-2023-077310' },
  reynolds2019: { t: 'Reynolds et al. – Qualité des glucides, fibres et santé (Lancet 2019)', u: 'https://doi.org/10.1016/S0140-6736(18)31809-9' },
  aune2017: { t: 'Aune et al. – Fruits, légumes et mortalité, méta-analyse (Int J Epidemiol 2017)', u: 'https://doi.org/10.1093/ije/dyw319' },
  who2015sugar: { t: 'OMS 2015 – Apport en sucres libres < 10 % (idéalement < 5 %) des calories', u: 'https://www.who.int/publications/i/item/9789241549028' },
  who2012sodium: { t: 'OMS 2012 – Sodium < 2 g/jour (≈ 5 g de sel)', u: 'https://www.who.int/publications/i/item/9789241504836' },
  bouvard2015: { t: 'Bouvard et al. (CIRC) – Cancérogénicité des viandes rouges et transformées (Lancet Oncol 2015)', u: 'https://doi.org/10.1016/S1470-2045(15)00444-1' },
  morton2018: { t: 'Morton et al. – Protéines et gain musculaire, ~1,6 g/kg/j (Br J Sports Med 2018)', u: 'https://doi.org/10.1136/bjsports-2017-097608' },
  bauer2013: { t: 'Bauer et al. (PROT-AGE) – Protéines 1,0–1,2 g/kg après 65 ans (JAMDA 2013)', u: 'https://doi.org/10.1016/j.jamda.2013.05.021' },
  jacka2017: { t: 'Jacka et al. – Essai SMILES : alimentation méditerranéenne et dépression (BMC Med 2017)', u: 'https://doi.org/10.1186/s12916-017-0791-y' },
  estruch2018: { t: 'Estruch et al. – PREDIMED, régime méditerranéen et maladies CV (NEJM 2018)', u: 'https://doi.org/10.1056/NEJMoa1800389' },
  sofi2010: { t: 'Sofi et al. – Adhésion méditerranéenne : +2 points = −8 % de mortalité (Am J Clin Nutr 2010)', u: 'https://doi.org/10.3945/ajcn.2010.29673' },
  sutton2018: { t: "Sutton et al. – Manger tôt dans la journée améliore la sensibilité à l'insuline (Cell Metab 2018)", u: 'https://doi.org/10.1016/j.cmet.2018.04.010' },
  garaulet2013: { t: 'Garaulet et al. – Le moment des repas prédit la perte de poids (Int J Obes 2013)', u: 'https://doi.org/10.1038/ijo.2012.229' },
  efsa2010water: { t: 'EFSA 2010 – Apports en eau : 2,0 L/j (femmes), 2,5 L/j (hommes), boissons + aliments', u: 'https://doi.org/10.2903/j.efsa.2010.1459' },
  gbd2018alcohol: { t: "GBD 2016 Alcohol Collaborators – Pas de niveau d'alcool sans risque (Lancet 2018)", u: 'https://doi.org/10.1016/S0140-6736(18)31310-2' },
};

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

export function age(birthYear, now = new Date()) {
  return birthYear ? now.getFullYear() - birthYear : 35;
}

export function bmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function bmiCategory(b) {
  if (b == null) return '—';
  if (b < 18.5) return 'Insuffisance pondérale';
  if (b < 25) return 'Corpulence normale';
  if (b < 30) return 'Surpoids';
  if (b < 35) return 'Obésité modérée';
  if (b < 40) return 'Obésité sévère';
  return 'Obésité massive';
}

// Mifflin-St Jeor (kcal/j)
export function bmr({ weight, height, sex, birthYear }) {
  if (!weight || !height) return null;
  const base = 10 * weight + 6.25 * height - 5 * age(birthYear);
  return sex === 'f' ? base - 161 : base + 5;
}

export const PAL = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725, tres_actif: 1.9 };

export function tdee(profile) {
  const b = bmr(profile);
  return b ? b * (PAL[profile.activityLevel] || 1.375) : null;
}

// Estimation du % de masse grasse (Deurenberg 1991) — indicative.
export function bodyFat(profile) {
  const b = bmi(profile.weight, profile.height);
  if (!b) return null;
  return 1.2 * b + 0.23 * age(profile.birthYear) - 10.8 * (profile.sex === 'f' ? 0 : 1) - 5.4;
}

export function waistToHeight(waist, height) {
  return waist && height ? waist / height : null;
}

// Objectifs nutritionnels quotidiens personnalisés.
export function targets(profile) {
  const t = tdee(profile) || 2000;
  const a = age(profile.birthYear);
  let kcal = t;
  if (profile.goal === 'perdre') kcal = Math.max(t - 500, (bmr(profile) || 1400) * 1.1); // ~0,5 kg/sem
  if (profile.goal === 'prendre') kcal = t + 300;
  const w = profile.weight || 70;
  let protPerKg = a >= 65 ? 1.2 : 1.0;
  if (profile.goal === 'prendre' || ['actif', 'tres_actif'].includes(profile.activityLevel)) protPerKg = 1.6;
  if (profile.goal === 'perdre') protPerKg = Math.max(protPerKg, 1.4); // préserver la masse maigre
  return {
    kcal: Math.round(kcal),
    protein: Math.round(w * protPerKg),
    fiber: profile.sex === 'f' ? 25 : 30,
    sugarMax: Math.round((kcal * 0.1) / 4), // sucres libres < 10 %
    satFatMax: Math.round((kcal * 0.1) / 9),
    sodiumMax: 2000, // mg
    fruitVeg: 400, // g, OMS ; 800 g = risque le plus bas (Aune 2017)
    waterMl: profile.sex === 'f' ? 1600 : 2000, // part boissons (~80 % de l'EFSA)
    steps: a >= 60 ? 7000 : 8500,
    modMinWeek: 150,
    strengthPerWeek: 2,
    sleepMin: 7,
    sleepMax: a >= 65 ? 8 : 9,
  };
}

// ---------- Sommeil ----------
export function sleepHours(bed, wake) {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let d = wh * 60 + wm - (bh * 60 + bm);
  if (d <= 0) d += 24 * 60;
  return d / 60;
}

function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  let x = h * 60 + m;
  if (x < 12 * 60) x += 24 * 60; // coucher après minuit
  return x;
}

// Écart-type de l'heure de coucher (min) — proxy de la régularité.
export function bedtimeVariability(beds) {
  const xs = beds.filter(Boolean).map(minutesOfDay);
  if (xs.length < 3) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

// ---------- Scores 0–100 ----------
export function sleepScore(hours, quality, variability) {
  if (hours == null) return null;
  let s = 100;
  if (hours < 7) s -= (7 - hours) * 22;
  if (hours > 9) s -= (hours - 9) * 15;
  if (quality) s -= (5 - quality) * 6;
  if (variability != null && variability > 30) s -= Math.min(20, (variability - 30) / 3);
  return Math.round(clamp(s, 0, 100));
}

export function activityScore({ steps, modMin, vigMin, strengthMin }, t) {
  if (steps == null && modMin == null && vigMin == null) return null;
  const stepPart = clamp((steps || 0) / t.steps, 0, 1.2) * 55;
  const minPart = clamp(((modMin || 0) + 2 * (vigMin || 0)) / 30, 0, 1.2) * 35; // ~150/sem ≈ 22-30/j
  const strPart = strengthMin ? 10 : 0;
  return Math.round(clamp(stepPart + minPart + strPart, 0, 100));
}

export function digitalScore({ screenMin, socialMin, phoneInBed, unlocks }) {
  if (screenMin == null && socialMin == null && phoneInBed == null) return null;
  let s = 100;
  if (screenMin != null && screenMin > 120) s -= Math.min(35, (screenMin - 120) / 6);
  if (socialMin != null && socialMin > 30) s -= Math.min(30, (socialMin - 30) / 3);
  if (phoneInBed) s -= 15;
  if (unlocks != null && unlocks > 60) s -= Math.min(10, (unlocks - 60) / 6);
  return Math.round(clamp(s, 0, 100));
}

export function moodScore({ mood, energy, stress }) {
  const xs = [];
  if (mood) xs.push((mood - 1) / 4);
  if (energy) xs.push((energy - 1) / 4);
  if (stress) xs.push((5 - stress) / 4);
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100);
}

// Somme des nutriments d'une liste de repas.
export function sumNutrients(meals) {
  const keys = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satFat', 'fiber', 'sodium', 'fruitVeg'];
  const tot = Object.fromEntries(keys.map((k) => [k, 0]));
  let upfKcal = 0;
  for (const m of meals) {
    const n = m.nutrients || {};
    for (const k of keys) tot[k] += Number(n[k]) || 0;
    if ((m.nova || 0) >= 4) upfKcal += Number(n.kcal) || 0;
  }
  tot.upfShare = tot.kcal ? upfKcal / tot.kcal : 0;
  return tot;
}

// Qualité nutritionnelle d'une journée, inspirée des facteurs de risque GBD 2017.
export function dietScore(tot, t) {
  if (!tot || !tot.kcal) return null;
  let s = 0;
  s += clamp(tot.fiber / t.fiber, 0, 1) * 20;
  s += clamp(tot.fruitVeg / t.fruitVeg, 0, 1) * 20;
  s += clamp(tot.protein / t.protein, 0, 1) * 15;
  s += (tot.sugar <= t.sugarMax ? 1 : clamp(1 - (tot.sugar - t.sugarMax) / t.sugarMax, 0, 1)) * 10;
  s += (tot.satFat <= t.satFatMax ? 1 : clamp(1 - (tot.satFat - t.satFatMax) / t.satFatMax, 0, 1)) * 10;
  s += (tot.sodium <= t.sodiumMax ? 1 : clamp(1 - (tot.sodium - t.sodiumMax) / t.sodiumMax, 0, 1)) * 10;
  s += clamp(1 - tot.upfShare / 0.5, 0, 1) * 15; // ultra-transformés (Lane 2024)
  return Math.round(s);
}

// ---------- Risques relatifs (mortalité toutes causes, profil de référence = 1) ----------
// Approximations issues de méta-analyses ; associations observationnelles, pas des diagnostics.
export function riskFactors({ steps, sleepH, bmiV, diet, strengthWeek, alcoholWeek, smoker }) {
  const f = [];
  if (steps != null) {
    const s = clamp(steps, 2000, 12000);
    f.push({ key: 'steps', label: 'Pas quotidiens', value: `${Math.round(steps)} pas/j`, rr: 0.85 ** ((s - 8000) / 1000), src: ['banach2023', 'paluch2022'] });
  }
  if (sleepH != null) {
    const rr = sleepH < 6 ? 1.12 : sleepH > 9 ? 1.3 : 1;
    f.push({ key: 'sleep', label: 'Durée de sommeil', value: `${round(sleepH, 1)} h/nuit`, rr, src: ['cappuccio2010'] });
  }
  if (bmiV != null) {
    let rr = 1;
    if (bmiV >= 25) rr = 1.39 ** ((bmiV - 22.5) / 5) / 1.39 ** 0.5;
    if (bmiV < 18.5) rr = 1.51;
    else if (bmiV < 20) rr = 1.13;
    f.push({ key: 'bmi', label: 'Corpulence (IMC)', value: round(bmiV, 1), rr: Math.max(1, rr), src: ['gbmc2016'] });
  }
  if (diet != null) {
    // score alimentaire 0–100 ↔ adhésion méditerranéenne 0–9 ; +2 points = RR 0,92 (Sofi 2010)
    const med = (diet / 100) * 9;
    f.push({ key: 'diet', label: 'Qualité alimentaire', value: `${Math.round(diet)}/100`, rr: 0.92 ** ((med - 6) / 2), src: ['sofi2010', 'gbd2019'] });
  }
  if (strengthWeek != null) {
    f.push({ key: 'strength', label: 'Renforcement musculaire', value: `${strengthWeek} séance(s)/sem`, rr: strengthWeek >= 2 ? 0.85 : strengthWeek >= 1 ? 0.92 : 1, src: ['momma2022'] });
  }
  if (alcoholWeek != null && alcoholWeek > 0) {
    // GBD 2016 : +0,5 % à 1 verre/j, +7 % à 2 verres/j, +37 % à 5 verres/j (interpolation linéaire)
    const d = alcoholWeek / 7;
    const rr = d <= 1 ? 1 + 0.005 * d : d <= 2 ? 1.005 + 0.065 * (d - 1) : 1.07 + 0.1 * (d - 2);
    f.push({ key: 'alcohol', label: 'Alcool', value: `${alcoholWeek} verres/sem`, rr, src: ['gbd2018alcohol'] });
  }
  if (smoker) f.push({ key: 'smoke', label: 'Tabac', value: 'fumeur', rr: 2.0, src: [] });
  return f;
}

export const combinedRR = (factors) => factors.reduce((a, f) => a * f.rr, 1);

// ---------- Projection du poids (modèle de Hall simplifié) ----------
// Un écart soutenu de 22 kcal/j ≈ 1 kg à l'équilibre ; ~95 % atteint en ~3 ans.
export function projectWeight(weight, kcalBalance, days) {
  const eq = kcalBalance / 22;
  const tau = 365;
  return weight + eq * (1 - Math.exp(-days / tau));
}

// Courbe complète pour un graphique.
export function weightCurve(weight, kcalBalance, years = 5, step = 30) {
  const pts = [];
  for (let d = 0; d <= years * 365; d += step) pts.push({ d, w: projectWeight(weight, kcalBalance, d) });
  return pts;
}
