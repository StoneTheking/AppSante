// Démonstrations des exercices en vraie 3D (three.js) : Diana en entier, tête hologramme avec son bandeau et
// corps d'un seul tenant à la même peau que son visage (bleu nuit, contour cyan, grille qui suit la peau) ;
// les muscles qui travaillent s'allument en orange. Ombre portée douce sur une plateforme, agrès et charges
// en métal (haltères hexagonaux, barre et disques, banc, câble).
// Les poses viennent du squelette par cinématique inverse d'exercise3d.js ; la caméra tourne au doigt.
import { THREE, blit, available, envMap, onReset, generation } from './gl3d.js';
import { HEAD_VERT, HEAD_FRAG, headUniforms, setMood, bandMesh, haloSprite } from './diana3d.js';
import { ANIMS, skeleton, timeline, poseAt, phaseAt, movePaths, D, RAD } from './exercise3d.js';

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
  GEO.thigh = lathe([[0, 0], [0.02, 0.86], [0.1, 1], [0.3, 0.97], [0.55, 0.86], [0.8, 0.7], [0.95, 0.62], [1, 0]]);
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

// ---------- Peau hologramme (la même que le visage de Diana) ----------
// Bleu nuit éclairé en haut à gauche, contour cyan (Fresnel), grille fine qui suit la peau (anneaux le long
// du membre, lignes autour), léger balayage. Opaque : les pièces qui se chevauchent aux articulations se
// fondent en une seule silhouette. Les muscles qui travaillent passent en orange qui respire.
const BODY_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
void main() {
  vObj = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const BODY_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uHot, uCols, uRows, uScan, uGrid, uFade;
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
const vec3 NAVY = vec3(20., 50., 98.) / 255., NAVY_DEEP = vec3(6., 16., 38.) / 255., GLOW = vec3(52., 110., 180.) / 255.;
const vec3 HOLO = vec3(90., 215., 255.) / 255., WORK = vec3(255., 140., 58.) / 255.;
const vec3 LIGHT = vec3(-0.438, 0.613, 0.657);
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(vView);
  float nz = max(0., dot(n, v));
  float d = max(0., dot(n, LIGHT));
  // même dégradé que le visage : plus sombre sur les côtés, plus lumineux face à la lumière
  vec3 base = mix(NAVY_DEEP, NAVY, smoothstep(-0.2, 0.9, nz));
  base = mix(base, GLOW, 0.45 * smoothstep(0.55, 1., d));
  float pulse = 0.5 + 0.5 * sin(uTime * 3.);
  // muscle au travail : l'orange se concentre au milieu du membre et s'estompe vers les articulations
  float hot = uHot * mix(1., smoothstep(0., 0.35, vObj.y) * smoothstep(1., 0.65, vObj.y), uFade);
  base = mix(base, WORK * (0.75 + 0.25 * pulse), hot * 0.85);
  vec3 h = normalize(LIGHT + v);
  float spec = 0.45 * pow(max(0., dot(n, h)), 48.) + 0.3 * pow(max(0., dot(n, h)), 260.);
  vec3 r = reflect(-v, n);
  float box = smoothstep(0.72, 0.86, r.y) * smoothstep(0.7, 0.15, abs(r.x + 0.35)) * 0.1;
  vec3 c = base * (0.3 + 0.82 * d) + vec3(spec + box);
  // grille qui suit la peau : lignes autour du membre et anneaux le long (repère de l'objet)
  float lon = atan(vObj.x, vObj.z) / 6.2831853 * uCols;
  float lat = vObj.y * uRows;
  vec2 g = vec2(lon, lat);
  vec2 fw = max(fwidth(g), vec2(1e-4));
  vec2 dd = abs(fract(g - 0.5) - 0.5) / fw;
  float line = 1. - min(min(dd.x, dd.y) / 1.2, 1.);
  float fres = pow(1. - nz, 2.2);
  float grid = line * uGrid * (0.1 + 0.22 * smoothstep(0.2, 0.95, 1. - nz * 0.7));
  float scan = 1. - uScan * (0.5 - 0.5 * sin(gl_FragCoord.y * 2.1 - uTime * 6.));
  vec3 rim = mix(HOLO, vec3(1., 0.8, 0.55), hot * 0.6);
  c = (c + rim * (0.1 + 0.85 * fres + grid)) * scan;
  gl_FragColor = vec4(c, 1.);
}`;
function skin(cols, rows, hot = false, fade = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHot: { value: hot ? 1 : 0 }, uCols: { value: Math.max(4, Math.round(cols * 0.7)) }, uRows: { value: Math.max(1, Math.round(rows * 0.6)) }, uScan: { value: 0.06 }, uGrid: { value: 0.55 }, uFade: { value: fade } },
    vertexShader: BODY_VERT, fragmentShader: BODY_FRAG,
  });
}

// Construit le mannequin (une fois par démonstration) : silhouette lisse d'une seule teinte, sans rotules
// ni « bulles » de muscles ; les articulations sont des sphères du même rayon que les membres qui s'y
// rejoignent, la forme des muscles vient du profil des membres.
function buildBody(M, work) {
  const g = geos();
  const root = new THREE.Group();
  const mats = [];
  const hotOf = (tags) => tags.some((t) => work.includes(t));
  const mk = (geo, cols, rows, tags = []) => {
    const mat = skin(cols, rows, hotOf(tags), geo === g.sphere ? 0 : 1); mats.push(mat);
    const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; m.castShadow = true; root.add(m); return m;
  };
  const B = {
    pelvis: mk(g.sphere, 12, 3), abdomen: mk(g.abdomen, 12, 5, ['core']), waist: mk(g.sphere, 12, 2, ['core']),
    chest: mk(g.chest, 12, 6, ['chest', 'back']), neck: mk(g.neck, 10, 3),
    // trapèzes et clavicules : relient le cou aux épaules (sinon l'épaule flotte à côté du buste)
    yoke: [mk(g.sphere, 8, 2, ['shoulder', 'back']), mk(g.sphere, 8, 2, ['shoulder', 'back'])],
    pec: [mk(g.sphere, 8, 2, ['chest']), mk(g.sphere, 8, 2, ['chest'])],
    glute: [mk(g.sphere, 8, 3, ['glute']), mk(g.sphere, 8, 3, ['glute'])],
    side: {},
  };
  for (const k of ['L', 'R']) {
    B.side[k] = {
      delt: mk(g.sphere, 8, 3, ['shoulder', 'chest']), arm: mk(g.arm, 10, 6, ['arm', 'shoulder']), fore: mk(g.fore, 10, 5, ['arm']),
      hand: mk(g.hand, 8, 3), thigh: mk(g.thigh, 12, 8, ['thigh', 'hams', 'glute']), shin: mk(g.shin, 10, 8, ['calf']), foot: mk(g.foot, 8, 4),
      j: { shoulder: mk(g.sphere, 8, 3, ['shoulder']), elbow: mk(g.sphere, 8, 2), wrist: mk(g.sphere, 6, 2), hip: mk(g.sphere, 10, 3), knee: mk(g.sphere, 8, 2), ankle: mk(g.sphere, 6, 2) },
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
  B.head = head; B.headU = uniforms; B.mats = mats;
  return { root, B };
}

function poseBody(B, S, t) {
  for (const m of B.mats) m.uniforms.uTime.value = t;
  const fwdP = col(S.pelvisR, 2), fwdC = col(S.chestR, 2);
  const breath = 1 + 0.012 * Math.sin(t * 2.2);
  const C = S.chestR, Mi = S.midR, P = S.pelvisR;
  // bassin, taille, ventre, cage thoracique : les rayons se raccordent pour une silhouette continue
  blob(B.pelvis, S.pelvis, P, [0, -0.03, -0.005], [0.158, 0.118, 0.108]);
  along(B.abdomen, addv(S.pelvis, mv(P, [0, 0.01, 0])), S.mid, 0.118, 0.09, fwdP);
  blob(B.waist, S.mid, Mi, [0, 0, 0], [0.112, 0.07, 0.086]);
  const top = addv(S.chest, mv(C, [0, 0.035, 0]));
  along(B.chest, S.mid, top, 0.15 * breath, 0.106 * breath, fwdC);
  along(B.neck, addv(S.chest, mv(C, [0, 0.02, -0.01])), addv(S.head, mv(S.headR, [0, -0.07, -0.01])), 0.042, 0.045, fwdC);
  for (const [i, sg] of [[0, 1], [1, -1]]) {
    blob(B.pec[i], S.chest, C, [sg * 0.062, -0.08, 0.07], [0.068, 0.05, 0.036]);
    blob(B.glute[i], S.pelvis, P, [sg * 0.064, -0.065, -0.042], [0.074, 0.08, 0.06]);
    const sh = S.side[sg > 0 ? 'L' : 'R'].shoulder, base = addv(S.chest, mv(C, [sg * 0.05, 0.01, -0.012]));
    const Fy = frame(base, sh, fwdC), ly = Math.hypot(...sub(sh, base));
    blob(B.yoke[i], base, Fy, [0, ly * 0.5, 0], [0.05, ly * 0.62, 0.052]);
  }
  // tête
  const H = S.headR;
  B.head.matrix.makeBasis(V(col(H, 0)), V(col(H, 1)), V(col(H, 2))).scale(_a.set(RAD.head, RAD.head, RAD.head)).setPosition(S.head[0], S.head[1], S.head[2]);
  B.head.matrixWorldNeedsUpdate = true;
  // membres
  for (const k of ['L', 'R']) {
    const s = S.side[k], b = B.side[k], sg = k === 'L' ? 1 : -1;
    const out = mul(col(C, 0), sg);
    const armFwd = nrm(addv(sub(s.wrist, s.elbow), mul(fwdC, 0.2)));
    along(b.arm, s.shoulder, s.elbow, 0.05, 0.048, armFwd);
    const Fa = frame(s.shoulder, s.elbow, armFwd);
    // épaule arrondie (deltoïde) posée sur le haut du bras, légèrement vers l'extérieur
    blob(b.delt, s.shoulder, Fa, [0, 0.025, 0], [0.058, 0.075, 0.056]);
    along(b.fore, s.elbow, s.wrist, 0.044, 0.038, out);
    along(b.hand, s.wrist, addv(s.handEnd, mul(nrm(sub(s.handEnd, s.wrist)), 0.02)), 0.036, 0.019, out);
    const kneeFwd = nrm(sub(s.knee, mul(addv(s.hip, s.ankle), 0.5)));
    const thighRef = Math.hypot(...kneeFwd) > 0.01 ? kneeFwd : fwdP;
    along(b.thigh, s.hip, s.knee, 0.086, 0.08, thighRef);
    along(b.shin, s.knee, s.ankle, 0.055, 0.057, thighRef);
    const dir = nrm(sub(s.toe, s.ankle));
    const heel = addv(s.ankle, mul(dir, -0.05));
    const legUp = nrm(sub(s.knee, s.ankle));
    const upRef = sub(legUp, mul(dir, dir[0] * legUp[0] + dir[1] * legUp[1] + dir[2] * legUp[2]));
    const drop = mul(nrm(upRef), -0.03);
    along(b.foot, addv(heel, drop), addv(addv(s.toe, mul(dir, 0.03)), drop), 0.044, 0.036, upRef);
    // articulations du même rayon que les membres qui s'y raccordent (pas de rotule visible)
    const J = b.j, js = (m, p, r) => { m.matrix.makeScale(r, r, r).setPosition(p[0], p[1], p[2]); m.matrixWorldNeedsUpdate = true; };
    js(J.shoulder, s.shoulder, 0.048); js(J.elbow, s.elbow, 0.039); js(J.wrist, s.wrist, 0.026);
    js(J.hip, s.hip, 0.074); js(J.knee, s.knee, 0.05); js(J.ankle, s.ankle, 0.031);
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

// ---------- Aides à la lecture du mouvement ----------
// Flèches de trajectoire : un trait lumineux suit le vrai chemin de la main, du pied ou du bassin jusqu'à
// la position visée, avec une pointe au bout. Pendant le geste, seule la partie restante est dessinée ;
// pendant un maintien, le geste suivant est annoncé en transparence. Toujours visibles par-dessus le corps.
const ARROW = 0xffd166;
function buildArrows(paths) {
  const root = new THREE.Group();
  const mat = () => new THREE.MeshBasicMaterial({ color: ARROW, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, toneMapped: false });
  const list = paths.map((group) => group.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(V));
    const segs = 40, radial = 6;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.012, radial, false), mat());
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.085, 14), mat());
    const end = curve.getPoint(1), dir = curve.getTangent(1).normalize();
    tip.position.copy(end).addScaledVector(dir, 0.02);
    tip.quaternion.setFromUnitVectors(UP, dir);
    tube.renderOrder = tip.renderOrder = 20;
    const g = new THREE.Group(); g.add(tube, tip); g.visible = false;
    root.add(g);
    return { g, tube, tip, segs, radial };
  }));
  return { root, list };
}
function showArrows(A, ph) {
  if (!A) return;
  const n = A.list.length;
  A.list.forEach((group, i) => group.forEach((x) => { x.g.visible = false; }));
  const set = (i, from, op) => {
    for (const x of A.list[i] || []) {
      x.g.visible = true;
      const start = Math.min(x.segs - 1, Math.floor(from * x.segs));
      x.tube.geometry.setDrawRange(start * x.radial * 6, (x.segs - start) * x.radial * 6);
      x.tube.material.opacity = x.tip.material.opacity = op;
    }
  };
  if (ph.moving) set(ph.i, ph.u, 0.92 * Math.min(1, (1 - ph.u) * 6)); // s'efface en arrivant
  else set((ph.i + 1) % n, 0, 0.35); // annonce du geste suivant
}

// Bandeau d'étapes (une pastille par pose), compte à rebours des maintiens et vitesse, ajoutés au cadre .ex3d.
function overlay(canvas, tl) {
  const box = canvas.closest?.('.ex3d');
  if (!box || typeof document === 'undefined') return null;
  box.querySelectorAll('.ex3d-steps,.ex3d-hold,.ex3d-speed').forEach((x) => x.remove());
  const steps = document.createElement('div'); steps.className = 'ex3d-steps';
  steps.innerHTML = tl.keys.map(() => '<i></i>').join('');
  const hold = document.createElement('div'); hold.className = 'ex3d-hold';
  const sp = document.createElement('div'); sp.className = 'ex3d-speed'; sp.textContent = 'touche : ralenti';
  box.append(steps, hold, sp);
  const dots = [...steps.children];
  let last = '';
  return {
    phase(ph) {
      const key = `${ph.i}|${ph.moving}|${Math.ceil(ph.holdLeft)}`;
      if (key === last) return;
      last = key;
      dots.forEach((d, j) => { d.className = j === ph.i ? (ph.moving ? 'go' : 'on') : ''; });
      const showHold = !ph.moving && ph.hold >= 1;
      hold.textContent = showHold ? `tiens · ${Math.ceil(ph.holdLeft)} s` : '';
      hold.classList.toggle('in', showHold);
    },
    speed(v) { sp.textContent = v === 1 ? 'touche : ralenti' : 'ralenti ×0,5 · touche pour revenir'; sp.classList.toggle('on', v !== 1); },
    remove() { steps.remove(); hold.remove(); sp.remove(); },
  };
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
  let center = new THREE.Vector3((lo[0] + hi[0]) / 2, Math.max(0.45, (lo[1] + hi[1]) / 2), (lo[2] + hi[2]) / 2);
  let radius = Math.max(0.85, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 + 0.12);
  // petit geste (menton rentré…) : caméra rapprochée sur la tête et les épaules, sinon il ne se voit pas
  if (a.focus === 'head') {
    const S0 = skeleton(poseAt(tl, 0).pose);
    center = new THREE.Vector3(S0.head[0], S0.head[1] - 0.2, S0.head[2]);
    radius = 0.55;
  }
  const paths = movePaths(tl, { focus: a.focus });

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
    const arrows = buildArrows(paths);
    scene.add(arrows.root);
    G = { scene, cam, key, rim, fill, body, props, M, floor, arrows };
    gen = generation();
  };

  let yaw0 = (yaw ?? a.cam ?? 60) * D, drag = 0, dragging = false, lastX = 0, idle = 0, vel = 0, downX = 0, downT = 0;
  // un appui bref (sans glisser) passe au ralenti (×0,5) ou revient à vitesse normale
  let speed = 1, simT = 0;
  const ui = overlay(canvas, tl);
  const tilt = (a.tilt ?? 14) * D;
  const t0 = performance.now();
  let raf = 0, lastCue = null, visible = true, lastT = t0;
  const onDown = (e) => { dragging = true; lastX = downX = e.clientX; downT = performance.now(); vel = 0; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (!dragging) return; const d = (e.clientX - lastX) * 0.012; drag += d; vel = d * 60; lastX = e.clientX; idle = performance.now(); };
  const onUp = (e) => {
    dragging = false; idle = performance.now();
    if (e?.type === 'pointerup' && Math.abs(e.clientX - downX) < 6 && performance.now() - downT < 350) { speed = speed === 1 ? 0.5 : 1; ui?.speed(speed); vel = 0; }
  };
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
    simT += dt * speed;
    const time = at ?? simT;
    const { pose, cue } = poseAt(tl, time);
    if (cue !== lastCue) { lastCue = cue; onCue?.(cue); }
    const ph = phaseAt(tl, time);
    showArrows(G.arrows, ph);
    ui?.phase(ph);
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
    ui?.remove();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    if (G) {
      G.scene.traverse((o) => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); });
      Object.values(G.M).forEach((m) => m.dispose?.());
      G.body.B.mats.forEach((m) => m.dispose());
      G.arrows?.list.flat().forEach((x) => { x.tube.material.dispose(); x.tip.material.dispose(); });
      G.key.shadow.map?.dispose();
    }
    G = null;
  }
  raf = requestAnimationFrame(frame);
  return stop;
}
