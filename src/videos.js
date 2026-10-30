// Démonstrations vidéo : seulement pour les exercices où la technique compte (renforcement, yoga, gestes précis).
// Pas de vidéo pour courir, marcher, pédaler, s'étirer simplement ou respirer.
export const VIDEO_GROUPS = [
  ['Renforcement', [
    'Squat au poids du corps', 'Goblet squat avec un haltère', 'Squat à la barre ou presse à cuisses',
    'Pont fessier', 'Soulevé de terre roumain aux haltères', 'Soulevé de terre roumain à la barre',
    'Pompes', 'Développé couché aux haltères (au sol ou sur banc)', 'Développé couché ou machine pectoraux',
    'Rowing inversé sous une table solide', 'Rowing un bras avec haltère, appui sur un banc', 'Tirage horizontal à la poulie',
    'Pompes en V (pike push-up)', 'Développé militaire aux haltères assis', 'Développé épaules à la machine ou à la barre',
    'Superman « Y-T-W » au sol', 'Pull-over avec haltère', 'Tirage vertical à la poulie ou tractions assistées',
    'Fentes alternées', 'Fentes avec haltères', 'Fentes bulgares ou presse unilatérale', 'Fentes latérales',
    'Hip thrust sur le canapé', 'Hip thrust avec haltère sur les hanches', 'Hip thrust à la barre ou machine',
    'Planche', 'Planche latérale', 'Dead bug', 'Gainage avant puis latéral', 'Rotation du buste avec gainage',
  ]],
  ['Cardio et fractionné', ['Burpees', 'Mountain climbers', 'Squats sautés', 'Squats sautés réception amortie', 'Fentes sautées', 'Sprints navette 5-10-5', 'Split-step et déplacements latéraux']],
  ['Yoga et mobilité', ['Chat-vache', 'Chien tête en bas', 'Fente basse (chaque côté)', 'Guerrier II (chaque côté)', 'Pigeon couché (chaque côté)', 'Torsion allongée (chaque côté)', 'Mobilité des hanches et chevilles']],
  ['Danse et natation', ['Pas de base (step-touch, grapevine, pas chassé)', '4 × 25 m éducatifs (battements, rattrapé)']],
];
export const NEEDS_VIDEO = new Set(VIDEO_GROUPS.flatMap(([, xs]) => xs));

// Vidéos choisies par défaut (lien par exercice). Vide : l'appli propose une recherche YouTube.
export const DEFAULT_VIDEOS = {};

// Lit une liste « Exercice | lien » (le fichier docs/videos-exercices.txt rempli) : { exercice: lien }.
export function parseVideoList(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*(.+?)\s*\|\s*(https?:\/\/\S+)/);
    if (m && NEEDS_VIDEO.has(m[1])) out[m[1]] = m[2];
  }
  return out;
}
