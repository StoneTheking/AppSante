// Grignotages : ajout en un geste (portions types, valeurs moyennes d'après la table CIQUAL de l'Anses).
// n : nutriments par portion ; nova : niveau de transformation ; ok : en-cas plutôt favorable.
export const SNACKS = [
  { id: 'fruit', label: 'Fruit', emoji: '🍎', portion: '1 fruit', ok: true, nova: 1, n: { kcal: 80, protein: 0.5, carbs: 18, sugar: 0, fat: 0.3, satFat: 0, fiber: 3, sodium: 2, fruitVeg: 150 } },
  { id: 'noix', label: 'Amandes / noix', emoji: '🥜', portion: '1 poignée (25 g)', ok: true, nova: 1, n: { kcal: 150, protein: 5, carbs: 3, sugar: 1, fat: 13, satFat: 1, fiber: 3, sodium: 1, fruitVeg: 0 } },
  { id: 'yaourt', label: 'Yaourt nature', emoji: '🥛', portion: '1 pot (125 g)', ok: true, nova: 1, n: { kcal: 70, protein: 5, carbs: 6, sugar: 0, fat: 3, satFat: 2, fiber: 0, sodium: 60, fruitVeg: 0 } },
  { id: 'chocnoir', label: 'Chocolat noir', emoji: '🍫', portion: '2 carrés (10 g)', ok: true, nova: 3, n: { kcal: 55, protein: 0.8, carbs: 3.5, sugar: 3, fat: 4, satFat: 2.4, fiber: 1, sodium: 1, fruitVeg: 0 } },
  { id: 'biscuits', label: 'Biscuits', emoji: '🍪', portion: '3 biscuits (25 g)', nova: 4, n: { kcal: 115, protein: 2, carbs: 18, sugar: 7, fat: 4, satFat: 2, fiber: 0.5, sodium: 90, fruitVeg: 0 } },
  { id: 'barre', label: 'Barre chocolatée', emoji: '🍬', portion: '1 barre (40 g)', nova: 4, n: { kcal: 190, protein: 2, carbs: 26, sugar: 22, fat: 9, satFat: 5, fiber: 0.5, sodium: 60, fruitVeg: 0 } },
  { id: 'bonbons', label: 'Bonbons', emoji: '🍭', portion: '1 poignée (25 g)', nova: 4, n: { kcal: 85, protein: 1, carbs: 20, sugar: 18, fat: 0, satFat: 0, fiber: 0, sodium: 10, fruitVeg: 0 } },
  { id: 'chips', label: 'Chips', emoji: '🥔', portion: '1 petit paquet (30 g)', nova: 4, n: { kcal: 160, protein: 2, carbs: 15, sugar: 0.3, fat: 10, satFat: 1, fiber: 1.2, sodium: 200, fruitVeg: 0 } },
  { id: 'apero', label: 'Cacahuètes apéro', emoji: '🥜', portion: '1 poignée (30 g)', nova: 3, n: { kcal: 180, protein: 8, carbs: 4, sugar: 1, fat: 15, satFat: 2, fiber: 2, sodium: 120, fruitVeg: 0 } },
  { id: 'viennoiserie', label: 'Viennoiserie', emoji: '🥐', portion: '1 croissant (45 g)', nova: 4, n: { kcal: 190, protein: 4, carbs: 20, sugar: 5, fat: 10, satFat: 6, fiber: 1, sodium: 170, fruitVeg: 0 } },
  { id: 'gateau', label: 'Gâteau', emoji: '🍰', portion: '1 part (60 g)', nova: 4, n: { kcal: 240, protein: 3, carbs: 30, sugar: 20, fat: 12, satFat: 6, fiber: 1, sodium: 120, fruitVeg: 0 } },
  { id: 'tartine', label: 'Tartine beurre', emoji: '🍞', portion: '1 tartine', nova: 3, n: { kcal: 175, protein: 4, carbs: 20, sugar: 1, fat: 8, satFat: 5, fiber: 1.5, sodium: 230, fruitVeg: 0 } },
  { id: 'fromage', label: 'Fromage', emoji: '🧀', portion: '1 portion (30 g)', nova: 3, n: { kcal: 110, protein: 7, carbs: 0, sugar: 0, fat: 9, satFat: 6, fiber: 0, sodium: 200, fruitVeg: 0 } },
  { id: 'barrecereale', label: 'Barre de céréales', emoji: '🌾', portion: '1 barre (25 g)', nova: 4, n: { kcal: 100, protein: 1.5, carbs: 17, sugar: 8, fat: 3, satFat: 1, fiber: 1, sodium: 40, fruitVeg: 0 } },
  { id: 'soda', label: 'Soda', emoji: '🥤', portion: '1 canette (33 cl)', nova: 4, n: { kcal: 140, protein: 0, carbs: 35, sugar: 35, fat: 0, satFat: 0, fiber: 0, sodium: 10, fruitVeg: 0 } },
  { id: 'jus', label: 'Jus de fruits', emoji: '🧃', portion: '1 verre (20 cl)', nova: 1, n: { kcal: 90, protein: 1, carbs: 20, sugar: 20, fat: 0, satFat: 0, fiber: 0.3, sodium: 2, fruitVeg: 0 } },
  { id: 'cafesucre', label: 'Café / thé sucré', emoji: '☕', portion: '1 tasse, 1 sucre', nova: 3, n: { kcal: 20, protein: 0, carbs: 5, sugar: 5, fat: 0, satFat: 0, fiber: 0, sodium: 2, fruitVeg: 0 } },
  { id: 'alcool', label: 'Verre d’alcool', emoji: '🍷', portion: '1 verre standard', nova: 3, alcohol: 1, n: { kcal: 100, protein: 0, carbs: 3, sugar: 1, fat: 0, satFat: 0, fiber: 0, sodium: 5, fruitVeg: 0 } },
];

export const REASONS = [['faim', 'Faim'], ['envie', 'Envie'], ['ennui', 'Ennui'], ['stress', 'Stress'], ['ecran', 'Devant un écran'], ['social', 'Entre amis']];

export const snackById = (id) => SNACKS.find((s) => s.id === id);

// Bilan des grignotages sur 7 jours et conseils.
export function snackSummary(meals, now = new Date()) {
  const since = new Date(now); since.setDate(since.getDate() - 6);
  const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const from = key(since);
  const week = meals.filter((m) => m.snack && m.date >= from);
  const kcal = week.reduce((a, m) => a + (m.nutrients?.kcal || 0), 0);
  const allKcal = meals.filter((m) => m.date >= from).reduce((a, m) => a + (m.nutrients?.kcal || 0), 0);
  const late = week.filter((m) => (m.time || '') >= '21:00').length;
  const reasons = {};
  week.forEach((m) => m.reason && (reasons[m.reason] = (reasons[m.reason] || 0) + 1));
  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  const okShare = week.length ? week.filter((m) => snackById(m.snackId)?.ok).length / week.length : 0;
  const advice = [];
  if (week.length && okShare < 0.5) advice.push({ text: 'Remplace un grignotage sur deux par un fruit, un yaourt nature ou une poignée d’oléagineux : ils rassasient mieux.', src: ['bellisle2014', 'aune2016nuts'] });
  if (topReason && ['ecran'].includes(topReason[0])) advice.push({ text: 'Tu grignotes souvent devant un écran : sers-toi une portion dans un bol plutôt que le paquet, et mange sans écran.', src: ['robinson2013'] });
  if (topReason && ['ennui', 'stress'].includes(topReason[0])) advice.push({ text: `Grignotage souvent lié ${topReason[0] === 'ennui' ? 'à l’ennui' : 'au stress'} : essaie d’abord un verre d’eau, 5 minutes de marche ou de respiration lente.`, src: ['balban2023'] });
  if (late >= 3) advice.push({ text: `${late} grignotages après 21 h cette semaine : manger tard augmente la faim du lendemain.`, src: ['vujovic2022'] });
  return { count: week.length, kcal: Math.round(kcal), share: allKcal ? kcal / allKcal : 0, late, topReason, okShare, advice };
}
