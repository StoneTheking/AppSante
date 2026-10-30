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

// Vidéos choisies par défaut (sélectionnées sur YouTube : démonstration courte et claire, en français quand elle existe).
// L'utilisateur peut toujours en mettre une autre.
export const DEFAULT_VIDEOS = {
  'Squat au poids du corps': 'https://youtu.be/EXFBExFRTBY',
  'Goblet squat avec un haltère': 'https://youtu.be/u9xM9NQ7tNw',
  'Squat à la barre ou presse à cuisses': 'https://youtu.be/Dr41gZwfTfM',
  'Pont fessier': 'https://youtu.be/kQLpMZZ4tMk',
  'Soulevé de terre roumain aux haltères': 'https://youtu.be/LsWeDEqMafE',
  'Soulevé de terre roumain à la barre': 'https://youtu.be/_bpWCJtOKVY',
  'Pompes': 'https://youtu.be/jgJHg3rAOVg',
  'Développé couché aux haltères (au sol ou sur banc)': 'https://youtu.be/HBXn_SAlPw0',
  'Développé couché ou machine pectoraux': 'https://youtu.be/feWp7jZopI8',
  'Rowing inversé sous une table solide': 'https://youtu.be/5i7zfFO9RH4',
  'Rowing un bras avec haltère, appui sur un banc': 'https://youtu.be/2P2TyrYyTmU',
  'Tirage horizontal à la poulie': 'https://youtu.be/w2Q7LbkhtLI',
  'Pompes en V (pike push-up)': 'https://youtu.be/DyeD6gJfHOg',
  'Développé militaire aux haltères assis': 'https://youtu.be/Q12jNrCddVE',
  'Développé épaules à la machine ou à la barre': 'https://youtu.be/8ay3Bj5y-_E',
  'Superman « Y-T-W » au sol': 'https://youtu.be/QdGTI4Lshg4',
  'Pull-over avec haltère': 'https://youtu.be/a2TIFwKWBus',
  'Tirage vertical à la poulie ou tractions assistées': 'https://youtu.be/UUroZKE5gNo',
  'Fentes alternées': 'https://youtu.be/9KgPYFNC0yI',
  'Fentes avec haltères': 'https://youtu.be/Va8Cj0-I-f8',
  'Fentes bulgares ou presse unilatérale': 'https://youtu.be/WPgr0Kqx_Xg',
  'Fentes latérales': 'https://youtu.be/YqxR1Xv_o4I',
  'Hip thrust sur le canapé': 'https://youtu.be/ShvSo3UaT1s',
  'Hip thrust avec haltère sur les hanches': 'https://youtu.be/IMPB5EMTcqI',
  'Hip thrust à la barre ou machine': 'https://youtu.be/fsOGsvH9QhE',
  'Planche': 'https://youtu.be/mv42eVXvMDc',
  'Planche latérale': 'https://youtu.be/uXSljAP_kJU',
  'Dead bug': 'https://youtu.be/gZtAwS79jJw',
  'Gainage avant puis latéral': 'https://youtu.be/cwo_p-8vgyw',
  'Rotation du buste avec gainage': 'https://youtu.be/IJDOoVyVjhc',
  'Burpees': 'https://youtu.be/4YPWd8z090A',
  'Mountain climbers': 'https://youtu.be/CQk4MHY2_Tc',
  'Squats sautés': 'https://youtu.be/Swf_f7SHdUI',
  'Squats sautés réception amortie': 'https://youtu.be/Swf_f7SHdUI',
  'Fentes sautées': 'https://youtu.be/XJAGPxkEMR4',
  'Sprints navette 5-10-5': 'https://youtu.be/z-wV9O8y-a0',
  'Split-step et déplacements latéraux': 'https://youtu.be/UtARjzWH5PQ',
  'Chat-vache': 'https://youtu.be/VrQgO4APZ20',
  'Chien tête en bas': 'https://youtu.be/dhhH0P7IFGw',
  'Fente basse (chaque côté)': 'https://youtu.be/Gx_5WZ5o8C4',
  'Guerrier II (chaque côté)': 'https://youtu.be/Thx-FF5uayY',
  'Pigeon couché (chaque côté)': 'https://youtu.be/07Oz43jNleQ',
  'Torsion allongée (chaque côté)': 'https://youtu.be/cvCPeN6XjHs',
  'Mobilité des hanches et chevilles': 'https://youtu.be/MT3IFreUFzI',
  'Pas de base (step-touch, grapevine, pas chassé)': 'https://youtu.be/WKyQn89mzZY',
  '4 × 25 m éducatifs (battements, rattrapé)': 'https://youtu.be/WzsenRF7G6w',
};

// Lit une liste « Exercice | lien » (le fichier docs/videos-exercices.txt rempli) : { exercice: lien }.
export function parseVideoList(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*(.+?)\s*\|\s*(https?:\/\/\S+)/);
    if (m && NEEDS_VIDEO.has(m[1])) out[m[1]] = m[2];
  }
  return out;
}
