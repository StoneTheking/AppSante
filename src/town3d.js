// Rendu 3D de « Ta ville » (three.js) : île low-poly, rues pavées, bâtiments générés, habitants animés.
// - Chaque bâtiment est fusionné en un seul maillage à couleurs par sommet (1 à 3 appels de dessin par parcelle).
// - Les habitants sont dessinés en instances (8 appels pour toute la population).
// - Ciel, lumière et fenêtres suivent l'heure réelle ; la météo, la brume, l'herbe et les fontaines suivent ta santé.
// La ville a son propre contexte WebGL (plein écran), libéré à la fermeture.
import { THREE } from './gl3d.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './town.js';

export const P = 3; // pas d'une parcelle (parcelle + rue)
const LOT = 2.4, HALF = (T.GRID * P) / 2, ISLAND = HALF + 2.2;
const TAU = Math.PI * 2;
export const lotXZ = (i, j) => [(i - T.C) * P, (j - T.C) * P];
const FRONT = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // direction de la façade selon la rotation
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- kit de modélisation (géométries fusionnées)
const UNIT = {};
const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); if (n.attributes.uv1) n.deleteAttribute('uv1'); n.computeVertexNormals(); return n; };
const unit = (name, make) => UNIT[name] || (UNIT[name] = strip(make()));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function prism() { // toit à deux pans : arête le long de x, base 1 × 1 à y = 0, faîte à y = 1
  const g = new THREE.BufferGeometry();
  const a = [-0.5, 0, 0.5], b = [0.5, 0, 0.5], c = [0.5, 0, -0.5], d = [-0.5, 0, -0.5], e = [-0.5, 1, 0], f = [0.5, 1, 0];
  const tri = [a, b, f, a, f, e, c, d, e, c, e, f, a, e, d, b, c, f, a, d, c, a, c, b];
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
  return g;
}

class Kit {
  constructor() { this.solid = []; this.glow = []; this.water = []; this.smoke = []; this.spray = []; this.flags = []; this.spin = []; this.lights = []; }
  put(g, color, x, y, z, sx, sy, sz, o = {}) {
    const geo = g.clone();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    geo.applyMatrix4(_m);
    if (o.m) geo.applyMatrix4(o.m);
    _c.set(color);
    const n = geo.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (o.glow ? this.glow : o.water ? this.water : this.solid).push(geo);
    return this;
  }
  box(w, h, d, x, y, z, c, o) { return this.put(unit('box', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), c, x, y, z, w, h, d, o); }
  cyl(r, h, x, y, z, c, o = {}) { const s = o.seg || 10; return this.put(unit('cyl' + s, () => new THREE.CylinderGeometry(1, 1, 1, s).translate(0, 0.5, 0)), c, x, y, z, r * (o.sx || 1), h, r * (o.sz || 1), o); }
  tube(r1, r2, h, x, y, z, c, o = {}) { const s = o.seg || 10; return this.put(unit(`tube${s}_${r1 / r2}`, () => new THREE.CylinderGeometry(r1 / r2, 1, 1, s).translate(0, 0.5, 0)), c, x, y, z, r2, h, r2, o); }
  cone(r, h, x, y, z, c, o = {}) { const s = o.seg || 10; return this.put(unit('cone' + s, () => new THREE.ConeGeometry(1, 1, s).translate(0, 0.5, 0)), c, x, y, z, r, h, r, o); }
  pyr(w, h, d, x, y, z, c, o = {}) { return this.put(unit('pyr', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), c, x, y, z, w, h, d, o); }
  ball(r, x, y, z, c, o = {}) { return this.put(unit('ball' + (o.det ?? 1), () => new THREE.IcosahedronGeometry(1, o.det ?? 1)), c, x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), o); }
  dome(r, x, y, z, c, o = {}) { return this.put(unit('dome', () => new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI / 2)), c, x, y, z, r, r * (o.sy || 1), r, o); }
  gable(w, h, d, x, y, z, c, o) { return this.put(unit('gable', prism), c, x, y, z, w, h, d, o); }
  torus(r, t, x, y, z, c, o = {}) { return this.put(unit(`torus${t / r}`, () => new THREE.TorusGeometry(1, t / r, 6, 28).rotateX(Math.PI / 2)), c, x, y, z, r * (o.sx || 1), r * (o.sy || 1), r * (o.sz || 1), o); }
  disc(r, x, y, z, c, o = {}) { return this.cyl(r, 0.02, x, y, z, c, { seg: 20, ...o }); }
  mesh(mats) {
    const g = new THREE.Group();
    const add = (list, mat, shadow) => {
      if (!list.length) return;
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.castShadow = shadow; m.receiveShadow = true;
      g.add(m);
      list.forEach((x) => x.dispose());
    };
    add(this.solid, mats.solid, true);
    add(this.glow, mats.glow, false);
    add(this.water, mats.water, false);
    return g;
  }
}

// ---------------------------------------------------------------- couleurs et éléments de base
const C = { stone: '#cfc6b6', pave: '#ddd5c6', pave2: '#c7bdac', wood: '#9a6a42', dark: '#3b3733', door: '#6b4a32', white: '#f5f2ea', metal: '#9aa3ad', brick: '#a4553f', gold: '#e8b93a', bush: '#4f9a45', red: '#d94b3d', glass: '#ffd58a' };
const WIN = ['#ffd58a', '#ffcf7a', '#ffe1a6', '#ffd58a', '#2f3946']; // 1 fenêtre sur 5 reste éteinte la nuit

function slab(k, c, kind = 'grass') {
  const col = kind === 'grass' ? c.lotGrass : kind === 'pave' ? C.pave : kind === 'gravel' ? '#e6dfcf' : kind === 'sand' ? c.th.sand : kind;
  k.box(LOT, 0.08, LOT, 0, 0, 0, col);
  if (kind === 'grass') k.box(LOT + 0.04, 0.05, LOT + 0.04, 0, 0, 0, C.stone); // bordure
  return 0.08;
}
function win(k, c, x, y, z, w, h, face, r) { // fenêtre sur une face : 'z+', 'z-', 'x+', 'x-'
  const col = WIN[Math.floor(r() * WIN.length)];
  const along = face[0] === 'z';
  k.box(along ? w + 0.06 : 0.05, 0.03, along ? 0.05 : w + 0.06, x, y - 0.03, z, C.white); // appui
  k.box(along ? w : 0.03, h, along ? 0.03 : w, x, y, z, col, { glow: true });
}
function windows(k, c, w, d, ox, oz, y, h, nw, nd, r, skipFront = []) {
  const ww = 0.17;
  for (let a = 0; a < nw; a++) {
    const x = ox - w / 2 + (w / nw) * (a + 0.5);
    if (!skipFront.includes(a)) win(k, c, x, y, oz + d / 2 + 0.01, ww, h, 'z+', r);
    win(k, c, x, y, oz - d / 2 - 0.01, ww, h, 'z-', r);
  }
  for (let a = 0; a < nd; a++) {
    const z = oz - d / 2 + (d / nd) * (a + 0.5);
    win(k, c, ox + w / 2 + 0.01, y, z, ww, h, 'x+', r);
    win(k, c, ox - w / 2 - 0.01, y, z, ww, h, 'x-', r);
  }
}
function tree(k, c, x, z, s = 1, r = Math.random, y = 0) {
  const th = c.th;
  const leaf = th.tree[Math.floor(r() * th.tree.length)];
  if (th.palm && r() < 0.7) {
    const lean = (r() - 0.5) * 0.5;
    for (let i = 0; i < 5; i++) k.cyl(0.05 * s, 0.22 * s, x + lean * i * 0.06 * s, y + i * 0.21 * s, z, '#a67c52', { seg: 6 });
    const tx = x + lean * 0.3 * s, ty = y + 1.05 * s;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; k.box(0.1 * s, 0.03 * s, 0.6 * s, tx + Math.sin(a) * 0.25 * s, ty - 0.08 * s, z + Math.cos(a) * 0.25 * s, leaf, { ry: a, rx: 0.35 }); }
    k.ball(0.07 * s, tx, ty, z, '#6b4a2a');
    return;
  }
  k.cyl(0.06 * s, 0.4 * s, x, y, z, '#7a5434', { seg: 6 });
  if (r() < 0.45) { // sapin
    k.cone(0.36 * s, 0.6 * s, x, y + 0.3 * s, z, leaf, { seg: 7 });
    k.cone(0.27 * s, 0.5 * s, x, y + 0.62 * s, z, leaf, { seg: 7 });
    if (th.snow) k.cone(0.14 * s, 0.22 * s, x, y + 0.92 * s, z, '#ffffff', { seg: 7 });
  } else {
    k.ball(0.36 * s, x, y + 0.62 * s, z, leaf, { sy: 0.9 });
    k.ball(0.24 * s, x + 0.18 * s, y + 0.78 * s, z - 0.08 * s, leaf);
    if (th.snow) k.ball(0.25 * s, x, y + 0.86 * s, z, '#ffffff', { sy: 0.45 });
  }
}
const bush = (k, c, x, z, s = 1, y = 0.08) => k.ball(0.16 * s, x, y + 0.1 * s, z, c.th.snow ? '#e9f0f4' : C.bush, { sy: 0.8 });
function bench(k, x, z, ry = 0, y = 0.08) {
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
  k.box(0.42, 0.03, 0.14, 0, y + 0.13, 0, C.wood, { m });
  k.box(0.42, 0.12, 0.03, 0, y + 0.16, -0.065, C.wood, { m });
  k.box(0.03, 0.13, 0.12, -0.18, y, 0, C.dark, { m });
  k.box(0.03, 0.13, 0.12, 0.18, y, 0, C.dark, { m });
}
function lamp(k, x, z, y = 0.08) {
  k.cyl(0.025, 0.7, x, y, z, '#38404a', { seg: 6 });
  k.box(0.1, 0.03, 0.1, x, y + 0.7, z, '#38404a');
  k.ball(0.055, x, y + 0.66, z, '#ffe6a8', { glow: true });
  k.lights.push([x, y + 0.66, z]);
}
function flowers(k, c, x, z, w, d, r, y = 0.08) {
  const cols = c.vit >= 55 ? ['#f472b6', '#facc15', '#f87171', '#a78bfa', '#ffffff', '#fb923c'] : ['#9c8f6e', '#a39374', '#8f875f'];
  k.box(w, 0.06, d, x, y, z, '#6b4a32');
  for (let i = 0; i < w * d * 40; i++) k.ball(c.vit >= 55 ? 0.035 : 0.025, x + (r() - 0.5) * (w - 0.06), y + 0.09, z + (r() - 0.5) * (d - 0.06), cols[Math.floor(r() * cols.length)], { det: 0 });
}
function flag(k, x, y, z, h = 0.8) {
  k.cyl(0.018, h, x, y, z, '#d7dbe0', { seg: 6 });
  k.ball(0.03, x, y + h, z, C.gold, { det: 0 });
  k.flags.push([x, y + h - 0.05, z]);
}
function sign(k, x, y, z, w, col, o = {}) { k.box(w, 0.16, 0.04, x, y, z, col, o); }
function awning(k, x, y, z, w, d, a, b) {
  const n = Math.round(w / 0.16);
  for (let i = 0; i < n; i++) k.box(w / n, 0.03, d, x - w / 2 + (w / n) * (i + 0.5), y, z + d / 2, i % 2 ? a : b, { rx: 0.42 });
}
function produce(k, x, y, z, full, r) {
  k.box(0.32, 0.12, 0.22, x, y, z, '#a87b4f');
  if (!full) return;
  const cols = ['#e53935', '#43a047', '#fb8c00', '#fdd835', '#8e24aa', '#7cb342'];
  const col = cols[Math.floor(r() * cols.length)];
  for (let i = 0; i < 6; i++) k.ball(0.045, x - 0.1 + (i % 3) * 0.1, y + 0.14 + (i > 2 ? 0.03 : 0), z - 0.04 + (i > 2 ? 0.07 : 0), col, { det: 0 });
}
function columns(k, x0, x1, z, y, h, n, col = C.white) {
  for (let i = 0; i < n; i++) k.cyl(0.06, h, x0 + ((x1 - x0) / (n - 1)) * i, y, z, col, { seg: 8 });
}

// ---------------------------------------------------------------- les bâtiments (façade vers +z)
const B = {};
B.hall = (k, c, r) => {
  const y = slab(k, c, 'pave');
  const L = c.lvl;
  k.box(2.1, 0.1, 0.5, 0, y, 0.85, C.stone); // parvis et marches
  k.box(1.7, 0.06, 0.3, 0, y + 0.1, 0.8, C.pave2);
  const w = L >= 2 ? 1.5 : 1.7, H = 1.2;
  k.box(w, H, 1.2, 0, y, -0.15, c.wall);
  k.box(w + 0.08, 0.08, 1.28, 0, y + H, -0.15, C.white);
  windows(k, c, w, 1.2, 0, -0.15, y + 0.45, 0.32, 4, 3, r, [1, 2]);
  windows(k, c, w, 1.2, 0, -0.15, y + 0.88, 0.22, 4, 3, r);
  k.box(0.42, 0.6, 0.05, 0, y, 0.46, C.door);
  columns(k, -0.55, 0.55, 0.62, y, 0.95, 4);
  k.box(1.3, 0.1, 0.3, 0, y + 0.95, 0.55, C.white);
  k.gable(1.4, 0.28, 0.32, 0, y + 1.05, 0.55, C.white);
  if (L >= 2) for (const s of [-1, 1]) { // ailes
    k.box(0.42, 0.85, 1.0, s * 0.96, y, -0.2, c.wall);
    k.gable(0.5, 0.35, 1.08, s * 0.96, y + 0.85, -0.2, c.roof, { ry: Math.PI / 2 });
    windows(k, c, 0.42, 1.0, s * 0.96, -0.2, y + 0.42, 0.24, 1, 2, r);
  }
  k.gable(w + 0.15, 0.5, 1.38, 0, y + H + 0.08, -0.15, c.roof);
  // tour de l'horloge
  const th = L >= 3 ? 1.2 : 0.9;
  k.box(0.5, th, 0.5, 0, y + H, -0.2, c.wall);
  k.cyl(0.15, 0.03, 0, y + H + th - 0.35, 0.06, C.white, { rx: Math.PI / 2, seg: 16 });
  k.box(0.02, 0.1, 0.02, 0, y + H + th - 0.35, 0.08, C.dark);
  if (L >= 3) { k.cyl(0.3, 0.1, 0, y + H + th, -0.2, C.white, { seg: 12 }); k.dome(0.28, 0, y + H + th + 0.1, -0.2, C.gold); k.cyl(0.02, 0.2, 0, y + H + th + 0.36, -0.2, C.gold); }
  else k.pyr(0.62, 0.5, 0.62, 0, y + H + th, -0.2, c.roof);
  flag(k, 0.85, y, 0.95, 1.0);
  flag(k, -0.85, y, 0.95, 1.0);
  for (const s of [-1, 1]) { bush(k, c, s * 1.0, 0.35); bush(k, c, s * 1.0, -0.9); }
};
B.house = (k, c, r) => {
  const y = slab(k, c);
  const L = c.lvl, H = L >= 3 ? 1.45 : 0.95;
  k.box(0.32, 0.02, 0.62, 0, y, 0.9, C.pave2);
  k.box(1.5, 0.08, 1.24, -0.1, y, -0.2, C.stone);
  k.box(1.44, H, 1.18, -0.1, y + 0.06, -0.2, c.wall);
  k.box(0.32, 0.56, 0.05, -0.1, y + 0.06, 0.4, C.door);
  k.box(0.44, 0.04, 0.2, -0.1, y + 0.66, 0.46, c.roof);
  windows(k, c, 1.44, 1.18, -0.1, -0.2, y + 0.42, 0.26, 3, 2, r, [1]);
  if (L >= 3) windows(k, c, 1.44, 1.18, -0.1, -0.2, y + 0.98, 0.24, 3, 2, r);
  k.gable(1.66, 0.62, 1.4, -0.1, y + 0.06 + H, -0.2, c.roof);
  k.box(0.17, 0.5, 0.17, 0.3, y + H + 0.18, -0.45, C.brick);
  k.smoke.push([0.3, y + H + 0.75, -0.45]);
  if (L >= 2) { k.box(0.52, 0.62, 0.9, 0.86, y, -0.3, c.wall); k.box(0.58, 0.06, 0.96, 0.86, y + 0.62, -0.3, c.roof); k.box(0.4, 0.42, 0.03, 0.86, y, 0.16, '#cfd5db'); }
  // jardin : haie, fleurs, arbre
  for (let x = -1.1; x <= 1.1; x += 0.22) if (Math.abs(x) > 0.2) k.box(0.2, 0.18, 0.1, x, y, 1.1, c.th.snow ? '#dfe8ee' : '#5e9e4a');
  flowers(k, c, -0.75, 0.62, 0.5, 0.18, r);
  if (L < 2) tree(k, c, 0.85, -0.6, 0.8, r, y);
  bush(k, c, 0.75, 0.65);
};
B.cottage = (k, c, r) => {
  const y = slab(k, c);
  const H = c.lvl >= 3 ? 1.2 : 0.85;
  for (let i = 0; i < Math.round(H / 0.1); i++) k.box(1.3, 0.1, 1.1, 0, y + i * 0.1, -0.25, i % 2 ? '#a06c40' : '#93603a');
  k.gable(1.5, 0.85, 1.3, 0, y + H, -0.25, c.roof);
  k.box(1.3, 0.06, 0.5, 0, y, 0.55, C.wood); // terrasse
  for (const x of [-0.6, 0.6]) k.box(0.06, 0.55, 0.06, x, y, 0.75, C.wood);
  k.box(1.36, 0.05, 0.55, 0, y + 0.55, 0.52, c.roof, { rx: -0.25 });
  k.box(0.3, 0.55, 0.04, 0, y, 0.31, C.door);
  windows(k, c, 1.3, 1.1, 0, -0.25, y + 0.38, 0.24, 2, 2, r);
  k.box(0.16, 0.6, 0.16, -0.4, y + H + 0.2, -0.45, C.stone);
  k.smoke.push([-0.4, y + H + 0.85, -0.45]);
  // potager
  for (let i = 0; i < 3; i++) { k.box(0.5, 0.06, 0.14, 0.75, y, 0.7 + i * 0.18, '#6b4a32'); for (let j = 0; j < 4; j++) k.ball(0.04, 0.58 + j * 0.11, y + 0.08, 0.7 + i * 0.18, c.vit >= 45 ? ['#4caf50', '#e53935', '#ff9800'][i] : '#8d8258', { det: 0 }); }
  tree(k, c, -0.85, 0.75, 0.75, r, y);
  tree(k, c, 0.9, -0.85, 0.7, r, y);
};
B.flats = (k, c, r) => {
  const y = slab(k, c, 'pave');
  const n = 3 + c.lvl * 2, fh = 0.42;
  k.box(1.7, n * fh + 0.1, 1.5, 0, y, -0.2, c.wall);
  for (let f = 0; f < n; f++) {
    windows(k, c, 1.7, 1.5, 0, -0.2, y + 0.2 + f * fh, 0.22, 4, 3, r, f === 0 ? [1, 2] : []);
    if (f > 0 && f % 2 === 0) for (const x of [-0.5, 0.5]) { k.box(0.42, 0.04, 0.2, x, y + f * fh + 0.06, 0.65, C.stone); k.box(0.42, 0.14, 0.02, x, y + f * fh + 0.1, 0.75, '#8fa3b5'); }
  }
  k.box(1.8, 0.1, 1.6, 0, y + n * fh + 0.1, -0.2, C.stone);
  k.box(0.5, 0.3, 0.4, 0.4, y + n * fh + 0.2, -0.4, C.metal);
  k.cyl(0.14, 0.3, -0.4, y + n * fh + 0.2, -0.5, '#b0a090', { seg: 8 });
  k.box(0.5, 0.55, 0.04, 0, y, 0.56, '#5a6b7a');
  k.box(0.7, 0.04, 0.35, 0, y + 0.6, 0.68, C.dark);
  tree(k, c, -0.9, 0.85, 0.65, r, y); tree(k, c, 0.9, 0.85, 0.65, r, y);
};
B.villa = (k, c, r) => {
  const y = slab(k, c);
  k.box(1.4, 0.75, 0.9, -0.3, y, -0.5, C.white);
  k.box(0.9, 0.6, 0.8, 0.25, y + 0.75, -0.55, C.white);
  k.box(1.5, 0.05, 1.0, -0.3, y + 0.75, -0.5, '#4b5563');
  k.box(1.0, 0.05, 0.9, 0.25, y + 1.35, -0.55, '#4b5563');
  k.box(1.1, 0.5, 0.03, -0.35, y + 0.12, -0.04, C.glass, { glow: true });
  k.box(0.7, 0.38, 0.03, 0.25, y + 0.85, -0.14, C.glass, { glow: true });
  k.box(1.0, 0.06, 0.7, -0.25, y, 0.55, C.wood);
  k.box(0.9, 0.04, 0.55, -0.25, y + 0.03, 0.55, '#38bdf8', { water: true });
  k.box(0.5, 0.05, 0.25, 0.75, y, 0.4, C.wood);
  k.box(0.1, 0.25, 0.1, 0.65, y + 0.05, 0.4, '#f8fafc'); k.box(0.1, 0.25, 0.1, 0.85, y + 0.05, 0.4, '#f8fafc');
  tree(k, c, 0.85, -0.2, 0.8, r, y);
  tree(k, c, -0.95, 1.0, 0.6, r, y);
  if (c.lvl >= 2) { k.box(0.5, 0.5, 0.5, 0.85, y, -0.85, C.white); k.box(0.56, 0.04, 0.56, 0.85, y + 0.5, -0.85, '#4b5563'); }
};
function shop(k, c, r, w, d, H, z = -0.3) {
  const y = slab(k, c, 'pave');
  k.box(w, H, d, 0, y, z, c.wall);
  k.box(w + 0.06, 0.06, d + 0.06, 0, y + H, z, C.white);
  k.box(w * 0.62, 0.45, 0.03, -w * 0.12, y + 0.08, z + d / 2 + 0.01, C.glass, { glow: true });
  k.box(0.26, 0.55, 0.04, w * 0.3, y, z + d / 2 + 0.01, C.door);
  return y;
}
B.grocer = (k, c, r) => {
  const y = shop(k, c, r, 1.6, 1.1, 0.95);
  k.gable(1.75, 0.5, 1.25, 0, y + 1.0, -0.3, c.roof);
  awning(k, 0, y + 0.72, 0.25, 1.6, 0.35, '#2e7d32', '#f1f5f0');
  for (let i = 0; i < 4; i++) produce(k, -0.6 + i * 0.4, y, 0.58, c.state !== 'low', r);
  for (let i = 0; i < 3; i++) produce(k, -0.45 + i * 0.45, y + 0.12, 0.42, c.state === 'top', r);
  sign(k, 0, y + 1.0, 0.27, 0.8, '#2e7d32');
  k.ball(0.09, 0, y + 1.25, 0.28, '#e53935');
  bush(k, c, -1.0, 1.0); bush(k, c, 1.0, 1.0);
};
B.bakery = (k, c, r) => {
  const y = shop(k, c, r, 1.3, 1.1, 0.95, -0.3);
  k.gable(1.45, 0.55, 1.25, 0, y + 1.0, -0.3, c.roof);
  awning(k, -0.1, y + 0.72, 0.25, 1.3, 0.3, '#b45309', '#fef3c7');
  sign(k, 0, y + 0.98, 0.27, 0.7, '#7c4a1e');
  k.box(0.32, 0.08, 0.1, 0, y + 1.02, 0.3, '#f5c46b');
  // moulin
  k.tube(0.22, 0.3, 1.3, 0.85, y, 0.35, '#efe6d4', { seg: 10 });
  k.cone(0.3, 0.42, 0.85, y + 1.3, 0.35, c.roof, { seg: 10 });
  const s = new Kit();
  for (let i = 0; i < 4; i++) { const m = new THREE.Matrix4().makeRotationZ((i * Math.PI) / 2); s.box(0.07, 0.62, 0.02, 0, 0.06, 0, '#f8fafc', { m }); s.box(0.015, 0.6, 0.03, 0, 0.06, 0.01, C.wood, { m }); }
  s.ball(0.05, 0, 0, 0, C.wood);
  k.spin.push({ kit: s, p: [0.85, y + 1.12, 0.65], axis: 'z', speed: c.state === 'low' ? 0.15 : 0.9 });
  for (let i = 0; i < 2; i++) produce(k, -0.4 + i * 0.4, y, 0.6, c.state !== 'low', () => 0.6);
  k.smoke.push([-0.45, y + 1.7, -0.5]);
  k.box(0.16, 0.45, 0.16, -0.45, y + 1.15, -0.5, C.brick);
};
B.market = (k, c, r) => {
  const y = slab(k, c, 'pave');
  for (const x of [-1, -0.33, 0.33, 1]) for (const z of [-0.95, 0.55]) k.box(0.08, 1.05, 0.08, x, y, z, C.wood);
  k.box(2.2, 0.08, 1.7, 0, y + 1.05, -0.2, C.wood);
  k.gable(2.3, 0.6, 1.85, 0, y + 1.13, -0.2, c.roof);
  k.gable(0.7, 0.28, 0.6, 0, y + 1.42, -0.2, C.white);
  const full = c.state !== 'low';
  for (let i = 0; i < 3; i++) {
    const x = -0.7 + i * 0.7;
    k.box(0.5, 0.36, 0.4, x, y, -0.2, '#a87b4f');
    awning(k, x, y + 0.75, -0.42, 0.5, 0.25, ['#c62828', '#1565c0', '#2e7d32'][i], '#fafafa');
    produce(k, x - 0.1, y + 0.36, -0.2, full, r); produce(k, x + 0.12, y + 0.36, -0.12, full, r);
  }
  for (let i = 0; i < 4; i++) produce(k, -0.75 + i * 0.5, y, 0.85, full && c.state === 'top', r);
  lamp(k, -1.05, 1.05); lamp(k, 1.05, 1.05);
};
B.gym = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.box(1.8, 1.0, 1.1, 0, y, -0.45, '#e5e7eb');
  k.box(1.86, 0.1, 1.16, 0, y + 1.0, -0.45, '#f97316');
  k.box(1.5, 0.6, 0.03, 0, y + 0.15, 0.11, C.glass, { glow: true });
  for (let i = -2; i <= 2; i++) k.box(0.03, 0.62, 0.04, i * 0.36, y + 0.14, 0.12, '#374151');
  k.box(0.7, 0.18, 0.04, 0, y + 0.82, 0.12, '#111827');
  k.box(0.36, 0.04, 0.05, 0, y + 0.89, 0.15, '#f97316'); k.box(0.06, 0.12, 0.06, -0.18, y + 0.85, 0.15, '#f97316'); k.box(0.06, 0.12, 0.06, 0.18, y + 0.85, 0.15, '#f97316');
  // agrès dehors
  k.box(1.6, 0.03, 0.9, 0, y, 0.55, '#b45309');
  for (const x of [-0.55, -0.15]) k.box(0.05, 0.75, 0.05, x, y, 0.75, '#374151');
  k.cyl(0.02, 0.45, -0.57, y + 0.75, 0.75, C.metal, { rz: Math.PI / 2, seg: 6 });
  k.box(0.5, 0.08, 0.2, 0.55, y + 0.03, 0.6, '#1f2937');
  for (const x of [0.3, 0.8]) k.cyl(0.08, 0.04, x, y + 0.2, 0.85, '#111827', { rx: Math.PI / 2 });
  k.cyl(0.015, 0.5, 0.3, y + 0.2, 0.85, C.metal, { rz: Math.PI / 2, seg: 6 });
};
B.pool = (k, c, r) => {
  const y = slab(k, c, '#e9e3d6');
  k.box(1.9, 0.06, 1.5, 0, y - 0.04, -0.15, '#7dd3fc');
  k.box(1.8, 0.03, 1.4, 0, y, -0.15, '#38bdf8', { water: true });
  for (let i = 1; i < 4; i++) k.box(0.02, 0.035, 1.38, -0.9 + i * 0.45, y, -0.15, i % 2 ? '#f8fafc' : '#ef4444');
  k.box(0.12, 0.35, 0.12, 0.95, y, -0.75, C.white); k.box(0.12, 0.03, 0.55, 0.95, y + 0.35, -0.55, '#60a5fa');
  if (c.lvl >= 2) { k.box(0.1, 0.8, 0.1, -1.0, y, -0.85, '#f59e0b'); k.box(0.12, 0.04, 0.9, -0.85, y + 0.4, -0.45, '#f59e0b', { rx: 0.7 }); }
  for (const x of [-0.6, 0.0, 0.6]) { k.box(0.28, 0.04, 0.5, x, y + 0.1, 0.9, '#f8fafc', { rx: -0.2 }); }
  k.cyl(0.02, 0.6, 0.95, y, 0.95, C.metal, { seg: 6 }); k.cone(0.32, 0.15, 0.95, y + 0.52, 0.95, '#ef4444', { seg: 8 });
};
B.stadium = (k, c, r) => {
  const y = slab(k, c, '#d9d2c4');
  k.cyl(1.15, 0.03, 0, y, -0.05, '#c2410c', { sx: 1, sz: 0.85, seg: 28 });
  k.cyl(0.85, 0.035, 0, y, -0.05, '#4caf50', { sx: 1, sz: 0.75, seg: 28 });
  k.box(0.02, 0.04, 1.0, 0, y, -0.05, '#ffffff');
  k.torus(0.42, 0.01, 0, y + 0.04, -0.05, '#ffffff', { sz: 0.85 });
  for (const s of [-1, 1]) { for (let t = 0; t < 3; t++) k.box(1.6, 0.12, 0.14, 0, y + t * 0.12, s * (1.08 - t * 0.05) - 0.05, t % 2 ? '#64748b' : '#94a3b8'); }
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.0], [1.1, 1.0]]) { k.box(0.05, 1.3, 0.05, x, y, z, '#475569'); k.box(0.22, 0.14, 0.06, x, y + 1.3, z, '#e2e8f0'); k.box(0.18, 0.1, 0.02, x, y + 1.32, z + (z < 0 ? 0.04 : -0.04), '#fffbe6', { glow: true }); }
  k.box(0.08, 0.2, 0.3, -0.7, y, -0.05, '#f8fafc'); k.box(0.08, 0.2, 0.3, 0.7, y, -0.05, '#f8fafc');
};
B.fountain = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.cyl(1.05, 0.02, 0, y, 0, C.pave2, { seg: 24 });
  k.tube(0.7, 0.74, 0.22, 0, y, 0, C.stone, { seg: 20 });
  const wet = c.state !== 'low';
  k.cyl(0.66, 0.04, 0, y + (wet ? 0.15 : 0.04), 0, wet ? '#4fc3f7' : '#bfae8a', { seg: 20, water: wet });
  k.cyl(0.1, 0.55, 0, y, 0, C.stone, { seg: 8 });
  k.cyl(0.32, 0.05, 0, y + 0.55, 0, C.stone, { seg: 14 });
  k.cyl(0.08, 0.25, 0, y + 0.6, 0, C.stone, { seg: 8 });
  k.ball(0.09, 0, y + 0.88, 0, C.stone);
  if (wet) { k.cyl(0.29, 0.03, 0, y + 0.58, 0, '#4fc3f7', { seg: 14, water: true }); k.spray.push([0, y + 0.92, 0, c.state === 'top' ? 1 : 0.55]); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; bench(k, Math.sin(a) * 1.0, Math.cos(a) * 1.0, a + Math.PI); }
  lamp(k, 1.05, 0); lamp(k, -1.05, 0);
};
B.baths = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.box(1.7, 0.85, 0.9, 0, y, -0.6, '#efe7d8');
  k.dome(0.45, 0, y + 0.85, -0.6, '#cbd5e1');
  columns(k, -0.7, 0.7, -0.1, y, 0.75, 5);
  k.box(1.7, 0.1, 0.24, 0, y + 0.75, -0.12, '#efe7d8');
  k.gable(1.75, 0.28, 0.3, 0, y + 0.85, -0.12, '#efe7d8');
  k.box(1.5, 0.06, 0.7, 0, y, 0.55, C.stone);
  const ok = c.state !== 'low';
  k.box(1.36, 0.03, 0.56, 0, y + 0.04, 0.55, ok ? '#5eead4' : '#a8a29e', { water: ok });
  if (ok) for (const x of [-0.4, 0.1, 0.5]) k.smoke.push([x, y + 0.1, 0.55, 'steam']);
};
B.zen = (k, c, r) => {
  const y = slab(k, c, 'gravel');
  for (let i = 0; i < 7; i++) k.torus(0.18 + i * 0.07, 0.004, -0.35, y + 0.005, 0.3, '#cfc6b0');
  k.ball(0.17, -0.35, y + 0.05, 0.3, '#7c7f86', { sy: 0.7, det: 0 });
  k.ball(0.12, 0.5, y + 0.03, 0.7, '#8b8f96', { sy: 0.6, det: 0 });
  // torii
  for (const x of [-0.35, 0.35]) k.cyl(0.04, 0.8, x + 0.4, y, -0.6, '#c62828', { seg: 8 });
  k.box(0.95, 0.06, 0.1, 0.4, y + 0.8, -0.6, '#1f1f1f'); k.box(0.8, 0.05, 0.08, 0.4, y + 0.66, -0.6, '#c62828');
  // petit étang et bonsaï
  k.cyl(0.35, 0.025, -0.6, y, -0.55, '#4fc3f7', { sx: 1.3, seg: 16, water: true });
  for (const [x, z] of [[0.9, 0.0], [-0.95, 0.95]]) { k.cyl(0.04, 0.3, x, y, z, '#6b4a2a', { seg: 6 }); k.ball(0.2, x, y + 0.38, z, '#4d7c3a', { sy: 0.55 }); k.ball(0.13, x + 0.12, y + 0.3, z, '#4d7c3a', { sy: 0.5 }); }
  bench(k, 0.4, 0.2, 0);
  k.box(0.12, 0.25, 0.12, 0.95, y, 0.95, '#9ca3af'); k.pyr(0.22, 0.12, 0.22, 0.95, y + 0.25, 0.95, '#6b7280');
  k.ball(0.04, 0.95, y + 0.2, 0.95, '#ffe6a8', { glow: true });
};
B.spa = (k, c, r) => {
  const y = slab(k, c);
  k.cyl(0.85, 0.85, 0, y, -0.3, '#e0e7ff', { seg: 16 });
  k.dome(0.9, 0, y + 0.85, -0.3, '#a5b4fc', { sy: 0.45 });
  k.box(0.5, 0.6, 0.2, 0, y, 0.5, '#e0e7ff');
  k.box(0.28, 0.48, 0.03, 0, y, 0.61, C.door);
  for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; win(k, c, Math.sin(a) * 0.86, y + 0.4, -0.3 + Math.cos(a) * 0.86, 0.16, 0.28, 'z+', r); }
  k.ball(0.14, 0.35, y + 1.35, -0.3, '#fde68a', { glow: true }); k.ball(0.11, 0.42, y + 1.38, -0.25, '#a5b4fc');
  for (const s of [-1, 1]) { k.box(0.04, 0.45, 0.04, s * 0.95, y, 0.5, C.wood); k.box(0.04, 0.45, 0.04, s * 0.95, y, 1.0, C.wood); k.box(0.12, 0.03, 0.5, s * 0.95, y + 0.25, 0.75, '#f9a8d4', { rx: 0.1 }); }
  flowers(k, c, 0, 0.98, 1.2, 0.2, r);
};
B.observatory = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.box(1.4, 0.6, 1.2, 0, y, -0.25, '#e5e7eb');
  windows(k, c, 1.4, 1.2, 0, -0.25, y + 0.3, 0.2, 3, 2, r, [1]);
  k.box(0.3, 0.5, 0.04, 0, y, 0.36, C.door);
  k.cyl(0.55, 0.45, 0, y + 0.6, -0.25, '#f1f5f9', { seg: 18 });
  const d = new Kit();
  d.dome(0.57, 0, 0, 0, '#cbd5e1');
  d.box(0.16, 0.6, 0.08, 0, 0.0, 0.5, '#1e293b', { rx: -0.5 });
  d.cyl(0.06, 0.5, 0, 0.25, 0.25, '#475569', { rx: 0.9, seg: 8 });
  k.spin.push({ kit: d, p: [0, y + 1.05, -0.25], axis: 'y', speed: 0.12 });
  bench(k, -0.7, 0.8, 0); lamp(k, 0.9, 0.9);
};
B.cafe = (k, c, r) => {
  const y = shop(k, c, r, 1.4, 1.0, 0.9, -0.55);
  k.gable(1.55, 0.5, 1.15, 0, y + 0.95, -0.55, c.roof);
  awning(k, 0, y + 0.7, -0.05, 1.4, 0.3, '#7c2d12', '#fde7d2');
  sign(k, 0, y + 0.92, -0.03, 0.6, '#3f2a1d');
  for (const [x, z] of [[-0.6, 0.5], [0.15, 0.55], [0.8, 0.45], [-0.25, 1.0], [0.6, 1.0]]) {
    k.cyl(0.13, 0.03, x, y + 0.3, z, '#f8fafc', { seg: 10 }); k.cyl(0.015, 0.3, x, y, z, C.dark, { seg: 6 });
    for (const s of [-1, 1]) k.box(0.1, 0.18, 0.1, x + s * 0.2, y, z, '#8b5e3c');
    if (r() < 0.6) { k.cyl(0.012, 0.55, x, y + 0.3, z, '#e5e7eb', { seg: 4 }); k.cone(0.32, 0.12, x, y + 0.78, z, r() < 0.5 ? '#ef4444' : '#f8fafc', { seg: 8 }); }
  }
  k.lights.push([0, y + 0.9, 0.1]);
};
B.bandstand = (k, c, r) => {
  const y = slab(k, c);
  k.cyl(0.85, 0.22, 0, y, 0, C.stone, { seg: 8 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; k.cyl(0.03, 0.75, Math.sin(a) * 0.75, y + 0.22, Math.cos(a) * 0.75, '#f8fafc', { seg: 6 }); }
  k.cone(0.95, 0.5, 0, y + 0.97, 0, '#2f855a', { seg: 8 });
  k.ball(0.05, 0, y + 1.5, 0, C.gold);
  k.box(0.5, 0.12, 0.25, 0, y + 0.22, 1.0, C.stone, { ry: 0 });
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.6; bench(k, Math.sin(a) * 1.05, Math.cos(a) * 1.05, a + Math.PI); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; k.ball(0.035, Math.sin(a) * 0.78, y + 0.95, Math.cos(a) * 0.78, ['#facc15', '#f472b6', '#60a5fa'][i % 3], { glow: true, det: 0 }); }
};
B.library = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.box(1.8, 0.12, 0.4, 0, y, 0.45, C.stone); k.box(1.6, 0.12, 0.3, 0, y + 0.12, 0.4, C.stone);
  k.box(1.7, 1.05, 1.1, 0, y + 0.12, -0.3, '#e7dcc8');
  columns(k, -0.65, 0.65, 0.35, y + 0.24, 0.8, 4, '#f5efe3');
  k.box(1.7, 0.12, 0.3, 0, y + 1.04, 0.32, '#f5efe3');
  k.gable(1.75, 0.35, 0.35, 0, y + 1.16, 0.32, '#f5efe3');
  k.gable(1.8, 0.4, 1.2, 0, y + 1.17, -0.3, c.roof);
  k.box(0.4, 0.6, 0.04, 0, y + 0.24, 0.26, C.door);
  windows(k, c, 1.7, 1.1, 0, -0.3, y + 0.65, 0.36, 4, 3, r, [1, 2]);
  const bk = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04'];
  for (let i = 0; i < 4; i++) k.box(0.08, 0.22, 0.14, 0.7 + i * 0.09, y, 0.95, bk[i], { rz: i === 3 ? 0.3 : 0 });
  tree(k, c, -0.95, 0.95, 0.6, r, y);
};
B.theatre = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.box(1.9, 1.5, 1.3, 0, y, -0.4, '#7f1d1d');
  k.box(1.96, 0.12, 1.36, 0, y + 1.5, -0.4, C.gold);
  k.dome(0.45, 0, y + 1.6, -0.5, '#b45309', { sy: 0.7 });
  k.box(1.4, 0.32, 0.06, 0, y + 1.05, 0.28, '#fde68a', { glow: true });
  for (let i = 0; i < 10; i++) k.ball(0.03, -0.65 + i * 0.145, y + 0.98, 0.32, '#fff7d6', { glow: true, det: 0 });
  k.box(1.6, 0.06, 0.5, 0, y + 0.9, 0.48, C.dark);
  for (const x of [-0.45, 0, 0.45]) k.box(0.3, 0.6, 0.04, x, y, 0.27, '#450a0a');
  for (const x of [-0.85, 0.85]) { k.box(0.24, 0.45, 0.04, x, y + 0.1, 0.28, '#fef3c7', { glow: true }); }
  lamp(k, -1.05, 1.05); lamp(k, 1.05, 1.05);
};
B.clinic = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.box(1.8, 1.2, 1.1, 0, y, -0.45, '#f8fafc');
  k.box(1.86, 0.08, 1.16, 0, y + 1.2, -0.45, '#14b8a6');
  for (let f = 0; f < 2; f++) windows(k, c, 1.8, 1.1, 0, -0.45, y + 0.35 + f * 0.48, 0.24, 4, 2, r, f === 0 ? [1, 2] : []);
  k.box(0.6, 0.55, 0.04, 0, y, 0.11, '#a7f3d0', { glow: true });
  k.box(0.8, 0.05, 0.45, 0, y + 0.6, 0.3, '#14b8a6');
  k.box(0.36, 0.1, 0.06, 0, y + 1.32, -0.05, c.state === 'low' ? '#7f8a8a' : '#22c55e', { glow: true });
  k.box(0.1, 0.36, 0.06, 0, y + 1.19, -0.05, c.state === 'low' ? '#7f8a8a' : '#22c55e', { glow: true });
  k.box(0.7, 0.4, 0.38, 0.6, y, 0.75, '#f8fafc'); k.box(0.24, 0.24, 0.39, 0.85, y + 0.02, 0.75, '#e2e8f0');
  k.box(0.06, 0.18, 0.4, 0.42, y + 0.15, 0.75, '#ef4444');
  for (const x of [0.4, 0.82]) k.cyl(0.07, 0.04, x, y + 0.06, 0.55, '#111827', { rx: Math.PI / 2 });
  bush(k, c, -0.9, 0.8); bush(k, c, -0.55, 0.9);
};
B.park = (k, c, r) => {
  const y = slab(k, c);
  k.box(0.32, 0.015, LOT, 0, y, 0, C.pave2);
  k.box(LOT, 0.015, 0.32, 0, y, 0.2, C.pave2);
  for (const [x, z] of [[-0.75, -0.65], [0.7, -0.75], [-0.8, 0.85], [0.85, 0.8]]) tree(k, c, x, z, 0.95 + r() * 0.3, r, y);
  bench(k, -0.5, 0.0, 0); bench(k, 0.5, 0.42, Math.PI);
  lamp(k, 0.3, -0.3);
  flowers(k, c, -0.55, 0.45, 0.4, 0.2, r);
  bush(k, c, 0.4, -0.2); bush(k, c, -0.3, -1.0);
};
B.flowers = (k, c, r) => {
  const y = slab(k, c);
  for (let i = 0; i < 4; i++) flowers(k, c, -0.6 + (i % 2) * 1.2, -0.6 + Math.floor(i / 2) * 1.2, 0.8, 0.8, r, y);
  k.box(0.26, 0.015, LOT, 0, y, 0, C.pave2); k.box(LOT, 0.015, 0.26, 0, y, 0, C.pave2);
  k.cyl(0.2, 0.25, 0, y, 0, C.stone, { seg: 10 }); flowers(k, c, 0, 0, 0.25, 0.25, r, y + 0.2);
};
B.pond = (k, c, r) => {
  const y = slab(k, c);
  k.cyl(0.95, 0.03, 0, y - 0.01, -0.1, '#c2b28a', { sx: 1.1, sz: 0.85, seg: 20 });
  k.cyl(0.86, 0.03, 0, y, -0.1, '#3fa9d6', { sx: 1.1, sz: 0.85, seg: 20, water: true });
  for (let i = 0; i < 10; i++) { const a = r() * TAU; k.ball(0.07 + r() * 0.06, Math.sin(a) * 0.98, y, -0.1 + Math.cos(a) * 0.8, '#8b8f96', { det: 0, sy: 0.6 }); }
  for (let i = 0; i < 9; i++) k.cyl(0.012, 0.3 + r() * 0.15, 0.6 + r() * 0.3, y, 0.35 + r() * 0.2, '#6b8e23', { seg: 4 });
  for (const [x, z] of [[-0.2, -0.2], [0.25, 0.05]]) { k.ball(0.07, x, y + 0.05, z, '#f8fafc', { sy: 0.7, sz: 1.3 }); k.ball(0.04, x, y + 0.12, z + 0.07, '#166534'); k.box(0.03, 0.02, 0.04, x, y + 0.11, z + 0.12, '#f59e0b'); }
  bench(k, -0.6, 0.95, Math.PI); tree(k, c, 0.95, -0.95, 0.85, r, y);
  k.ball(0.06, -0.5, y + 0.03, -0.4, '#86efac', { sy: 0.2 }); k.ball(0.05, 0.4, y + 0.03, -0.5, '#86efac', { sy: 0.2 });
};
B.playground = (k, c, r) => {
  const y = slab(k, c, 'sand');
  k.box(0.5, 0.5, 0.5, -0.5, y, -0.5, '#f59e0b'); k.pyr(0.6, 0.3, 0.6, -0.5, y + 0.5, -0.5, '#ef4444');
  k.box(0.3, 0.03, 0.9, -0.5, y + 0.25, 0.1, '#3b82f6', { rx: -0.5 });
  for (const x of [0.25, 1.0]) { k.box(0.04, 0.75, 0.04, x, y, -0.55, '#64748b', { rz: 0.1 * Math.sign(x - 0.6) }); k.box(0.04, 0.75, 0.04, x, y, -0.15, '#64748b'); }
  k.box(0.85, 0.04, 0.04, 0.62, y + 0.75, -0.35, '#64748b');
  for (const x of [0.45, 0.8]) { k.box(0.01, 0.45, 0.01, x, y + 0.3, -0.35, '#94a3b8'); k.box(0.16, 0.03, 0.1, x, y + 0.28, -0.35, '#ef4444'); }
  k.box(0.6, 0.06, 0.6, 0.55, y, 0.6, '#a87b4f'); k.box(0.5, 0.02, 0.5, 0.55, y + 0.04, 0.6, '#f6e7b8');
  k.box(0.7, 0.04, 0.12, -0.35, y + 0.2, 0.85, '#22c55e', { rz: 0.15 }); k.box(0.08, 0.2, 0.08, -0.35, y, 0.85, '#64748b');
  bench(k, 0.1, 1.0, Math.PI);
};
B.windmill = (k, c, r) => {
  const y = slab(k, c);
  k.tube(0.05, 0.1, 2.2, 0, y, 0, '#f1f5f9', { seg: 10 });
  k.box(0.16, 0.14, 0.32, 0, y + 2.15, 0.02, '#f1f5f9');
  const s = new Kit();
  for (let i = 0; i < 3; i++) { const m = new THREE.Matrix4().makeRotationZ((i * TAU) / 3); s.box(0.07, 0.85, 0.02, 0, 0.04, 0, '#f8fafc', { m }); }
  s.ball(0.05, 0, 0, 0, '#e2e8f0');
  k.spin.push({ kit: s, p: [0, y + 2.22, 0.2], axis: 'z', speed: 1.4 });
  flowers(k, c, 0.7, 0.7, 0.5, 0.5, r); bush(k, c, -0.7, 0.6); bush(k, c, -0.6, -0.7);
};
B.statue = (k, c, r) => {
  const y = slab(k, c, 'pave');
  k.cyl(1.0, 0.02, 0, y, 0, C.pave2, { seg: 24 });
  k.box(0.6, 0.12, 0.6, 0, y, 0, C.stone); k.box(0.45, 0.5, 0.45, 0, y + 0.12, 0, '#d6d0c4');
  const s = '#c9a227';
  k.box(0.12, 0.35, 0.1, -0.07, y + 0.62, 0, s); k.box(0.12, 0.35, 0.1, 0.07, y + 0.62, 0, s);
  k.box(0.32, 0.4, 0.18, 0, y + 0.97, 0, s);
  k.ball(0.11, 0, y + 1.5, 0, s);
  k.box(0.08, 0.38, 0.08, 0.22, y + 1.32, 0, s, { rz: -0.4 }); k.box(0.08, 0.35, 0.08, -0.2, y + 1.0, 0, s, { rz: 0.15 });
  k.cone(0.06, 0.18, 0.36, y + 1.63, 0, '#f97316', { rz: -0.3 });
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; flowers(k, c, Math.sin(a) * 0.7, Math.cos(a) * 0.7, 0.3, 0.3, r); }
  lamp(k, 1.0, 0.6); lamp(k, -1.0, 0.6);
};

// ---------------------------------------------------------------- matériaux et shaders
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `uniform vec3 uTop, uHor, uSunDir, uSunCol; uniform float uNight, uCloud; varying vec3 vDir;
float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHor, uTop, pow(h, 0.55));
  if (d.y < 0.0) col = mix(uHor, uHor * 0.75, clamp(-d.y * 3.0, 0.0, 1.0));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(s, 900.0) * 3.0 * (1.0 - uCloud) + pow(s, 10.0) * 0.28 + pow(s, 3.0) * 0.08);
  vec3 q = floor(d * 260.0); float n = h3(q);
  col += step(0.9975, n) * uNight * (1.0 - uCloud) * smoothstep(0.05, 0.4, h) * (0.6 + 0.4 * sin(n * 900.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SEA_VERT = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SEA_FRAG = `uniform float uTime, uNight, uEdge; uniform vec3 uShallow, uDeep, uHor, uFoam; varying vec3 vW;
void main(){ float q = mix(length(vW.xz), max(abs(vW.x), abs(vW.z)), 0.75); float sh = q - uEdge;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 16.0, sh));
  float wave = sin(sh * 2.4 - uTime * 1.3) * 0.5 + 0.5;
  col = mix(col, uFoam, smoothstep(0.88, 1.0, wave) * (1.0 - smoothstep(0.0, 4.5, sh)) * 0.45);
  col = mix(uFoam, col, smoothstep(0.0, 0.55, sh));
  float sp = sin(vW.x * 1.7 + uTime * 0.9) * sin(vW.z * 1.9 - uTime * 1.2) * sin((vW.x + vW.z) * 0.6 + uTime * 0.5);
  col += pow(max(sp, 0.0), 10.0) * 0.35 * (1.0 - uNight);
  col *= mix(1.0, 0.32, uNight);
  float dist = length(vW.xz - cameraPosition.xz);
  col = mix(col, uHor, smoothstep(45.0, 140.0, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const PT_VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; vA = aAlpha; vC = aColor; }`;
const PT_FRAG = `varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a);
  #include <colorspace_fragment>
}`;

class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.col = new Float32Array(max * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PT_VERT, fragmentShader: PT_FRAG, uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, color, a0 = 1, g = 0, drag = 0) {
    if (this.p.length >= this.max) return;
    const c = new THREE.Color(color);
    this.p.push({ x, y, z, vx, vy, vz, life, age: 0, s0, s1, r: c.r, g: c.g, b: c.b, a0, gr: g, drag });
  }
  update(dt) {
    let n = 0;
    const keep = [];
    for (const q of this.p) {
      q.age += dt;
      if (q.age >= q.life) continue;
      q.vy -= q.gr * dt;
      const k = 1 - q.drag * dt;
      q.vx *= k; q.vz *= k; q.vy *= q.gr ? 1 : k;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const t = q.age / q.life;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      this.size[n] = lerp(q.s0, q.s1, t);
      this.alpha[n] = q.a0 * Math.min(1, t * 6) * (1 - t);
      this.col[n * 3] = q.r; this.col[n * 3 + 1] = q.g; this.col[n * 3 + 2] = q.b;
      keep.push(q); n++;
    }
    this.p = keep;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor']) g.attributes[a].needsUpdate = true;
  }
  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

// bulles et icônes : emoji dessinés dans une texture
const TEX = new Map();
function emojiTex(e, bubble) {
  const id = e + (bubble ? '·b' : '');
  if (TEX.has(id)) return TEX.get(id);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  if (bubble) {
    g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = 'rgba(15,23,42,0.18)'; g.lineWidth = 4;
    g.beginPath(); if (g.roundRect) g.roundRect(10, 8, 108, 90, 34); else g.rect(10, 8, 108, 90); g.moveTo(52, 96); g.lineTo(64, 120); g.lineTo(76, 96); g.closePath(); g.fill(); g.stroke();
  }
  g.font = `${bubble ? 58 : 84}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(e, 64, bubble ? 56 : 66);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  TEX.set(id, t);
  return t;
}

// ---------------------------------------------------------------- éclairage selon l'heure et la météo
const SKY_KEYS = [ // élévation du soleil → couleurs
  [-0.35, { top: '#081230', hor: '#1d2d52', sun: '#9fb4e8', si: 0.75, hs: '#4a5c94', hg: '#1c2030', hi: 1.0 }],
  [-0.04, { top: '#1e2e5c', hor: '#c9746a', sun: '#ff9a6a', si: 0.8, hs: '#7a6a8e', hg: '#2e2a2a', hi: 0.9 }],
  [0.1, { top: '#4774c4', hor: '#f5b27a', sun: '#ffc08a', si: 1.8, hs: '#e0bcaa', hg: '#6a5a46', hi: 1.05 }],
  [0.45, { top: '#3d8fe6', hor: '#bfe2f5', sun: '#fff2dc', si: 2.7, hs: '#d4ebff', hg: '#8aa56a', hi: 1.45 }],
  [1, { top: '#2f7fdc', hor: '#b5dcf3', sun: '#ffffff', si: 2.9, hs: '#dcefff', hg: '#8aa56a', hi: 1.5 }],
];
function skyAt(e) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && e > SKY_KEYS[i + 1][0]) i++;
  const [ea, A] = SKY_KEYS[i], [eb, Bk] = SKY_KEYS[i + 1];
  const t = clamp((e - ea) / (eb - ea), 0, 1);
  const mix = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), t);
  return { top: mix(A.top, Bk.top), hor: mix(A.hor, Bk.hor), sun: mix(A.sun, Bk.sun), si: lerp(A.si, Bk.si, t), hs: mix(A.hs, Bk.hs), hg: mix(A.hg, Bk.hg), hi: lerp(A.hi, Bk.hi, t) };
}
export function hourOf(mode, now = new Date()) {
  if (mode === 'jour') return 13;
  if (mode === 'soir') return 19.6;
  if (mode === 'nuit') return 23;
  return now.getHours() + now.getMinutes() / 60;
}
const sunElev = (h) => Math.sin(((h - 6.5) / 14) * Math.PI) * 0.95 - (h < 6.5 || h > 20.5 ? 0.25 : 0);

// ---------------------------------------------------------------- habitants (instances)
const INDOOR = new Set(['house', 'cottage', 'flats', 'villa', 'bakery', 'spa', 'library', 'theatre', 'clinic', 'hall', 'observatory', 'baths']);
const MAXP = 120;

function peopleMeshes() {
  const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, MAXP); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); return m; };
  const std = () => new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true });
  const shadowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  const parts = {
    torso: mk(new THREE.CapsuleGeometry(0.075, 0.13, 3, 8), std()),
    head: mk(new THREE.IcosahedronGeometry(0.068, 1), std()),
    hair: mk(new THREE.SphereGeometry(0.073, 10, 6, 0, TAU, 0, Math.PI * 0.55).rotateX(-0.35), std()),
    legL: mk(new THREE.BoxGeometry(0.048, 0.17, 0.052).translate(0, -0.085, 0), std()),
    legR: mk(new THREE.BoxGeometry(0.048, 0.17, 0.052).translate(0, -0.085, 0), std()),
    armL: mk(new THREE.CapsuleGeometry(0.02, 0.12, 2, 6).translate(0, -0.07, 0), std()),
    armR: mk(new THREE.CapsuleGeometry(0.02, 0.12, 2, 6).translate(0, -0.07, 0), std()),
    shadow: mk(new THREE.PlaneGeometry(0.3, 0.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
  };
  parts.shadow.renderOrder = 2;
  return parts;
}

// ---------------------------------------------------------------- moteur
export function createTown(canvas, { onLot, onResident, onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 400);
  scene.fog = new THREE.Fog(0xbfe2f5, 60, 160);

  const mats = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, flatShading: true }),
    dim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, color: 0x9a9ca4 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x7d8a99 }),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x0b3a52, emissiveIntensity: 0.4 }),
    ghost: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, opacity: 0.55, flatShading: true }),
    flag: new THREE.MeshStandardMaterial({ color: 0xf97316, side: THREE.DoubleSide, roughness: 0.7 }),
    spin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }),
  };
  const dimSet = { ...mats, solid: mats.dim };
  const ghostSet = { ...mats, solid: mats.ghost, glow: mats.ghost, water: mats.ghost };

  // ciel, mer, lumières
  const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  const seaU = { uTime: { value: 0 }, uNight: { value: 0 }, uEdge: { value: ISLAND + 0.9 }, uShallow: { value: new THREE.Color('#5fd3d8') }, uDeep: { value: new THREE.Color('#1f6fa8') }, uHor: { value: new THREE.Color() }, uFoam: { value: new THREE.Color('#f3fbff') } };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: SEA_VERT, fragmentShader: SEA_FRAG, uniforms: seaU, fog: false }));
  sea.position.y = -0.55;
  scene.add(sea);
  const hemi = new THREE.HemisphereLight(0xcde8ff, 0x6d8a52, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 90 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const world = new THREE.Group(); scene.add(world); // île, rues, nature
  const lotsG = new THREE.Group(); scene.add(lotsG);
  const fxG = new THREE.Group(); scene.add(fxG);
  const smoke = new Particles(260, false), spray = new Particles(320, false), sparks = new Particles(500, true);
  fxG.add(smoke.points, spray.points, sparks.points);
  // pluie : traits qui tombent dans une boîte autour de la caméra
  const RAIN = 900, rainPos = new Float32Array(RAIN * 6), rainSeed = Array.from({ length: RAIN }, () => [Math.random() - 0.5, Math.random(), Math.random() - 0.5]);
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc6d4e4, transparent: true, opacity: 0.5, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false; fxG.add(rain);
  // halos des lampadaires la nuit
  const poolTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,190,110,0.3)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.8, 1.8).rotateX(-Math.PI / 2), poolMat, 400);
  pools.count = 0; pools.renderOrder = 3; pools.frustumCulled = false; scene.add(pools);

  // nuages
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.94 });
  for (let i = 0; i < 12; i++) {
    const k = new Kit();
    const n = 4 + (i % 3);
    for (let j = 0; j < n; j++) k.ball(0.8 + Math.random() * 0.8, (j - n / 2) * 0.9, Math.random() * 0.4, (Math.random() - 0.5) * 0.8, '#ffffff', { sy: 0.65 });
    const m = new THREE.Mesh(mergeGeometries(k.solid), cloudMat);
    const ca = Math.random() * TAU, cr = 18 + Math.random() * 30;
    m.position.set(Math.cos(ca) * cr, 17 + Math.random() * 6, Math.sin(ca) * cr);
    m.scale.setScalar(0.8 + Math.random() * 0.8);
    m.userData.v = 0.4 + Math.random() * 0.5;
    clouds.push(m); scene.add(m);
  }
  // oiseaux
  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
  const wingGeo = new THREE.PlaneGeometry(0.28, 0.07).translate(0.14, 0, 0);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, birdMat), r = new THREE.Mesh(wingGeo, birdMat);
    l.rotation.x = r.rotation.x = -Math.PI / 2; r.scale.x = -1;
    g.add(l, r); g.userData = { l, r, a: Math.random() * TAU, rad: 6 + Math.random() * 8, h: 5 + Math.random() * 3, s: 0.25 + Math.random() * 0.15 };
    birds.push(g); scene.add(g);
  }

  // habitants
  const pm = peopleMeshes();
  Object.values(pm).forEach((m) => scene.add(m));
  const bubbles = [];
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false })); s.visible = false; s.scale.setScalar(0.034); s.renderOrder = 8; scene.add(s); bubbles.push(s); }
  const icons = []; // pièces à collecter, commerces fermés
  const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  selRing.visible = false; scene.add(selRing);
  const lotSel = (() => { const k = new Kit(); const w = LOT + 0.16, t = 0.07; k.box(w, 0.05, t, 0, 0, w / 2, '#ffd166'); k.box(w, 0.05, t, 0, 0, -w / 2, '#ffd166'); k.box(t, 0.05, w, w / 2, 0, 0, '#ffd166'); k.box(t, 0.05, w, -w / 2, 0, 0, '#ffd166'); return new THREE.Mesh(mergeGeometries(k.solid), new THREE.MeshBasicMaterial({ vertexColors: true })); })();
  lotSel.visible = false; scene.add(lotSel);
  const hiMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.35, depthWrite: false });
  const hiGeo = new THREE.PlaneGeometry(LOT, LOT).rotateX(-Math.PI / 2);
  const hiG = new THREE.Group(); scene.add(hiG);

  // ---------------------------------------------------------------- état
  let M = null; // modèle de town.js
  const lotObj = new Map(); // k → { sig, group, spins, flags, smoke, spray, lights, born }
  let worldSig = '';
  let ghost = null;
  const agents = new Map();
  let selected = null, selectedRes = null, follow = null;
  let shadowDirty = true, lastShadow = 0;
  let disposed = false;
  const cam = { tx: 0, tz: 0, dist: 30, th: Math.PI / 4, cur: { tx: 0, tz: 0, dist: 34, th: Math.PI / 4 } };
  let ctxC = null; // contexte de construction

  function buildCtx(m, b, rnd) {
    const th = T.THEMES[m.theme], pal = T.PALETTES[m.palette];
    const wet = m.dom.water;
    const grass = new THREE.Color(th.dry).lerp(new THREE.Color(th.grass), smooth(0.2, 0.7, wet)).getStyle();
    const ci = b ? (b.color || 0) : 0;
    return { th, lotGrass: grass, wall: b && b.color >= 4 ? T.COLORS[ci] : pal.walls[ci % 4], roof: pal.roofs[(ci + (b ? b.i + b.j : 0)) % 4], lvl: b?.lvl || 1, state: b?.state || 'ok', vit: m.vitality, flag: m.flag, r: rnd };
  }

  function makeLot(b, m, matSet = null) {
    const rnd = T.rng(b.i * 131 + b.j * 17 + (b.color || 0) * 7 + (b.lvl || 1) * 3);
    const k = new Kit();
    const c = buildCtx(m, b, rnd);
    (B[b.b] || B.park)(k, c, rnd);
    const g = k.mesh(matSet || (b.state === 'low' ? dimSet : mats));
    const spins = k.spin.map((s) => { const sm = s.kit.mesh({ ...mats, solid: matSet ? mats.ghost : mats.spin }); sm.position.set(...s.p); sm.children.forEach((x) => (x.castShadow = false)); g.add(sm); return { obj: sm, axis: s.axis, speed: s.speed }; });
    const flags = k.flags.map((p) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2, 4, 1).translate(0.16, -0.1, 0), matSet ? mats.ghost : mats.flag); f.position.set(...p); g.add(f); return f; });
    return { group: g, spins, flags, smoke: k.smoke, spray: k.spray, lights: k.lights };
  }
  const place = (obj, b) => { const [x, z] = lotXZ(b.i, b.j); obj.position.set(x, 0, z); obj.rotation.y = (b.rot || 0) * (Math.PI / 2); };
  const toWorld = (b, lx, lz) => { const a = (b.rot || 0) * (Math.PI / 2), [x, z] = lotXZ(b.i, b.j); return [x + lx * Math.cos(a) + lz * Math.sin(a), z - lx * Math.sin(a) + lz * Math.cos(a)]; };

  function buildWorld(m) {
    world.children.slice().forEach((o) => { world.remove(o); o.traverse?.((x) => x.geometry?.dispose()); });
    const th = T.THEMES[m.theme];
    const c = buildCtx(m, null, T.rng(7));
    // île : dessus en herbe, falaise de terre, plage
    const shape = (s, r) => { const sh = new THREE.Shape(); sh.moveTo(-s + r, -s); sh.lineTo(s - r, -s); sh.quadraticCurveTo(s, -s, s, -s + r); sh.lineTo(s, s - r); sh.quadraticCurveTo(s, s, s - r, s); sh.lineTo(-s + r, s); sh.quadraticCurveTo(-s, s, -s, s - r); sh.lineTo(-s, -s + r); sh.quadraticCurveTo(-s, -s, -s + r, -s); return sh; };
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(ISLAND, 3), { depth: 0.9, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, -0.9, 0), [new THREE.MeshStandardMaterial({ color: c.lotGrass, roughness: 0.95, flatShading: true }), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1, flatShading: true })]);
    top.receiveShadow = true; world.add(top);
    const beach = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(ISLAND + 1.1, 3.8), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.5, bevelSegments: 2, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, -0.72, 0), new THREE.MeshStandardMaterial({ color: th.sand, roughness: 1, flatShading: true }));
    beach.receiveShadow = true; world.add(beach);
    // rues pavées autour des parcelles ouvertes
    const k = new Kit();
    const R = m.radius, ext = (R + 0.5) * P;
    for (let a = -R - 1; a <= R; a++) {
      const o = (a + 0.5) * P;
      k.box(ext * 2 + 0.6, 0.02, 0.6, 0, 0, o, '#a39b8f');
      k.box(0.6, 0.021, ext * 2 + 0.6, o, 0, 0, '#a39b8f');
    }
    for (let a = -R - 1; a <= R; a++) for (let b = -R - 1; b <= R; b++) {
      const x = (a + 0.5) * P, z = (b + 0.5) * P;
      k.box(0.6, 0.024, 0.6, x, 0, z, '#b3ab9f');
      if ((a + b) % 2 === 0) lamp(k, x + 0.36, z + 0.36, 0);
    }
    // nature autour : forêt sur les parcelles pas encore débloquées et sur le bord de l'île
    const rnd = T.rng(99 + R);
    for (let i = 0; i < T.GRID; i++) for (let j = 0; j < T.GRID; j++) {
      if (Math.abs(i - T.C) <= R && Math.abs(j - T.C) <= R) continue;
      const [x, z] = lotXZ(i, j);
      const n = 3 + Math.floor(rnd() * 3);
      for (let t = 0; t < n; t++) tree(k, c, x + (rnd() - 0.5) * 2.4, z + (rnd() - 0.5) * 2.4, 0.9 + rnd() * 0.6, rnd);
      if (rnd() < 0.5) k.ball(0.15 + rnd() * 0.2, x + (rnd() - 0.5) * 2, 0.02, z + (rnd() - 0.5) * 2, '#8b8f96', { det: 0, sy: 0.6 });
      if (rnd() < 0.6) bush(k, c, x + (rnd() - 0.5) * 2, z + (rnd() - 0.5) * 2, 1, 0);
    }
    for (let t = 0; t < 90; t++) {
      const a = rnd() * TAU, s = HALF + 0.4 + rnd() * 1.4;
      const x = clamp(Math.cos(a) * s * 1.5, -ISLAND + 0.6, ISLAND - 0.6), z = clamp(Math.sin(a) * s * 1.5, -ISLAND + 0.6, ISLAND - 0.6);
      if (Math.max(Math.abs(x), Math.abs(z)) < HALF + 0.3) continue;
      tree(k, c, x, z, 0.8 + rnd() * 0.6, rnd);
    }
    // ponton et bateau
    k.box(0.7, 0.08, 3.2, 0, -0.12, ISLAND + 1.8, C.wood);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.cyl(0.05, 0.6, s * 0.32, -0.6, ISLAND + 0.6 + i, C.wood, { seg: 6 });
    k.box(0.5, 0.25, 1.3, 1.0, -0.5, ISLAND + 2.8, '#f8fafc'); k.box(0.42, 0.05, 1.2, 1.0, -0.26, ISLAND + 2.8, '#a16207');
    k.cyl(0.025, 1.3, 1.0, -0.25, ISLAND + 2.75, '#e5e7eb', { seg: 5 }); k.box(0.02, 0.8, 0.6, 1.0, 0.15, ISLAND + 2.95, '#f8fafc');
    const g = k.mesh(mats);
    world.add(g);
    world.userData.lights = k.lights;
    shadowDirty = true;
  }

  function signOf(b, m) { return [b.b, b.rot, b.color, b.lvl, b.state, m.theme, m.palette, b.b === 'hall' ? m.flag : '', /flowers|park|statue|cottage|house|spa|pond/.test(b.b) ? (m.vitality >= 55) : '', Math.round(m.dom.water * 10)].join('|'); }

  function sync(m) {
    const prev = M;
    M = m;
    const ws = [m.radius, m.theme, Math.round(m.dom.water * 10)].join('|');
    if (ws !== worldSig) { worldSig = ws; buildWorld(m); }
    const seen = new Set();
    for (const b of m.buildings) {
      seen.add(b.k);
      const sig = signOf(b, m);
      const cur = lotObj.get(b.k);
      if (cur && cur.sig === sig && cur.pos === `${b.i},${b.j},${b.rot}`) continue;
      if (cur) { lotsG.remove(cur.group); disposeGroup(cur.group); }
      const o = makeLot(b, m);
      o.sig = sig; o.pos = `${b.i},${b.j},${b.rot}`; o.b = b;
      o.born = prev && (!cur || cur.b.lvl !== b.lvl || cur.b.b !== b.b) ? performance.now() : 0;
      place(o.group, b);
      lotsG.add(o.group);
      lotObj.set(b.k, o);
      if (o.born) burst(b, cur && cur.b.b === b.b ? 'up' : 'new');
    }
    for (const [k, o] of lotObj) if (!seen.has(k)) { lotsG.remove(o.group); disposeGroup(o.group); lotObj.delete(k); }
    // parcelles libres (gazon) : un maillage pour toutes
    const free = new Kit();
    const cg = buildCtx(m, null, Math.random);
    for (const k of m.free) {
      const [i, j] = T.parse(k), [x, z] = lotXZ(i, j);
      free.box(LOT, 0.06, LOT, x, 0, z, cg.lotGrass); free.box(LOT + 0.04, 0.04, LOT + 0.04, x, 0, z, C.stone);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) free.box(0.04, 0.16, 0.04, x + a * 1.05, 0.06, z + b * 1.05, '#c08a52');
      const fr = T.rng(i * 37 + j);
      for (let t = 0; t < 7; t++) free.cone(0.05, 0.1 + fr() * 0.08, x + (fr() - 0.5) * 2, 0.06, z + (fr() - 0.5) * 2, cg.th.snow ? '#dfe7ee' : '#5f9f45', { seg: 4 });
      if (fr() < 0.5) free.ball(0.03, x + (fr() - 0.5) * 1.8, 0.09, z + (fr() - 0.5) * 1.8, ['#facc15', '#f472b6', '#ffffff'][Math.floor(fr() * 3)], { det: 0 });
    }
    const old = lotsG.getObjectByName('free');
    if (old) { lotsG.remove(old); disposeGroup(old); }
    if (m.free.length) { const fg = free.mesh(mats); fg.name = 'free'; lotsG.add(fg); }
    syncAgents(m);
    shadowDirty = true;
    flagColor();
    // halos : lampadaires des rues et des parcelles
    let n = 0;
    const put = (x, z, y) => { if (n < 400) { _pm.makeTranslation(x, Math.max(0.03, y - 0.645) + n * 0.00002, z); pools.setMatrixAt(n++, _pm); } };
    for (const p of world.userData.lights || []) put(p[0], p[2], p[1]);
    for (const o of lotObj.values()) { const r = o.group.rotation.y, px = o.group.position.x, pz = o.group.position.z; for (const p of o.lights) put(px + p[0] * Math.cos(r) + p[2] * Math.sin(r), pz - p[0] * Math.sin(r) + p[2] * Math.cos(r), p[1]); }
    pools.count = n; pools.instanceMatrix.needsUpdate = true;
  }
  const _pm = new THREE.Matrix4();
  const flagColor = () => mats.flag.color.set(M?.flag || '#f97316');
  function disposeGroup(g) { g.traverse((x) => { if (x.geometry && !Object.values(UNIT).includes(x.geometry)) x.geometry.dispose(); }); }

  function burst(b, kind) {
    const [x, z] = lotXZ(b.i, b.j);
    for (let i = 0; i < (kind === 'up' ? 70 : 40); i++) {
      const a = Math.random() * TAU, s = 0.6 + Math.random() * 1.2;
      if (kind === 'up') sparks.spawn(x + Math.cos(a) * 0.9, 0.3 + Math.random() * 1.5, z + Math.sin(a) * 0.9, Math.cos(a) * 0.3, 1 + Math.random(), Math.sin(a) * 0.3, 1.2, 0.12, 0.02, ['#ffd166', '#fff3b0', '#34d399'][i % 3], 1, 0.8);
      else smoke.spawn(x + Math.cos(a) * 1.1, 0.1, z + Math.sin(a) * 1.1, Math.cos(a) * s, 0.3, Math.sin(a) * s, 1.1, 0.3, 0.9, '#e8dcc6', 0.8, 0, 2.5);
    }
  }

  // ---------------------------------------------------------------- déplacements des habitants
  const R = () => M.radius;
  const lineVals = () => { const out = []; for (let a = -R() - 1; a <= R(); a++) out.push((a + 0.5) * P); return out; };
  const nearestLine = (v) => lineVals().reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const byKey = (k) => M.buildings.find((b) => b.k === k);
  function doorOf(b) { // point de la rue devant la façade
    const [x, z] = lotXZ(b.i, b.j), [fx, fz] = FRONT[b.rot || 0];
    return [x + fx * (P / 2), z + fz * (P / 2)];
  }
  function roadPath(a, b) {
    // a, b sont sur des lignes de rue : on passe par les carrefours
    const onX = (p) => Math.abs(nearestLine(p[0]) - p[0]) < 0.05; // sur une rue nord-sud
    const onZ = (p) => Math.abs(nearestLine(p[1]) - p[1]) < 0.05;
    const corner = (p, toward) => onX(p) && onZ(p) ? p : onX(p) ? [p[0], nearestLine(p[1] + Math.sign(toward[1] - p[1] || 1) * (P / 2))] : [nearestLine(p[0] + Math.sign(toward[0] - p[0] || 1) * (P / 2)), p[1]];
    const ca = corner(a, b), cb = corner(b, a);
    const pts = [a, ca, [cb[0], ca[1]], cb, b];
    return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.01);
  }
  function spotIn(b) {
    const r = Math.random;
    const id = b.b;
    let lx = (r() - 0.5) * 1.6, lz = 0.55 + r() * 0.45;
    if (id === 'pool') { lx = (r() - 0.5) * 1.4; lz = -0.15 + (r() - 0.5) * 1.0; }
    else if (/park|flowers|playground|zen|statue|fountain|bandstand/.test(id)) { lx = (r() - 0.5) * 1.9; lz = (r() - 0.5) * 1.9; if (id === 'fountain' || id === 'bandstand' || id === 'statue') { const a = r() * TAU; lx = Math.sin(a) * 0.92; lz = Math.cos(a) * 0.92; } }
    else if (id === 'market') { lx = (r() - 0.5) * 1.8; lz = 0.25 + r() * 0.7; }
    else if (id === 'cafe') { lx = (r() - 0.5) * 1.6; lz = 0.4 + r() * 0.7; }
    else if (INDOOR.has(id)) { lx = 0; lz = 0.62; }
    return toWorld(b, lx, lz);
  }
  function activityOf(b, hour) {
    if (!b) return 'idle';
    if (b.b === 'pool') return 'swim';
    if (b.b === 'stadium') return 'jog';
    if (b.b === 'gym') return 'exercise';
    if (b.b === 'playground') return 'jump';
    if (b.b === 'bandstand' && M.events.some((e) => e.id === 'concert') && (hour > 17 || M.time !== 'reel')) return 'dance';
    if (INDOOR.has(b.b)) return 'inside';
    return 'idle';
  }
  function chooseDest(a, hour) {
    const r = a.r, cands = [];
    const add = (b, w) => { if (b && w > 0) cands.push([b, w]); };
    const night = hour >= 22.5 || hour < 6;
    const home = byKey(r.home), work = r.work ? byKey(r.work) : null;
    add(home, night ? 14 : hour > 19 ? 3 : 1);
    if (work && hour >= 8 && hour < 18 && work.k !== r.home) add(work, 4);
    for (const b of M.buildings) {
      if (b.def.dom === r.fav) add(b, night ? 0.3 : 3 * (0.4 + M.dom[r.fav]));
      else if (b.def.kind === 'deco' || b.b === 'fountain') add(b, night ? 0.1 : 1.2);
      else if (b.b === 'cafe') add(b, (hour > 11.5 && hour < 14) || (hour > 17 && hour < 21) ? 3 : 1);
      else if (b.def.kind !== 'home') add(b, night ? 0.05 : 0.5);
      else add(b, 0.25);
    }
    let sum = cands.reduce((s, c) => s + c[1], 0), x = Math.random() * sum;
    for (const [b, w] of cands) { x -= w; if (x <= 0) return b; }
    return home;
  }
  function loopPath(from) { // tour d'un pâté de maisons (club de course, promenade)
    const xs = lineVals();
    const a = Math.floor(Math.random() * (xs.length - 1)), b = Math.floor(Math.random() * (xs.length - 1));
    const sq = [[xs[a], xs[b]], [xs[a + 1], xs[b]], [xs[a + 1], xs[b + 1]], [xs[a], xs[b + 1]]];
    const start = roadPath(from, sq[0]);
    return [...start, ...sq.slice(1), sq[0], ...sq.slice(1), sq[0]];
  }

  function syncAgents(m) {
    const ids = new Set(m.residents.map((r) => r.id));
    for (const id of [...agents.keys()]) if (!ids.has(id)) agents.delete(id);
    const hour = hourOf(m.time);
    for (const r of m.residents.slice(0, MAXP)) {
      const a = agents.get(r.id);
      if (a) { a.r = r; if (!byKey(a.at)) a.at = r.home; continue; }
      const home = byKey(r.home);
      // au démarrage, chacun est déjà quelque part en ville
      const b = Math.random() < 0.55 ? chooseDest({ r }, hour) : home;
      const out = b && !INDOOR.has(b.b);
      const [x, z] = out ? spotIn(b) : doorOf(b || home);
      agents.set(r.id, { r, x, z, y: 0.02, hd: Math.random() * TAU, path: [], mode: out ? 'act' : 'wait', act: activityOf(b, hour), at: b?.k || r.home, t: 2 + Math.random() * 8, ph: Math.random() * TAU, chat: null, cool: Math.random() * 5, vis: 1, bub: null, bubT: 0, jog: 0 });
    }
  }

  function startTrip(a, hour) {
    const from = byKey(a.at);
    const start = from ? doorOf(from) : [a.x, a.z];
    const pre = from && Math.hypot(a.x - start[0], a.z - start[1]) > 0.05 ? [[a.x, a.z]] : [];
    const jogger = M.events.some((e) => e.id === 'run') && (a.r.fav === 'move' || a.r.id % 4 === 0) && hour > 6.5 && hour < 21 && Math.random() < 0.5;
    const walk = !jogger && Math.random() < 0.08 + 0.1 * (M.dom.move || 0);
    if (jogger || walk) {
      a.path = [...pre, ...loopPath(start), start];
      a.jog = jogger ? 1 : 0;
      a.dest = from || byKey(a.r.home);
    } else {
      const b = chooseDest(a, hour);
      const d = doorOf(b);
      a.path = [...pre, ...roadPath(start, d), spotIn(b)];
      a.dest = b; a.jog = 0;
    }
    a.mode = 'walk';
    a.vis = 1;
  }

  const BUB_GOOD = ['😄', '👋', '💬', '😂', '❤️', '🎉', '👍', '☀️'];
  const BUB_BAD = ['😕', '💬', '😓', '🙁'];
  function topicEmoji() {
    const d = M.dom, keys = Object.keys(d);
    const k = keys[Math.floor(Math.random() * keys.length)];
    const good = { move: '🏃', food: '🥦', sleep: '😌', water: '💧', mood: '😊' }, bad = { move: '🛋️', food: '🍟', sleep: '🥱', water: '🥵', mood: '😞' };
    return d[k] >= 0.6 ? good[k] : d[k] < 0.4 ? bad[k] : '💬';
  }
  function say(a, e, dur = 2.2) { a.bub = e; a.bubT = dur; }

  function stepAgents(dt, hour) {
    const list = [...agents.values()];
    const night = hour >= 22.5 || hour < 6;
    const speedK = 0.55 + 0.6 * (M.dom.move ?? 0.5);
    for (const a of list) {
      a.cool -= dt; a.ph += dt;
      if (a.bubT > 0) a.bubT -= dt;
      if (a.mode === 'chat') {
        a.t -= dt;
        const o = agents.get(a.chat);
        if (o) a.hd = Math.atan2(o.x - a.x, o.z - a.z);
        if (a.bubT <= 0 && Math.random() < dt * 1.4) say(a, Math.random() < 0.35 ? topicEmoji() : a.r.happy >= 50 ? BUB_GOOD[Math.floor(Math.random() * BUB_GOOD.length)] : BUB_BAD[Math.floor(Math.random() * BUB_BAD.length)], 1.6);
        if (a.t <= 0) { a.mode = 'walk'; a.chat = null; a.cool = 12 + Math.random() * 10; }
        continue;
      }
      if (a.mode === 'walk') {
        const tgt = a.path[0];
        if (!tgt) { arrive(a, hour); continue; }
        const dx = tgt[0] - a.x, dz = tgt[1] - a.z, d = Math.hypot(dx, dz);
        const sp = (a.jog ? 1.25 : 0.42) * a.r.speed * speedK * (a.r.happy < 40 ? 0.8 : 1);
        if (d < 0.02 + sp * dt) { a.x = tgt[0]; a.z = tgt[1]; a.path.shift(); continue; }
        const want = Math.atan2(dx, dz);
        let dh = ((want - a.hd + Math.PI * 3) % TAU) - Math.PI;
        a.hd += dh * Math.min(1, dt * 10);
        a.x += (dx / d) * sp * dt; a.z += (dz / d) * sp * dt;
        a.walkPh = (a.walkPh || 0) + dt * sp * (a.jog ? 13 : 16);
        continue;
      }
      if (a.mode === 'act' || a.mode === 'inside' || a.mode === 'wait') {
        a.t -= dt;
        if (a.mode === 'inside') a.vis = Math.max(0, a.vis - dt * 3);
        if (a.mode === 'act' && a.act === 'idle' && Math.random() < dt * 0.3) a.hd += (Math.random() - 0.5) * 1.5;
        if (a.mode === 'act' && a.bubT <= 0 && Math.random() < dt * 0.04) say(a, a.r.happy >= 55 ? ['😌', '🎵', '☀️', '🙂'][Math.floor(Math.random() * 4)] : ['😴', '🥵', '😕'][Math.floor(Math.random() * 3)]);
        if (a.t <= 0) {
          if (night && a.mode === 'inside' && a.at === a.r.home && Math.random() < 0.85) { a.t = 20 + Math.random() * 30; continue; }
          a.vis = 1;
          startTrip(a, hour);
        }
      }
    }
    // rencontres : deux passants proches s'arrêtent pour discuter
    const chatty = 0.25 + 0.75 * (M.dom.mood ?? 0.5);
    const walkers = list.filter((a) => a.mode === 'walk' && a.cool <= 0 && !a.jog);
    for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i], b = walkers[j];
      if (a.mode !== 'walk' || b.mode !== 'walk') continue;
      if (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.z - b.z) > 0.5) continue;
      if (Math.random() > chatty) { a.cool = b.cool = 6; continue; }
      const t = 3.5 + Math.random() * 3 + chatty * 2;
      a.mode = b.mode = 'chat'; a.chat = b.r.id; b.chat = a.r.id; a.t = b.t = t;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1;
      a.x = mx + (dx / d) * 0.13; a.z = mz + (dz / d) * 0.13; b.x = mx - (dx / d) * 0.13; b.z = mz - (dz / d) * 0.13;
      say(a, '👋', 1.2);
    }
  }
  function arrive(a, hour) {
    const b = a.dest;
    a.at = b?.k || a.r.home;
    a.jog = 0;
    a.act = activityOf(b, hour);
    if (a.act === 'inside') { a.mode = 'inside'; a.t = (b?.k === a.r.home ? 14 : 8) + Math.random() * 16; }
    else { a.mode = 'act'; a.t = 7 + Math.random() * 12; if (a.act === 'jog') a.lap = Math.random() * TAU; }
  }

  // ---------------------------------------------------------------- dessin des habitants
  const _M = new THREE.Matrix4(), _B = new THREE.Matrix4(), _P = new THREE.Matrix4(), _R = new THREE.Matrix4(), _col = new THREE.Color(), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _Z = new THREE.Matrix4();
  const groundY = (x, z) => { const i = Math.round(x / P), j = Math.round(z / P); return Math.abs(x - i * P) < LOT / 2 && Math.abs(z - j * P) < LOT / 2 ? 0.08 : 0.02; };
  function drawAgents(time) {
    let n = 0;
    let bi = 0;
    for (const a of agents.values()) {
      if (n >= MAXP) break;
      let y = groundY(a.x, a.z), legA = 0, armA = 0, spread = 0.08, bob = 0, lean = 0, armUp = 0, x = a.x, z = a.z, hd = a.hd;
      const vis = a.mode === 'inside' ? a.vis : 1;
      if (a.mode === 'walk') { const s = Math.sin(a.walkPh || 0); legA = s * (a.jog ? 0.9 : 0.55); armA = -s * (a.jog ? 0.9 : 0.45); bob = Math.abs(Math.cos(a.walkPh || 0)) * (a.jog ? 0.035 : 0.015); lean = a.jog ? 0.2 : a.r.happy < 40 ? 0.12 : 0; }
      else if (a.mode === 'chat') { armUp = Math.max(0, Math.sin(time * 5 + a.r.id)) * 0.9; bob = Math.abs(Math.sin(time * 3 + a.r.id)) * 0.006; }
      else if (a.mode === 'act') {
        if (a.act === 'swim') { y = -0.05; armA = Math.sin(time * 4 + a.r.id) * 2.2; legA = 0; lean = 1.3; x += Math.sin(time * 0.4 + a.r.id) * 0.25; }
        else if (a.act === 'exercise') { const s = Math.sin(time * 6 + a.r.id); bob = Math.max(0, s) * 0.07; spread = 0.08 + Math.max(0, s) * 2.2; }
        else if (a.act === 'jump') { bob = Math.abs(Math.sin(time * 5 + a.r.id)) * 0.12; armUp = 1.2; }
        else if (a.act === 'dance') { bob = Math.abs(Math.sin(time * 6 + a.r.id)) * 0.04; armUp = 1 + Math.sin(time * 6) * 0.8; hd += Math.sin(time * 2 + a.r.id) * 0.8; }
        else if (a.act === 'jog') {
          const b = byKey(a.at);
          if (b) { a.lap += 0.0 + 0.016 * (0.6 + (M.dom.move ?? 0.5)); const [cx, cz] = lotXZ(b.i, b.j); x = cx + Math.sin(a.lap) * 1.0; z = cz - 0.05 + Math.cos(a.lap) * 0.82; hd = a.lap + Math.PI / 2; a.x = x; a.z = z; }
          const s = Math.sin(time * 12 + a.r.id); legA = s * 0.9; armA = -s * 0.9; bob = Math.abs(Math.cos(time * 12)) * 0.03; lean = 0.2;
        }
      }
      const sc = 0.82 * a.r.h * (0.001 + vis);
      _B.makeRotationY(hd); _B.setPosition(x, y + bob, z);
      _M.makeScale(sc, sc, sc); _B.multiply(_M);
      _R.makeRotationX(lean); _B.multiply(_R);
      const setPart = (mesh, local, color) => { _P.multiplyMatrices(_B, local); mesh.setMatrixAt(n, vis < 0.02 ? _zero : _P); if (color) mesh.setColorAt(n, _col.set(color)); };
      setPart(pm.torso, _M.makeTranslation(0, 0.3, 0), a.r.shirt);
      setPart(pm.head, _M.makeTranslation(0, 0.47, 0), a.r.skin);
      setPart(pm.hair, a.r.bald ? _zero : _M.makeTranslation(0, 0.48, -0.005), a.r.hair);
      const leg = (s, ang) => _M.makeTranslation(s * 0.04, 0.18, 0).multiply(_R.makeRotationX(ang));
      setPart(pm.legL, leg(-1, legA), a.r.pants);
      setPart(pm.legR, leg(1, -legA), a.r.pants);
      const arm = (s, ang, up) => _M.makeTranslation(s * 0.098, 0.39, 0).multiply(_R.makeRotationX(ang - up * 1.6)).multiply(_Z.makeRotationZ(s * spread));
      setPart(pm.armL, arm(-1, armA, a.mode === 'chat' ? 0 : armUp), a.r.shirt);
      setPart(pm.armR, arm(1, -armA, armUp), a.r.shirt);
      _P.makeTranslation(x, y + 0.006, z); pm.shadow.setMatrixAt(n, vis < 0.5 || a.act === 'swim' && a.mode === 'act' ? _zero : _P);
      if (a.bubT > 0 && a.bub && bi < bubbles.length && vis > 0.5) {
        const s = bubbles[bi++];
        s.material.map = emojiTex(a.bub, true); s.material.needsUpdate = s.userData.e !== a.bub; s.userData.e = a.bub;
        s.position.set(x, y + 0.75 * a.r.h + Math.sin(time * 3) * 0.01, z);
        s.material.opacity = Math.min(1, a.bubT * 3);
        s.visible = true;
      }
      if (selectedRes === a.r.id) { selRing.visible = vis > 0.3; selRing.position.set(x, y + 0.02, z); selRing.scale.setScalar(1 + Math.sin(time * 5) * 0.12); }
      a.sx = x; a.sz = z; a.sy = y;
      n++;
    }
    for (; bi < bubbles.length; bi++) bubbles[bi].visible = false;
    for (const m of Object.values(pm)) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    if (selectedRes != null && !agents.has(selectedRes)) selRing.visible = false;
  }

  // ---------------------------------------------------------------- icônes (pièces, fermé)
  let iconSig = '';
  function syncIcons(ready = []) {
    const sig = ready.join(';') + '|' + M.buildings.filter((b) => b.state === 'low' && b.def.kind !== 'home' && b.def.kind !== 'deco').map((b) => b.k).join(';');
    if (sig === iconSig) return;
    iconSig = sig;
    icons.forEach((s) => { scene.remove(s); s.material.dispose(); });
    icons.length = 0;
    const add = (b, e, h) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e, false), depthWrite: false, transparent: true, sizeAttenuation: false })); const [x, z] = lotXZ(b.i, b.j); s.position.set(x, h, z); s.scale.setScalar(0.026); s.userData = { y: h, k: b.k }; s.renderOrder = 9; scene.add(s); icons.push(s); };
    for (const b of M.buildings) {
      if (ready.includes(b.k)) add(b, '🪙', 2.6);
      else if (b.state === 'low' && b.def.kind !== 'home' && b.def.kind !== 'deco') add(b, '💤', 2.3);
    }
  }

  // ---------------------------------------------------------------- caméra et gestes
  const ptrs = new Map();
  let gesture = null, vel = { x: 0, z: 0 }, downAt = 0, moved = 0;
  const camDir = () => { const t = cam.cur.th; return { fx: -Math.sin(t), fz: -Math.cos(t), rx: Math.cos(t), rz: -Math.sin(t) }; };
  function panBy(dx, dy) {
    const k = cam.dist * 0.0021;
    const { fx, fz, rx, rz } = camDir();
    cam.tx = clamp(cam.tx - (dx * rx - dy * fx) * k, -HALF, HALF);
    cam.tz = clamp(cam.tz - (dx * rz - dy * fz) * k, -HALF, HALF);
  }
  const onDown = (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { downAt = performance.now(); moved = 0; vel = { x: 0, z: 0 }; follow = null; }
    gesture = null;
  };
  const onMove = (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const nx = e.clientX, ny = e.clientY;
    if (ptrs.size === 1) {
      const dx = nx - p.x, dy = ny - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      panBy(dx, dy);
      vel = { x: dx, z: dy };
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const before = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      p.x = nx; p.y = ny;
      const [a2, b2] = [...ptrs.values()];
      const after = { d: Math.hypot(a2.x - b2.x, a2.y - b2.y), ang: Math.atan2(b2.y - a2.y, b2.x - a2.x), mx: (a2.x + b2.x) / 2, my: (a2.y + b2.y) / 2 };
      if (before.d > 10) cam.dist = clamp(cam.dist * (before.d / after.d), 7, 52);
      let da = after.ang - before.ang;
      if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      cam.th -= da;
      panBy(after.mx - before.mx, after.my - before.my);
      moved += 20;
      return;
    }
    p.x = nx; p.y = ny;
  };
  const onUp = (e) => {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0 && p && moved < 10 && performance.now() - downAt < 500) tap(e.clientX, e.clientY);
    if (ptrs.size === 0 && moved < 10) vel = { x: 0, z: 0 };
  };
  const onWheel = (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 7, 52); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.style.touchAction = 'none';

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), hit = new THREE.Vector3(), proj = new THREE.Vector3();
  function tap(cx, cy) {
    const rc = canvas.getBoundingClientRect();
    const px = cx - rc.left, py = cy - rc.top;
    // habitant le plus proche du doigt
    let best = null, bd = 30;
    for (const a of agents.values()) {
      if (a.mode === 'inside' && a.vis < 0.5) continue;
      proj.set(a.sx ?? a.x, (a.sy ?? 0) + 0.3, a.sz ?? a.z).project(camera);
      if (proj.z > 1) continue;
      const sx = (proj.x * 0.5 + 0.5) * rc.width, sy = (-proj.y * 0.5 + 0.5) * rc.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { onResident?.(best.r.id); return; }
    ndc.set((px / rc.width) * 2 - 1, -(py / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // d'abord un bâtiment touché en hauteur, sinon la parcelle au sol
    const hits = ray.intersectObjects(lotsG.children, true);
    for (const h of hits) {
      let o = h.object; while (o && o.parent !== lotsG) o = o.parent;
      if (o && o.name !== 'free') for (const [k, v] of lotObj) if (v.group === o) { onLot?.(k); return; }
    }
    if (ray.ray.intersectPlane(plane, hit)) {
      const i = Math.round(hit.x / P) + T.C, j = Math.round(hit.z / P) + T.C;
      if (i >= 0 && j >= 0 && i < T.GRID && j < T.GRID && Math.abs(hit.x - (i - T.C) * P) < P / 2 && Math.abs(hit.z - (j - T.C) * P) < P / 2) onLot?.(T.key(i, j));
      else onLot?.(null);
    }
  }

  // ---------------------------------------------------------------- boucle
  let last = performance.now(), raf = 0, frames = 0, slowT = 0, simT = 0;
  const resize = () => {
    const w = canvas.clientWidth || 360, h = canvas.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const s = (renderer.getDrawingBufferSize(new THREE.Vector2()).y) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const p of [smoke, spray, sparks]) p.mat.uniforms.uScale.value = s;
  };
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  resize();

  let lastLight = -1;
  function light(hour, force) {
    if (!force && Math.abs(hour - lastLight) < 0.02) return;
    lastLight = hour;
    const e = sunElev(hour);
    const L = skyAt(e);
    const w = M?.weather || 'soleil';
    const cloud = w.startsWith('pluie') ? 0.85 : w.startsWith('nuages') ? 0.4 : 0.05;
    const mist = w.includes('brume') ? 1 : 0;
    const grey = new THREE.Color('#8e99a6').multiplyScalar(0.25 + 0.75 * smooth(-0.2, 0.3, e));
    const top = L.top.clone().lerp(grey, cloud * 0.75), hor = L.hor.clone().lerp(grey.clone().multiplyScalar(1.15), cloud * 0.7);
    if (mist) hor.lerp(new THREE.Color('#c8c2d4').multiplyScalar(0.3 + 0.7 * smooth(-0.2, 0.3, e)), 0.6);
    skyU.uTop.value.copy(top); skyU.uHor.value.copy(hor); skyU.uSunCol.value.copy(L.sun); skyU.uCloud.value = cloud;
    const night = smooth(0.08, -0.15, e);
    skyU.uNight.value = night;
    seaU.uNight.value = night * 0.85; seaU.uHor.value.copy(hor);
    scene.fog.color.copy(hor);
    scene.fog.near = mist ? 18 : 60; scene.fog.far = mist ? 80 : 180;
    // soleil le jour, lune la nuit
    const az = ((hour - 6) / 14) * Math.PI;
    const el = Math.max(0.18, Math.abs(e));
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el) + 0.35, Math.sin(el), Math.sin(az) * Math.cos(el) * 0.6 + 0.55).normalize(); // de face pour la caméra par défaut
    skyU.uSunDir.value.copy(e > -0.05 ? dir : new THREE.Vector3(-dir.x, dir.y, -dir.z));
    sun.position.copy(dir).multiplyScalar(40);
    sun.color.copy(L.sun);
    sun.intensity = L.si * (1 - cloud * 0.55);
    hemi.color.copy(L.hs); hemi.groundColor.copy(L.hg); hemi.intensity = L.hi * (1 + cloud * 0.15);
    mats.glow.color.setRGB(lerp(0.5, 1.15, night), lerp(0.58, 1.1, night), lerp(0.68, 1.0, night));
    cloudMat.color.set(cloud > 0.6 ? '#9aa3ae' : '#ffffff').multiplyScalar(0.35 + 0.65 * smooth(-0.2, 0.3, e));
    renderer.toneMappingExposure = 1.08 + night * 0.25;
    shadowDirty = true;
    return night;
  }

  let nightK = 0, fwT = 0, insetCur = 0, insetWant = 0;
  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden || !M) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; simT += dt;
    frames++;
    // qualité adaptative : on baisse la résolution si le téléphone peine
    slowT = slowT * 0.95 + dt * 0.05;
    if (frames % 90 === 0 && slowT > 0.034 && dpr > 1) { dpr = Math.max(1, dpr - 0.35); renderer.setPixelRatio(dpr); resize(); }

    const hour = hourOf(M.time);
    if (frames % 30 === 1) nightK = light(hour) ?? nightK;
    // caméra : inertie, suivi, interpolation douce
    if (!ptrs.size && (Math.abs(vel.x) + Math.abs(vel.z)) > 0.2) { panBy(vel.x, vel.z); vel.x *= 0.9; vel.z *= 0.9; }
    if (follow != null) { const a = agents.get(follow); if (a) { cam.tx = a.sx ?? a.x; cam.tz = a.sz ?? a.z; } }
    const c = cam.cur, k = Math.min(1, dt * 7);
    c.tx = lerp(c.tx, cam.tx, k); c.tz = lerp(c.tz, cam.tz, k); c.dist = lerp(c.dist, cam.dist, k); c.th = lerp(c.th, cam.th, k);
    const tilt = lerp(0.62, 0.98, smooth(7, 45, c.dist)); // de près : vue plus rasante
    camera.position.set(c.tx + Math.sin(c.th) * Math.sin(tilt) * c.dist, Math.cos(tilt) * c.dist + 0.3, c.tz + Math.cos(c.th) * Math.sin(tilt) * c.dist);
    camera.lookAt(c.tx, 0.4, c.tz);
    // panneau ouvert en bas : le centre de la vue remonte dans la partie visible
    insetCur = lerp(insetCur, insetWant, k);
    if (Math.abs(insetCur) > 0.5) { const w = canvas.clientWidth, h = canvas.clientHeight; camera.setViewOffset(w, h + insetCur, 0, insetCur, w, h); } else camera.clearViewOffset();
    sky.position.copy(camera.position);

    stepAgents(dt, hour);
    drawAgents(simT);

    // animations des bâtiments
    for (const o of lotObj.values()) {
      for (const s of o.spins) s.obj.rotation[s.axis] += dt * s.speed;
      for (const f of o.flags) { const g = f.geometry.attributes.position; for (let i = 0; i < g.count; i++) { const x = g.getX(i); g.setZ(i, Math.sin(simT * 6 + x * 18) * 0.04 * x * 4); } g.needsUpdate = true; }
      if (o.born) {
        const t = (now - o.born) / 700;
        if (t >= 1) { o.group.scale.setScalar(1); o.born = 0; shadowDirty = true; }
        else { const s = t < 0.6 ? smooth(0, 0.6, t) * 1.12 : 1.12 - (t - 0.6) / 0.4 * 0.12; o.group.scale.set(1, Math.max(0.01, s), 1); }
      }
      const sel = selected === o.b.k;
      o.group.position.y = sel ? 0.04 + Math.abs(Math.sin(simT * 3)) * 0.03 : 0;
      // fumée des cheminées, vapeur, jets d'eau
      const [ox, oz] = [o.group.position.x, o.group.position.z], rot = o.group.rotation.y;
      const wx = (p) => ox + p[0] * Math.cos(rot) + p[2] * Math.sin(rot), wz = (p) => oz - p[0] * Math.sin(rot) + p[2] * Math.cos(rot);
      for (const p of o.smoke) if (Math.random() < dt * (p[3] ? 3 : 1.6)) smoke.spawn(wx(p), p[1], wz(p), 0.08 + (Math.random() - 0.5) * 0.05, p[3] ? 0.25 : 0.35, (Math.random() - 0.5) * 0.05, p[3] ? 2.2 : 3.2, 0.12, p[3] ? 0.5 : 0.65, p[3] ? '#ffffff' : '#d8d4cc', p[3] ? 0.45 : 0.55, 0, 0.2);
      for (const p of o.spray) for (let i = 0; i < 3; i++) if (Math.random() < dt * 30 * p[3]) { const a = Math.random() * TAU, s = 0.25 + Math.random() * 0.25; spray.spawn(wx(p), p[1], wz(p), Math.cos(a) * s, 1.1 * p[3] + Math.random() * 0.4, Math.sin(a) * s, 0.9, 0.06, 0.04, '#d6f3ff', 0.85, 3.2); }
    }
    // icônes qui flottent
    for (const s of icons) s.position.y = s.userData.y + Math.sin(simT * 2.5 + s.userData.y * 7) * 0.08;
    // sélection de parcelle
    if (lotSel.visible) lotSel.material.color.setScalar(0.75 + Math.sin(simT * 5) * 0.25);
    hiMat.opacity = 0.25 + Math.sin(simT * 4) * 0.1;

    // météo
    const w = M.weather;
    const rainy = w.startsWith('pluie');
    for (const cl of clouds) { cl.position.x += cl.userData.v * dt * (rainy ? 1.6 : 1); if (cl.position.x > 60) cl.position.x = -60; cl.visible = rainy || w.startsWith('nuages') || clouds.indexOf(cl) < 4; }
    rain.visible = rainy;
    if (rainy) {
      const box = Math.max(14, c.dist * 0.9), H = 14;
      for (let i = 0; i < RAIN; i++) {
        const q = rainSeed[i];
        const y = H - ((q[1] * H + simT * 11) % H);
        const x = c.tx + q[0] * box * 2 + y * 0.05, z = c.tz + q[2] * box * 2;
        rainPos.set([x, y, z, x + 0.04, y + 0.45, z], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    poolMat.opacity = nightK * 0.85;
    pools.visible = nightK > 0.05;
    const day = nightK < 0.5;
    for (const b of birds) { const u = b.userData; b.visible = day && !rainy && M.vitality >= 55; if (!b.visible) continue; u.a += dt * u.s; b.position.set(Math.cos(u.a) * u.rad, u.h + Math.sin(u.a * 3) * 0.3, Math.sin(u.a) * u.rad); b.rotation.y = -u.a; const f = Math.sin(simT * 10 + u.rad) * 0.6; u.l.rotation.y = f; u.r.rotation.y = -f; }
    // fête : feux d'artifice la nuit, confettis le jour
    if (M.events.some((e) => e.id === 'fete')) {
      fwT -= dt;
      if (fwT <= 0) {
        fwT = 1.2 + Math.random() * 1.5;
        const x = (Math.random() - 0.5) * 14, z = (Math.random() - 0.5) * 14, y = 7 + Math.random() * 3;
        const col = ['#f97316', '#facc15', '#38bdf8', '#f472b6', '#34d399'][Math.floor(Math.random() * 5)];
        if (nightK > 0.4) for (let i = 0; i < 90; i++) { const u = Math.random() * TAU, v = Math.acos(2 * Math.random() - 1), s = 2.4 + Math.random() * 0.6; sparks.spawn(x, y, z, Math.sin(v) * Math.cos(u) * s, Math.cos(v) * s, Math.sin(v) * Math.sin(u) * s, 1.6 + Math.random() * 0.6, 0.22, 0.05, col, 1, 1.4, 1.2); }
        else for (let i = 0; i < 40; i++) sparks.spawn(x * 0.5, 4, z * 0.5, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 2.5, 0.12, 0.1, col, 1, 1.2, 0.8);
      }
    }
    // marché du week-end : étincelles discrètes au-dessus de la place ; fleurs qui « respirent » quand tout va bien
    if (M.vitality >= 75 && Math.random() < dt * 4) sparks.spawn((Math.random() - 0.5) * (M.radius * 2 + 1) * P, 0.3, (Math.random() - 0.5) * (M.radius * 2 + 1) * P, 0, 0.35, 0, 2, 0.1, 0.02, '#fff3b0', 0.7);
    smoke.update(dt); spray.update(dt); sparks.update(dt);
    seaU.uTime.value = simT;

    if (shadowDirty && now - lastShadow > 250) { sun.target.position.set(0, 0, 0); renderer.shadowMap.needsUpdate = true; shadowDirty = false; lastShadow = now; }
    renderer.render(scene, camera);
    onFrame?.();
  }
  raf = requestAnimationFrame(frame);

  const onLost = (e) => { e.preventDefault(); };
  const onRestored = () => { worldSig = ''; lotObj.forEach((o) => lotsG.remove(o.group)); lotObj.clear(); if (M) sync(M); lastLight = -1; };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // ---------------------------------------------------------------- API
  return {
    update(m, { ready = [] } = {}) {
      const first = !M;
      sync(m);
      syncIcons(ready);
      light(hourOf(m.time), true);
      if (first) { const d = 12 + m.radius * 7; cam.dist = d; cam.cur.dist = d + 10; }
    },
    select(k) {
      selected = k;
      if (k) { const [i, j] = T.parse(k), [x, z] = lotXZ(i, j); lotSel.position.set(x, 0.1, z); lotSel.visible = true; }
      else lotSel.visible = false;
    },
    selectResident(id) { selectedRes = id; selRing.visible = id != null; },
    follow(id) { follow = id; if (id != null) cam.dist = Math.min(cam.dist, 11); },
    focusLot(k, dist = 14) { const [i, j] = T.parse(k), [x, z] = lotXZ(i, j); cam.tx = x; cam.tz = z; cam.dist = dist; follow = null; },
    inset(px) { insetWant = Math.max(0, px || 0); },
    screenOf(k) { const [i, j] = T.parse(k), [x, z] = lotXZ(i, j); proj.set(x, 0.1, z).project(camera); const rc = canvas.getBoundingClientRect(); return { x: rc.left + (proj.x * 0.5 + 0.5) * rc.width, y: rc.top + (-proj.y * 0.5 + 0.5) * rc.height }; },
    zoom(f) { cam.dist = clamp(cam.dist * f, 7, 52); },
    rotate(a) { cam.th += a; },
    highlight(keys) {
      hiG.children.slice().forEach((o) => hiG.remove(o));
      for (const k of keys || []) { const [i, j] = T.parse(k), [x, z] = lotXZ(i, j); const m = new THREE.Mesh(hiGeo, hiMat); m.position.set(x, 0.12, z); hiG.add(m); }
    },
    ghost(k, id, rot = 2) {
      if (ghost) { scene.remove(ghost.group); disposeGroup(ghost.group); ghost = null; }
      if (!k || !id || !M) return;
      const [i, j] = T.parse(k);
      const b = { k, i, j, b: id, rot, color: 0, lvl: 1, state: 'ok', def: T.BUILDINGS[id] };
      ghost = makeLot(b, M, ghostSet);
      place(ghost.group, b);
      ghost.group.position.y = 0.05;
      scene.add(ghost.group);
    },
    residentScreen(id) { // position à l'écran d'un habitant (pour placer une bulle HTML)
      const a = agents.get(id); if (!a) return null;
      proj.set(a.sx ?? a.x, (a.sy ?? 0) + 0.7, a.sz ?? a.z).project(camera);
      const rc = canvas.getBoundingClientRect();
      return { x: (proj.x * 0.5 + 0.5) * rc.width, y: (-proj.y * 0.5 + 0.5) * rc.height, inside: a.mode === 'inside' };
    },
    react(id, emoji) { const a = agents.get(id); if (a) { say(a, emoji, 2.5); if (a.mode === 'walk') { a.mode = 'act'; a.act = 'idle'; a.t = 2.5; } } },
    send(id, kind) { // l'habitant part faire ce qu'on lui a proposé
      const a = agents.get(id); if (!a || !M) return;
      const target = kind === 'sport' ? M.buildings.find((b) => b.b === 'gym') : kind === 'party' ? M.buildings.find((b) => b.b === 'cafe') : null;
      if (a.mode === 'inside') a.vis = 1;
      if (kind === 'walk') { const s = snapRoad([a.x, a.z]); a.path = [s, ...loopPath(s)]; a.jog = 0; a.mode = 'walk'; a.dest = byKey(a.r.home); return; }
      if (target) { const s = snapRoad([a.x, a.z]); a.path = [s, ...roadPath(s, doorOf(target)), spotIn(target)]; a.dest = target; a.mode = 'walk'; a.jog = 0; }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); });
      Object.values(mats).forEach((m) => m.dispose());
      [smoke, spray, sparks].forEach((p) => p.dispose());
      TEX.forEach((t) => t.dispose()); TEX.clear();
      Object.keys(UNIT).forEach((k) => { UNIT[k].dispose(); delete UNIT[k]; });
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
  function snapRoad(p) { // ramène un point sur la rue la plus proche
    const nx = nearestLine(p[0]), nz = nearestLine(p[1]);
    return Math.abs(nx - p[0]) < Math.abs(nz - p[1]) ? [nx, p[1]] : [p[0], nz];
  }
}
