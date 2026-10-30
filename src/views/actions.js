// Actions globales ouvertes en feuille modale : menu « + », photo d'assiette, scanner, check-in, saisie manuelle.
import * as store from '../store.js';
import * as C from '../coach.js';
import * as AI from '../ai.js';
import * as BC from '../barcode.js';
import { summary, personContext } from '../context.js';
import { icon, esc, fmt, fmtMin, sheet, toast, compressImage, pickImage, releaseCamera, BLANK, srcLinks, faces, bindFaces, $, $$ } from '../ui.js';
import * as SL from '../sleep.js';
import * as N from '../native.js';
import * as D from '../digestion.js';
import * as PT from '../pantry.js';
import * as SN from '../snacks.js';
import { allowedMeals } from '../meals.js';

const VERDICT = { bon: 'Bon pour toi', moyen: 'Moyen', a_limiter: 'À limiter' };

export function addMeal(m) {
  const now = new Date();
  store.update((s) => {
    s.meals.push({ id: crypto.randomUUID(), date: store.today(), time: now.toTimeString().slice(0, 5), ...m, slot: m.slot || C.currentSlot(now) });
    // alcool repéré sur la photo, le produit scanné ou le grignotage : compté automatiquement
    if (m.alcohol) { const k = store.today(); s.days[k] = { ...(s.days[k] || {}), alcohol: Math.round(((s.days[k]?.alcohol || 0) + m.alcohol) * 10) / 10 }; }
  });
  toast(m.snack ? `${m.title} : ajouté` : 'Repas enregistré ✅', 1200);
}

export function openAddMenu(ctx) {
  const body = sheet(`
    <div class="action-grid">
      ${[
        ['photo', 'camera', 'var(--c-food)', 'Photo du repas'],
        ['snack', 'apple', 'var(--c-mood)', 'Grignotage'],
        ['scan', 'barcode', 'var(--c-move)', 'Produit (scan ou nom)'],
        ['workout', 'dumbbell', 'var(--c-move)', 'Séance de sport'],
        ['checkin', 'smile', 'var(--c-mood)', 'Humeur du jour'],
        ['receipt', 'receipt', 'var(--c-food)', 'Ticket de caisse'],
        ['stool', 'activity', 'var(--c-move)', 'Passage aux toilettes'],
        ['menus', 'calendar', 'var(--primary)', 'Menus de la semaine'],
      ].map(([a, ic, col, t]) => `<button class="action" data-a="${a}"><span class="icon-badge" style="background:color-mix(in srgb,${col} 16%,transparent);color:${col}">${icon(ic)}</span><b>${t}</b></button>`).join('')}
    </div>`, { title: 'Ajouter' });
  $$('[data-a]', body).forEach((b) => (b.onclick = () => { body.close(); setTimeout(() => ctx.action(b.dataset.a), 200); }));
}

// ---------- Humeur du jour ----------
export function scale(field, value, labels) {
  return `<div class="scale" data-field="${field}">${labels.map((l, i) => `<button type="button" class="${value === i + 1 ? 'on' : ''}" data-v="${i + 1}" aria-label="${l}">${i + 1}<small>${l}</small></button>`).join('')}</div>`;
}

// Demandée chaque jour à la première ouverture ; un appui par ligne suffit.
export function openCheckin(ctx, { daily = false } = {}) {
  const d = store.getDay();
  const body = sheet(`
    ${daily ? '<p class="small muted" style="margin-top:0">10 secondes pour suivre ton moral : c’est ce qui permet de relier humeur, sommeil, écrans et activité.</p>' : ''}
    <label class="lbl">Comment te sens-tu ?</label>${faces('mood', d.mood)}
    <label class="lbl">Énergie</label>${faces('energy', d.energy)}
    <label class="lbl">Stress</label>${faces('stress', d.stress)}
    <button class="btn block" style="margin-top:18px" data-done>${icon('check', 18)} C’est noté</button>
    ${srcLinks(['michie2009', 'harkin2016'])}`, { title: daily ? 'Comment ça va aujourd’hui ?' : 'Humeur du jour', onClose: () => ctx.render() });
  bindFaces(body, (f, v) => store.setDay(store.today(), { [f]: v }));
  store.update((s) => { s.moodAsked = store.today(); });
  $('[data-done]', body).onclick = () => body.close();
}

// ---------- Photo d'assiette ----------
const MEAL_TYPES = [['petit-dej', 'Petit-déj'], ['dejeuner', 'Déjeuner'], ['collation', 'Collation'], ['diner', 'Dîner'], ['grignotage', 'Grignotage']];

export async function openPhoto(ctx, fromGallery = false, slot = null) {
  const st = store.get();
  if (!st.settings.apiKey) return openQuickMeal(ctx, slot); // l'analyse photo demande une clé API
  const [file] = await pickImage({ camera: !fromGallery });
  if (!file) return;
  const dataUrl = await compressImage(file);
  const body = sheet(`<img class="preview" src="${dataUrl}" alt=""><div id="res" style="margin-top:14px">
      <label class="lbl">Une précision ? (facultatif)</label><input id="note" placeholder="ex. sauce à la crème, moitié mangée…">
      <button class="btn block" id="go" style="margin-top:12px">${icon('sparkles', 18)} Analyser ce repas</button>
      ${!st.settings.apiKey ? `<div class="note warn" style="margin-top:12px">${icon('key', 18)}<span>Ajoute une clé IA dans Profil pour activer l’analyse photo (une clé Google Gemini est gratuite).</span></div>` : ''}
    </div>`, { title: 'Analyse du repas', full: true, onClose: () => ctx.render() });
  $('#go', body).onclick = async () => {
    const note = $('#note', body).value;
    const res = $('#res', body);
    res.innerHTML = `<div class="empty"><span class="spinner"></span><p>Identification des aliments et estimation des portions…</p></div>`;
    try {
      const sm = summary();
      const r = await AI.analyzePlate(st.settings, dataUrl, personContext(sm), note);
      if (!r.is_food) throw new Error('Je ne vois pas de nourriture sur cette photo.');
      const thumb = await compressImage(await (await fetch(dataUrl)).blob(), 160, 0.7);
      showResult(res, { ...r, thumb, factor: 1, slot: slot || C.currentSlot() }, body);
    } catch (e) {
      res.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(AI.friendlyError(e))}</span></div>`;
    }
  };
}

const scaled = (n, k) => Object.fromEntries(Object.entries(n).map(([a, v]) => [a, Math.round(v * k * 10) / 10]));

function showResult(res, p, body) {
  const n = scaled(p.nutrients, p.factor);
  res.innerHTML = `
    <div class="between"><h2 style="font-size:1.2rem">${esc(p.title)}</h2><span class="badge ${p.verdict}">${VERDICT[p.verdict]}</span></div>
    <div class="grid3" style="margin:14px 0">
      <div class="stat"><div class="k">${icon('flame', 14)} Calories</div><div class="v">${fmt(n.kcal)}<small>kcal</small></div></div>
      <div class="stat"><div class="k">Protéines</div><div class="v">${fmt(n.protein)}<small>g</small></div></div>
      <div class="stat"><div class="k">Qualité</div><div class="v">${p.quality}<small>/100</small></div></div>
      <div class="stat"><div class="k">Glucides</div><div class="v">${fmt(n.carbs)}<small>g</small></div></div>
      <div class="stat"><div class="k">Lipides</div><div class="v">${fmt(n.fat)}<small>g</small></div></div>
      <div class="stat"><div class="k">Fibres</div><div class="v">${fmt(n.fiber)}<small>g</small></div></div>
    </div>
    <table>${p.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${fmt(i.grams * p.factor)} g</td><td class="num">${fmt(i.kcal * p.factor)} kcal</td></tr>`).join('')}</table>
    <p class="small" style="margin:14px 0 10px">${esc(p.comment)}</p>
    <div class="note">${icon('bulb', 18)}<span>${esc(p.advice)}</span></div>
    ${p.alcohol_drinks ? `<div class="note warn">${icon('wine', 18)}<span>${fmt(p.alcohol_drinks * p.factor, 1)} verre(s) standard d’alcool détecté(s) : ajouté(s) automatiquement à ta journée.</span></div>` : ''}
    <p class="tiny muted">Sucres ${fmt(n.sugar)} g · graisses saturées ${fmt(n.satFat)} g · sodium ${fmt(n.sodium)} mg · NOVA ${p.nova} · confiance ${esc(p.confidence)}</p>
    <label class="lbl">Portion réellement mangée : <b>${Math.round(p.factor * 100)} %</b></label>
    <input type="range" id="factor" min="0.25" max="2" step="0.05" value="${p.factor}">
    <label class="lbl">C’était</label>
    <div class="chips" style="flex-wrap:wrap">${MEAL_TYPES.map(([k, l]) => `<button class="chip ${p.slot === k ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
    <button class="btn block" id="save" style="margin-top:14px">${icon('check', 18)} Enregistrer</button>`;
  $$('[data-slot]', res).forEach((b) => (b.onclick = () => { p.slot = b.dataset.slot; $$('[data-slot]', res).forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#factor', res).onchange = (e) => showResult(res, { ...p, factor: Number(e.target.value) }, body);
  $('#save', res).onclick = () => {
    addMeal({ title: p.title, nutrients: n, items: p.items, nova: p.nova, quality: p.quality, verdict: p.verdict, comment: p.comment, advice: p.advice, thumb: p.thumb, slot: p.slot === 'grignotage' ? 'collation' : p.slot, snack: p.slot === 'grignotage', alcohol: p.alcohol_drinks ? Math.round(p.alcohol_drinks * p.factor * 10) / 10 : 0 });
    body.close();
  };
}

// ---------- Scanner code-barres ----------
export function openScanner(ctx, slot = null) {
  let stop = () => {};
  const body = sheet(`
    <div class="scanner"><video muted playsinline poster="${BLANK}"></video><div class="frame"></div><div class="laser"></div></div>
    <p class="small muted" style="text-align:center;margin-bottom:8px">Vise le code-barres du produit</p>
    <div class="row" style="flex-wrap:nowrap"><input id="code" type="search" placeholder="Pas d’emballage ? Tape le nom (ex. Kit Kat)"><button class="btn" id="lookup" aria-label="Chercher">${icon('search', 18)}</button></div>
    <div id="prod" style="margin-top:14px"></div>
    <button class="link small" id="to-manual" style="display:block;margin:14px auto 0">${icon('pencil', 14)} Saisir un repas à la main</button>`, { title: 'Produit', full: true, onClose: () => { stop(); ctx.render(); } });
  const show = async (code) => {
    stop();
    $('.scanner', body).style.display = 'none';
    const out = $('#prod', body);
    out.innerHTML = `<div class="empty"><span class="spinner"></span><p>Recherche dans Open Food Facts…</p></div>`;
    try {
      const prod = await BC.lookup(code);
      if (!prod) { out.innerHTML = `<div class="note warn">${icon('info', 18)}<span>Produit ${esc(code)} introuvable dans Open Food Facts. Tape son nom dans le champ ci-dessus pour le chercher.</span></div>`; return; }
      productCard(out, prod, prod.serving || 100, body, slot || C.currentSlot());
    } catch (e) {
      out.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(e.message)}</span></div>`;
    }
  };
  $('#lookup', body).onclick = () => {
    const raw = $('#code', body).value.trim(), c = raw.replace(/\D/g, '');
    if (/^[\d\s]{8,}$/.test(raw)) show(c);
    else if (raw.length >= 2) { body.close(); setTimeout(() => openProductSearch(ctx, slot, raw), 250); }
  };
  $('#code', body).onkeydown = (e) => { if (e.key === 'Enter') $('#lookup', body).click(); };
  $('#to-manual', body).onclick = () => { body.close(); setTimeout(() => openManual(ctx), 250); };
  releaseCamera();
  BC.startScanner($('video', body), show).then((s) => (stop = s)).catch(() => {
    $('.scanner', body).innerHTML = `<div class="empty" style="color:#fff">${icon('camera', 28)}<p>Caméra indisponible. Autorise l’accès à la caméra ou saisis le code.</p></div>`;
  });
}

function nutriBadge(g) {
  return `<span class="nutri" aria-label="Nutri-Score ${g ? g.toUpperCase() : 'inconnu'}">${'abcde'.split('').map((l) => `<span class="${l === g ? 'on' : ''}" style="background:${BC.NUTRI_COLORS[l]}">${l.toUpperCase()}</span>`).join('')}</span>`;
}
const NOVA_COLORS = { 1: '#038141', 2: '#fecb02', 3: '#ee8100', 4: '#e63e11' };
const NOVA_LABEL = { 1: 'Brut / peu transformé', 2: 'Ingrédient culinaire', 3: 'Transformé', 4: 'Ultra-transformé' };

// Raccourcis de quantité : fractions du paquet (¼, ½, ¾, entier) et portions indiquées sur l'emballage.
function qtyChips(prod, grams) {
  const r = (g) => Math.round(g * 10) / 10;
  const opts = [];
  if (prod.pack) [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, 'Entier']].forEach(([k, l]) => opts.push([r(prod.pack * k), `${l}${k < 1 ? ' paquet' : ''} · ${fmt(r(prod.pack * k), 1)} g`]));
  if (prod.serving && prod.serving !== prod.pack) [1, 2].forEach((k) => opts.push([r(prod.serving * k), `${k} portion${k > 1 ? 's' : ''} · ${fmt(r(prod.serving * k), 1)} g`]));
  return opts.length ? `<div class="chips" style="margin-top:8px;flex-wrap:wrap">${opts.map(([g, l]) => `<button class="chip ${Math.abs(grams - g) < 0.5 ? 'on' : ''}" data-por="${g}">${l}</button>`).join('')}</div>` : '';
}

function productCard(out, prod, grams, body, slot, back = null) {
  const sm = summary();
  const v = BC.verdict(prod, grams, { targets: sm.t, totToday: sm.totToday, profile: store.get().profile });
  const n = v.n;
  out.innerHTML = `
    ${back ? `<button class="btn ghost sm" id="back" style="margin-bottom:8px">${icon('left', 16)} Résultats</button>` : ''}
    <div class="list-item" style="border:0;padding-top:0">
      ${prod.image ? `<img class="thumb" src="${esc(prod.image)}" alt="" style="width:72px;height:72px;object-fit:contain;background:#fff">` : `<span class="thumb">${icon('barcode')}</span>`}
      <div><div class="ttl">${esc(prod.name)}</div><div class="tiny muted">${esc(prod.brand)} ${esc(prod.quantity)}</div></div>
      <span class="badge ${v.verdict}">${VERDICT[v.verdict]}</span>
    </div>
    <div class="grid2" style="margin:6px 0 12px">
      <div class="stat"><div class="k">Nutri-Score</div><div style="margin-top:6px">${nutriBadge(prod.nutriscore)}</div></div>
      <div class="stat"><div class="k">Transformation</div><div class="row" style="margin-top:6px;flex-wrap:nowrap">${prod.nova ? `<span class="nova" style="background:${NOVA_COLORS[prod.nova]}">${prod.nova}</span><span class="tiny">${NOVA_LABEL[prod.nova]}</span>` : '<span class="tiny muted">inconnue</span>'}</div></div>
    </div>
    <div class="stat" style="margin-bottom:12px"><div class="k">Note pour toi</div><div class="v">${v.score}<small>/100</small></div>
      ${v.pros.map((x) => `<div class="small" style="color:var(--good)">✓ ${esc(x)}</div>`).join('')}
      ${v.cons.map((x) => `<div class="small" style="color:var(--bad)">✗ ${esc(x)}</div>`).join('')}
    </div>
    ${prod.missing ? `<div class="note warn" style="margin-bottom:12px">${icon('alert', 18)}<span>Valeurs nutritionnelles absentes de la fiche Open Food Facts : cherche une autre version du produit${back ? ' dans les résultats' : ' par son nom'}.</span></div>` : ''}
    <label class="lbl">Quantité consommée</label>
    <div class="row" style="flex-wrap:nowrap">
      <div class="stepper" style="flex:1"><button data-d="-10">−</button><input id="grams" type="number" inputmode="decimal" value="${grams}"><button data-d="10">+</button></div>
      <span class="muted">g</span>
    </div>
    ${qtyChips(prod, grams)}
    <table style="margin-top:12px"><tr><th></th><th class="num">pour ${fmt(grams)} g</th><th class="num">100 g</th></tr>
      ${[['Calories', 'kcal', 'kcal'], ['Protéines', 'protein', 'g'], ['Glucides', 'carbs', 'g'], ['dont sucres', 'sugar', 'g'], ['Lipides', 'fat', 'g'], ['dont saturés', 'satFat', 'g'], ['Fibres', 'fiber', 'g'], ['Sodium', 'sodium', 'mg']]
        .map(([l, k, u]) => `<tr><td>${l}</td><td class="num"><b>${fmt(n[k], k === 'kcal' || k === 'sodium' ? 0 : 1)}</b> ${u}</td><td class="num muted">${fmt(prod.per100[k], 1)}</td></tr>`).join('')}
    </table>
    ${prod.additives.length ? `<h3 style="font-size:.95rem;margin:16px 0 6px">Additifs (${prod.additives.length})</h3>
      ${prod.additives.map((a) => `<div class="small" style="margin:6px 0"><span class="badge ${a.level === 'eleve' ? 'a_limiter' : a.level === 'moyen' ? 'moyen' : 'neutral'}">${esc(a.id)}</span> ${esc(a.name)} <span class="muted">${esc(a.note)}</span></div>`).join('')}` : '<p class="small" style="color:var(--good)">✓ Aucun additif</p>'}
    ${prod.allergens.length ? `<p class="small muted">Allergènes : ${esc(prod.allergens.join(', '))}</p>` : ''}
    <label class="lbl">C’était</label>
    <div class="chips" style="flex-wrap:wrap">${MEAL_TYPES.map(([k, l]) => `<button class="chip ${slot === k ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
    <button class="btn block" id="add" style="margin-top:14px">${icon('plus', 18)} Ajouter</button>
    <p class="tiny muted" style="text-align:center">Données : Open Food Facts (ODbL)</p>`;
  const g = () => Math.max(1, Number($('#grams', out).value) || 0);
  $$('[data-slot]', out).forEach((b) => (b.onclick = () => { slot = b.dataset.slot; $$('[data-slot]', out).forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#grams', out).onchange = () => productCard(out, prod, g(), body, slot, back);
  $$('[data-d]', out).forEach((b) => (b.onclick = () => productCard(out, prod, Math.max(5, g() + Number(b.dataset.d)), body, slot, back)));
  if (back) $('#back', out).onclick = back;
  $$('[data-por]', out).forEach((b) => (b.onclick = () => productCard(out, prod, Number(b.dataset.por), body, slot, back)));
  $('#add', out).onclick = () => {
    const frac = prod.pack && [[0.25, '¼ paquet'], [0.5, '½ paquet'], [0.75, '¾ paquet']].find(([k]) => Math.abs(g() - prod.pack * k) < 0.5)?.[1];
    addMeal({ title: `${prod.name}${prod.brand ? ' – ' + prod.brand.split(',')[0] : ''} (${frac ? `${frac}, ` : ''}${g()} g)`, alcohol: prod.alcohol ? Math.round(((g() * prod.alcohol) / 100) * 0.8 / 10 * 10) / 10 : 0, nutrients: n, nova: prod.nova || 3, quality: v.score, verdict: v.verdict, nutriscore: prod.nutriscore, barcode: prod.code, thumb: prod.image, comment: [...v.pros, ...v.cons].join(' · '), slot: slot === 'grignotage' ? 'collation' : slot, snack: slot === 'grignotage' });
    body.close();
  };
}

// Repas scannés enregistrés sans valeurs (fiches où Open Food Facts ne donnait que le « préparé » ou la portion) :
// on relit la fiche et on complète. Renvoie le nombre de repas corrigés.
export async function repairScannedMeals() {
  const broken = store.get().meals.filter((m) => m.barcode && !m.nutrients?.kcal && !m.repairTried);
  let fixed = 0;
  for (const m of broken.slice(0, 5)) {
    try {
      const prod = await BC.lookup(m.barcode);
      const grams = Number((m.title.match(/([\d.,]+) g\)$/) || [])[1]?.replace(',', '.')) || prod?.serving || 100;
      store.update((s) => {
        const x = s.meals.find((y) => y.id === m.id); if (!x) return;
        x.repairTried = true;
        if (prod && !prod.missing) { x.nutrients = BC.forGrams(prod.per100, grams); fixed++; }
      });
    } catch { /* hors ligne : on réessaiera */ }
  }
  return fixed;
}

// ---------- Recherche d'un produit du commerce par son nom (Open Food Facts) ----------
export function openProductSearch(ctx, slot = null, q0 = '') {
  const body = sheet(`
    <div class="row" style="flex-wrap:nowrap"><input id="pq" type="search" placeholder="ex. Kit Kat, yaourt Danone, Coca zéro…" autocomplete="off" value="${esc(q0)}"><button class="btn" id="pgo" aria-label="Chercher">${icon('search', 18)}</button></div>
    <div id="pres" style="margin-top:10px"></div>
    <div id="pdet"></div>
    <p class="tiny muted" style="text-align:center;margin-top:12px">Base Open Food Facts : plus de 3 millions de produits (ODbL)</p>`, { title: 'Chercher un produit', full: true, onClose: () => ctx.render() });
  const res = $('#pres', body), det = $('#pdet', body);
  let list = [], ctrl = null, timer = 0;
  const showList = () => { det.innerHTML = ''; res.hidden = false; $('#pq', body).parentElement.hidden = false; };
  const run = async () => {
    const q = $('#pq', body).value.trim();
    if (q.length < 2) { res.innerHTML = '<p class="small muted">Tape au moins 2 lettres.</p>'; return; }
    ctrl?.abort(); ctrl = new AbortController();
    res.innerHTML = '<div class="empty"><span class="spinner"></span><p>Recherche…</p></div>';
    try {
      list = await BC.search(q, { signal: ctrl.signal });
      res.innerHTML = list.length ? list.map((p, i) => `<button class="list-item prod-hit" data-pi="${i}">
          ${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="" loading="lazy">` : `<span class="thumb">${icon('barcode')}</span>`}
          <div style="min-width:0;text-align:left"><div class="small" style="font-weight:600">${esc(p.name)}</div><div class="tiny muted">${esc([p.brand.split(',')[0], p.quantity].filter(Boolean).join(' · '))}</div></div>
          <div class="tiny" style="text-align:right;white-space:nowrap">${p.missing ? '<span class="muted">valeurs ?</span>' : `<b>${fmt(p.per100.kcal)}</b> kcal<br><span class="muted">/100 g</span>`}${p.nutriscore ? `<div><span class="ns" style="background:${BC.NUTRI_COLORS[p.nutriscore]}">${p.nutriscore.toUpperCase()}</span></div>` : ''}</div>
        </button>`).join('')
        : '<p class="small muted">Aucun produit trouvé. Essaie avec la marque (ex. « kinder bueno »).</p>';
    } catch (e) {
      if (e.name !== 'AbortError') { res.innerHTML = `<div class="note warn">${icon('alert', 18)}<span>${esc(e.message)}</span></div><button class="btn ghost block" id="pretry" style="margin-top:8px">${icon('refresh', 16)} Réessayer</button>`; $('#pretry', res).onclick = run; }
    }
  };
  $('#pq', body).oninput = () => { clearTimeout(timer); if ($('#pq', body).value.trim().length >= 3) timer = setTimeout(run, 900); };
  $('#pq', body).onkeydown = (e) => { if (e.key === 'Enter') { clearTimeout(timer); run(); e.target.blur(); } };
  $('#pgo', body).onclick = () => { clearTimeout(timer); run(); };
  res.onclick = (e) => {
    const b = e.target.closest('[data-pi]'); if (!b) return;
    const p = list[Number(b.dataset.pi)];
    res.hidden = true; $('#pq', body).parentElement.hidden = true;
    productCard(det, p, p.serving || 100, body, slot || C.currentSlot(), showList);
    body.scrollTop = 0;
  };
  if (q0) run(); else setTimeout(() => $('#pq', body).focus(), 300);
}

// ---------- Ajout rapide sans IA : mes plats, repas récents, bibliothèque de plats équilibrés ----------
export function openQuickMeal(ctx, slot = null) {
  const st = store.get();
  const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const seen = new Set();
  const pool = [
    ...(st.dishes || []).map((d) => ({ name: d.name, n: d.nutrients, quality: d.quality, verdict: d.verdict, nova: d.nova, from: 'Mes plats' })),
    ...[...st.meals].reverse().filter((m) => !m.snack).map((m) => ({ name: m.title, n: m.nutrients, quality: m.quality, verdict: m.verdict, nova: m.nova, from: 'Récent' })),
    ...allowedMeals(st.profile.diet, st.profile.allergies).map((m) => ({ name: m.name, n: { kcal: m.kcal, protein: m.protein, fiber: m.fiber, fruitVeg: m.fruitVeg, carbs: 0, fat: 0, satFat: 0, sugar: 0, sodium: 0 }, quality: 75, verdict: 'bon', nova: 1, from: 'Idée' })),
  ].filter((x) => x.n && !seen.has(norm(x.name)) && seen.add(norm(x.name)));
  const body = sheet(`
    <p class="small muted" style="margin-top:0">L’analyse photo demande une clé IA (gratuite avec Google Gemini, voir Profil). En attendant, retrouve ton repas ici :</p>
    <input id="q" placeholder="Rechercher : pâtes, salade, omelette…" autocomplete="off">
    <div id="list" style="margin-top:8px"></div>
    <button class="btn soft block" id="off" style="margin-top:12px">${icon('search', 18)} Chercher un produit du commerce</button>
    <div class="grid2" style="margin-top:8px"><button class="btn ghost" id="scan">${icon('barcode', 18)} Code-barres</button><button class="btn ghost" id="manual">${icon('pencil', 18)} Manuel</button></div>`, { title: 'Ajouter un repas', full: true, onClose: () => ctx.render() });
  const draw = () => {
    const q = norm($('#q', body).value.trim());
    const res = pool.filter((x) => !q || q.split(/\s+/).every((w) => norm(x.name).includes(w))).slice(0, 30);
    $('#list', body).innerHTML = res.length ? res.map((x, i) => `<div class="qm" data-i="${pool.indexOf(x)}"><div style="flex:1;min-width:0"><div class="small" style="font-weight:600">${esc(x.name)}</div><div class="tiny muted">${x.from} · ${fmt(x.n.kcal)} kcal</div></div>
      <div class="qm-por">${[0.5, 1, 1.5, 2].map((k) => `<button class="chip" data-k="${k}">${k === 0.5 ? '½' : k === 1.5 ? '1½' : k}</button>`).join('')}</div></div>`).join('')
      : `<p class="small muted">Rien dans tes plats : c’est un produit du commerce ? Touche « Chercher un produit du commerce ».</p>`;
  };
  draw();
  $('#q', body).oninput = draw;
  $('#list', body).onclick = (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const x = pool[Number(b.closest('[data-i]').dataset.i)], k = Number(b.dataset.k);
    addMeal({ title: x.name, nutrients: Object.fromEntries(Object.entries(x.n).map(([a, v]) => [a, Math.round((v || 0) * k * 10) / 10])), quality: x.quality ?? 70, verdict: x.verdict || 'moyen', nova: x.nova || 1, ...(slot ? { slot } : {}) });
    body.close();
  };
  $('#scan', body).onclick = () => { body.close(); setTimeout(() => ctx.action('scan'), 250); };
  $('#off', body).onclick = () => { const q = $('#q', body).value.trim(); body.close(); setTimeout(() => openProductSearch(ctx, slot, q), 250); };
  $('#manual', body).onclick = () => { body.close(); setTimeout(() => openManual(ctx), 250); };
}

// ---------- Saisie manuelle ----------
export function openManual(ctx) {
  const body = sheet(`
    <label class="lbl">Nom du repas</label><input id="m-title" placeholder="ex. Sandwich jambon-beurre">
    <div class="grid3">
      ${[['kcal', 'Calories'], ['protein', 'Protéines g'], ['fiber', 'Fibres g'], ['sugar', 'Sucres g'], ['fruitVeg', 'Légumes g'], ['sodium', 'Sodium mg']].map(([k, l]) => `<div><label class="lbl">${l}</label><input id="m-${k}" type="number" inputmode="decimal"></div>`).join('')}
    </div>
    <label class="lbl">Niveau de transformation</label>
    <select id="m-nova"><option value="1">Brut / fait maison</option><option value="3">Transformé (fromage, pain…)</option><option value="4">Ultra-transformé (plat industriel, soda, biscuits…)</option></select>
    <button class="btn block" id="m-save" style="margin-top:16px">Ajouter</button>`, { title: 'Repas manuel', onClose: () => ctx.render() });
  $('#m-save', body).onclick = () => {
    const v = (id) => Number($('#m-' + id, body).value) || 0;
    const title = $('#m-title', body).value.trim();
    if (!title) return toast('Donne un nom au repas');
    addMeal({ title, nutrients: { kcal: v('kcal'), protein: v('protein'), fiber: v('fiber'), sugar: v('sugar'), fruitVeg: v('fruitVeg'), sodium: v('sodium'), carbs: 0, fat: 0, satFat: 0 }, nova: Number($('#m-nova', body).value) });
    body.close();
  };
}

// ---------- Sommeil ----------
export function openSleep(ctx) {
  if (store.get().sleepNow) {
    const r = SL.wakeUp();
    ctx.syncWidget?.();
    if (!r || r.tooShort) { toast('Moins d’une heure : nuit non enregistrée'); return ctx.render(); }
    return showMorning(ctx, r);
  }
  goodNight(ctx);
}

// Résumé du matin (bouton, widget ou détection automatique).
export function showMorning(ctx, r) {
    const h = r.sleepMinutes / 60;
    const t = store.get().profile;
    const verdict = h >= 7 && h <= 9 ? ['good', 'Durée idéale (7–9 h).'] : h < 7 ? ['warn', 'Nuit courte : évite les efforts intenses, pas de café après 15 h, sieste ≤ 20 min avant 15 h si besoin.'] : ['warn', 'Nuit longue : si tu te sens fatigué malgré tout, parles-en à un médecin.'];
    const body = sheet(`
      <div class="sleep-card" style="margin-top:0">
        <div class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Ta nuit</div>
        <div class="big">${Math.floor(h)} h ${String(r.sleepMinutes % 60).padStart(2, '0')}</div>
        <div class="small muted">${r.bed} → ${r.wake} · ${fmtMin(r.inBedMin)} au lit, ~${SL.LATENCY_MIN} min d’endormissement estimées</div>
        ${r.source && r.source !== 'bouton' ? `<div class="small" style="margin-top:6px;color:#a5b4fc">${icon('sparkles', 14)} Réveil détecté automatiquement (${r.source === 'alarme' ? 'sonnerie de ton alarme' : r.source === 'téléphone' ? 'premier déverrouillage du matin' : esc(r.source)})${r.nightWakes ? ` · ${r.nightWakes} réveil(s) nocturne(s) avec le téléphone` : ''}</div>` : ''}
      </div>
      <div class="note ${verdict[0]}">${icon('info', 18)}<span>${verdict[1]} Ouvre les volets et prends la lumière du jour dans l’heure qui suit ton réveil.</span></div>
      ${srcLinks(['watson2015', 'ohayon2017', 'burns2023'])}
      <label class="lbl">Comment as-tu dormi ?</label>${faces('sleepQuality', null)}
      <label class="lbl">Et ton humeur ce matin ?</label>${faces('mood', store.getDay(r.key).mood)}
      <label class="lbl">Ton énergie ?</label>${faces('energy', store.getDay(r.key).energy)}
      <button class="btn block" style="margin-top:16px" data-done>C’est noté</button>`, { title: 'Bonjour ☀︎', onClose: () => ctx.render() });
    bindFaces(body, (f, v) => store.setDay(r.key, { [f]: v }));
    store.update((s) => { s.moodAsked = r.key; });
    $('[data-done]', body).onclick = () => body.close();
}

// Le matin, sans détection automatique possible : on demande l'heure de réveil (préremplie).
export function askWakeTime(ctx) {
  const st = store.get();
  const now = new Date();
  const [wh, wm] = st.profile.wakeTime.split(':').map(Number);
  const target = new Date(now); target.setHours(wh, wm, 0, 0);
  const guess = target < now && now - target < 3 * 3600e3 ? target : now;
  const body = sheet(`
    <p class="small muted" style="margin-top:0">Ta nuit est en cours depuis ${new Date(st.sleepNow).toTimeString().slice(0, 5)}. À quelle heure t’es-tu ${st.profile.sex === 'f' ? 'réveillée' : 'réveillé'} ?</p>
    <input type="time" id="wk" value="${guess.toTimeString().slice(0, 5)}">
    <button class="btn block" id="ok" style="margin-top:14px">${icon('sun', 18)} Valider</button>
    <p class="tiny muted">Dans l’application Android, avec l’accès « données d’utilisation », le réveil est détecté automatiquement (sonnerie de l’alarme ou premier déverrouillage).</p>`, { title: 'Bonjour' });
  $('#ok', body).onclick = () => {
    const [h, m] = $('#wk', body).value.split(':').map(Number);
    const w = new Date(); w.setHours(h, m, 0, 0);
    if (w > new Date()) w.setDate(w.getDate() - 1);
    const r = SL.recordNight(new Date(st.sleepNow), w, { source: 'saisie' });
    ctx.syncWidget?.();
    body.close();
    if (!r.tooShort) setTimeout(() => showMorning(ctx, r), 250);
  };
}

// Un seul appui : la nuit commence, sans menu.
function goodNight(ctx) {
  SL.goToBed();
  ctx.syncWidget?.();
  ctx.scheduleMorning?.();
  const moon = document.createElement('div');
  moon.className = 'float-up';
  moon.style.cssText = 'left:50%;top:40%;font-size:3rem;transform:translateX(-50%)';
  moon.textContent = '🌙';
  document.body.appendChild(moon);
  setTimeout(() => moon.remove(), 900);
  toast(`Bonne nuit 🌙 Coucher noté à ${new Date().toTimeString().slice(0, 5)}`, 3000);
  ctx.render();
}

// Les meilleures conditions pour dormir (bouton ⓘ).
export function goodNightTips() {
  const env = store.get().env;
  const p = store.get().profile;
  const tips = [
    ['clock', `Même heure de coucher et de lever chaque jour (±30 min), week-end compris : ici ${p.bedTime} → ${p.wakeTime}.`, ['windred2024', 'phillips2017']],
    ['phone', 'Écrans coupés 1 h avant, téléphone hors de la chambre (ou face cachée, en mode avion).', ['exelmans2016', 'chang2015']],
    ['moon', 'Chambre sombre, calme et fraîche (≈ 16–19 °C).' + (env?.tMin >= 20 ? ` Nuit chaude annoncée (${Math.round(env.tMin)} °C) : aère et utilise un ventilateur.` : ''), ['obradovich2017']],
    ['coffee', 'Pas de caféine dans les 8 h avant le coucher, pas d’alcool le soir (il fragmente le sommeil).', ['gardiner2023', 'ebrahim2013']],
    ['utensils', 'Dîner léger au moins 3 h avant de dormir.', ['garaulet2013']],
    ['dumbbell', 'Sport régulier dans la journée, mais pas d’effort intense dans l’heure qui précède le coucher.', ['stutz2019']],
    ['sun', 'Lumière du jour le matin, lumière tamisée le soir : c’est ce qui règle ton horloge interne.', ['burns2023']],
    ['brain', 'Pas sommeil au bout de ~20 min ? Lève-toi, activité calme sous lumière faible, puis recouche-toi.', ['ohayon2017']],
  ];
  sheet(`${tips.map(([ic, t, src]) => `<div class="list-item" style="grid-template-columns:auto minmax(0,1fr)"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-sleep) 15%,transparent);color:var(--c-sleep)">${icon(ic, 18)}</span><div><div class="small">${esc(t)}</div>${srcLinks(src)}</div></div>`).join('')}
    <p class="tiny muted">${N.isNative ? 'Le compteur s’arrête tout seul quand tu déverrouilles ton téléphone le matin (ou à la sonnerie de l’alarme).' : 'Appuie sur « Je suis réveillé » le matin.'}</p>`, { title: 'Bien dormir' });
}

// ---------- Toilettes (échelle de Bristol) ----------
const BRISTOL_COLORS = ['#7c2d12', '#9a3412', '#b45309', '#a16207', '#ca8a04', '#d97706', '#f59e0b'];
export function openStool(ctx) {
  const entry = { bristol: null, pain: 0, bloating: 0, urgency: false, blood: false };
  const body = sheet(`
    <p class="small muted" style="margin-top:0">Échelle de Bristol : elle reflète ton temps de transit. Les repas des 8 à 48 h précédentes sont croisés pour repérer les aliments mal tolérés.</p>
    <label class="lbl">Aspect</label>
    <div class="bristol">${D.BRISTOL.map((b) => `<button data-b="${b.type}" aria-label="Type ${b.type} : ${b.label}">${b.type}<i style="background:${BRISTOL_COLORS[b.type - 1]}"></i></button>`).join('')}</div>
    <div id="b-desc" class="small muted" style="margin-top:8px;min-height:2.6em">Choisis le type qui correspond le mieux.</div>
    <label class="lbl">Douleurs / crampes</label>${scale('pain', null, ['Aucune', 'Légères', 'Modérées', 'Fortes', 'Intenses'])}
    <label class="lbl">Ballonnements</label>${scale('bloating', null, ['Aucun', 'Légers', 'Modérés', 'Forts', 'Intenses'])}
    <label class="between" style="margin-top:14px;flex-wrap:nowrap"><span class="small">Besoin urgent</span><span class="switch"><input type="checkbox" id="urg"><span></span></span></label>
    <label class="between" style="margin-top:10px;flex-wrap:nowrap"><span class="small">Présence de sang</span><span class="switch"><input type="checkbox" id="blood"><span></span></span></label>
    <label class="lbl">Heure</label><input type="time" id="at" value="${new Date().toTimeString().slice(0, 5)}">
    <button class="btn block" style="margin-top:16px" id="save" disabled>Enregistrer</button>
    ${srcLinks(['lewis1997', 'heaton1992', 'asnicar2021'])}`, { title: 'Passage aux toilettes', onClose: () => ctx.render() });
  $$('[data-b]', body).forEach((b) => (b.onclick = () => {
    entry.bristol = Number(b.dataset.b);
    $$('[data-b]', body).forEach((x) => x.classList.toggle('on', x === b));
    const info = D.BRISTOL[entry.bristol - 1];
    $('#b-desc', body).innerHTML = `<b>Type ${info.type} — ${info.label}.</b> <span class="muted">${info.meaning}.</span>`;
    $('#save', body).disabled = false;
  }));
  $$('.scale', body).forEach((sc) => sc.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    entry[sc.dataset.field] = Number(b.dataset.v) - 1;
    $$('button', sc).forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('#save', body).onclick = () => {
    const [h, m] = $('#at', body).value.split(':').map(Number);
    const at = new Date(); at.setHours(h, m, 0, 0);
    store.update((s) => s.stools.push({ id: crypto.randomUUID(), at: at.toISOString(), ...entry, urgency: $('#urg', body).checked, blood: $('#blood', body).checked }));
    if ($('#blood', body).checked) toast('Sang signalé : consulte un médecin rapidement', 5000);
    else toast('Enregistré');
    body.close();
  };
}

// ---------- Ticket de caisse ----------
export async function openReceipt(ctx) {
  const st = store.get();
  const [file] = await pickImage({ camera: true });
  if (!file) return;
  const dataUrl = await compressImage(file, 2000, 0.85);
  const body = sheet(`<div id="rc"><div class="empty"><span class="spinner"></span><p>Lecture du ticket…</p></div></div>`, { title: 'Ticket de caisse', full: true, onClose: () => ctx.render() });
  const el = $('#rc', body);
  try {
    const r = await AI.readReceipt(st.settings, dataUrl);
    if (!r.is_receipt || !r.items.length) throw new Error('Je ne trouve pas d’articles sur cette photo. Reprends le ticket bien à plat et éclairé.');
    const stats = PT.basketStats(r.items);
    const adv = PT.basketAdvice(stats);
    const col = stats.score >= 65 ? 'var(--good)' : stats.score >= 45 ? 'var(--warn)' : 'var(--bad)';
    el.innerHTML = `
      <div class="between"><div><b>${esc(r.store || 'Magasin')}</b><div class="tiny muted">${esc(r.date || '')} · ${r.items.length} articles${r.total ? ` · ${fmt(r.total, 2)} €` : ''}</div></div>
        <div style="text-align:right"><div style="font-size:1.6rem;font-weight:800;color:${col}">${stats.score}<small style="font-size:.8rem;color:var(--muted)">/100</small></div><div class="tiny muted">qualité du panier</div></div></div>
      <div class="kpi-row" style="margin:12px 0">
        <div class="stat"><div class="k">Fruits & légumes</div><div class="v">${Math.round(stats.fruitVeg * 100)}<small>%</small></div></div>
        <div class="stat"><div class="k">Ultra-transformés</div><div class="v">${Math.round(stats.upf * 100)}<small>%</small></div></div>
        <div class="stat"><div class="k">Sucrés / sodas</div><div class="v">${Math.round((stats.sweets + stats.sugaryDrinks) * 100)}<small>%</small></div></div>
      </div>
      ${adv.map((a) => `<div class="note ${a.level === 'bon' ? 'good' : a.level === 'alerte' ? 'bad' : 'warn'}" style="margin:8px 0">${icon(a.level === 'bon' ? 'ok' : 'alert', 16)}<span>${esc(a.text)}</span></div>`).join('')}
      ${srcLinks(['parker2020', 'perry2024'])}
      <h3 style="font-size:.95rem;margin:16px 0 6px">Articles reconnus</h3>
      <table>${r.items.map((i) => `<tr><td>${esc(i.name)}<div class="tiny muted">${esc(i.raw)}</div></td><td class="num">${fmt(i.qty)} ${esc(i.unit)}</td><td class="num"><span class="badge ${i.nova >= 4 ? 'a_limiter' : i.nova === 3 ? 'moyen' : 'bon'}">NOVA ${i.nova}</span></td></tr>`).join('')}</table>
      <button class="btn block" id="add" style="margin-top:14px">${icon('plus', 18)} Ajouter au garde-manger</button>`;
    $('#add', el).onclick = () => {
      const date = r.date || store.today();
      store.update((s) => {
        s.pantry = PT.addToPantry(s.pantry, r.items, date);
        s.receipts.push({ id: crypto.randomUUID(), date, store: r.store, total: r.total, n: r.items.length, stats });
      });
      toast('Garde-manger mis à jour');
      body.close();
    };
  } catch (e) {
    el.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(AI.friendlyError(e))}</span></div>`;
  }
}

// ---------- Grignotages : ajout en un geste ----------
export function openSnack(ctx) {
  let qty = 1, reason = null;
  const body = sheet(`<div id="sn"></div>`, { title: 'Grignotage', onClose: () => ctx.render() });
  const el = $('#sn', body);
  const draw = () => {
    const today = store.mealsOn().filter((m) => m.snack);
    const kcal = today.reduce((a, m) => a + (m.nutrients?.kcal || 0), 0);
    el.innerHTML = `
      <div class="between small muted" style="margin-bottom:8px"><span>Aujourd’hui : <b style="color:var(--text)">${today.length}</b> grignotage(s) · ${fmt(kcal)} kcal</span>
        <div class="stepper" style="width:118px"><button data-q="-1" aria-label="Moins">−</button><input value="×${qty}" readonly aria-label="Quantité"><button data-q="1" aria-label="Plus">+</button></div></div>
      <div class="chips">${SN.REASONS.map(([k, l]) => `<button class="chip ${reason === k ? 'on' : ''}" data-r="${k}">${l}</button>`).join('')}</div>
      <div class="snack-grid">${SN.SNACKS.map((s) => `<button data-s="${s.id}" class="${s.ok ? 'ok' : ''}"><span class="em">${s.emoji}</span><b>${esc(s.label)}</b><span>${Math.round(s.n.kcal * qty)} kcal</span></button>`).join('')}</div>
      ${today.length ? `<div class="list" style="margin-top:10px">${today.map((m) => `<div class="between small" style="padding:8px 0;border-top:1px solid var(--line)"><span>${esc(m.time)} · ${esc(m.title)}</span><button class="icon-btn" data-del="${m.id}" aria-label="Retirer">${icon('x', 14)}</button></div>`).join('')}</div>` : ''}
      <div class="grid2" style="margin-top:10px"><button class="btn soft" id="snap">${icon('camera', 18)} Photo</button><button class="btn ghost" id="other">${icon('barcode', 18)} Scanner</button></div>`;
    $$('[data-q]', el).forEach((b) => (b.onclick = () => { qty = Math.max(1, Math.min(5, qty + Number(b.dataset.q))); draw(); }));
    $$('[data-r]', el).forEach((b) => (b.onclick = () => { reason = reason === b.dataset.r ? null : b.dataset.r; draw(); }));
    $$('[data-s]', el).forEach((b) => (b.onclick = () => {
      const s = SN.snackById(b.dataset.s);
      const nutrients = Object.fromEntries(Object.entries(s.n).map(([k, v]) => [k, Math.round(v * qty * 10) / 10]));
      addMeal({ title: `${s.label}${qty > 1 ? ` ×${qty}` : ''}`, nutrients, nova: s.nova, snack: true, snackId: s.id, reason, verdict: s.ok ? 'bon' : s.nova >= 4 ? 'a_limiter' : 'moyen', quality: s.ok ? 80 : s.nova >= 4 ? 30 : 50, alcohol: s.alcohol ? qty : 0 });
      navigator.vibrate?.(15);
      qty = 1;
      draw();
    }));
    $$('[data-del]', el).forEach((b) => (b.onclick = () => { store.update((x) => (x.meals = x.meals.filter((m) => m.id !== b.dataset.del))); draw(); }));
    $('#other', el).onclick = () => { body.close(); setTimeout(() => openScanner(ctx, 'grignotage'), 250); };
    $('#snap', el).onclick = () => { body.close(); setTimeout(() => openPhoto(ctx, false, 'grignotage'), 250); };
  };
  draw();
}
