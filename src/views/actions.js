// Actions globales ouvertes en feuille modale : menu « + », photo d'assiette, scanner, check-in, saisie manuelle.
import * as store from '../store.js';
import * as C from '../coach.js';
import * as AI from '../ai.js';
import * as BC from '../barcode.js';
import { summary, personContext } from '../context.js';
import { icon, esc, fmt, sheet, toast, compressImage, pickImage, srcLinks, $, $$ } from '../ui.js';
import * as SL from '../sleep.js';
import * as N from '../native.js';
import * as D from '../digestion.js';
import * as PT from '../pantry.js';

const VERDICT = { bon: 'Bon pour toi', moyen: 'Moyen', a_limiter: 'À limiter' };

export function addMeal(m) {
  const now = new Date();
  store.update((s) => s.meals.push({ id: crypto.randomUUID(), date: store.today(), time: now.toTimeString().slice(0, 5), slot: C.currentSlot(now), ...m }));
  toast('Repas enregistré ✅');
}

export function openAddMenu(ctx) {
  const body = sheet(`
    <div class="action-grid">
      ${[
        ['photo', 'camera', 'var(--c-food)', 'Photo de l’assiette', 'L’IA estime calories et nutriments'],
        ['scan', 'barcode', 'var(--c-move)', 'Scanner un produit', 'Nutri-Score, additifs, NOVA'],
        ['checkin', 'smile', 'var(--c-mood)', 'Check-in', 'Humeur, énergie, sommeil'],
        ['sync', 'refresh', 'var(--c-screen)', 'Synchroniser', 'Pas, sommeil, temps d’écran'],
        ['manual', 'pencil', 'var(--c-sleep)', 'Repas manuel', 'Saisie rapide'],
        ['receipt', 'receipt', 'var(--c-food)', 'Ticket de caisse', 'Remplir le garde-manger'],
        ['stool', 'activity', 'var(--c-move)', 'Passage aux toilettes', 'Transit & tolérance'],
        ['workout', 'dumbbell', 'var(--c-move)', 'Séance de sport', 'Chrono ou saisie'],
        ['sleep', 'moon', 'var(--c-sleep)', store.get().sleepNow ? 'Je suis réveillé' : 'Je vais dormir', 'Noter le coucher / réveil'],
        ['menus', 'calendar', 'var(--primary)', 'Menus de la semaine', 'Et liste de courses'],
      ].map(([a, ic, col, t, s]) => `<button class="action" data-a="${a}"><span class="icon-badge" style="background:color-mix(in srgb,${col} 16%,transparent);color:${col}">${icon(ic)}</span><b>${t}</b><span>${s}</span></button>`).join('')}
    </div>`, { title: 'Ajouter' });
  $$('[data-a]', body).forEach((b) => (b.onclick = () => { body.close(); setTimeout(() => ctx.action(b.dataset.a), 200); }));
}

// ---------- Check-in ----------
const MOODS = ['Très bas', 'Bas', 'Neutre', 'Bon', 'Très bon'];
export function scale(field, value, labels = MOODS) {
  return `<div class="scale" data-field="${field}">${labels.map((l, i) => `<button type="button" class="${value === i + 1 ? 'on' : ''}" data-v="${i + 1}" aria-label="${l}">${i + 1}<small>${l}</small></button>`).join('')}</div>`;
}

export function openCheckin(ctx) {
  const d = store.getDay();
  const body = sheet(`
    <label class="lbl">Comment te sens-tu ?</label>${scale('mood', d.mood)}
    <label class="lbl">Énergie</label>${scale('energy', d.energy, ['Épuisé', 'Fatigué', 'Moyen', 'En forme', 'Plein'])}
    <label class="lbl">Stress</label>${scale('stress', d.stress, ['Zen', 'Calme', 'Moyen', 'Tendu', 'Très tendu'])}
    <div class="grid2">
      <div><label class="lbl">Couché à</label><input type="time" data-f="bed" value="${esc(d.bed || '')}"></div>
      <div><label class="lbl">Levé à</label><input type="time" data-f="wake" value="${esc(d.wake || '')}"></div>
    </div>
    <label class="lbl">Qualité du sommeil</label>${scale('sleepQuality', d.sleepQuality, ['Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Excellent'])}
    <button class="btn block" style="margin-top:18px" data-done>Enregistrer</button>`, { title: 'Check-in du jour', onClose: () => ctx.render() });
  $$('.scale', body).forEach((sc) => sc.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    store.setDay(store.today(), { [sc.dataset.field]: Number(b.dataset.v) });
    $$('button', sc).forEach((x) => x.classList.toggle('on', x === b));
  }));
  $$('input[data-f]', body).forEach((inp) => inp.addEventListener('change', () => store.setDay(store.today(), { [inp.dataset.f]: inp.value })));
  $('[data-done]', body).onclick = () => { body.close(); toast('Check-in enregistré'); };
}

// ---------- Photo d'assiette ----------
export async function openPhoto(ctx, fromGallery = false) {
  const st = store.get();
  const [file] = await pickImage({ camera: !fromGallery });
  if (!file) return;
  const dataUrl = await compressImage(file);
  const body = sheet(`<img class="preview" src="${dataUrl}" alt=""><div id="res" style="margin-top:14px">
      <label class="lbl">Une précision ? (facultatif)</label><input id="note" placeholder="ex. sauce à la crème, moitié mangée…">
      <button class="btn block" id="go" style="margin-top:12px">${icon('sparkles', 18)} Analyser ce repas</button>
      ${!st.settings.apiKey ? `<div class="note warn" style="margin-top:12px">${icon('key', 18)}<span>Ajoute ta clé API Anthropic dans Profil pour activer l’analyse photo.</span></div>` : ''}
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
      showResult(res, { ...r, thumb, factor: 1 }, body);
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
    <p class="tiny muted">Sucres ${fmt(n.sugar)} g · graisses saturées ${fmt(n.satFat)} g · sodium ${fmt(n.sodium)} mg · NOVA ${p.nova} · confiance ${esc(p.confidence)}</p>
    <label class="lbl">Portion réellement mangée : <b>${Math.round(p.factor * 100)} %</b></label>
    <input type="range" id="factor" min="0.25" max="2" step="0.05" value="${p.factor}">
    <button class="btn block" id="save" style="margin-top:14px">${icon('check', 18)} Enregistrer ce repas</button>`;
  $('#factor', res).onchange = (e) => showResult(res, { ...p, factor: Number(e.target.value) }, body);
  $('#save', res).onclick = () => {
    addMeal({ title: p.title, nutrients: n, items: p.items, nova: p.nova, quality: p.quality, verdict: p.verdict, comment: p.comment, advice: p.advice, thumb: p.thumb });
    body.close();
  };
}

// ---------- Scanner code-barres ----------
export function openScanner(ctx) {
  let stop = () => {};
  const body = sheet(`
    <div class="scanner"><video muted playsinline></video><div class="frame"></div><div class="laser"></div></div>
    <p class="small muted" style="text-align:center">Vise le code-barres du produit</p>
    <div class="row" style="flex-wrap:nowrap"><input id="code" inputmode="numeric" placeholder="ou tape le code (EAN)"><button class="btn" id="lookup">${icon('arrow', 18)}</button></div>
    <div id="prod" style="margin-top:14px"></div>`, { title: 'Scanner un produit', full: true, onClose: () => { stop(); ctx.render(); } });
  const show = async (code) => {
    stop();
    $('.scanner', body).style.display = 'none';
    const out = $('#prod', body);
    out.innerHTML = `<div class="empty"><span class="spinner"></span><p>Recherche dans Open Food Facts…</p></div>`;
    try {
      const prod = await BC.lookup(code);
      if (!prod) { out.innerHTML = `<div class="note warn">${icon('info', 18)}<span>Produit ${esc(code)} introuvable dans Open Food Facts. Tu peux le photographier pour une analyse IA.</span></div>`; return; }
      productCard(out, prod, prod.serving || 100, body);
    } catch (e) {
      out.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(e.message)}</span></div>`;
    }
  };
  $('#lookup', body).onclick = () => { const c = $('#code', body).value.replace(/\D/g, ''); if (c.length >= 8) show(c); };
  BC.startScanner($('video', body), show).then((s) => (stop = s)).catch(() => {
    $('.scanner', body).innerHTML = `<div class="empty" style="color:#fff">${icon('camera', 28)}<p>Caméra indisponible. Autorise l’accès à la caméra ou saisis le code.</p></div>`;
  });
}

function nutriBadge(g) {
  return `<span class="nutri" aria-label="Nutri-Score ${g ? g.toUpperCase() : 'inconnu'}">${'abcde'.split('').map((l) => `<span class="${l === g ? 'on' : ''}" style="background:${BC.NUTRI_COLORS[l]}">${l.toUpperCase()}</span>`).join('')}</span>`;
}
const NOVA_COLORS = { 1: '#038141', 2: '#fecb02', 3: '#ee8100', 4: '#e63e11' };
const NOVA_LABEL = { 1: 'Brut / peu transformé', 2: 'Ingrédient culinaire', 3: 'Transformé', 4: 'Ultra-transformé' };

function productCard(out, prod, grams, body) {
  const sm = summary();
  const v = BC.verdict(prod, grams, { targets: sm.t, totToday: sm.totToday, profile: store.get().profile });
  const n = v.n;
  out.innerHTML = `
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
    <label class="lbl">Quantité consommée</label>
    <div class="row" style="flex-wrap:nowrap">
      <div class="stepper" style="flex:1"><button data-d="-10">−</button><input id="grams" type="number" inputmode="decimal" value="${grams}"><button data-d="10">+</button></div>
      <span class="muted">g${prod.serving ? ` · portion ${prod.serving} g` : ''}</span>
    </div>
    <table style="margin-top:12px"><tr><th></th><th class="num">pour ${fmt(grams)} g</th><th class="num">100 g</th></tr>
      ${[['Calories', 'kcal', 'kcal'], ['Protéines', 'protein', 'g'], ['Glucides', 'carbs', 'g'], ['dont sucres', 'sugar', 'g'], ['Lipides', 'fat', 'g'], ['dont saturés', 'satFat', 'g'], ['Fibres', 'fiber', 'g'], ['Sodium', 'sodium', 'mg']]
        .map(([l, k, u]) => `<tr><td>${l}</td><td class="num"><b>${fmt(n[k], k === 'kcal' || k === 'sodium' ? 0 : 1)}</b> ${u}</td><td class="num muted">${fmt(prod.per100[k], 1)}</td></tr>`).join('')}
    </table>
    ${prod.additives.length ? `<h3 style="font-size:.95rem;margin:16px 0 6px">Additifs (${prod.additives.length})</h3>
      ${prod.additives.map((a) => `<div class="small" style="margin:6px 0"><span class="badge ${a.level === 'eleve' ? 'a_limiter' : a.level === 'moyen' ? 'moyen' : 'neutral'}">${esc(a.id)}</span> ${esc(a.name)} <span class="muted">${esc(a.note)}</span></div>`).join('')}` : '<p class="small" style="color:var(--good)">✓ Aucun additif</p>'}
    ${prod.allergens.length ? `<p class="small muted">Allergènes : ${esc(prod.allergens.join(', '))}</p>` : ''}
    <button class="btn block" id="add" style="margin-top:14px">${icon('plus', 18)} Ajouter à mes repas</button>
    <p class="tiny muted" style="text-align:center">Données : Open Food Facts (ODbL)</p>`;
  const g = () => Math.max(1, Number($('#grams', out).value) || 0);
  $('#grams', out).onchange = () => productCard(out, prod, g(), body);
  $$('[data-d]', out).forEach((b) => (b.onclick = () => productCard(out, prod, Math.max(5, g() + Number(b.dataset.d)), body)));
  $('#add', out).onclick = () => {
    addMeal({ title: `${prod.name}${prod.brand ? ' – ' + prod.brand.split(',')[0] : ''} (${g()} g)`, nutrients: n, nova: prod.nova || 3, quality: v.score, verdict: v.verdict, nutriscore: prod.nutriscore, barcode: prod.code, thumb: prod.image, comment: [...v.pros, ...v.cons].join(' · ') });
    body.close();
  };
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
        <div class="small muted">${r.bed} → ${r.wake} · ${Math.round(r.inBedMin / 6) / 10} h au lit, ~${SL.LATENCY_MIN} min d’endormissement estimées</div>
        ${r.source && r.source !== 'bouton' ? `<div class="small" style="margin-top:6px;color:#a5b4fc">${icon('sparkles', 14)} Réveil détecté automatiquement (${r.source === 'alarme' ? 'sonnerie de ton alarme' : r.source === 'téléphone' ? 'premier déverrouillage du matin' : esc(r.source)})${r.nightWakes ? ` · ${r.nightWakes} réveil(s) nocturne(s) avec le téléphone` : ''}</div>` : ''}
      </div>
      <div class="note ${verdict[0]}">${icon('info', 18)}<span>${verdict[1]} Ouvre les volets et prends la lumière du jour dans l’heure qui suit ton réveil.</span></div>
      ${srcLinks(['watson2015', 'ohayon2017', 'burns2023'])}
      <label class="lbl">Comment as-tu dormi ?</label>${scale('sleepQuality', null, ['Très mal', 'Mal', 'Moyen', 'Bien', 'Très bien'])}
      <label class="lbl">Et ton énergie ce matin ?</label>${scale('energy', null, ['Épuisé', 'Fatigué', 'Moyen', 'En forme', 'Plein'])}
      <button class="btn block" style="margin-top:16px" data-done>C’est noté</button>`, { title: 'Bonjour ☀︎', onClose: () => ctx.render() });
    $$('.scale', body).forEach((sc) => sc.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      store.setDay(r.key, { [sc.dataset.field]: Number(b.dataset.v) });
      $$('button', sc).forEach((x) => x.classList.toggle('on', x === b));
    }));
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
    <p class="small muted" style="margin-top:0">Ta nuit est en cours depuis ${new Date(st.sleepNow).toTimeString().slice(0, 5)}. À quelle heure t’es-tu réveillé ?</p>
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

async function goodNight(ctx) {
  SL.goToBed();
  ctx.syncWidget?.();
  ctx.scheduleMorning?.();
  const env = store.get().env;
  const tips = [
    ['phone', 'Téléphone hors de la chambre (ou en mode avion, face cachée).', ['exelmans2016', 'chang2015']],
    ['moon', 'Chambre sombre, calme et fraîche (≈ 16–19 °C).' + (env?.tMin >= 20 ? ` Nuit chaude annoncée (${Math.round(env.tMin)} °C) : aère et utilise un ventilateur.` : ''), ['obradovich2017']],
    ['brain', 'Si tu ne dors pas au bout de ~20 min, lève-toi et fais quelque chose de calme sous lumière tamisée.', ['ohayon2017']],
    ['clock', `Réveil visé : ${store.get().profile.wakeTime}. Même heure demain, week-end compris.`, ['windred2024', 'phillips2017']],
  ];
  const body = sheet(`
    <div class="sleep-card" style="margin-top:0"><div class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Coucher noté</div><div class="big">${new Date().toTimeString().slice(0, 5)}</div><div class="small muted">${N.isNative ? 'Ton réveil sera détecté automatiquement (sonnerie de l’alarme ou premier déverrouillage). Sinon, appuie sur « Je suis réveillé ».' : 'Appuie sur « Je suis réveillé » demain matin.'}</div></div>
    ${tips.map(([ic, t, src]) => `<div class="list-item" style="grid-template-columns:auto 1fr"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-sleep) 15%,transparent);color:var(--c-sleep)">${icon(ic, 18)}</span><div><div class="small">${esc(t)}</div>${srcLinks(src)}</div></div>`).join('')}
    <button class="btn block" style="margin-top:12px" data-done>Bonne nuit</button>`, { title: 'Bonne nuit', onClose: () => ctx.render() });
  $('[data-done]', body).onclick = () => body.close();
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
