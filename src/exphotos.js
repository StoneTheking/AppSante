// Démonstrations en photos réelles : base libre « Free Exercise DB » (yuhonas/free-exercise-db, domaine public / Unlicense).
// Chaque exercice y a deux photos (position de départ, position d'arrivée) : en les alternant en fondu au rythme d'une
// répétition, on obtient une démonstration animée par une vraie personne, à côté du mannequin 3D de Diana.

const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Libellé de l'exercice dans l'appli → identifiant dans la base.
export const PHOTOS = {
  'Squat au poids du corps': 'Bodyweight_Squat',
  'Squats lents, amplitude progressive': 'Bodyweight_Squat',
  'Goblet squat avec un haltère': 'Goblet_Squat',
  'Squat à la barre ou presse à cuisses': 'Barbell_Full_Squat',
  'Pont fessier': 'Butt_Lift_Bridge',
  'Soulevé de terre roumain aux haltères': 'Stiff-Legged_Dumbbell_Deadlift',
  'Soulevé de terre roumain à la barre': 'Romanian_Deadlift',
  'Pompes': 'Pushups',
  'Développé couché aux haltères (au sol ou sur banc)': 'Dumbbell_Bench_Press',
  'Développé couché ou machine pectoraux': 'Barbell_Bench_Press_-_Medium_Grip',
  'Rowing inversé sous une table solide': 'Inverted_Row',
  'Rowing un bras avec haltère, appui sur un banc': 'One-Arm_Dumbbell_Row',
  'Tirage horizontal à la poulie': 'Seated_Cable_Rows',
  'Développé militaire aux haltères assis': 'Dumbbell_Shoulder_Press',
  'Développé épaules à la machine ou à la barre': 'Machine_Shoulder_Military_Press',
  'Superman « Y-T-W » au sol': 'Superman',
  'Pull-over avec haltère': 'Bent-Arm_Dumbbell_Pullover',
  'Tirage vertical à la poulie ou tractions assistées': 'Wide-Grip_Lat_Pulldown',
  'Fentes alternées': 'Bodyweight_Walking_Lunge',
  'Fentes avec haltères': 'Dumbbell_Lunges',
  'Fentes bulgares ou presse unilatérale': 'Split_Squat_with_Dumbbells',
  'Fentes avant dynamiques avec rotation du buste': 'Bodyweight_Walking_Lunge',
  'Hip thrust sur le canapé': 'Barbell_Hip_Thrust',
  'Hip thrust avec haltère sur les hanches': 'Barbell_Hip_Thrust',
  'Hip thrust à la barre ou machine': 'Barbell_Hip_Thrust',
  'Montées sur pointes de pieds sur une marche': 'Standing_Calf_Raises',
  'Montées sur pointes avec haltères': 'Standing_Calf_Raises',
  'Machine à mollets': 'Smith_Machine_Calf_Raise',
  'Planche': 'Plank',
  'Planche latérale': 'Side_Bridge',
  'Gainage avant puis latéral': 'Plank',
  'Dead bug': 'Dead_Bug',
  'Rotation du buste avec gainage': 'Russian_Twist',
  'Mountain climbers': 'Mountain_Climbers',
  'Squats sautés': 'Freehand_Jump_Squat',
  'Squats sautés réception amortie': 'Freehand_Jump_Squat',
  'Fentes sautées': 'Split_Jump',
  'Jumping jacks': 'Star_Jump',
  'Burpees': 'Frog_Hops',
  'Sprints navette 5-10-5': 'Side_to_Side_Box_Shuffle',
  'Split-step et déplacements latéraux': 'Carioca_Quick_Step',
  'Étirement des quadriceps (debout, talon vers la fesse)': 'Quad_Stretch',
  'Étirement des ischios (jambe tendue sur une marche)': 'Hamstring_Stretch',
  'Étirement des pectoraux contre un mur': 'Chest_And_Front_Of_Shoulder_Stretch',
  'Étirements des épaules au bord': 'Shoulder_Stretch',
  'Posture de l’enfant': 'Childs_Pose',
  'Chat-vache': 'Cat_Stretch',
  'Chien tête en bas': 'Inchworm',
  'Fente basse (chaque côté)': 'Kneeling_Hip_Flexor',
  'Pigeon couché (chaque côté)': 'Lying_Glute',
  'Torsion allongée (chaque côté)': 'Lying_Crossover',
  'Mobilité des hanches et chevilles': 'Standing_Hip_Circles',
  'Cercles de bras, d’épaules et de hanches': 'Arm_Circles',
  'Montées de genoux et talons-fesses': 'Single_Leg_Butt_Kick',
};

export const hasPhotos = (label) => !!PHOTOS[label];
export const photoUrls = (label, base = CDN) => (PHOTOS[label] ? [0, 1].map((i) => `${base}${PHOTOS[label]}/${i}.jpg`) : []);
export const SOURCE = { name: 'Free Exercise DB', url: 'https://github.com/yuhonas/free-exercise-db' };

// Bascule de secours vers GitHub si le CDN ne répond pas (une seule fois par image).
export function fallback(img) {
  if (img.dataset.fb) { img.closest('[data-photos]')?.classList.add('off'); return; }
  img.dataset.fb = '1';
  img.src = img.src.replace(CDN, RAW);
}
