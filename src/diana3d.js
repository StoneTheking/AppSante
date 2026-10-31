// Rendu 3D de Coach Diana avec three.js (WebGL) : sphère bleu nuit translucide au contour cyan (hologramme),
// grille qui suit la tête, bandeau de sport en relief (vernis, reflets d'un studio), liserés lumineux,
// grands yeux pâles avec reflet qui regardent l'utilisateur, sourire fin (qui s'ouvre quand elle parle), halo.
// Le visage est calculé dans un shader sur la carte graphique : traits nets à toutes les tailles, 60 images/s.
// Sans WebGL, on retombe sur l'ancien rendu pixel par pixel (diana3d_cpu.js).
import { THREE, blit, envMap, onReset } from './gl3d.js';
import { drawCPU } from './diana3d_cpu.js';

const MOODS = {
  happy: { k: 0.06, w: 0.3, t: 0.028 },
  cheer: { k: 0.14, w: 0.32, t: 0.032, squint: 0.86 },
  proud: { k: 0.1, w: 0.3, t: 0.03, wink: true },
  sleepy: { k: 0.025, w: 0.16, t: 0.026, closed: true },
  oops: { k: -0.04, w: 0.2, t: 0.026 },
};
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

// Repère « écran » de l'ancien rendu (y vers le bas) : on garde ses conventions dans le shader.
export const HEAD_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
void main() {
  vObj = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

export const HEAD_FRAG = /* glsl */ `
precision highp float;
uniform float uBlink, uEyeRy, uK, uW, uT, uClosed, uWink, uOpen, uTime, uAlpha, uScan, uFeat;
uniform vec2 uGaze;
varying vec3 vObj; varying vec3 vN; varying vec3 vView;
const vec3 NAVY = vec3(20., 50., 98.) / 255., NAVY_DEEP = vec3(6., 16., 38.) / 255., GLOW = vec3(52., 110., 180.) / 255.;
const vec3 HOLO = vec3(90., 215., 255.) / 255., PALE = vec3(214., 246., 255.) / 255., PUPIL = vec3(40., 70., 108.) / 255.;
const float GRID = 0.2618;
// lumières (repère vue, y vers le haut) : principale en haut à gauche, contre-jour cyan en bas à droite
const vec3 LIGHT = vec3(-0.438, 0.613, 0.657);
float sat(float x) { return clamp(x, 0., 1.); }
float aa(float e, float d) { float w = max(fwidth(d), 1e-4) * 0.9; return 1. - smoothstep(e - w, e + w, d); }
vec3 shade(vec3 base, vec3 n, vec3 v, float spec, float gloss, float emissive, float rim) {
  float d = max(0., dot(n, LIGHT));
  vec3 h = normalize(LIGHT + v);
  float s = spec * pow(max(0., dot(n, h)), gloss);
  // reflet net d'une boîte à lumière (aspect vernis) + reflet large
  vec3 r = reflect(-v, n);
  float box = smoothstep(0.72, 0.86, r.y) * smoothstep(0.7, 0.15, abs(r.x + 0.35)) * 0.12;
  float f = pow(1. - max(0., dot(n, v)), 2.6) * rim * smoothstep(-0.3, 0.6, -n.y * 0.6 + n.x * 0.5 + 0.3);
  float k = 0.3 + 0.82 * d + emissive;
  return base * k + vec3(s + box) + vec3(120., 175., 255.) / 255. * f;
}
void main() {
  vec3 o = normalize(vObj);
  vec3 p = vec3(o.x, -o.y, o.z); // y vers le bas, z = devant le visage
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  float nz = max(0., dot(n, v));
  vec3 base = mix(NAVY_DEEP, NAVY, smoothstep(-0.2, 0.9, p.z));
  base = mix(base, GLOW, 0.5 * smoothstep(0.55, 1., p.z));
  float feat = 0.; vec3 featCol = PALE;
  float lon = atan(p.x, p.z), lat = asin(clamp(p.y, -1., 1.));
  if (p.z > 0.05 && uFeat > 0.5) {
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1. : 1.;
      float el = lon - side * 0.34, et = lat + 0.16;
      bool closed = uClosed > 0.5 || (uWink > 0.5 && side > 0.);
      if (closed) {
        float cxE = clamp(el, -0.15, 0.15);
        float q = (cxE / 0.15) * (cxE / 0.15);
        float curve = uClosed > 0.5 ? 0.03 - 0.06 * q : -0.03 + 0.06 * q;
        float d = length(vec2(el - cxE, et - curve));
        feat = max(feat, aa(0.028, d));
      } else {
        float e = length(vec2(el / 0.185, et / max(0.012, uEyeRy)));
        float inEye = aa(1., e);
        if (inEye > 0.) {
          float dp = length(vec2(el - uGaze.x, et - uGaze.y - 0.01));
          float open = smoothstep(0.25, 0.6, 1. - uBlink);
          float pup = aa(0.085, dp) * open;
          vec3 c = mix(PALE, PUPIL, pup);
          // iris un peu plus clair au bord, reflet de lumière dans la pupille : regard vivant
          c = mix(c, HOLO * 0.9, pup * smoothstep(0.05, 0.085, dp) * 0.55);
          float spark = aa(0.017, length(vec2(el - uGaze.x + 0.028, et - uGaze.y + 0.026))) * open;
          c = mix(c, vec3(1.), spark);
          // ombre douce de la paupière en haut de l'œil
          c *= 1. - 0.18 * smoothstep(0.2, 1., -et / max(0.012, uEyeRy)) * inEye;
          if (inEye > feat) { feat = inEye; featCol = c; }
        }
      }
    }
    float mx = clamp(lon, -uW, uW);
    float curveY = 0.4 - uK * (mx / uW) * (mx / uW);
    float mo = aa(uT, length(vec2(lon - mx, lat - curveY)));
    if (mo > feat) { feat = mo; featCol = PALE; }
    if (uOpen > 0.002) {
      float w = uW * 0.92, x = lon / w;
      if (abs(x) < 1.) {
        float top = 0.4 - uK * x * x, bot = top + uOpen * (1. - x * x);
        float fw = max(fwidth(lat), 1e-4);
        float inside = smoothstep(top - fw, top + fw, lat) * (1. - smoothstep(bot - fw, bot + fw, lat));
        float lower = aa(uT, abs(lat - bot));
        float m = max(inside, lower);
        if (m > feat) { feat = m; featCol = mix(PALE, vec3(150., 205., 235.) / 255., inside * 0.5); }
      }
    }
  }
  float fres = pow(1. - nz, 2.2);
  float fwl = min(fwidth(lat), 0.05), fwo = min(fwidth(lon), 0.05);
  float gLat = abs(lat / GRID - floor(lat / GRID + 0.5)) * GRID;
  float gLon = abs(lon / GRID - floor(lon / GRID + 0.5)) * GRID;
  float grid = max(1. - smoothstep(0., 1.2 * fwl, gLat), (1. - smoothstep(0., 1.2 * fwo, gLon)) * sqrt(max(0., 1. - p.y * p.y)));
  grid *= 0.1 + 0.22 * smoothstep(0.2, 0.95, 1. - p.z * 0.7);
  float scan = 1. - uScan * (0.5 - 0.5 * sin(gl_FragCoord.y * 2.1 - uTime * 6.));
  vec3 c = shade(base, n, v, 0.5, 48., 0., 0.2);
  c += vec3(0.35) * pow(max(0., dot(n, normalize(LIGHT + v))), 260.); // petit point brillant net
  float glow = 0.12 + 0.95 * fres + grid;
  c = (c + HOLO * glow) * scan;
  if (feat > 0.) c = mix(c, shade(featCol, n, v, 0.25, 60., 0.45, 0.05), feat);
  gl_FragColor = vec4(c, (0.88 + 0.12 * fres) * uAlpha);
}`;

export function headUniforms() {
  return {
    uBlink: { value: 0 }, uEyeRy: { value: 0.205 }, uK: { value: 0.06 }, uW: { value: 0.3 }, uT: { value: 0.028 },
    uClosed: { value: 0 }, uWink: { value: 0 }, uOpen: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 },
    uScan: { value: 0.14 }, uFeat: { value: 1 }, uGaze: { value: new THREE.Vector2() },
  };
}
export function setMood(u, mood, blink = 0, talk = 0) {
  const m = MOODS[mood] || MOODS.happy;
  u.uBlink.value = blink; u.uEyeRy.value = 0.205 * (m.squint || 1) * (1 - 0.92 * blink);
  u.uK.value = m.k; u.uW.value = m.w; u.uT.value = m.t;
  u.uClosed.value = m.closed ? 1 : 0; u.uWink.value = m.wink ? 1 : 0; u.uOpen.value = talk * 0.17;
}

// Bandeau : portion de sphère en relief (profil arrondi), orientée comme dans le rendu d'origine.
const BAND_N_DOWN = [0.1, -1, -0.22];
export function bandMesh() {
  const g = new THREE.Group();
  const lo = Math.acos(0.56), hi = Math.acos(0.31); // angles au bord haut / bas du bandeau
  const pts = [];
  const N = 18;
  pts.push(new THREE.Vector2(Math.sin(lo) * 0.99, Math.cos(lo) * 0.99));
  for (let i = 0; i <= N; i++) {
    const s = i / N, th = lo + (hi - lo) * s;
    const r = 1.032 + 0.03 * Math.pow(Math.sin(Math.PI * s), 0.6); // profil bombé
    pts.push(new THREE.Vector2(Math.sin(th) * r, Math.cos(th) * r));
  }
  pts.push(new THREE.Vector2(Math.sin(hi) * 0.99, Math.cos(hi) * 0.99));
  const geo = new THREE.LatheGeometry(pts.reverse(), 96); // du bas vers le haut : faces tournées vers l'extérieur
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x16b5b5, roughness: 0.42, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18, emissive: 0x05606a, emissiveIntensity: 0.5, envMapIntensity: 0.5, toneMapped: false });
  const band = new THREE.Mesh(geo, mat);
  g.add(band);
  // liserés lumineux sur les deux bords
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xbaffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const th of [lo + 0.012, hi - 0.012]) {
    const r = 1.04;
    const t = new THREE.Mesh(new THREE.TorusGeometry(Math.sin(th) * r, 0.0075, 6, 96), lineMat);
    t.rotation.x = Math.PI / 2; t.position.y = Math.cos(th) * r;
    g.add(t);
  }
  const n = new THREE.Vector3(BAND_N_DOWN[0], -BAND_N_DOWN[1], BAND_N_DOWN[2]).normalize();
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  g.userData.mat = mat;
  return g;
}

// Halo doux derrière la tête (texture radiale générée une fois).
let haloTex = null;
export function haloSprite(scale = 2.5, opacity = 0.5) {
  if (!haloTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, 'rgba(90,215,255,.55)'); g.addColorStop(0.55, 'rgba(90,215,255,.14)'); g.addColorStop(1, 'rgba(90,215,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    haloTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(scale, scale, 1);
  return s;
}

let G = null;
function scene() {
  if (G) return G;
  const sc = new THREE.Scene();
  sc.environment = envMap();
  const cam = new THREE.PerspectiveCamera(13.6, 1, 1, 30);
  cam.position.set(0, 0, 10);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0x5ad7ff, 2.5); rim.position.set(3, -2.5, -2);
  sc.add(new THREE.AmbientLight(0x6080b0, 0.6), key, rim);
  const halo = haloSprite(2.75, 0.42); halo.position.z = -1.4;
  const root = new THREE.Group();
  const head = new THREE.Group(); head.matrixAutoUpdate = false;
  const uniforms = headUniforms();
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: HEAD_VERT, fragmentShader: HEAD_FRAG, transparent: true });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), mat);
  sphere.renderOrder = 1;
  const band = bandMesh(); band.children.forEach((c) => (c.renderOrder = 2));
  head.add(sphere, band);
  root.add(head);
  sc.add(halo, root);
  G = { sc, cam, root, head, uniforms, halo };
  return G;
}
onReset(() => { G = null; });

const F = new THREE.Matrix4();
// Matrice de rotation (lacet, tangage, roulis) dans le repère y vers le bas, convertie pour three.js (y vers le haut).
function headMatrix(yaw, pitch, roll, ball) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]];
  const rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const mul = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  const M = mul(rz, mul(rx, ry));
  // y vers le haut : M' = F·M·F avec F = diag(1, −1, 1)
  F.set(M[0][0], -M[0][1], M[0][2], 0, -M[1][0], M[1][1], -M[1][2], 0, M[2][0], -M[2][1], M[2][2], 0, 0, 0, 0, 1);
  if (ball) F.premultiply(ball);
  return { M, F };
}

// Dessine une image de Diana. state : { yaw, pitch, roll, blink, mood, gaze:[x,y], talk, bob, time, ball (Matrix4) }.
export function draw(canvas, state, buf) {
  let g = null;
  try { g = scene(); } catch { g = null; }
  if (!g) return drawCPU(canvas, state, buf);
  const { F: m } = headMatrix(state.yaw || 0, state.pitch || 0, state.roll || 0, state.ball);
  g.head.matrix.copy(m);
  g.head.matrixWorldNeedsUpdate = true;
  g.root.position.y = -(state.bob || 0) / 0.42;
  const u = g.uniforms;
  setMood(u, state.mood, state.blink || 0, state.talk || 0);
  // les pupilles visent l'utilisateur (direction de la caméra vue depuis la tête), plus d'éventuels coups d'œil
  const e = m.elements;
  const view = [e[2], -e[6], e[10]]; // ligne z de la matrice (transposée) en repère y vers le bas
  const gx = clamp(Math.atan2(view[0], view[2]) * 0.4 + (state.gaze?.[0] || 0) * 0.07, -0.09, 0.09);
  const gy = clamp(Math.asin(clamp(view[1], -1, 1)) * 0.4 + (state.gaze?.[1] || 0) * 0.06, -0.08, 0.08);
  u.uGaze.value.set(gx, gy);
  u.uTime.value = state.time || 0;
  u.uScan.value = Math.min(0.14, 0.05 + canvas.width / 2000); // lignes de balayage discrètes sur les petits visages
  g.halo.material.opacity = 0.34 + 0.08 * Math.sin((state.time || 0) * 1.3);
  if (!blit(canvas, g.sc, g.cam)) return drawCPU(canvas, state, buf);
}
