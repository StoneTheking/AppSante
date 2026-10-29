// Garde-manger alimenté par les tickets de caisse, et qualité du panier.
import { tokens } from './family.js';

// Indicateurs du panier (part en prix, ou en nombre d'articles si les prix manquent).
export function basketStats(items) {
  const food = items.filter((i) => i.category !== 'Non alimentaire');
  const w = (i) => Number(i.price) || 1;
  const total = food.reduce((a, i) => a + w(i), 0) || 1;
  const share = (fn) => food.filter(fn).reduce((a, i) => a + w(i), 0) / total;
  const stats = {
    n: food.length,
    upf: share((i) => i.nova >= 4),
    fruitVeg: share((i) => i.category === 'Fruits & légumes'),
    legumes: food.some((i) => i.category === 'Légumineuses'),
    wholeGrain: food.some((i) => i.wholeGrain),
    sugaryDrinks: share((i) => i.category === 'Boissons sucrées'),
    sweets: share((i) => i.category === 'Snacks sucrés'),
    alcohol: share((i) => i.category === 'Alcool'),
    fish: food.some((i) => /poisson|saumon|sardine|maquereau|thon|cabillaud|truite|hareng/i.test(i.name)),
  };
  let score = 50;
  score += Math.min(25, stats.fruitVeg * 80);
  score -= Math.min(30, stats.upf * 60);
  score -= Math.min(15, (stats.sugaryDrinks + stats.sweets) * 50);
  score -= Math.min(10, stats.alcohol * 40);
  if (stats.legumes) score += 6;
  if (stats.wholeGrain) score += 6;
  if (stats.fish) score += 5;
  stats.score = Math.max(0, Math.min(100, Math.round(score)));
  return stats;
}

export function basketAdvice(st) {
  const out = [];
  const pct = (x) => `${Math.round(x * 100)} %`;
  if (st.fruitVeg < 0.25) out.push({ level: 'attention', text: `Fruits & légumes : ${pct(st.fruitVeg)} du panier. Vise environ un tiers : ils réduisent le risque cardiovasculaire et la mortalité.`, src: ['aune2017'] });
  else out.push({ level: 'bon', text: `Fruits & légumes : ${pct(st.fruitVeg)} du panier, bravo.`, src: ['aune2017'] });
  if (st.upf > 0.3) out.push({ level: 'alerte', text: `Ultra-transformés : ${pct(st.upf)} du panier. En essai contrôlé, ils font manger ~500 kcal de plus par jour.`, src: ['hall2019', 'lane2024', 'perry2024'] });
  if (st.sugaryDrinks > 0.05) out.push({ level: 'attention', text: 'Boissons sucrées dans le panier : associées à une mortalité plus élevée ; préfère l’eau (pétillante, aromatisée maison).', src: ['malik2019'] });
  if (!st.legumes) out.push({ level: 'attention', text: 'Pas de légumineuses : lentilles, pois chiches ou haricots au moins 2 fois par semaine.', src: ['anses2016'] });
  if (!st.wholeGrain) out.push({ level: 'attention', text: 'Pas de céréales complètes : pain, pâtes ou riz complets (90 g/j = −17 % de mortalité).', src: ['aune2016grains'] });
  if (!st.fish) out.push({ level: 'attention', text: 'Pas de poisson : 2 fois par semaine dont un poisson gras (sardine, maquereau, saumon).', src: ['anses2016'] });
  return out;
}

// Ajoute les articles d'un ticket au garde-manger (fusion par nom).
export function addToPantry(pantry, items, date) {
  const out = [...pantry];
  for (const i of items.filter((x) => x.category !== 'Non alimentaire')) {
    const ex = out.find((p) => p.name.toLowerCase() === i.name.toLowerCase() && p.unit === i.unit);
    if (ex) ex.qty += Number(i.qty) || 1;
    else out.push({ id: crypto.randomUUID(), name: i.name, qty: Number(i.qty) || 1, unit: i.unit, category: i.category, nova: i.nova, added: date });
  }
  return out;
}

// Un ingrédient de recette est-il disponible au garde-manger ?
export function inPantry(pantry, ingredientName) {
  const ws = tokens(ingredientName);
  return pantry.find((p) => {
    const pw = tokens(p.name);
    return ws.some((w) => pw.includes(w));
  });
}

export const pantryText = (pantry) => pantry.map((p) => `${p.name} (${Math.round(p.qty)} ${p.unit})`).join(', ');
