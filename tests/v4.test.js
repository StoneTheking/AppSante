import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as EN from '../src/energy.js';
import * as SP from '../src/sport.js';
import * as C from '../src/coach.js';
import { stepsFromSamples } from '../src/native.js';
import { screenMinutesBetween } from '../src/sleep.js';

const me = { sex: 'h', birthYear: 1990, height: 180, weight: 80, activityLevel: 'leger', goal: 'maintenir', diet: 'omnivore', wakeTime: '07:00', bedTime: '23:00' };
const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

test('podomètre : pas du jour à partir des relevés cumulés (minuit et redémarrage)', () => {
  const midnight = new Date('2026-10-29T00:00').getTime();
  const h = 3600e3;
  // 1000 pas entre 22 h et 2 h (moitié aujourd'hui), +3000 jusqu'à 10 h, redémarrage puis 500 pas
  const samples = [{ t: midnight - 2 * h, v: 10000 }, { t: midnight + 2 * h, v: 11000 }, { t: midnight + 10 * h, v: 14000 }, { t: midnight + 12 * h, v: 500 }];
  assert.equal(stepsFromSamples(samples, midnight), 500 + 3000 + 500);
});

test('activité : calories brûlées (pas + séances, sans double compte de la marche)', () => {
  assert.equal(EN.stepsKcal(10000, 70), 350);
  const w = [{ type: 'marche', minutes: 30, kcal: 150 }];
  assert.equal(EN.activeKcal({ steps: 10000 }, w, 70), EN.stepsKcal(10000 - 3300, 70) + 150);
});

test('poids estimé vs réel : écart et calories manquantes', () => {
  const now = new Date('2026-10-29T12:00');
  const d0 = new Date(now); d0.setDate(d0.getDate() - 20);
  const meals = [], days = {};
  for (let i = 0; i <= 20; i++) { const d = new Date(d0); d.setDate(d.getDate() + i); const k = key(d); meals.push({ date: k, nutrients: { kcal: 2000 } }); days[k] = { steps: 6000 }; }
  const st = { profile: me, meals, days, workouts: [], weights: [{ date: key(d0), kg: 80 }, { date: key(now), kg: 80.5 }] };
  const we = EN.weightEstimate(st, 30, now);
  assert.ok(we.est.at(-1).v < 80, 'repas notés < dépense → baisse estimée');
  assert.ok(we.gap > 0.5, 'le poids réel dépasse l’estimation');
  assert.ok(we.gapKcalPerDay > 200);
  assert.equal(EN.weighDue(st, now).due, false);
  assert.equal(EN.weighDue({ weights: [{ date: key(d0), kg: 80 }] }, now).due, true);
});

test('sport : sports exclus remplacés, ressenti qui adapte la séance suivante', () => {
  const p = { ...me, excludedSports: ['course'], favSports: ['natation'] };
  assert.equal(SP.substitute('course', p), 'natation');
  assert.equal(SP.substitute('renfo', p), 'renfo');
  assert.ok(SP.weekPlan(p, [], new Date()).every((d) => d.type !== 'course'));
  const fb = [{ type: 'renfo', rating: 1 }, { type: 'renfo', rating: 1 }];
  const up = SP.adaptation(fb, 'renfo');
  assert.equal(up.levelShift, 1);
  assert.equal(SP.adaptedLevel('debutant', up), 'intermediaire');
  const down = SP.adaptation([{ type: 'course', rating: -1 }], 'velo'); // même nature (cardio)
  assert.ok(down.easier && down.volume < 1);
  assert.equal(SP.adaptedMinutes(40, down), 35);
});

test('plan du jour : se recale sur les repas pris et la séance faite', () => {
  const today = key(new Date());
  const st = { profile: me, days: {}, meals: [{ date: today, time: '09:30', slot: 'petit-dej', title: 'Omelette', nutrients: { kcal: 600, protein: 30 } }], weights: [], workouts: [{ date: today, start: new Date().toISOString().slice(0, 11) + '12:00:00', type: 'course', minutes: 30, intensity: 'moderee' }] };
  const keys = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return key(d); });
  const sm = C.summarize(st, keys);
  const plan = C.dailyPlan(sm, me);
  const bk = plan.find((p) => p.title.startsWith('Petit-déjeuner'));
  assert.ok(bk.done && bk.time === '09:30');
  const lunch = plan.find((p) => p.title.startsWith('Déjeuner'));
  assert.ok(lunch.min >= 13 * 60 + 30, 'déjeuner ≥ 4 h après le petit-déjeuner réel');
  assert.match(lunch.text, /Il te reste/);
  assert.ok(plan.some((p) => p.done && p.title.startsWith('Séance faite')));
  const rows = C.scoreBreakdown(sm);
  assert.equal(rows.length, 5);
  assert.equal(Math.round(rows.reduce((a, r) => a + r.weight, 0) * 100), 100);
});

test('téléphone avant de dormir : minutes d’écran allumé', () => {
  const bed = 1_000_000_000_000, m = 60000;
  const ev = [{ type: 'unlock', t: bed - 25 * m }, { type: 'off', t: bed - 10 * m }, { type: 'on', t: bed - 3 * m }];
  assert.equal(screenMinutesBetween(ev, bed - 30 * m, bed), 18);
});
