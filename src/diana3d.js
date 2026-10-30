// Rendu 3D de Coach Diana, calculé pixel par pixel sur un canvas (sans bibliothèque) :
// sphère bleu nuit éclairée (lumière diffuse, reflet brillant, contour lumineux), bandeau de sport en relief,
// grands yeux pâles et sourire fin posés sur la surface, et deux anneaux fins qui tournent autour en 3D.
// La tête pivote doucement : les traits du visage glissent sur la sphère, ce qui donne le volume.

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
// Repère écran : x vers la droite, y vers le bas, z vers l'observateur.
const LIGHT = norm([-0.5, -0.7, 0.75]);
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const BAND_N = norm([0.1, -1, -0.22]); // bandeau un peu incliné, plus bas sur le front que derrière la tête
const BAND = [0.25, 0.5];
const BAND_R = 1.055; // le bandeau dépasse légèrement de la tête

const NAVY = [26, 52, 94], NAVY_DEEP = [9, 18, 38], GLOW = [64, 112, 176];
const PALE = [226, 235, 248], PUPIL = [88, 102, 124];
const TEAL = [24, 190, 172], TEAL_DARK = [9, 112, 112];
const RING = 'rgba(178, 194, 220, ALPHA)';

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

// Dessine une image de Diana. state : { yaw, pitch, roll, blink (0 ouvert → 1 fermé), mood, gaze:[x,y], talk (0-1), ring (angle), bob }.
export function draw(canvas, state, buf) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const S = Math.min(W, H);
  const R = S * 0.32, cx = W / 2, cy = H / 2 + (state.bob || 0) * S;
  const M = rot(state.yaw || 0, state.pitch || 0, state.roll || 0);
  const mood = MOODS[state.mood] || MOODS.happy;
  const px = 1 / R; // taille d'un pixel en unités de sphère

  // 1) Anneaux, moitié arrière (cachée ensuite par la tête).
  ctx.clearRect(0, 0, W, H);
  const rings = ringPaths(M, state.ring || 0);
  const strokeRing = (front) => {
    ctx.lineWidth = Math.max(1, S * 0.011);
    ctx.lineCap = 'round';
    for (const [r, pts, alpha] of rings) {
      ctx.strokeStyle = RING.replace('ALPHA', (alpha * (front ? 1 : 0.55)).toFixed(3));
      ctx.beginPath();
      let on = false;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if ((a[2] + b[2] > 0) !== front) { on = false; continue; }
        if (!on) { ctx.moveTo(cx + a[0] * R * r, cy + a[1] * R * r); on = true; }
        ctx.lineTo(cx + b[0] * R * r, cy + b[1] * R * r);
      }
      ctx.stroke();
    }
  };
  strokeRing(false);

  // 2) Tête, pixel par pixel, dans un tampon dessiné par-dessus.
  const size = Math.ceil(R * BAND_R * 2) + 4;
  const ox = Math.round(cx - size / 2), oy = Math.round(cy - size / 2);
  if (!buf.img || buf.img.width !== size) { buf.img = ctx.createImageData(size, size); buf.cv = document.createElement('canvas'); buf.cv.width = buf.cv.height = size; }
  const data = buf.img.data;
  const gx = (state.gaze?.[0] || 0) * 0.07, gy = (state.gaze?.[1] || 0) * 0.06;
  const blink = state.blink || 0;
  const eyeRy = 0.205 * (mood.squint || 1) * (1 - 0.92 * blink);
  const mouthT = mood.t + (state.talk || 0) * 0.025;
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
          alpha = m * clamp((BAND_R - r) * R + 0.5);
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
        let c = shade(base, n, { spec: 0.6, gloss: 46, rim: 0.42 });
        if (feat > 0) c = mix(c, shade(featCol, n, { spec: 0.25, gloss: 30, emissive: 0.32, rim: 0.1 }), feat);
        const a = clamp((1 - r) * R + 0.5);
        if (col) { col = mix(c, col, alpha); alpha = alpha + a * (1 - alpha); } else { col = c; alpha = a; }
      }
      if (!col) { data[o + 3] = 0; continue; }
      data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = alpha * 255;
    }
  }
  buf.cv.getContext('2d').putImageData(buf.img, 0, 0);
  ctx.drawImage(buf.cv, ox, oy);

  // 3) Anneaux, moitié avant.
  strokeRing(true);
}

// Deux anneaux autour de la tête, dans le plan du visage, qui oscillent chacun sur un axe : [rayon, points 3D, opacité].
function ringPaths(M, t) {
  const out = [];
  for (const [r, ax, ph, alpha] of [[1.24, 0, 0, 0.5], [1.42, 1, 2.1, 0.34]]) {
    const tilt = 0.35 * Math.sin(t + ph);
    const T = ax ? rot(tilt, 0, 0) : rot(0, tilt, 0);
    const pts = [];
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      pts.push(apply(M, apply(T, [Math.cos(a), Math.sin(a), 0])));
    }
    out.push([r, pts, alpha]);
  }
  return out;
}
