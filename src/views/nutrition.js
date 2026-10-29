// Nutrition : journal du jour, historique, menus de la semaine, courses et garde-manger.
import * as store from '../store.js';
import * as C from '../coach.js';
import * as AI from '../ai.js';
import * as P from '../planner.js';
import * as PT from '../pantry.js';
import { summary, personContext, taste } from '../context.js';
import * as S from '../science.js';
import * as D from '../digestion.js';
import { tokens, familyFactor } from '../family.js';
import * as SN from '../snacks.js';
import { icon, esc, fmt, segmented, donut, toast, sheet, srcLinks, $, $$ } from '../ui.js';
import { meter } from './home.js';
import { addMeal } from './actions.js';

let seg = 'jour';
let slot = null;
let eatTab = 'plats';
let shopTab = 'liste';
const VERDICT = { bon: 'Bon', moyen: 'Moyen', a_limiter: 'À limiter' };
const SLOT_LABEL = { ...P.SLOT_LABEL, grignotage: 'Grignotage' };
const verdictOf = (q) => (q >= 70 ? 'bon' : q >= 45 ? 'moyen' : 'a_limiter');
const badge = (v) => (v ? `<span class="badge ${v}">${VERDICT[v]}</span>` : '');

export function render(view, ctx) {
  view.innerHTML = `${segmented('nut', [['jour', 'Jour'], ['historique', 'Historique'], ['menus', 'Menus'], ['courses', 'Courses']], seg)}<div id="nut-body" class="view-enter"></div>`;
  $$('[data-seg="nut"]', view).forEach((b) => (b.onclick = () => { seg = b.dataset.v; render(view, ctx); }));
  const body = $('#nut-body', view);
  ({ jour: renderDay, historique: renderHistory, menus: renderMenus, courses: renderShop })[seg](body, ctx, view);
  setTimeout(() => body.classList.remove('view-enter'), 700);
}

// Ligne de repas épurée : heure, calories, qualité. Le détail s'ouvre au toucher.
function mealLine(m, { date = false } = {}) {
  return `<div class="meal-line" data-meal="${m.id}">
    ${m.thumb ? `<img class="thumb" src="${esc(m.thumb)}" alt="">` : `<span class="thumb">${icon(m.snack ? 'apple' : 'utensils')}</span>`}
    <div><div class="ttl">${esc(m.title)}</div><div class="tiny muted">${date ? `${new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ` : ''}${esc(m.time)} · <b style="color:var(--text)">${fmt(m.nutrients?.kcal)} kcal</b>${m.snack ? ' · grignotage' : ''}</div></div>
    ${badge(m.verdict)}
  </div>`;
}
function bindMeals(el, rerender) {
  $$('[data-meal]', el).forEach((r) => (r.onclick = () => openMeal(r.dataset.meal, rerender)));
}

// Détail d'un repas : nutriments, aliments, avis, note, type de repas, plat favori, suppression.
export function openMeal(id, done) {
  const m = store.get().meals.find((x) => x.id === id);
  if (!m) return;
  const n = m.nutrients || {};
  const body = sheet(`
    ${m.thumb ? `<img class="preview" src="${esc(m.thumb)}" alt="" style="max-height:180px">` : ''}
    <div class="between" style="margin-top:10px"><h2 style="font-size:1.15rem;margin:0">${esc(m.title)}</h2>${badge(m.verdict)}</div>
    <div class="tiny muted">${new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${esc(m.time)}${m.nutriscore ? ` · Nutri-Score ${m.nutriscore.toUpperCase()}` : ''}${m.nova ? ` · NOVA ${m.nova}` : ''}</div>
    <div class="grid3" style="margin:12px 0">
      <div class="stat"><div class="k">${icon('flame', 14)} Calories</div><div class="v">${fmt(n.kcal)}<small>kcal</small></div></div>
      <div class="stat"><div class="k">Protéines</div><div class="v">${fmt(n.protein)}<small>g</small></div></div>
      <div class="stat"><div class="k">Fibres</div><div class="v">${fmt(n.fiber)}<small>g</small></div></div>
      <div class="stat"><div class="k">Glucides</div><div class="v">${fmt(n.carbs)}<small>g</small></div></div>
      <div class="stat"><div class="k">Lipides</div><div class="v">${fmt(n.fat)}<small>g</small></div></div>
      <div class="stat"><div class="k">Légumes</div><div class="v">${fmt(n.fruitVeg)}<small>g</small></div></div>
    </div>
    <p class="tiny muted" style="margin:0">Sucres ${fmt(n.sugar)} g · graisses saturées ${fmt(n.satFat)} g · sodium ${fmt(n.sodium)} mg${m.alcohol ? ` · ${fmt(m.alcohol, 1)} verre(s) d’alcool` : ''}${m.quality != null ? ` · qualité ${m.quality}/100` : ''}</p>
    ${m.items?.length ? `<table style="margin-top:10px">${m.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${fmt(i.grams)} g</td><td class="num">${fmt(i.kcal)} kcal</td></tr>`).join('')}</table>` : ''}
    ${m.comment ? `<p class="small" style="margin:12px 0 6px">${esc(m.comment)}</p>` : ''}
    ${m.advice ? `<div class="note">${icon('bulb', 18)}<span>${esc(m.advice)}</span></div>` : ''}
    <label class="lbl">Tu as aimé ?</label>${stars(m)}
    <label class="lbl">C’était</label>
    <div class="chips" style="flex-wrap:wrap">${Object.entries(SLOT_LABEL).map(([k, l]) => `<button class="chip ${(m.snack ? 'grignotage' : m.slot) === k ? 'on' : ''}" data-mslot="${k}">${l}</button>`).join('')}</div>
    <div class="grid2" style="margin-top:14px">
      <button class="btn soft" id="fav">${icon('star', 18)} ${isDish(m.title) ? 'Dans mes plats' : 'Ajouter à mes plats'}</button>
      <button class="btn soft" id="rcp">${icon('book', 18)} Recette</button>
    </div>
    <button class="btn danger block" id="del" style="margin-top:8px">${icon('trash', 18)} Supprimer ce repas</button>`, { title: 'Repas', full: true, onClose: done });
  bindStars(body, () => {});
  $$('[data-mslot]', body).forEach((b) => (b.onclick = () => {
    const k = b.dataset.mslot;
    store.update((s) => { const x = s.meals.find((y) => y.id === id); if (x) { x.snack = k === 'grignotage'; x.slot = k === 'grignotage' ? 'collation' : k; } });
    $$('[data-mslot]', body).forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#fav', body).onclick = () => { saveDish(m); $('#fav', body).innerHTML = `${icon('star', 18)} Dans mes plats`; toast('Ajouté à « Mes plats » ⭐', 1400); };
  $('#rcp', body).onclick = () => openRecipe({ name: m.title.replace(/\s*\(.*\)$/, '') });
  $('#del', body).onclick = () => { store.update((x) => { x.meals = x.meals.filter((y) => y.id !== id); if (m.alcohol && x.days[m.date]) x.days[m.date].alcohol = Math.max(0, (x.days[m.date].alcohol || 0) - m.alcohol); }); body.close(); };
}

// ---------- Mes plats (favoris et plats préparés à l'avance) ----------
const isDish = (title) => (store.get().dishes || []).some((d) => d.name === title.replace(/\s*\(.*\)$/, ''));
function saveDish(m, portions = null) {
  store.update((s) => {
    s.dishes ||= [];
    const name = m.title.replace(/\s*\(.*\)$/, '');
    if (s.dishes.some((d) => d.name === name)) return;
    s.dishes.push({ id: crypto.randomUUID(), name, nutrients: m.nutrients, quality: m.quality ?? 70, verdict: m.verdict || verdictOf(m.quality ?? 70), nova: m.nova || 1, thumb: m.thumb && m.thumb.length < 30000 ? m.thumb : '', portions });
  });
}

function openNewDish(done) {
  const body = sheet(`
    <p class="small muted" style="margin-top:0">Un plat que tu prépares souvent ou à l’avance (batch cooking) : tu l’ajouteras ensuite en un geste.</p>
    <label class="lbl">Nom du plat</label><input id="d-name" placeholder="ex. Chili sin carne">
    <div class="grid2"><div><label class="lbl">Calories / portion</label><input id="d-kcal" type="number" inputmode="numeric"></div><div><label class="lbl">Protéines / portion (g)</label><input id="d-prot" type="number" inputmode="numeric"></div></div>
    <div class="grid2"><div><label class="lbl">Portions préparées</label><input id="d-por" type="number" inputmode="numeric" placeholder="facultatif"></div><div><label class="lbl">Type</label><select id="d-nova"><option value="1">Fait maison</option><option value="3">Transformé</option><option value="4">Ultra-transformé</option></select></div></div>
    <button class="btn block" id="d-ok" style="margin-top:14px">${icon('check', 18)} Enregistrer</button>`, { title: 'Nouveau plat', onClose: done });
  $('#d-ok', body).onclick = () => {
    const name = $('#d-name', body).value.trim();
    if (!name) return toast('Donne un nom au plat');
    const nova = Number($('#d-nova', body).value);
    const q = nova === 1 ? 75 : nova === 3 ? 55 : 35;
    saveDish({ title: name, nutrients: { kcal: Number($('#d-kcal', body).value) || 0, protein: Number($('#d-prot', body).value) || 0, fiber: 0, sugar: 0, satFat: 0, sodium: 0, fruitVeg: 0, carbs: 0, fat: 0 }, nova, quality: q }, Number($('#d-por', body).value) || null);
    body.close();
  };
}

function eatDish(d) {
  addMeal({ title: d.name, nutrients: d.nutrients, nova: d.nova, quality: d.quality, verdict: d.verdict, thumb: d.thumb, slot: slot || C.currentSlot() });
  if (d.portions) store.update((s) => { const x = s.dishes.find((y) => y.id === d.id); if (x) x.portions = Math.max(0, x.portions - 1); });
}

// ---------- Jour ----------
function renderDay(el, ctx) {
  const st = store.get();
  const sm = summary();
  const t = sm.t, tot = sm.totToday;
  const meals = store.mealsOn().sort((a, b) => a.time.localeCompare(b.time));
  const s = slot || C.currentSlot();
  const sugg = C.mealSuggestions(sm, st.profile, s, taste());
  const planToday = st.plan?.days?.find((d) => d.date === store.today());
  const left = t.kcal - tot.kcal;
  const dishes = st.dishes || [];

  el.innerHTML = `
    <div class="card">
      <div class="row" style="flex-wrap:nowrap;gap:16px">
        ${donut(tot.kcal, t.kcal, { label: fmt(Math.abs(left)), sub: left >= 0 ? 'kcal restantes' : 'kcal en trop', color: 'var(--c-move)', size: 128 })}
        <div style="flex:1;min-width:0">
          ${meter('Protéines', tot.protein, t.protein, 'g', 'var(--c-sleep)')}
          ${meter('Fibres', tot.fiber, t.fiber, 'g', 'var(--c-food)')}
          ${meter('Fruits & légumes', tot.fruitVeg, t.fruitVeg, 'g', 'var(--primary)')}
        </div>
      </div>
      ${tot.sugar > t.sugarMax * 0.8 ? meter('Sucres libres', tot.sugar, t.sugarMax, 'g max', 'var(--c-mood)', true) : ''}
      ${tot.sodium > t.sodiumMax * 0.8 ? meter('Sodium', tot.sodium, t.sodiumMax, 'mg max', 'var(--c-screen)', true) : ''}
      ${srcLinks(['who2015sugar', 'who2012sodium', 'reynolds2019', 'aune2017'])}
    </div>

    <div class="grid3">
      <button class="btn soft" data-a="photo">${icon('camera', 18)} Photo</button>
      <button class="btn soft" data-a="scan">${icon('barcode', 18)} Scanner</button>
      <button class="btn soft" data-a="snack">${icon('apple', 18)} Grignotage</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('utensils', 18)} Journal du jour</h2><button class="link" data-a="manual">${icon('pencil', 14)} Manuel</button></div>
      ${meals.length ? meals.map((m) => mealLine(m)).join('') : `<div class="empty">${icon('camera', 28)}<p>Aucun repas aujourd'hui.<br>Photographie ton assiette ou scanne un produit.</p></div>`}
    </div>

    ${snackCard(st)}

    ${planToday ? `<div class="card">
      <div class="card-head"><h2>${icon('calendar', 18)} Au menu aujourd'hui</h2></div>
      ${planToday.meals.map((m, i) => `<div class="suggest" data-plan-recipe="${i}"><div><div class="tiny muted" style="font-weight:700;text-transform:uppercase">${P.SLOT_LABEL[m.slot]}</div><div class="ttl">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal</div></div>
        <button class="btn sm soft" data-eat-plan="${i}" aria-label="J'ai mangé ça">${icon('check', 16)}</button></div>`).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h2>${icon('chef', 18)} Que manger ?</h2>${eatTab === 'plats' ? `<button class="link" id="new-dish">${icon('plus', 14)} Plat</button>` : ''}</div>
      <div class="seg" style="margin-top:-4px">${[['plats', `Mes plats${dishes.length ? ` (${dishes.length})` : ''}`], ['idees', 'Idées']].map(([k, l]) => `<button data-eat-tab="${k}" class="${eatTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="chips" style="margin-top:6px">${Object.entries(P.SLOT_LABEL).map(([k, l]) => `<button class="chip ${k === s ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
      ${eatTab === 'plats'
        ? (dishes.length ? dishes.map((d) => `<div class="suggest" data-dish-recipe="${d.id}"><div><div class="ttl">${esc(d.name)}</div><div class="tiny muted">${fmt(d.nutrients?.kcal)} kcal${d.portions != null ? ` · ${d.portions} portion(s) prête(s)` : ''}</div></div>
            <div class="row" style="flex-wrap:nowrap;gap:6px">${badge(d.verdict)}<button class="btn sm soft" data-eat-dish="${d.id}" aria-label="J'ai mangé ça">${icon('plus', 16)}</button></div></div>`).join('')
          : '<p class="small muted">Enregistre tes plats habituels ou préparés à l’avance : touche un repas du journal puis « Ajouter à mes plats », ou « + Plat ».</p>')
        : sugg.map((m) => `<div class="suggest" data-idea="${esc(m.name)}"><div><div class="ttl">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal</div></div>
            <div class="row" style="flex-wrap:nowrap;gap:6px"><span class="badge bon">Bon</span><button class="btn sm soft" data-eat="${esc(m.name)}" aria-label="J'ai mangé ça">${icon('plus', 16)}</button></div></div>`).join('')}
    </div>`;

  const re = () => renderDay(el, ctx);
  $$('[data-a]', el).forEach((b) => (b.onclick = () => ctx.action(b.dataset.a)));
  $('#add-snack', el)?.addEventListener('click', () => ctx.action('snack'));
  $$('[data-slot]', el).forEach((b) => (b.onclick = () => { slot = b.dataset.slot; re(); }));
  $$('[data-eat-tab]', el).forEach((b) => (b.onclick = () => { eatTab = b.dataset.eatTab; re(); }));
  $('#new-dish', el)?.addEventListener('click', () => openNewDish(re));
  bindMeals(el, re);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
  $$('[data-eat]', el).forEach((b) => (b.onclick = stop(() => {
    const m = sugg.find((x) => x.name === b.dataset.eat);
    addMeal({ title: m.name, nutrients: { kcal: m.kcal, protein: m.protein, fiber: m.fiber, fruitVeg: m.fruitVeg, sugar: 5, satFat: 4, sodium: 500, carbs: 0, fat: 0 }, nova: 1, quality: 85, verdict: 'bon', slot: s });
    re();
  })));
  $$('[data-idea]', el).forEach((r) => (r.onclick = () => { const m = sugg.find((x) => x.name === r.dataset.idea); openRecipe({ name: m.name, kcal: m.kcal, protein: m.protein, prep: m.prep, why: m.why }); }));
  $$('[data-eat-dish]', el).forEach((b) => (b.onclick = stop(() => { eatDish(dishes.find((d) => d.id === b.dataset.eatDish)); re(); })));
  $$('[data-dish-recipe]', el).forEach((r) => (r.onclick = () => openDish(dishes.find((d) => d.id === r.dataset.dishRecipe), re)));
  $$('[data-eat-plan]', el).forEach((b) => (b.onclick = stop(() => {
    const m = planToday.meals[Number(b.dataset.eatPlan)];
    addMeal({ title: m.name, nutrients: { kcal: m.kcal, protein: m.protein, fiber: m.fiber, fruitVeg: 150, sugar: 5, satFat: 4, sodium: 500, carbs: 0, fat: 0 }, nova: 1, quality: 85, verdict: 'bon', slot: m.slot });
    re();
  })));
  $$('[data-plan-recipe]', el).forEach((r) => (r.onclick = () => openRecipe(planToday.meals[Number(r.dataset.planRecipe)])));
}

function openDish(d, done) {
  const body = sheet(`
    <div class="between"><h2 style="font-size:1.15rem;margin:0">${esc(d.name)}</h2>${badge(d.verdict)}</div>
    <div class="grid3" style="margin:12px 0"><div class="stat"><div class="k">Calories</div><div class="v">${fmt(d.nutrients?.kcal)}</div></div><div class="stat"><div class="k">Protéines</div><div class="v">${fmt(d.nutrients?.protein)}<small>g</small></div></div><div class="stat"><div class="k">Qualité</div><div class="v">${d.quality}<small>/100</small></div></div></div>
    <label class="lbl">Portions prêtes (préparées à l’avance)</label>
    <div class="stepper"><button data-p="-1">−</button><input id="por" value="${d.portions ?? 0}" readonly><button data-p="1">+</button></div>
    <div class="grid2" style="margin-top:14px"><button class="btn soft" id="rcp">${icon('book', 18)} Recette</button><button class="btn danger" id="del">${icon('trash', 18)} Retirer</button></div>`, { title: 'Mon plat', onClose: done });
  $$('[data-p]', body).forEach((b) => (b.onclick = () => {
    store.update((s) => { const x = s.dishes.find((y) => y.id === d.id); if (x) x.portions = Math.max(0, (x.portions || 0) + Number(b.dataset.p)); });
    $('#por', body).value = store.get().dishes.find((y) => y.id === d.id)?.portions ?? 0;
  }));
  $('#rcp', body).onclick = () => openRecipe({ name: d.name });
  $('#del', body).onclick = () => { store.update((s) => { s.dishes = s.dishes.filter((y) => y.id !== d.id); }); body.close(); };
}

// ---------- Recettes ----------
// Les menus créés par l'IA contiennent déjà la recette ; sinon on la demande (et on la garde en mémoire).
export function openRecipe(m) {
  const st = store.get();
  const cached = st.recipes?.[m.name];
  const r = cached || (m.ingredients?.length && m.steps ? { ingredients: m.ingredients, steps: String(m.steps).split(/\n|(?<=\.)\s+(?=\d+[.)]|[A-ZÉÈ])/).filter((x) => x.trim()), prep: m.prep, kcal: m.kcal, protein: m.protein } : null);
  const people = st.plan?.people || Math.max(1, Math.round(familyFactor(st.profile, st.household)));
  const body = sheet(`<div id="rc"></div>`, { title: 'Recette', full: true });
  const el = $('#rc', body);
  const draw = (x) => {
    el.innerHTML = `
      <h2 style="margin:0 0 6px">${esc(m.name)}</h2>
      ${m.why?.length ? `<p class="small" style="color:var(--primary);font-weight:600;margin:0 0 8px">${esc(m.why.join(' · '))}</p>` : ''}
      <div class="grid3"><div class="stat"><div class="k">Calories</div><div class="v">${fmt(x?.kcal ?? m.kcal)}</div></div><div class="stat"><div class="k">Protéines</div><div class="v">${fmt(x?.protein ?? m.protein)}<small>g</small></div></div><div class="stat"><div class="k">Temps</div><div class="v">${fmt(x?.prep ?? m.prep)}<small>min</small></div></div></div>
      ${x ? `<h3 style="font-size:.95rem;margin:16px 0 6px">Ingrédients${x.servings ? ` (${x.servings} pers.)` : ''}</h3>
        <ul class="small">${x.ingredients.map((i) => `<li>${esc(i.name)} — ${P.fmtQty({ ...i, qty: Math.round(i.qty * 10) / 10 })}</li>`).join('')}</ul>
        <h3 style="font-size:.95rem;margin:16px 0 6px">Préparation</h3>
        <ol class="small" style="padding-left:20px;line-height:1.6">${x.steps.map((s) => `<li>${esc(s.replace(/^\d+[.)]\s*/, ''))}</li>`).join('')}</ol>
        ${x.tip ? `<div class="note">${icon('bulb', 18)}<span>${esc(x.tip)}</span></div>` : ''}
        <button class="btn soft block" id="to-shop" style="margin-top:10px">${icon('cart', 18)} Ajouter les ingrédients aux courses</button>`
      : `<button class="btn block" id="ask" style="margin-top:14px">${icon('sparkles', 18)} Obtenir la recette</button>${!st.settings.apiKey ? `<div class="note warn" style="margin-top:10px">${icon('key', 18)}<span>Ajoute ta clé API dans Profil pour obtenir les recettes.</span></div>` : ''}`}`;
    $('#ask', el)?.addEventListener('click', async () => {
      el.innerHTML = `<div class="empty"><span class="spinner"></span><p>Le coach écrit la recette…</p></div>`;
      try {
        const res = await AI.recipe(st.settings, m.name, { people, context: `régime ${st.profile.diet}, allergies : ${st.profile.allergies || 'aucune'}` });
        store.update((s) => { s.recipes = { ...(s.recipes || {}), [m.name]: res }; });
        draw(res);
      } catch (e) { el.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(AI.friendlyError(e))}</span></div>`; }
    });
    $('#to-shop', el)?.addEventListener('click', () => {
      store.update((s) => { for (const i of x.ingredients) if (!PT.inPantry(s.pantry, i.name) && !s.shopExtra.includes(i.name)) s.shopExtra.push(i.name); });
      toast('Ingrédients manquants ajoutés aux courses 🛒');
    });
  };
  draw(r);
}

// ---------- Menus ----------
function renderMenus(el, ctx, view) {
  const st = store.get();
  const plan = st.plan;
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${icon('calendar', 18)} Menus de la semaine</h2>${plan ? `<button class="link" id="clear-plan" style="color:var(--bad)">${icon('trash', 14)} Tout effacer</button>` : ''}</div>
      <p class="small muted" style="margin-top:-6px">${summary().t.kcal} kcal/j, adaptés à ton foyer, tes goûts${st.pantry.length ? ' et à ce que tu as déjà' : ''}. Touche un plat pour sa recette.</p>
      <button class="btn block" id="gen-ai">${icon('sparkles', 18)} ${plan ? 'Refaire mes menus' : 'Créer mes menus'}</button>
    </div>
    ${plan ? `
      ${plan.tips ? `<div class="note">${icon('bulb', 18)}<span>${esc(plan.tips)}</span></div>` : ''}
      ${plan.days.map((d, di) => `<div class="day-card"><header><span>${esc(d.label)} <span class="muted tiny">${d.date ? new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span></span><span class="row" style="gap:6px;flex-wrap:nowrap"><span class="muted small">${fmt(d.meals.reduce((a, m) => a + (m.kcal || 0), 0))} kcal</span>${d.meals.length ? `<button class="icon-btn" data-clear-day="${di}" aria-label="Effacer ce jour">${icon('trash', 14)}</button>` : ''}</span></header>
        ${d.meals.length ? d.meals.map((m, i) => `<div class="meal-row" data-recipe="${di}:${i}" style="cursor:pointer"><div><div class="slot">${P.SLOT_LABEL[m.slot] || m.slot}</div><div style="font-weight:600">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal</div></div>
          <button class="icon-btn" data-del-meal="${di}:${i}" aria-label="Retirer ce plat">${icon('x', 14)}</button></div>`).join('') : '<p class="tiny muted" style="margin:6px 0">Jour libre.</p>'}
      </div>`).join('')}
      <button class="btn soft block" data-seg-go="courses">${icon('cart', 18)} Voir la liste de courses</button>` : `<div class="empty">${icon('calendar', 32)}<p>Pas encore de menus.</p></div>`}`;

  const re = () => renderMenus(el, ctx, view);
  $('#gen-ai', el).onclick = () => openAiPlanner(re);
  $('#clear-plan', el)?.addEventListener('click', () => { if (confirm('Effacer tous les menus de la semaine ?')) { store.update((s) => { s.plan = null; s.shopChecked = {}; }); re(); } });
  $$('[data-clear-day]', el).forEach((b) => (b.onclick = () => { store.update((s) => { s.plan.days[Number(b.dataset.clearDay)].meals = []; }); re(); }));
  $$('[data-del-meal]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [di, mi] = b.dataset.delMeal.split(':').map(Number); store.update((s) => { s.plan.days[di].meals.splice(mi, 1); }); re(); }));
  el.querySelector('[data-seg-go]')?.addEventListener('click', () => { seg = 'courses'; shopTab = 'liste'; render(view, ctx); });
  $$('[data-recipe]', el).forEach((b) => (b.onclick = () => { const [di, mi] = b.dataset.recipe.split(':').map(Number); openRecipe(plan.days[di].meals[mi]); }));
}

function openAiPlanner(done, { pantryFirst = store.get().pantry.length > 0 } = {}) {
  const st = store.get();
  const body = sheet(`
    <div class="grid2">
      <div><label class="lbl">Personnes</label><select id="pp">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === st.household.length + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label class="lbl">Budget</label><select id="bud"><option value="serré">Serré</option><option value="moyen" selected>Moyen</option><option value="confortable">Confortable</option></select></div>
    </div>
    <label class="lbl">Temps de cuisine max par repas</label><select id="time"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1 h</option></select>
    ${st.pantry.length ? `<label class="between" style="margin-top:14px;flex-wrap:nowrap"><span class="small">Cuisiner d’abord ce que j’ai déjà (${st.pantry.length} produits)</span><span class="switch"><input type="checkbox" id="pf" ${pantryFirst ? 'checked' : ''}><span></span></span></label>` : ''}
    <label class="lbl">Envies, contraintes (facultatif)</label><textarea id="wish" placeholder="ex. batch cooking le dimanche, pas de poisson le lundi…"></textarea>
    ${!st.settings.apiKey ? `<div class="note warn" style="margin-top:12px">${icon('key', 18)}<span>Ajoute ta clé API dans Profil pour créer tes menus.</span></div>` : ''}
    <button class="btn block" id="go" style="margin-top:16px">${icon('sparkles', 18)} Créer mes menus</button>
    <div id="st" style="margin-top:12px"></div>`, { title: 'Mes menus' });
  $('#go', body).onclick = async () => {
    const people = Number($('#pp', body).value);
    const pf = $('#pf', body)?.checked;
    $('#go', body).disabled = true;
    $('#st', body).innerHTML = `<div class="empty"><span class="spinner"></span><p>Le coach compose ta semaine (environ 1 minute)…</p></div>`;
    try {
      const wishes = [$('#wish', body).value, pf ? `Construis les menus AUTOUR des produits du garde-manger (${PT.pantryText(st.pantry)}) : utilise-les en premier, avant leur péremption, et ajoute le moins d'achats possible.` : ''].filter(Boolean).join('\n');
      const plan = await AI.planWeek(st.settings, personContext(), { days: P.weekDays(), people, budget: $('#bud', body).value, cookTime: Number($('#time', body).value), wishes });
      plan.people = people;
      store.update((s) => { s.plan = plan; s.shopChecked = {}; });
      body.close();
      toast('Menus prêts 🎉');
      done();
    } catch (e) {
      $('#go', body).disabled = false;
      $('#st', body).innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(AI.friendlyError(e))}</span></div>`;
    }
  };
}

// ---------- Courses ↔ garde-manger ----------
// Menus → liste de courses (moins ce que tu as déjà) ; article coché = acheté → il entre dans le garde-manger.
// Garde-manger (tickets, achats cochés, ajouts) → menus construits autour de ce que tu as.
function renderShop(el, ctx, view) {
  const st = store.get();
  const re = () => renderShop(el, ctx, view);
  const head = `<div class="seg">${[['liste', `${icon('cart', 14)} À acheter`], ['placard', `${icon('list', 14)} Mon garde-manger${st.pantry.length ? ` (${st.pantry.length})` : ''}`]].map(([k, l]) => `<button data-shop-tab="${k}" class="${shopTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (shopTab === 'placard') {
    const last = st.receipts.at(-1);
    const byCat = {};
    st.pantry.forEach((p) => (byCat[p.category || 'Divers'] ||= []).push(p));
    el.innerHTML = `${head}
      <div class="card">
        <p class="small muted" style="margin-top:0">Ce que tu as chez toi. Se remplit avec tes tickets de caisse et les articles cochés dans la liste.</p>
        <div class="row" style="flex-wrap:nowrap"><input id="p-add" placeholder="Ajouter un produit…"><button class="btn" id="p-ok">${icon('plus', 18)}</button></div>
        <div class="grid2" style="margin-top:8px"><button class="btn ghost" id="scan-receipt">${icon('receipt', 18)} Ticket</button><button class="btn" id="menus-from-pantry" ${st.pantry.length ? '' : 'disabled'}>${icon('sparkles', 18)} Menus avec ça</button></div>
        ${last ? `<div class="note ${last.stats.score >= 65 ? 'good' : last.stats.score >= 45 ? 'warn' : 'bad'}" style="margin-top:10px">${icon('cart', 16)}<span>Dernier panier : qualité <b>${last.stats.score}/100</b> · ${Math.round(last.stats.fruitVeg * 100)} % fruits & légumes · ${Math.round(last.stats.upf * 100)} % ultra-transformés</span></div>` : ''}
      </div>
      ${Object.entries(byCat).map(([c, items]) => `<div class="section-title">${esc(c)}</div><div class="card" style="padding:4px 16px;margin-top:0">${items.map((p) => `<div class="between" style="padding:10px 0;border-bottom:1px solid var(--line)"><span class="small">${esc(p.name)} <span class="tiny muted">${p.qty ? `${fmt(p.qty)} ${esc(p.unit || '')}` : ''}</span></span><button class="icon-btn" data-pantry-del="${p.id}" aria-label="Épuisé">${icon('x', 14)}</button></div>`).join('')}</div>`).join('') || `<div class="empty">${icon('list', 28)}<p>Garde-manger vide.</p></div>`}`;
    $$('[data-shop-tab]', el).forEach((b) => (b.onclick = () => { shopTab = b.dataset.shopTab; re(); }));
    $('#p-ok', el).onclick = () => { const v = $('#p-add', el).value.trim(); if (!v) return; store.update((s) => { s.pantry = PT.addToPantry(s.pantry, [{ name: v, qty: 1, unit: 'pièce', category: 'Divers' }], store.today()); }); re(); };
    $('#scan-receipt', el).onclick = () => ctx.action('receipt');
    $('#menus-from-pantry', el).onclick = () => openAiPlanner(() => { seg = 'menus'; render(view, ctx); }, { pantryFirst: true });
    $$('[data-pantry-del]', el).forEach((b) => (b.onclick = () => { store.update((s) => (s.pantry = s.pantry.filter((p) => p.id !== b.dataset.pantryDel))); re(); }));
    return;
  }
  const aisles = st.plan ? P.shoppingList(st.plan, st.pantry) : {};
  const have = aisles['Déjà dans tes placards'] || [];
  delete aisles['Déjà dans tes placards'];
  if (st.shopExtra.length) aisles['Ajouts perso'] = st.shopExtra.map((n) => ({ id: 'x|' + n, name: n, qty: 0, unit: '' }));
  const all = Object.values(aisles).flat();
  const done = all.filter((i) => st.shopChecked[i.id]).length;
  el.innerHTML = `${head}
    <div class="card">
      <div class="between"><div class="small muted">${st.plan ? `D’après tes menus${st.plan.people > 1 ? ` · ${st.plan.people} pers.` : ''} · ${done}/${all.length} achetés` : 'Pas de menus : ajoute tes articles à la main ou crée tes menus.'}</div>
        <div class="row" style="flex-wrap:nowrap"><button class="icon-btn" id="share" aria-label="Partager">${icon('share', 18)}</button><button class="icon-btn" id="clear" aria-label="Vider la liste">${icon('trash', 18)}</button></div></div>
      ${all.length ? `<div class="meter"><div class="track"><div class="fill" style="width:${(done / all.length) * 100}%;background:var(--primary)"></div></div></div>` : ''}
      <div class="row" style="flex-wrap:nowrap;margin-top:10px"><input id="extra" placeholder="Ajouter un article…"><button class="btn" id="add">${icon('plus', 18)}</button></div>
      ${!st.plan ? `<button class="btn soft block" style="margin-top:8px" data-seg-go="menus">${icon('calendar', 18)} Créer mes menus</button>` : ''}
      <p class="tiny muted" style="margin:8px 0 0">Coche un article quand tu l’achètes : il passe dans ton garde-manger.</p>
    </div>
    ${Object.entries(aisles).map(([a, items]) => `<div class="section-title">${esc(a)}</div><div class="card" style="padding:4px 16px;margin-top:0">
      ${items.map((i) => `<div class="shop-item ${st.shopChecked[i.id] ? 'done' : ''}" data-id="${esc(i.id)}"><span class="box">${icon('check', 14)}</span><span class="name">${esc(i.name)}</span><span class="small muted">${i.qty ? P.fmtQty(i) : ''}</span></div>`).join('')}
    </div>`).join('')}
    ${have.length ? `<details class="card"><summary class="small">${icon('check', 14)} Déjà chez toi (${have.length})</summary><div class="tiny muted" style="margin-top:6px">${have.map((i) => esc(i.name)).join(', ')}</div></details>` : ''}`;
  $$('[data-shop-tab]', el).forEach((b) => (b.onclick = () => { shopTab = b.dataset.shopTab; re(); }));
  $$('.shop-item', el).forEach((row) => (row.onclick = () => {
    const id = row.dataset.id;
    const item = all.find((i) => i.id === id);
    store.update((s) => {
      if (s.shopChecked[id]) { delete s.shopChecked[id]; s.pantry = s.pantry.filter((p) => p.fromShop !== id); }
      else {
        s.shopChecked[id] = true;
        s.pantry.push({ id: crypto.randomUUID(), name: item.name, qty: item.qty || 1, unit: item.unit || 'pièce', category: item.aisle || 'Divers', added: store.today(), fromShop: id });
      }
    });
    navigator.vibrate?.(10);
    re();
  }));
  $('#add', el).onclick = () => { const v = $('#extra', el).value.trim(); if (!v) return; store.update((s) => s.shopExtra.push(v)); re(); };
  el.querySelector('[data-seg-go]')?.addEventListener('click', () => { seg = 'menus'; render(view, ctx); });
  $('#clear', el).onclick = () => { if (confirm('Vider la liste (ajouts perso et coches) ?')) { store.update((s) => { s.shopChecked = {}; s.shopExtra = []; }); re(); } };
  $('#share', el).onclick = async () => {
    const text = `🛒 Liste de courses Diana Health\n\n${P.listAsText(aisles, st.shopChecked)}`;
    if (navigator.share) navigator.share({ title: 'Liste de courses', text }).catch(() => {});
    else { await navigator.clipboard?.writeText(text); toast('Liste copiée'); }
  };
}

// ---------- Notes (goûts) ----------
function stars(m) {
  return `<span class="stars" data-rate="${m.id}" aria-label="Note">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" class="${(m.rating || 0) >= n ? 'on' : ''}" aria-label="${n} étoile(s)">${icon('star', 22)}</button>`).join('')}</span>`;
}
function bindStars(el, rerender) {
  $$('[data-rate] button', el).forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const id = b.parentElement.dataset.rate;
    let val = 0;
    store.update((s) => { const m = s.meals.find((x) => x.id === id); if (m) { m.rating = m.rating === Number(b.dataset.n) ? 0 : Number(b.dataset.n); val = m.rating; } });
    $$('button', b.parentElement).forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= val));
    b.classList.add('pop');
    toast('Merci : tes goûts affinent les suggestions', 1500);
    rerender();
  }));
}

// ---------- Historique ----------
let histQuery = '';
let histRange = 30;
function renderHistory(el, ctx) {
  const st = store.get();
  const t = S.targets(st.profile);
  const q = tokens(histQuery);
  const since = new Date(); since.setDate(since.getDate() - histRange);
  const sinceKey = since.toISOString().slice(0, 10);
  const meals = st.meals.filter((m) => m.date >= sinceKey && (!q.length || q.every((w) => tokens(m.title).some((x) => x.startsWith(w))))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const byDay = {};
  meals.forEach((m) => (byDay[m.date] ||= []).push(m));
  const days = Object.keys(byDay);
  const dayTotals = days.map((d) => S.sumNutrients(st.meals.filter((m) => m.date === d)));
  const avg = (f) => (dayTotals.length ? dayTotals.reduce((a, x) => a + f(x), 0) / dayTotals.length : 0);

  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${icon('book', 18)} Historique des repas</h2><span class="tiny muted">${meals.length} repas</span></div>
      <div class="chips">${[[7, '7 jours'], [30, '30 jours'], [90, '3 mois'], [3650, 'Tout']].map(([n, l]) => `<button class="chip ${histRange === n ? 'on' : ''}" data-range="${n}">${l}</button>`).join('')}</div>
      <input id="hq" type="search" placeholder="Rechercher un plat, un aliment…" value="${esc(histQuery)}" style="margin-top:8px">
      <div class="kpi-row" style="margin-top:12px">
        <div class="stat"><div class="k">Calories / jour</div><div class="v">${fmt(avg((x) => x.kcal))}</div><div class="tiny muted">cible ${t.kcal}</div></div>
        <div class="stat"><div class="k">Protéines / jour</div><div class="v">${fmt(avg((x) => x.protein))}<small>g</small></div><div class="tiny muted">cible ${t.protein} g</div></div>
        <div class="stat"><div class="k">Qualité moy.</div><div class="v">${fmt(avg((x) => S.dietScore(x, t) || 0))}<small>/100</small></div><div class="tiny muted">${days.length} jour(s)</div></div>
      </div>
      ${meals.length ? `<button class="btn ghost block" id="top" style="margin-top:10px">${icon('star', 18)} Voir mes plats les plus mangés</button>` : ''}
    </div>
    ${days.map((d, i) => {
      const tot = dayTotals[i];
      const score = S.dietScore(tot, t);
      return `<div class="history-day"><b>${new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b><span class="small muted">${fmt(tot.kcal)} kcal${score != null ? ` · qualité ${score}/100` : ''}</span></div>
      <div class="bar-mini"><div style="width:${Math.min(100, (tot.kcal / t.kcal) * 100)}%;background:${tot.kcal > t.kcal * 1.1 ? 'var(--bad)' : 'var(--c-move)'}"></div></div>
      <div class="card" style="padding:2px 14px;margin-top:8px">${byDay[d].map((m) => mealLine(m)).join('')}</div>`;
    }).join('') || '<div class="empty">Aucun repas sur cette période.</div>'}`;
  const re = () => renderHistory(el, ctx);
  $$('[data-range]', el).forEach((b) => (b.onclick = () => { histRange = Number(b.dataset.range); re(); }));
  $('#hq', el).addEventListener('change', (e) => { histQuery = e.target.value; re(); });
  bindMeals(el, re);
  $('#top', el)?.addEventListener('click', () => openTop(meals));
}

function openTop(meals) {
  const freq = {};
  meals.forEach((m) => {
    const k = m.title.replace(/\s*\(.*\)$/, '');
    const f = (freq[k] ||= { name: k, n: 0, kcal: 0, rating: 0, rated: 0, verdict: m.verdict });
    f.n++; f.kcal += m.nutrients?.kcal || 0;
    if (m.rating) { f.rating += m.rating; f.rated++; }
  });
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 15);
  const bad = new Set(D.suspects(store.get().stools, store.get().meals).map((x) => x.word));
  sheet(top.map((f) => `<div class="meal-line" style="cursor:default"><span class="thumb" style="font-weight:800">×${f.n}</span><div><div class="ttl">${esc(f.name)}</div><div class="tiny muted">${fmt(f.kcal / f.n)} kcal en moyenne${f.rated ? ` · ${'★'.repeat(Math.round(f.rating / f.rated))}` : ''}${tokens(f.name).some((w) => bad.has(w)) ? ' · ⚠ digestion' : ''}</div></div>${badge(f.verdict)}</div>`).join(''), { title: 'Mes plats les plus mangés' });
}

// ---------- Grignotages ----------
function snackCard(st) {
  const sum = SN.snackSummary(st.meals);
  if (!sum.count) return '';
  const reasonLabel = Object.fromEntries(SN.REASONS);
  return `<div class="card">
    <div class="card-head"><h2>${icon('apple', 18)} Grignotages · 7 jours</h2><button class="btn sm soft" id="add-snack">${icon('plus', 16)}</button></div>
    <div class="kpi-row">
      <div class="stat"><div class="k">Nombre</div><div class="v">${sum.count}</div></div>
      <div class="stat"><div class="k">Calories</div><div class="v">${fmt(sum.kcal)}<small>${sum.share ? ` · ${Math.round(sum.share * 100)} %` : ''}</small></div></div>
      <div class="stat"><div class="k">Raison n°1</div><div class="v" style="font-size:.95rem">${sum.topReason ? esc(reasonLabel[sum.topReason[0]]) : '—'}</div></div>
    </div>
    ${sum.advice.slice(0, 1).map((a) => `<div class="small" style="margin-top:8px;color:var(--text-2)">• ${esc(a.text)}</div>${srcLinks(a.src)}`).join('')}
  </div>`;
}
