import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geminiClient, contents, thinkOptions, _reset } from '../src/gemini.js';

const KEY = 'AIza' + 'x'.repeat(35);
const ok = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200 });
const sse = (text) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] })}\n\n`, { status: 200 });
const invalid = () => new Response(JSON.stringify({ error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } }), { status: 400 });

function mock(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => { const b = JSON.parse(init.body); calls.push({ url, body: b }); return handler(b, url, calls.length); };
  return calls;
}

test('historique nettoyé : messages vides retirés, rôles fusionnés, commence et finit par l’utilisateur', () => {
  const c = contents([
    { role: 'assistant', content: 'Bonjour !' },
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: '' },
    { role: 'assistant', content: [{ type: 'text', text: 'réponse' }] },
    { role: 'user', content: 'c' },
  ]);
  assert.deepEqual(c.map((m) => m.role), ['user', 'model', 'user']);
  assert.equal(c[0].parts.length, 2);
});

test('coach (mode rapide) : un 400 « invalid argument » est réessayé sans réglage de réflexion', async () => {
  _reset();
  const calls = mock((b) => (b.generationConfig.thinkingConfig ? invalid() : sse('Voici des idées')));
  const c = geminiClient(KEY);
  let got = '';
  const s = c.beta.messages.stream({ model: 'gemini-fast', max_tokens: 4000, output_config: { effort: 'low' }, system: [{ type: 'text', text: 'Tu es un coach.' }], messages: [{ role: 'user', content: 'Idées de petit-déjeuner ?' }] });
  s.on('text', (t) => (got += t));
  const m = await s.finalMessage();
  assert.equal(m.content[0].text, 'Voici des idées');
  assert.equal(got, 'Voici des idées');
  // niveau refusé, puis budget refusé, puis sans réglage : sur le même modèle, sans passer au suivant
  assert.equal(calls.length, 3);
  assert.ok(calls.every((x) => x.url.includes('gemini-flash-lite-latest')));
  // le refus est retenu : la requête suivante part directement sans réflexion
  const calls2 = mock((b) => (b.generationConfig.thinkingConfig ? invalid() : ok('ok')));
  await c.beta.messages.create({ model: 'gemini-fast', max_tokens: 100, messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls2.length, 1);
});

test('réflexion : niveau pour les modèles 3 (alias -latest), budget pour les 2.5', () => {
  _reset();
  assert.deepEqual(thinkOptions('gemini-flash-latest', { model: 'gemini-fast' })[0], { kind: 'level', thinkingLevel: 'minimal' });
  assert.deepEqual(thinkOptions('gemini-2.5-flash', { model: 'gemini-fast' })[0], { kind: 'budget', thinkingBudget: 0 });
  assert.deepEqual(thinkOptions('gemini-flash-latest', { model: 'gemini', output_config: { effort: 'medium' } })[0], { kind: 'level', thinkingLevel: 'low' });
  assert.deepEqual(thinkOptions('gemini-flash-latest', { model: 'gemini' }), [null]);
});

test('modèle saturé (503) : mis de côté, la requête suivante part directement sur le suivant', async () => {
  _reset();
  const calls = mock((b, url) => (url.includes('gemini-flash-lite-latest:') ? new Response('{}', { status: 503 }) : ok('ok')));
  const c = geminiClient(KEY);
  await c.beta.messages.create({ model: 'gemini-fast', max_tokens: 100, messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls.length, 2); // pas d'attente ni de seconde tentative sur le modèle saturé
  const calls2 = mock((b, url) => (url.includes('gemini-flash-lite-latest:') ? new Response('{}', { status: 503 }) : ok('ok')));
  await c.beta.messages.create({ model: 'gemini-fast', max_tokens: 100, messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls2.length, 1);
  assert.ok(!calls2[0].url.includes('gemini-flash-lite-latest'));
});

test('400 persistant : dernier recours sur les modèles stables avec la requête la plus simple', async () => {
  _reset();
  const calls = mock((b, url) => (url.includes('gemini-2.5-flash-lite:') ? ok('{"a":1}') : invalid()));
  const c = geminiClient(KEY);
  const m = await c.beta.messages.create({ model: 'gemini', max_tokens: 100, output_config: { format: { type: 'json_schema', schema: { type: 'object' } } }, messages: [{ role: 'user', content: 'x' }] });
  assert.equal(m.content[0].text, '{"a":1}');
  assert.ok(calls.at(-1).url.includes('gemini-2.5-flash-lite'));
  assert.equal(calls.at(-1).body.generationConfig.responseJsonSchema, undefined);
});

test('clé invalide : pas de nouvelle tentative', async () => {
  _reset();
  const calls = mock(() => new Response(JSON.stringify({ error: { message: 'API key not valid.' } }), { status: 400 }));
  await assert.rejects(geminiClient(KEY).beta.messages.create({ model: 'gemini-fast', messages: [{ role: 'user', content: 'x' }] }), /Clé Gemini invalide/);
  assert.equal(calls.length, 1);
});

test('correction : la note renvoyée avec la photo contient l’analyse fausse et toutes les précisions', async () => {
  const { correctionNote } = await import('../src/ai.js');
  const t = correctionNote({ title: 'Cracottes', items: [{ name: 'Cracottes', grams: 15 }, { name: 'Jus', grams: 180, liquid: true }] }, ['granola et crêpe whaou', '1 sachet']);
  assert.match(t, /Cracottes \(15 g\)/);
  assert.match(t, /Jus \(180 mL\)/);
  assert.match(t, /- granola et crêpe whaou\n- 1 sachet/);
});
