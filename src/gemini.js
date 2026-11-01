// Google Gemini (clé gratuite sur aistudio.google.com) derrière la même interface que le SDK Anthropic
// (beta.messages.create / beta.messages.stream), pour que toutes les fonctions IA marchent avec l'un ou l'autre.
// Seul le sous-ensemble utilisé par ai.js est traduit : système, texte, images, sortie JSON, recherche web, streaming.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
// alias maintenu par Google vers le dernier modèle Flash, puis versions fixes et « Lite » :
// chaque modèle a son propre quota gratuit et sa propre charge, on passe au suivant s'il est saturé.
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
// mode rapide (coach, recettes, captures) : Flash-Lite d'abord, bien plus réactif, puis Flash en secours
const FAST = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash'];
const BUSY = [500, 502, 503, 504];

// Réglage de réflexion, modèle par modèle : c'est ce qui décide du temps de réponse.
// Les modèles 2.5 prennent un budget en jetons (0 = pas de réflexion) ; les modèles 3 et suivants (derrière
// les alias « -latest ») prennent un niveau (« minimal », « low »…). Sans réglage, un modèle 3 réfléchit au
// maximum : 10 à 30 s d'attente. Un réglage refusé (400) n'est retiré que pour CE modèle, pas pour les autres.
const refused = new Map(); // modèle → réglages refusés ('level', 'budget')
export function thinkOptions(model, p) {
  const fast = p.model === 'gemini-fast', effort = p.output_config?.effort;
  if (!fast && effort !== 'low' && effort !== 'medium') return [null];
  const level = { thinkingLevel: fast ? 'minimal' : 'low' };
  const budget = { thinkingBudget: fast ? 0 : effort === 'low' ? 512 : 1024 };
  const order = /2\.5/.test(model) ? [['budget', budget], ['level', level]] : [['level', level], ['budget', budget]];
  const no = refused.get(model) || new Set();
  return [...order.filter(([k]) => !no.has(k)), [null, null]].map(([k, v]) => v && { kind: k, ...v });
}

// Modèle saturé (503) ou quota atteint (429) : mis de côté une minute, la requête suivante part tout de suite
// sur un modèle disponible au lieu de réessayer (et d'attendre) le modèle saturé.
const cooldown = new Map();
const COOL_MS = 60000;
const order = (list) => { const now = Date.now(), ok = list.filter((m) => !(cooldown.get(m) > now)); return ok.length ? [...ok, ...list.filter((m) => !ok.includes(m))] : list; };
export const _reset = () => { refused.clear(); cooldown.clear(); };

export const isGeminiKey = (k) => /^AIza[\w-]{30,}$/.test(String(k || '').trim());

export class GeminiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function friendly(status, body) {
  const msg = body?.error?.message || '';
  if (status === 400 && /API key/i.test(msg)) return 'Clé Gemini invalide. Vérifie-la dans Profil.';
  if (status === 403) return 'Cette clé Gemini n’a pas accès à l’API (active « Generative Language API » sur aistudio.google.com).';
  if (status === 429) return 'Quota gratuit de Gemini atteint : réessaie dans une minute (ou demain si la limite du jour est atteinte).';
  if (status >= 500) return `Les serveurs de Gemini sont saturés en ce moment (ta clé n’est pas en cause), réessaie dans quelques minutes.${msg ? ` (${msg})` : ''}`;
  if (status === 400) return `Gemini n’a pas accepté la demande, même simplifiée. Réessaie, ou lance une nouvelle conversation.${msg ? ` (${msg})` : ''}`;
  return `Erreur Gemini (${status}) : ${msg || 'requête refusée'}`;
}

const textOf = (system) => (Array.isArray(system) ? system.map((b) => b.text).join('\n\n') : system || '');

function parts(content) {
  if (typeof content === 'string') return content.trim() ? [{ text: content }] : [];
  return (content || []).flatMap((b) => {
    if (b.type === 'text') return b.text?.trim() ? [{ text: b.text }] : [];
    if ((b.type === 'image' || b.type === 'document') && b.source?.data) return [{ inline_data: { mime_type: b.source.media_type, data: b.source.data } }];
    return []; // blocs propres à Anthropic (recherche web…) ignorés
  });
}

// Gemini refuse (400 « invalid argument ») un message sans contenu, une conversation qui commence ou finit
// par le modèle, ou deux messages du même rôle à la suite : on nettoie l'historique avant l'envoi.
export function contents(messages) {
  const out = [];
  for (const m of messages || []) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const ps = parts(m.content);
    if (!ps.length) continue;
    if (out.at(-1)?.role === role) out.at(-1).parts.push(...ps);
    else out.push({ role, parts: ps });
  }
  while (out[0]?.role === 'model') out.shift();
  while (out.at(-1)?.role === 'model') out.pop();
  return out;
}

// opts : schema (schéma JSON natif), think (réglage de réflexion), tools (recherche Google)
export function body(p, { schema = true, tools = true } = {}, thinking = null) {
  const fmt = p.output_config?.format;
  let system = textOf(p.system);
  const gen = { maxOutputTokens: Math.min(p.max_tokens || 8192, 32768) };
  // réflexion limitée (voir thinkOptions) : réponse bien plus rapide
  if (thinking) { const { kind, ...cfg } = thinking; void kind; gen.thinkingConfig = cfg; }
  if (fmt?.type === 'json_schema') {
    gen.responseMimeType = 'application/json';
    if (schema) gen.responseJsonSchema = fmt.schema;
    else system += `\n\nRéponds uniquement par un objet JSON valide qui respecte ce schéma JSON :\n${JSON.stringify(fmt.schema)}`;
  }
  const web = tools && p.tools?.some((t) => String(t.type).startsWith('web_search'));
  const msgs = contents(p.messages);
  if (!msgs.length) throw Object.assign(new GeminiError(400, 'Message vide : écris ta question puis renvoie-la.'), { empty: true });
  return {
    ...(system.trim() ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: msgs,
    generationConfig: gen,
    ...(web && !fmt ? { tools: [{ google_search: {} }] } : {}),
  };
}

// Réponse Gemini → message au format Anthropic ({ content, stop_reason }).
function toMessage(text, cands) {
  const c = cands?.[0] || {};
  const chunks = c.groundingMetadata?.groundingChunks || [];
  const citations = chunks.filter((x) => x.web?.uri).map((x) => ({ url: x.web.uri, title: x.web.title || x.web.uri }));
  const blocked = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'RECITATION'].includes(c.finishReason);
  return { content: [{ type: 'text', text, citations }], stop_reason: blocked && !text ? 'refusal' : c.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn' };
}

const textFrom = (j) => (j.candidates?.[0]?.content?.parts || []).filter((x) => x.text && !x.thought).map((x) => x.text).join('');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const STABLE = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

// Essaie les modèles dans l'ordre (les modèles saturés en dernier) ; pour chacun, les réglages de réflexion
// qu'il accepte, en retirant celui qu'il refuse.
async function post(key, path, p, opts, signal) {
  let last;
  const list = opts.stable ? STABLE : p.model === 'gemini-fast' ? FAST : MODELS;
  for (let round = 0; round < 2; round++) {
    for (const model of order(list)) {
      if (round && !BUSY.includes(cooldown.get(model + ':status'))) continue;
      const failed = []; // réglages refusés pour CE modèle, retenus seulement si la requête passe sans eux
      const remember = (kinds) => { if (!refused.has(model)) refused.set(model, new Set()); kinds.forEach((k) => refused.get(model).add(k)); };
      for (const th of opts.stable ? [null] : thinkOptions(model, p)) {
        const res = await fetch(`${BASE}${model}:${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body(p, opts, th)),
          signal,
        });
        if (res.ok) { cooldown.delete(model); remember(failed); return res; }
        const err = await res.json().catch(() => ({}));
        last = new GeminiError(res.status, friendly(res.status, err));
        last.raw = err?.error?.message || '';
        // réglage de réflexion refusé par ce modèle : retenu, on réessaie aussitôt sans
        if (res.status === 400 && th && !keyError(last)) { failed.push(th.kind); if (/think/i.test(last.raw)) remember([th.kind]); continue; }
        break;
      }
      if ([429, ...BUSY].includes(last.status)) { cooldown.set(model, Date.now() + COOL_MS); cooldown.set(model + ':status', last.status); continue; }
      if (last.status === 404) { cooldown.set(model, Date.now() + 3600000); continue; }
      // clé refusée ou requête invalide : inutile d'essayer un autre modèle (sauf en dernier recours sur les modèles stables)
      if (!(opts.stable && last.status === 400 && !keyError(last))) throw last;
    }
    // tous saturés : une courte pause, puis un second passage sur les modèles surchargés (pas ceux sans quota)
    if (!BUSY.includes(last?.status)) break;
    await wait(1200);
  }
  throw last;
}

// Une requête refusée (400 « invalid argument ») est réessayée en retirant, une à une, les options qu'un modèle
// peut ne pas accepter : schéma JSON natif (anyOf, additionalProperties…), recherche Google ;
// puis, en dernier recours, la requête la plus simple possible sur les modèles 2.5 stables.
const keyError = (e) => /API key/i.test(e.raw || '');
async function withSchemaRetry(fn, p, opts = {}) {
  try {
    if (!contents(p.messages).length) body(p, opts); // message vide : erreur claire, sans appel réseau
    return await fn(opts);
  } catch (e) {
    if (!(e instanceof GeminiError) || keyError(e) || e.empty) throw e;
    const bad = e.status === 400;
    // schéma refusé (400) ou qui fait planter le serveur (500) : schéma passé dans la consigne
    if ((bad || e.status === 500) && p.output_config?.format && opts.schema !== false) return withSchemaRetry(fn, p, { ...opts, schema: false });
    if (p.tools && opts.tools !== false && (bad || BUSY.includes(e.status))) return withSchemaRetry(fn, p, { ...opts, tools: false });
    if (bad && !opts.stable) return withSchemaRetry(fn, p, { schema: false, tools: false, stable: true });
    throw e;
  }
}

export function geminiClient(apiKey) {
  const key = apiKey.trim();
  const create = (p) => withSchemaRetry(async (opts) => {
    const j = await (await post(key, 'generateContent', p, opts, p.signal)).json();
    return toMessage(textFrom(j), j.candidates);
  }, p);
  const stream = (p) => {
    const listeners = [];
    const done = withSchemaRetry(async (opts) => {
      const res = await post(key, 'streamGenerateContent?alt=sse', p, opts, p.signal);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', text = '', cands = null;
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          try {
            const j = JSON.parse(line.slice(5));
            const t = textFrom(j);
            if (j.candidates?.[0]?.groundingMetadata || j.candidates?.[0]?.finishReason) cands = j.candidates;
            if (t) { text += t; listeners.forEach((f) => f(t)); }
          } catch { /* ligne incomplète */ }
        }
      }
      return toMessage(text, cands);
    }, p);
    return { on(ev, f) { if (ev === 'text') listeners.push(f); return this; }, finalMessage: () => done };
  };
  return { gemini: true, beta: { messages: { create, stream } } };
}
