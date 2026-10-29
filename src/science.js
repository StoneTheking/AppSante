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
  exelmans2016: { t: "Exelmans & Van den Bulck – Téléphone au lit et sommeil de l'adulte (Soc Sci Med 2016)", u: 'https://doi.org/10.1016/j.socscimed.2015.11.037' },
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
  stamatakis2022: { t: "Stamatakis et al. – Activité intense intermittente au quotidien (VILPA) et mortalité (Nature Medicine 2022)", u: 'https://doi.org/10.1038/s41591-022-02100-x' },
  ekelund2016: { t: 'Ekelund et al. – 60-75 min/j d’activité modérée compensent la sédentarité (Lancet 2016)', u: 'https://doi.org/10.1016/S0140-6736(16)30370-1' },
  duran2023: { t: 'Duran et al. – 5 min de marche toutes les 30 min réduisent glycémie et tension (Med Sci Sports Exerc 2023)', u: 'https://doi.org/10.1249/MSS.0000000000003109' },
  dossantos2022: { t: 'dos Santos et al. – « Guerrier du week-end » : mêmes bénéfices que l’activité étalée (JAMA Intern Med 2022)', u: 'https://doi.org/10.1001/jamainternmed.2022.2488' },
  mandsager2018: { t: 'Mandsager et al. – La condition cardio-respiratoire, premier prédicteur de longévité (JAMA Netw Open 2018)', u: 'https://doi.org/10.1001/jamanetworkopen.2018.3605' },
  zhang2016: { t: 'Zhang et al. – FC de repos : +10 bpm = +9 % de mortalité, méta-analyse (CMAJ 2016)', u: 'https://doi.org/10.1503/cmaj.150535' },
  kredlow2015: { t: 'Kredlow et al. – L’activité physique améliore le sommeil, méta-analyse (J Behav Med 2015)', u: 'https://doi.org/10.1007/s10865-015-9617-6' },
  alkhatib2017: { t: 'Al Khatib et al. – Le manque de sommeil fait manger ~385 kcal de plus par jour (Eur J Clin Nutr 2017)', u: 'https://doi.org/10.1038/ejcn.2016.201' },
  tasali2022: { t: 'Tasali et al. – Allonger son sommeil réduit l’apport calorique de ~270 kcal/j, essai randomisé (JAMA Intern Med 2022)', u: 'https://doi.org/10.1001/jamainternmed.2021.8098' },
  vujovic2022: { t: 'Vujović et al. – Manger tard augmente la faim et réduit la dépense énergétique (Cell Metab 2022)', u: 'https://doi.org/10.1016/j.cmet.2022.09.007' },
  hall2019: { t: 'Hall et al. – Essai contrôlé : les ultra-transformés font manger +500 kcal/j (Cell Metab 2019)', u: 'https://doi.org/10.1016/j.cmet.2019.05.008' },
  aune2016grains: { t: 'Aune et al. – 90 g/j de céréales complètes : −17 % de mortalité (BMJ 2016)', u: 'https://doi.org/10.1136/bmj.i2716' },
  aune2016nuts: { t: 'Aune et al. – 28 g/j de fruits à coque : −22 % de mortalité (BMC Med 2016)', u: 'https://doi.org/10.1186/s12916-016-0730-3' },
  malik2019: { t: 'Malik et al. – Boissons sucrées et mortalité (Circulation 2019)', u: 'https://doi.org/10.1161/CIRCULATIONAHA.118.037401' },
  poole2017: { t: 'Poole et al. – Café : 3-4 tasses/j associées à moins de mortalité, umbrella review (BMJ 2017)', u: 'https://doi.org/10.1136/bmj.j5024' },
  schoenfeld2018: { t: 'Schoenfeld & Aragon – Répartir les protéines : ~0,4 g/kg par repas, 4 repas (JISSN 2018)', u: 'https://doi.org/10.1186/s12970-018-0215-1' },
  white2019: { t: 'White et al. – 120 min/semaine dans la nature et bien-être (Scientific Reports 2019)', u: 'https://doi.org/10.1038/s41598-019-44097-3' },
  holtlunstad2010: { t: 'Holt-Lunstad et al. – Liens sociaux et mortalité, méta-analyse (PLoS Med 2010)', u: 'https://doi.org/10.1371/journal.pmed.1000316' },
  balban2023: { t: 'Balban et al. – Respiration « soupir cyclique » 5 min/j et humeur, essai randomisé (Cell Rep Med 2023)', u: 'https://doi.org/10.1016/j.xcrm.2022.100895' },
  braghieri2022: { t: 'Braghieri et al. – L’arrivée de Facebook a dégradé la santé mentale des étudiants (American Economic Review 2022)', u: 'https://doi.org/10.1257/aer.20211218' },
  lowe2020: { t: 'Lowe et al. – Jeûne intermittent 16:8 sans avantage sur le poids, essai TREAT (JAMA Intern Med 2020)', u: 'https://doi.org/10.1001/jamainternmed.2020.4153' },
  firth2019: { t: 'Firth et al. – Interventions nutritionnelles et symptômes dépressifs, méta-analyse (Psychosom Med 2019)', u: 'https://doi.org/10.1097/PSY.0000000000000673' },
  delpozo2022: { t: 'del Pozo Cruz et al. – ~9800 pas/j et cadence élevée : −50 % de risque de démence (JAMA Neurol 2022)', u: 'https://doi.org/10.1001/jamaneurol.2022.2672' },
  drake2013: { t: 'Drake et al. – Caféine 6 h avant le coucher : −1 h de sommeil (J Clin Sleep Med 2013)', u: 'https://doi.org/10.5664/jcsm.3170' },
  ebrahim2013: { t: 'Ebrahim et al. – Alcool et architecture du sommeil (Alcohol Clin Exp Res 2013)', u: 'https://doi.org/10.1111/acer.12006' },
  chang2015: { t: 'Chang et al. – Lire sur écran le soir retarde l’horloge et la mélatonine (PNAS 2015)', u: 'https://doi.org/10.1073/pnas.1418490112' },
  anses2016: { t: 'ANSES 2016 – Repères alimentaires (légumineuses 2×/sem, poisson 2×/sem, viande rouge ≤ 500 g/sem)', u: 'https://www.anses.fr/fr/content/les-nouveaux-rep%C3%A8res-de-consommation-alimentaires' },
  phillips2017: { t: 'Phillips et al. – Horaires de sommeil irréguliers et retard de l’horloge interne, indice de régularité (Sci Rep 2017)', u: 'https://doi.org/10.1038/s41598-017-03171-4' },
  ohayon2017: { t: 'Ohayon et al. – Critères d’un sommeil de qualité : endormissement ≤ 30 min, efficacité ≥ 85 % (Sleep Health 2017)', u: 'https://doi.org/10.1016/j.sleh.2016.11.006' },
  obradovich2017: { t: 'Obradovich et al. – Nuits chaudes et perte de sommeil (Science Advances 2017)', u: 'https://doi.org/10.1126/sciadv.1601555' },
  who2021air: { t: 'OMS 2021 – Lignes directrices sur la qualité de l’air (PM2,5 ≤ 15 µg/m³ sur 24 h, ≤ 5 µg/m³ par an)', u: 'https://www.who.int/publications/i/item/9789240034228' },
  andersen2015: { t: 'Andersen et al. – Les bénéfices de l’activité physique dépassent les effets de la pollution (Environ Health Perspect 2015)', u: 'https://doi.org/10.1289/ehp.1408698' },
  tainio2016: { t: 'Tainio et al. – La pollution peut-elle annuler les bénéfices du vélo et de la marche ? (Prev Med 2016)', u: 'https://doi.org/10.1016/j.ypmed.2016.02.002' },
  sinharay2018: { t: 'Sinharay et al. – Marcher dans une rue polluée annule les bénéfices cardio-respiratoires, pas dans un parc (Lancet 2018)', u: 'https://doi.org/10.1016/S0140-6736(17)32643-0' },
  ebi2021: { t: 'Ebi et al. – Fortes chaleurs : risques pour la santé et prévention (Lancet 2021)', u: 'https://doi.org/10.1016/S0140-6736(21)01208-3' },
  whouv: { t: 'OMS – Indice UV : se protéger dès un indice de 3', u: 'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-(uv)-index' },
  lewis1997: { t: 'Lewis & Heaton – Échelle de Bristol, reflet du temps de transit intestinal (Scand J Gastroenterol 1997)', u: 'https://doi.org/10.3109/00365529709011203' },
  heaton1992: { t: 'Heaton et al. – Fréquence et forme des selles dans la population générale (Gut 1992)', u: 'https://doi.org/10.1136/gut.33.6.818' },
  asnicar2021: { t: 'Asnicar et al. – « Blue poo » : temps de transit intestinal et microbiote (Gut 2021)', u: 'https://doi.org/10.1136/gutjnl-2020-323877' },
  vandeputte2016: { t: 'Vandeputte et al. – Consistance des selles et richesse du microbiote (Gut 2016)', u: 'https://doi.org/10.1136/gutjnl-2015-309618' },
  halmos2014: { t: 'Halmos et al. – Régime pauvre en FODMAP et symptômes du côlon irritable, essai randomisé (Gastroenterology 2014)', u: 'https://doi.org/10.1053/j.gastro.2013.09.046' },
  hammons2011: { t: 'Hammons & Fiese – Repas en famille ≥ 3 fois/semaine et santé nutritionnelle des enfants (Pediatrics 2011)', u: 'https://doi.org/10.1542/peds.2010-1440' },
  dansinger2005: { t: 'Dansinger et al. – C’est l’adhésion, plus que le type de régime, qui fait perdre du poids (JAMA 2005)', u: 'https://doi.org/10.1001/jama.293.1.43' },
  efsa2013energy: { t: 'EFSA 2013 – Valeurs de référence pour l’énergie (enfants et adultes)', u: 'https://doi.org/10.2903/j.efsa.2013.3005' },
  perry2024: { t: 'Perry et al. – Analyse NOVA des tickets de caisse des ménages (Curr Dev Nutr 2024)', u: 'https://doi.org/10.1016/j.cdnut.2024.102850' },
  parker2020: { t: 'Parker et al. – La qualité des achats alimentaires du foyer reflète la qualité de l’alimentation (Br J Nutr 2020)', u: 'https://doi.org/10.1017/S0007114520004833' },
  ciman2019: { t: 'Ciman & Wac – Le smartphone comme capteur de durée de sommeil, algorithme iSenseSleep validé (JMIR mHealth 2019)', u: 'https://doi.org/10.2196/11930' },
  tanaka2001: { t: 'Tanaka et al. – Fréquence cardiaque maximale = 208 − 0,7 × âge (J Am Coll Cardiol 2001)', u: 'https://doi.org/10.1016/S0735-1097(00)01054-8' },
  herrmann2024: { t: 'Herrmann et al. – Compendium 2024 des dépenses énergétiques des activités (J Sport Health Sci 2024)', u: 'https://doi.org/10.1016/j.jshs.2023.10.010' },
  acsm2009: { t: 'ACSM – Modèles de progression en musculation chez l’adulte (Med Sci Sports Exerc 2009)', u: 'https://doi.org/10.1249/MSS.0b013e3181915670' },
  schoenfeld2016: { t: 'Schoenfeld et al. – Travailler chaque muscle 2×/semaine favorise l’hypertrophie (Sports Med 2016)', u: 'https://doi.org/10.1007/s40279-016-0543-8' },
  milanovic2016: { t: 'Milanović et al. – Le fractionné (HIIT) améliore davantage la VO2max que l’endurance continue (Sports Med 2016)', u: 'https://doi.org/10.1007/s40279-015-0365-0' },
  knaier2021: { t: 'Knaier et al. – Force et endurance maximales en fin d’après-midi et le soir, méta-analyse (Med Sci Sports Exerc 2021)', u: 'https://doi.org/10.1249/MSS.0000000000002773' },
  bruggisser2023: { t: 'Bruggisser et al. – Pas de meilleur moment universel pour s’entraîner : la régularité prime (Sports Med Open 2023)', u: 'https://doi.org/10.1186/s40798-023-00577-5' },
  sorensen2020: { t: 'Sørensen et al. – Le « test de la parole » pour régler l’intensité (J Cardiopulm Rehabil Prev 2020)', u: 'https://doi.org/10.1097/HCR.0000000000000506' },
  helgerud2007: { t: 'Helgerud et al. – Intervalles 4 × 4 min à 90–95 % FCmax : meilleur gain de VO2max (Med Sci Sports Exerc 2007)', u: 'https://doi.org/10.1249/mss.0b013e3180304570' },
  gibala2012: { t: 'Gibala et al. – Fractionné court (10 × 1 min) : adaptations comparables à l’endurance (J Physiol 2012)', u: 'https://doi.org/10.1113/jphysiol.2011.224725' },
  soligard2008: { t: 'Soligard et al. – Un échauffement structuré réduit les blessures d’environ un tiers, essai randomisé (BMJ 2008)', u: 'https://doi.org/10.1136/bmj.a2469' },
  lauersen2014: { t: 'Lauersen et al. – Le renforcement musculaire divise par 3 le risque de blessure sportive ; l’étirement seul n’en protège pas (Br J Sports Med 2014)', u: 'https://doi.org/10.1136/bjsports-2013-092538' },
  schoenfeld2017: { t: 'Schoenfeld et al. – ≥ 10 séries par muscle et par semaine pour maximiser le gain musculaire (J Sports Sci 2017)', u: 'https://doi.org/10.1080/02640414.2016.1210197' },
  cramer2013: { t: 'Cramer et al. – Yoga et symptômes dépressifs, méta-analyse (Depress Anxiety 2013)', u: 'https://doi.org/10.1002/da.22166' },
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
export function riskFactors({ steps, sleepH, bmiV, diet, strengthWeek, alcoholWeek, smoker, restingHR }) {
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
  if (restingHR != null) {
    // +10 bpm ≈ RR 1,09 (Zhang 2016), référence 60 bpm, borné à 45-100
    const r = clamp(restingHR, 45, 100);
    f.push({ key: 'rhr', label: 'FC au repos', value: `${Math.round(restingHR)} bpm`, rr: 1.09 ** ((r - 60) / 10), src: ['zhang2016'] });
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

// Bibliothèque : principaux résultats chiffrés, par thème. Utilisée par l'écran « Science » et le coach IA.
export const EVIDENCE = [
  { theme: 'Activité physique', icon: 'steps', color: 'var(--c-move)', facts: [
    ['150–300 min/semaine d’activité modérée (ou 75–150 min intense) + 2 séances de renforcement : la base recommandée.', ['who2020']],
    ['Chaque +1000 pas/jour ≈ −15 % de mortalité toutes causes ; bénéfice maximal vers 6000–8000 pas (≥ 60 ans) et 8000–10 000 pas (< 60 ans).', ['banach2023', 'paluch2022']],
    ['≈ 9800 pas/jour, surtout à cadence soutenue, sont associés à un risque de démence divisé par deux.', ['delpozo2022']],
    ['3 « snacks d’exercice » de 1–2 min intenses par jour (escaliers, marche très rapide) : −38 à −40 % de mortalité.', ['stamatakis2022']],
    ['60–75 min/jour d’activité modérée effacent le sur-risque lié à 8 h assis.', ['ekelund2016']],
    ['5 min de marche légère toutes les 30 min de position assise réduisent la glycémie et la tension.', ['duran2023']],
    ['Concentrer son activité sur le week-end apporte les mêmes bénéfices que l’étaler : ce qui compte, c’est le volume.', ['dossantos2022']],
    ['30–60 min/semaine de renforcement musculaire : −10 à −17 % de mortalité, cancers et maladies cardiovasculaires.', ['momma2022']],
    ['La condition cardio-respiratoire est le facteur le plus fortement lié à la longévité, devant le tabac et le diabète.', ['mandsager2018']],
    ['FC de repos : chaque +10 bpm ≈ +9 % de mortalité ; l’endurance la fait baisser.', ['zhang2016']],
    ['Marche, footing, yoga et musculation réduisent les symptômes dépressifs autant qu’une psychothérapie.', ['noetel2024']],
    ['Intensité : FC max ≈ 208 − 0,7 × âge ; modéré ≈ 64–76 % (on peut parler mais pas chanter), intense ≈ 77–95 % (quelques mots seulement).', ['tanaka2001', 'sorensen2020']],
    ['Le fractionné (HIIT) améliore davantage la capacité cardio-respiratoire (VO2max) que l’endurance continue, en moins de temps.', ['milanovic2016']],
    ['Musculation : 2–3 séances/semaine, 8–12 répétitions, chaque groupe musculaire 2 fois/semaine, 48 h de récupération entre deux séances du même muscle.', ['acsm2009', 'schoenfeld2016']],
    ['Force et endurance sont maximales en fin d’après-midi et le soir ; mais le meilleur moment pour progresser est celui où tu peux être régulier.', ['knaier2021', 'bruggisser2023']],
    ['Calories dépensées ≈ MET × poids (kg) × durée (h), d’après le Compendium des activités.', ['herrmann2024']],
    ['Intervalles 4 × 4 min à 90–95 % de la FC max (récupération active 3 min) : le format qui améliore le plus la VO2max ; 10 × 1 min convient aux débutants.', ['helgerud2007', 'gibala2012']],
    ['Un échauffement structuré de 10 min réduit les blessures d’environ un tiers ; le renforcement musculaire les divise par trois, l’étirement seul ne protège pas.', ['soligard2008', 'lauersen2014']],
    ['Gain musculaire : viser au moins 10 séries par muscle et par semaine, réparties sur 2 séances.', ['schoenfeld2017', 'schoenfeld2016']],
  ] },
  { theme: 'Sommeil', icon: 'moon', color: 'var(--c-sleep)', facts: [
    ['7–9 h par nuit chez l’adulte (7–8 h après 65 ans).', ['watson2015']],
    ['Dormir < 6 h : +12 % de mortalité ; > 9 h : association à +30 % (souvent signe d’une maladie sous-jacente).', ['cappuccio2010']],
    ['La régularité des horaires prédit mieux la mortalité que la durée de sommeil.', ['windred2024']],
    ['Le manque de sommeil fait manger ~385 kcal de plus par jour ; allonger son sommeil réduit l’apport d’environ 270 kcal/j.', ['alkhatib2017', 'tasali2022']],
    ['Caféine : 6 h avant le coucher, elle retire encore ~1 h de sommeil ; arrêter ~8 h avant pour un café.', ['drake2013', 'gardiner2023']],
    ['L’alcool accélère l’endormissement mais fragmente la seconde moitié de nuit et réduit le sommeil paradoxal.', ['ebrahim2013']],
    ['Lire sur écran le soir retarde la mélatonine et l’horloge interne ; le téléphone au lit dégrade le sommeil.', ['chang2015', 'exelmans2016']],
    ['L’activité physique régulière améliore la qualité du sommeil ; le sport le soir ne gêne pas, sauf intense < 1 h avant le coucher.', ['kredlow2015', 'stutz2019']],
    ['La lumière du jour le matin et l’obscurité le soir sont associées à moins de dépression et d’anxiété.', ['burns2023']],
    ['L’heure de réveil peut être estimée à partir des déverrouillages du téléphone (méthode validée) ; un réveil nocturne bref avec le téléphone fragmente le sommeil.', ['ciman2019', 'ohayon2017']],
    ['Des horaires irréguliers décalent l’horloge interne (~2 h chez les plus irréguliers), comme un décalage horaire permanent.', ['phillips2017']],
    ['Sommeil de qualité : endormissement en ≤ 30 min, ≤ 1 réveil de plus de 5 min, efficacité (temps endormi / temps au lit) ≥ 85 %.', ['ohayon2017']],
    ['Les nuits chaudes réduisent le sommeil ; une chambre fraîche (≈ 16–19 °C) et aérée aide à mieux dormir.', ['obradovich2017']],
  ] },
  { theme: 'Alimentation', icon: 'salad', color: 'var(--c-food)', facts: [
    ['Les 3 premiers risques alimentaires mondiaux : trop de sel, pas assez de céréales complètes, pas assez de fruits.', ['gbd2019']],
    ['Le modèle méditerranéen réduit d’environ 30 % les accidents cardiovasculaires (essai PREDIMED) ; +2 points d’adhésion ≈ −8 % de mortalité.', ['estruch2018', 'sofi2010']],
    ['25–29 g de fibres/jour : −15 à −30 % de mortalité et de maladies chroniques.', ['reynolds2019']],
    ['800 g/jour de fruits et légumes = risque le plus bas (au moins 400 g recommandés).', ['aune2017']],
    ['90 g/jour de céréales complètes : −17 % de mortalité.', ['aune2016grains']],
    ['Une poignée (28 g) de fruits à coque par jour : −22 % de mortalité.', ['aune2016nuts']],
    ['Ultra-transformés : risques accrus de maladies cardiovasculaires, diabète, dépression ; en essai contrôlé, +500 kcal/jour consommées spontanément.', ['lane2024', 'hall2019']],
    ['Boissons sucrées : associées à une mortalité plus élevée, dose-dépendante.', ['malik2019']],
    ['Sucres libres < 10 % des calories (idéalement < 5 %) ; sel < 5 g/jour.', ['who2015sugar', 'who2012sodium']],
    ['Viande transformée cancérogène avérée, viande rouge probable : ≤ 150 g de charcuterie et ≤ 500 g de viande rouge par semaine.', ['bouvard2015', 'anses2016']],
    ['Légumineuses au moins 2×/semaine, poisson 2×/semaine dont un gras.', ['anses2016']],
    ['Protéines : 1,6 g/kg pour progresser en musculation, ~0,4 g/kg par repas réparties sur la journée ; 1,0–1,2 g/kg après 65 ans.', ['morton2018', 'schoenfeld2018', 'bauer2013']],
    ['Café : 3–4 tasses/jour associées à une mortalité plus faible (hors grossesse).', ['poole2017']],
    ['Pas de niveau de consommation d’alcool sans risque.', ['gbd2018alcohol']],
  ] },
  { theme: 'Horaires des repas', icon: 'clock', color: 'var(--primary)', facts: [
    ['Manger plus tôt dans la journée améliore la sensibilité à l’insuline et la tension, même sans perte de poids.', ['sutton2018']],
    ['Déjeuner tardif (après 15 h) : perte de poids moins efficace à apports égaux.', ['garaulet2013']],
    ['Manger tard augmente la faim, réduit la dépense énergétique et favorise le stockage des graisses.', ['vujovic2022']],
    ['Le jeûne intermittent 16:8 n’a pas fait mieux qu’une répartition classique pour perdre du poids.', ['lowe2020']],
    ['Une marche de 10–15 min après le repas réduit nettement le pic de glycémie.', ['buffey2022']],
  ] },
  { theme: 'Environnement', icon: 'leaf', color: 'var(--c-screen)', facts: [
    ['Particules fines PM2,5 : l’OMS recommande ≤ 15 µg/m³ sur 24 h et ≤ 5 µg/m³ en moyenne annuelle.', ['who2021air']],
    ['Même en ville polluée, les bénéfices de l’activité physique l’emportent sur les effets de la pollution, sauf pics extrêmes.', ['andersen2015', 'tainio2016']],
    ['Marcher 2 h dans une rue à fort trafic annule les bénéfices cardio-respiratoires observés en marchant dans un parc.', ['sinharay2018']],
    ['Fortes chaleurs : bouger tôt le matin ou le soir, boire régulièrement, se rafraîchir ; risque accru pour le cœur et les reins.', ['ebi2021']],
    ['Indice UV ≥ 3 : se protéger (ombre, vêtements, crème) entre 11 h et 16 h.', ['whouv']],
  ] },
  { theme: 'Digestion', icon: 'activity', color: 'var(--c-food)', facts: [
    ['L’échelle de Bristol (types 1 à 7) reflète le temps de transit : types 1–2 = transit lent, 6–7 = transit rapide, 3–4 = idéal.', ['lewis1997']],
    ['Normal : de 3 selles par semaine à 3 par jour ; la plupart des gens vont à la selle une fois par jour, le matin.', ['heaton1992']],
    ['Le temps de transit (≈ 1 jour en médiane, de quelques heures à plus de 3 jours) influence le microbiote et la santé métabolique.', ['asnicar2021']],
    ['Des selles plus molles ou plus dures sont liées à un microbiote différent : la consistance est un indicateur de santé intestinale.', ['vandeputte2016']],
    ['En cas de troubles digestifs récurrents, un régime pauvre en FODMAP réduit les symptômes du côlon irritable (avec un professionnel).', ['halmos2014']],
    ['Les fibres et une bonne hydratation régularisent le transit.', ['reynolds2019']],
  ] },
  { theme: 'Famille, goûts & courses', icon: 'chef', color: 'var(--c-mood)', facts: [
    ['Partager au moins 3 repas en famille par semaine : enfants mieux nourris et moins de surpoids (−12 %).', ['hammons2011']],
    ['Pour perdre du poids, l’adhésion compte plus que le type de régime : un plan adapté à tes goûts est un plan que tu suis.', ['dansinger2005']],
    ['La qualité des achats du foyer reflète la qualité de l’alimentation : le chariot est un levier.', ['parker2020', 'perry2024']],
    ['Besoins énergétiques des enfants : de ~1000 kcal (1–3 ans) à ~2000–2700 kcal (15–17 ans).', ['efsa2013energy']],
  ] },
  { theme: 'Écrans & santé mentale', icon: 'phone', color: 'var(--c-screen)', facts: [
    ['Limiter les réseaux sociaux à 30 min/jour pendant 3 semaines réduit solitude et symptômes dépressifs (essai contrôlé).', ['hunt2018']],
    ['L’arrivée de Facebook dans les universités américaines a fait augmenter la dépression et l’anxiété des étudiants.', ['braghieri2022']],
    ['120 min/semaine passées dans la nature sont associées à une meilleure santé et un meilleur bien-être.', ['white2019']],
    ['Des liens sociaux solides augmentent de 50 % les chances de survie, autant qu’arrêter de fumer.', ['holtlunstad2010']],
    ['5 min/jour de respiration lente (« soupir cyclique » : double inspiration, longue expiration) améliorent l’humeur.', ['balban2023']],
    ['Améliorer son alimentation réduit les symptômes dépressifs (essai SMILES, méta-analyse de 16 essais).', ['jacka2017', 'firth2019']],
  ] },
];

// Version texte pour le coach IA.
export const evidenceText = (themes) => EVIDENCE.filter((t) => !themes || themes.includes(t.theme)).map((t) => `## ${t.theme}\n${t.facts.map(([f, src]) => `- ${f} [${src.map((id) => SOURCES[id].t.split(' – ')[0] + ' ' + (SOURCES[id].t.match(/\((.*)\)\s*$/)?.[1] || '')).join(' ; ')}]`).join('\n')}`).join('\n\n');
export const EVIDENCE_TEXT = evidenceText();
