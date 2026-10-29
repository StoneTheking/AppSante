// Banque de repas équilibrés (valeurs moyennes par portion, d'après la table CIQUAL de l'Anses).
// tags : moments de la journée et contextes où le repas est particulièrement adapté.
export const MEALS = [
  { name: "Flocons d'avoine, yaourt grec, fruits rouges, noix", slots: ['petit-dej'], kcal: 450, protein: 24, fiber: 9, fruitVeg: 100, tags: ['fibres', 'humeur', 'energie'], diet: ['vegetarien'] },
  { name: 'Omelette 2 œufs, épinards, pain complet, orange', slots: ['petit-dej'], kcal: 430, protein: 22, fiber: 8, fruitVeg: 200, tags: ['proteines', 'satiete'], diet: ['vegetarien'] },
  { name: 'Skyr, banane, graines de chia, beurre de cacahuète', slots: ['petit-dej', 'collation'], kcal: 380, protein: 25, fiber: 7, fruitVeg: 120, tags: ['sport', 'proteines'], diet: ['vegetarien'] },
  { name: 'Tartines complètes, avocat, œuf poché, tomates', slots: ['petit-dej'], kcal: 460, protein: 18, fiber: 10, fruitVeg: 150, tags: ['satiete'], diet: ['vegetarien'] },
  { name: 'Porridge avoine, lait de soja, pomme, cannelle, amandes', slots: ['petit-dej'], kcal: 420, protein: 16, fiber: 9, fruitVeg: 150, tags: ['fibres'], diet: ['vegan', 'vegetarien'] },
  { name: 'Saumon, quinoa, brocolis, citron et huile d’olive', slots: ['dejeuner', 'diner'], kcal: 620, protein: 38, fiber: 8, fruitVeg: 200, tags: ['omega3', 'humeur', 'sport'], diet: ['pescetarien'] },
  { name: 'Salade de lentilles, feta, crudités, noix', slots: ['dejeuner'], kcal: 560, protein: 28, fiber: 15, fruitVeg: 200, tags: ['fibres', 'humeur'], diet: ['vegetarien'] },
  { name: 'Poulet rôti, patate douce, haricots verts', slots: ['dejeuner', 'diner'], kcal: 580, protein: 42, fiber: 9, fruitVeg: 200, tags: ['proteines', 'sport'], diet: [] },
  { name: 'Chili sin carne (haricots rouges, riz complet)', slots: ['dejeuner', 'diner'], kcal: 590, protein: 24, fiber: 18, fruitVeg: 250, tags: ['fibres', 'satiete'], diet: ['vegan', 'vegetarien'] },
  { name: 'Bowl tofu, edamame, riz complet, légumes sautés', slots: ['dejeuner', 'diner'], kcal: 600, protein: 32, fiber: 11, fruitVeg: 220, tags: ['proteines'], diet: ['vegan', 'vegetarien'] },
  { name: 'Sardines, pommes de terre vapeur, salade verte', slots: ['dejeuner', 'diner'], kcal: 540, protein: 30, fiber: 7, fruitVeg: 150, tags: ['omega3', 'humeur'], diet: ['pescetarien'] },
  { name: 'Pâtes complètes, sauce tomate maison, pois chiches, parmesan', slots: ['dejeuner'], kcal: 640, protein: 27, fiber: 14, fruitVeg: 200, tags: ['sport', 'energie'], diet: ['vegetarien'] },
  { name: 'Soupe de légumes, pain de seigle, fromage blanc', slots: ['diner'], kcal: 420, protein: 22, fiber: 10, fruitVeg: 300, tags: ['leger', 'sommeil'], diet: ['vegetarien'] },
  { name: 'Cabillaud, purée de carottes, épinards', slots: ['diner'], kcal: 430, protein: 34, fiber: 8, fruitVeg: 300, tags: ['leger', 'sommeil'], diet: ['pescetarien'] },
  { name: 'Dahl de lentilles corail, riz basmati, épinards', slots: ['diner', 'dejeuner'], kcal: 520, protein: 22, fiber: 13, fruitVeg: 200, tags: ['fibres', 'sommeil'], diet: ['vegan', 'vegetarien'] },
  { name: 'Omelette aux légumes, salade, pain complet', slots: ['diner'], kcal: 450, protein: 26, fiber: 7, fruitVeg: 250, tags: ['leger'], diet: ['vegetarien'] },
  { name: 'Dinde, boulgour, ratatouille', slots: ['dejeuner', 'diner'], kcal: 550, protein: 38, fiber: 9, fruitVeg: 300, tags: ['proteines', 'leger'], diet: [] },
  { name: 'Pomme + 20 g d’amandes', slots: ['collation'], kcal: 200, protein: 5, fiber: 5, fruitVeg: 150, tags: ['satiete', 'energie'], diet: ['vegan', 'vegetarien'] },
  { name: 'Fromage blanc, kiwi', slots: ['collation'], kcal: 160, protein: 12, fiber: 3, fruitVeg: 100, tags: ['sommeil', 'proteines'], diet: ['vegetarien'] },
  { name: 'Banane + verre de lait (après le sport)', slots: ['collation'], kcal: 230, protein: 9, fiber: 3, fruitVeg: 120, tags: ['sport'], diet: ['vegetarien'] },
  { name: 'Houmous, bâtonnets de carotte et concombre', slots: ['collation'], kcal: 180, protein: 6, fiber: 6, fruitVeg: 150, tags: ['fibres'], diet: ['vegan', 'vegetarien'] },
  { name: 'Carré de chocolat noir 70 % + noix', slots: ['collation'], kcal: 170, protein: 4, fiber: 3, fruitVeg: 0, tags: ['humeur'], diet: ['vegan', 'vegetarien'] },
];

const DIET_OK = {
  omnivore: () => true,
  pescetarien: (m) => m.diet.length > 0,
  vegetarien: (m) => m.diet.includes('vegetarien') || m.diet.includes('vegan'),
  vegan: (m) => m.diet.includes('vegan'),
};

// Choisit les meilleurs repas pour un créneau selon les besoins restants et le contexte du jour.
export function suggestMeals(slot, { remaining, ctx, diet = 'omnivore', allergies = '' }, n = 3) {
  const banned = allergies.toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const ok = DIET_OK[diet] || DIET_OK.omnivore;
  const slotShare = { 'petit-dej': 0.25, dejeuner: 0.35, collation: 0.1, diner: 0.3 }[slot] || 0.3;
  return MEALS.filter((m) => m.slots.includes(slot) && ok(m) && !banned.some((b) => m.name.toLowerCase().includes(b)))
    .map((m) => {
      let score = 0;
      const why = [];
      const idealKcal = Math.max(150, remaining.kcal * slotShare * 1.3);
      score -= Math.abs(m.kcal - idealKcal) / 50;
      if (remaining.protein > 20 && m.protein >= 25) { score += 3; why.push('riche en protéines'); }
      if (remaining.fiber > 10 && m.fiber >= 9) { score += 3; why.push('riche en fibres'); }
      if (remaining.fruitVeg > 150 && m.fruitVeg >= 200) { score += 2; why.push('beaucoup de légumes'); }
      if (ctx.lowMood && (m.tags.includes('humeur') || m.tags.includes('omega3'))) { score += 3; why.push('soutient l’humeur (oméga-3, fibres, type méditerranéen)'); }
      if (ctx.workout && m.tags.includes('sport')) { score += 3; why.push('récupération après effort'); }
      if (slot === 'diner' && (ctx.poorSleep || ctx.lateDinner) && m.tags.includes('leger')) { score += 3; why.push('léger, favorise le sommeil'); }
      if (slot === 'diner' && m.tags.includes('sommeil')) score += 1;
      if (ctx.goal === 'perdre' && m.tags.includes('satiete')) { score += 2; why.push('rassasiant'); }
      if (ctx.lowEnergy && m.tags.includes('energie')) { score += 2; why.push('énergie durable'); }
      return { ...m, score, why };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
