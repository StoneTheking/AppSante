import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/science.js';
import * as C from '../src/coach.js';
import { parseCSV } from '../src/importer.js';

const profile = { sex: 'h', birthYear: 1990, height: 180, weight: 80, activityLevel: 'modere', goal: 'maintenir', wakeTime: '07:00', bedTime: '23:00', diet: 'omnivore', allergies: '' };

test('IMC et métabolisme (Mifflin-St Jeor)', () => {
  assert.equal(S.round(S.bmi(80, 180), 1), 24.7);
  const age = S.age(1990);
  assert.equal(S.bmr(profile), 10 * 80 + 6.25 * 180 - 5 * age + 5);
  assert.ok(S.tdee(profile) > S.bmr(profile));
});

test('durée de sommeil passant minuit', () => {
  assert.equal(S.sleepHours('23:30', '07:00'), 7.5);
  assert.equal(S.sleepHours('01:00', '08:00'), 7);
});

test('projection de poids : modèle de Hall', () => {
  assert.equal(S.projectWeight(80, 0, 365), 80);
  // +220 kcal/j → +10 kg à l'équilibre, ~63 % après 1 an
  assert.equal(S.round(S.projectWeight(80, 220, 365), 1), 86.3);
  assert.ok(S.projectWeight(80, 220, 3 * 365) > 89);
});

test('risque relatif : référence = 1', () => {
  const f = S.riskFactors({ steps: 8000, sleepH: 8, bmiV: 22, diet: 66.7, strengthWeek: 0 });
  assert.ok(Math.abs(S.combinedRR(f) - 1) < 0.01);
  const bad = S.riskFactors({ steps: 3000, sleepH: 5, bmiV: 32 });
  assert.ok(S.combinedRR(bad) > 1.5);
});

test('score alimentaire', () => {
  const t = S.targets(profile);
  const good = { kcal: 2200, fiber: 35, fruitVeg: 500, protein: 100, sugar: 20, satFat: 15, sodium: 1500, upfShare: 0 };
  assert.equal(S.dietScore(good, t), 100);
  assert.ok(S.dietScore({ ...good, fiber: 5, fruitVeg: 0, upfShare: 0.8 }, t) < 50);
});

test('plan de la journée cohérent', () => {
  const days = { [new Date().toISOString().slice(0, 10)]: { bed: '01:00', wake: '06:00', mood: 2 } };
  const sm = C.summarize({ profile, days, meals: [], weights: [] }, Object.keys(days));
  assert.ok(sm.ctx.poorSleep);
  const plan = C.dailyPlan(sm, profile);
  const dinner = plan.find((p) => p.title.startsWith('Dîner'));
  const bed = plan.find((p) => p.title === 'Coucher');
  assert.ok(bed.min - dinner.min >= 180, 'dîner ≥ 3 h avant le coucher');
  assert.ok(plan.some((p) => p.title.includes('sieste')) || plan.some((p) => p.title.includes('Micro-sieste')));
  const act = C.recommendActivity(sm, profile);
  assert.match(act.title, /Marche|yoga/);
});

test('import CSV (format app et Google Fit)', () => {
  const a = parseCSV('date;steps;screenMin;bed\n2026-10-28;8200;190;23:30\n');
  assert.deepEqual(a['2026-10-28'], { steps: 8200, screenMin: 190, bed: '23:30' });
  const g = parseCSV('Date,Move Minutes count,Step count,Average weight (kg)\n2026-10-27,42,10234,71.2\n');
  assert.deepEqual(g['2026-10-27'], { modMin: 42, steps: 10234, weight: 71.2 });
});
