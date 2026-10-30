// Démonstrations animées en 3D des exercices, dans le style de Coach Diana : un mannequin hologramme bleu nuit
// au contour cyan (tête de Diana avec son bandeau), sur une plateforme lumineuse, muscles travaillés en orange.
// Rendu maison sur un canvas (sans bibliothèque) : squelette posé par cinématique inverse (mains et pieds placés
// dans l'espace, coudes et genoux calculés), segments triés par profondeur et ombrés comme des cylindres.
// On peut faire tourner la caméra au doigt pour voir le mouvement sous tous les angles.

const D = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Matrices 3×3 (lignes). Repère monde : x = gauche du personnage, y = haut, z = devant lui (sol en y = 0).
const mm = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
// Rx(+) penche vers l'avant (le haut part vers +z), Ry(+) tourne vers la gauche, Rz(+) incline vers la gauche.
const Rx = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const Ry = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const Rz = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; };

// Proportions (mètres) et rayons des segments.
const L = { thigh: 0.44, shin: 0.43, arm: 0.29, fore: 0.27, spine: 0.25, hip: 0.1, sh: 0.18, neck: 0.14, foot: 0.15 };
const RAD = { torso: 0.115, chest: 0.125, thigh: 0.07, shin: 0.05, arm: 0.047, fore: 0.04, foot: 0.035, head: 0.105 };

// Coude ou genou par cinématique inverse à deux segments : racine, cible, longueurs, direction de pliage.
function ik(root, target, a, b, pole) {
  let d = sub(target, root);
  let dl = len(d);
  const max = (a + b) * 0.999;
  if (dl > max) { d = mul(d, max / dl); dl = max; }
  if (dl < 1e-4) return [add(root, [0, -a, 0]), root];
  const dir = mul(d, 1 / dl);
  const along = (a * a - b * b + dl * dl) / (2 * dl);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  let p = sub(pole, mul(dir, dot(pole, dir)));
  if (len(p) < 1e-4) p = [0, 0, 1];
  return [add(add(root, mul(dir, along)), mul(norm(p), h)), add(root, d)];
}

// Pose → points du squelette.
function skeleton(P) {
  const R = mm(Ry(P.yaw * D), mm(Rx(P.tilt * D), mm(Rz(P.roll * D), Rx(P.pitch * D))));
  const pelvis = P.root;
  // colonne en deux segments : « curve » arrondit (positif) ou creuse (négatif) le dos
  const T1 = mm(R, mm(Ry(P.twist * 0.4 * D), mm(Rz(P.side * 0.5 * D), Rx((P.bend * 0.5 - P.curve) * D))));
  const mid = add(pelvis, mv(T1, [0, L.spine, 0]));
  const T2 = mm(T1, mm(Ry(P.twist * 0.6 * D), mm(Rz(P.side * 0.5 * D), Rx((P.bend * 0.5 + 2 * P.curve) * D))));
  const chest = add(mid, mv(T2, [0, L.spine, 0]));
  const H = mm(T2, Rx(P.head * D));
  const head = add(chest, mv(H, [0, L.neck, 0.015]));
  const out = { pelvis, mid, chest, head, headR: H, chestR: T2, pelvisR: R, side: {} };
  for (const s of [1, -1]) {
    const k = s > 0 ? 'L' : 'R';
    const shoulder = add(chest, mv(T2, [s * L.sh, -0.045, 0]));
    const hip = add(pelvis, mv(R, [s * L.hip, -0.02, 0]));
    const hand = P['h' + k] || (P.hL && [-P.hL[0], P.hL[1], P.hL[2]]);
    const foot = P['f' + k] || (P.fL && [-P.fL[0], P.fL[1], P.fL[2]]);
    const eP = P['e' + k] || P.eP || [0.5, -1, -0.5];
    const kP = P['k' + k] || P.kP || [0.15, 0, 1];
    const [elbow, wrist] = ik(shoulder, hand, L.arm, L.fore, mv(T2, [s * eP[0], eP[1], eP[2]]));
    const [knee, ankle] = ik(hip, foot, L.thigh, L.shin, mv(R, [s * kP[0], kP[1], kP[2]]));
    const t = P['t' + k] || (P.tL && P['t' + k] === undefined && k === 'R' ? [-P.tL[0], P.tL[1], P.tL[2]] : null) || mv(Ry(P.yaw * D), [0, 0, 1]);
    const toe = add(ankle, mul(norm(t), L.foot));
    const handEnd = add(wrist, mul(norm(sub(wrist, elbow)), 0.075));
    out.side[k] = { shoulder, hip, elbow, wrist, knee, ankle, toe, handEnd };
  }
  return out;
}

const BASE = { root: [0, 0.95, 0], pitch: 0, yaw: 0, roll: 0, tilt: 0, bend: 0, curve: 0, twist: 0, side: 0, head: 0, hL: [0.22, 0.9, 0.03], fL: [0.12, 0.08, 0] };
const lerp = (a, b, t) => (typeof a === 'number' && typeof b === 'number' ? a + (b - a) * t : Array.isArray(a) && Array.isArray(b) && a.length === b.length ? a.map((x, i) => lerp(x, b[i], t)) : t < 0.5 ? a : b);
function blend(A, B, t) {
  const o = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) o[k] = lerp(A[k] ?? B[k], B[k] ?? A[k], t);
  return o;
}
const ease = (t) => t * t * (3 - 2 * t);

// ---------- Poses de base ----------
const k = (base, patch) => ({ ...base, ...patch });
// Ne bouge qu'un côté : l'autre garde la position de la pose de base (sinon il suivrait en miroir).
const mir = (v) => v && [-v[0], v[1], v[2]];
const one = (base, patch) => {
  const o = { ...base, ...patch };
  for (const c of ['h', 'f', 't', 'e', 'k']) {
    if (patch[c + 'L'] && !patch[c + 'R'] && !base[c + 'R'] && base[c + 'L']) o[c + 'R'] = mir(base[c + 'L']);
    if (patch[c + 'R'] && !patch[c + 'L'] && !base[c + 'L'] && base[c + 'R']) o[c + 'L'] = mir(base[c + 'R']);
  }
  return o;
};
const STAND = BASE;
const ARMS_FRONT = { hL: [0.17, 1.38, 0.55] };
// Allongé sur le dos (tête vers −z, regard vers le haut).
const SUPINE = k(BASE, { root: [0, 0.12, 0], pitch: -90, hL: [0.26, 0.08, -0.25], fL: [0.12, 0.08, 0.88], tL: [0, 0.6, 1], kP: [0.1, 0.3, 1] });
// Allongé sur le ventre (tête vers +z, regard vers le sol).
const PRONE = k(BASE, { root: [0, 0.12, 0], pitch: 90, head: -10, hL: [0.26, 0.06, 0.25], fL: [0.12, 0.07, -0.88], tL: [0, -0.3, -1], kP: [0.1, -1, 0] });
// Planche sur les avant-bras : coudes sous les épaules, pointes de pieds au sol.
const PLANK = k(BASE, { root: [0, 0.3, 0], pitch: 80, head: -8, hL: [0.15, 0.03, 0.78], eP: [0.2, 0, 1], fL: [0.1, 0.1, -0.85], tL: [0, -1, 0.35], kP: [0, -1, 0] });
// Planche bras tendus (position de pompe).
const HIGH_PLANK = k(BASE, { root: [0, 0.45, 0], pitch: 72, head: -10, hL: [0.2, 0.04, 0.66], eP: [0.6, -0.2, -1], fL: [0.1, 0.1, -0.86], tL: [0, -1, 0.35], kP: [0, -1, 0] });
// Quatre pattes.
const ALL4 = k(BASE, { root: [0, 0.52, 0], pitch: 90, head: -5, hL: [0.17, 0.03, 0.5], eP: [0.3, 0, -1], fL: [0.1, 0.06, -0.48], tL: [0, 0, -1], kP: [0, 0.5, 1] });
// Assis sur un banc (haut du banc à 0,45 m).
const SEATED = k(BASE, { root: [0, 0.55, 0], fL: [0.17, 0.08, 0.45], kP: [0.1, 0.4, 1] });

// Squat
const SQ_UP = k(STAND, { fL: [0.16, 0.08, 0], hL: [0.17, 1.36, 0.5], kP: [0.3, 0, 1] });
const SQ_DOWN = k(SQ_UP, { root: [0, 0.52, -0.22], bend: 38, head: -25, hL: [0.17, 0.98, 0.42] });
const squat = { cam: 62, work: ['thigh', 'glute'], keys: [k(SQ_UP, { cue: 'Debout, pieds largeur d’épaules', hold: 0.3 }), k(SQ_DOWN, { t: 1.3, cue: 'Descends hanches en arrière, dos droit', hold: 0.25 }), k(SQ_UP, { t: 1, cue: 'Remonte en poussant dans les talons', hold: 0.4 })] };
const gobletUp = k(SQ_UP, { hL: [0.03, 1.25, 0.22], hR: [-0.03, 1.25, 0.22], eP: [0.4, -1, 0.2] });
const goblet = { ...squat, props: ['dbGoblet'], keys: [k(gobletUp, { cue: 'Haltère contre la poitrine', hold: 0.3 }), k(gobletUp, { root: [0, 0.52, -0.2], bend: 32, head: -25, hL: [0.03, 0.88, 0.2], hR: [-0.03, 0.88, 0.2], t: 1.3, cue: 'Coudes entre les genoux en bas', hold: 0.25 }), k(gobletUp, { t: 1, cue: 'Remonte, poitrine haute', hold: 0.4 })] };
const barUp = k(SQ_UP, { hL: [0.42, 1.43, -0.07], eP: [0.3, -1, -0.3] });
const barSquat = { ...squat, props: ['bar'], keys: [k(barUp, { cue: 'Barre sur le haut du dos', hold: 0.3 }), k(barUp, { root: [0, 0.55, -0.2], bend: 42, head: -30, hL: [0.42, 1.05, 0.14], t: 1.4, cue: 'Descends sous contrôle, genoux dans l’axe', hold: 0.25 }), k(barUp, { t: 1.1, cue: 'Pousse le sol pour remonter', hold: 0.4 })] };

// Pont fessier (sur le dos, genoux pliés)
const BR_DOWN = k(SUPINE, { fL: [0.14, 0.08, 0.42], tL: [0, 0, 1], kP: [0.1, 0.3, 1], hL: [0.3, 0.06, 0.15] });
const BR_UP = k(BR_DOWN, { root: [0, 0.38, -0.08], pitch: -122, head: 35, cue: 'Monte le bassin en serrant les fessiers' });
const bridge = { cam: 75, tilt: 24, work: ['glute', 'hams'], keys: [k(BR_DOWN, { cue: 'Sur le dos, pieds près des fesses', hold: 0.4 }), k(BR_UP, { t: 1, hold: 0.8 }), k(BR_DOWN, { t: 1.1, cue: 'Redescends lentement' })] };

// Soulevé de terre roumain
const RDL_UP = k(STAND, { hL: [0.2, 0.86, 0.12], eP: [0.3, -1, -1] });
const RDL_DOWN = k(RDL_UP, { root: [0, 0.9, -0.15], bend: 78, head: -40, hL: [0.18, 0.4, 0.3], kP: [0.1, 0, 1], cue: 'Hanches en arrière, dos plat, genoux souples' });
const rdl = (props) => ({ cam: 80, work: ['hams', 'glute', 'back'], props, keys: [k(RDL_UP, { cue: 'Debout, charge contre les cuisses', hold: 0.3 }), k(RDL_DOWN, { t: 1.4, hold: 0.25 }), k(RDL_UP, { t: 1.1, cue: 'Remonte en poussant les hanches vers l’avant', hold: 0.4 })] });

// Pompes
const PU_UP = HIGH_PLANK;
const PU_DOWN = k(HIGH_PLANK, { root: [0, 0.24, 0.02], pitch: 82, cue: 'Descends le corps gainé, coudes à 45°' });
const pushup = { cam: 70, work: ['chest', 'arm'], keys: [k(PU_UP, { cue: 'Mains sous les épaules, corps aligné', hold: 0.3 }), k(PU_DOWN, { t: 1.2, hold: 0.2 }), k(PU_UP, { t: 1, cue: 'Pousse le sol, sans creuser le dos', hold: 0.3 })] };
// Pompes en V : bassin haut, tête vers le sol
const PIKE_UP = k(BASE, { root: [0, 0.98, 0], pitch: 125, bend: 0, head: 20, hL: [0.2, 0.04, 0.62], eP: [0.6, 0, -1], fL: [0.12, 0.08, -0.55], tL: [0, -1, 0.5], kP: [0, 0, 1] });
const pike = { cam: 80, work: ['shoulder', 'arm'], keys: [k(PIKE_UP, { cue: 'Bassin haut, corps en V inversé', hold: 0.3 }), k(PIKE_UP, { root: [0, 0.74, 0.12], pitch: 108, cue: 'Plie les coudes, tête vers le sol', t: 1.2, hold: 0.2 }), k(PIKE_UP, { t: 1, cue: 'Pousse pour remonter', hold: 0.3 })] };

// Développé couché (allongé sur un banc)
const BENCH = ['box', [0, 0.22, -0.15, 0.32, 0.44, 1.15]];
const BP_DOWN = k(SUPINE, { root: [0, 0.56, 0.12], hL: [0.24, 0.7, -0.22], eP: [1, -0.6, 0.1], fL: [0.26, 0.08, 0.62], tL: [0, 0, 1], kP: [0.3, 0.2, 1] });
const BP_UP = k(BP_DOWN, { hL: [0.17, 1.18, -0.22], cue: 'Pousse vers le plafond' });
const benchPress = (props) => ({ cam: 50, work: ['chest', 'arm'], props: [BENCH, ...props], keys: [k(BP_UP, { cue: 'Allongé, bras tendus au-dessus de la poitrine', hold: 0.3 }), k(BP_DOWN, { t: 1.3, cue: 'Descends jusqu’à la poitrine, coudes à 45°', hold: 0.2 }), k(BP_UP, { t: 1, hold: 0.3 })] });
// Pull-over (allongé sur un banc)
const PO_UP = k(BP_UP, { hL: [0.03, 1.15, -0.25], hR: [-0.03, 1.15, -0.25], eP: [0.3, 0, -1] });
const pullover = { cam: 85, work: ['back', 'chest'], props: [BENCH, 'dbPull'], keys: [k(PO_UP, { cue: 'Haltère tenu à deux mains au-dessus de la poitrine', hold: 0.3 }), k(PO_UP, { hL: [0.03, 0.7, -0.95], hR: [-0.03, 0.7, -0.95], t: 1.5, cue: 'Descends derrière la tête, bras presque tendus', hold: 0.2 }), k(PO_UP, { t: 1.3, cue: 'Ramène au-dessus de la poitrine', hold: 0.3 })] };

// Rowing inversé sous une table
const TABLE = ['box', [0, 0.76, -0.45, 0.9, 0.04, 0.7]];
const IR_DOWN = k(SUPINE, { root: [0, 0.32, -0.08], pitch: -76, hL: [0.24, 0.73, -0.45], eP: [0.6, -1, 0], fL: [0.12, 0.08, 0.95], tL: [0, 1, 0.2], kP: [0.1, 0, 1] });
const IR_UP = k(IR_DOWN, { root: [0, 0.48, 0.05], pitch: -66, cue: 'Tire la poitrine vers la table, omoplates serrées' });
const invRow = { cam: 80, work: ['back', 'arm'], props: [TABLE], keys: [k(IR_DOWN, { cue: 'Sous la table, corps gainé, bras tendus', hold: 0.3 }), k(IR_UP, { t: 1.1, hold: 0.3 }), k(IR_DOWN, { t: 1.2, cue: 'Redescends lentement' })] };
// Rowing un bras, genou et main sur un banc
const ROW_BENCH = ['box', [0.2, 0.22, 0.2, 0.36, 0.44, 0.95]];
const OAR_DOWN = k(BASE, { root: [0, 0.82, -0.05], pitch: 82, head: -10, hL: [0.22, 0.47, 0.55], hR: [-0.2, 0.28, 0.2], eP: [0.5, -1, -0.6], eR: [0.3, -1, -0.6], fL: [0.2, 0.5, -0.3], tL: [0, 0.2, -1], kL: [0.1, -1, 0.3], fR: [-0.22, 0.08, -0.05], tR: [0, 0, 1] });
const OAR_UP = k(OAR_DOWN, { hR: [-0.2, 0.64, -0.02], cue: 'Tire le coude vers la hanche' });
const oneArmRow = { cam: -85, work: ['back', 'arm'], props: [ROW_BENCH, 'dbR'], keys: [k(OAR_DOWN, { cue: 'Genou et main sur le banc, dos plat', hold: 0.3 }), k(OAR_UP, { t: 1, hold: 0.3 }), k(OAR_DOWN, { t: 1.1, cue: 'Redescends en contrôlant' })] };
// Tirage horizontal assis
const SEAT_BOX = ['box', [0, 0.22, -0.05, 0.4, 0.44, 0.45]];
const SR_FWD = k(SEATED, { bend: 12, hL: [0.12, 0.95, 0.68], eP: [0.6, -1, -0.5], fL: [0.17, 0.12, 0.62], tL: [0, 0.4, 1] });
const SR_BACK = k(SR_FWD, { bend: -5, hL: [0.14, 0.88, 0.2], cue: 'Tire les coudes vers les hanches, poitrine haute' });
const seatedRow = { cam: 70, work: ['back', 'arm'], props: [SEAT_BOX, 'cableRow'], keys: [k(SR_FWD, { cue: 'Assis, bras tendus vers la poulie', hold: 0.3 }), k(SR_BACK, { t: 1.1, hold: 0.3 }), k(SR_FWD, { t: 1.2, cue: 'Relâche lentement' })] };
// Tirage vertical (poulie haute) assis
const LP_UP = k(SEATED, { hL: [0.38, 1.85, 0.06], eP: [1, -0.3, 0] });
const LP_DOWN = k(LP_UP, { bend: -8, hL: [0.36, 1.35, 0.06], cue: 'Tire la barre vers le haut de la poitrine' });
const latPull = { cam: 35, work: ['back', 'arm'], props: [SEAT_BOX, 'barPull'], keys: [k(LP_UP, { cue: 'Bras tendus, prise large', hold: 0.3 }), k(LP_DOWN, { t: 1.1, hold: 0.3 }), k(LP_UP, { t: 1.2, cue: 'Remonte en contrôlant' })] };

// Développé militaire assis / épaules debout
const MP_DOWN = k(SEATED, { hL: [0.3, 1.38, 0.05], eP: [1, -1, 0.1] });
const MP_UP = k(MP_DOWN, { hL: [0.16, 1.85, 0.02], cue: 'Pousse au-dessus de la tête sans creuser le dos' });
const militaryDb = { cam: 30, work: ['shoulder', 'arm'], props: [SEAT_BOX, 'db'], keys: [k(MP_DOWN, { cue: 'Assis, haltères à hauteur d’épaules', hold: 0.3 }), k(MP_UP, { t: 1.1, hold: 0.3 }), k(MP_DOWN, { t: 1.2 })] };
const MPB_DOWN = k(STAND, { fL: [0.14, 0.08, 0], hL: [0.25, 1.48, 0.12], eP: [0.5, -1, 0.5] });
const militaryBar = { cam: 60, work: ['shoulder', 'arm'], props: ['bar'], keys: [k(MPB_DOWN, { cue: 'Barre devant les épaules, abdos serrés', hold: 0.3 }), k(MPB_DOWN, { hL: [0.25, 2.0, 0.02], head: 5, t: 1.1, cue: 'Pousse au-dessus de la tête', hold: 0.3 }), k(MPB_DOWN, { t: 1.2 })] };

// Superman Y-T-W (sur le ventre)
const SUP_Y = k(PRONE, { root: [0, 0.12, 0], pitch: 82, head: -15, hL: [0.4, 0.22, 0.85], eP: [1, 0.3, 0], fL: [0.12, 0.1, -0.88] });
const superman = { cam: 55, tilt: 30, work: ['back', 'shoulder'], keys: [k(PRONE, { hL: [0.35, 0.06, 0.85], cue: 'Allongé sur le ventre', hold: 0.2 }), k(SUP_Y, { t: 0.9, cue: 'Y : bras en diagonale, poitrine décollée', hold: 0.5 }), k(SUP_Y, { hL: [0.72, 0.28, 0.48], t: 0.9, cue: 'T : bras sur les côtés', hold: 0.5 }), k(SUP_Y, { hL: [0.4, 0.3, 0.42], eP: [1, 0.3, -0.6], t: 0.9, cue: 'W : coudes vers les hanches', hold: 0.5 }), k(PRONE, { hL: [0.35, 0.06, 0.85], t: 0.9 })] };

// Fentes
const LU_UP = k(STAND, { hL: [0.2, 0.92, 0.04] });
const lungeDown = (sgn) => k(LU_UP, { root: [0, 0.55, 0.02], fL: sgn > 0 ? [0.13, 0.08, 0.38] : [0.13, 0.12, -0.52], fR: sgn > 0 ? [-0.13, 0.12, -0.52] : [-0.13, 0.08, 0.38], tL: sgn > 0 ? null : [0, -0.6, 0.8], tR: sgn > 0 ? [0, -0.6, 0.8] : null, kL: sgn > 0 ? null : [0.1, -1, 0.3], kR: sgn > 0 ? [0.1, -1, 0.3] : null });
const lunge = (props) => ({ cam: 80, work: ['thigh', 'glute'], props, keys: [k(LU_UP, { cue: 'Debout, buste droit', hold: 0.2 }), k(lungeDown(1), { t: 1.1, cue: 'Grand pas, genou arrière vers le sol', hold: 0.25 }), k(LU_UP, { t: 0.9, cue: 'Reviens en poussant sur le pied avant', hold: 0.2 }), k(lungeDown(-1), { t: 1.1, cue: 'Change de jambe', hold: 0.25 }), k(LU_UP, { t: 0.9 })] });
const BULG_BENCH = ['box', [0, 0.22, -0.7, 0.4, 0.44, 0.36]];
const BG_UP = k(STAND, { root: [0, 0.9, 0], fL: [0.13, 0.08, 0.2], fR: [-0.13, 0.5, -0.62], tR: [0, -0.7, -0.4], kR: [0.1, -1, 0.3], hL: [0.2, 0.88, 0.1] });
const bulgarian = { cam: 80, work: ['thigh', 'glute'], props: [BULG_BENCH], keys: [k(BG_UP, { cue: 'Pied arrière posé sur le banc', hold: 0.3 }), k(BG_UP, { root: [0, 0.58, -0.08], bend: 10, t: 1.2, cue: 'Descends le genou arrière vers le sol', hold: 0.2 }), k(BG_UP, { t: 1, cue: 'Remonte avec la jambe avant', hold: 0.3 })] };
const SL_MID = k(STAND, { fL: [0.42, 0.08, 0], hL: [0.12, 1.3, 0.45], kP: [0.6, 0, 1] });
const sideLunge = { cam: 15, work: ['thigh', 'glute'], keys: [k(SL_MID, { cue: 'Pieds très écartés', hold: 0.2 }), k(SL_MID, { root: [0.3, 0.62, -0.12], bend: 30, kL: [1, 0, 0.6], t: 1.1, cue: 'Plie une jambe, l’autre reste tendue', hold: 0.25 }), k(SL_MID, { t: 0.9 }), k(SL_MID, { root: [-0.3, 0.62, -0.12], bend: 30, kR: [1, 0, 0.6], t: 1.1, cue: 'Puis de l’autre côté', hold: 0.25 }), k(SL_MID, { t: 0.9 })] };

// Hip thrust (épaules sur le canapé ou un banc)
const HT_BENCH = ['box', [0, 0.21, -0.68, 1.1, 0.42, 0.4]];
const HT_DOWN = k(SUPINE, { root: [0, 0.2, -0.05], pitch: -45, head: 40, hL: [0.42, 0.44, -0.6], eP: [1, 0, -0.5], fL: [0.16, 0.08, 0.5], tL: [0, 0, 1], kP: [0.2, 0.3, 1] });
const HT_UP = k(HT_DOWN, { root: [0, 0.48, -0.08], pitch: -88, head: 60, cue: 'Monte jusqu’à l’alignement épaules-genoux, pause 1 s' });
const hipThrust = (props) => ({ cam: 82, work: ['glute', 'hams'], props: [HT_BENCH, ...props], keys: [k(HT_DOWN, { cue: 'Haut du dos sur le banc, pieds à plat', hold: 0.3 }), k(HT_UP, { t: 1, hold: 0.8 }), k(HT_DOWN, { t: 1.1, cue: 'Redescends sans toucher le sol' })] });

// Gainage
const breathe = (p, cue) => ({ cam: 60, work: ['core'], keys: [k(p, { cue, hold: 1 }), k(p, { root: add(p.root, [0, 0.012, 0]), t: 1.5, cue: 'Respire normalement, fessiers serrés' }), k(p, { t: 1.5 })] });
const plank = breathe(PLANK, 'Coudes sous les épaules, corps aligné');
const SIDE = k(PLANK, { root: [0, 0.42, 0], pitch: 90, roll: -90, tilt: -12, head: 0, hL: [0.02, 1.0, 0.42], eL: [0, -1, 0], hR: [0.25, 0.04, 0.5], eR: [1, 0, 0.3], fL: [0, 0.17, -0.86], fR: [0, 0.07, -0.88], tL: [1, 0, 0.1], tR: [1, 0, 0.1], kP: [0, 0, 1] });
const sidePlank = { ...breathe(SIDE, 'Coude sous l’épaule, bassin haut'), cam: 80 };
const plankThenSide = { cam: 55, work: ['core'], keys: [k(PLANK, { cue: 'Gainage face au sol', hold: 1.4 }), k(SIDE, { t: 1, cue: 'Pivote sur le côté, bassin haut', hold: 1.4 }), k(PLANK, { t: 1 })] };
const ROT_PLANK = k(HIGH_PLANK, { root: [0, 0.48, 0], pitch: 74 });
const rotPlank = { cam: 40, work: ['core', 'shoulder'], keys: [one(ROT_PLANK, { cue: 'Planche bras tendus', hold: 0.3 }), one(ROT_PLANK, { roll: -60, twist: -20, hL: [0.35, 1.2, 0.2], eL: [0, -1, 0], t: 1, cue: 'Ouvre le buste, bras vers le plafond', hold: 0.4 }), one(ROT_PLANK, { t: 0.9, hold: 0.2 }), one(ROT_PLANK, { roll: 60, twist: 20, hR: [-0.35, 1.2, 0.2], eR: [0, -1, 0], t: 1, cue: 'Puis de l’autre côté', hold: 0.4 }), one(ROT_PLANK, { t: 0.9 })] };
// Dead bug
const DB0 = k(SUPINE, { hL: [0.18, 0.66, -0.45], eP: [1, 0, 0.3], fL: [0.13, 0.52, 0.42], tL: [0, 0, 1], kP: [0.1, 0.8, 1] });
const deadbug = { cam: 70, tilt: 22, work: ['core'], keys: [one(DB0, { cue: 'Dos plaqué, bras vers le plafond, genoux à 90°', hold: 0.4 }), one(DB0, { hL: [0.2, 0.12, -1.0], fR: [-0.13, 0.16, 0.86], t: 1.2, cue: 'Tends bras et jambe opposés', hold: 0.3 }), one(DB0, { t: 1 }), one(DB0, { hR: [-0.2, 0.12, -1.0], fL: [0.13, 0.16, 0.86], t: 1.2, cue: 'Puis l’autre côté', hold: 0.3 }), one(DB0, { t: 1 })] };

// Cardio
const SQJ = k(SQ_DOWN, { hL: [0.25, 0.85, -0.05] });
const jumpSquat = (soft) => ({ cam: 62, work: ['thigh', 'glute'], keys: [k(SQ_UP, { hL: [0.25, 0.85, -0.05], cue: 'Debout', hold: 0.15 }), k(SQJ, { t: 0.7, cue: 'Descends en squat' }), k(SQ_UP, { root: [0, 1.25, 0], fL: [0.16, 0.36, -0.02], tL: [0, -0.6, 0.8], hL: [0.2, 1.95, 0.15], t: 0.35, cue: 'Saute en poussant fort' }), k(SQ_UP, { hL: [0.25, 0.85, -0.05], t: 0.3, cue: soft ? 'Réception souple sur la pointe des pieds' : 'Réception amortie' }), k(SQJ, { t: 0.45, hold: 0.3, cue: soft ? 'Genoux souples, dans l’axe' : 'Enchaîne' })] });
const MC = k(HIGH_PLANK, { root: [0, 0.5, 0], pitch: 68 });
const climbers = { cam: 72, work: ['core', 'thigh'], keys: [one(MC, { cue: 'Position de pompe', hold: 0.1 }), one(MC, { fL: [0.12, 0.3, -0.1], tL: [0, -0.4, 1], kL: [0.1, 0.5, 1], t: 0.3, cue: 'Genou vers la poitrine' }), one(MC, { t: 0.3 }), one(MC, { fR: [-0.12, 0.3, -0.1], tR: [0, -0.4, 1], kR: [0.1, 0.5, 1], t: 0.3, cue: 'Alterne rapidement' }), one(MC, { t: 0.3 })] };
const burpees = { cam: 75, work: ['thigh', 'chest', 'core'], keys: [k(STAND, { cue: 'Debout', hold: 0.2 }), k(SQ_DOWN, { root: [0, 0.48, -0.1], bend: 70, hL: [0.18, 0.04, 0.4], eP: [0.5, -1, -0.5], t: 0.6, cue: 'Mains au sol' }), k(HIGH_PLANK, { root: [0, 0.45, -0.25], hL: [0.2, 0.04, 0.4], fL: [0.1, 0.1, -1.1], t: 0.45, cue: 'Pieds en arrière : planche', hold: 0.2 }), k(SQ_DOWN, { root: [0, 0.48, -0.1], bend: 70, hL: [0.18, 0.04, 0.4], eP: [0.5, -1, -0.5], t: 0.45, cue: 'Ramène les pieds' }), k(STAND, { root: [0, 1.2, 0], fL: [0.12, 0.33, -0.02], tL: [0, -0.6, 0.8], hL: [0.2, 2, 0.1], t: 0.45, cue: 'Saute, bras en l’air' }), k(STAND, { t: 0.35 })] };
const jumpLunge = { cam: 80, work: ['thigh', 'glute'], keys: [k(lungeDown(1), { cue: 'En fente', hold: 0.2 }), k(LU_UP, { root: [0, 1.15, 0.02], fL: [0.13, 0.3, 0.05], fR: [-0.13, 0.3, -0.1], hL: [0.2, 1.1, 0.25], t: 0.4, cue: 'Saute et change de jambe en l’air' }), k(lungeDown(-1), { t: 0.4, hold: 0.25, cue: 'Réception amortie' }), k(LU_UP, { root: [0, 1.15, 0.02], fL: [0.13, 0.3, -0.1], fR: [-0.13, 0.3, 0.05], hL: [0.2, 1.1, 0.25], t: 0.4 }), k(lungeDown(1), { t: 0.4, hold: 0.25 })] };
const ATH = k(STAND, { root: [0, 0.8, -0.05], bend: 25, fL: [0.25, 0.08, 0], hL: [0.25, 1.0, 0.35], kP: [0.4, 0, 1] });
const shuffle = (touch) => ({ cam: 10, work: ['thigh'], keys: [k(ATH, { cue: 'Position athlétique, genoux fléchis', hold: 0.2 }), k(ATH, { root: [0, 0.88, -0.05], fL: [0.25, 0.2, 0], t: 0.18, cue: touch ? 'Pars en pas chassés' : 'Petit sautillement (split-step)' }), k(ATH, { t: 0.18 }), k(ATH, { root: [0.55, 0.8, -0.05], fL: [0.85, 0.08, 0], fR: [0.35, 0.08, 0], t: 0.5, cue: 'Pas chassés sur le côté' }), ...(touch ? [k(ATH, { root: [0.6, 0.6, -0.1], bend: 60, fL: [0.85, 0.08, 0], fR: [0.35, 0.08, 0], hL: [0.9, 0.06, 0.3], t: 0.3, cue: 'Touche la ligne au sol', hold: 0.1 })] : []), k(ATH, { root: [-0.55, 0.8, -0.05], fL: [-0.3, 0.08, 0], fR: [-0.8, 0.08, 0], t: 0.8, cue: 'Repars de l’autre côté' }), k(ATH, { t: 0.5 })] });
const dance = { cam: 20, work: [], keys: [k(STAND, { hL: [0.3, 1.0, 0.15], cue: 'Step-touch : un pas sur le côté', hold: 0.05 }), k(STAND, { root: [0.25, 0.92, 0], fL: [0.5, 0.08, 0], fR: [0.12, 0.12, 0], hL: [0.45, 1.3, 0.2], hR: [-0.1, 1.2, 0.35], t: 0.4 }), k(STAND, { root: [0.32, 0.95, 0], fL: [0.5, 0.08, 0], fR: [0.32, 0.14, 0.05], t: 0.35, cue: 'Ramène le pied, bras en rythme' }), k(STAND, { root: [-0.25, 0.92, 0], fL: [-0.12, 0.12, 0], fR: [-0.5, 0.08, 0], hR: [-0.45, 1.3, 0.2], hL: [0.1, 1.2, 0.35], t: 0.55, cue: 'Puis de l’autre côté' }), k(STAND, { root: [-0.32, 0.95, 0], fL: [-0.32, 0.14, 0.05], fR: [-0.5, 0.08, 0], t: 0.35 }), k(STAND, { hL: [0.3, 1.0, 0.15], t: 0.45 })] };

// Étirements
const quadStretch = { cam: 80, work: ['thigh'], keys: [one(STAND, { cue: 'Debout, en équilibre', hold: 0.2 }), one(STAND, { fR: [-0.12, 0.62, -0.32], tR: [0, 0.5, -0.2], kR: [0, -1, 0.1], hR: [-0.15, 0.72, -0.3], eR: [0.3, -0.2, -1], hL: [0.5, 1.2, 0.1], t: 1, cue: 'Talon vers la fesse, genoux serrés', hold: 2.2 }), one(STAND, { t: 1 })] };
const STEP = ['box', [0, 0.1, 0.48, 0.5, 0.2, 0.3]];
const HAM0 = k(STAND, { fL: [0.12, 0.28, 0.48], tL: [0, 1, 0.4], kL: [0.1, 1, 0.1], hL: [0.18, 0.88, 0.2] });
const hamStretch = { cam: 85, work: ['hams'], props: [STEP], keys: [k(HAM0, { cue: 'Talon sur la marche, jambe tendue', hold: 0.4 }), k(HAM0, { root: [0, 0.92, -0.1], bend: 45, curve: -4, head: -20, hL: [0.18, 0.55, 0.4], t: 1.4, cue: 'Penche-toi dos droit, jusqu’à sentir l’étirement', hold: 2 }), k(HAM0, { t: 1.1 })] };
const WALL = ['box', [0.6, 1.1, 0.25, 0.08, 2.2, 1.4]];
const PEC0 = k(STAND, { root: [0, 0.95, 0], hL: [0.53, 1.55, 0.25], eL: [0, -1, 0], fL: [0.14, 0.08, 0.05] });
const pecStretch = { cam: -20, work: ['chest'], props: [WALL], keys: [one(PEC0, { cue: 'Avant-bras contre le mur, coude à hauteur d’épaule', hold: 0.4 }), one(PEC0, { yaw: -30, root: [0, 0.95, 0.05], hR: [-0.3, 0.92, 0.1], t: 1.4, cue: 'Tourne doucement le buste à l’opposé', hold: 2 }), one(PEC0, { t: 1.2 })] };
const shoulderStretch = { cam: 30, work: ['shoulder'], keys: [k(STAND, { cue: 'Debout, épaules basses', hold: 0.2 }), k(STAND, { hL: [-0.28, 1.4, 0.18], eL: [0, -1, 1], hR: [-0.05, 1.25, 0.35], eR: [0.6, -1, 0], t: 1, cue: 'Bras tendu devant la poitrine, tire avec l’autre main', hold: 2 }), k(STAND, { t: 0.8 }), k(STAND, { hR: [0.28, 1.4, 0.18], eR: [0, -1, 1], hL: [0.05, 1.25, 0.35], eL: [0.6, -1, 0], t: 1, cue: 'Puis l’autre bras', hold: 2 }), k(STAND, { t: 0.8 })] };
const CHILD = k(ALL4, { root: [0, 0.3, -0.35], pitch: 120, curve: 12, head: 10, hL: [0.2, 0.03, 0.55], eP: [0.3, 1, 0], fL: [0.12, 0.05, -0.55], tL: [0, 0, -1] });
const child = { cam: 75, work: ['back'], keys: [k(ALL4, { cue: 'À quatre pattes', hold: 0.3 }), k(CHILD, { t: 1.6, cue: 'Fesses vers les talons, front au sol, bras devant', hold: 2.4 }), k(ALL4, { t: 1.4 })] };

// Yoga
const catCow = { cam: 80, work: ['back'], keys: [k(ALL4, { cue: 'À quatre pattes, dos neutre', hold: 0.3 }), k(ALL4, { curve: 24, head: 30, root: [0, 0.55, 0], t: 1.4, cue: 'Expire : dos rond, menton vers la poitrine', hold: 0.6 }), k(ALL4, { curve: -18, head: -40, root: [0, 0.5, 0], t: 1.6, cue: 'Inspire : dos creux, regard devant', hold: 0.6 }), k(ALL4, { t: 1.2 })] };
const DOG = k(ALL4, { root: [0, 0.95, -0.1], pitch: 132, head: 15, hL: [0.22, 0.03, 0.62], eP: [0.3, 0, -1], fL: [0.12, 0.08, -0.58], tL: [0, -0.15, 1], kP: [0, 0, 1] });
const dog = { cam: 82, work: ['hams', 'shoulder'], keys: [k(ALL4, { cue: 'À quatre pattes', hold: 0.3 }), k(DOG, { t: 1.5, cue: 'Pousse le bassin vers le haut et l’arrière', hold: 0.6 }), k(DOG, { fL: [0.12, 0.08, -0.62], fR: [-0.12, 0.08, -0.62], tL: [0, -0.4, 1], root: [0, 0.92, -0.12], t: 1, cue: 'Talons vers le sol, dos long', hold: 1.5 }), k(ALL4, { t: 1.4 })] };
const LOW = k(STAND, { root: [0, 0.42, 0.05], fL: [0.14, 0.08, 0.48], fR: [-0.14, 0.06, -0.68], tR: [0, 0, -1], kR: [0.1, -1, 0.3], hL: [0.18, 0.03, 0.62], eP: [0.5, -1, -0.5] });
const lowLunge = { cam: 80, work: ['thigh'], keys: [k(LOW, { cue: 'Genou arrière au sol, mains de chaque côté du pied', hold: 0.5 }), k(LOW, { root: [0, 0.4, 0.15], hL: [0.25, 1.65, 0.3], head: -10, t: 1.4, cue: 'Bassin vers l’avant, bras vers le ciel', hold: 2 }), k(LOW, { t: 1.2 })] };
const W_BASE = k(STAND, { yaw: 90, root: [0, 0.93, 0], fL: [0, 0.08, -0.5], fR: [0, 0.08, 0.5], tL: [0, 0, -1], tR: [1, 0, 0.25], kL: [1, 0, 0.3], kR: [0.2, 0, 1] });
const W2 = k(W_BASE, { root: [0, 0.68, 0.02], hL: [0, 1.4, -0.8], hR: [0, 1.4, 0.8], eP: [0.3, -1, 0] });
const warrior = { cam: 70, work: ['thigh'], keys: [k(W_BASE, { cue: 'Pieds écartés, pied avant tourné', hold: 0.4 }), k(W2, { t: 1.4, cue: 'Plie le genou avant au-dessus de la cheville, bras tendus', hold: 2.2 }), k(W_BASE, { t: 1.2 })] };
const PG0 = k(SUPINE, { fL: [0.14, 0.08, 0.42], tL: [0, 0, 1], kP: [0.1, 0.3, 1], hL: [0.3, 0.06, 0.15] });
const pigeon = { cam: 55, tilt: 24, work: ['glute'], keys: [k(PG0, { cue: 'Sur le dos, pieds au sol', hold: 0.3 }), k(PG0, { fR: [0.12, 0.38, 0.33], tR: [1, 0, 0.2], kR: [1, 0.3, 0.6], t: 1, cue: 'Cheville sur le genou opposé', hold: 0.5 }), k(PG0, { fR: [0.08, 0.6, 0.12], tR: [1, 0, 0.2], kR: [1, 0.3, 0.6], fL: [0.14, 0.55, 0.32], tL: [0, 0.6, 1], kL: [0.2, 0.8, 1], hL: [0.12, 0.42, 0.12], eP: [1, 0, 0], t: 1.3, cue: 'Rapproche la jambe vers la poitrine', hold: 2 }), k(PG0, { t: 1.3 })] };
const TW0 = k(SUPINE, { hL: [0.72, 0.06, -0.38], eP: [0, 1, 0], fL: [0.12, 0.08, 0.42], tL: [0, 0, 1], kP: [0.1, 0.3, 1] });
const twist = { cam: 20, tilt: 40, work: ['back'], keys: [k(TW0, { cue: 'Sur le dos, bras en croix, genoux pliés', hold: 0.4 }), k(TW0, { fL: [0.5, 0.12, 0.35], fR: [0.3, 0.12, 0.42], kL: [1, 0.2, 0.5], kR: [1, 0.2, 0.5], head: 0, t: 1.5, cue: 'Genoux d’un côté, épaules au sol', hold: 1.6 }), k(TW0, { t: 1.2 }), k(TW0, { fR: [-0.5, 0.12, 0.35], fL: [-0.3, 0.12, 0.42], kR: [1, 0.2, 0.5], kL: [1, 0.2, 0.5], t: 1.5, cue: 'Puis de l’autre côté', hold: 1.6 }), k(TW0, { t: 1.2 })] };
const mobility = { cam: 40, work: ['glute'], keys: [one(STAND, { hL: [0.22, 0.98, 0.1], cue: 'Mains sur les hanches', hold: 0.1 }), one(STAND, { hL: [0.22, 0.98, 0.1], fR: [-0.12, 0.45, 0.35], tR: [0, -0.3, 1], kR: [0, 0.5, 1], t: 0.7, cue: 'Monte le genou' }), one(STAND, { hL: [0.22, 0.98, 0.1], fR: [-0.48, 0.45, 0.05], tR: [-0.5, -0.3, 0.6], kR: [1, 0.5, 0.2], t: 0.7, cue: 'Ouvre la hanche sur le côté' }), one(STAND, { hL: [0.22, 0.98, 0.1], t: 0.7 }), one(STAND, { hL: [0.22, 0.98, 0.1], fR: [-0.12, 0.2, 0.25], tR: [0.6, -0.5, 0.6], t: 0.5, cue: 'Cercles de cheville' }), one(STAND, { hL: [0.22, 0.98, 0.1], fR: [-0.12, 0.2, 0.25], tR: [-0.6, -0.5, 0.6], t: 0.6 }), one(STAND, { hL: [0.22, 0.98, 0.1], t: 0.6 })] };


// Échauffement, retour au calme, respiration
const march = (fast) => ({ cam: 55, work: ['thigh'], keys: [one(STAND, { hL: [0.2, 0.95, 0.12], cue: fast ? 'Sur place, genoux actifs' : 'Marche tranquille, épaules relâchées' }), one(STAND, { fL: [0.12, fast ? 0.32 : 0.2, 0.18], tL: [0, -0.4, 1], hL: [0.2, 0.95, -0.12], hR: [-0.2, 1.05, 0.25], t: fast ? 0.3 : 0.5 }), one(STAND, { hL: [0.2, 0.95, 0.12], t: fast ? 0.3 : 0.5 }), one(STAND, { fR: [-0.12, fast ? 0.32 : 0.2, 0.18], tR: [0, -0.4, 1], hR: [-0.2, 0.95, -0.12], hL: [0.2, 1.05, 0.25], t: fast ? 0.3 : 0.5 }), one(STAND, { hL: [0.2, 0.95, 0.12], t: fast ? 0.3 : 0.5 })] });
const AC = k(STAND, { fL: [0.15, 0.08, 0] });
const armCircles = { cam: 35, work: ['shoulder'], keys: [k(AC, { hL: [0.72, 1.4, 0], cue: 'Bras tendus sur les côtés' }), k(AC, { hL: [0.62, 1.45, 0.3], t: 0.4, cue: 'Grands cercles de bras' }), k(AC, { hL: [0.55, 1.8, 0.1], t: 0.4 }), k(AC, { hL: [0.62, 1.4, -0.3], t: 0.4 }), k(AC, { hL: [0.72, 1.4, 0], t: 0.4 }), k(AC, { hL: [0.22, 1.0, 0.05], t: 0.5, cue: 'Puis cercles de hanches, mains sur la taille' }), k(AC, { hL: [0.22, 1.0, 0.05], root: [0.06, 0.94, 0.04], t: 0.5 }), k(AC, { hL: [0.22, 1.0, 0.05], root: [0, 0.94, 0.08], t: 0.5 }), k(AC, { hL: [0.22, 1.0, 0.05], root: [-0.06, 0.94, 0.04], t: 0.5 }), k(AC, { t: 0.5 })] };
const kneesHeels = { cam: 70, work: ['thigh'], keys: [one(STAND, { hL: [0.22, 1.1, 0.2], cue: 'Montées de genoux' }), one(STAND, { fL: [0.12, 0.5, 0.35], tL: [0, -0.3, 1], hR: [-0.2, 1.2, 0.3], t: 0.3 }), one(STAND, { t: 0.25 }), one(STAND, { fR: [-0.12, 0.5, 0.35], tR: [0, -0.3, 1], hL: [0.2, 1.2, 0.3], t: 0.3 }), one(STAND, { t: 0.25, cue: 'Puis talons-fesses' }), one(STAND, { fL: [0.12, 0.6, -0.3], tL: [0, 0.4, -0.5], kL: [0, -1, 0.2], t: 0.3 }), one(STAND, { t: 0.25 }), one(STAND, { fR: [-0.12, 0.6, -0.3], tR: [0, 0.4, -0.5], kR: [0, -1, 0.2], t: 0.3 }), one(STAND, { t: 0.25 })] };
const highKnees = { ...kneesHeels, keys: kneesHeels.keys.slice(0, 4).map((x, i) => (i === 0 ? { ...x, cue: 'Genoux à hauteur de hanches, bras actifs' } : x)) };
const lungeTwist = { cam: 60, work: ['thigh', 'core'], keys: [k(LU_UP, { hL: [0.15, 1.25, 0.3], cue: 'Debout, bras devant la poitrine' }), k(lungeDown(1), { hL: [0.15, 1.25, 0.3], twist: 45, t: 1, cue: 'Fente avant et rotation du buste côté jambe avant', hold: 0.3 }), k(LU_UP, { hL: [0.15, 1.25, 0.3], t: 0.8 }), k(lungeDown(-1), { hL: [0.15, 1.25, 0.3], twist: -45, t: 1, cue: 'Puis de l’autre côté', hold: 0.3 }), k(LU_UP, { hL: [0.15, 1.25, 0.3], t: 0.8 })] };
const jacks = { cam: 15, work: ['thigh', 'shoulder'], keys: [k(STAND, { fL: [0.1, 0.08, 0], cue: 'Pieds joints, bras le long du corps' }), k(STAND, { root: [0, 1.05, 0], fL: [0.3, 0.2, 0], hL: [0.35, 1.95, 0.05], t: 0.22, cue: 'Saute : pieds écartés, bras en l’air' }), k(STAND, { fL: [0.32, 0.08, 0], hL: [0.3, 2.0, 0.05], t: 0.18 }), k(STAND, { root: [0, 1.05, 0], fL: [0.15, 0.2, 0], t: 0.22, cue: 'Atterrissage souple' }), k(STAND, { fL: [0.1, 0.08, 0], t: 0.18 })] };
const breath = (base, cue) => ({ cam: 50, work: ['core'], keys: [k(base, { cue: cue[0] }), k(base, { root: add(base.root, [0, 0.015, 0]), curve: -3, head: -4, hL: base.hL && add(base.hL, [0.02, 0.03, 0]), t: 3.5, cue: cue[1], hold: 0.4 }), k(base, { t: 4.5, cue: cue[2], hold: 0.6 })] });
const breathStand = breath(STAND, ['Debout, épaules relâchées', 'Inspire par le nez, ventre qui se gonfle', 'Expire longuement par la bouche']);
const breathLying = { ...breath(k(SUPINE, { fL: [0.14, 0.08, 0.42], tL: [0, 0, 1], kP: [0.1, 0.3, 1], hL: [0.3, 0.06, 0.15] }), ['Allongé, genoux pliés', 'Deux inspirations par le nez', 'Longue expiration par la bouche']), tilt: 24 };

// Exercice → animation.
export const ANIMS = {
  'Squat au poids du corps': squat,
  'Goblet squat avec un haltère': goblet,
  'Squat à la barre ou presse à cuisses': barSquat,
  'Squats lents, amplitude progressive': squat,
  'Pont fessier': bridge,
  'Soulevé de terre roumain aux haltères': rdl(['db']),
  'Soulevé de terre roumain à la barre': rdl(['bar']),
  'Pompes': pushup,
  'Développé couché aux haltères (au sol ou sur banc)': benchPress(['db']),
  'Développé couché ou machine pectoraux': benchPress(['bar']),
  'Rowing inversé sous une table solide': invRow,
  'Rowing un bras avec haltère, appui sur un banc': oneArmRow,
  'Tirage horizontal à la poulie': seatedRow,
  'Pompes en V (pike push-up)': pike,
  'Développé militaire aux haltères assis': militaryDb,
  'Développé épaules à la machine ou à la barre': militaryBar,
  'Superman « Y-T-W » au sol': superman,
  'Pull-over avec haltère': pullover,
  'Tirage vertical à la poulie ou tractions assistées': latPull,
  'Fentes alternées': lunge([]),
  'Fentes avec haltères': lunge(['db']),
  'Fentes bulgares ou presse unilatérale': bulgarian,
  'Fentes latérales': sideLunge,
  'Hip thrust sur le canapé': hipThrust([]),
  'Hip thrust avec haltère sur les hanches': hipThrust(['dbHip']),
  'Hip thrust à la barre ou machine': hipThrust(['barHip']),
  'Planche': plank,
  'Planche latérale': sidePlank,
  'Dead bug': deadbug,
  'Gainage avant puis latéral': plankThenSide,
  'Rotation du buste avec gainage': rotPlank,
  'Burpees': burpees,
  'Mountain climbers': climbers,
  'Squats sautés': jumpSquat(false),
  'Squats sautés réception amortie': jumpSquat(true),
  'Fentes sautées': jumpLunge,
  'Sprints navette 5-10-5': shuffle(true),
  'Split-step et déplacements latéraux': shuffle(false),
  'Étirement des quadriceps (debout, talon vers la fesse)': quadStretch,
  'Étirement des ischios (jambe tendue sur une marche)': hamStretch,
  'Étirement des pectoraux contre un mur': pecStretch,
  'Étirements des épaules au bord': shoulderStretch,
  'Posture de l’enfant': child,
  'Chat-vache': catCow,
  'Chien tête en bas': dog,
  'Fente basse (chaque côté)': lowLunge,
  'Guerrier II (chaque côté)': warrior,
  'Pigeon couché (chaque côté)': pigeon,
  'Torsion allongée (chaque côté)': twist,
  'Mobilité des hanches et chevilles': mobility,
  'Pas de base (step-touch, grapevine, pas chassé)': dance,
  'Marche rapide ou course très lente sur place': march(true),
  'Marche lente, respiration ample': march(false),
  'Cercles de bras, d’épaules et de hanches': armCircles,
  'Montées de genoux et talons-fesses': kneesHeels,
  'Montées de genoux': highKnees,
  'Fentes avant dynamiques avec rotation du buste': lungeTwist,
  'Jumping jacks': jacks,
  'Respiration lente : 4 s inspiration, 6 s expiration': breathStand,
  'Respiration consciente assise': breathStand,
  'Soupir cyclique allongé': breathLying,
};
export const hasAnim = (label) => !!ANIMS[label];

// Pose à l'instant t (secondes) d'une animation : keys = [pose, …], chaque pose a t (durée pour y arriver) et hold.
function timeline(a) {
  const keys = a.keys.map((x) => ({ ...BASE, ...x }));
  const seg = keys.map((x, i) => ({ dur: i === 0 ? 0.6 : x.t || 1, hold: x.hold || 0 }));
  const total = seg.reduce((s, x) => s + x.dur + x.hold, 0);
  return { keys, seg, total };
}
function poseAt(tl, time) {
  let t = time % tl.total;
  const n = tl.keys.length;
  for (let i = 0; i < n; i++) {
    // l'étape 0 revient de la dernière pose à la première (boucle)
    const from = tl.keys[(i - 1 + n) % n], to = tl.keys[i], { dur, hold } = tl.seg[i];
    if (t < dur) return { pose: blend(from, to, ease(t / dur)), cue: to.cue || from.cue || '' };
    t -= dur;
    if (t < hold) return { pose: to, cue: to.cue || '' };
    t -= hold;
  }
  return { pose: tl.keys[0], cue: tl.keys[0].cue || '' };
}

// ---------- Rendu ----------
const NAVY = [26, 62, 118], NAVY_DEEP = [8, 20, 46], HOLO = [90, 215, 255], TEAL = [40, 214, 214], PALE = [214, 246, 255], WORK = [251, 146, 60], METAL = [150, 170, 195];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function camera(yaw, pitch) {
  const M = mm(Rx(-pitch), Ry(-yaw));
  return (p, c) => { const q = mv(M, sub(p, c)); return q; };
}

// Segments à dessiner pour un squelette.
function parts(S, work, props, pose) {
  const out = [];
  const w = (name) => work.includes(name);
  const seg = (a, b, r, hot, kind = 'body') => out.push({ a, b, r, hot, kind });
  seg(S.pelvis, S.mid, RAD.torso, w('core') || w('back') || w('glute'));
  seg(S.mid, S.chest, RAD.chest, w('chest') || w('back') || w('core'));
  for (const k of ['L', 'R']) {
    const s = S.side[k];
    seg(S.chest, s.shoulder, 0.055, w('shoulder') || w('chest'));
    seg(S.pelvis, s.hip, 0.085, w('glute'));
    seg(s.shoulder, s.elbow, RAD.arm, w('arm') || w('shoulder'));
    seg(s.elbow, s.wrist, RAD.fore, w('arm'));
    seg(s.wrist, s.handEnd, 0.034, false);
    seg(s.hip, s.knee, RAD.thigh, w('thigh') || w('hams') || w('glute'));
    seg(s.knee, s.ankle, RAD.shin, w('thigh') && false);
    seg(s.ankle, s.toe, RAD.foot, false);
  }
  out.push({ kind: 'head', c: S.head, r: RAD.head, R: S.headR });
  // charges dans les mains
  const L = S.side.L, R = S.side.R;
  const across = norm(sub(L.shoulder, R.shoulder));
  const dumbbell = (h, dir = across) => {
    seg(add(h, mul(dir, -0.1)), add(h, mul(dir, 0.1)), 0.016, false, 'metal');
    for (const s of [-1, 1]) out.push({ kind: 'disc', c: add(h, mul(dir, s * 0.095)), n: dir, r: 0.055, w: 0.05 });
  };
  const barbell = (a, b) => {
    const m = mul(add(a, b), 0.5), d = norm(sub(a, b));
    seg(add(m, mul(d, -0.72)), add(m, mul(d, 0.72)), 0.015, false, 'metal');
    for (const s of [-1, 1]) out.push({ kind: 'disc', c: add(m, mul(d, s * 0.58)), n: d, r: 0.16 });
  };
  for (const p of props) {
    if (p === 'db') { dumbbell(L.wrist); dumbbell(R.wrist); }
    if (p === 'dbR') dumbbell(R.wrist, norm(mv(S.chestR, [0, 0, 1])));
    if (p === 'dbGoblet' || p === 'dbPull') dumbbell(mul(add(L.wrist, R.wrist), 0.5), norm(mv(S.chestR, p === 'dbGoblet' ? [0, 1, 0] : [0, 0, 1])));
    if (p === 'dbHip') dumbbell(add(S.pelvis, mv(S.pelvisR, [0, 0, 0.16])));
    if (p === 'bar' || p === 'barPull') barbell(L.wrist, R.wrist);
    if (p === 'barHip') { const c = add(S.pelvis, mv(S.pelvisR, [0, 0, 0.18])); barbell(add(c, [0.3, 0, 0]), add(c, [-0.3, 0, 0])); }
    if (p === 'barPull') { const m = mul(add(L.wrist, R.wrist), 0.5); seg(m, [m[0], 2.6, m[2]], 0.006, false, 'cable'); }
    if (p === 'cableRow') { const m = mul(add(L.wrist, R.wrist), 0.5); seg(m, [0, 0.35, 1.2], 0.006, false, 'cable'); seg(L.wrist, R.wrist, 0.014, false, 'metal'); }
  }
  void pose;
  return out;
}

// Anime une démonstration dans un canvas. Renvoie une fonction d'arrêt.
export function play(canvas, label, { onCue, at, yaw } = {}) {
  const a = ANIMS[label];
  if (!a) return () => {};
  const tl = timeline(a);
  const props = (a.props || []).filter((p) => typeof p === 'string');
  const boxes = (a.props || []).filter((p) => Array.isArray(p)).map(([, b]) => b);
  const ctx = canvas.getContext('2d');
  // centre et taille de la scène, sur toute l'animation (pas de recadrage pendant le mouvement)
  const pts = [];
  for (let t = 0; t < tl.total; t += 0.25) { const S = skeleton(poseAt(tl, t).pose); pts.push(S.head, S.pelvis, ...Object.values(S.side).flatMap((s) => [s.wrist, s.toe, s.knee, s.elbow])); }
  for (const b of boxes) pts.push([b[0] - b[3] / 2, b[1] - b[4] / 2, b[2] - b[5] / 2], [b[0] + b[3] / 2, b[1] + b[4] / 2, b[2] + b[5] / 2]);
  const lo = [0, 1, 2].map((i) => Math.min(...(i === 1 ? [0] : []), ...pts.map((p) => p[i])));
  const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const center = [(lo[0] + hi[0]) / 2, Math.max(0.45, (lo[1] + hi[1]) / 2), (lo[2] + hi[2]) / 2];
  const radius = Math.max(0.85, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 + 0.12);
  let yaw0 = (yaw ?? a.cam ?? 60) * D, drag = 0, dragging = false, lastX = 0, idle = 0;
  const pitch = (a.tilt ?? 14) * D;
  const t0 = performance.now();
  let raf = 0, lastCue = null, visible = true;

  const onDown = (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (!dragging) return; drag += (e.clientX - lastX) * 0.012; lastX = e.clientX; idle = performance.now(); };
  const onUp = () => { dragging = false; idle = performance.now(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }) : null;
  io?.observe(canvas);

  function frame(now) {
    raf = 0;
    if (!canvas.isConnected) return stop();
    if (!visible) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const time = at ?? (now - t0) / 1000;
    const { pose, cue } = poseAt(tl, time);
    if (cue !== lastCue) { lastCue = cue; onCue?.(cue); }
    // caméra : lent balancement, ou angle choisi au doigt
    const sway = at != null ? 0 : dragging || now - idle < 2500 ? 0 : Math.sin(time * 0.35) * 0.3;
    const cam = camera(yaw0 + drag + sway, pitch);
    const scale = Math.min(W, H * 1.25) / (radius * 2.25);
    const dist = 4.2;
    const proj = (p) => { const q = cam(p, center); const f = dist / (dist - q[2]); return [W / 2 + q[0] * scale * f, H * 0.54 - q[1] * scale * f, q[2], f]; };

    // plateforme hologramme au sol
    const fc = [center[0], 0, center[2]];
    const ring = (r, a) => {
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2; const p = proj([fc[0] + Math.cos(t) * r, 0, fc[2] + Math.sin(t) * r]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.strokeStyle = rgb(HOLO, a); ctx.lineWidth = 1.2 * dpr; ctx.stroke();
    };
    const R0 = radius * 1.05;
    {
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const t = (i / 64) * Math.PI * 2; const p = proj([fc[0] + Math.cos(t) * R0, 0, fc[2] + Math.sin(t) * R0]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      const c = proj(fc);
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R0 * scale);
      g.addColorStop(0, rgb(HOLO, 0.16)); g.addColorStop(1, rgb(HOLO, 0.02));
      ctx.fillStyle = g; ctx.fill();
    }
    ring(R0, 0.55); ring(R0 * 0.66, 0.22); ring(R0 * 0.33, 0.14);
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * Math.PI + time * 0.05;
      const p1 = proj([fc[0] + Math.cos(t) * R0, 0, fc[2] + Math.sin(t) * R0]), p2 = proj([fc[0] - Math.cos(t) * R0, 0, fc[2] - Math.sin(t) * R0]);
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.strokeStyle = rgb(HOLO, 0.1); ctx.lineWidth = dpr; ctx.stroke();
    }

    const S = skeleton(pose);
    // ombres portées (projection verticale), plus nettes près du sol
    for (const p of [S.pelvis, S.mid, S.chest, S.head, ...Object.values(S.side).flatMap((s) => [s.knee, s.ankle, s.toe, s.wrist, s.elbow])]) {
      const q = proj([p[0], 0, p[2]]);
      const r = (0.13 * scale * q[3]) * (1 + p[1] * 0.4);
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      g.addColorStop(0, `rgba(0,10,30,${0.22 / (1 + p[1] * 3)})`); g.addColorStop(1, 'rgba(0,10,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    }

    // agrès (banc, table, mur), dessinés derrière le corps
    for (const b of boxes) drawBox(ctx, b, proj, cam, center, dpr);

    // corps et charges, du plus loin au plus proche
    const items = parts(S, a.work || [], props, pose).map((it) => {
      if (it.kind === 'head') { const p = proj(it.c); return { ...it, p, z: p[2] }; }
      if (it.kind === 'disc') { const ring = discPoints(it).map(proj); return { ...it, ring, z: proj(it.c)[2] }; }
      const pa = proj(it.a), pb = proj(it.b);
      return { ...it, pa, pb, z: (pa[2] + pb[2]) / 2 };
    }).sort((x, y) => x.z - y.z);
    const zs = items.map((i) => i.z), zmin = Math.min(...zs), zmax = Math.max(...zs);
    for (const it of items) {
      const depth = zmax > zmin ? (it.z - zmin) / (zmax - zmin) : 1; // 0 = loin, 1 = près
      if (it.kind === 'head') drawHead(ctx, it, scale, cam, dpr, time);
      else if (it.kind === 'disc') drawDisc(ctx, it, dpr);
      else drawSeg(ctx, it, scale, depth, dpr, time);
    }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = -1;
    io?.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
  }
  raf = requestAnimationFrame(frame);
  return stop;
}

// Segment ombré comme un cylindre : contour cyan, dégradé clair → sombre à travers la largeur.
function drawSeg(ctx, it, scale, depth, dpr, time) {
  const [x1, y1, , f1] = it.pa, [x2, y2, , f2] = it.pb;
  const w = Math.max(1.2 * dpr, it.r * 2 * scale * (f1 + f2) / 2);
  let nx = -(y2 - y1), ny = x2 - x1;
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  if (nx * -0.6 + ny * -0.8 < 0) { nx = -nx; ny = -ny; } // côté éclairé en haut à gauche
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  ctx.lineCap = 'round';
  if (it.kind === 'cable') {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = rgb(HOLO, 0.45); ctx.lineWidth = 1.3 * dpr; ctx.stroke();
    return;
  }
  const base = it.kind === 'metal' ? METAL : it.hot ? mixc(NAVY, WORK, 0.55 + 0.25 * Math.sin(time * 3)) : NAVY;
  const dim = 0.72 + 0.28 * depth;
  // contour lumineux
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = it.hot ? rgb(WORK, 0.75) : rgb(HOLO, 0.55 + 0.3 * depth);
  ctx.lineWidth = w + 2.2 * dpr; ctx.stroke();
  const g = ctx.createLinearGradient(mx + nx * w / 2, my + ny * w / 2, mx - nx * w / 2, my - ny * w / 2);
  g.addColorStop(0, rgb(mixc(base, [255, 255, 255], 0.35).map((c) => c * dim)));
  g.addColorStop(0.35, rgb(base.map((c) => c * dim)));
  g.addColorStop(0.85, rgb(mixc(base, NAVY_DEEP, 0.7).map((c) => c * dim)));
  g.addColorStop(1, rgb(mixc(NAVY_DEEP, HOLO, 0.5)));
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = g; ctx.lineWidth = w; ctx.stroke();
}

// Tête de Diana : sphère bleu nuit, bandeau turquoise, yeux pâles (visibles quand elle est de face).
function drawHead(ctx, it, scale, cam, dpr) {
  const [x, y, , f] = it.p;
  const r = it.r * scale * f;
  ctx.beginPath(); ctx.arc(x, y, r + 1.2 * dpr, 0, Math.PI * 2); ctx.fillStyle = rgb(HOLO, 0.8); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, rgb([70, 120, 190])); g.addColorStop(0.6, rgb(NAVY)); g.addColorStop(1, rgb(NAVY_DEEP));
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  const o = [0, 0, 0];
  const toScreen = (v) => { const q = cam(v, o); return [q[0], -q[1], q[2]]; };
  // bandeau : cercle horizontal de la tête projeté
  const R = it.R;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const v = toScreen(mv(R, [Math.cos(t) * 1.02, 0.42, Math.sin(t) * 1.02]));
    if (v[2] < -0.05) { started = false; continue; }
    const px = x + v[0] * r, py = y + v[1] * r;
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = rgb(TEAL); ctx.lineWidth = r * 0.28; ctx.lineCap = 'butt'; ctx.stroke();
  // yeux
  for (const s of [1, -1]) {
    const v = toScreen(mv(R, norm([s * 0.33, 0.08, 0.94])));
    if (v[2] < 0.15) continue;
    ctx.beginPath(); ctx.ellipse(x + v[0] * r, y + v[1] * r, r * 0.13 * Math.max(0.3, v[2]), r * 0.17, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgb(PALE); ctx.fill();
  }
  ctx.restore();
}

// Disque (poids d'haltère ou de barre) : cercle dans le plan perpendiculaire à la barre.
function discPoints({ c, n, r }) {
  const u = norm(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] : [1, 0, 0]);
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return Array.from({ length: 20 }, (_, i) => { const t = (i / 20) * Math.PI * 2; return add(c, add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r))); });
}
function drawDisc(ctx, it, dpr) {
  ctx.beginPath(); it.ring.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  ctx.fillStyle = 'rgba(120,140,170,.92)'; ctx.fill();
  ctx.strokeStyle = rgb(HOLO, 0.7); ctx.lineWidth = Math.max(2, (it.w || 0.04) * 60) * dpr * 0.5; ctx.stroke();
}

// Agrès : boîte translucide aux arêtes lumineuses.
function drawBox(ctx, b, proj, cam, center, dpr) {
  const [cx, cy, cz, sx, sy, sz] = b;
  const v = [];
  for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-1, 1]) v.push([cx + X * sx / 2, cy + Y * sy / 2, cz + Z * sz / 2]);
  const P = v.map(proj);
  const faces = [[0, 1, 3, 2, [-1, 0, 0]], [4, 5, 7, 6, [1, 0, 0]], [0, 1, 5, 4, [0, -1, 0]], [2, 3, 7, 6, [0, 1, 0]], [0, 2, 6, 4, [0, 0, -1]], [1, 3, 7, 5, [0, 0, 1]]];
  const toCam = (n) => cam(add(center, n), center)[2];
  for (const [a, b2, c, d, n] of faces) {
    if (toCam(n) <= 0) continue;
    ctx.beginPath(); [a, b2, c, d].forEach((i, j) => (j ? ctx.lineTo(P[i][0], P[i][1]) : ctx.moveTo(P[i][0], P[i][1]))); ctx.closePath();
    ctx.fillStyle = n[1] > 0 ? 'rgba(40,80,140,.55)' : 'rgba(16,36,72,.6)'; ctx.fill();
    ctx.strokeStyle = rgb(HOLO, 0.5); ctx.lineWidth = 1.1 * dpr; ctx.stroke();
  }
}
