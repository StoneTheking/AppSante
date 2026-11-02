// Ta ville : une petite ville qui traduit ta santé et ton niveau.
// - Le niveau (XP des quêtes) agrandit le terrain et débloque bâtiments, améliorations et interactions.
// - Tes habitudes des 7 derniers jours (bouger, assiette, sommeil, eau, humeur) font la « vitalité » de la ville :
//   chaque famille de bâtiments dépend d'un domaine, la météo, l'herbe, la brume et le moral des habitants aussi.
// - Gestion : des pièces gagnées avec tes quêtes et les recettes des commerces, à investir dans la ville.
// Tout ce qui dépend de la santé est recalculé à partir des données ; seuls les choix du joueur sont enregistrés.
import * as G from './gamify.js';

export const GRID = 9; // 9 × 9 parcelles, la mairie au centre
export const C = 4; // indice du centre
export const START_COINS = 150;
export const INCOME_CAP_H = 12; // les recettes s'accumulent au plus 12 h : il faut repasser en ville

export const DOMAINS = {
  move: { label: 'Activité', quest: 'Bouger 30 min', icon: '🏃', color: '#fb923c' },
  food: { label: 'Alimentation', quest: 'Assiette équilibrée', icon: '🥦', color: '#4ade80' },
  sleep: { label: 'Sommeil', quest: 'Nuit de 7 h', icon: '🌙', color: '#818cf8' },
  water: { label: 'Hydratation', quest: 'Bien s’hydrater', icon: '💧', color: '#60a5fa' },
  mood: { label: 'Moral', quest: 'Check-in humeur', icon: '😊', color: '#f472b6' },
};

// Ce que chaque domaine change, visiblement, dans la ville.
export const EFFECTS = {
  move: ['Les habitants marchent d’un bon pas et le club de course sort', 'Les habitants traînent des pieds, la salle de sport est vide'],
  food: ['Les étals débordent de fruits et légumes', 'Les étals sont vides, les commerces de bouche rapportent peu'],
  sleep: ['Le ciel est dégagé, la ville est reposée', 'Une brume de fatigue flotte sur la ville'],
  water: ['Les fontaines coulent, l’herbe est bien verte', 'Les fontaines sont à sec et l’herbe jaunit'],
  mood: ['Les habitants discutent et rient dans les rues', 'Les habitants se croisent sans se parler'],
};

// Catalogue. kind : home (logement), shop (commerce, emplois et recettes), fun (loisirs), civic (service), deco.
// lvl : niveau du joueur requis ; cap : places de logement ; jobs : emplois ; inc : pièces/heure au niveau 1.
export const BUILDINGS = {
  hall: { name: 'Mairie', kind: 'civic', lvl: 1, cost: 0, jobs: 2, emoji: '🏛️', fixed: true, desc: 'Le cœur de la ville. Elle grandit avec ton niveau et collecte l’impôt des habitants.' },
  house: { name: 'Maison', kind: 'home', lvl: 1, cost: 30, cap: 4, emoji: '🏠', desc: 'Une maison familiale pour 4 habitants.' },
  cottage: { name: 'Chalet', kind: 'home', lvl: 2, cost: 50, cap: 3, charm: 2, emoji: '🛖', desc: 'Petit chalet en bois avec jardin : plus de charme autour.' },
  flats: { name: 'Immeuble', kind: 'home', lvl: 4, cost: 130, cap: 12, emoji: '🏢', desc: 'Beaucoup d’habitants sur une seule parcelle.' },
  villa: { name: 'Villa', kind: 'home', lvl: 6, cost: 180, cap: 6, charm: 4, emoji: '🏡', desc: 'Villa avec piscine : ses habitants sont plus heureux.' },
  grocer: { name: 'Primeur', kind: 'shop', dom: 'food', lvl: 1, cost: 40, jobs: 2, inc: 2, emoji: '🍎', desc: 'Fruits et légumes frais. Ses étals se remplissent quand ton assiette est équilibrée.' },
  bakery: { name: 'Boulangerie', kind: 'shop', dom: 'food', lvl: 2, cost: 60, jobs: 2, inc: 3, emoji: '🥖', desc: 'Pain complet et viennoiseries, avec son petit moulin.' },
  market: { name: 'Marché couvert', kind: 'shop', dom: 'food', lvl: 5, cost: 150, jobs: 5, inc: 6, emoji: '🧺', desc: 'Les producteurs du coin, tous les jours.' },
  gym: { name: 'Salle de sport', kind: 'fun', dom: 'move', lvl: 2, cost: 70, jobs: 2, inc: 3, emoji: '🏋️', desc: 'Pleine quand tu bouges, vide quand tu restes assis.' },
  pool: { name: 'Piscine', kind: 'fun', dom: 'move', lvl: 4, cost: 120, jobs: 3, inc: 5, emoji: '🏊', desc: 'Bassin de 25 m et plongeoir.' },
  stadium: { name: 'Stade', kind: 'fun', dom: 'move', lvl: 7, cost: 260, jobs: 6, inc: 9, emoji: '🏟️', desc: 'Piste d’athlétisme et terrain : le club de course s’y entraîne.' },
  fountain: { name: 'Fontaine', kind: 'civic', dom: 'water', lvl: 1, cost: 25, jobs: 0, inc: 1, charm: 3, emoji: '⛲', desc: 'Elle coule quand tu bois assez, elle s’assèche sinon.' },
  baths: { name: 'Thermes', kind: 'fun', dom: 'water', lvl: 5, cost: 160, jobs: 4, inc: 6, emoji: '♨️', desc: 'Bains chauds et vapeur.' },
  zen: { name: 'Jardin zen', kind: 'fun', dom: 'sleep', lvl: 3, cost: 60, jobs: 1, inc: 2, charm: 3, emoji: '🎋', desc: 'Pour se poser. Le calme revient quand tu dors bien.' },
  spa: { name: 'Maison du sommeil', kind: 'fun', dom: 'sleep', lvl: 4, cost: 110, jobs: 2, inc: 4, emoji: '🛌', desc: 'Siestes, massages et conseils pour mieux dormir.' },
  observatory: { name: 'Observatoire', kind: 'fun', dom: 'sleep', lvl: 6, cost: 200, jobs: 3, inc: 6, emoji: '🔭', desc: 'On y regarde les étoiles… quand la brume de fatigue ne les cache pas.' },
  cafe: { name: 'Café', kind: 'shop', dom: 'mood', lvl: 2, cost: 55, jobs: 2, inc: 3, emoji: '☕', desc: 'Terrasse où les habitants se retrouvent.' },
  bandstand: { name: 'Kiosque à musique', kind: 'fun', dom: 'mood', lvl: 3, cost: 70, jobs: 1, inc: 2, charm: 2, emoji: '🎶', desc: 'Concerts le soir quand le moral est bon.' },
  library: { name: 'Bibliothèque', kind: 'civic', dom: 'mood', lvl: 4, cost: 100, jobs: 2, inc: 3, emoji: '📚', desc: 'Lecture, jeux de société, ateliers.' },
  theatre: { name: 'Théâtre', kind: 'fun', dom: 'mood', lvl: 5, cost: 170, jobs: 4, inc: 7, emoji: '🎭', desc: 'Spectacles chaque soir.' },
  clinic: { name: 'Maison de santé', kind: 'civic', dom: 'all', lvl: 3, cost: 120, jobs: 3, inc: 4, emoji: '🏥', desc: 'Rassure tous les habitants. Elle reflète ta vitalité globale.' },
  park: { name: 'Parc', kind: 'deco', lvl: 1, cost: 15, charm: 3, emoji: '🌳', desc: 'Pelouse, arbres et bancs.' },
  flowers: { name: 'Parterre fleuri', kind: 'deco', lvl: 1, cost: 8, charm: 1, emoji: '🌷', desc: 'Des fleurs qui s’ouvrent quand la ville va bien.' },
  pond: { name: 'Étang', kind: 'deco', lvl: 3, cost: 35, charm: 3, emoji: '🦆', desc: 'Avec ses canards.' },
  playground: { name: 'Aire de jeux', kind: 'deco', lvl: 2, cost: 30, charm: 2, emoji: '🛝', desc: 'Toboggan et balançoire.' },
  windmill: { name: 'Éolienne', kind: 'deco', lvl: 4, cost: 45, charm: 1, emoji: '🌬️', desc: 'Énergie propre pour la ville.' },
  statue: { name: 'Ta statue', kind: 'deco', lvl: 6, cost: 90, charm: 4, emoji: '🗽', desc: 'Les habitants rendent hommage à leur maire en pleine forme.' },
};
export const CATEGORIES = [['home', 'Logements'], ['shop', 'Commerces'], ['fun', 'Loisirs'], ['civic', 'Services'], ['deco', 'Décoration']];

export const THEMES = {
  prairie: { label: 'Prairie', grass: '#7dbf5e', dry: '#c9b765', tree: ['#3f9b4a', '#5bb04f', '#2f8541'], ground: '#8a6a45', sand: '#e9d7a5' },
  automne: { label: 'Automne', grass: '#a6b356', dry: '#c8a55a', tree: ['#e07a2e', '#d4542b', '#e8b33a'], ground: '#7a5a3c', sand: '#e3cf9c' },
  hiver: { label: 'Hiver', grass: '#e9eff5', dry: '#d9dcd5', tree: ['#2f6f55', '#3c7d5f', '#285f4a'], ground: '#9aa5b1', sand: '#dfe6ec', snow: true },
  ile: { label: 'Île tropicale', grass: '#6fca73', dry: '#cbbf74', tree: ['#2fa35a', '#45b860', '#1f8f4c'], ground: '#c9a46a', sand: '#f6e4ae', palm: true },
};
export const PALETTES = {
  classique: { label: 'Classique', roofs: ['#c2553a', '#9c4a3a', '#d46b45', '#7a5c4e'], walls: ['#f3e6cf', '#efe2c4', '#e7d3b5', '#f6efe3'] },
  provence: { label: 'Provence', roofs: ['#d9774a', '#c9643d', '#e08a52', '#b85a37'], walls: ['#f2d49b', '#efc08c', '#f5e1b8', '#e9b77f'] },
  nordique: { label: 'Nordique', roofs: ['#3b4a5c', '#2f3b49', '#4f5f72', '#263240'], walls: ['#b6403a', '#e9e4da', '#d6a33c', '#4f7ea8'] },
  pastel: { label: 'Pastel', roofs: ['#e58fa8', '#7fb6d9', '#9fd39a', '#c7a3e0'], walls: ['#fdf1f4', '#eef7fd', '#f2fbef', '#f7f0fd'] },
};
export const COLORS = ['#f3e6cf', '#f2c5a0', '#cfe3f2', '#d8ecc9', '#f6d7e2', '#e6dcf5', '#f7e7a6', '#d9d9d9'];
export const FLAGS = ['#f97316', '#2dd4bf', '#818cf8', '#f472b6', '#facc15', '#ef4444'];

// Interactions avec les habitants, débloquées par le niveau.
export const ACTIONS = [
  { id: 'greet', label: 'Saluer', emoji: '👋', lvl: 1, cost: 0, gain: 1, joy: 4, text: 'te rend ton salut avec un grand sourire' },
  { id: 'fruit', label: 'Offrir un fruit', emoji: '🍎', lvl: 2, cost: 2, gain: 0, joy: 8, needs: 'grocer', text: 'croque dans le fruit avec plaisir' },
  { id: 'walk', label: 'Proposer une marche', emoji: '🚶', lvl: 3, cost: 0, gain: 2, joy: 8, text: 'part faire le tour de la ville d’un bon pas' },
  { id: 'sport', label: 'Inviter au sport', emoji: '🏋️', lvl: 4, cost: 0, gain: 3, joy: 10, needs: 'gym', text: 'file à la salle de sport' },
  { id: 'party', label: 'Inviter au café', emoji: '☕', lvl: 5, cost: 4, gain: 0, joy: 14, needs: 'cafe', text: 'te retrouve en terrasse' },
];

// Objectifs de maire, avec récompense en pièces.
export const GOALS = [
  { id: 'shop', label: 'Ouvrir un premier commerce', reward: 20, test: (m) => m.buildings.some((b) => b.def.kind === 'shop') },
  { id: 'pop10', label: 'Atteindre 10 habitants', reward: 30, test: (m) => m.population >= 10 },
  { id: 'deco5', label: 'Poser 5 décorations', reward: 25, test: (m) => m.buildings.filter((b) => b.def.kind === 'deco').length >= 5 },
  { id: 'happy70', label: 'Habitants heureux à 70 %', reward: 40, test: (m) => m.happiness >= 70 },
  { id: 'pop25', label: 'Atteindre 25 habitants', reward: 60, test: (m) => m.population >= 25 },
  { id: 'domains', label: 'Un bâtiment pour chaque domaine de santé', reward: 80, test: (m) => Object.keys(DOMAINS).every((d) => m.buildings.some((b) => b.def.dom === d)) },
  { id: 'upgrade3', label: 'Améliorer un bâtiment au niveau 3', reward: 50, test: (m) => m.buildings.some((b) => b.lvl >= 3) },
  { id: 'vital80', label: 'Vitalité de la ville à 80', reward: 60, test: (m) => m.vitality >= 80 },
  { id: 'pop50', label: 'Atteindre 50 habitants', reward: 120, test: (m) => m.population >= 50 },
  { id: 'full', label: 'Construire sur toutes les parcelles', reward: 150, test: (m) => m.free.length === 0 && m.radius >= 4 },
];

export const key = (i, j) => `${i},${j}`;
export const parse = (k) => k.split(',').map(Number);

// Terrain constructible : un carré autour de la mairie qui s'agrandit avec le niveau.
export const radiusFor = (level) => Math.min(4, 1 + Math.floor(level / 2)); // niv. 1 → 3 × 3, niv. 2 → 5 × 5, niv. 4 → 7 × 7, niv. 6 → 9 × 9
export const levelForRadius = (r) => Math.max(1, (r - 1) * 2);
export const inRadius = (k, r) => { const [i, j] = parse(k); return Math.abs(i - C) <= r && Math.abs(j - C) <= r; };

export function blank(now = new Date()) {
  return { v: 1, name: 'Ma ville', founded: G.dayKeyOffset(0, now), spent: 0, bonus: 0, collected: 0, hallAt: +now, lots: {}, theme: 'prairie', palette: 'classique', flag: FLAGS[0], time: 'reel', claimed: [], social: { day: '', done: {} }, greets: 0, seed: Math.floor(Math.random() * 1e9) };
}

// Ville de départ : quelques maisons, un primeur, une fontaine et un parc, pour ne pas commencer sur un terrain vide.
export function starter(now = new Date()) {
  const t = blank(now);
  const at = +now;
  t.lots = {
    [key(3, 3)]: { b: 'house', rot: 0, color: 0, lvl: 1, at },
    [key(5, 3)]: { b: 'house', rot: 0, color: 2, lvl: 1, at },
    [key(3, 5)]: { b: 'grocer', rot: 2, color: 0, lvl: 1, at },
    [key(5, 5)]: { b: 'fountain', rot: 0, color: 0, lvl: 1, at },
    [key(4, 5)]: { b: 'park', rot: 0, color: 0, lvl: 1, at },
  };
  return t;
}

// ---------- Vitalité : les 7 derniers jours de quêtes, aujourd'hui compte un peu moins (la journée n'est pas finie)
export function domains(st, now = new Date()) {
  const out = {}, w = {};
  for (const d of Object.keys(DOMAINS)) { out[d] = 0; w[d] = 0; }
  for (let i = 7; i >= 0; i--) { // passé d'abord : aujourd'hui est comparé à la moyenne de la semaine
    const k = G.dayKeyOffset(-i, now);
    const goals = G.dayGoals(st, k);
    const wt = i === 0 ? 0.6 : 1 - (i - 1) * 0.06;
    for (const g of goals) if (g.id in out) {
      // aujourd'hui ne peut qu'améliorer : une journée commencée ne pénalise pas la ville le matin
      if (i === 0 && g.progress < (out[g.id] / (w[g.id] || 1))) continue;
      out[g.id] += g.progress * wt; w[g.id] += wt;
    }
  }
  for (const d of Object.keys(out)) out[d] = w[d] ? Math.round((out[d] / w[d]) * 100) / 100 : 0;
  return out;
}
export const vitalityOf = (dom) => Math.round((Object.values(dom).reduce((a, b) => a + b, 0) / Object.keys(dom).length) * 100);
export const stateOf = (x) => (x >= 0.75 ? 'top' : x >= 0.45 ? 'ok' : 'low');
export const STATE_LABEL = { top: 'Florissant', ok: 'Correct', low: 'En difficulté' };
export const weatherOf = (vit, dom) => (vit >= 68 ? 'soleil' : vit >= 45 ? 'nuages' : 'pluie') + (dom.sleep < 0.8 ? '+brume' : '') // moins de ~5 h 30 par nuit en moyenne;

// Pièces gagnées par la santé : 3 par quête réussie, +8 par journée validée, +12 si parfaite, depuis 7 jours avant la fondation.
export function earned(st, town, now = new Date()) {
  const today = G.dayKeyOffset(0, now);
  const start = new Date(`${town.founded}T12:00:00`); start.setDate(start.getDate() - 7);
  let coins = 0;
  for (let d = new Date(start), k = G.dayKeyOffset(0, d); k <= today; d.setDate(d.getDate() + 1), k = G.dayKeyOffset(0, d)) {
    const goals = G.dayGoals(st, k);
    const done = goals.filter((g) => g.done).length;
    coins += done * 3;
    if (G.dayOk(goals, G.needFor(st, k))) coins += 8 + (done === goals.length ? 12 : 0);
  }
  return coins;
}

const lvlMul = (l) => [1, 1, 1.6, 2.3][l] || 1;
export const capOf = (b) => Math.round((BUILDINGS[b.b].cap || 0) * (1 + 0.5 * ((b.lvl || 1) - 1)));
export const upgradeCost = (b) => Math.round(Math.max(30, BUILDINGS[b.b].cost) * (b.lvl || 1) * 1.2);
export const upgradeLevel = (b) => BUILDINGS[b.b].lvl + ((b.lvl || 1) === 1 ? 1 : 3); // niveau du joueur requis pour l'amélioration suivante
export const canUpgrade = (b) => BUILDINGS[b.b].kind !== 'deco' && (b.lvl || 1) < 3;
const domScore = (def, dom, vit) => (def.dom === 'all' ? vit / 100 : def.dom ? dom[def.dom] : vit / 100);
export const rateOf = (b, dom, vit) => { const d = BUILDINGS[b.b]; return d.inc ? d.inc * lvlMul(b.lvl || 1) * (0.3 + 0.7 * domScore(d, dom, vit)) : 0; };

// ---------- Habitants
const FIRST = ['Léa', 'Hugo', 'Chloé', 'Lucas', 'Emma', 'Louis', 'Manon', 'Gabriel', 'Inès', 'Jules', 'Camille', 'Arthur', 'Zoé', 'Nathan', 'Jade', 'Tom', 'Lina', 'Raphaël', 'Alice', 'Sacha', 'Rose', 'Noah', 'Anna', 'Adam', 'Mila', 'Paul', 'Lou', 'Théo', 'Nina', 'Malo', 'Eva', 'Léon', 'Romane', 'Yanis', 'Clara', 'Victor', 'Sarah', 'Mathis', 'Agathe', 'Ethan', 'Margaux', 'Simon', 'Juliette', 'Axel', 'Ambre', 'Noé', 'Elsa', 'Robin', 'Iris', 'Basile', 'Louise', 'Marius', 'Capucine', 'Oscar', 'Jeanne', 'Gaspard', 'Lise', 'Aaron', 'Céleste', 'Milo'];
const LAST = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroux', 'Moreau', 'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier', 'Faure'];
const SKIN = ['#f2c9a5', '#e0ac85', '#c98d64', '#a36a46', '#7a4b30', '#f5d6bd'];
const HAIR = ['#2b1d14', '#5a3a22', '#a8692e', '#e1c16e', '#1d1d1d', '#8c8c8c', '#b8432f', '#3a2618'];
const SHIRT = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#0ea5e9', '#84cc16', '#f43f5e'];
const HOBBY = { move: 'courir le matin', food: 'cuisiner des légumes du marché', sleep: 'faire la sieste au jardin', water: 'flâner près de la fontaine', mood: 'discuter avec tout le monde' };

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

export function person(seed, i) {
  const r = rng(seed * 31 + i * 7919);
  const doms = Object.keys(DOMAINS);
  return { id: i, name: `${pick(r, FIRST)} ${pick(r, LAST)}`, age: 18 + Math.floor(r() * 60), skin: pick(r, SKIN), hair: pick(r, HAIR), shirt: pick(r, SHIRT), pants: pick(r, ['#334155', '#1e3a8a', '#44403c', '#57534e', '#0f172a', '#4b5563']), fav: doms[Math.floor(r() * doms.length)], bald: r() < 0.12, long: r() < 0.4, h: 0.92 + r() * 0.16, speed: 0.85 + r() * 0.3 };
}

// ---------- Modèle complet de la ville
export function model(st, town, now = new Date()) {
  const p = G.progress(st, now);
  const level = p.level;
  const radius = radiusFor(level);
  const dom = domains(st, now);
  const vitality = vitalityOf(dom);
  const hallLvl = Math.min(3, 1 + Math.floor((level - 1) / 3));
  const lots = { ...town.lots, [key(C, C)]: { b: 'hall', rot: 0, color: 0, lvl: hallLvl, at: town.hallAt } };
  const dormant = Object.entries(lots).filter(([k, b]) => BUILDINGS[b.b] && !inRadius(k, radius)).length; // terrain perdu en redescendant de niveau : les bâtiments attendent sous la forêt
  const buildings = Object.entries(lots).filter(([k, b]) => BUILDINGS[b.b] && inRadius(k, radius)).map(([k, b]) => {
    const def = BUILDINGS[b.b];
    const [i, j] = parse(k);
    const score = domScore(def, dom, vitality);
    return { k, i, j, ...b, lvl: b.lvl || 1, def, score, state: def.dom || def.kind === 'shop' ? stateOf(score) : 'ok' };
  });
  const free = [];
  for (let i = C - radius; i <= C + radius; i++) for (let j = C - radius; j <= C + radius; j++) if (!lots[key(i, j)]) free.push(key(i, j));

  // logements → population : plus la ville va bien, plus les logements se remplissent
  const homes = buildings.filter((b) => b.def.kind === 'home');
  const capacity = homes.reduce((a, b) => a + capOf(b), 0);
  const fill = Math.min(1, Math.max(0.35, 0.35 + 0.75 * (vitality / 100)));
  const population = Math.round(capacity * fill);
  const jobs = [];
  for (const b of buildings) for (let n = 0; n < (b.def.jobs || 0) * Math.min(2, b.lvl); n++) jobs.push(b.k);
  // charme : décorations et bâtiments charmants sur les parcelles voisines
  const charmAt = (i, j) => buildings.reduce((a, b) => a + (Math.max(Math.abs(b.i - i), Math.abs(b.j - j)) === 1 ? b.def.charm || 0 : 0), 0);
  const has = (id) => buildings.some((b) => b.b === id);
  const hasDom = (d) => buildings.some((b) => b.def.dom === d);
  const social = town.social?.day === G.dayKeyOffset(0, now) ? town.social.done : {};

  const residents = [];
  let hi = 0, seat = 0;
  for (let n = 0; n < population; n++) {
    while (homes[hi] && seat >= capOf(homes[hi])) { hi++; seat = 0; }
    const home = homes[hi]; seat++;
    const r = person(town.seed, n);
    const work = jobs[n] || null;
    const parts = [
      ['La ville en général', Math.round((vitality - 50) * 0.7)],
      [`${DOMAINS[r.fav].label} (son domaine préféré)`, Math.round((dom[r.fav] - 0.5) * 30)],
      [hasDom(r.fav) ? 'A un lieu pour sa passion' : 'Aucun lieu pour sa passion', hasDom(r.fav) ? 6 : -6],
      [work ? 'A un emploi' : 'Cherche un emploi', work ? 6 : -8],
      ['Charme du quartier', Math.min(10, charmAt(home.i, home.j) * 2) + (home.def.charm || 0)],
      ...(has('clinic') ? [['Maison de santé', 5]] : []),
      ...((social[n] || []).length ? [['Tes attentions aujourd’hui', (social[n] || []).reduce((a, id) => a + (ACTIONS.find((x) => x.id === id)?.joy || 0), 0)]] : []),
    ];
    const happy = Math.max(0, Math.min(100, 52 + parts.reduce((a, [, v]) => a + v, 0)));
    residents.push({ ...r, home: home.k, work, happy, parts, done: social[n] || [] });
  }
  const happiness = residents.length ? Math.round(residents.reduce((a, r) => a + r.happy, 0) / residents.length) : 0;

  const t = +now;
  const hours = (at) => Math.min(INCOME_CAP_H, Math.max(0, (t - (at || t)) / 3.6e6));
  const tax = (population * 0.25) * (0.5 + happiness / 200); // pièces/heure de la mairie
  const pending = buildings.reduce((a, b) => a + (b.b === 'hall' ? tax : rateOf(b, dom, vitality)) * hours(b.at), 0);
  const coins = Math.max(0, START_COINS + earned(st, town, now) + (town.collected || 0) + (town.bonus || 0) - (town.spent || 0));

  const weekday = now.getDay();
  const events = [];
  if (dom.move >= 0.7 && population >= 6) events.push({ id: 'run', label: 'Le club de course sort', emoji: '🏃' });
  if ((weekday === 0 || weekday === 6) && level >= 3 && dom.food >= 0.45) events.push({ id: 'market', label: 'Marché du week-end sur la place', emoji: '🧺' });
  const goalsToday = G.dayGoals(st, G.dayKeyOffset(0, now)), goalsY = G.dayGoals(st, G.dayKeyOffset(-1, now));
  if (level >= 5 && (goalsToday.every((g) => g.done) || goalsY.every((g) => g.done))) events.push({ id: 'fete', label: 'Fête de la ville : journée parfaite !', emoji: '🎆' });
  if (has('bandstand') && dom.mood >= 0.6) events.push({ id: 'concert', label: 'Concert au kiosque ce soir', emoji: '🎶' });

  const goals = GOALS.map((g) => ({ ...g, done: false, claimed: (town.claimed || []).includes(g.id) }));
  const m = { level, title: p.title, radius, nextRadiusLevel: radius < 4 ? levelForRadius(radius + 1) : null, dom, vitality, weather: weatherOf(vitality, dom), buildings, dormant, free, capacity, population, jobs: jobs.length, residents, happiness, coins: Math.floor(coins), pending: Math.floor(pending), tax, events, theme: THEMES[town.theme] ? town.theme : 'prairie', palette: PALETTES[town.palette] ? town.palette : 'classique', flag: town.flag || FLAGS[0], name: town.name || 'Ma ville', time: town.time || 'reel', hallLvl };
  m.goals = goals.map((g) => ({ ...g, done: !!g.test(m) }));
  return m;
}

// ---------- Actions du joueur (renvoient un message d'erreur ou null ; modifient town)
export function build(town, m, k, id) {
  const def = BUILDINGS[id];
  if (!def || def.fixed) return 'Bâtiment inconnu';
  if (def.lvl > m.level) return `Débloqué au niveau ${def.lvl}`;
  if (!m.free.includes(k)) return 'Parcelle occupée ou pas encore débloquée';
  if (m.coins < def.cost) return `Il manque ${def.cost - m.coins} pièces`;
  town.lots[k] = { b: id, rot: 2, color: Math.floor(Math.random() * 4), lvl: 1, at: Date.now() };
  town.spent = (town.spent || 0) + def.cost;
  return null;
}
export function upgrade(town, m, k) {
  const b = town.lots[k];
  if (!b || !canUpgrade(b)) return 'Pas d’amélioration possible';
  const need = upgradeLevel(b);
  if (m.level < need) return `Amélioration débloquée au niveau ${need}`;
  const cost = upgradeCost(b);
  if (m.coins < cost) return `Il manque ${cost - m.coins} pièces`;
  collectOne(town, m, k);
  b.lvl = (b.lvl || 1) + 1;
  town.spent = (town.spent || 0) + cost;
  return null;
}
export const refund = (b) => Math.floor(BUILDINGS[b.b].cost * 0.5 * (b.lvl || 1));
export function sell(town, m, k) {
  const b = town.lots[k];
  if (!b) return 'Rien à vendre';
  collectOne(town, m, k);
  town.bonus = (town.bonus || 0) + refund(b);
  delete town.lots[k];
  return null;
}
export function move(town, m, from, to) {
  if (!town.lots[from]) return 'Rien à déplacer';
  if (!m.free.includes(to)) return 'Parcelle occupée ou pas encore débloquée';
  town.lots[to] = town.lots[from];
  delete town.lots[from];
  return null;
}
export const rotate = (town, k) => { if (town.lots[k]) town.lots[k].rot = ((town.lots[k].rot || 0) + 1) % 4; };
export const recolor = (town, k) => { if (town.lots[k]) town.lots[k].color = ((town.lots[k].color || 0) + 1) % COLORS.length; };

export function collect(town, m, k) { return collectOne(town, m, k); }
function collectOne(town, m, k) {
  const b = m.buildings.find((x) => x.k === k);
  if (!b) return 0;
  const h = Math.min(INCOME_CAP_H, Math.max(0, (Date.now() - (b.at || Date.now())) / 3.6e6));
  const got = Math.floor((b.b === 'hall' ? m.tax : rateOf(b, m.dom, m.vitality)) * h);
  if (b.b === 'hall') town.hallAt = Date.now(); else if (town.lots[k]) town.lots[k].at = Date.now();
  town.collected = (town.collected || 0) + got;
  return got;
}
export function collectAll(town, m) {
  return m.buildings.reduce((a, b) => a + collectOne(town, m, b.k), 0);
}
export function claim(town, m, id) {
  const g = m.goals.find((x) => x.id === id);
  if (!g || !g.done || g.claimed) return 0;
  town.claimed = [...(town.claimed || []), id];
  town.bonus = (town.bonus || 0) + g.reward;
  return g.reward;
}
export function interact(town, m, rid, actionId, now = new Date()) {
  const a = ACTIONS.find((x) => x.id === actionId);
  const r = m.residents.find((x) => x.id === rid);
  if (!a || !r) return 'Action impossible';
  if (a.lvl > m.level) return `Débloqué au niveau ${a.lvl}`;
  if (a.needs && !m.buildings.some((b) => b.b === a.needs)) return `Il faut d’abord un bâtiment « ${BUILDINGS[a.needs].name} »`;
  const day = G.dayKeyOffset(0, now);
  if (town.social?.day !== day) town.social = { day, done: {} };
  const done = town.social.done[rid] || [];
  if (done.includes(a.id)) return 'Déjà fait aujourd’hui avec cet habitant';
  if (m.coins < a.cost) return `Il manque ${a.cost - m.coins} pièces`;
  town.social.done[rid] = [...done, a.id];
  town.spent = (town.spent || 0) + a.cost;
  town.bonus = (town.bonus || 0) + a.gain;
  if (a.id === 'greet') town.greets = (town.greets || 0) + 1;
  return null;
}

// Ce que pense un habitant : ses envies, et l'état de la ville vu par ses yeux (donc ta santé).
export function thought(r, m, now = new Date()) {
  const d = m.dom;
  const weakest = Object.keys(d).sort((a, b) => d[a] - d[b])[0];
  const lines = {
    move: [`Le maire a la forme ! Toute la ville a envie de bouger.`, `Personne ne bouge en ce moment… même les chats sont fatigués.`],
    food: [`Le primeur n’a jamais eu d’aussi beaux légumes !`, `Les étals sont presque vides, on mange n’importe quoi.`],
    sleep: [`Quelle nuit ! Toute la ville s’est réveillée en forme.`, `Encore cette brume… on dort tous mal en ce moment.`],
    water: [`La fontaine coule à flots, quel bonheur par cette chaleur.`, `La fontaine est presque à sec, l’herbe jaunit.`],
    mood: [`Il y a une bonne ambiance en ville en ce moment !`, `L’ambiance est morose… un petit mot gentil ferait du bien.`],
  };
  const fav = lines[r.fav][d[r.fav] >= 0.6 ? 0 : 1];
  const worry = d[weakest] < 0.45 && weakest !== r.fav ? ` ${lines[weakest][1]}` : '';
  const job = r.work ? '' : ' Et j’aimerais bien trouver du travail ici.';
  const hour = now.getHours();
  const hello = hour < 11 ? 'Bonjour !' : hour < 18 ? 'Salut !' : 'Bonsoir !';
  return `${hello} ${fav}${worry}${job}`;
}
export const hobby = (r) => HOBBY[r.fav];
export const moodEmoji = (h) => (h >= 80 ? '😄' : h >= 65 ? '🙂' : h >= 45 ? '😐' : h >= 30 ? '😕' : '😢');

// Conseil concret pour faire repartir la ville : le domaine le plus faible.
export function advice(m) {
  const d = Object.keys(m.dom).sort((a, b) => m.dom[a] - m.dom[b])[0];
  if (m.dom[d] >= 0.75) return 'Ta ville est florissante : continue comme ça !';
  const tip = { move: 'Bouge 30 min aujourd’hui : la salle de sport se remplira et les habitants retrouveront leur énergie.', food: 'Une assiette avec moitié fruits et légumes remplira les étals du primeur.', sleep: 'Une nuit de 7 h ce soir dissipera la brume de fatigue.', water: 'Bois tes 2 L : les fontaines se remettront à couler et l’herbe reverdira.', mood: 'Fais ton check-in humeur : les habitants recommenceront à se parler.' }[d];
  return `${DOMAINS[d].icon} ${tip}`;
}
