// Persistance locale : toutes les données restent sur le téléphone (localStorage).
const KEY = 'appsante-v1';

const DEFAULT = {
  profile: {
    name: '',
    sex: 'h',
    birthYear: null,
    height: null,
    weight: null,
    waist: null,
    activityLevel: 'leger',
    goal: 'maintenir',
    wakeTime: '07:00',
    bedTime: '23:00',
    diet: 'omnivore',
    allergies: '',
    conditions: '',
    smoker: false,
    preferredSport: '',
    likes: '', // aliments et plats aimés
    dislikes: '', // aliments détestés
    cuisines: [], // cuisines préférées
    tastes: {}, // goûts choisis : { aliment: 1 (aime) | -1 (évite) }
    work: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:30', commute: 30, enabled: false },
    sportPref: 'auto', // moment préféré pour le sport : auto | matin | midi | soir
  },
  household: [], // autres membres du foyer : { id, name, age, sex, weight, height, goal, allergies, diet }
  location: null, // { name, lat, lon }
  env: null, // dernières données air & météo { fetched, ... }
  sleepNow: null, // heure de coucher en cours (ISO) via « Je vais dormir »
  sleepLog: [], // { bed, wake } (ISO)
  pantry: [], // garde-manger issu des tickets : { id, name, qty, unit, category, nova, added }
  receipts: [], // { id, date, store, total, stats }
  stools: [], // { id, at, bristol, pain, bloating, urgency, note }
  sleepAlarm: null, // heure de l'alarme du téléphone au coucher (ms)
  workouts: [], // séances : { id, type, intensity, start, date, minutes, kcal, source, note }
  calEvents: [], // événements de l'agenda du téléphone (7 jours) pour éviter les conflits
  workoutNow: null, // séance en cours (chronomètre) : { type, intensity, start }
  settings: {
    apiKey: '',
    model: 'claude-opus-5-5',
    reminders: { enabled: false, kinds: { light: true, meal: false, coffee: true, walk: true, sport: true, screens: true, bed: true, water: false, streak: true, weigh: true } },
    autoSync: true,
    webSearch: true, // le coach peut consulter PubMed, OMS, Lancet…
    theme: 'dark', // 'dark' | 'light' | 'auto'
  },
  days: {}, // 'AAAA-MM-JJ' -> check-in
  meals: [],
  weights: [], // { date, kg }
  chat: [],
  plan: null, // menus de la semaine
  shopChecked: {},
  shopExtra: [],
  lastSync: null,
  onboarded: false,
};

let state;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : {};
    return { ...structuredClone(DEFAULT), ...s, profile: { ...DEFAULT.profile, ...s.profile }, settings: { ...DEFAULT.settings, ...s.settings, reminders: { ...DEFAULT.settings.reminders, ...s.settings?.reminders, kinds: { ...DEFAULT.settings.reminders.kinds, ...s.settings?.reminders?.kinds } } } };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function get() {
  if (!state) state = load();
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // quota dépassé : on supprime les miniatures les plus anciennes puis on réessaie
    const withThumb = state.meals.filter((m) => m.thumb);
    if (withThumb.length) {
      withThumb.slice(0, Math.ceil(withThumb.length / 2)).forEach((m) => delete m.thumb);
      localStorage.setItem(KEY, JSON.stringify(state));
    } else throw e;
  }
}

export function update(fn) {
  fn(get());
  save();
}

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return today(d);
}

export function getDay(key = today()) {
  return get().days[key] || {};
}

export function setDay(key, data) {
  update((s) => {
    s.days[key] = { ...(s.days[key] || {}), ...data };
  });
}

export function mealsOn(key = today()) {
  return get().meals.filter((m) => m.date === key);
}

export function lastDays(n) {
  return Array.from({ length: n }, (_, i) => dayKey(-i)).reverse();
}

export function exportJSON() {
  const s = structuredClone(get());
  s.settings.apiKey = '';
  return JSON.stringify(s, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  const key = get().settings.apiKey;
  state = { ...structuredClone(DEFAULT), ...data };
  state.settings.apiKey ||= key;
  save();
}

export function reset() {
  localStorage.removeItem(KEY);
  state = load();
}
