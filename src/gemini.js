// Google Gemini (clé gratuite sur aistudio.google.com) derrière la même interface que le SDK Anthropic
// (beta.messages.create / beta.messages.stream), pour que toutes les fonctions IA marchent avec l'un ou l'autre.
// Seul le sous-ensemble utilisé par ai.js est traduit : système, texte, images, sortie JSON, recherche web, streaming.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
// alias maintenu par Google vers le dernier modèle Flash, puis versions fixes et « Lite » :
// chaque modèle a son propre quota gratuit et sa propre charge, on passe au suivant s'il est saturé.
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
const BUSY = [500, 502, 503, 504];

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
  return `Erreur Gemini (${status}) : ${msg || 'requête refusée'}`;
}

const textOf = (system) => (Array.isArray(system) ? system.map((b) => b.text).join('\n\n') : system || '');

function parts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return content.flatMap((b) => {
    if (b.type === 'text') return [{ text: b.text }];
    if (b.type === 'image') return [{ inline_data: { mime_type: b.source.media_type, data: b.source.data } }];
    return []; // blocs propres à Anthropic (recherche web…) ignorés
  });
}

function body(p, { schema = true } = {}) {
  const fmt = p.output_config?.format;
  let system = textOf(p.system);
  const gen = { maxOutputTokens: Math.min(p.max_tokens || 8192, 32768) };
  if (fmt?.type === 'json_schema') {
    gen.responseMimeType = 'application/json';
    if (schema) gen.responseJsonSchema = fmt.schema;
    else system += `\n\nRéponds uniquement par un objet JSON valide qui respecte ce schéma JSON :\n${JSON.stringify(fmt.schema)}`;
  }
  const web = p.tools?.some((t) => String(t.type).startsWith('web_search'));
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: p.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: parts(m.content) })),
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

async function post(key, path, payload, signal) {
  let last;
  for (const model of MODELS) {
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
    // clé refusée ou requête invalide : inutile d'essayer un autre modèle
    if (![404, 429, ...BUSY].includes(last.status)) throw last;
  }
  throw last;
}

// Certains schémas JSON (anyOf, additionalProperties…) peuvent être refusés : on réessaie avec le schéma dans la consigne.
async function withSchemaRetry(fn, p) {
  try { return await fn(body(p)); } catch (e) {
    // schéma refusé (400) ou qui fait planter le serveur (500) : schéma passé dans la consigne
    if ([400, 500].includes(e.status) && p.output_config?.format && !/API key/i.test(e.raw)) return fn(body(p, { schema: false }));
    if (p.tools && ((e.status === 400 && /search|tool/i.test(e.raw)) || BUSY.includes(e.status))) return fn(body({ ...p, tools: undefined }));
    throw e;
  }
}

export function geminiClient(apiKey) {
  const key = apiKey.trim();
  const create = (p) => withSchemaRetry(async (payload) => {
    const j = await (await post(key, 'generateContent', payload)).json();
    return toMessage(textFrom(j), j.candidates);
  }, p);
  const stream = (p) => {
    const listeners = [];
    const done = withSchemaRetry(async (payload) => {
      const res = await post(key, 'streamGenerateContent?alt=sse', payload);
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
