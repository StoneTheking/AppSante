import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMS, skeleton, timeline, poseAt } from '../src/exercise3d.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const joints = (S) => [S.head, S.pelvis, ...['L', 'R'].flatMap((k) => ['wrist', 'elbow', 'knee', 'ankle', 'toe'].map((j) => S.side[k][j]))];

test('démonstrations : mouvement continu, sans membre qui saute ni coude qui bascule', () => {
  for (const [name, a] of Object.entries(ANIMS)) {
    const tl = timeline(a);
    let prev = null;
    for (let t = 0; t <= tl.total + 0.02; t += 1 / 60) {
      const pts = joints(skeleton(poseAt(tl, t).pose));
      if (prev) {
        const v = Math.max(...pts.map((p, i) => dist(p, prev[i]))) * 60;
        assert.ok(v < 14, `${name} : ${v.toFixed(1)} m/s à t=${t.toFixed(2)} s`);
      }
      prev = pts;
    }
  }
});

test('démonstrations : rien ne traverse le sol', () => {
  for (const [name, a] of Object.entries(ANIMS)) {
    const tl = timeline(a);
    for (let t = 0; t < tl.total; t += 0.05) {
      const S = skeleton(poseAt(tl, t).pose);
      for (const k of ['L', 'R']) for (const j of ['toe', 'ankle', 'knee', 'wrist', 'handEnd']) assert.ok(S.side[k][j][1] > -0.03, `${name} : ${j}${k} sous le sol à t=${t.toFixed(2)}`);
      assert.ok(S.head[1] > 0.05, `${name} : tête dans le sol`);
    }
  }
});

test('saut : phase aérienne, les deux pieds quittent le sol', () => {
  const tl = timeline(ANIMS['Squats sautés']);
  let air = 0;
  for (let t = 0; t < tl.total; t += 0.02) { const S = skeleton(poseAt(tl, t).pose); if (S.side.L.ankle[1] > 0.2 && S.side.R.ankle[1] > 0.2) air++; }
  assert.ok(air >= 3);
});

test('étirement des ischios : une seule jambe sur la marche à la fois, puis l’autre', () => {
  const tl = timeline(ANIMS['Étirement des ischios (jambe tendue sur une marche)']);
  const up = { L: 0, R: 0 };
  for (let t = 0; t < tl.total; t += 0.05) {
    const S = skeleton(poseAt(tl, t).pose);
    const l = S.side.L.ankle[1] > 0.2, r = S.side.R.ankle[1] > 0.2;
    assert.ok(!(l && r), `les deux pieds en l’air à t=${t.toFixed(2)}`);
    if (l) up.L++; if (r) up.R++;
  }
  assert.ok(up.L > 20 && up.R > 20);
});

test('le pied d’appui ne copie plus l’orientation du pied qui bouge', async () => {
  const X = await import('../src/exercise3d.js');
  // étirement des ischios : talon gauche sur la marche (pointe vers le haut), pied droit à plat au sol
  const tl = X.timeline(X.ANIMS['Étirement des ischios (jambe tendue sur une marche)']);
  const key = tl.keys.findIndex((k) => k.fL[1] > 0.2);
  const S = X.skeleton(tl.keys[key]);
  const r = S.side.R, toeUp = r.toe[1] - r.ankle[1];
  assert.ok(Math.abs(toeUp) < 0.03, `pied droit à plat attendu, pointe à ${toeUp.toFixed(2)} m au-dessus de la cheville`);
  // pose symétrique (allongé) : les deux pieds gardent la même orientation
  const br = X.timeline(X.ANIMS['Pont fessier']).keys[0];
  assert.deepEqual(br.tR, [-br.tL[0], br.tL[1], br.tL[2]]);
});
