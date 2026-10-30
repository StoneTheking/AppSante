// Intégration IA : analyse de photos de repas, lecture de captures d'écran, coach conversationnel.
// Claude (clé Anthropic, payante à l'usage) ou Google Gemini (clé gratuite) : la clé est stockée sur l'appareil
// et envoyée directement au fournisseur choisi.
import { SOURCES, EVIDENCE_TEXT, evidenceText } from './science.js';
import { isOffline, WEAK_MSG } from './net.js';
import { geminiClient, isGeminiKey, GeminiError } from './gemini.js';

const FOOD_EVIDENCE = evidenceText(['Alimentation', 'Horaires des repas']);

// Le SDK est chargé à la demande pour alléger le démarrage de l'application.
let Anthropic = null;

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (le plus précis)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (équilibré)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (le plus économique)' },
];

export const provider = (apiKey) => (!apiKey ? null : isGeminiKey(apiKey) ? 'gemini' : 'claude');

async function client(apiKey) {
  if (!apiKey) throw new Error('Ajoute une clé IA dans Profil → Intelligence artificielle (une clé Google Gemini est gratuite).');
  if (isGeminiKey(apiKey)) return geminiClient(apiKey);
  Anthropic ||= (await import('@anthropic-ai/sdk')).default;
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// Repli automatique côté serveur si le modèle décline une requête (non disponible sur Haiku).
function fallbackParams(model) {
  return model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}

export function friendlyError(e) {
  if (isOffline(e) || isOffline(e?.cause)) return e?.offline ? e.message : WEAK_MSG;
  if (e instanceof GeminiError || !Anthropic) return e?.message || String(e);
  if (e instanceof Anthropic.AuthenticationError) return 'Clé API invalide. Vérifie-la dans Profil.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'Cette clé n’a pas accès à ce modèle.';
  if (e instanceof Anthropic.RateLimitError) return 'Trop de requêtes, réessaie dans une minute.';
  if (e instanceof Anthropic.APIConnectionError) return WEAK_MSG;
  if (e instanceof Anthropic.APIError) return `Erreur de l’API (${e.status ?? '?'}) : ${e.message}`;
  return e?.message || String(e);
}

const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };

const PLATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'title', 'items', 'nutrients', 'nova', 'quality', 'verdict', 'comment', 'advice', 'confidence', 'alcohol_drinks'],
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
    alcohol_drinks: { type: 'number', description: 'Nombre de verres standard d’alcool visibles ou inclus (1 verre = 10 g d’alcool pur : 25 cL de bière à 5 %, 10 cL de vin, 3 cL d’alcool fort). 0 si aucun.' },
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
  const c = await client(apiKey);
  const resp = await c.beta.messages.create({
    model,
    max_tokens: 16000,
    ...fallbackParams(model),
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLATE_SCHEMA } },
    system:
      "Tu es un diététicien-nutritionniste expert. Tu analyses la photo d'un repas : identifie chaque aliment, estime les portions (utilise couverts, assiette, mains comme repères d'échelle), puis les nutriments en t'appuyant sur les tables CIQUAL/USDA. Évalue le repas pour la personne décrite (objectif, activité, sommeil, humeur, apports déjà consommés aujourd'hui, besoins restants). Sois honnête sur l'incertitude. Réponds en français.\n\nRepères scientifiques à appliquer dans ton évaluation :\n" + FOOD_EVIDENCE,
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
  const c = await client(apiKey);
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

const COACH_SYSTEM = `Tu es « Coach Diana », une coach personnelle en nutrition, activité physique, sommeil et bien-être mental : chaleureuse, enthousiaste et rigoureuse.
Ton et longueur (le plus important) :
- Réponds comme une coach qui envoie un message à quelqu'un qu'elle apprécie : tutoiement, chaleur, encouragements sincères, un ou deux émojis bien placés, et une réaction à ce que la personne vit (« Belle journée de marche ! », « Nuit courte, je comprends que tu sois fatigué·e »).
- Sois brève : 60 à 120 mots maximum, sauf si la personne demande explicitement plus de détails. Va droit au but : une recommandation principale, puis 2 ou 3 puces au plus.
- Pour « que manger », propose 1 ou 2 idées précises (plat, quantité, heure) et pourquoi en une phrase, pas un menu complet.
- Termine souvent par une petite question ou un mot d'encouragement.
Principes :
- Appuie-toi sur les données scientifiques les plus solides, par ordre de préférence : recommandations officielles (OMS, ANSES, HAS, EFSA, PNNS), méta-analyses et revues systématiques, essais randomisés, puis grandes cohortes. Indique le niveau de preuve quand c'est utile.
- Quand tu donnes un chiffre, cite brièvement sa source entre parenthèses (organisme ou auteur, année), une seule à la fois. Utilise d'abord la base de connaissances ci-dessous ; la recherche web seulement si la question demande des données récentes (sources médicales et scientifiques uniquement).
- Personnalise à partir des données de l'utilisateur fournies (profil, sommeil, humeur, écrans, activité, repas déjà pris aujourd'hui) et mentionne en quelques mots celle qui a guidé ton conseil.
- Donne des conseils concrets et horodatés : quoi, combien, à quelle heure.
- Signale l'incertitude en une phrase quand c'est important.
- Tu n'es pas médecin : en cas de symptôme inquiétant, de trouble alimentaire suspecté, d'idées noires (3114 en France) ou de maladie chronique, oriente vers un professionnel.
- Réponds en français, sans titres, sans jargon.

# Base de connaissances scientifiques (résultats chiffrés)
${EVIDENCE_TEXT}

# Toutes les références intégrées à l'application
${Object.values(SOURCES).map((s) => `- ${s.t}`).join('\n')}`;

// Recherche web limitée à des sources médicales et scientifiques reconnues.
const SCIENCE_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'cochranelibrary.com', 'who.int', 'anses.fr', 'has-sante.fr', 'santepubliquefrance.fr',
  'mangerbouger.fr', 'inserm.fr', 'efsa.europa.eu', 'nih.gov', 'cdc.gov', 'thelancet.com', 'bmj.com', 'nejm.org', 'jamanetwork.com',
  'nature.com', 'sciencedirect.com', 'academic.oup.com', 'link.springer.com', 'ahajournals.org', 'cell.com', 'frontiersin.org', 'mdpi.com',
];

// Conversation en streaming. history : [{role, content}] ; onText reçoit le texte cumulé.
// Renvoie { text, sources } où sources liste les pages web citées par le coach.
export async function coachChat({ apiKey, model }, history, personContext, onText, { webSearch = true } = {}) {
  const c = await client(apiKey);
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  // Les données du jour sont jointes au dernier message utilisateur, le préfixe reste stable (cache).
  const last = messages.at(-1);
  last.content = `<donnees_utilisateur>\n${personContext}\n</donnees_utilisateur>\n\n${last.content}`;
  // Recherche web seulement si la question en a besoin (études récentes, sources…) : sinon réponse bien plus rapide.
  const needsWeb = /étude|etude|recherche|source|récent|recent|nouveau|preuve|prouv|scientifi|actualit|20\d\d|selon|publi/i.test(history.at(-1)?.content || '');
  const tools = webSearch && needsWeb && !model.startsWith('claude-haiku')
    ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4, allowed_domains: SCIENCE_DOMAINS }]
    : undefined;
  let acc = '';
  const sources = new Map();
  for (let i = 0; i < 4; i++) {
    const stream = c.beta.messages.stream({
      model,
      max_tokens: 4000,
      ...fallbackParams(model),
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } }],
      ...(tools ? { tools } : {}),
      messages,
    });
    stream.on('text', (t) => {
      acc += t;
      onText(acc);
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('La requête a été déclinée par le modèle.');
    for (const b of final.content) {
      if (b.type === 'text') for (const ci of b.citations || []) if (ci.url) sources.set(ci.url, ci.title || ci.url);
    }
    // La recherche web côté serveur peut mettre le tour en pause : on le relance tel quel.
    if (final.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: final.content });
  }
  return { text: acc, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

const AISLES = ['Fruits & légumes', 'Viande & poisson', 'Crèmerie & œufs', 'Épicerie', 'Boulangerie', 'Surgelés', 'Boissons', 'Divers'];
const WEEK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['days', 'tips'],
  properties: {
    tips: { type: 'string', description: 'Logique du menu et 2-3 conseils (batch cooking, restes…)' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'meals'],
        properties: {
          label: { type: 'string' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['slot', 'name', 'kcal', 'protein', 'fiber', 'prep', 'ingredients', 'steps'],
              properties: {
                slot: { type: 'string', enum: ['petit-dej', 'dejeuner', 'collation', 'diner'] },
                name: { type: 'string' },
                kcal: { type: 'number' },
                protein: { type: 'number' },
                fiber: { type: 'number' },
                prep: { type: 'number', description: 'minutes de préparation' },
                steps: { type: 'string', description: 'Recette en 2-4 étapes courtes' },
                ingredients: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'qty', 'unit', 'aisle'],
                    properties: { name: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', enum: ['g', 'mL', 'pièce', 'boîte', 'portion', 'c. à soupe'] }, aisle: { type: 'string', enum: AISLES } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// Menus de 7 jours personnalisés (quantités pour `people` personnes), avec recettes.
export async function planWeek({ apiKey, model }, personContext, { days, people = 1, budget = 'moyen', cookTime = 30, wishes = '' }) {
  const c = await client(apiKey);
  const stream = c.beta.messages.stream({
    model,
    max_tokens: 32000,
    ...fallbackParams(model),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: WEEK_SCHEMA } },
    system:
      "Tu es diététicien. Tu composes des menus hebdomadaires réalistes, de saison, économiques et variés, inspirés du modèle méditerranéen et des repères du PNNS/ANSES (légumineuses 2×/semaine, poisson 2×/semaine dont 1 gras, viande rouge ≤ 500 g/semaine, charcuterie ≤ 150 g, céréales complètes, 5 fruits et légumes/jour). Respecte strictement régime, allergies et cibles nutritionnelles. Réutilise les ingrédients d'un jour à l'autre pour limiter le gaspillage. Quantités crues, pour le nombre de personnes indiqué.\n\nBase scientifique à respecter :\n" + FOOD_EVIDENCE,
    messages: [{
      role: 'user',
      content: `Profil et données :\n${personContext}\n\nPrépare les menus pour : ${days.map((d) => d.label).join(', ')}.\nNombre de personnes : ${people}. Budget : ${budget}. Temps de cuisine max par repas : ${cookTime} min.${wishes ? `\nEnvies / contraintes : ${wishes}` : ''}\nPour chaque jour : petit-déjeuner, déjeuner, collation (si utile pour l'objectif) et dîner léger.\nUtilise en priorité les aliments du garde-manger, respecte les goûts, aversions et allergies de chaque membre du foyer (régime le plus strict pour les repas communs), et prévois des repas que toute la famille peut partager (adapter les portions des enfants plutôt que cuisiner à part). Les calories et protéines indiquées sont pour MA portion.`,
    }],
  });
  const resp = await stream.finalMessage();
  const plan = parseJson(resp);
  return {
    source: 'ia',
    created: new Date().toISOString(),
    tips: plan.tips,
    days: plan.days.map((d, i) => ({ ...d, date: days[i]?.date, label: days[i]?.label || d.label })),
  };
}

// Recette détaillée d'un plat (menus, idées, plats enregistrés).
const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'servings', 'prep', 'kcal', 'protein', 'ingredients', 'steps', 'tip'],
  properties: {
    name: { type: 'string' },
    servings: { type: 'integer' },
    prep: { type: 'number', description: 'minutes au total' },
    kcal: { type: 'number', description: 'par portion' },
    protein: { type: 'number', description: 'g par portion' },
    ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'qty', 'unit', 'aisle'], properties: { name: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string', enum: ['g', 'mL', 'pièce', 'boîte', 'portion', 'c. à soupe'] }, aisle: { type: 'string', enum: AISLES } } } },
    steps: { type: 'array', items: { type: 'string' }, description: '4 à 8 étapes courtes et précises' },
    tip: { type: 'string', description: 'Astuce santé ou variante (une phrase)' },
  },
};
export async function recipe({ apiKey, model }, dish, { people = 1, context = '' } = {}) {
  const c = await client(apiKey);
  const resp = await c.beta.messages.create({
    model,
    max_tokens: 4000,
    ...fallbackParams(model),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
    system: 'Tu es cuisinier et diététicien. Tu donnes des recettes simples, de saison, fidèles au plat demandé, avec des quantités crues réalistes. Respecte le régime et les allergies indiqués.',
    messages: [{ role: 'user', content: `Recette de : « ${dish} » pour ${people} personne(s).${context ? `\nContexte : ${context}` : ''}` }],
  });
  return parseJson(resp);
}

const RECEIPT_CATEGORIES = ['Fruits & légumes', 'Viande & poisson', 'Crèmerie & œufs', 'Féculents & céréales', 'Légumineuses', 'Épicerie salée', 'Snacks sucrés', 'Boissons sucrées', 'Boissons', 'Alcool', 'Plats préparés', 'Surgelés', 'Boulangerie', 'Non alimentaire'];
const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_receipt', 'store', 'date', 'total', 'items'],
  properties: {
    is_receipt: { type: 'boolean' },
    store: { type: 'string' },
    date: { anyOf: [{ type: 'string', description: 'AAAA-MM-JJ' }, { type: 'null' }] },
    total: num,
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'raw', 'qty', 'unit', 'price', 'category', 'nova', 'wholeGrain'],
        properties: {
          name: { type: 'string', description: 'Nom clair et générique en français (ex. « Yaourt nature », « Pâtes complètes »)' },
          raw: { type: 'string', description: 'Libellé tel qu’imprimé sur le ticket' },
          qty: { type: 'number', description: 'Quantité totale (poids/volume si lisible, sinon nombre d’articles)' },
          unit: { type: 'string', enum: ['g', 'mL', 'pièce'] },
          price: num,
          category: { type: 'string', enum: RECEIPT_CATEGORIES },
          nova: { type: 'integer', description: 'Groupe NOVA probable 1 à 4' },
          wholeGrain: { type: 'boolean' },
        },
      },
    },
  },
};

// Ticket de caisse → liste d'articles normalisés (garde-manger).
export async function readReceipt({ apiKey, model }, dataUrl) {
  const c = await client(apiKey);
  const resp = await c.beta.messages.create({
    model,
    max_tokens: 16000,
    ...fallbackParams(model),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
    system: "Tu lis des tickets de caisse de supermarchés français. Décode les abréviations (ex. « YAO NAT 4X125 » = yaourt nature, 500 g ; « CHOCAPIC » = céréales chocolatées, NOVA 4). Ignore les remises, consignes et lignes de paiement. Classe chaque article et estime son groupe NOVA.",
    messages: [{ role: 'user', content: [imageBlock(dataUrl), { type: 'text', text: 'Extrais les articles de ce ticket.' }] }],
  });
  return parseJson(resp);
}
