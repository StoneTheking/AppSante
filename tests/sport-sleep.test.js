import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectWake } from '../src/sleep.js';

const at = (h, m = 0, day = 2) => new Date(2026, 9, day, h, m).getTime();
const bed = at(23, 10, 1);

test('réveil détecté : premier déverrouillage du matin suivi d’une utilisation', () => {
  const events = [
    { type: 'on', t: at(1, 5) }, // notification la nuit : ignorée (il y a des déverrouillages)
    { type: 'unlock', t: at(3, 12) }, { type: 'off', t: at(3, 14) }, // réveil nocturne isolé
    { type: 'unlock', t: at(6, 58) }, { type: 'unlock', t: at(7, 20) },
  ];
  const r = detectWake(bed, events, { nowMs: at(9) });
  assert.equal(r.wake, at(6, 58));
  assert.equal(r.nightWakes, 1);
  assert.equal(r.source, 'téléphone');
});

test('réveil à la sonnerie de l’alarme', () => {
  const events = [{ type: 'on', t: at(6, 30) }, { type: 'unlock', t: at(6, 41) }];
  const r = detectWake(bed, events, { alarmMs: at(6, 30), nowMs: at(8) });
  assert.equal(r.wake, at(6, 30));
  assert.equal(r.source, 'alarme');
});

test('pas de faux réveil : coup d’œil isolé à 4 h puis rien', () => {
  const r = detectWake(bed, [{ type: 'unlock', t: at(4, 0) }], { nowMs: at(5) });
  assert.equal(r.wake, null);
  assert.equal(r.nightWakes, 1);
});

import * as SP from '../src/sport.js';

test('sport : dépense (Compendium), classe OMS, zones cardiaques', () => {
  assert.equal(SP.kcal('course', 'moderee', 30, 70), Math.round(9.8 * 70 * 0.5));
  assert.equal(SP.whoClass('marche', 'moderee'), 'mod');
  assert.equal(SP.whoClass('marche', 'legere'), 'mod');
  assert.equal(SP.whoClass('yoga', 'moderee'), 'light');
  assert.equal(SP.whoClass('course', 'moderee'), 'vig');
  const z = SP.hrZones(new Date().getFullYear() - 40);
  assert.equal(z.max, 180);
  assert.deepEqual(z.mod, [115, 137]);
});

test('sport : semaine type selon objectif et sport préféré', () => {
  const plan = SP.weekPlan({ goal: 'perdre', preferredSport: 'Natation' }, [], new Date(2026, 9, 29));
  assert.equal(plan.length, 7);
  assert.equal(plan[0].day, 'Lundi');
  assert.equal(plan[0].type, 'natation');
  assert.equal(plan.filter((d) => d.type === 'renfo').length, 2);
  assert.ok(plan.find((d) => d.today).day === 'Jeudi');
});

import * as W from '../src/workouts.js';

test('séances : renforcement adapté au matériel, au niveau et à la durée', () => {
  const zones = SP.hrZones(1990);
  const s = W.buildSession({ activity: 'renfo', minutes: 40, level: 'intermediaire', equipment: 'halteres', goal: 'maintenir', zones });
  assert.equal(s.title, 'Renforcement corps entier');
  const main = s.blocks[1].items;
  assert.ok(main.some((i) => i.label.includes('haltère')));
  assert.ok(main.every((i) => i.sets === 3));
  assert.ok(s.minutes >= 30 && s.minutes <= 60, `durée ${s.minutes}`);
  const steps = W.flatten(s);
  assert.ok(steps.filter((x) => x.isRest).length > 0);
  const haut = W.buildSession({ activity: 'renfo', minutes: 50, level: 'avance', equipment: 'salle', goal: 'prendre', dayIndex: 0, zones });
  assert.equal(haut.title, 'Renforcement haut du corps');
});

test('séances : fractionné débutant (10 × 1 min) et confirmé (4 × 4 min)', () => {
  const zones = SP.hrZones(1990);
  const deb = W.buildSession({ activity: 'course', intensity: 'intense', level: 'debutant', minutes: 25, zones });
  assert.ok(deb.blocks.some((b) => b.title === '10 × 1 minute'));
  const conf = W.buildSession({ activity: 'velo', intensity: 'intense', level: 'intermediaire', minutes: 40, zones });
  assert.ok(conf.blocks.some((b) => b.title === '4 × 4 minutes'));
  const circuit = W.buildSession({ activity: 'hiit', level: 'intermediaire', equipment: 'aucun', minutes: 20, zones });
  const steps = W.flatten(circuit).filter((x) => x.block.startsWith('Circuit') && !x.isRest);
  assert.equal(steps.length, 6 * 3);
  assert.equal(steps[1].label, 'Squats sautés'); // un passage par exercice et par tour
});
