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
