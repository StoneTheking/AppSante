import test from 'node:test';
import assert from 'node:assert/strict';
import { unitOf, packGrams, normalize, defaultGrams } from '../src/barcode.js';
import { lines, face } from '../src/diana.js';

const u = (p) => unitOf(p, packGrams(p), Number(p.serving_quantity) || null);

test('une barre de Balisto se compte en portions, pas en grammes', () => {
  assert.deepEqual(u({ product_name: 'Balisto', quantity: '9 x 18,5 g' }), { g: 18.5, one: 'portion', many: 'portions', count: 9 });
  assert.equal(u({ product_name: 'Balisto', quantity: 'x9', product_quantity: 166.5, product_quantity_unit: 'g' }).g, 18.5);
  assert.equal(u({ product_name: 'Yaourt nature', quantity: '4 x 125 g' }).g, 125);
  assert.equal(u({ product_name: 'Coca-Cola', quantity: '33 cl' }).g, 330);
  assert.equal(u({ product_name: 'Pâtes', quantity: '500 g' }), null);
  // crêpe Wahou : « chocolat » ne doit pas faire penser à du cola, et une portion n'est pas tout le paquet
  const crepe = u({ product_name: 'Crêpe fourrée chocolat au lait', quantity: '250 g', categories_tags: ['en:crepes'] });
  assert.equal(crepe.one, 'portion'); assert.ok(crepe.g < 60, String(crepe.g));
  assert.equal(u({ product_name: 'Crêpe fourrée chocolat', quantity: '250 g', serving_quantity: 32, categories_tags: ['en:crepes'] }).g, 32);
  assert.equal(u({ product_name: 'Crêpe', quantity: '250 g', serving_quantity: 250, categories_tags: ['en:crepes'] }).g, 35);
  assert.equal(u({ product_name: '6 Crêpes Nature', quantity: '360 g' }).g, 60);
  assert.equal(defaultGrams(normalize({ product_name: 'Balisto', quantity: '9 x 18,5 g', nutriments: { 'energy-kcal_100g': 500 } }, '1')), 18.5);
});

test('Coach Diana a toujours quelque chose à dire, partout', () => {
  const st = { profile: { name: 'Léa', wakeTime: '07:00', bedTime: '23:00' }, days: {}, meals: [], workouts: [] };
  const sm = { today: {}, mealsToday: [], totToday: { kcal: 0 }, t: { kcal: 2000, steps: 8000, waterMl: 2000 }, scores: {}, workoutsToday: [] };
  for (const w of ['home', 'nutrition', 'sport', 'health']) assert.ok(lines(w, st, sm).length >= 1, w);
  assert.ok(lines('guided', st, null, { step: { isRest: true }, i: 3, n: 10 })[0][0].includes('Souffle'));
  assert.match(face('cheer'), /<canvas class="diana-orb"/);
});
