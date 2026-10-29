import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/family.js';
import * as PT from '../src/pantry.js';
import * as D from '../src/digestion.js';
import * as E from '../src/env.js';
import * as S from '../src/science.js';

const me = { sex: 'h', birthYear: 1990, height: 180, weight: 80, activityLevel: 'leger', goal: 'maintenir', diet: 'omnivore', allergies: 'noix' };

test('foyer : besoins des enfants (EFSA), contraintes communes', () => {
  assert.equal(F.memberKcal({ age: 8, sex: 'f' }), 1700);
  const fam = [{ age: 8, sex: 'f', diet: 'vegetarien', allergies: 'arachide' }];
  assert.deepEqual(F.familyConstraints(me, fam), { diet: 'vegetarien', allergies: 'noix, arachide' });
  assert.ok(F.familyFactor(me, fam) > 1.5 && F.familyFactor(me, fam) < 2);
});

test('goûts : déclarés + appris des notes', () => {
  const taste = F.tasteProfile({ likes: 'saumon', dislikes: 'brocolis' }, [{ title: 'Curry de lentilles', rating: 5 }, { title: 'Chou-fleur gratiné', rating: 1 }]);
  assert.ok(F.tasteScore('Saumon, quinoa', taste).s > 0);
  assert.ok(F.tasteScore('Poulet, brocolis', taste).s < 0);
  assert.ok(F.tasteScore('Dahl de lentilles corail', taste).s > 0);
  assert.ok(F.tasteScore('Gratin de chou-fleur', taste).s < 0);
});

test('ticket de caisse : qualité du panier et garde-manger', () => {
  const items = [
    { name: 'Pommes', qty: 1000, unit: 'g', price: 3, category: 'Fruits & légumes', nova: 1 },
    { name: 'Soda', qty: 1500, unit: 'mL', price: 3, category: 'Boissons sucrées', nova: 4 },
  ];
  const st = PT.basketStats(items);
  assert.equal(st.upf, 0.5);
  assert.ok(PT.basketAdvice(st).some((a) => a.src.includes('malik2019')));
  const pantry = PT.addToPantry(PT.addToPantry([], items, 'x'), items, 'y');
  assert.equal(pantry.length, 2);
  assert.equal(pantry[0].qty, 2000);
  assert.ok(PT.inPantry(pantry, 'Pomme'));
});

test('transit : Bristol et aliments suspects (fenêtre 8-48 h)', () => {
  const meals = [], stools = [];
  for (let i = 0; i < 6; i++) {
    const d = `2026-10-${String(10 + i).padStart(2, '0')}`;
    meals.push({ date: d, time: '12:00', title: i % 2 ? 'Salade quinoa' : 'Pizza fromage' });
    stools.push({ at: new Date(`2026-10-${String(11 + i).padStart(2, '0')}T08:00`).toISOString(), bristol: i % 2 ? 4 : 7 });
  }
  const sus = D.suspects(stools, meals);
  assert.equal(sus[0].word, 'pizza');
  assert.ok(!sus.some((x) => x.word === 'quinoa'));
  const sum = D.digestionSummary(stools, new Date('2026-10-18'));
  assert.equal(sum.count, 6);
});

test('environnement : alertes pollution et chaleur sourcées', () => {
  const env = { place: 'X', aqi: 75, pm25: 30, tMax: 34, tMin: 22, uvMax: 8, pollen: [], hours: [{ hour: 8, aqi: 40, temp: 22, rain: 0, uv: 1 }, { hour: 15, aqi: 80, temp: 34, rain: 0, uv: 8 }] };
  const ins = E.envInsights(env, { allergies: '', conditions: '' });
  for (const id of ['who2021air', 'ebi2021', 'obradovich2017', 'whouv']) assert.ok(ins.some((i) => i.src.includes(id)), id);
  assert.equal(E.bestOutdoorHour(env, 7 * 60, 20 * 60).hour, 8);
  for (const i of ins) for (const id of i.src) assert.ok(S.SOURCES[id], id);
});

import * as SN from '../src/snacks.js';
test('grignotages : bilan de la semaine et conseils sourcés', () => {
  const today = new Date().toISOString().slice(0, 10);
  const meals = [
    { date: today, time: '16:00', title: 'Biscuits', snack: true, snackId: 'biscuits', reason: 'ecran', nutrients: { kcal: 115 } },
    { date: today, time: '22:00', title: 'Chips', snack: true, snackId: 'chips', reason: 'ecran', nutrients: { kcal: 160 } },
    { date: today, time: '12:30', title: 'Déjeuner', nutrients: { kcal: 700 } },
  ];
  const s = SN.snackSummary(meals);
  assert.equal(s.count, 2);
  assert.equal(s.kcal, 275);
  assert.equal(s.topReason[0], 'ecran');
  assert.ok(s.advice.some((a) => a.src.includes('robinson2013')));
  assert.ok(s.advice.some((a) => a.src.includes('bellisle2014')));
  for (const a of s.advice) for (const id of a.src) assert.ok(S.SOURCES[id], id);
});
