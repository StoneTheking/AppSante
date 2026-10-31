// Démonstrations des exercices en vraie 3D (three.js) : mannequin anatomique de Diana (tête hologramme avec
// son bandeau), muscles modelés (pectoraux, abdos, deltoïdes, biceps, triceps, dorsaux, fessiers, quadriceps,
// ischios, mollets) qui s'allument en orange quand ils travaillent, articulations lumineuses, ombre portée
// douce sur une plateforme, agrès et charges en métal (haltères hexagonaux, barre et disques, banc, câble).
// Les poses viennent du squelette par cinématique inverse d'exercise3d.js ; la caméra tourne au doigt.
import { THREE, blit, available, envMap, onReset, generation } from './gl3d.js';
import { HEAD_VERT, HEAD_FRAG, headUniforms, setMood, bandMesh, haloSprite } from './diana3d.js';
import { ANIMS, skeleton, timeline, poseAt, D, RAD } from './exercise3d.js';

export const supported = () => available();

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// Contour lumineux cyan (effet Fresnel) ajouté aux matériaux physiques.
function withRim(mat, color = 0x5ad7ff, power = 2.4, strength = 0.75) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(color) };
    sh.uniforms.uRimK = mat.userData.rimK = { value: strength };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uRim; uniform float uRimK;\nvoid main() {')
      .replace('#include <dithering_fragment>', `float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), ${power.toFixed(2)});\n  gl_FragColor.rgb += uRim * rimF * uRimK;\n#include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => `rim${color}${power}`;
  return mat;
}

function materials() {
  const env = envMap();
  const body = withRim(new THREE.MeshPhysicalMaterial({ color: 0x1b3a6e, roughness: 0.36, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.5, sheenColor: 0x4fa8e0, envMap: env, envMapIntensity: 0.8 }));
  const muscle = withRim(new THREE.MeshPhysicalMaterial({ color: 0x24508f, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2, envMap: env, envMapIntensity: 0.9 }));
  const hot = withRim(new THREE.MeshPhysicalMaterial({ color: 0xf98a3a, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: 0xff5a00, emissiveIntensity: 0.35, envMap: env, envMapIntensity: 0.7 }), 0xffc48a, 2.2, 0.6);
  const joint = withRim(new THREE.MeshPhysicalMaterial({ color: 0x1f5d96, roughness: 0.25, clearcoat: 1, emissive: 0x1aa6d6, emissiveIntensity: 0.45, envMap: env }), 0x9fefff, 2, 0.9);
  const shoe = withRim(new THREE.MeshPhysicalMaterial({ color: 0x0f2648, roughness: 0.5, clearcoat: 0.4, envMap: env }), 0x5ad7ff, 2.5, 0.5);
  const sole = new THREE.MeshPhysicalMaterial({ color: 0x2ad4d4, roughness: 0.4, emissive: 0x0c7f86, emissiveIntensity: 0.6, envMap: env });
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xaab6c8, roughness: 0.22, metalness: 1, envMap: env, envMapIntensity: 1.3 });
  const plate = new THREE.MeshPhysicalMaterial({ color: 0x1b2a3f, roughness: 0.45, metalness: 0.4, clearcoat: 0.6, envMap: env });
  const plateEdge = new THREE.MeshPhysicalMaterial({ color: 0x2ad4d4, roughness: 0.3, metalness: 0.3, emissive: 0x0b6f78, emissiveIntensity: 0.5, envMap: env });
  const box = new THREE.MeshPhysicalMaterial({ color: 0x18325e, roughness: 0.55, metalness: 0.1, clearcoat: 0.5, transparent: true, opacity: 0.92, envMap: env });
  const edge = new THREE.LineBasicMaterial({ color: 0x5ad7ff, transparent: true, opacity: 0.55 });
  const cable = new THREE.MeshBasicMaterial({ color: 0x5ad7ff, transparent: true, opacity: 0.7 });
  return { body, muscle, hot, joint, shoe, sole, metal, plate, plateEdge, box, edge, cable };
}

// Membre : surface de révolution le long de +Y (0 → 1), rayon unité ; profil = [[hauteur, rayon], …].
function lathe(profile, seg = 28) {
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(0.0001, r), t));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}
const GEO = {};
function geos() {
  if (GEO.ready) return GEO;
  // profils d'après la silhouette d'un corps athlétique (rayon relatif le long du segment)
  GEO.thigh = lathe([[0, 0], [0.02, 0.78], [0.1, 0.97], [0.3, 1], [0.55, 0.9], [0.8, 0.72], [0.95, 0.62], [1, 0]]);
  GEO.shin = lathe([[0, 0], [0.02, 0.85], [0.18, 1], [0.32, 1.02], [0.6, 0.72], [0.85, 0.55], [1, 0]]);
  GEO.arm = lathe([[0, 0], [0.03, 0.9], [0.2, 1], [0.5, 0.95], [0.85, 0.78], [1, 0]]);
  GEO.fore = lathe([[0, 0], [0.03, 0.92], [0.2, 1], [0.55, 0.8], [0.92, 0.6], [1, 0]]);
  GEO.abdomen = lathe([[0, 0], [0.04, 0.92], [0.3, 0.98], [0.65, 0.9], [0.95, 0.95], [1, 0]], 36);
  GEO.chest = lathe([[0, 0], [0.04, 0.82], [0.35, 0.95], [0.7, 1.06], [0.88, 1.02], [0.98, 0.7], [1, 0]], 36);
  GEO.neck = lathe([[0, 0], [0.05, 1], [0.6, 0.85], [1, 0.9], [1.001, 0]], 18);
  GEO.foot = lathe([[0, 0], [0.04, 0.75], [0.2, 0.95], [0.55, 0.9], [0.85, 1], [0.97, 0.75], [1, 0]], 20);
  GEO.hand = lathe([[0, 0], [0.08, 0.85], [0.45, 1], [0.8, 0.9], [1, 0]], 16);
  GEO.sphere = new THREE.SphereGeometry(1, 28, 20);
  GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 24);
  GEO.hex = new THREE.CylinderGeometry(1, 1, 1, 6);
  GEO.ready = true;
  return GEO;
}

// Place un mesh dont la géométrie va de 0 à 1 sur +Y entre a et b ; ref oriente l'axe Z local (avant du membre).
function along(mesh, a, b, rx, rz, ref, offset = null) {
  _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
  _y.subVectors(_b, _a);
  const len = _y.length() || 1e-4;
  _y.multiplyScalar(1 / len);
  _z.set(ref[0], ref[1], ref[2]).addScaledVector(_y, -_y.dot(_z.set(ref[0], ref[1], ref[2])));
  if (_z.lengthSq() < 1e-6) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _z.normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  mesh.matrix.copy(_m).scale(_b.set(rx, len, rz));
  if (offset) _a.add(offset);
  mesh.matrix.setPosition(_a);
  mesh.matrixWorldNeedsUpdate = true;
}
// Ellipsoïde au point c (dans le repère R d'un os) décalé de off, demi-axes s.
function blob(mesh, c, R, off, s) {
  const p = mv(R, off);
  _x.set(R[0][0], R[1][0], R[2][0]); _y.set(R[0][1], R[1][1], R[2][1]); _z.set(R[0][2], R[1][2], R[2][2]);
  mesh.matrix.makeBasis(_x, _y, _z).scale(_a.set(s[0], s[1], s[2])).setPosition(c[0] + p[0], c[1] + p[1], c[2] + p[2]);
  mesh.matrixWorldNeedsUpdate = true;
}
const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const col = (m, j) => [m[0][j], m[1][j], m[2][j]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Repère d'un segment (colonnes x, y = direction a→b, z = vers ref), sous forme de matrice 3×3 en lignes.
function frame(a, b, ref) {
  const y = nrm(sub(b, a));
  let z = sub(ref, mul(y, y[0] * ref[0] + y[1] * ref[1] + y[2] * ref[2]));
  if (Math.hypot(...z) < 1e-4) z = [1, 0, 0];
  z = nrm(z);
  const x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
  return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
}

// Construit le mannequin (une fois par démonstration).
function buildBody(M, work) {
  const g = geos();
  const root = new THREE.Group();
  const hotOf = (tags) => tags.some((t) => work.includes(t));
  const mk = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.castShadow = shadow; root.add(m); return m; };
  const mus = (tags) => mk(g.sphere, hotOf(tags) ? M.hot : M.muscle);
  const B = {
    pelvis: mk(g.sphere, M.body), abdomen: mk(g.abdomen, M.body), chest: mk(g.chest, M.body), neck: mk(g.neck, M.body),
    abs: [0, 1, 2].flatMap(() => [mus(['core']), mus(['core'])]), obl: [mus(['core']), mus(['core'])],
    pec: [mus(['chest']), mus(['chest'])], lat: [mus(['back']), mus(['back'])], trap: mus(['back', 'shoulder']), lower: [mus(['back']), mus(['back'])],
    glute: [mus(['glute']), mus(['glute'])],
    side: {},
  };
  for (const k of ['L', 'R']) {
    B.side[k] = {
      clav: mk(g.cyl, M.body), delt: mus(['shoulder', 'chest']), arm: mk(g.arm, M.body), bi: mus(['arm']), tri: mus(['arm']),
      fore: mk(g.fore, M.body), hand: mk(g.hand, M.body), thigh: mk(g.thigh, M.body), quad: mus(['thigh']), ham: mus(['hams']),
      shin: mk(g.shin, M.body), calf: mus(['calf']), foot: mk(g.foot, M.shoe),
      j: ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'].reduce((o, n) => ((o[n] = mk(g.sphere, M.joint)), o), {}),
    };
  }
  // tête de Diana (même shader que dans l'en-tête)
  const head = new THREE.Group(); head.matrixAutoUpdate = false;
  const uniforms = headUniforms(); uniforms.uScan.value = 0.06;
  const sph = new THREE.Mesh(g.sphere, new THREE.ShaderMaterial({ uniforms, vertexShader: HEAD_VERT, fragmentShader: HEAD_FRAG, transparent: true }));
  sph.castShadow = true;
  const band = bandMesh();
  head.add(sph, band);
  root.add(head);
  B.head = head; B.headU = uniforms;
  return { root, B };
}

function poseBody(B, S, t) {
  const fwdP = col(S.pelvisR, 2), fwdC = col(S.chestR, 2);
  const breath = 1 + 0.015 * Math.sin(t * 2.2);
  // bassin, ventre, cage thoracique (colonne en deux segments, élargie aux épaules)
  blob(B.pelvis, S.pelvis, S.pelvisR, [0, -0.025, -0.005], [0.155, 0.105, 0.11]);
  along(B.abdomen, addv(S.pelvis, mv(S.pelvisR, [0, 0.0, 0])), S.mid, 0.122, 0.095, fwdP);
  const top = addv(S.chest, mv(S.chestR, [0, 0.035, 0]));
  along(B.chest, S.mid, top, 0.158 * breath, 0.112 * breath, fwdC);
  along(B.neck, addv(S.chest, mv(S.chestR, [0, 0.02, -0.01])), addv(S.head, mv(S.headR, [0, -0.07, -0.01])), 0.042, 0.045, fwdC);
  // muscles du tronc
  const C = S.chestR, Mi = S.midR, P = S.pelvisR;
  for (const [i, s] of [[0, 1], [1, -1]]) {
    blob(B.pec[i], S.chest, C, [s * 0.068, -0.075, 0.085], [0.074, 0.056, 0.042]);
    blob(B.lat[i], S.chest, C, [s * 0.1, -0.13, -0.045], [0.06, 0.12, 0.05]);
    blob(B.lower[i], S.mid, Mi, [s * 0.04, -0.02, -0.075], [0.035, 0.11, 0.035]);
    blob(B.glute[i], S.pelvis, P, [s * 0.072, -0.055, -0.07], [0.082, 0.085, 0.065]);
    blob(B.obl[i], S.mid, Mi, [s * 0.098, 0.01, 0.025], [0.035, 0.09, 0.05]);
  }
  blob(B.trap, S.chest, C, [0, 0.0, -0.06], [0.11, 0.05, 0.04]);
  for (let r = 0; r < 3; r++) for (const [i, s] of [[0, 1], [1, -1]]) blob(B.abs[r * 2 + i], S.mid, Mi, [s * 0.034, 0.09 - r * 0.075, 0.083], [0.03, 0.032, 0.022]);
  // tête
  const H = S.headR;
  B.head.matrix.makeBasis(V(col(H, 0)), V(col(H, 1)), V(col(H, 2))).scale(_a.set(RAD.head, RAD.head, RAD.head)).setPosition(S.head[0], S.head[1], S.head[2]);
  B.head.matrixWorldNeedsUpdate = true;
  // membres
  for (const k of ['L', 'R']) {
    const s = S.side[k], b = B.side[k], sg = k === 'L' ? 1 : -1;
    const out = mul(col(C, 0), sg);
    along(b.clav, addv(S.chest, mv(C, [0, -0.03, -0.01])), s.shoulder, 0.045, 0.045, fwdC);
    // bras : l'avant du bras regarde vers le pli du coude
    const armFwd = nrm(addv(sub(s.wrist, s.elbow), mul(fwdC, 0.2)));
    along(b.arm, s.shoulder, s.elbow, 0.052, 0.05, armFwd);
    const Fa = frame(s.shoulder, s.elbow, armFwd), la = Math.hypot(...sub(s.elbow, s.shoulder));
    blob(b.delt, s.shoulder, Fa, [0, 0.02, 0], [0.066, 0.085, 0.064]);
    blob(b.bi, s.shoulder, Fa, [0, la * 0.55, 0.025], [0.036, la * 0.3, 0.032]);
    blob(b.tri, s.shoulder, Fa, [0, la * 0.45, -0.026], [0.038, la * 0.34, 0.034]);
    along(b.fore, s.elbow, s.wrist, 0.044, 0.038, out);
    along(b.hand, s.wrist, addv(s.handEnd, mul(nrm(sub(s.handEnd, s.wrist)), 0.02)), 0.038, 0.02, out);
    // jambes : l'avant de la cuisse regarde vers le genou
    const legFwd = nrm(addv(sub(s.knee, s.hip), sub(s.knee, mul(addv(s.hip, s.ankle), 0.5))));
    const kneeFwd = nrm(sub(s.knee, mul(addv(s.hip, s.ankle), 0.5)));
    const thighRef = Math.hypot(...kneeFwd) > 0.01 ? kneeFwd : fwdP;
    along(b.thigh, s.hip, s.knee, 0.083, 0.08, thighRef);
    const Ft = frame(s.hip, s.knee, thighRef), lt = Math.hypot(...sub(s.knee, s.hip));
    blob(b.quad, s.hip, Ft, [0, lt * 0.52, 0.03], [0.062, lt * 0.36, 0.05]);
    blob(b.ham, s.hip, Ft, [0, lt * 0.48, -0.028], [0.058, lt * 0.36, 0.045]);
    along(b.shin, s.knee, s.ankle, 0.054, 0.056, thighRef);
    const Fs = frame(s.knee, s.ankle, thighRef), ls = Math.hypot(...sub(s.ankle, s.knee));
    blob(b.calf, s.knee, Fs, [0, ls * 0.3, -0.03], [0.045, ls * 0.24, 0.04]);
    // pied : du talon à la pointe, semelle claire
    const dir = nrm(sub(s.toe, s.ankle));
    const heel = addv(s.ankle, mul(dir, -0.05));
    const legUp = nrm(sub(s.knee, s.ankle));
    const upRef = sub(legUp, mul(dir, dir[0] * legUp[0] + dir[1] * legUp[1] + dir[2] * legUp[2]));
    const drop = mul(nrm(upRef), -0.03);
    along(b.foot, addv(heel, drop), addv(addv(s.toe, mul(dir, 0.03)), drop), 0.046, 0.038, upRef);
    const J = b.j, js = (m, p, r) => { m.matrix.makeScale(r, r, r).setPosition(p[0], p[1], p[2]); m.matrixWorldNeedsUpdate = true; };
    js(J.shoulder, s.shoulder, 0.05); js(J.elbow, s.elbow, 0.04); js(J.wrist, s.wrist, 0.032);
    js(J.hip, s.hip, 0.07); js(J.knee, s.knee, 0.052); js(J.ankle, s.ankle, 0.04);
  }
}

// Agrès et charges.
function buildProps(M, a) {
  const g = geos();
  const root = new THREE.Group();
  const list = [];
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.castShadow = true; root.add(m); return m; };
  const dumbbell = () => ({ bar: mk(g.cyl, M.metal), p: [mk(g.hex, M.plate), mk(g.hex, M.plate)], e: [mk(g.hex, M.plateEdge), mk(g.hex, M.plateEdge)] });
  // barre de tirage (poulie) : sans disques
  const barbell = (plates = true) => ({ bar: mk(g.cyl, M.metal), p: plates ? [mk(g.cyl, M.plate), mk(g.cyl, M.plate), mk(g.cyl, M.plate), mk(g.cyl, M.plate)] : [], c: plates ? [mk(g.cyl, M.plateEdge), mk(g.cyl, M.plateEdge)] : [mk(g.cyl, M.plateEdge), mk(g.cyl, M.plateEdge)], pull: !plates });
  for (const p of a.props || []) {
    if (Array.isArray(p)) {
      const [cx, cy, cz, sx, sy, sz] = p[1];
      const box = new THREE.Mesh(roundedBox(sx, sy, sz), M.box);
      box.position.set(cx, cy, cz); box.castShadow = box.receiveShadow = true;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)), M.edge);
      edges.position.copy(box.position);
      root.add(box, edges);
      continue;
    }
    if (p === 'db') list.push({ kind: 'db2', d: [dumbbell(), dumbbell()] });
    else if (p === 'dbR' || p === 'dbGoblet' || p === 'dbPull' || p === 'dbHip') list.push({ kind: p, d: dumbbell() });
    else if (p === 'bar' || p === 'barPull' || p === 'barHip') list.push({ kind: p, b: barbell(p !== 'barPull'), cable: p === 'barPull' ? mk(g.cyl, M.cable) : null });
    else if (p === 'cableRow') list.push({ kind: p, cable: mk(g.cyl, M.cable), handle: mk(g.cyl, M.metal) });
  }
  return { root, list };
}
function roundedBox(sx, sy, sz) {
  // boîte aux arêtes arrondies (biseau) : sphère déformée sur les coins
  const g = new THREE.BoxGeometry(sx, sy, sz, 6, 6, 6);
  const p = g.attributes.position, r = Math.min(0.04, sx / 4, sy / 4, sz / 4), v = new THREE.Vector3();
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-h[0], Math.min(h[0], v.x)), Math.max(-h[1], Math.min(h[1], v.y)), Math.max(-h[2], Math.min(h[2], v.z)));
    const d = v.clone().sub(c);
    if (d.lengthSq() > 1e-9) { d.setLength(r); v.copy(c.add(d)); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function cyl(mesh, a, b, r) {
  along(mesh, a, b, r, r, Math.abs(b[1] - a[1]) > 0.9 * Math.hypot(...sub(b, a)) ? [1, 0, 0] : [0, 1, 0], null);
  // la géométrie du cylindre est centrée : on la recentre entre a et b
  mesh.matrix.multiply(_m.makeTranslation(0, 0.5, 0));
}
function poseDumbbell(d, c, dir) {
  const h = 0.11;
  cyl(d.bar, addv(c, mul(dir, -h)), addv(c, mul(dir, h)), 0.014);
  d.p.forEach((m, i) => { const s = i ? 1 : -1; cyl(m, addv(c, mul(dir, s * 0.07)), addv(c, mul(dir, s * 0.115)), 0.052); });
  d.e.forEach((m, i) => { const s = i ? 1 : -1; cyl(m, addv(c, mul(dir, s * 0.115)), addv(c, mul(dir, s * 0.122)), 0.044); });
}
function poseBarbell(b, a, z) {
  const m = mul(addv(a, z), 0.5), d = nrm(sub(a, z));
  const half = b.pull ? 0.6 : 0.75;
  cyl(b.bar, addv(m, mul(d, -half)), addv(m, mul(d, half)), b.pull ? 0.016 : 0.014);
  [[0.55, 0.6, 0.17], [-0.55, -0.6, 0.17], [0.6, 0.64, 0.13], [-0.6, -0.64, 0.13]].forEach(([u, v, r], i) => b.p[i] && cyl(b.p[i], addv(m, mul(d, u)), addv(m, mul(d, v)), r));
  // embouts (barre de tirage) ou colliers de serrage (barre olympique)
  (b.pull ? [half, -half] : [0.53, -0.53]).forEach((u, i) => cyl(b.c[i], addv(m, mul(d, u)), addv(m, mul(d, u + Math.sign(u) * (b.pull ? 0.03 : 0.02))), b.pull ? 0.022 : 0.03));
}
function poseProps(P, S) {
  const L = S.side.L, R = S.side.R;
  const across = nrm(sub(L.shoulder, R.shoulder));
  const grip = (s) => addv(s.wrist, mul(nrm(sub(s.handEnd, s.wrist)), 0.035));
  for (const it of P.list) {
    if (it.kind === 'db2') { poseDumbbell(it.d[0], grip(L), across); poseDumbbell(it.d[1], grip(R), across); }
    if (it.kind === 'dbR') poseDumbbell(it.d, grip(R), nrm(col(S.chestR, 2)));
    if (it.kind === 'dbGoblet') poseDumbbell(it.d, mul(addv(grip(L), grip(R)), 0.5), nrm(col(S.chestR, 1)));
    if (it.kind === 'dbPull') poseDumbbell(it.d, mul(addv(grip(L), grip(R)), 0.5), nrm(col(S.chestR, 2)));
    if (it.kind === 'dbHip') poseDumbbell(it.d, addv(S.pelvis, mv(S.pelvisR, [0, 0, 0.17])), [1, 0, 0]);
    if (it.kind === 'bar' || it.kind === 'barPull') poseBarbell(it.b, grip(L), grip(R));
    if (it.kind === 'barHip') { const c = addv(S.pelvis, mv(S.pelvisR, [0, 0, 0.19])); poseBarbell(it.b, addv(c, [0.3, 0, 0]), addv(c, [-0.3, 0, 0])); }
    if (it.kind === 'barPull') { const m = mul(addv(L.wrist, R.wrist), 0.5); cyl(it.cable, m, [m[0], 2.6, m[2]], 0.006); }
    if (it.kind === 'cableRow') { const m = mul(addv(grip(L), grip(R)), 0.5); cyl(it.cable, m, [0, 0.35, 1.2], 0.006); cyl(it.handle, grip(L), grip(R), 0.016); }
  }
}

// Plateforme lumineuse au sol, qui reçoit l'ombre douce du mannequin.
let floorTex = null;
function platform(R0) {
  if (!floorTex) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(90,215,255,.26)'); g.addColorStop(0.7, 'rgba(90,215,255,.08)'); g.addColorStop(1, 'rgba(90,215,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(160,235,255,.75)'; x.lineWidth = 2.2;
    x.beginPath(); x.arc(128, 128, 120, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(160,235,255,.28)'; x.lineWidth = 1.2;
    for (const r of [80, 40]) { x.beginPath(); x.arc(128, 128, r, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; x.beginPath(); x.moveTo(128 + Math.cos(t) * 40, 128 + Math.sin(t) * 40); x.lineTo(128 + Math.cos(t) * 120, 128 + Math.sin(t) * 120); x.strokeStyle = 'rgba(160,235,255,.1)'; x.stroke(); }
    floorTex = new THREE.CanvasTexture(c);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.anisotropy = 4;
  }
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R0, 64), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, toneMapped: false }));
  disc.rotation.x = -Math.PI / 2;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(R0 * 1.3, 48), new THREE.ShadowMaterial({ opacity: 0.45, color: 0x000814 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.receiveShadow = true;
  g.add(disc, shadow);
  return g;
}

// Anime une démonstration dans un canvas. Renvoie une fonction d'arrêt (ou null si la 3D n'est pas disponible).
export function play(canvas, label, { onCue, at, yaw } = {}) {
  const a = ANIMS[label];
  if (!a || !available()) return null;
  const tl = timeline(a);
  // cadrage sur toute l'animation (pas de recadrage pendant le mouvement)
  const pts = [];
  for (let t = 0; t < tl.total; t += 0.2) { const S = skeleton(poseAt(tl, t).pose); pts.push([S.head[0], S.head[1] + 0.16, S.head[2]], S.pelvis, ...Object.values(S.side).flatMap((s) => [s.wrist, s.toe, s.knee, s.elbow])); }
  for (const p of a.props || []) if (Array.isArray(p)) { const b = p[1]; pts.push([b[0] - b[3] / 2, b[1] - b[4] / 2, b[2] - b[5] / 2], [b[0] + b[3] / 2, b[1] + b[4] / 2, b[2] + b[5] / 2]); }
  const lo = [0, 1, 2].map((i) => Math.min(...(i === 1 ? [0] : []), ...pts.map((p) => p[i])));
  const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const center = new THREE.Vector3((lo[0] + hi[0]) / 2, Math.max(0.45, (lo[1] + hi[1]) / 2), (lo[2] + hi[2]) / 2);
  const radius = Math.max(0.85, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 + 0.12);

  let G = null, gen = -1;
  const build = () => {
    const M = materials();
    const scene = new THREE.Scene();
    scene.environment = envMap();
    const cam = new THREE.PerspectiveCamera(30, 1.6, 0.05, 40);
    const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x0a1428, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
    const sc = key.shadow.camera; sc.left = sc.bottom = -radius * 1.4; sc.right = sc.top = radius * 1.4; sc.near = 0.1; sc.far = 10;
    const rim = new THREE.DirectionalLight(0x5ad7ff, 2.2);
    const fill = new THREE.DirectionalLight(0x8a7dff, 0.6);
    scene.add(hemi, key, key.target, rim, fill);
    const floor = platform(radius * 1.05); floor.position.set(center.x, 0, center.z);
    const body = buildBody(M, a.work || []);
    const props = buildProps(M, a);
    const halo = haloSprite(radius * 2.6, 0.12); halo.position.copy(center);
    scene.add(halo, floor, body.root, props.root);
    G = { scene, cam, key, rim, fill, body, props, M, floor };
    gen = generation();
  };

  let yaw0 = (yaw ?? a.cam ?? 60) * D, drag = 0, dragging = false, lastX = 0, idle = 0, vel = 0;
  const tilt = (a.tilt ?? 14) * D;
  const t0 = performance.now();
  let raf = 0, lastCue = null, visible = true, lastT = t0;
  const onDown = (e) => { dragging = true; lastX = e.clientX; vel = 0; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (!dragging) return; const d = (e.clientX - lastX) * 0.012; drag += d; vel = d * 60; lastX = e.clientX; idle = performance.now(); };
  const onUp = () => { dragging = false; idle = performance.now(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }) : null;
  io?.observe(canvas);
  const unReset = onReset(() => { G = null; });

  function frame(now) {
    raf = 0;
    if (!canvas.isConnected) return stop();
    if (!visible || document.hidden) return;
    if (!G || gen !== generation()) build();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const time = at ?? (now - t0) / 1000;
    const { pose, cue } = poseAt(tl, time);
    if (cue !== lastCue) { lastCue = cue; onCue?.(cue); }
    // élan après un lancer du doigt, puis lent balancement
    if (!dragging && Math.abs(vel) > 0.01) { drag += vel * dt; vel *= Math.exp(-dt * 4); idle = now; }
    const sway = at != null ? 0 : dragging || now - idle < 2500 ? 0 : Math.sin(time * 0.35) * 0.3;
    const yw = yaw0 + drag + sway;
    const S = skeleton(pose);
    poseBody(G.body.B, S, time);
    poseProps(G.props, S);
    // Diana cligne des yeux et sourit davantage aux moments d'effort
    const bl = (time % 4.3) / 0.16;
    setMood(G.body.B.headU, (a.work || []).length && Math.sin(time * 1.3) > 0.6 ? 'cheer' : 'happy', bl < 1 ? Math.sin(Math.PI * bl) : 0, 0);
    G.body.B.headU.uTime.value = time;
    G.M.hot.emissiveIntensity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(time * 3));
    // caméra en orbite autour de la scène
    const cam = G.cam;
    cam.aspect = canvas.width / Math.max(1, canvas.height);
    const half = 15 * D, fit = cam.aspect < 1 ? Math.atan(Math.tan(half) * cam.aspect) : half;
    const dist = (radius * 0.98) / Math.tan(fit);
    cam.position.set(center.x + Math.sin(yw) * Math.cos(tilt) * dist, center.y + Math.sin(tilt) * dist, center.z + Math.cos(yw) * Math.cos(tilt) * dist);
    cam.lookAt(center.x, center.y - radius * 0.06, center.z);
    cam.updateProjectionMatrix();
    // lumières liées à la caméra : principale en haut à gauche, contre-jour cyan derrière
    const side = (ang, up, d = 4) => [center.x + Math.sin(yw + ang) * d, center.y + up, center.z + Math.cos(yw + ang) * d];
    G.key.position.set(...side(0.45, 5, 2.6)); G.key.target.position.copy(center);
    G.rim.position.set(...side(Math.PI * 0.85, 1.5)); G.fill.position.set(...side(-1.2, 0.4));
    blit(canvas, G.scene, cam);
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = -1;
    io?.disconnect();
    unReset();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    if (G) {
      G.scene.traverse((o) => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); });
      Object.values(G.M).forEach((m) => m.dispose?.());
      G.key.shadow.map?.dispose();
    }
    G = null;
  }
  raf = requestAnimationFrame(frame);
  return stop;
}
