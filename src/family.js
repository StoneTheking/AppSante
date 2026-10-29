// Foyer (repas en famille) et goûts personnels.
import * as S from './science.js';

// Besoins énergétiques des enfants, d'après EFSA 2013 (activité modérée), en kcal/j.
function childKcal(age, sex) {
  if (age < 4) return 1000;
  if (age < 7) return 1350;
  if (age < 11) return 1700;
  if (age < 15) return sex === 'f' ? 2000 : 2300;
  return sex === 'f' ? 2100 : 2700;
}

export function memberKcal(m) {
  const age = Number(m.age) || 35;
  if (age < 18) return childKcal(age, m.sex);
  const birthYear = new Date().getFullYear() - age;
  return S.targets({ ...m, birthYear, weight: Number(m.weight) || (m.sex === 'f' ? 62 : 75), height: Number(m.height) || (m.sex === 'f' ? 164 : 177), activityLevel: m.activityLevel || 'leger', goal: m.goal || 'maintenir' }).kcal;
}

// Coefficient de quantités pour cuisiner pour tout le foyer (1 = portion de l'utilisateur).
export function familyFactor(profile, household = []) {
  const me = S.targets(profile).kcal;
  return Math.round(((me + household.reduce((a, m) => a + memberKcal(m), 0)) / me) * 4) / 4;
}

const STRICTNESS = ['omnivore', 'pescetarien', 'vegetarien', 'vegan'];
// Contraintes communes : régime le plus strict et réunion des allergies.
export function familyConstraints(profile, household = []) {
  const all = [profile, ...household];
  const diet = all.map((m) => m.diet || 'omnivore').sort((a, b) => STRICTNESS.indexOf(b) - STRICTNESS.indexOf(a))[0];
  const allergies = [...new Set(all.flatMap((m) => (m.allergies || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean)))].join(', ');
  return { diet, allergies };
}

export function describeHousehold(profile, household = []) {
  if (!household.length) return 'Personne seule.';
  return `Foyer de ${household.length + 1} : moi + ${household.map((m) => `${m.name || 'membre'} (${m.age} ans${m.allergies ? `, allergies : ${m.allergies}` : ''}${m.diet && m.diet !== 'omnivore' ? `, ${m.diet}` : ''}${m.dislikes ? `, n'aime pas : ${m.dislikes}` : ''})`).join(', ')}. Quantités à multiplier par ${familyFactor(profile, household)} par rapport à ma portion.`;
}

// ---------- Goûts ----------
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'au', 'aux', 'a', 'à', 'en', 'avec', 'sans', 'sur', 'un', 'une', 'g', 'pour', 'maison', 'plat', 'repas']);
export const tokens = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

// Profil de goûts : déclarés (profil) + appris des notes données aux repas (★).
export function tasteProfile(profile, meals = []) {
  const likes = new Map(), dislikes = new Map();
  const bump = (map, w, v) => map.set(w, (map.get(w) || 0) + v);
  tokens(profile.likes).forEach((w) => bump(likes, w, 3));
  tokens((profile.cuisines || []).join(' ')).forEach((w) => bump(likes, w, 2));
  tokens(profile.dislikes).forEach((w) => bump(dislikes, w, 5));
  for (const m of meals.filter((x) => x.rating)) {
    const ws = tokens(m.title + ' ' + (m.items || []).map((i) => i.name).join(' '));
    for (const w of ws) {
      if (m.rating >= 4) bump(likes, w, m.rating - 3);
      if (m.rating <= 2) bump(dislikes, w, 3 - m.rating);
    }
  }
  return { likes, dislikes };
}

// Score de goût d'un plat (positif = susceptible de plaire).
export function tasteScore(text, taste) {
  let s = 0;
  const why = [];
  for (const w of new Set(tokens(text))) {
    if (taste.dislikes.has(w)) { s -= taste.dislikes.get(w) * 2; why.push(`−${w}`); }
    if (taste.likes.has(w)) { s += Math.min(4, taste.likes.get(w)); why.push(`+${w}`); }
  }
  return { s, why };
}

export function topTastes(taste, n = 8) {
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
  return { likes: top(taste.likes), dislikes: top(taste.dislikes) };
}
