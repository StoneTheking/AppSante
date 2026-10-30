import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, per100Of } from '../src/barcode.js';
import { sleepWeek, sleepNeed, socialJetlag } from '../src/science.js';
import { parseVideoList, NEEDS_VIDEO } from '../src/videos.js';
import { hasTuto } from '../src/workouts.js';
import { isGeminiKey } from '../src/gemini.js';

test('Open Food Facts : valeurs « préparé » et par portion reprises', () => {
  const p = normalize({ product_name_fr: 'Kinder Bueno', serving_quantity: 21.5, nutriments: { 'energy-kcal_prepared_100g': 567.4, proteins_prepared_100g: 8.37, sugars_serving: 8.9 } }, '1');
  assert.equal(Math.round(p.per100.kcal), 567);
  assert.equal(p.per100.protein, 8.37);
  assert.equal(Math.round(p.per100.sugar), 41);
  assert.equal(p.missing, false);
  assert.equal(per100Of({}, 'fat', 20), null);
  assert.equal(normalize({ nutriments: {} }, '2').missing, true);
});

test('bilan sommeil : dette sur les nuits notées', () => {
  const days = { a: { sleepMinutes: 360 }, b: { bed: '23:00', wake: '07:00' }, c: {} };
  const w = sleepWeek(days, { birthYear: 1990, bedTime: '23:00', wakeTime: '07:00' }, ['a', 'b', 'c']);
  assert.equal(w.noted, 2);
  assert.equal(w.slept, 840);
  assert.equal(w.need.target, 7.75);
  assert.equal(w.debt, 930 - 840);
  assert.equal(w.short, 1);
  assert.equal(sleepNeed({ birthYear: new Date().getFullYear() - 16 }).min, 8);
});

test('décalage horaire social', () => {
  // samedi/dimanche couchés 2 h plus tard
  const days = { '2026-10-24': { bed: '01:00', wake: '09:00' }, '2026-10-25': { bed: '01:00', wake: '09:00' }, '2026-10-26': { bed: '23:00', wake: '07:00' }, '2026-10-27': { bed: '23:00', wake: '07:00' } };
  assert.equal(socialJetlag(days, Object.keys(days)), 120);
  assert.equal(socialJetlag({ '2026-10-26': days['2026-10-26'] }, ['2026-10-26']), null);
});

test('vidéos : seulement les exercices techniques, import de liste', () => {
  assert.equal(hasTuto({ label: 'Pompes' }), true);
  assert.equal(hasTuto({ label: 'Course à allure modérée' }), false);
  assert.equal(hasTuto({ label: 'Marche rapide' }), false);
  const m = parseVideoList('## Renforcement\nPompes | https://youtu.be/abc\nInconnu | https://x.y\nPlanche | \n');
  assert.deepEqual(m, { Pompes: 'https://youtu.be/abc' });
  assert.ok(NEEDS_VIDEO.size > 30);
});

test('détection de clé Gemini', () => {
  assert.equal(isGeminiKey('AIzaSyA1234567890abcdefghijklmnopqrstu'), true);
  assert.equal(isGeminiKey('sk-ant-api03-xxx'), false);
});
