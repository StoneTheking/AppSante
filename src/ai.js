// Intégration Claude : analyse de photos de repas, lecture de captures d'écran, coach conversationnel.
// La clé API est stockée uniquement sur l'appareil et envoyée directement à l'API Anthropic.
import Anthropic from '@anthropic-ai/sdk';
import { SOURCES } from './science.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (le plus précis)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (équilibré)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (le plus économique)' },
];

function client(apiKey) {
  if (!apiKey) throw new Error('Ajoute ta clé API Anthropic dans Profil → Intelligence artificielle pour utiliser cette fonction.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// Repli automatique côté serveur si le modèle décline une requête (non disponible sur Haiku).
function fallbackParams(model) {
  return model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}

export function friendlyError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Clé API invalide. Vérifie-la dans Profil.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Cette clé n’a pas accès à ce modèle.';
  if (e instanceof Anthropic.RateLimitError) return 'Trop de requêtes, réessaie dans une minute.';
  if (e instanceof Anthropic.APIConnectionError) return 'Pas de connexion à Internet.';
  if (e instanceof Anthropic.APIError) return `Erreur de l’API (${e.status ?? '?'}) : ${e.message}`;
  return e?.message || String(e);
}

const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };

const PLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'title', 'items', 'nutrients', 'nova', 'quality', 'verdict', 'comment', 'advice', 'confidence'],
  properties: {
    is_food: { type: 'boolean' },
    title: { type: 'string', description: 'Nom court du repas en français' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal'],
        properties: { name: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' } },
      },
    },
    nutrients: {
      type: 'object',
      additionalProperties: false,
      required: ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'satFat', 'fiber', 'sodium', 'fruitVeg'],
      properties: {
        kcal: { type: 'number' },
        protein: { type: 'number', description: 'g' },
        carbs: { type: 'number', description: 'g' },
        sugar: { type: 'number', description: 'g de sucres libres/ajoutés' },
        fat: { type: 'number', description: 'g' },
        satFat: { type: 'number', description: 'g' },
        fiber: { type: 'number', description: 'g' },
        sodium: { type: 'number', description: 'mg' },
        fruitVeg: { type: 'number', description: 'g de fruits et légumes (hors pommes de terre)' },
      },
    },
    nova: { type: 'integer', description: 'Classification NOVA dominante 1 à 4' },
    quality: { type: 'integer', description: 'Note de qualité nutritionnelle 0-100 pour CETTE personne' },
    verdict: { type: 'string', enum: ['bon', 'moyen', 'a_limiter'] },
    comment: { type: 'string', description: 'Pourquoi ce repas est bon ou non pour cette personne (2-3 phrases)' },
    advice: { type: 'string', description: 'Conseil concret pour améliorer ce repas ou le prochain' },
    confidence: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
  },
};

const SCREEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['screenMin', 'socialMin', 'unlocks', 'notifications', 'steps', 'bed', 'wake', 'sleepQuality', 'modMin', 'vigMin', 'weight', 'note'],
  properties: {
    screenMin: num,
    socialMin: { ...num, description: 'Minutes cumulées sur les réseaux sociaux (Instagram, TikTok, Facebook, Snapchat, X, YouTube…)' },
    unlocks: num,
    notifications: num,
    steps: num,
    bed: { anyOf: [{ type: 'string', description: 'HH:MM' }, { type: 'null' }] },
    wake: { anyOf: [{ type: 'string', description: 'HH:MM' }, { type: 'null' }] },
    sleepQuality: { ...num, description: '1 à 5 si un score de sommeil est visible' },
    modMin: { ...num, description: "Minutes d'activité modérée / minutes actives" },
    vigMin: num,
    weight: num,
    note: { type: 'string', description: 'Ce qui a été lu, en une phrase' },
  },
};

function parseJson(resp) {
  if (resp.stop_reason === 'refusal') throw new Error('La requête a été déclinée par le modèle.');
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

function imageBlock(dataUrl) {
  const [head, data] = dataUrl.split(',');
  const media_type = head.match(/data:(.*?);/)[1];
  return { type: 'image', source: { type: 'base64', media_type, data } };
}

export async function analyzePlate({ apiKey, model }, dataUrl, personContext, note = '') {
  const c = client(apiKey);
  const resp = await c.beta.messages.create({
    model,
    max_tokens: 16000,
    ...fallbackParams(model),
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLATE_SCHEMA } },
    system:
      "Tu es un diététicien-nutritionniste expert. Tu analyses la photo d'un repas : identifie chaque aliment, estime les portions (utilise couverts, assiette, mains comme repères d'échelle), puis les nutriments en t'appuyant sur les tables CIQUAL/USDA. Évalue le repas pour la personne décrite (objectif, activité, sommeil, humeur, apports déjà consommés aujourd'hui, besoins restants). Sois honnête sur l'incertitude. Réponds en français.",
    messages: [
      {
        role: 'user',
        content: [
          imageBlock(dataUrl),
          { type: 'text', text: `Contexte de la personne :\n${personContext}\n\n${note ? `Précision de l'utilisateur : ${note}\n\n` : ''}Analyse ce repas.` },
        ],
      },
    ],
  });
  return parseJson(resp);
}

export async function readScreenshot({ apiKey, model }, dataUrl) {
  const c = client(apiKey);
  const resp = await c.beta.messages.create({
    model,
    max_tokens: 4000,
    ...fallbackParams(model),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCREEN_SCHEMA } },
    system:
      "Tu lis des captures d'écran d'applications de santé et de bien-être numérique (Bien-être numérique Android, Temps d'écran iOS, Google Fit, Samsung Health, Fitbit, Garmin, Apple Santé…). Extrais uniquement les valeurs du jour réellement visibles ; mets null sinon. Convertis les durées en minutes.",
    messages: [{ role: 'user', content: [imageBlock(dataUrl), { type: 'text', text: 'Extrais les données de cette capture.' }] }],
  });
  return parseJson(resp);
}

const COACH_SYSTEM = `Tu es « Coach Santé », un coach personnel en nutrition, activité physique, sommeil et bien-être mental, rigoureux et bienveillant.
Principes :
- Appuie-toi sur les données scientifiques les plus solides (méta-analyses, essais contrôlés, recommandations OMS/ANSES/HAS/EFSA). Cite brièvement la source (auteur, revue, année) quand tu avances un chiffre.
- Personnalise tout à partir des données de l'utilisateur fournies (profil, sommeil, humeur, écrans, activité, repas). Mentionne explicitement quelles données t'ont fait conclure.
- Donne des conseils concrets et horodatés (quoi manger, à quelle heure, quelle activité, combien de temps, à quel moment).
- Distingue association et causalité ; signale l'incertitude.
- Tu n'es pas médecin : en cas de symptôme inquiétant, de trouble alimentaire suspecté, d'idées noires (3114 en France) ou de maladie chronique, oriente vers un professionnel.
- Réponds en français, de façon concise et structurée (listes courtes), sans jargon inutile.
Sources de référence intégrées à l'application :
${Object.values(SOURCES).map((s) => `- ${s.t}`).join('\n')}`;

// Conversation en streaming. history : [{role, content}] ; onText reçoit le texte cumulé.
export async function coachChat({ apiKey, model }, history, personContext, onText) {
  const c = client(apiKey);
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  // Les données du jour sont jointes au dernier message utilisateur, le préfixe reste stable (cache).
  const last = messages.at(-1);
  last.content = `<donnees_utilisateur>\n${personContext}\n</donnees_utilisateur>\n\n${last.content}`;
  const stream = c.beta.messages.stream({
    model,
    max_tokens: 16000,
    ...fallbackParams(model),
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
  });
  let acc = '';
  stream.on('text', (t) => {
    acc += t;
    onText(acc);
  });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('La requête a été déclinée par le modèle.');
  return acc;
}
