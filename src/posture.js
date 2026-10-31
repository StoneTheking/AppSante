// Posture : bilan rapide, marche (les études récentes sur le mal de dos), routine d'exercices correctifs.
// Message clé de la recherche : il n'existe pas de « posture parfaite » à tenir toute la journée (Swain 2020) ;
// ce qui protège, c'est de bouger souvent, de marcher beaucoup et de renforcer le haut du dos et les fessiers.

export const QUESTIONS = [
  { id: 'sit', q: 'Combien d’heures passes-tu assis·e par jour ?', a: ['Moins de 4 h', '4 à 8 h', 'Plus de 8 h'] },
  { id: 'phone', q: 'Combien de temps tête baissée sur le téléphone ?', a: ['Moins d’1 h', '1 à 3 h', 'Plus de 3 h'] },
  { id: 'breaks', q: 'Quand tu es assis·e, tu te lèves…', a: ['Toutes les 30 à 60 min', 'Quelques fois', 'Rarement'] },
  { id: 'screen', q: 'Ton écran d’ordinateur est-il à hauteur des yeux ?', a: ['Oui', 'À peu près', 'Non, ou pas d’écran fixe'] },
  { id: 'neck', q: 'Douleurs à la nuque ou aux épaules ?', a: ['Jamais', 'Parfois', 'Souvent'] },
  { id: 'back', q: 'Douleurs dans le bas du dos ?', a: ['Jamais', 'Parfois', 'Souvent'] },
];

// Routine de 7 minutes : chaque exercice a sa démonstration 3D.
export const ROUTINE = [
  { label: 'Rentrer le menton (chin tuck)', dose: '10 × 5 s', why: 'Replace la tête au-dessus des épaules (posture « téléphone »).' },
  { label: 'Anges au mur', dose: '2 × 10', why: 'Renforce le haut du dos, ouvre les épaules enroulées.' },
  { label: 'Ouverture thoracique assise', dose: '8 lentes', why: 'Redonne de la mobilité au dos qui s’arrondit au bureau.' },
  { label: 'Étirement des pectoraux contre un mur', dose: '30 s / côté', why: 'Les pectoraux raccourcis tirent les épaules vers l’avant.' },
  { label: 'Fente basse (chaque côté)', dose: '30 s / côté', why: 'Étire les fléchisseurs de hanche raidis par la position assise.' },
  { label: 'Pont fessier', dose: '2 × 12', why: 'Des fessiers forts soulagent le bas du dos.' },
  { label: 'Chat-vache', dose: '8 respirations', why: 'Mobilise toute la colonne en douceur.' },
  { label: 'Marche droite, tête haute', dose: '10 min', why: 'La marche est le meilleur « exercice de dos » étudié à ce jour.' },
];

// Minutes de marche estimées d'après les pas (≈ 100 pas par minute en marchant normalement).
export const walkMinutes = (steps) => (steps ? Math.round(steps / 100) : 0);

// Score de posture sur 100 : réponses au bilan, temps d'écran mesuré, marche mesurée et routine faite.
export function assess(st, days = []) {
  const ans = st.posture?.answers || {};
  const answered = QUESTIONS.filter((q) => ans[q.id] != null).length;
  const steps = days.map((d) => d.steps).filter((x) => x != null);
  const avgSteps = steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : null;
  const walk = avgSteps != null ? walkMinutes(avgSteps) : null;
  const screens = days.map((d) => d.screenMin).filter((x) => x != null);
  const screenH = screens.length ? screens.reduce((a, b) => a + b, 0) / screens.length / 60 : null;
  // le temps d'écran mesuré complète la réponse « téléphone » si elle manque
  const phone = ans.phone ?? (screenH == null ? null : screenH > 4 ? 2 : screenH > 2 ? 1 : 0);
  const risk = ['sit', 'breaks', 'screen', 'neck', 'back'].reduce((a, k) => a + (ans[k] ?? 0), 0) + (phone ?? 0);
  const done7 = Object.keys(st.posture?.done || {}).filter((k) => days.some((d) => d.key === k)).length;
  let score = 100 - risk * 6;
  if (walk != null) score += walk >= 100 ? 8 : walk >= 60 ? 3 : walk < 30 ? -8 : 0;
  score += Math.min(10, done7 * 2);
  score = Math.max(5, Math.min(100, Math.round(score)));
  const tips = [];
  if ((ans.sit ?? 0) >= 1 || (ans.breaks ?? 0) >= 1) tips.push(['clock', 'Lève-toi toutes les 30 à 45 min', 'Une minute debout ou quelques pas suffisent : ce sont les changements de position qui soulagent, pas une posture « parfaite » tenue des heures.', ['waongenngarm2020', 'swain2020']]);
  if ((phone ?? 0) >= 1) tips.push(['phone', 'Monte le téléphone à hauteur des yeux', 'Tête penchée à 60°, la nuque supporte l’équivalent de ~27 kg contre ~5 kg tête droite. Coudes près du corps, écran levé.', ['hansraj2014']]);
  if ((ans.screen ?? 0) >= 1) tips.push(['work', 'Règle ton poste de travail', 'Haut de l’écran à hauteur des yeux, à un bras de distance ; clavier près du corps, pieds à plat. Un ordinateur portable se pose sur un support avec un clavier séparé.', []]);
  if ((ans.neck ?? 0) >= 1) tips.push(['activity', 'Renforce le haut du dos', 'Menton rentré et anges au mur, chaque jour : les exercices correctifs réduisent la tête en avant et les douleurs de nuque.', ['sheikhhoseini2018']]);
  if ((ans.back ?? 0) >= 1) tips.push(['steps', 'Marche, même quand le dos tire un peu', 'Un programme de marche progressif a presque doublé le temps sans nouvelle crise de mal de dos. Consulte si la douleur descend dans la jambe, réveille la nuit ou s’accompagne de fièvre.', ['pocovi2024']]);
  if (walk != null && walk < 100) tips.push(['steps', `Vise 100 min de marche par jour (tu en es à ~${walk})`, 'Au-delà de 100 min par jour, le risque de lombalgie chronique baisse d’environ 23 % ; même à allure tranquille, c’est le volume qui compte.', ['haddadj2025']]);
  tips.push(['smile', 'Grandis-toi quand tu marches', 'Tête haute, épaules basses, bras qui balancent : se tenir droit améliore aussi l’humeur et la confiance face au stress.', ['nair2015']]);
  return { score, answered, complete: answered === QUESTIONS.length, walk, avgSteps, screenH, done7, tips, level: score >= 80 ? 'bonne' : score >= 60 ? 'correcte' : 'à travailler' };
}

export const SOURCES = ['pocovi2024', 'haddadj2025', 'hansraj2014', 'swain2020', 'sheikhhoseini2018', 'nair2015', 'waongenngarm2020'];
