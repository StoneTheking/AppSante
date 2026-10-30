import test from 'node:test';
import assert from 'node:assert/strict';
import { unitOf, packGrams, normalize, defaultGrams } from '../src/barcode.js';
import { lines, face } from '../src/diana.js';

const u = (p) => unitOf(p, packGrams(p), Number(p.serving_quantity) || null);

test('une barre de Balisto se compte à l’unité, pas en grammes', () => {
  assert.deepEqual(u({ product_name: 'Balisto', quantity: '9 x 18,5 g' }), { g: 18.5, one: 'barre', many: 'barres', count: 9 });
  assert.equal(u({ product_name: 'Balisto', quantity: 'x9', product_quantity: 166.5, product_quantity_unit: 'g' }).g, 18.5);
  assert.equal(u({ product_name: 'Yaourt nature', quantity: '4 x 125 g' }).one, 'pot');
  assert.equal(u({ product_name: 'Coca-Cola', quantity: '33 cl' }).one, 'canette');
  assert.equal(u({ product_name: 'Pâtes', quantity: '500 g' }), null);
  assert.equal(defaultGrams(normalize({ product_name: 'Balisto', quantity: '9 x 18,5 g', nutriments: { 'energy-kcal_100g': 500 } }, '1')), 18.5);
});

test('Coach Diana a toujours quelque chose à dire, partout', () => {
  const st = { profile: { name: 'Léa', wakeTime: '07:00', bedTime: '23:00' }, days: {}, meals: [], workouts: [] };
  const sm = { today: {}, mealsToday: [], totToday: { kcal: 0 }, t: { kcal: 2000, steps: 8000, waterMl: 2000 }, scores: {}, workoutsToday: [] };
  for (const w of ['home', 'nutrition', 'sport', 'health']) assert.ok(lines(w, st, sm).length >= 1, w);
  assert.ok(lines('guided', st, null, { step: { isRest: true }, i: 3, n: 10 })[0][0].includes('Souffle'));
  assert.match(face('cheer'), /<svg/);
});
