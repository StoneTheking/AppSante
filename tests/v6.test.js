import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/coach.js';
import * as G from '../src/gamify.js';
import * as SP from '../src/sport.js';
import * as W from '../src/workouts.js';

const me = { sex: 'h', birthYear: 1990, height: 180, weight: 80, activityLevel: 'leger', goal: 'maintenir', diet: 'omnivore', wakeTime: '07:00', bedTime: '23:00' };
const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const keys = (n, end = new Date()) => Array.from({ length: n }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (n - 1) + i); return key(d); });
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

test('humeur : suivie mais hors du score global', () => {
  assert.equal(C.SCORE_WEIGHTS.humeur, 0);
  const base = { profile: me, days: {}, meals: [], weights: [], workouts: [] };
  const ks = keys(14);
  const low = structuredClone(base), high = structuredClone(base);
  for (const k of ks) { low.days[k] = { steps: 8000, mood: 1, energy: 1, stress: 5 }; high.days[k] = { steps: 8000, mood: 5, energy: 5, stress: 1 }; }
  assert.equal(C.summarize(low, ks).scores.global, C.summarize(high, ks).scores.global);
});

test('niveau : monte avec les journées validées, baisse avec les journées ratées, plus fort en haut', () => {
  const st = { profile: me, days: {}, meals: [], weights: [], workouts: [], sleepLog: [], receipts: [] };
  const ks = keys(31).slice(0, 30); // 30 jours avant aujourd'hui
  const good = { steps: 12000, waterMl: 3000, mood: 4, sleepMinutes: 480 };
  for (const k of ks.slice(0, 20)) st.days[k] = { ...good };
  const after20 = G.progress(st, new Date(`${ks[20]}T12:00:00`));
  assert.ok(after20.level >= 3, `niveau ${after20.level}`);
  for (const k of ks.slice(20)) st.days[k] = { mood: 0 };
  const p = G.progress(st);
  assert.ok(p.xp < after20.xp, 'les jours ratés font perdre des XP');
  assert.ok(G.missPenalty(5, 0) > G.missPenalty(1, 0));
  assert.equal(G.missPenalty(3, 3), 0);
  assert.ok(p.atStake > 0);
});

test('plan du jour : contourne les heures de travail', () => {
  const dow = new Date().getDay();
  const p = { ...me, work: { enabled: true, days: [dow], start: '09:00', end: '18:00', commute: 30 } };
  const st = { profile: p, days: {}, meals: [], weights: [], workouts: [] };
  const plan = C.dailyPlan(C.summarize(st, keys(14)), p);
  assert.ok(plan.some((i) => i.key === '💼' && i.time === '08:30'));
  const sport = plan.find((i) => i.key === '🏃');
  assert.ok(sport.min < 8.5 * 60 || sport.min >= 18.5 * 60, `sport à ${sport.time}`);
  assert.ok(plan.find((i) => i.key === '🍳').min <= 8.5 * 60);
  assert.ok(!plan.some((i) => i.key === '🌳' && i.min >= 8.5 * 60 && i.min < 18.5 * 60));
  for (const i of plan) assert.equal(toMin(i.time), ((i.min % 1440) + 1440) % 1440);
});

test('plan du jour : étapes modifiées (nom, heure, jours) et étapes à jours choisis', () => {
  const st = { profile: me, days: {}, meals: [], weights: [], workouts: [] };
  const plan = C.dailyPlan(C.summarize(st, keys(14)), me);
  const today = keys(1)[0], dow = new Date().getDay();
  const e = C.applyPlanEdits(plan, { over: { '☕': { title: 'Dernier thé', time: '13:00', text: 'vert' } }, custom: [{ id: 'x', time: '09:00', title: 'Étirements', days: [dow] }, { id: 'y', time: '09:00', title: 'Autre jour', days: [(dow + 1) % 7] }] }, today);
  const tea = e.find((i) => i.key === '☕');
  assert.equal(tea.title, 'Dernier thé'); assert.equal(tea.time, '13:00'); assert.equal(tea.note, 'vert');
  assert.ok(e.some((i) => i.title === 'Étirements'));
  assert.ok(!e.some((i) => i.title === 'Autre jour'));
  const off = C.applyPlanEdits(plan, { over: { '☕': { title: 'x', days: [(dow + 1) % 7] } } }, today);
  assert.ok(!off.some((i) => i.key === '☕'));
});

test('semaine type : temps dispo et format de séance', () => {
  const total = (t) => t.reduce((a, d) => a + (d.type ? d.minutes : 0), 0);
  const base = SP.currentTemplate(me);
  const short = SP.currentTemplate({ ...me, sessionStyle: 'courtes' });
  const long = SP.currentTemplate({ ...me, sessionStyle: 'longues' });
  assert.ok(short.filter((d) => d.type).length >= 6);
  assert.ok(long.filter((d) => d.type).length <= 4);
  assert.ok(Math.max(...long.map((d) => d.minutes)) > Math.max(...short.map((d) => d.minutes)));
  assert.ok(Math.abs(total(short) - total(base)) <= 40 && Math.abs(total(long) - total(base)) <= 40);
  const capped = SP.currentTemplate({ ...me, sportMinutes: 20 });
  assert.ok(capped.every((d) => d.minutes <= 20));
});

test('séance : exercices retirés remplacés', () => {
  const s = W.buildSession({ activity: 'renfo', minutes: 40, equipment: 'aucun', zones: SP.hrZones(1990) });
  const first = s.blocks[1].items[0].label;
  const s2 = W.buildSession({ activity: 'renfo', minutes: 40, equipment: 'aucun', zones: SP.hrZones(1990), hidden: new Set([first]) });
  assert.ok(!s2.blocks.flatMap((b) => b.items).some((i) => i.label === first));
  assert.equal(s2.blocks[1].items.length, s.blocks[1].items.length);
});

test('plan du jour : travail de nuit sans plantage', () => {
  const dow = new Date().getDay();
  const p = { ...me, wakeTime: '14:00', bedTime: '07:00', work: { enabled: true, days: [dow], start: '22:00', end: '06:00', commute: 20 } };
  const plan = C.dailyPlan(C.summarize({ profile: p, days: {}, meals: [], weights: [], workouts: [] }, keys(14)), p);
  assert.ok(plan.some((i) => i.key === '💼' && i.title === 'Travail 22:00–06:00'));
  for (const i of plan) assert.match(i.time, /^\d\d:\d\d$/);
});
