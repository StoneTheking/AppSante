import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/science.js';
import * as BC from '../src/barcode.js';
import * as P from '../src/planner.js';
import { buildReminders } from '../src/reminders.js';

const profile = { sex: 'f', birthYear: 1990, height: 165, weight: 60, activityLevel: 'leger', goal: 'maintenir', diet: 'vegetarien', allergies: 'noix', wakeTime: '07:00', bedTime: '23:00' };

test('Open Food Facts : normalisation et verdict personnalisé', () => {
  const prod = BC.normalize({ product_name: 'Soda', nutriscore_grade: 'e', nova_group: 4, additives_tags: ['en:e150d', 'en:e951'], allergens_tags: [], nutriments: { 'energy-kcal_100g': 42, sugars_100g: 10.6, salt_100g: 0.02 } }, '123');
  assert.equal(prod.per100.sodium, 8);
  assert.equal(prod.additives[0].name, 'Caramel au sulfite d’ammonium');
  const t = S.targets(profile);
  const v = BC.verdict(prod, 330, { targets: t, totToday: S.sumNutrients([]), profile });
  assert.equal(v.verdict, 'a_limiter');
  assert.ok(Math.abs(v.n.kcal - 138.6) < 0.1);
  const nutella = BC.normalize({ product_name: 'Pâte', allergens_tags: ['en:nuts'], nutriments: {} }, '1');
  assert.equal(BC.verdict(nutella, 15, { targets: t, totToday: S.sumNutrients([]), profile }).score, 0, 'allergène déclaré → 0');
});

test('menus hors-ligne : régime respecté, liste de courses agrégée', () => {
  const plan = P.offlinePlan({ targets: S.targets(profile), profile });
  assert.equal(plan.days.length, 7);
  const names = plan.days.flatMap((d) => d.meals.map((m) => m.name)).join(' ').toLowerCase();
  for (const bad of ['poulet', 'dinde', 'saumon', 'cabillaud', 'sardine', 'noix']) assert.ok(!names.includes(bad), bad);
  const list = P.shoppingList(plan);
  const items = Object.values(list).flat();
  assert.ok(items.length > 5);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'ingrédients dédoublonnés');
});

test('rappels : seulement les types activés et dans le futur', () => {
  const plan = [{ min: 8 * 60, title: 'Dernier café', text: 'Après cette heure. Bla.' }, { min: 22 * 60, title: 'Écrans off — téléphone hors de la chambre', text: 'x.' }, { min: 12 * 60, title: 'Déjeuner — repas principal', text: 'y.' }];
  const now = new Date(); now.setHours(10, 0, 0, 0);
  const r = buildReminders([plan], { kinds: { coffee: true, screens: true, meal: false } }, now);
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'screens');
  assert.equal(r[0].at.getHours() * 60 + r[0].at.getMinutes(), 22 * 60 - 10);
});

test('base scientifique : toutes les références citées existent', () => {
  for (const t of S.EVIDENCE) for (const [, src] of t.facts) for (const id of src) assert.ok(S.SOURCES[id], id);
  const f = S.riskFactors({ restingHR: 80 });
  assert.ok(Math.abs(f[0].rr - 1.09 ** 2) < 1e-9);
});
