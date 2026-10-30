// Rendu 3D de Coach Diana, calculé pixel par pixel sur un canvas (sans bibliothèque), façon hologramme :
// sphère bleu nuit translucide au contour lumineux cyan, texture de grille qui suit la tête, lignes de balayage,
// bandeau de sport en relief, grands yeux pâles qui regardent l'utilisateur, sourire fin (qui s'ouvre quand elle parle),
// et deux anneaux fins qui tournent autour en 3D. La tête pivote doucement : les traits glissent sur la sphère.

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
// Repère écran : x vers la droite, y vers le bas, z vers l'observateur.
const LIGHT = norm([-0.5, -0.7, 0.75]);
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const BAND_N = norm([0.1, -1, -0.22]); // bandeau un peu incliné, plus bas sur le front que derrière la tête
const BAND = [0.25, 0.5];
const BAND_R = 1.055; // le bandeau dépasse légèrement de la tête

const NAVY = [20, 50, 98], NAVY_DEEP = [6, 16, 38], GLOW = [52, 110, 180];
const HOLO = [90, 215, 255]; // lueur cyan de l'hologramme
const PALE = [214, 246, 255], PUPIL = [58, 92, 128];
const TEAL = [40, 214, 214], TEAL_DARK = [8, 120, 140];
const GRID = 0.2618; // une ligne de la grille tous les 15°

// Expressions : courbure et largeur du sourire, yeux.
const MOODS = {
  happy: { k: 0.06, w: 0.3, t: 0.028 },
  cheer: { k: 0.14, w: 0.32, t: 0.032, squint: 0.86 },
  proud: { k: 0.1, w: 0.3, t: 0.03, wink: true },
  sleepy: { k: 0.025, w: 0.16, t: 0.026, closed: true },
  oops: { k: -0.04, w: 0.2, t: 0.026 },
};

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Matrice de rotation de la tête (lacet, tangage, roulis).
function rot(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Rz(roll) · Rx(pitch) · Ry(yaw)
  const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]];
  const rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const mul = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  return mul(rz, mul(rx, ry));
}
const apply = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const applyT = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];

// Éclairage d'une couleur selon la normale (vue) : ambiante + diffuse + reflet + contour.
function shade(base, n, { spec = 0.55, gloss = 40, emissive = 0, rim = 0.35 } = {}) {
  const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const h = Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]);
  const s = spec * Math.pow(h, gloss);
  const f = Math.pow(1 - Math.max(0, n[2]), 2.6) * rim * smooth(-0.3, 0.6, n[1] * 0.6 + n[0] * 0.5 + 0.3); // contour éclairé en bas à droite
  const k = 0.3 + 0.82 * d + emissive;
  return [base[0] * k + 255 * s + 120 * f, base[1] * k + 255 * s + 175 * f, base[2] * k + 255 * s + 255 * f];
}

// Dessine une image de Diana. state : { yaw, pitch, roll, blink (0 ouvert → 1 fermé), mood, gaze:[x,y], talk (0-1), bob }.
export function draw(canvas, state, buf) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const S = Math.min(W, H);
  const R = S * 0.42, cx = W / 2, cy = H / 2 + (state.bob || 0) * S;
  const M = rot(state.yaw || 0, state.pitch || 0, state.roll || 0);
  const mood = MOODS[state.mood] || MOODS.happy;
  const px = 1 / R; // taille d'un pixel en unités de sphère

  ctx.clearRect(0, 0, W, H);

  // 2) Tête, pixel par pixel, dans un tampon dessiné par-dessus.
  const size = Math.ceil(R * BAND_R * 2) + 4;
  const ox = Math.round(cx - size / 2), oy = Math.round(cy - size / 2);
  if (!buf.img || buf.img.width !== size) { buf.img = ctx.createImageData(size, size); buf.cv = document.createElement('canvas'); buf.cv.width = buf.cv.height = size; }
  const data = buf.img.data;
  // Les pupilles visent l'utilisateur (direction de la caméra vue depuis la tête), plus d'éventuels petits coups d'œil.
  const view = applyT(M, [0, 0, 1]);
  const gx = clamp(Math.atan2(view[0], view[2]) * 0.4 + (state.gaze?.[0] || 0) * 0.07, -0.09, 0.09);
  const gy = clamp(Math.asin(clamp(view[1], -1, 1)) * 0.4 + (state.gaze?.[1] || 0) * 0.06, -0.08, 0.08);
  const time = state.time || 0, flick = state.flicker ?? 1;
  const blink = state.blink || 0;
  const eyeRy = 0.205 * (mood.squint || 1) * (1 - 0.92 * blink);
  const mouthT = mood.t;
  const open = (state.talk || 0) * 0.17; // bouche ouverte quand elle parle
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (ox + i + 0.5 - cx) / R, v = (oy + j + 0.5 - cy) / R;
      const r2 = u * u + v * v;
      const o = (j * size + i) * 4;
      if (r2 > BAND_R * BAND_R + 0.05) { data[o + 3] = 0; continue; }
      const r = Math.sqrt(r2);
      let col = null, alpha = 0;

      // Bandeau : sphère un peu plus grande, gardée seulement sur la bande du front.
      if (r < BAND_R + px) {
        const uu = u / BAND_R, vv = v / BAND_R, rq = Math.max(Math.hypot(uu, vv), 1e-6), k = Math.min(rq, 0.9999) / rq;
        const q = [uu * k, vv * k, 0];
        q[2] = Math.sqrt(Math.max(0, 1 - q[0] * q[0] - q[1] * q[1]));
        const p = applyT(M, q);
        const b = p[0] * BAND_N[0] + p[1] * BAND_N[1] + p[2] * BAND_N[2];
        const edge = 1.4 * px / Math.max(0.15, q[2]);
        const m = smooth(BAND[0] - edge, BAND[0] + edge, b) * (1 - smooth(BAND[1] - edge, BAND[1] + edge, b));
        if (m > 0) {
          // relief arrondi : la normale penche vers le haut sur le bord supérieur
          const s = ((b - (BAND[0] + BAND[1]) / 2) / ((BAND[1] - BAND[0]) / 2));
          const bn = apply(M, BAND_N);
          const n = norm([q[0] + bn[0] * s * 0.55, q[1] + bn[1] * s * 0.55, q[2] + bn[2] * s * 0.55]);
          const base = mix(TEAL_DARK, TEAL, 0.55 + 0.45 * (1 - s * s));
          col = shade(base, n, { spec: 0.35, gloss: 18, rim: 0.25 });
          const edgeGlow = smooth(0.7, 1, Math.abs(s)); // liserés lumineux sur les bords du bandeau
          col = [col[0] + 120 * edgeGlow, col[1] + 160 * edgeGlow, col[2] + 170 * edgeGlow];
          alpha = m * clamp((BAND_R - r) * R + 0.5) * 0.94;
        }
      }

      // Tête.
      if (alpha < 1 && r < 1 + px) {
        const rr = Math.min(r, 0.9999);
        const n = [u * rr / Math.max(r, 1e-6), v * rr / Math.max(r, 1e-6), 0];
        n[2] = Math.sqrt(Math.max(0, 1 - n[0] * n[0] - n[1] * n[1]));
        const p = applyT(M, n);
        // dégradé de la photo de référence : centre plus lumineux, bords profonds
        let base = mix(NAVY_DEEP, NAVY, smooth(-0.2, 0.9, p[2]));
        base = mix(base, GLOW, 0.5 * smooth(0.55, 1, p[2]));
        let feat = 0, featCol = PALE;
        if (p[2] > 0.05) {
          const lon = Math.atan2(p[0], p[2]), lat = Math.asin(clamp(p[1], -1, 1));
          const fw = 1.3 * px / Math.max(0.25, n[2]); // flou d'anticrénelage en radians
          for (const side of [-1, 1]) {
            const el = lon - side * 0.34, et = lat + 0.16;
            const closed = mood.closed || (mood.wink && side > 0);
            if (closed) {
              // œil fermé : petit arc
              const cxE = clamp(el, -0.15, 0.15);
              // endormie : ‿ ; clin d'œil : ^
              const curve = mood.closed ? 0.03 - 0.06 * (cxE / 0.15) ** 2 : -0.03 + 0.06 * (cxE / 0.15) ** 2;
              const d = Math.hypot(el - cxE, et - curve);
              feat = Math.max(feat, 1 - smooth(0.028 - fw, 0.028 + fw, d));
            } else {
              const e = Math.hypot(el / 0.185, et / Math.max(0.012, eyeRy));
              const inEye = 1 - smooth(1 - fw / 0.185, 1 + fw / 0.185, e);
              if (inEye > 0) {
                const dp = Math.hypot(el - gx, et - gy - 0.01);
                const pup = (1 - smooth(0.085 - fw, 0.085 + fw, dp)) * smooth(0.25, 0.6, 1 - blink);
                const c = mix(PALE, PUPIL, pup);
                if (inEye > feat) { feat = inEye; featCol = c; }
              }
            }
          }
          // Sourire : courbe fine, extrémités relevées.
          const mx = clamp(lon, -mood.w, mood.w);
          const curveY = 0.4 - mood.k * (mx / mood.w) ** 2;
          const dm = Math.hypot(lon - mx, lat - curveY);
          const mo = 1 - smooth(mouthT - fw, mouthT + fw, dm);
          if (mo > feat) { feat = mo; featCol = PALE; }
        }
        // Hologramme : contour cyan (Fresnel), grille qui suit la tête, lignes de balayage qui défilent.
        const fres = Math.pow(1 - n[2], 2.2);
        const gl = (x) => { const f = Math.abs(x / GRID - Math.round(x / GRID)) * GRID; return 1 - smooth(0, 1.1 * px / Math.max(0.3, n[2]), f); };
        const latG = Math.asin(clamp(p[1], -1, 1)), lonG = Math.atan2(p[0], p[2]);
        const grid = Math.max(gl(latG), gl(lonG) * Math.sqrt(Math.max(0, 1 - p[1] * p[1]))) * (0.1 + 0.22 * smooth(0.2, 0.95, 1 - p[2] * 0.7));
        const scan = 0.93 + 0.07 * Math.sin((oy + j) * 2.1 - time * 6);
        let c = shade(base, n, { spec: 0.45, gloss: 40, rim: 0.2 });
        const glow = 0.12 + 0.95 * fres + grid;
        c = [(c[0] + HOLO[0] * glow) * scan, (c[1] + HOLO[1] * glow) * scan, (c[2] + HOLO[2] * glow) * scan];
        if (open > 0.002 && p[2] > 0.05) {
          // bouche ouverte : forme pleine, de la même couleur claire que le trait du sourire (aucune différence bord / intérieur)
          const lon = Math.atan2(p[0], p[2]), lat = Math.asin(clamp(p[1], -1, 1));
          const w = mood.w * 0.92, x = lon / w;
          if (Math.abs(x) < 1) {
            const top = 0.4 - mood.k * x * x, bot = top + open * (1 - x * x);
            const fw2 = 1.3 * px;
            const inside = smooth(top - fw2, top + fw2, lat) * (1 - smooth(bot - fw2, bot + fw2, lat));
            const lower = 1 - smooth(mouthT - fw2, mouthT + fw2, Math.abs(lat - bot));
            const m = Math.max(inside, lower);
            if (m > feat) { feat = m; featCol = PALE; }
          }
        }
        if (feat > 0) c = mix(c, shade(featCol, n, { spec: 0.2, gloss: 30, emissive: 0.45, rim: 0.05 }), feat);
        const a = clamp((1 - r) * R + 0.5) * (0.86 + 0.14 * fres) * flick; // légèrement translucide
        if (col) { col = mix(c, col, alpha); alpha = alpha + a * (1 - alpha); } else { col = c; alpha = a; }
      }
      if (!col) { data[o + 3] = 0; continue; }
      data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = alpha * 255;
    }
  }
  buf.cv.getContext('2d').putImageData(buf.img, 0, 0);
  ctx.drawImage(buf.cv, ox, oy);

}
