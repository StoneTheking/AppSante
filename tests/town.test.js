import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/town.js';

const keyOf = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const NOW = new Date('2026-11-02T15:00:00');
function state(nDays, day) {
  const days = {};
  for (let i = 0; i < nDays; i++) { const d = new Date(NOW); d.setDate(d.getDate() - i); days[keyOf(d)] = day(i); }
  return { profile: { sex: 'h', birthYear: 1990, height: 178, weight: 75, activityLevel: 'leger' }, days, meals: [], workouts: [], sleepLog: [], receipts: [] };
}
const good = () => ({ steps: 12000, sleepMinutes: 470, waterMl: 2600, mood: 4 });
const bad = () => ({ steps: 1500, sleepMinutes: 290, waterMl: 500 });

test('le terrain s’agrandit avec le niveau', () => {
  assert.equal(T.radiusFor(1), 1);
  assert.equal(T.radiusFor(2), 2);
  assert.equal(T.radiusFor(4), 3);
  assert.equal(T.radiusFor(6), 4);
  assert.equal(T.radiusFor(20), 4);
  for (const r of [2, 3, 4]) assert.equal(T.radiusFor(T.levelForRadius(r)), r);
});

test('la santé fait la vitalité, la météo, la population et le bonheur', () => {
  const town = T.starter(NOW);
  const mg = T.model(state(30, good), town, NOW);
  const mb = T.model(state(30, (i) => (i < 8 ? bad() : good())), town, NOW);
  assert.ok(mg.vitality > mb.vitality + 30, `${mg.vitality} vs ${mb.vitality}`);
  assert.equal(mg.dom.water, 1);
  assert.ok(mb.dom.water < 0.45);
  assert.ok(mg.weather.startsWith('soleil'));
  assert.ok(mb.weather.startsWith('pluie') && mb.weather.includes('brume')); // mauvaises nuits → brume
  assert.ok(mg.population > mb.population);
  assert.ok(mg.happiness > mb.happiness + 15);
  // la fontaine dépend de l'hydratation
  assert.equal(mb.buildings.find((b) => b.b === 'fountain').state, 'low');
  assert.equal(mg.buildings.find((b) => b.b === 'fountain').state, 'top');
});

test('aujourd’hui ne pénalise pas la ville tant que la journée n’est pas finie', () => {
  const st = state(10, (i) => (i === 0 ? {} : good()));
  const d = T.domains(st, NOW);
  assert.equal(d.move, 1);
  assert.equal(d.water, 1);
});

test('construire, améliorer, vendre, déplacer : coûts, niveau et parcelles', () => {
  const st = state(40, good);
  const town = T.starter(NOW);
  let m = T.model(st, town, NOW);
  const coins = m.coins;
  assert.ok(coins >= T.START_COINS);
  assert.match(T.build(town, m, '4,4', 'house'), /occupée/); // la mairie
  assert.match(T.build(town, m, m.free[0], 'stadium'), /niveau 7/);
  const small = state(8, good), ms = T.model(small, T.starter(NOW), NOW);
  assert.ok(ms.radius < 4);
  assert.match(T.build(T.starter(NOW), ms, '0,0', 'house'), /pas encore débloquée/);
  const k = m.free[0];
  assert.equal(T.build(town, m, k, 'house'), null);
  m = T.model(st, town, NOW);
  assert.equal(m.coins, coins - 30);
  assert.ok(!m.free.includes(k));
  // amélioration : plus de places de logement
  const cap0 = m.capacity;
  assert.equal(T.upgrade(town, m, k), null);
  m = T.model(st, town, NOW);
  assert.ok(m.capacity > cap0);
  // déplacement puis vente (moitié du prix × niveau)
  const to = m.free[0];
  assert.equal(T.move(town, m, k, to), null);
  m = T.model(st, town, NOW);
  const before = m.coins;
  assert.equal(T.sell(town, m, to), null);
  assert.equal(T.model(st, town, NOW).coins, before + 30);
  // pas assez de pièces
  const poor = { ...T.starter(NOW), spent: 10000 };
  assert.match(T.build(poor, T.model(st, poor, NOW), m.free[0], 'house'), /Il manque/);
});

test('les commerces rapportent selon leur domaine de santé, au plus 12 h', () => {
  const town = T.starter(new Date(NOW.getTime() - 48 * 3600e3));
  const mg = T.model(state(30, good), town, NOW), mb = T.model(state(30, (i) => (i < 8 ? bad() : good())), town, NOW);
  const g = mg.buildings.find((b) => b.b === 'fountain');
  assert.ok(T.rateOf(g, mg.dom, mg.vitality) > T.rateOf(g, mb.dom, mb.vitality));
  assert.ok(mg.pending > 0);
  const capped = mg.pending;
  const later = T.model(state(30, good), town, new Date(NOW.getTime() + 24 * 3600e3));
  assert.ok(later.pending <= capped * 1.2, 'plafond de 12 h');
  const t = structuredClone(town);
  const got = T.collectAll(t, mg);
  assert.ok(got > 0);
  assert.equal(t.collected, got);
});

test('habitants : déterministes, logés, interactions une fois par jour', () => {
  const st = state(30, good);
  const town = T.starter(NOW);
  const m = T.model(st, town, NOW);
  assert.ok(m.residents.length > 0);
  assert.deepEqual(T.model(st, town, NOW).residents.map((r) => r.name), m.residents.map((r) => r.name));
  for (const r of m.residents) assert.ok(m.buildings.find((b) => b.k === r.home && b.def.kind === 'home'));
  const id = m.residents[0].id;
  assert.equal(T.interact(town, m, id, 'greet', NOW), null);
  assert.match(T.interact(town, T.model(st, town, NOW), id, 'greet', NOW), /Déjà/);
  const m2 = T.model(st, town, NOW);
  assert.ok(m2.residents[0].happy >= m.residents[0].happy);
  assert.match(T.thought(m2.residents[0], m2, NOW), /^(Bonjour|Salut|Bonsoir)/);
  // inviter au sport demande une salle de sport et le niveau 4
  assert.match(T.interact(town, m2, id, 'sport', NOW), /niveau|Il faut/);
});

test('objectifs : récompense réclamée une seule fois', () => {
  const st = state(30, good);
  const town = T.starter(NOW);
  const m = T.model(st, town, NOW);
  assert.ok(m.goals.find((g) => g.id === 'shop').done); // le primeur de départ
  assert.equal(T.claim(town, m, 'shop'), 20);
  assert.equal(T.claim(town, T.model(st, town, NOW), 'shop'), 0);
  assert.equal(T.claim(town, m, 'pop50'), 0);
});
