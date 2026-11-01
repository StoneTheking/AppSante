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
// Certains modèles (les plus récents derrière les alias « -latest ») refusent le réglage thinkingBudget :
// une fois le refus constaté, on ne l'envoie plus pendant la session.
let thinkRefused = false;

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
export function body(p, { schema = true, think = true, tools = true } = {}) {
  const fmt = p.output_config?.format;
  let system = textOf(p.system);
  const gen = { maxOutputTokens: Math.min(p.max_tokens || 8192, 32768) };
  // Réflexion limitée pour les tâches courantes (analyse photo, lecture de capture) : réponse bien plus rapide.
  const effort = p.output_config?.effort;
  // mode rapide : pas de réflexion du tout (le premier mot arrive beaucoup plus tôt)
  if (think && !thinkRefused && p.model === 'gemini-fast') gen.thinkingConfig = { thinkingBudget: 0 };
  else if (think && !thinkRefused && (effort === 'low' || effort === 'medium')) gen.thinkingConfig = { thinkingBudget: effort === 'low' ? 512 : 1024 };
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

async function post(key, path, payload, fast, { stable = false } = {}, signal) {
  let last;
  for (const model of stable ? STABLE : fast ? FAST : MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${BASE}${model}:${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
        signal,
      });
      if (res.ok) return res;
      const err = await res.json().catch(() => ({}));
      last = new GeminiError(res.status, friendly(res.status, err));
      last.raw = err?.error?.message || '';
      // surcharge passagère (503 « overloaded » très fréquent sur l'offre gratuite) : une nouvelle tentative, puis modèle suivant
      if (BUSY.includes(res.status)) { if (!attempt) await wait(1200); continue; }
      break;
    }
    // clé refusée ou requête invalide : inutile d'essayer un autre modèle (sauf en dernier recours sur les modèles stables)
    if (![404, 429, ...BUSY].includes(last.status) && !(stable && last.status === 400 && !/API key/i.test(last.raw))) throw last;
  }
  throw last;
}

// Une requête refusée (400 « invalid argument ») est réessayée en retirant, une à une, les options qu'un modèle
// peut ne pas accepter : réglage de réflexion, schéma JSON natif (anyOf, additionalProperties…), recherche Google ;
// puis, en dernier recours, la requête la plus simple possible sur les modèles 2.5 stables.
const keyError = (e) => /API key/i.test(e.raw || '');
async function withSchemaRetry(fn, p, opts = {}) {
  try {
    const r = await fn(body(p, opts), opts);
    if (opts.thinkFailed) thinkRefused = true;
    return r;
  } catch (e) {
    if (!(e instanceof GeminiError) || keyError(e) || e.empty) throw e;
    const bad = e.status === 400;
    const usesThink = p.model === 'gemini-fast' || ['low', 'medium'].includes(p.output_config?.effort);
    if (bad && opts.think !== false && usesThink && !thinkRefused) return withSchemaRetry(fn, p, { ...opts, think: false, thinkFailed: true });
    // schéma refusé (400) ou qui fait planter le serveur (500) : schéma passé dans la consigne
    if ((bad || e.status === 500) && p.output_config?.format && opts.schema !== false) return withSchemaRetry(fn, p, { ...opts, schema: false, thinkFailed: false });
    if (p.tools && opts.tools !== false && (bad || BUSY.includes(e.status))) return withSchemaRetry(fn, p, { ...opts, tools: false, thinkFailed: false });
    if (bad && !opts.stable) return withSchemaRetry(fn, p, { schema: false, think: false, tools: false, stable: true });
    throw e;
  }
}

export function geminiClient(apiKey) {
  const key = apiKey.trim();
  const create = (p) => withSchemaRetry(async (payload, opts) => {
    const j = await (await post(key, 'generateContent', payload, p.model === 'gemini-fast', opts)).json();
    return toMessage(textFrom(j), j.candidates);
  }, p);
  const stream = (p) => {
    const listeners = [];
    const done = withSchemaRetry(async (payload, opts) => {
      const res = await post(key, 'streamGenerateContent?alt=sse', payload, p.model === 'gemini-fast', opts);
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
