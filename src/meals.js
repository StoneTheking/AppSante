import { tasteScore } from './family.js';

// Banque de repas équilibrés (valeurs moyennes par portion, d'après la table CIQUAL de l'Anses).
// slots : moments adaptés ; tags : contextes favorables ; ing : ingrédients pour 1 portion [nom, quantité, unité, rayon].
const FL = 'Fruits & légumes', VI = 'Viande & poisson', CR = 'Crèmerie & œufs', EP = 'Épicerie', BO = 'Boulangerie', SU = 'Surgelés';

export const MEALS = [
  { name: "Flocons d'avoine, yaourt grec, fruits rouges, noix", slots: ['petit-dej'], kcal: 450, protein: 24, fiber: 9, fruitVeg: 100, prep: 5, tags: ['fibres', 'humeur', 'energie'], diet: ['vegetarien'],
    ing: [["Flocons d'avoine", 50, 'g', EP], ['Yaourt grec', 150, 'g', CR], ['Fruits rouges', 100, 'g', SU], ['Noix', 15, 'g', EP]] },
  { name: 'Omelette 2 œufs, épinards, pain complet, orange', slots: ['petit-dej'], kcal: 430, protein: 22, fiber: 8, fruitVeg: 200, prep: 10, tags: ['proteines', 'satiete'], diet: ['vegetarien'],
    ing: [['Œufs', 2, 'pièce', CR], ['Épinards frais', 60, 'g', FL], ['Pain complet', 60, 'g', BO], ['Orange', 1, 'pièce', FL]] },
  { name: 'Skyr, banane, graines de chia, beurre de cacahuète', slots: ['petit-dej', 'collation'], kcal: 380, protein: 25, fiber: 7, fruitVeg: 120, prep: 3, tags: ['sport', 'proteines'], diet: ['vegetarien'],
    ing: [['Skyr', 150, 'g', CR], ['Banane', 1, 'pièce', FL], ['Graines de chia', 10, 'g', EP], ['Beurre de cacahuète', 15, 'g', EP]] },
  { name: 'Tartines complètes, avocat, œuf poché, tomates', slots: ['petit-dej'], kcal: 460, protein: 18, fiber: 10, fruitVeg: 150, prep: 10, tags: ['satiete'], diet: ['vegetarien'],
    ing: [['Pain complet', 70, 'g', BO], ['Avocat', 0.5, 'pièce', FL], ['Œufs', 1, 'pièce', CR], ['Tomates', 100, 'g', FL]] },
  { name: 'Porridge avoine, lait de soja, pomme, cannelle, amandes', slots: ['petit-dej'], kcal: 420, protein: 16, fiber: 9, fruitVeg: 150, prep: 8, tags: ['fibres'], diet: ['vegan', 'vegetarien'],
    ing: [["Flocons d'avoine", 60, 'g', EP], ['Lait de soja', 250, 'mL', CR], ['Pomme', 1, 'pièce', FL], ['Amandes', 15, 'g', EP]] },
  { name: 'Saumon, quinoa, brocolis, citron et huile d’olive', slots: ['dejeuner', 'diner'], kcal: 620, protein: 38, fiber: 8, fruitVeg: 200, prep: 25, tags: ['omega3', 'humeur', 'sport'], diet: ['pescetarien'],
    ing: [['Pavé de saumon', 130, 'g', VI], ['Quinoa', 70, 'g', EP], ['Brocolis', 200, 'g', FL], ['Citron', 0.5, 'pièce', FL], ["Huile d'olive", 10, 'mL', EP]] },
  { name: 'Salade de lentilles, feta, crudités, noix', slots: ['dejeuner'], kcal: 560, protein: 28, fiber: 15, fruitVeg: 200, prep: 15, tags: ['fibres', 'humeur'], diet: ['vegetarien'],
    ing: [['Lentilles vertes (sèches)', 70, 'g', EP], ['Feta', 40, 'g', CR], ['Tomates', 100, 'g', FL], ['Concombre', 100, 'g', FL], ['Noix', 10, 'g', EP]] },
  { name: 'Poulet rôti, patate douce, haricots verts', slots: ['dejeuner', 'diner'], kcal: 580, protein: 42, fiber: 9, fruitVeg: 200, prep: 35, tags: ['proteines', 'sport'], diet: [],
    ing: [['Blanc de poulet', 150, 'g', VI], ['Patate douce', 200, 'g', FL], ['Haricots verts', 200, 'g', SU]] },
  { name: 'Chili sin carne (haricots rouges, riz complet)', slots: ['dejeuner', 'diner'], kcal: 590, protein: 24, fiber: 18, fruitVeg: 250, prep: 30, tags: ['fibres', 'satiete'], diet: ['vegan', 'vegetarien'],
    ing: [['Haricots rouges (conserve)', 200, 'g', EP], ['Riz complet', 60, 'g', EP], ['Tomates concassées', 200, 'g', EP], ['Poivron', 1, 'pièce', FL], ['Oignon', 0.5, 'pièce', FL]] },
  { name: 'Bowl tofu, edamame, riz complet, légumes sautés', slots: ['dejeuner', 'diner'], kcal: 600, protein: 32, fiber: 11, fruitVeg: 220, prep: 20, tags: ['proteines'], diet: ['vegan', 'vegetarien'],
    ing: [['Tofu ferme', 150, 'g', CR], ['Edamame', 80, 'g', SU], ['Riz complet', 60, 'g', EP], ['Légumes à poêler', 150, 'g', SU], ['Sauce soja', 10, 'mL', EP]] },
  { name: 'Sardines, pommes de terre vapeur, salade verte', slots: ['dejeuner', 'diner'], kcal: 540, protein: 30, fiber: 7, fruitVeg: 150, prep: 20, tags: ['omega3', 'humeur'], diet: ['pescetarien'],
    ing: [["Sardines à l'huile (boîte)", 1, 'boîte', EP], ['Pommes de terre', 250, 'g', FL], ['Salade verte', 1, 'portion', FL]] },
  { name: 'Pâtes complètes, sauce tomate maison, pois chiches, parmesan', slots: ['dejeuner'], kcal: 640, protein: 27, fiber: 14, fruitVeg: 200, prep: 20, tags: ['sport', 'energie'], diet: ['vegetarien'],
    ing: [['Pâtes complètes', 90, 'g', EP], ['Tomates concassées', 200, 'g', EP], ['Pois chiches (conserve)', 120, 'g', EP], ['Parmesan', 15, 'g', CR]] },
  { name: 'Soupe de légumes, pain de seigle, fromage blanc', slots: ['diner'], kcal: 420, protein: 22, fiber: 10, fruitVeg: 300, prep: 30, tags: ['leger', 'sommeil'], diet: ['vegetarien'],
    ing: [['Légumes pour soupe', 300, 'g', FL], ['Pain de seigle', 60, 'g', BO], ['Fromage blanc', 150, 'g', CR]] },
  { name: 'Cabillaud, purée de carottes, épinards', slots: ['diner'], kcal: 430, protein: 34, fiber: 8, fruitVeg: 300, prep: 25, tags: ['leger', 'sommeil'], diet: ['pescetarien'],
    ing: [['Dos de cabillaud', 150, 'g', VI], ['Carottes', 200, 'g', FL], ['Épinards frais', 100, 'g', FL]] },
  { name: 'Dahl de lentilles corail, riz basmati, épinards', slots: ['diner', 'dejeuner'], kcal: 520, protein: 22, fiber: 13, fruitVeg: 200, prep: 25, tags: ['fibres', 'sommeil'], diet: ['vegan', 'vegetarien'],
    ing: [['Lentilles corail', 70, 'g', EP], ['Riz basmati', 50, 'g', EP], ['Lait de coco', 50, 'mL', EP], ['Épinards frais', 100, 'g', FL], ['Oignon', 0.5, 'pièce', FL]] },
  { name: 'Omelette aux légumes, salade, pain complet', slots: ['diner'], kcal: 450, protein: 26, fiber: 7, fruitVeg: 250, prep: 15, tags: ['leger'], diet: ['vegetarien'],
    ing: [['Œufs', 3, 'pièce', CR], ['Courgette', 150, 'g', FL], ['Salade verte', 1, 'portion', FL], ['Pain complet', 50, 'g', BO]] },
  { name: 'Dinde, boulgour, ratatouille', slots: ['dejeuner', 'diner'], kcal: 550, protein: 38, fiber: 9, fruitVeg: 300, prep: 25, tags: ['proteines', 'leger'], diet: [],
    ing: [['Escalope de dinde', 130, 'g', VI], ['Boulgour', 60, 'g', EP], ['Ratatouille', 300, 'g', SU]] },
  { name: 'Pomme + 20 g d’amandes', slots: ['collation'], kcal: 200, protein: 5, fiber: 5, fruitVeg: 150, prep: 0, tags: ['satiete', 'energie'], diet: ['vegan', 'vegetarien'],
    ing: [['Pomme', 1, 'pièce', FL], ['Amandes', 20, 'g', EP]] },
  { name: 'Fromage blanc, kiwi', slots: ['collation'], kcal: 160, protein: 12, fiber: 3, fruitVeg: 100, prep: 2, tags: ['sommeil', 'proteines'], diet: ['vegetarien'],
    ing: [['Fromage blanc', 150, 'g', CR], ['Kiwi', 1, 'pièce', FL]] },
  { name: 'Banane + verre de lait (après le sport)', slots: ['collation'], kcal: 230, protein: 9, fiber: 3, fruitVeg: 120, prep: 0, tags: ['sport'], diet: ['vegetarien'],
    ing: [['Banane', 1, 'pièce', FL], ['Lait', 250, 'mL', CR]] },
  { name: 'Houmous, bâtonnets de carotte et concombre', slots: ['collation'], kcal: 180, protein: 6, fiber: 6, fruitVeg: 150, prep: 5, tags: ['fibres'], diet: ['vegan', 'vegetarien'],
    ing: [['Houmous', 50, 'g', CR], ['Carottes', 80, 'g', FL], ['Concombre', 80, 'g', FL]] },
  { name: 'Carré de chocolat noir 70 % + noix', slots: ['collation'], kcal: 170, protein: 4, fiber: 3, fruitVeg: 0, prep: 0, tags: ['humeur'], diet: ['vegan', 'vegetarien'],
    ing: [['Chocolat noir 70 %', 15, 'g', EP], ['Noix', 15, 'g', EP]] },
];

export const DIET_OK = {
  omnivore: () => true,
  pescetarien: (m) => m.diet.length > 0,
  vegetarien: (m) => m.diet.includes('vegetarien') || m.diet.includes('vegan'),
  vegan: (m) => m.diet.includes('vegan'),
};

export function allowedMeals(diet = 'omnivore', allergies = '') {
  const banned = allergies.toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const ok = DIET_OK[diet] || DIET_OK.omnivore;
  return MEALS.filter((m) => ok(m) && !banned.some((b) => (m.name + ' ' + m.ing.map((i) => i[0]).join(' ')).toLowerCase().includes(b)));
}

// Choisit les meilleurs repas pour un créneau selon les besoins restants et le contexte du jour.
export function suggestMeals(slot, { remaining, ctx, diet = 'omnivore', allergies = '', taste }, n = 3) {
  const slotShare = { 'petit-dej': 0.25, dejeuner: 0.35, collation: 0.1, diner: 0.3 }[slot] || 0.3;
  return allowedMeals(diet, allergies).filter((m) => m.slots.includes(slot))
    .map((m) => {
      let score = 0;
      const why = [];
      const idealKcal = Math.max(150, remaining.kcal * slotShare * 1.3);
      score -= Math.abs(m.kcal - idealKcal) / 50;
      if (remaining.protein > 20 && m.protein >= 25) { score += 3; why.push('riche en protéines'); }
      if (remaining.fiber > 10 && m.fiber >= 9) { score += 3; why.push('riche en fibres'); }
      if (remaining.fruitVeg > 150 && m.fruitVeg >= 200) { score += 2; why.push('beaucoup de légumes'); }
      if (ctx.lowMood && (m.tags.includes('humeur') || m.tags.includes('omega3'))) { score += 3; why.push('soutient l’humeur'); }
      if (ctx.workout && m.tags.includes('sport')) { score += 3; why.push('récupération après l’effort'); }
      if (slot === 'diner' && (ctx.poorSleep || ctx.lateDinner) && m.tags.includes('leger')) { score += 3; why.push('léger, favorise le sommeil'); }
      if (slot === 'diner' && m.tags.includes('sommeil')) score += 1;
      if (ctx.goal === 'perdre' && m.tags.includes('satiete')) { score += 2; why.push('rassasiant'); }
      if (ctx.lowEnergy && m.tags.includes('energie')) { score += 2; why.push('énergie durable'); }
      if (taste) {
        const t = tasteScore(m.name + ' ' + m.ing.map((i) => i[0]).join(' '), taste);
        score += t.s;
        if (t.s > 0) why.push('selon tes goûts');
      }
      return { ...m, score, why };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
