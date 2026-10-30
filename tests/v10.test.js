import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/science.js';
import * as C from '../src/coach.js';

test('sommeil : chaque nuit compte, une nuit courte n’est pas rattrapée par une longue', () => {
  const need = { min: 7, max: 9 };
  assert.equal(S.nightDurationScore(7.5, need), 100);
  assert.equal(S.nightDurationScore(6, need), 60);
  assert.equal(S.nightDurationScore(5, need), 30);
  assert.equal(S.nightDurationScore(4, need), 0);
  // moyenne de 7 h mais nuits très inégales < semaine régulière à 7 h
  assert.ok(S.sleepScore([4, 10, 4, 10], null, null, { need }) < S.sleepScore([7, 7, 7, 7], null, null, { need }));
  // 6 h 40 chaque nuit : sous le besoin, donc pénalisé
  assert.ok(S.sleepScore([6.67, 6.67, 6.67], null, null, { need }) < 90);
  assert.ok(S.sleepScore([6.67, 6.67, 6.67], 3, 20, { need, wakeVar: 20 }) < S.sleepScore([7.5, 7.5, 7.5], 3, 20, { need, wakeVar: 20 }));
  // horaires très irréguliers : pénalisés
  assert.ok(S.sleepScore([8, 8, 8], null, 120, { need }) < S.sleepScore([8, 8, 8], null, 20, { need }));
});

test('score global : tabac et alcool retirent des points', () => {
  const ks = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07'];
  const days = Object.fromEntries(ks.map((k) => [k, { bed: '23:00', wake: '07:00', steps: 9000 }]));
  const base = { profile: { birthYear: 1990, sex: 'm', height: 180, weight: 75, bedTime: '23:00', wakeTime: '07:00' }, days, meals: [], weights: [] };
  const g = C.summarize(base, ks).scores.global;
  const smoker = C.summarize({ ...base, profile: { ...base.profile, smoker: true } }, ks).scores.global;
  const drinker = C.summarize({ ...base, days: Object.fromEntries(ks.map((k) => [k, { ...days[k], alcohol: 3 }])) }, ks).scores.global;
  assert.ok(smoker <= g - 15);
  assert.ok(drinker < g);
});
