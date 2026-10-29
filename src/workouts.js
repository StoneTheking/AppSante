// Séances détaillées : bibliothèque d'exercices et générateur selon activité, niveau, matériel, objectif et durée.
// Repères : ACSM 2009 (séries, répétitions, repos), Schoenfeld 2016/2017 (fréquence, volume),
// Helgerud 2007 et Gibala 2012 (fractionné), Soligard 2008 et Lauersen 2014 (échauffement, prévention).

// equip : variantes par matériel disponible (aucun / haltères / salle).
export const EXERCISES = {
  squat: { name: 'Squat', muscles: 'cuisses, fessiers', cue: 'Pieds largeur d’épaules, poitrine haute, genoux dans l’axe des pieds, descends comme pour t’asseoir.', easier: 'Squat sur chaise (s’asseoir / se lever)', harder: 'Squat sauté', equip: { aucun: 'Squat au poids du corps', halteres: 'Goblet squat avec un haltère', salle: 'Squat à la barre ou presse à cuisses' } },
  hinge: { name: 'Charnière de hanche', muscles: 'ischios, fessiers, bas du dos', cue: 'Dos plat, recule les hanches en gardant les genoux légèrement fléchis, remonte en serrant les fessiers.', easier: 'Pont fessier au sol', harder: 'Soulevé de terre sur une jambe', equip: { aucun: 'Pont fessier', halteres: 'Soulevé de terre roumain aux haltères', salle: 'Soulevé de terre roumain à la barre' } },
  pushH: { name: 'Poussée horizontale', muscles: 'pectoraux, triceps, épaules', cue: 'Corps gainé en planche, coudes à ~45° du corps, poitrine jusqu’au sol ou au banc.', easier: 'Pompes mains surélevées (table, mur)', harder: 'Pompes pieds surélevés', equip: { aucun: 'Pompes', halteres: 'Développé couché aux haltères (au sol ou sur banc)', salle: 'Développé couché ou machine pectoraux' } },
  pullH: { name: 'Tirage horizontal', muscles: 'dos, biceps', cue: 'Omoplates serrées et basses, tire les coudes vers les hanches, sans cambrer.', easier: 'Rowing inversé à table haute, pieds plus près', harder: 'Rowing inversé pieds surélevés', equip: { aucun: 'Rowing inversé sous une table solide', halteres: 'Rowing un bras avec haltère, appui sur un banc', salle: 'Tirage horizontal à la poulie' } },
  pushV: { name: 'Poussée verticale', muscles: 'épaules, triceps', cue: 'Gainage abdominal, pousse au-dessus de la tête sans creuser le dos.', easier: 'Pompes inclinées hautes', harder: 'Pompes en V (pike push-up) pieds surélevés', equip: { aucun: 'Pompes en V (pike push-up)', halteres: 'Développé militaire aux haltères assis', salle: 'Développé épaules à la machine ou à la barre' } },
  pullV: { name: 'Tirage vertical', muscles: 'grand dorsal, biceps', cue: 'Tire les coudes vers les côtes, poitrine vers la barre, descente contrôlée.', easier: 'Superman bras en W au sol', harder: 'Tractions lestées', equip: { aucun: 'Superman « Y-T-W » au sol', halteres: 'Pull-over avec haltère', salle: 'Tirage vertical à la poulie ou tractions assistées' } },
  lunge: { name: 'Fentes', muscles: 'cuisses, fessiers, équilibre', cue: 'Grand pas, genou arrière vers le sol, buste droit, genou avant au-dessus de la cheville.', easier: 'Fentes arrière avec appui sur une chaise', harder: 'Fentes bulgares (pied arrière sur un banc)', equip: { aucun: 'Fentes alternées', halteres: 'Fentes avec haltères', salle: 'Fentes bulgares ou presse unilatérale' } },
  hipThrust: { name: 'Extension de hanche', muscles: 'fessiers', cue: 'Épaules sur un banc ou le canapé, monte le bassin jusqu’à l’alignement épaules-genoux, pause 1 s.', easier: 'Pont fessier au sol', harder: 'Hip thrust sur une jambe', equip: { aucun: 'Hip thrust sur le canapé', halteres: 'Hip thrust avec haltère sur les hanches', salle: 'Hip thrust à la barre ou machine' } },
  calf: { name: 'Mollets', muscles: 'mollets', cue: 'Monte sur la pointe des pieds, pause 1 s en haut, descente lente.', easier: 'Deux pieds, au sol', harder: 'Sur une marche, une jambe', equip: { aucun: 'Montées sur pointes de pieds sur une marche', halteres: 'Montées sur pointes avec haltères', salle: 'Machine à mollets' } },
  plank: { name: 'Gainage', muscles: 'abdominaux, sangle profonde', time: true, cue: 'Coudes sous les épaules, corps aligné, serre fessiers et abdos, respire normalement.', easier: 'Gainage sur les genoux', harder: 'Gainage avec lever de bras alterné', equip: { aucun: 'Planche', halteres: 'Planche', salle: 'Planche' } },
  deadbug: { name: 'Dead bug', muscles: 'abdominaux profonds', cue: 'Dos plaqué au sol, tends bras et jambe opposés lentement, sans décoller le bas du dos.', easier: 'Une seule jambe à la fois', harder: 'Avec haltère léger tenu à bout de bras', equip: { aucun: 'Dead bug', halteres: 'Dead bug', salle: 'Dead bug' } },
  sidePlank: { name: 'Gainage latéral', muscles: 'obliques', time: true, cue: 'Coude sous l’épaule, bassin haut, corps aligné.', easier: 'Sur le genou', harder: 'Lever la jambe du dessus', equip: { aucun: 'Planche latérale', halteres: 'Planche latérale', salle: 'Planche latérale' } },
};

const WARMUP = [
  ['Marche rapide ou course très lente sur place', 120],
  ['Cercles de bras, d’épaules et de hanches', 60],
  ['Montées de genoux et talons-fesses', 60],
  ['Fentes avant dynamiques avec rotation du buste', 60],
  ['Squats lents, amplitude progressive', 60],
];
const COOLDOWN = [
  ['Marche lente, respiration ample', 90],
  ['Étirement des quadriceps (debout, talon vers la fesse)', 40],
  ['Étirement des ischios (jambe tendue sur une marche)', 40],
  ['Étirement des pectoraux contre un mur', 40],
  ['Respiration lente : 4 s inspiration, 6 s expiration', 60],
];
const YOGA = [
  ['Respiration consciente assise', 60, 'Allonge l’expiration, relâche les épaules.'],
  ['Chat-vache', 60, 'Alterne dos rond et dos creux au rythme de la respiration.'],
  ['Chien tête en bas', 45, 'Talons vers le sol, dos long, genoux fléchis si besoin.'],
  ['Fente basse (chaque côté)', 60, 'Bassin vers l’avant, étire le devant de la hanche.'],
  ['Guerrier II (chaque côté)', 60, 'Genou avant au-dessus de la cheville, bras actifs.'],
  ['Pigeon couché (chaque côté)', 60, 'Cheville sur le genou opposé, rapproche la jambe de la poitrine.'],
  ['Torsion allongée (chaque côté)', 60, 'Épaules au sol, genoux d’un côté, regard opposé.'],
  ['Posture de l’enfant', 60, 'Front au sol, respire dans le dos.'],
  ['Soupir cyclique allongé', 120, 'Deux inspirations par le nez, longue expiration par la bouche.'],
];
const HIIT_BODY = [
  ['Jumping jacks', 'Rythme soutenu, atterrissage souple.'],
  ['Squats sautés', 'Ou squats rapides sans saut pour épargner les genoux.'],
  ['Montées de genoux', 'Genoux à hauteur de hanches, bras actifs.'],
  ['Mountain climbers', 'Position de pompe, genoux vers la poitrine en alternance.'],
  ['Burpees', 'Ou version sans saut ni pompe pour débuter.'],
  ['Fentes sautées', 'Ou fentes alternées rapides.'],
];

const LEVEL = {
  debutant: { sets: 2, reps: '10–12', rest: 75 },
  intermediaire: { sets: 3, reps: '8–12', rest: 90 },
  avance: { sets: 4, reps: '6–10', rest: 120 },
};

const step = (label, seconds, detail = '', extra = {}) => ({ kind: 'time', label, seconds, detail, ...extra });
const reps = (label, n, detail = '', extra = {}) => ({ kind: 'reps', label, reps: n, detail, ...extra });
const block = (title, items, note = '', circuit = 0) => ({ title, items, note, circuit });
// Durée estimée : ~40 s par série de répétitions, + repos entre les séries.
const itemSeconds = (i) => { const sets = i.sets || 1; return sets * (i.kind === 'reps' ? 40 : i.seconds || 0) + (sets - 1) * (i.rest || 0); };
export const minutesOf = (blocks) => Math.round(blocks.flatMap((b) => b.items).reduce((a, i) => a + itemSeconds(i), 0) / 60);

// Séance de renforcement : sélection d'exercices selon le focus, ajustée à la durée.
function strengthSession({ level, equipment, goal, minutes, focus }) {
  const L = LEVEL[level] || LEVEL.debutant;
  const circuit = goal === 'perdre';
  const pools = {
    full: ['squat', 'pushH', 'hinge', 'pullH', 'lunge', 'pushV', 'plank', 'deadbug'],
    haut: ['pushH', 'pullH', 'pushV', 'pullV', 'plank', 'sidePlank'],
    bas: ['squat', 'hinge', 'lunge', 'hipThrust', 'calf', 'deadbug'],
  };
  const rest = circuit ? 45 : L.rest;
  const perEx = L.sets * (45 + rest) / 60; // minutes par exercice
  const n = Math.max(4, Math.min(pools[focus].length, Math.round((minutes - 12) / perEx)));
  const items = pools[focus].slice(0, n).map((id) => {
    const e = EXERCISES[id];
    const label = e.equip[equipment] || e.equip.aucun;
    const detail = `${e.cue} Muscles : ${e.muscles}. Plus facile : ${e.easier}. Plus dur : ${e.harder}.`;
    return e.time
      ? step(label, level === 'debutant' ? 30 : level === 'avance' ? 60 : 45, detail, { sets: L.sets, rest })
      : reps(label, L.reps, detail, { sets: L.sets, rest });
  });
  return [
    block('Échauffement', WARMUP.map(([l, s]) => step(l, s)), 'Un échauffement structuré réduit les blessures d’environ un tiers.'),
    block(circuit ? `Circuit × ${L.sets} tours` : 'Renforcement', items, circuit
      ? `Enchaîne les exercices avec ${rest} s de pause, puis recommence le tour. Format circuit : plus de dépense pour ton objectif.`
      : `${L.sets} séries de ${L.reps} répétitions, ${rest} s de repos. Charge : tu dois finir chaque série avec 1–2 répétitions « en réserve ».`, circuit ? L.sets : 0),
    block('Retour au calme', COOLDOWN.map(([l, s]) => step(l, s))),
  ];
}

function intervalSession({ level, equipment, activity, minutes, zones }) {
  const warm = block('Échauffement', [step(`${activity === 'velo' ? 'Pédalage' : 'Footing'} très facile`, 300), step('3 accélérations progressives de 20 s', 90)]);
  const cool = block('Retour au calme', [step('Allure très facile', 300), ...COOLDOWN.slice(1, 3).map(([l, s]) => step(l, s))]);
  if (equipment === 'aucun' && activity === 'hiit') {
    const rounds = level === 'debutant' ? 2 : level === 'avance' ? 4 : 3;
    const items = HIIT_BODY.slice(0, level === 'debutant' ? 4 : 6).map(([l, d]) => step(l, level === 'debutant' ? 30 : 40, d, { sets: rounds, rest: level === 'debutant' ? 30 : 20 }));
    return [block('Échauffement', WARMUP.map(([l, s]) => step(l, s))), block(`Circuit fractionné × ${rounds} tours`, items, '1 min de récupération entre les tours. Intensité élevée : tu ne peux dire que quelques mots.', rounds), block('Retour au calme', COOLDOWN.map(([l, s]) => step(l, s)))];
  }
  const mode = activity === 'velo' ? 'pédalage' : activity === 'natation' ? 'nage' : 'course';
  if (level === 'debutant') {
    return [warm, block('10 × 1 minute', [step(`1 min ${mode} rapide (FC ${zones.vig[0]}–${zones.vig[1]})`, 60, 'Effort soutenu mais contrôlé.', { sets: 10, rest: 60 })], '1 min de récupération très facile entre chaque. Format court validé pour débuter (Gibala).'), cool];
  }
  return [warm, block('4 × 4 minutes', [step(`4 min ${mode} à 90–95 % de ta FC max (${Math.round(zones.max * 0.9)}–${Math.round(zones.max * 0.95)} bpm)`, 240, 'Allure difficile mais tenable 4 minutes ; tu ne peux pas parler.', { sets: 4, rest: 180 })], '3 min de récupération active (trottinement ou pédalage léger) entre les intervalles (protocole Helgerud).'), cool];
}

function enduranceSession({ level, activity, minutes, zones, intensity }) {
  const main = Math.max(10, minutes - 12);
  const z = intensity === 'intense' ? zones.vig : zones.mod;
  if (activity === 'course' && level === 'debutant') {
    const reps2 = Math.max(4, Math.round(main / 3));
    return [block('Échauffement', [step('Marche rapide', 300)]), block(`Course-marche × ${reps2}`, [step('1 min 30 de course très facile', 90, 'Tu dois pouvoir parler. Si tu es essoufflé, ralentis.', { sets: reps2, rest: 90 })], 'Alterne avec 1 min 30 de marche. Progression : +30 s de course par semaine.'), block('Retour au calme', COOLDOWN.map(([l, s]) => step(l, s)))];
  }
  if (activity === 'natation') {
    const reps2 = level === 'debutant' ? 8 : level === 'avance' ? 10 : 6;
    const dist = level === 'debutant' ? 25 : level === 'avance' ? 200 : 100;
    return [block('Échauffement', [step('200 m nage libre facile (mélange de nages)', 300), step('4 × 25 m éducatifs (battements, rattrapé)', 180)]), block(`${reps2} × ${dist} m`, [reps(`${dist} m crawl ou brasse, allure régulière`, `${dist} m`, 'Respiration régulière, allonge la coulée.', { sets: reps2, rest: 30 })], '30 s de repos au bord entre chaque.'), block('Retour au calme', [step('100 m dos crawlé ou brasse lente', 180), step('Étirements des épaules au bord', 120)])];
  }
  const label = { course: 'Course', velo: 'Vélo', marche: 'Marche rapide', randonnee: 'Randonnée' }[activity] || 'Activité';
  const items = [step(`${label} à allure ${intensity === 'intense' ? 'soutenue' : 'modérée'} (FC ${z[0]}–${z[1]} bpm)`, main * 60, intensity === 'intense' ? 'Tu ne peux dire que quelques mots.' : 'Tu peux parler mais pas chanter.')];
  if (level !== 'debutant' && ['course', 'velo'].includes(activity) && main >= 25) items.splice(1, 0, step('Option : 3 × 3 min un peu plus vite au milieu de la séance', 0, 'Récupère 2 min entre chaque, toujours en mouvement.'));
  return [block('Échauffement', [step(`${label} très facile`, 300), step('Mobilité des hanches et chevilles', 60)]), block('Corps de séance', items), block('Retour au calme', COOLDOWN.map(([l, s]) => step(l, s)))];
}

function yogaSession({ minutes }) {
  const k = Math.max(0.6, Math.min(1.6, (minutes * 60) / YOGA.reduce((a, [, s]) => a + s, 0)));
  return [block('Enchaînement mobilité / yoga', YOGA.map(([l, s, d]) => step(l, Math.round((s * k) / 15) * 15, d)), 'Mouvements lents, sans douleur ; respire par le nez.')];
}

// Exercices techniques et physiques propres à chaque sport (en plus de l'échauffement « 11+ »).
const SPORT_DRILLS = {
  raquette: { label: 'Jeu (tennis, padel, badminton)', drills: [
    ['Split-step et déplacements latéraux', 60, 'Petit saut d’appel au moment de la frappe adverse, puis pas chassés de chaque côté.'],
    ['Shadow : coups dans le vide (coup droit, revers)', 90, 'Geste complet, lent puis plus rapide, en te replaçant au centre après chaque coup.'],
    ['Fentes latérales', 45, 'Genou dans l’axe du pied, buste droit : les appuis des frappes basses.'],
    ['Sauts à la corde (ou sans corde)', 60, 'Sur l’avant du pied, rythme régulier : réactivité des chevilles.'],
    ['Rotation du buste avec gainage', 45, 'En planche, ouvre un bras vers le plafond puis l’autre : force de rotation des frappes.'],
  ] },
  collectif: { label: 'Match ou entraînement collectif', drills: [
    ['Sprints navette 5-10-5', 60, 'Accélère, touche le sol, repars dans l’autre sens : changements de direction.'],
    ['Conduite de balle / dribble en slalom', 90, 'Petits touchers, regard levé, autour de plots ou de bouteilles.'],
    ['Passes contre un mur', 90, 'Alterne pied droit et gauche (ou main droite et gauche), en contrôlant le rebond.'],
    ['Squats sautés réception amortie', 45, 'Atterris souplement, genoux dans l’axe : prévention des entorses du genou.'],
    ['Équilibre sur une jambe', 60, '30 s par jambe, yeux ouverts puis fermés : prévention des entorses de cheville.'],
  ] },
  danse: { label: 'Danse', drills: [
    ['Échauffement articulaire en musique', 120, 'Cou, épaules, hanches, genoux, chevilles : grands cercles lents.'],
    ['Pas de base (step-touch, grapevine, pas chassé)', 120, 'Répète chaque pas 8 temps, puis enchaîne-les.'],
    ['Isolations (épaules, cage thoracique, bassin)', 90, 'Une seule partie du corps bouge, le reste reste immobile.'],
    ['Enchaînement chorégraphique', 180, 'Apprends 4 × 8 temps, puis répète en accélérant.'],
  ] },
  autre: { label: 'Activité', drills: [] },
};

function sportSession({ activity, minutes }) {
  const sp = SPORT_DRILLS[activity] || SPORT_DRILLS.autre;
  const drillMin = Math.round(sp.drills.reduce((a, [, s2]) => a + s2, 0) / 60);
  return [
    block('Échauffement (prévention des blessures)', [...WARMUP.map(([l, s2]) => step(l, s2)), step('Courses avec changements de direction et appuis', 90), step('Gainage avant puis latéral', 60)], 'Inspiré du programme d’échauffement « 11+ » qui réduit les blessures.'),
    ...(sp.drills.length ? [block('Exercices spécifiques', sp.drills.map(([l, s2, d]) => step(l, s2, d)), 'Technique et qualités physiques propres à ce sport.')] : []),
    block('Activité', [step(sp.label, Math.max(10, minutes - 14 - drillMin) * 60, 'Hydrate-toi toutes les 15–20 minutes.')]),
    block('Retour au calme', COOLDOWN.map(([l, s2]) => step(l, s2))),
  ];
}

// Lien vers des tutoriels vidéo YouTube pour un exercice (recherche, donc toujours à jour).
export const tutoUrl = (label) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${label.replace(/\(.*?\)/g, '').trim()} tuto exercice`)}`;
const NO_TUTO = /^(Marche|Footing|Pédalage|Allure|Course|Vélo|Randonnée|Respiration|Repos|Récupération|Activité|Jeu|Match|Danse$|Option)/;
export const hasTuto = (it) => !NO_TUTO.test(it.label);

// Point d'entrée : construit la séance du jour (ou d'un jour de la semaine type).
export function buildSession({ activity, minutes = 30, intensity = 'moderee', level = 'debutant', equipment = 'aucun', goal = 'maintenir', dayIndex = 0, zones }) {
  let blocks, title, src;
  if (activity === 'renfo') {
    // prise de muscle : haut / bas en alternance ; sinon corps entier (2–3 séances/sem, chaque muscle 2×)
    const focus = goal === 'prendre' ? (dayIndex % 4 === 0 ? 'haut' : dayIndex % 4 === 2 ? 'bas' : 'full') : 'full';
    blocks = strengthSession({ level, equipment, goal, minutes, focus });
    title = { full: 'Renforcement corps entier', haut: 'Renforcement haut du corps', bas: 'Renforcement bas du corps' }[focus];
    src = ['acsm2009', 'schoenfeld2016', 'schoenfeld2017', 'lauersen2014', 'soligard2008'];
  } else if (activity === 'hiit') {
    blocks = intervalSession({ level, equipment, activity, minutes, zones });
    title = equipment === 'aucun' ? 'Fractionné au poids du corps' : 'Fractionné';
    src = ['helgerud2007', 'gibala2012', 'milanovic2016'];
  } else if (['course', 'velo', 'natation', 'marche', 'randonnee'].includes(activity)) {
    blocks = intensity === 'intense' && activity !== 'marche' ? intervalSession({ level, equipment: 'salle', activity, minutes, zones }) : enduranceSession({ level, activity, minutes, zones, intensity });
    title = { course: 'Course à pied', velo: 'Vélo', natation: 'Natation', marche: 'Marche rapide', randonnee: 'Randonnée' }[activity];
    src = ['who2020', 'tanaka2001', 'sorensen2020'];
  } else if (activity === 'yoga') {
    blocks = yogaSession({ minutes });
    title = 'Mobilité & yoga';
    src = ['cramer2013', 'balban2023'];
  } else {
    blocks = sportSession({ activity, minutes });
    title = { raquette: 'Sport de raquette', collectif: 'Sport collectif', danse: 'Danse' }[activity] || 'Séance';
    src = ['soligard2008'];
  }
  return { title, blocks, minutes: Math.max(minutes, minutesOf(blocks)), src };
}

// Aplatit la séance en étapes pour le mode guidé (chaque série et chaque repos deviennent une étape).
export function flatten(session) {
  const out = [];
  for (const b of session.blocks) {
    if (b.circuit) {
      // circuit : un passage par exercice et par tour, repos entre les exercices, 1 min entre les tours
      for (let r = 1; r <= b.circuit; r++) {
        b.items.forEach((it, i) => {
          out.push({ ...it, block: b.title, set: r, sets: b.circuit });
          const last = i === b.items.length - 1;
          if (!(last && r === b.circuit)) out.push({ kind: 'time', label: last ? 'Récupération entre les tours' : 'Repos', seconds: last ? 60 : it.rest || 30, detail: `Ensuite : ${last ? b.items[0].label : b.items[i + 1].label}`, block: b.title, isRest: true });
        });
      }
      continue;
    }
    for (const it of b.items) {
      const sets = it.sets || 1;
      for (let s = 1; s <= sets; s++) {
        if (it.kind === 'time' && !it.seconds) continue;
        out.push({ ...it, block: b.title, set: s, sets });
        if (it.rest && s < sets) out.push({ kind: 'time', label: 'Repos', seconds: it.rest, detail: `Prochaine série : ${it.label}`, block: b.title, isRest: true });
      }
    }
  }
  return out;
}
