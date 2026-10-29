// Nutrition : journal du jour, menus de la semaine, liste de courses.
import * as store from '../store.js';
import * as C from '../coach.js';
import * as AI from '../ai.js';
import * as P from '../planner.js';
import { summary, personContext } from '../context.js';
import { icon, esc, fmt, segmented, donut, toast, sheet, srcLinks, $, $$ } from '../ui.js';
import { meter } from './home.js';
import { addMeal } from './actions.js';

let seg = 'jour';
let slot = null;
const VERDICT = { bon: 'Bon', moyen: 'Moyen', a_limiter: 'À limiter' };

export function render(view, ctx) {
  view.innerHTML = `${segmented('nut', [['jour', 'Aujourd’hui'], ['menus', 'Menus'], ['courses', 'Courses']], seg)}<div id="nut-body" class="view-enter"></div>`;
  $$('[data-seg="nut"]', view).forEach((b) => (b.onclick = () => { seg = b.dataset.v; render(view, ctx); }));
  const body = $('#nut-body', view);
  ({ jour: renderDay, menus: renderMenus, courses: renderShop })[seg](body, ctx, view);
}

function renderDay(el, ctx) {
  const st = store.get();
  const sm = summary();
  const t = sm.t, tot = sm.totToday;
  const meals = store.mealsOn().sort((a, b) => a.time.localeCompare(b.time));
  const s = slot || C.currentSlot();
  const sugg = C.mealSuggestions(sm, st.profile, s);
  const planToday = st.plan?.days?.find((d) => d.date === store.today());
  const left = t.kcal - tot.kcal;

  el.innerHTML = `
    <div class="card">
      <div class="row" style="flex-wrap:nowrap;gap:16px">
        ${donut(tot.kcal, t.kcal, { label: fmt(Math.abs(left)), sub: left >= 0 ? 'kcal restantes' : 'kcal en trop', color: 'var(--c-move)', size: 128 })}
        <div style="flex:1">
          ${meter('Protéines', tot.protein, t.protein, 'g', 'var(--c-sleep)')}
          ${meter('Fibres', tot.fiber, t.fiber, 'g', 'var(--c-food)')}
          ${meter('Fruits & légumes', tot.fruitVeg, t.fruitVeg, 'g', 'var(--primary)')}
        </div>
      </div>
      ${meter('Sucres libres', tot.sugar, t.sugarMax, 'g max', 'var(--c-mood)', true)}
      ${meter('Sodium', tot.sodium, t.sodiumMax, 'mg max', 'var(--c-screen)', true)}
      ${srcLinks(['who2015sugar', 'who2012sodium', 'reynolds2019', 'aune2017'])}
    </div>

    <div class="grid3">
      <button class="btn soft" data-a="photo">${icon('camera', 18)} Photo</button>
      <button class="btn soft" data-a="scan">${icon('barcode', 18)} Scanner</button>
      <button class="btn soft" data-a="manual">${icon('pencil', 18)} Manuel</button>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('utensils', 18)} Journal du jour</h2><span class="muted small">${meals.length} repas</span></div>
      ${meals.length ? `<div class="list">${meals.map((m) => `
        <div class="list-item">
          ${m.thumb ? `<img class="thumb" src="${esc(m.thumb)}" alt="">` : `<span class="thumb">${icon('utensils')}</span>`}
          <div><div class="ttl">${esc(m.title)}</div><div class="tiny muted">${esc(m.time)} · ${fmt(m.nutrients?.kcal)} kcal · P ${fmt(m.nutrients?.protein)} g · fibres ${fmt(m.nutrients?.fiber)} g</div>
            ${m.verdict ? `<span class="badge ${m.verdict}" style="margin-top:4px">${VERDICT[m.verdict]}${m.nutriscore ? ' · Nutri-Score ' + m.nutriscore.toUpperCase() : ''}</span>` : ''}</div>
          <button class="icon-btn" data-del="${m.id}" aria-label="Supprimer">${icon('trash', 16)}</button>
        </div>`).join('')}</div>` : `<div class="empty">${icon('camera', 28)}<p>Aucun repas aujourd'hui.<br>Photographie ton assiette ou scanne un produit.</p></div>`}
    </div>

    ${planToday ? `<div class="card">
      <div class="card-head"><h2>${icon('calendar', 18)} Au menu aujourd'hui</h2></div>
      ${planToday.meals.map((m) => `<div class="suggest"><div><div class="tiny muted" style="font-weight:700;text-transform:uppercase">${P.SLOT_LABEL[m.slot]}</div><div class="ttl">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal · ${m.protein} g prot</div></div>
        <button class="btn sm soft" data-eat-plan="${esc(m.name)}">${icon('check', 16)}</button></div>`).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h2>${icon('chef', 18)} Que manger ?</h2></div>
      <div class="chips">${Object.entries(P.SLOT_LABEL).map(([k, l]) => `<button class="chip ${k === s ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
      ${sugg.map((m) => `<div class="suggest"><div><div class="ttl">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal · ${m.protein} g prot · ${m.fiber} g fibres · ${m.prep} min</div>${m.why.length ? `<div class="why">${esc(m.why.join(' · '))}</div>` : ''}</div>
        <button class="btn sm soft" data-eat="${esc(m.name)}" aria-label="J'ai mangé ça">${icon('plus', 16)}</button></div>`).join('')}
      <p class="tiny muted">Calculé selon ce qu’il te reste à couvrir aujourd’hui, ton sommeil, ton humeur et ton activité.</p>
    </div>`;

  $$('[data-a]', el).forEach((b) => (b.onclick = () => ctx.action(b.dataset.a)));
  $$('[data-slot]', el).forEach((b) => (b.onclick = () => { slot = b.dataset.slot; renderDay(el, ctx); }));
  $$('[data-del]', el).forEach((b) => (b.onclick = () => { store.update((x) => (x.meals = x.meals.filter((m) => m.id !== b.dataset.del))); renderDay(el, ctx); }));
  $$('[data-eat]', el).forEach((b) => (b.onclick = () => {
    const m = sugg.find((x) => x.name === b.dataset.eat);
    addMeal({ title: m.name, nutrients: { kcal: m.kcal, protein: m.protein, fiber: m.fiber, fruitVeg: m.fruitVeg, sugar: 5, satFat: 4, sodium: 500, carbs: 0, fat: 0 }, nova: 1, quality: 85, verdict: 'bon' });
    renderDay(el, ctx);
  }));
  $$('[data-eat-plan]', el).forEach((b) => (b.onclick = () => {
    const m = planToday.meals.find((x) => x.name === b.dataset.eatPlan);
    addMeal({ title: m.name, nutrients: { kcal: m.kcal, protein: m.protein, fiber: m.fiber, fruitVeg: 150, sugar: 5, satFat: 4, sodium: 500, carbs: 0, fat: 0 }, nova: 1, quality: 85, verdict: 'bon' });
    renderDay(el, ctx);
  }));
}

// ---------- Menus ----------
function renderMenus(el, ctx, view) {
  const st = store.get();
  const plan = st.plan;
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${icon('calendar', 18)} Menus de la semaine</h2></div>
      <p class="small muted" style="margin-top:-6px">Équilibrés selon tes besoins (${summary().t.kcal} kcal/j), ton régime et tes allergies, avec la liste de courses générée automatiquement.</p>
      <button class="btn block" id="gen-ai">${icon('sparkles', 18)} Créer avec le coach IA</button>
      <button class="btn ghost block" id="gen-local" style="margin-top:8px">${icon('refresh', 18)} Générer rapidement (hors-ligne)</button>
    </div>
    ${plan ? `
      ${plan.tips ? `<div class="note">${icon('bulb', 18)}<span>${esc(plan.tips)}</span></div>` : ''}
      ${plan.days.map((d) => `<div class="day-card"><header><span>${esc(d.label)} <span class="muted tiny">${d.date ? new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span></span><span class="muted small">${fmt(d.meals.reduce((a, m) => a + (m.kcal || 0), 0))} kcal</span></header>
        ${d.meals.map((m, i) => `<div class="meal-row"><div><div class="slot">${P.SLOT_LABEL[m.slot] || m.slot}</div><div style="font-weight:600">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal · ${m.protein} g prot${m.prep ? ` · ${m.prep} min` : ''}</div></div>
          <button class="icon-btn" data-recipe="${plan.days.indexOf(d)}:${i}" aria-label="Voir la recette">${icon('book', 16)}</button></div>`).join('')}
      </div>`).join('')}
      <button class="btn soft block" data-seg-go="courses">${icon('cart', 18)} Voir la liste de courses</button>` : `<div class="empty">${icon('calendar', 32)}<p>Pas encore de menus. Génère ta semaine !</p></div>`}`;

  $('#gen-local', el).onclick = () => {
    const sm = summary();
    store.update((s) => { s.plan = P.offlinePlan({ targets: sm.t, profile: s.profile, ctx: sm.ctx }); s.shopChecked = {}; });
    toast('Menus générés');
    renderMenus(el, ctx, view);
  };
  $('#gen-ai', el).onclick = () => openAiPlanner(() => renderMenus(el, ctx, view));
  el.querySelector('[data-seg-go]')?.addEventListener('click', () => { seg = 'courses'; render(view, ctx); });
  $$('[data-recipe]', el).forEach((b) => (b.onclick = () => {
    const [di, mi] = b.dataset.recipe.split(':').map(Number);
    const m = plan.days[di].meals[mi];
    sheet(`<div class="tiny muted" style="font-weight:700;text-transform:uppercase">${esc(plan.days[di].label)} · ${P.SLOT_LABEL[m.slot]}</div>
      <h2 style="margin:4px 0 10px">${esc(m.name)}</h2>
      <div class="grid3"><div class="stat"><div class="k">Calories</div><div class="v">${m.kcal}</div></div><div class="stat"><div class="k">Protéines</div><div class="v">${m.protein}<small>g</small></div></div><div class="stat"><div class="k">Préparation</div><div class="v">${m.prep || '–'}<small>min</small></div></div></div>
      <h3 style="font-size:.95rem;margin:16px 0 6px">Ingrédients</h3>
      <ul class="small">${(m.ingredients || []).map((i) => `<li>${esc(i.name)} — ${P.fmtQty({ ...i, qty: Math.round(i.qty * 10) / 10 })}</li>`).join('')}</ul>
      ${m.steps ? `<h3 style="font-size:.95rem;margin:16px 0 6px">Préparation</h3><p class="small" style="white-space:pre-wrap">${esc(m.steps)}</p>` : ''}`, { title: 'Recette' });
  }));
}

function openAiPlanner(done) {
  const st = store.get();
  const body = sheet(`
    <div class="grid2">
      <div><label class="lbl">Personnes</label><select id="pp">${[1, 2, 3, 4, 5, 6].map((n) => `<option>${n}</option>`).join('')}</select></div>
      <div><label class="lbl">Budget</label><select id="bud"><option value="serré">Serré</option><option value="moyen" selected>Moyen</option><option value="confortable">Confortable</option></select></div>
    </div>
    <label class="lbl">Temps de cuisine max par repas</label><select id="time"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1 h</option></select>
    <label class="lbl">Envies, contraintes (facultatif)</label><textarea id="wish" placeholder="ex. batch cooking le dimanche, pas de poisson le lundi, j'adore la cuisine asiatique…"></textarea>
    ${!st.settings.apiKey ? `<div class="note warn" style="margin-top:12px">${icon('key', 18)}<span>Ajoute ta clé API dans Profil pour utiliser le coach IA.</span></div>` : ''}
    <button class="btn block" id="go" style="margin-top:16px">${icon('sparkles', 18)} Générer mes menus</button>
    <div id="st" style="margin-top:12px"></div>`, { title: 'Menus avec le coach IA' });
  $('#go', body).onclick = async () => {
    const people = Number($('#pp', body).value);
    $('#go', body).disabled = true;
    $('#st', body).innerHTML = `<div class="empty"><span class="spinner"></span><p>Le coach compose ta semaine (environ 1 minute)…</p></div>`;
    try {
      const plan = await AI.planWeek(st.settings, personContext(), { days: P.weekDays(), people, budget: $('#bud', body).value, cookTime: Number($('#time', body).value), wishes: $('#wish', body).value });
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

// ---------- Courses ----------
function renderShop(el, ctx, view) {
  const st = store.get();
  if (!st.plan && !st.shopExtra.length) {
    el.innerHTML = `<div class="empty">${icon('cart', 32)}<p>La liste de courses est créée à partir de tes menus de la semaine.</p><button class="btn" data-seg-go="menus">Créer mes menus</button></div>`;
    el.querySelector('[data-seg-go]').onclick = () => { seg = 'menus'; render(view, ctx); };
    return;
  }
  const aisles = st.plan ? P.shoppingList(st.plan) : {};
  if (st.shopExtra.length) aisles['Ajouts perso'] = st.shopExtra.map((n) => ({ id: 'x|' + n, name: n, qty: 0, unit: '' }));
  const all = Object.values(aisles).flat();
  const done = all.filter((i) => st.shopChecked[i.id]).length;

  el.innerHTML = `
    <div class="card">
      <div class="between"><div><h2 style="font-size:1.05rem">${icon('cart', 18)} Liste de courses</h2><div class="small muted">${done}/${all.length} articles${st.plan?.people > 1 ? ` · ${st.plan.people} personnes` : ''}</div></div>
        <div class="row"><button class="icon-btn" id="share" aria-label="Partager">${icon('share', 18)}</button><button class="icon-btn" id="clear" aria-label="Décocher tout">${icon('refresh', 18)}</button></div></div>
      <div class="meter"><div class="track"><div class="fill" style="width:${all.length ? (done / all.length) * 100 : 0}%;background:var(--primary)"></div></div></div>
      <div class="row" style="flex-wrap:nowrap;margin-top:10px"><input id="extra" placeholder="Ajouter un article…"><button class="btn" id="add">${icon('plus', 18)}</button></div>
    </div>
    ${Object.entries(aisles).map(([a, items]) => `<div class="section-title">${esc(a)}</div><div class="card" style="padding:4px 16px;margin-top:0">
      ${items.map((i) => `<div class="shop-item ${st.shopChecked[i.id] ? 'done' : ''}" data-id="${esc(i.id)}"><span class="box">${icon('check', 14)}</span><span class="name">${esc(i.name)}</span><span class="small muted">${i.qty ? P.fmtQty(i) : ''}</span></div>`).join('')}
    </div>`).join('')}`;

  $$('.shop-item', el).forEach((row) => (row.onclick = () => {
    const id = row.dataset.id;
    store.update((s) => { if (s.shopChecked[id]) delete s.shopChecked[id]; else s.shopChecked[id] = true; });
    navigator.vibrate?.(10);
    renderShop(el, ctx, view);
  }));
  $('#add', el).onclick = () => {
    const v = $('#extra', el).value.trim();
    if (!v) return;
    store.update((s) => s.shopExtra.push(v));
    renderShop(el, ctx, view);
  };
  $('#clear', el).onclick = () => { store.update((s) => { s.shopChecked = {}; }); renderShop(el, ctx, view); };
  $('#share', el).onclick = async () => {
    const text = `🛒 Liste de courses AppSanté\n\n${P.listAsText(aisles, st.shopChecked)}`;
    if (navigator.share) navigator.share({ title: 'Liste de courses', text }).catch(() => {});
    else { await navigator.clipboard?.writeText(text); toast('Liste copiée'); }
  };
}
