// Scanner de code-barres (caméra) + fiche produit Open Food Facts.

// Additifs fréquents faisant l'objet d'alertes (EFSA, CIRC, études récentes). Liste non exhaustive.
export const ADDITIVES = {
  e171: { name: 'Dioxyde de titane', level: 'eleve', note: 'Interdit dans l’UE depuis 2022 (EFSA : génotoxicité non exclue).' },
  e249: { name: 'Nitrite de potassium', level: 'eleve', note: 'Nitrites : associés au cancer colorectal (CIRC, ANSES 2022).' },
  e250: { name: 'Nitrite de sodium', level: 'eleve', note: 'Nitrites : associés au cancer colorectal (CIRC, ANSES 2022).' },
  e251: { name: 'Nitrate de sodium', level: 'eleve', note: 'Nitrates ajoutés : à limiter (ANSES 2022).' },
  e252: { name: 'Nitrate de potassium', level: 'eleve', note: 'Nitrates ajoutés : à limiter (ANSES 2022).' },
  e951: { name: 'Aspartame', level: 'moyen', note: '« Peut-être cancérogène » (CIRC 2023) ; associé au risque cardiovasculaire (NutriNet-Santé).' },
  e950: { name: 'Acésulfame K', level: 'moyen', note: 'Édulcorant associé à un risque cardiovasculaire accru (NutriNet-Santé, BMJ 2022).' },
  e955: { name: 'Sucralose', level: 'moyen', note: 'Édulcorant associé à un risque cardiovasculaire accru (NutriNet-Santé, BMJ 2022).' },
  e150d: { name: 'Caramel au sulfite d’ammonium', level: 'moyen', note: 'Peut contenir du 4-MEI, cancérogène possible.' },
  e407: { name: 'Carraghénanes', level: 'moyen', note: 'Émulsifiant associé à l’inflammation intestinale et au risque cardiovasculaire (NutriNet-Santé).' },
  e433: { name: 'Polysorbate 80', level: 'moyen', note: 'Émulsifiant perturbant le microbiote (Chassaing, Nature 2015).' },
  e466: { name: 'Carboxyméthylcellulose', level: 'moyen', note: 'Émulsifiant perturbant le microbiote (Chassaing, Nature 2015 ; Gastroenterology 2022).' },
  e471: { name: 'Mono- et diglycérides d’acides gras', level: 'moyen', note: 'Associés au risque cardiovasculaire et de cancer (NutriNet-Santé, BMJ 2023).' },
  e621: { name: 'Glutamate monosodique', level: 'faible', note: 'Exhausteur de goût, favorise la surconsommation.' },
  e102: { name: 'Tartrazine', level: 'moyen', note: 'Colorant azoïque : possible hyperactivité chez l’enfant (étude de Southampton).' },
  e110: { name: 'Jaune orangé S', level: 'moyen', note: 'Colorant azoïque : possible hyperactivité chez l’enfant.' },
  e129: { name: 'Rouge allura', level: 'moyen', note: 'Colorant azoïque : possible hyperactivité chez l’enfant.' },
  e320: { name: 'BHA', level: 'eleve', note: 'Cancérogène possible (CIRC 2B), perturbateur endocrinien suspecté.' },
  e321: { name: 'BHT', level: 'moyen', note: 'Perturbateur endocrinien suspecté.' },
  e338: { name: 'Acide phosphorique', level: 'faible', note: 'Fréquent dans les sodas ; excès de phosphates.' },
  e450: { name: 'Diphosphates', level: 'faible', note: 'Excès de phosphates ajoutés.' },
};

// Allergies saisies en français → étiquettes Open Food Facts (14 allergènes réglementaires).
const ALLERGEN_TAGS = {
  noix: 'nuts', 'fruits à coque': 'nuts', noisette: 'nuts', amande: 'nuts', arachide: 'peanuts', cacahuète: 'peanuts', cacahuete: 'peanuts',
  lait: 'milk', lactose: 'milk', laitier: 'milk', gluten: 'gluten', blé: 'gluten', ble: 'gluten', œuf: 'eggs', oeuf: 'eggs',
  poisson: 'fish', soja: 'soybeans', crustacé: 'crustaceans', crustace: 'crustaceans', sésame: 'sesame-seeds', sesame: 'sesame-seeds',
  moutarde: 'mustard', céleri: 'celery', celeri: 'celery', sulfite: 'sulphur-dioxide-and-sulphites', mollusque: 'molluscs', lupin: 'lupin',
};
export function allergenTags(allergies = '') {
  return allergies.toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    .map((a) => Object.entries(ALLERGEN_TAGS).find(([fr]) => a.includes(fr))?.[1] || a);
}

const NUTRI_LABEL = { a: 'Excellent', b: 'Bon', c: 'Moyen', d: 'Médiocre', e: 'Mauvais' };
export const NUTRI_COLORS = { a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11' };

const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,quantity,serving_size,serving_quantity,nutriscore_grade,nova_group,ecoscore_grade,additives_tags,nutriments,image_front_small_url,allergens_tags,labels_tags';

export async function lookup(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts indisponible (${res.status})`);
  const j = await res.json();
  if (j.status !== 1 || !j.product) return null;
  return normalize(j.product, code);
}

// Valeur pour 100 g : certaines fiches ne renseignent que le produit « préparé » ou la portion.
export function per100Of(n, key, serving) {
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const direct = num(n[`${key}_100g`]) ?? num(n[`${key}_prepared_100g`]);
  if (direct != null) return direct;
  const sv = num(n[`${key}_serving`]) ?? num(n[`${key}_prepared_serving`]);
  return sv != null && serving ? (sv * 100) / serving : null;
}

export function normalize(p, code) {
  const n = p.nutriments || {};
  const serving = Number(p.serving_quantity) || null;
  const v = (k) => per100Of(n, k, serving);
  const kj = v('energy-kj') ?? v('energy');
  const per100 = {
    kcal: v('energy-kcal') ?? (kj != null ? kj / 4.184 : 0),
    protein: v('proteins') || 0,
    carbs: v('carbohydrates') || 0,
    sugar: v('sugars') || 0,
    fat: v('fat') || 0,
    satFat: v('saturated-fat') || 0,
    fiber: v('fiber') || 0,
    sodium: (v('sodium') ?? (v('salt') != null ? v('salt') / 2.5 : 0)) * 1000,
    fruitVeg: v('fruits-vegetables-nuts-estimate-from-ingredients') || 0, // % → g pour 100 g
  };
  per100.kcal = Math.round(per100.kcal * 10) / 10;
  const additives = (p.additives_tags || []).map((t) => {
    const id = t.replace(/^en:/, '');
    return { id: id.toUpperCase(), ...(ADDITIVES[id] || { name: '', level: 'neutre', note: '' }) };
  });
  return {
    code,
    name: p.product_name_fr || p.product_name || 'Produit sans nom',
    brand: p.brands || '',
    quantity: p.quantity || '',
    serving,
    missing: !per100.kcal && !per100.protein && !per100.carbs && !per100.fat,
    servingLabel: p.serving_size || '',
    nutriscore: (p.nutriscore_grade || '').toLowerCase().match(/^[a-e]$/) ? p.nutriscore_grade.toLowerCase() : null,
    nova: Number(p.nova_group) || null,
    ecoscore: (p.ecoscore_grade || '').match(/^[a-e]$/) ? p.ecoscore_grade : null,
    additives,
    allergens: (p.allergens_tags || []).map((a) => a.replace(/^\w+:/, '')),
    image: p.image_front_small_url || '',
    per100,
    alcohol: Number(n.alcohol_100g ?? n.alcohol) || 0, // % vol. pour les boissons
  };
}

// Recherche par nom (ex. « kit kat ») dans Open Food Facts, sans clé ni compte.
// Résultats reclassés : nom qui contient tous les mots, produit vendu en France, valeurs nutritionnelles présentes.
const cache = new Map();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Android : moteur de recherche récent, appelé en natif (il refuse les appels directs depuis une page web).
async function hitsNative(q) {
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return null;
  const r = await CapacitorHttp.get({ url: 'https://search.openfoodfacts.org/search', params: { q, langs: 'fr', page_size: '40', fields: `${FIELDS},countries_tags,unique_scans_n` }, connectTimeout: 8000, readTimeout: 10000 });
  if (r.status !== 200) return null;
  const j = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  return j.hits || null;
}

// Partout : recherche classique (CORS ouvert, ~10 recherches/min ; au-delà, réponse 503 sans en-têtes CORS).
async function hitsClassic(q, signal) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=40&lc=fr&fields=${FIELDS},countries_tags,unique_scans_n`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return (await res.json()).products || [];
      if (attempt || ![429, 503].includes(res.status)) throw new Error(`Recherche indisponible (${res.status})`);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (attempt) throw new Error(navigator.onLine === false ? 'Pas de connexion internet.' : 'Open Food Facts est saturé ou limite les recherches rapprochées : réessaie dans quelques secondes.');
    }
    await wait(2500);
  }
}

export async function search(q, { signal } = {}) {
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const key = norm(q);
  if (cache.has(key)) return cache.get(key);
  const hits = (await hitsNative(q).catch(() => null)) || (await hitsClassic(q, signal));
  const words = key.split(' ').filter(Boolean);
  const seen = new Set();
  const out = hits.map((h, i) => {
    const brands = Array.isArray(h.brands) ? h.brands.join(', ') : h.brands;
    const prod = normalize({ ...h, brands }, h.code);
    const hay = norm(`${prod.name} ${brands}`);
    const score = words.filter((w) => hay.includes(w)).length * 10 + ((h.countries_tags || []).includes('en:france') ? 6 : 0)
      + (prod.missing ? -30 : 0) + Math.min(8, Math.log2(1 + (h.unique_scans_n || 0))) + (prod.image ? 2 : 0) - i * 0.15;
    return { prod, score };
  }).filter(({ prod }) => {
    const k = norm(`${prod.name}|${prod.brand.split(',')[0]}|${prod.quantity}`);
    return !seen.has(k) && seen.add(k);
  }).sort((a, b) => b.score - a.score).map((x) => x.prod).slice(0, 20);
  cache.set(key, out);
  return out;
}

export const forGrams = (per100, g) => Object.fromEntries(Object.entries(per100).map(([k, v]) => [k, Math.round(((v * g) / 100) * 10) / 10]));

// Avis personnalisé selon le produit, le profil et ce qui a déjà été mangé aujourd'hui.
export function verdict(prod, grams, { targets, totToday, profile }) {
  const n = forGrams(prod.per100, grams);
  const pros = [], cons = [];
  let score = { a: 90, b: 75, c: 55, d: 35, e: 20 }[prod.nutriscore] ?? 55;
  if (prod.nova === 4) { score -= 15; cons.push('ultra-transformé (NOVA 4) : associé à un risque accru de maladies cardiovasculaires, diabète et dépression (BMJ 2024)'); }
  if (prod.nova === 1) { score += 5; pros.push('aliment brut ou peu transformé'); }
  const risky = prod.additives.filter((a) => a.level === 'eleve' || a.level === 'moyen');
  if (risky.length) { score -= Math.min(20, 8 * risky.length); cons.push(`${risky.length} additif(s) à surveiller`); }
  if (n.sugar >= targets.sugarMax * 0.15 && n.sugar + totToday.sugar > targets.sugarMax) { score -= 10; cons.push(`te ferait dépasser ta limite de sucres du jour (${targets.sugarMax} g)`); }
  if (n.sodium >= targets.sodiumMax * 0.15 && n.sodium + totToday.sodium > targets.sodiumMax) { score -= 10; cons.push('te ferait dépasser ta limite de sel du jour'); }
  if (n.protein >= 15) pros.push(`bonne source de protéines (${n.protein} g)`);
  if (n.fiber >= 5) pros.push(`riche en fibres (${n.fiber} g)`);
  if (profile.goal === 'perdre' && n.kcal > 400) cons.push(`portion calorique (${Math.round(n.kcal)} kcal) pour ton objectif de perte de poids`);
  const banned = allergenTags(profile.allergies);
  const hit = prod.allergens.filter((a) => banned.some((b) => a.includes(b) || b.includes(a)));
  if (hit.length) { score = 0; cons.unshift(`⚠️ contient : ${hit.join(', ')}`); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, verdict: score >= 65 ? 'bon' : score >= 40 ? 'moyen' : 'a_limiter', pros, cons, n, nutriLabel: NUTRI_LABEL[prod.nutriscore] };
}

// ---------- Caméra ----------
let detectorPromise;
async function getDetector() {
  detectorPromise ||= (async () => {
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    if ('BarcodeDetector' in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats?.().catch(() => []);
      if (supported?.includes('ean_13')) return new window.BarcodeDetector({ formats });
    }
    const { BarcodeDetector } = await import('barcode-detector/ponyfill');
    return new BarcodeDetector({ formats });
  })();
  return detectorPromise;
}

// Démarre la caméra dans <video> et appelle onCode(code) au premier code lu. Renvoie stop().
export async function startScanner(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  await video.play();
  const detector = await getDetector();
  let stopped = false, last = '', hits = 0;
  const stop = () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); };
  const tick = async () => {
    if (stopped) return;
    try {
      const codes = await detector.detect(video);
      const v = codes[0]?.rawValue;
      // deux lectures identiques consécutives pour éviter les erreurs
      if (v) { hits = v === last ? hits + 1 : 1; last = v; }
      if (hits >= 2) { stop(); navigator.vibrate?.(60); onCode(v); return; }
    } catch { /* image pas prête */ }
    setTimeout(tick, 180);
  };
  tick();
  return stop;
}
