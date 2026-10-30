import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMS, hasAnim } from '../src/exercise3d.js';
import { NEEDS_VIDEO } from '../src/videos.js';
import { modelFor } from '../src/ai.js';

test('chaque exercice à tuto a sa démonstration 3D (hors natation)', () => {
  const missing = [...NEEDS_VIDEO].filter((l) => !hasAnim(l) && !/25 m/.test(l));
  assert.deepEqual(missing, []);
  for (const a of Object.values(ANIMS)) assert.ok(a.keys.length >= 2);
});

test('vitesse IA : modèle adapté à la tâche', () => {
  assert.equal(modelFor({ apiKey: 'sk-ant-x', aiSpeed: 'rapide' }, 'chat'), 'claude-haiku-5-5');
  assert.equal(modelFor({ apiKey: 'sk-ant-x', aiSpeed: 'rapide' }, 'photo'), 'claude-sonnet-5-5');
  assert.equal(modelFor({ apiKey: 'sk-ant-x', aiSpeed: 'precis', model: 'claude-opus-5-5' }, 'chat'), 'claude-opus-5-5');
  assert.equal(modelFor({ apiKey: 'AIza' + 'x'.repeat(35), aiSpeed: 'rapide' }, 'chat'), 'gemini-fast');
});
