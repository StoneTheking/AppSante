import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunTimes } from '../src/sun.js';
import * as C from '../src/coach.js';
import * as SP from '../src/sport.js';
import * as R from '../src/review.js';
import { correlations } from '../src/correlate.js';

const me = { sex: 'h', birthYear: 1990, height: 180, weight: 80, activityLevel: 'leger', goal: 'maintenir', diet: 'omnivore', wakeTime: '07:00', bedTime: '23:00' };
const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const keys = (n, end = new Date()) => Array.from({ length: n }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (n - 1) + i); return key(d); });

test('soleil : lever et coucher à Paris, en heure UTC+fuseau du téléphone', () => {
  const tz = -new Date(2026, 5, 21, 12).getTimezoneOffset();
  const s = sunTimes(new Date(2026, 5, 21, 12), { lat: 48.86, lon: 2.35 });
  // 21 juin à Paris : lever ≈ 03:47 UTC, coucher ≈ 19:58 UTC
  assert.ok(Math.abs(s.rise - tz - (3 * 60 + 47)) <= 4, `lever ${s.rise - tz}`);
  assert.ok(Math.abs(s.set - tz - (19 * 60 + 58)) <= 4, `coucher ${s.set - tz}`);
});

test('plan du jour : lever du soleil distinct du réveil, étapes masquées et ajoutées', () => {
  const st = { profile: me, days: {}, meals: [], weights: [], workouts: [], location: { lat: 48.86, lon: 2.35 } };
  const sm = C.summarize(st, keys(14));
  const plan = C.dailyPlan(sm, me);
  const rise = plan.find((p) => p.key === '🌅');
  assert.ok(rise && rise.title === 'Lever du soleil');
  assert.equal(rise.min, sm.sun.rise);
  assert.ok(plan.some((p) => p.key === '🌇'));
  const today = keys(1)[0];
  const edited = C.applyPlanEdits(plan, { hidden: { '☕': 'Dernier café' }, hiddenOn: { [today]: ['🌇'] }, custom: [{ id: 'a', time: '10:00', title: 'Vitamines', date: null }, { id: 'b', time: '11:00', title: 'Hier', date: '2000-01-01' }] }, today);
  assert.ok(!edited.some((p) => p.key === '☕' || p.key === '🌇'));
  assert.ok(edited.some((p) => p.title === 'Vitamines' && p.custom && p.daily));
  assert.ok(!edited.some((p) => p.title === 'Hier'));
});

test('sport exclu : plus jamais proposé dans les conseils', () => {
  const p = { ...me, excludedSports: ['marche'] };
  assert.ok(!/marche/i.test(C.activityLabel(['marche', 'yoga'], p)));
  const st = { profile: p, days: {}, meals: [], weights: [], workouts: [] };
  const sm = C.summarize(st, keys(14));
  sm.ctx.poorSleep = true;
  assert.ok(!/marche/i.test(C.recommendActivity(sm, p).title));
  assert.ok(!C.dailyPlan(sm, p).some((x) => /Marche/.test(x.title)));
});

test('semaine type personnalisée', () => {
  const tpl = SP.DAYS.map((_, i) => (i % 2 ? { type: null, minutes: 0, intensity: 'legere' } : { type: 'renfo', minutes: 40, intensity: 'moderee' }));
  const plan = SP.weekPlan({ ...me, weekTemplate: tpl }, []);
  assert.equal(plan[0].type, 'renfo');
  assert.equal(plan[1].type, null);
  assert.equal(SP.templateStats(tpl).strength, 4);
});

test('corrélations : plus de sommeil après les jours actifs', () => {
  const days = {};
  const ks = keys(40);
  ks.forEach((k, i) => { days[k] = { steps: i % 2 ? 10000 : 3000, mood: 3 }; });
  // nuit suivante : 8 h après un jour actif, 7 h sinon (léger bruit)
  ks.forEach((k, i) => { if (i > 0) days[k].sleepMinutes = (days[ks[i - 1]].steps >= 8000 ? 480 : 420) + (i % 3) * 5; });
  const found = correlations({ days, meals: [], workouts: [] }, { days: 40 });
  const c = found.find((x) => x.driver === 'steps' && x.outcome === 'sleep');
  assert.ok(c, 'corrélation trouvée');
  assert.match(c.text, /Tu dors 1 h de plus les nuits qui suivent un jour à plus de 8 000 pas/);
});

test('bilan du dimanche : objectif sur le point faible et suivi', () => {
  const ks = keys(14);
  const days = Object.fromEntries(ks.map((k) => [k, { steps: 3000, sleepMinutes: 470, mood: 4, energy: 4, stress: 2, screenMin: 90, socialMin: 10 }]));
  const st = { profile: me, days, meals: [], weights: [], workouts: [] };
  const rv = R.weekReview(st);
  assert.equal(rv.weakest, 'activite');
  assert.equal(rv.goal.kind, 'steps');
  const goal = { ...rv.goal, start: ks[8] };
  ks.slice(8).forEach((k) => { days[k].steps = rv.goal.value; });
  const pr = R.goalProgress(st, goal);
  assert.ok(pr.ok >= 4 && pr.done);
  const sunday = new Date('2026-11-01T18:00');
  assert.equal(R.reviewDue({}, sunday), '2026-11-01');
  assert.equal(R.reviewDue({ reviewSeen: '2026-11-01' }, sunday), null);
  assert.equal(R.reviewDue({}, new Date('2026-11-03T10:00')), null);
});
