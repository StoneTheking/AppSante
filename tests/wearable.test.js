import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/wearable.js';
import { correlations } from '../src/correlate.js';

const iso = (s) => new Date(s).toISOString();
const keyOf = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

test('sommeil Fitbit : phases, éveils, efficacité ; la nuit la plus détaillée l’emporte sur un doublon', () => {
  const st = (a, b, stage) => ({ startDate: iso(a), endDate: iso(b), stage });
  const fitbit = {
    startDate: iso('2026-10-30T23:00'), endDate: iso('2026-10-31T07:00'), value: 480, sourceId: 'com.fitbit.FitbitMobile', sourceName: 'Google Pixel Watch',
    stages: [
      st('2026-10-30T23:00', '2026-10-30T23:10', 'awake'), // endormissement : pas un éveil nocturne
      st('2026-10-30T23:10', '2026-10-31T01:00', 'light'),
      st('2026-10-31T01:00', '2026-10-31T02:00', 'deep'),
      st('2026-10-31T02:00', '2026-10-31T02:20', 'awake'), // éveil nocturne > 5 min
      st('2026-10-31T02:20', '2026-10-31T04:00', 'rem'),
      st('2026-10-31T04:00', '2026-10-31T04:03', 'awake'), // trop court
      st('2026-10-31T04:03', '2026-10-31T07:00', 'light'),
    ],
  };
  // même nuit écrite par une autre appli, sans phases
  const other = { startDate: iso('2026-10-30T23:30'), endDate: iso('2026-10-31T07:30'), value: 480, sourceId: 'com.sec.android.app.shealth' };
  const nap = { startDate: iso('2026-10-31T14:00'), endDate: iso('2026-10-31T14:30'), value: 30, sourceId: 'com.fitbit.FitbitMobile' };
  const out = W.nightsFromSessions([fitbit, other, nap]);
  const n = out['2026-10-31'];
  assert.equal(n.bed, '23:00');
  assert.equal(n.wake, '07:00');
  assert.equal(n.deepMin, 60);
  assert.equal(n.remMin, 100);
  assert.equal(n.awakeMin, 33);
  assert.equal(n.sleepMinutes, 480 - 33); // les éveils ne comptent pas comme du sommeil
  assert.equal(n.wakeups, 1);
  assert.equal(n.sleepEfficiency, Math.round((447 / 480) * 100));
  assert.equal(n.sleepSource, 'Fitbit');
  assert.equal(n.napMin, 30); // la sieste ne déplace pas l'heure du coucher
});

test('cœur minute par minute : seules les périodes d’au moins 3 min en zone comptent', () => {
  const hrMax = 190; // modérée ≥ 122, soutenue ≥ 146
  const t0 = new Date('2026-10-31T10:00').getTime();
  const samples = [];
  const at = (min, v) => samples.push({ startDate: new Date(t0 + min * 60000).toISOString(), value: v });
  for (let m = 0; m < 10; m++) at(m, 80);
  at(10, 160); // pic isolé : ignoré
  for (let m = 11; m < 20; m++) at(m, 80);
  for (let m = 20; m < 30; m++) at(m, 130); // 10 min modérées
  for (let m = 30; m < 35; m++) at(m, 150); // 5 min soutenues
  at(36, 150); // un trou d'une minute ne coupe pas la période
  at(37, 999); // valeur aberrante ignorée
  const z = W.zoneMinutes(W.hrByMinute(samples), hrMax)[keyOf(new Date(t0))];
  assert.equal(z.zoneMod, 10);
  assert.equal(z.zoneVig, 6);
});

test('cœur pendant la nuit : moyenne et plus bas sur 5 min', () => {
  const t0 = new Date('2026-10-31T00:00').getTime();
  const samples = Array.from({ length: 300 }, (_, i) => ({ startDate: new Date(t0 + i * 60000).toISOString(), value: i >= 200 && i < 210 ? 48 : 58 }));
  const r = W.nightHR(W.hrByMinute(samples), t0, t0 + 300 * 60000);
  assert.equal(r.sleepHRMin, 48);
  assert.ok(r.sleepHR >= 57 && r.sleepHR <= 58);
  assert.equal(W.nightHR(new Map(), t0, t0 + 1), null);
});

test('minutes d’activité : séance ou zones cardio, sans double comptage', () => {
  assert.deepEqual(W.activeMin({ modMin: 40, vigMin: 0, zoneMod: 10, zoneVig: 30 }), { mod: 10, vig: 30 });
  assert.deepEqual(W.activeMin({ modMin: 40, vigMin: 20, zoneMod: 10, zoneVig: 5 }), { mod: 40, vig: 20 });
  assert.equal(W.modOf({}), 0);
});

const daysWith = (n, f) => {
  const out = {};
  for (let i = 0; i < n; i++) { const d = new Date('2026-10-31T12:00'); d.setDate(d.getDate() - i); out[keyOf(d)] = f(i); }
  return out;
};

test('forme du jour : comparée à tes propres valeurs, basse après une mauvaise nuit et une VFC effondrée', () => {
  const base = (i) => ({ hrv: 50 + (i % 3), restingHR: 58 + (i % 2), sleepMinutes: 450, sleepEfficiency: 90 });
  const good = daysWith(29, base);
  const bad = daysWith(29, (i) => (i === 0 ? { hrv: 32, restingHR: 66, sleepMinutes: 300, sleepEfficiency: 75 } : base(i)));
  const r1 = W.readiness(good, '2026-10-31');
  const r2 = W.readiness(bad, '2026-10-31');
  assert.ok(r1.score >= 70, `bonne forme attendue, obtenu ${r1.score}`);
  assert.equal(r2.level, 'basse');
  // sans historique cardiaque : pas de score (ce ne serait qu'un score de sommeil)
  assert.equal(W.readiness({ '2026-10-31': { sleepMinutes: 400 } }, '2026-10-31'), null);
});

test('phases de la semaine et liens personnels avec les mesures de la montre', () => {
  const s = W.stageSummary([{ sleepMinutes: 400, deepMin: 40, remMin: 90, lightMin: 270, wakeups: 2, sleepEfficiency: 82 }, { sleepMinutes: 400, deepMin: 40, remMin: 90, lightMin: 270, wakeups: 1, sleepEfficiency: 86 }]);
  assert.equal(s.deepPct, 10);
  assert.equal(s.efficiency, 84);
  assert.equal(s.wakeups, 1.5);
  // alcool un soir sur deux → VFC plus basse et cœur plus rapide la nuit suivante
  const now = new Date('2026-10-31T12:00');
  const days = daysWith(40, (i) => ({ alcohol: i % 2 ? 2 : 0 }));
  for (const k of Object.keys(days)) {
    const prev = new Date(k + 'T12:00'); prev.setDate(prev.getDate() - 1);
    const drank = (days[keyOf(prev)]?.alcohol || 0) > 0;
    Object.assign(days[k], { hrv: (drank ? 38 : 50) + (k.charCodeAt(9) % 3), sleepHR: (drank ? 64 : 57) + (k.charCodeAt(9) % 2) });
  }
  const res = correlations({ days, meals: [], workouts: [] }, { days: 40, now });
  assert.ok(res.some((r) => r.driver === 'alcohol' && r.outcome === 'hrv' && /plus basse/.test(r.text)));
  assert.ok(res.some((r) => r.driver === 'alcohol' && r.outcome === 'nightHR' && /plus vite/.test(r.text)));
});

test('sources : Fitbit reconnu', () => {
  assert.equal(W.sourceLabel('com.fitbit.FitbitMobile'), 'Fitbit');
  assert.ok(W.isFitbit({ sourceId: 'com.fitbit.FitbitMobile' }));
});
