// Menus de la semaine et liste de courses.
import { allowedMeals } from './meals.js';

export const SLOT_ORDER = ['petit-dej', 'dejeuner', 'collation', 'diner'];
export const SLOT_LABEL = { 'petit-dej': 'Petit-déjeuner', dejeuner: 'Déjeuner', collation: 'Collation', diner: 'Dîner' };
const SHARE = { 'petit-dej': 0.25, dejeuner: 0.35, collation: 0.1, diner: 0.3 };
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Les 7 jours à partir d'aujourd'hui, avec leur libellé.
export function weekDays(start = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10), label: DAYS[(d.getDay() + 6) % 7] };
  });
}

// Planificateur hors-ligne : équilibre calories par créneau, varie les plats, respecte régime et allergies.
export function offlinePlan({ targets, profile, ctx = {} }, start = new Date()) {
  const pool = allowedMeals(profile.diet, profile.allergies);
  const recent = [];
  return {
    source: 'local',
    created: new Date().toISOString(),
    days: weekDays(start).map(({ date, label }, di) => ({
      date,
      label,
      meals: SLOT_ORDER.filter((s) => s !== 'collation' || profile.goal !== 'perdre' || di % 2 === 0).map((slot) => {
        const target = targets.kcal * SHARE[slot];
        const cands = pool.filter((m) => m.slots.includes(slot));
        const scored = cands.map((m) => {
          let sc = -Math.abs(m.kcal - target) / 80 - (recent.includes(m.name) ? 6 : 0);
          if (m.fiber >= 9) sc += 1.5;
          if (m.protein >= 25) sc += 1.5;
          if (m.tags.includes('omega3') && (di === 1 || di === 4)) sc += 3; // poisson gras 2×/semaine (ANSES)
          if (slot === 'diner' && m.tags.includes('leger')) sc += 1;
          if (ctx.lowMood && m.tags.includes('humeur')) sc += 1;
          return { m, sc: sc + Math.random() * 1.5 };
        }).sort((a, b) => b.sc - a.sc);
        const m = scored[0]?.m;
        if (!m) return null;
        recent.push(m.name);
        if (recent.length > 8) recent.shift();
        const factor = Math.min(1.5, Math.max(0.75, Math.round((target / m.kcal) * 4) / 4));
        return {
          slot,
          name: m.name,
          portion: factor,
          kcal: Math.round(m.kcal * factor),
          protein: Math.round(m.protein * factor),
          fiber: Math.round(m.fiber * factor),
          prep: m.prep,
          ingredients: m.ing.map(([name, qty, unit, aisle]) => ({ name, qty: qty * factor, unit, aisle })),
          steps: '',
        };
      }).filter(Boolean),
    })),
  };
}

// Agrège les ingrédients de la semaine en liste de courses, groupée par rayon.
export function shoppingList(plan) {
  const map = new Map();
  for (const d of plan.days) for (const m of d.meals) for (const i of m.ingredients || []) {
    const key = `${i.name.toLowerCase()}|${i.unit}`;
    const cur = map.get(key) || { name: i.name, unit: i.unit, aisle: i.aisle || 'Divers', qty: 0 };
    cur.qty += Number(i.qty) || 0;
    map.set(key, cur);
  }
  const items = [...map.values()].map((i) => ({ ...i, qty: roundQty(i.qty, i.unit), id: `${i.name}|${i.unit}` }));
  const aisles = {};
  for (const i of items.sort((a, b) => a.name.localeCompare(b.name, 'fr'))) (aisles[i.aisle] ||= []).push(i);
  return aisles;
}

function roundQty(q, unit) {
  if (['pièce', 'boîte', 'portion'].includes(unit)) return Math.ceil(q * 2) / 2;
  if (q >= 100) return Math.ceil(q / 50) * 50;
  return Math.ceil(q / 5) * 5;
}

export const fmtQty = (i) => `${i.qty.toLocaleString('fr-FR')} ${i.unit === 'pièce' ? (i.qty > 1 ? 'pièces' : 'pièce') : i.unit}`;

export function listAsText(aisles, checked = {}) {
  return Object.entries(aisles)
    .map(([a, items]) => `${a.toUpperCase()}\n${items.filter((i) => !checked[i.id]).map((i) => `- ${i.name} : ${fmtQty(i)}`).join('\n')}`)
    .join('\n\n');
}
