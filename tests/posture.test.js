import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/gamify.js';
import * as PO from '../src/posture.js';

const base = () => ({ profile: { sex: 'h', birthYear: 1990, height: 180, weight: 80, activityLevel: 'leger', goal: 'maintenir' }, days: {}, meals: [], workouts: [], sleepLog: [], receipts: [] });
const addDays = (k, n) => G.dayKeyOffset(n, new Date(k + 'T12:00'));
const today = G.dayKeyOffset(0);
// journée avec 3 quêtes faites (humeur, eau, sommeil)
const goodDay = (st, k) => { st.days[k] = { mood: 4, waterMl: 5000, sleepMinutes: 480 }; };

test('photo « à travailler » : routine posture ajoutée en quête obligatoire pendant 21 jours', () => {
  const st = base();
  assert.equal(PO.applyCheck(st, { is_person: true, usable: true, score: 45, verdict: 'a_travailler' }, today, addDays), 'required');
  goodDay(st, today);
  let goals = G.dayGoals(st, today);
  const q = goals.find((g) => g.id === 'posture');
  assert.ok(q && q.required && !q.done);
  assert.equal(G.dayOk(goals, 3), false); // 3 quêtes faites mais pas la posture : journée non validée
  assert.equal(G.streak(st).todayOk, false);
  st.posture.done = { [today]: true };
  goals = G.dayGoals(st, today);
  assert.equal(G.dayOk(goals, 3), true);
  assert.ok(!G.postureRequired(st, addDays(today, 21)));
  assert.ok(G.postureRequired(st, addDays(today, 20)));
});

test('nouvelle photo correcte : obligation levée ; photo inexploitable : rien ne change', () => {
  const st = base();
  PO.applyCheck(st, { score: 40, verdict: 'a_travailler' }, today, addDays);
  assert.equal(PO.applyCheck(st, { usable: false, score: 30, verdict: 'a_travailler' }, today, addDays), 'unusable');
  assert.ok(G.postureRequired(st, today));
  assert.equal(PO.applyCheck(st, { usable: true, is_person: true, score: 72, verdict: 'correcte' }, today, addDays), 'lifted');
  assert.ok(!G.postureRequired(st, today));
  assert.ok(!G.dayGoals(st, today).some((g) => g.id === 'posture'));
  assert.equal(st.posture.checks.length, 3);
});

test('sans photo de posture : toujours 5 quêtes', () => {
  assert.equal(G.dayGoals(base(), today).length, 5);
});

test('bilan posture « à travailler » : la routine devient une quête obligatoire à partir d’aujourd’hui', async () => {
  const PO = await import('../src/posture.js');
  const G = await import('../src/gamify.js');
  const add = (k, n) => G.dayKeyOffset(n, new Date(k + 'T12:00'));
  const bad = { posture: { answers: { sit: 2, phone: 2, breaks: 2, screen: 1, neck: 1, back: 1 } }, days: {} };
  const days = [{ key: '2026-11-02', steps: 4000 }];
  assert.equal(PO.syncRequirement(bad, days, '2026-11-02', add), 'required');
  assert.ok(G.postureRequired(bad, '2026-11-02'));
  assert.ok(!G.postureRequired(bad, '2026-11-01')); // les jours passés ne changent pas
  // faire la routine n'enlève pas la quête le lendemain
  bad.posture.done = { '2026-11-02': true };
  assert.equal(PO.syncRequirement(bad, days, '2026-11-03', add), 'kept');
  // bilan refait et correct : obligation levée
  bad.posture.answers = { sit: 0, phone: 0, breaks: 0, screen: 0, neck: 0, back: 0 };
  assert.equal(PO.syncRequirement(bad, [{ key: '2026-11-04', steps: 9000 }], '2026-11-04', add), 'lifted');
  assert.ok(!G.postureRequired(bad, '2026-11-04'));
});
