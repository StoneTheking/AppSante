import './styles.css';
import * as store from './store.js';
import * as S from './science.js';
import * as C from './coach.js';
import * as AI from './ai.js';
import { parseCSV, CSV_TEMPLATE } from './importer.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (x, d = 0) => (x == null || Number.isNaN(x) ? '—' : S.round(x, d).toLocaleString('fr-FR'));
const view = $('#view');
const TITLES = { today: "Aujourd'hui", meals: 'Repas', track: 'Suivi', future: 'Projection santé', coach: 'Coach IA', profile: 'Profil' };
let tab = 'today';

function toast(msg, ms = 3000) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.hidden = true), ms);
}

const srcLinks = (ids = []) =>
  ids.length ? `<div class="src">📚 ${ids.map((id) => S.SOURCES[id] && `<a href="${S.SOURCES[id].u}" target="_blank" rel="noopener">${esc(S.SOURCES[id].t.split(' – ')[0])}</a>`).filter(Boolean).join(' · ')}</div>` : '';

function summary() {
  const st = store.get();
  return C.summarize(st, store.lastDays(14));
}

// Contexte textuel transmis à l'IA (profil + 7 derniers jours + repas du jour).
function personContext(sm = summary()) {
  const { profile } = store.get();
  const st = store.get();
  const days = store.lastDays(7).map((k) => {
    const d = st.days[k] || {};
    const tot = S.sumNutrients(store.mealsOn(k));
    return `${k}: sommeil ${d.bed || '?'}→${d.wake || '?'} (qualité ${d.sleepQuality ?? '?'}/5), humeur ${d.mood ?? '?'}/5, énergie ${d.energy ?? '?'}/5, stress ${d.stress ?? '?'}/5, pas ${d.steps ?? '?'}, activité modérée ${d.modMin ?? 0} min, intense ${d.vigMin ?? 0} min, renfo ${d.strengthMin ?? 0} min, écran ${d.screenMin ?? '?'} min dont réseaux sociaux ${d.socialMin ?? '?'} min, téléphone au lit ${d.phoneInBed ? 'oui' : 'non'}, alcool ${d.alcohol ?? 0} verre(s), apports ${Math.round(tot.kcal)} kcal`;
  });
  const meals = store.mealsOn().map((m) => `${m.time} ${m.title} (${Math.round(m.nutrients?.kcal || 0)} kcal, prot ${Math.round(m.nutrients?.protein || 0)} g, fibres ${Math.round(m.nutrients?.fiber || 0)} g)`);
  return [
    `Date et heure : ${new Date().toLocaleString('fr-FR')}`,
    `Profil : ${profile.sex === 'f' ? 'femme' : 'homme'}, ${sm.body.age} ans, ${profile.height || '?'} cm, ${fmt(sm.body.weight, 1)} kg (IMC ${fmt(sm.body.bmi, 1)}, ${sm.body.bmiCat}), tour de taille ${profile.waist || '?'} cm, niveau d'activité ${profile.activityLevel}, objectif « ${profile.goal} », régime ${profile.diet}, allergies/aversions : ${profile.allergies || 'aucune'}, pathologies/traitements : ${profile.conditions || 'aucun déclaré'}, fumeur : ${profile.smoker ? 'oui' : 'non'}, sport préféré : ${profile.preferredSport || 'non précisé'}, réveil ${profile.wakeTime}, coucher ${profile.bedTime}.`,
    `Besoins estimés : métabolisme de base ${fmt(sm.body.bmr)} kcal, dépense ${fmt(sm.body.tdee)} kcal, cible ${sm.t.kcal} kcal, protéines ${sm.t.protein} g, fibres ${sm.t.fiber} g, sucres libres < ${sm.t.sugarMax} g, sodium < ${sm.t.sodiumMax} mg, fruits & légumes ≥ ${sm.t.fruitVeg} g.`,
    `Consommé aujourd'hui : ${Math.round(sm.totToday.kcal)} kcal, protéines ${Math.round(sm.totToday.protein)} g, fibres ${Math.round(sm.totToday.fiber)} g, sucres ${Math.round(sm.totToday.sugar)} g, sodium ${Math.round(sm.totToday.sodium)} mg, fruits & légumes ${Math.round(sm.totToday.fruitVeg)} g.`,
    `Repas du jour : ${meals.join(' ; ') || 'aucun'}`,
    `Scores (0-100) : ${Object.entries(sm.scores).map(([k, v]) => `${k} ${v ?? '?'}`).join(', ')}`,
    `7 derniers jours :\n${days.join('\n')}`,
  ].join('\n');
}

// ---------- Graphiques SVG ----------
function ring(score) {
  const r = 42, c = 2 * Math.PI * r, v = score ?? 0;
  const color = score == null ? 'var(--line)' : v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)';
  return `<svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label="Score global ${score ?? 'inconnu'} sur 100">
    <circle cx="52" cy="52" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/>
    <circle cx="52" cy="52" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 52 52)"/>
    <text x="52" y="50" text-anchor="middle" font-size="26" font-weight="700" fill="currentColor">${score ?? '—'}</text>
    <text x="52" y="68" text-anchor="middle" font-size="10" fill="var(--muted)">/ 100</text></svg>`;
}

// Barres simples (une série) ; tap sur une barre → valeur affichée dans .tip
function barChart(points, { ref, unit = '', digits = 0 } = {}) {
  const W = 320, H = 120, pad = 18, n = points.length;
  const max = Math.max(ref || 0, ...points.map((p) => p.v || 0)) * 1.15 || 1;
  const bw = (W - 8) / n;
  const y = (v) => H - pad - (v / max) * (H - pad - 14);
  const bars = points.map((p, i) => {
    const x = 4 + i * bw;
    const has = p.v != null;
    const h = has ? Math.max(2, H - pad - y(p.v)) : 3;
    const tip = `${p.label} : ${has ? fmt(p.v, digits) + ' ' + unit : 'pas de données'}`;
    return `<rect class="b ${has ? '' : 'empty'}" x="${x + 2}" y="${has ? y(p.v) : H - pad - 3}" width="${bw - 4}" height="${h}" rx="4"/>
      <rect class="hit" x="${x}" y="0" width="${bw}" height="${H}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>
      ${i % 2 === n % 2 || n <= 7 ? `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">${esc(p.short)}</text>` : ''}`;
  });
  const last = [...points].reverse().find((p) => p.v != null);
  const li = points.lastIndexOf(last);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <line class="grid" x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}"/>
    ${ref ? `<line class="ref" x1="0" x2="${W}" y1="${y(ref)}" y2="${y(ref)}"/><text x="6" y="${y(ref) - 3}">objectif ${fmt(ref, digits)}</text>` : ''}
    ${bars.join('')}
    ${last ? `<text class="val" x="${4 + li * bw + bw / 2}" y="${y(last.v) - 4}" text-anchor="middle">${fmt(last.v, digits)}</text>` : ''}
  </svg><div class="tip muted small">Touche une barre pour voir la valeur.</div>`;
}

function lineChart(series) {
  const W = 320, H = 150, padL = 30, padB = 18, padT = 10;
  const all = series.flatMap((s) => s.pts.map((p) => p.w));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const maxD = Math.max(...series.flatMap((s) => s.pts.map((p) => p.d)));
  const x = (d) => padL + (d / maxD) * (W - padL - 50);
  const y = (w) => padT + (1 - (w - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - 50}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 4}" y="${y(t) + 3}" text-anchor="end">${fmt(t, 0)}</text>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map((yr) => `<text x="${x(yr * 365)}" y="${H - 4}" text-anchor="middle">${yr === 0 ? 'auj.' : yr + ' an' + (yr > 1 ? 's' : '')}</text>`).join('')}
    ${series.map((s) => {
      const end = s.pts.at(-1);
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" points="${s.pts.map((p) => `${x(p.d)},${y(p.w)}`).join(' ')}"/>
      <circle cx="${x(end.d)}" cy="${y(end.w)}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>
      <text class="val" x="${x(end.d) + 7}" y="${y(end.w) + 4}">${fmt(end.w, 1)} kg</text>
      ${s.pts.filter((p) => p.d % 365 === 0 || p.d === 0).map((p) => `<circle cx="${x(p.d)}" cy="${y(p.w)}" r="10" fill="transparent" data-tip="${esc(`${s.name} — ${p.d / 365 | 0} an(s) : ${fmt(p.w, 1)} kg`)}"/>`).join('')}`;
    }).join('')}
  </svg><div class="tip muted small">Touche un point pour voir la valeur.</div>`;
}

view.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t) return;
  const tip = t.closest('.card')?.querySelector('.tip');
  if (tip) tip.textContent = t.dataset.tip;
});

// ---------- Utilitaires image ----------
function compressImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- Vue : Aujourd'hui ----------
const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
const LEVEL = { bon: '✅', attention: '⚠️', alerte: '🚨' };
const SLOTS = { 'petit-dej': 'Petit-déjeuner', dejeuner: 'Déjeuner', collation: 'Collation', diner: 'Dîner' };

function scaleButtons(field, value, icons = MOODS) {
  return `<div class="scale" data-field="${field}">${icons.map((ic, i) => `<button type="button" class="chip ${value === i + 1 ? 'on' : ''}" data-v="${i + 1}" aria-label="${i + 1} sur 5">${ic}</button>`).join('')}</div>`;
}

function renderToday() {
  const st = store.get();
  const { profile } = st;
  const sm = summary();
  const d = sm.today;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const plan = C.dailyPlan(sm, profile);
  const nextIdx = plan.findIndex((p) => (p.min % 1440) >= nowMin);
  const slot = C.currentSlot(now);
  const sugg = C.mealSuggestions(sm, profile, slot);
  const ins = C.insights(sm);
  const needsProfile = !profile.height || !profile.weight || !profile.birthYear;
  const labels = { sommeil: 'Sommeil', activite: 'Activité', alimentation: 'Alimentation', humeur: 'Humeur', numerique: 'Écrans' };
  const t = sm.t, tot = sm.totToday;
  const prog = (label, v, max, unit, inverse = false) => {
    const p = Math.min(100, (v / max) * 100);
    return `<div class="row" style="justify-content:space-between"><span class="small">${label}</span><span class="small muted">${fmt(v)} / ${fmt(max)} ${unit}</span></div>
      <div class="progress ${inverse && v > max ? 'over' : ''}"><div style="width:${p}%"></div></div>`;
  };

  view.innerHTML = `
    ${needsProfile ? `<div class="card insight attention"><b>Bienvenue 👋</b><p class="small">Complète ton profil (taille, poids, année de naissance, objectif) pour des recommandations personnalisées.</p><button class="btn" data-go="profile">Compléter mon profil</button></div>` : ''}
    <div class="card">
      <div class="score-ring">${ring(sm.scores.global)}
        <div class="bars">${Object.entries(labels).map(([k, l]) => `<div class="bar"><span>${l}</span><div class="track"><div class="fill" style="width:${sm.scores[k] ?? 0}%"></div></div><span class="muted">${sm.scores[k] ?? '—'}</span></div>`).join('')}</div>
      </div>
      <p class="muted small">Score santé sur 7 jours. Plus tu renseignes de données, plus il est fiable.</p>
    </div>

    <div class="card">
      <h2>Check-in express</h2>
      <label>Humeur</label>${scaleButtons('mood', d.mood)}
      <label>Énergie</label>${scaleButtons('energy', d.energy, ['🪫', '😪', '😐', '💪', '⚡'])}
      <label>Stress</label>${scaleButtons('stress', d.stress, ['😌', '🙂', '😐', '😬', '🤯'])}
      <div class="grid2">
        <div><label>Couché à</label><input type="time" data-f="bed" value="${esc(d.bed || '')}"></div>
        <div><label>Levé à</label><input type="time" data-f="wake" value="${esc(d.wake || '')}"></div>
      </div>
      <label>Qualité du sommeil</label>${scaleButtons('sleepQuality', d.sleepQuality, ['😫', '😕', '😐', '🙂', '😴'])}
      <p class="muted small">Pas, temps d'écran, sport… → onglet <a href="#" data-go="track">Suivi</a> (saisie, capture d'écran ou import).</p>
    </div>

    <div class="card">
      <h2>Ton plan pour aujourd'hui</h2>
      <ul class="timeline">${plan.map((p, i) => `<li class="${i === nextIdx ? 'now' : nextIdx > i || nextIdx === -1 ? 'past' : ''}">
        <span class="t">${p.time}</span><span>${p.icon}</span>
        <div><div class="ttl">${esc(p.title)}</div><div class="muted small">${esc(p.text)}</div>${srcLinks(p.src)}</div></li>`).join('')}</ul>
    </div>

    <div class="card">
      <h2>Nutrition du jour</h2>
      ${prog('Calories', tot.kcal, t.kcal, 'kcal', true)}
      ${prog('Protéines', tot.protein, t.protein, 'g')}
      ${prog('Fibres', tot.fiber, t.fiber, 'g')}
      ${prog('Fruits & légumes', tot.fruitVeg, t.fruitVeg, 'g')}
      ${prog('Sucres libres', tot.sugar, t.sugarMax, 'g max', true)}
      ${prog('Sodium', tot.sodium, t.sodiumMax, 'mg max', true)}
      <button class="btn block" data-go="meals">📸 Photographier mon assiette</button>
    </div>

    <div class="card">
      <h2>Idées pour le ${SLOTS[slot].toLowerCase()}</h2>
      ${sugg.map((m) => `<div style="margin:8px 0"><b>${esc(m.name)}</b><div class="muted small">${m.kcal} kcal · ${m.protein} g prot · ${m.fiber} g fibres${m.why.length ? ' — ' + esc(m.why.join(', ')) : ''}</div></div>`).join('') || '<p class="muted">Aucune suggestion compatible avec ton régime.</p>'}
    </div>

    <div class="card">
      <h2>Ce que disent tes données</h2>
      ${ins.length ? ins.map((i) => `<div class="insight ${i.level}"><b>${LEVEL[i.level]} ${esc(i.title)}</b><div class="small">${esc(i.text)}</div>${srcLinks(i.src)}</div>`).join('') : '<p class="muted">Renseigne quelques jours de données pour obtenir une analyse.</p>'}
    </div>
    <p class="muted small">⚕️ Outil d'accompagnement, pas un dispositif médical. En cas de doute, consulte un professionnel de santé.</p>`;

  $$('.scale', view).forEach((sc) =>
    sc.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      store.setDay(store.today(), { [sc.dataset.field]: Number(b.dataset.v) });
      render();
    }),
  );
  $$('input[data-f]', view).forEach((inp) => inp.addEventListener('change', () => { store.setDay(store.today(), { [inp.dataset.f]: inp.value }); render(); }));
}

// ---------- Vue : Repas ----------
let pending = null; // résultat d'analyse en attente de validation
let mealSlot = null;

function mealCard(m) {
  return `<div class="meal">${m.thumb ? `<img src="${m.thumb}" alt="">` : '<div class="ph">🍽️</div>'}
    <div><div class="row" style="justify-content:space-between"><b>${esc(m.title)}</b>${m.verdict ? `<span class="badge ${m.verdict}">${{ bon: 'Bon pour toi', moyen: 'Moyen', a_limiter: 'À limiter' }[m.verdict]}</span>` : ''}</div>
    <div class="muted small">${esc(m.date)} ${esc(m.time)} · ${fmt(m.nutrients?.kcal)} kcal · P ${fmt(m.nutrients?.protein)} g · G ${fmt(m.nutrients?.carbs)} g · L ${fmt(m.nutrients?.fat)} g · fibres ${fmt(m.nutrients?.fiber)} g${m.quality != null ? ` · qualité ${m.quality}/100` : ''}</div>
    ${m.comment ? `<div class="small">${esc(m.comment)}</div>` : ''}
    <button class="chip small" data-del="${m.id}" style="margin-top:6px">Supprimer</button></div></div>`;
}

function renderMeals() {
  const st = store.get();
  const sm = summary();
  const slot = mealSlot || C.currentSlot();
  const sugg = C.mealSuggestions(sm, st.profile, slot);
  const recent = [...st.meals].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 12);
  const p = pending;

  view.innerHTML = `
    <div class="card">
      <h2>📸 Analyser mon assiette</h2>
      <p class="muted small">Prends ton repas en photo (vue de dessus, couverts visibles pour l'échelle). L'IA identifie les aliments, estime portions, calories et nutriments, et te dit si c'est adapté à ton profil.</p>
      <input id="photo" type="file" accept="image/*" capture="environment" hidden>
      <label for="note">Précision facultative (ex. « sauce à la crème », « moitié mangée »)</label>
      <input id="note" placeholder="Facultatif">
      <div class="row" style="margin-top:10px"><button class="btn" id="shoot">Prendre une photo</button><button class="btn ghost" id="pick">Choisir dans la galerie</button></div>
      ${!st.settings.apiKey ? '<p class="small insight attention">Ajoute ta clé API Anthropic dans Profil pour activer l’analyse photo. En attendant, utilise la saisie manuelle ci-dessous.</p>' : ''}
      <div id="analysis">${p ? pendingHtml(p) : ''}</div>
    </div>

    <div class="card">
      <h2>Quoi manger ?</h2>
      <div class="row">${Object.entries(SLOTS).map(([k, l]) => `<button class="chip ${k === slot ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
      ${sugg.map((m) => `<div style="margin:10px 0"><b>${esc(m.name)}</b><div class="muted small">${m.kcal} kcal · ${m.protein} g prot · ${m.fiber} g fibres · ${m.fruitVeg} g fruits/légumes</div>${m.why.length ? `<div class="small">👉 ${esc(m.why.join(' · '))}</div>` : ''}
        <button class="chip small" data-eat="${esc(m.name)}" style="margin-top:4px">J'ai mangé ça</button></div>`).join('')}
      <p class="muted small">Suggestions calculées selon ce qu'il te reste à couvrir aujourd'hui (calories, protéines, fibres, légumes), ton sommeil, ton humeur et ton activité. Pour un menu sur mesure, demande au Coach.</p>
      ${srcLinks(['estruch2018', 'reynolds2019', 'aune2017', 'jacka2017'])}
    </div>

    <div class="card">
      <details><summary>✍️ Saisie manuelle</summary>
        <label>Nom du repas</label><input id="m-title" placeholder="ex. Sandwich jambon-beurre">
        <div class="grid3">
          <div><label>kcal</label><input id="m-kcal" type="number" inputmode="numeric"></div>
          <div><label>Protéines g</label><input id="m-protein" type="number" inputmode="numeric"></div>
          <div><label>Fibres g</label><input id="m-fiber" type="number" inputmode="numeric"></div>
          <div><label>Sucres g</label><input id="m-sugar" type="number" inputmode="numeric"></div>
          <div><label>Légumes/fruits g</label><input id="m-fruitVeg" type="number" inputmode="numeric"></div>
          <div><label>Sel (sodium mg)</label><input id="m-sodium" type="number" inputmode="numeric"></div>
        </div>
        <label>Niveau de transformation</label>
        <select id="m-nova"><option value="1">Brut / peu transformé</option><option value="3">Transformé (fromage, pain…)</option><option value="4">Ultra-transformé (plat industriel, soda, biscuits…)</option></select>
        <button class="btn block" id="m-save" style="margin-top:10px">Ajouter</button>
      </details>
    </div>

    <div class="card"><h2>Journal</h2>${recent.map(mealCard).join('') || '<p class="muted">Aucun repas enregistré.</p>'}</div>`;

  const input = $('#photo');
  $('#shoot').onclick = () => { input.setAttribute('capture', 'environment'); input.click(); };
  $('#pick').onclick = () => { input.removeAttribute('capture'); input.click(); };
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    const dataUrl = await compressImage(f);
    const box = $('#analysis');
    box.innerHTML = `<img class="preview" src="${dataUrl}" alt=""><p><span class="spinner"></span> Analyse en cours…</p>`;
    try {
      const r = await AI.analyzePlate(st.settings, dataUrl, personContext(sm), $('#note').value);
      if (!r.is_food) throw new Error("Je ne vois pas de nourriture sur cette photo.");
      pending = { ...r, dataUrl, thumb: await compressImage(dataURLtoBlob(dataUrl), 160, 0.7), factor: 1 };
      box.innerHTML = pendingHtml(pending);
      bindPending();
    } catch (e) {
      box.innerHTML = `<img class="preview" src="${dataUrl}" alt=""><p class="insight alerte small">${esc(AI.friendlyError(e))}</p>`;
    }
  };
  bindPending();
  $$('[data-slot]', view).forEach((b) => (b.onclick = () => { mealSlot = b.dataset.slot; renderMeals(); }));
  $$('[data-eat]', view).forEach((b) => (b.onclick = () => {
    const m = sugg.find((x) => x.name === b.dataset.eat);
    addMeal({ title: m.name, nutrients: { kcal: m.kcal, protein: m.protein, fiber: m.fiber, fruitVeg: m.fruitVeg, sugar: 5, satFat: 4, sodium: 500, carbs: 0, fat: 0 }, nova: 1, quality: 85, verdict: 'bon' });
  }));
  $$('[data-del]', view).forEach((b) => (b.onclick = () => { store.update((s) => (s.meals = s.meals.filter((m) => m.id !== b.dataset.del))); renderMeals(); }));
  $('#m-save').onclick = () => {
    const v = (id) => Number($('#m-' + id).value) || 0;
    const title = $('#m-title').value.trim();
    if (!title) return toast('Donne un nom au repas.');
    addMeal({ title, nutrients: { kcal: v('kcal'), protein: v('protein'), fiber: v('fiber'), sugar: v('sugar'), fruitVeg: v('fruitVeg'), sodium: v('sodium'), carbs: 0, fat: 0, satFat: 0 }, nova: Number($('#m-nova').value) });
  };
}

function dataURLtoBlob(u) {
  const [h, b] = u.split(',');
  const bin = atob(b);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: h.match(/:(.*?);/)[1] });
}

function scaled(n, k) {
  return Object.fromEntries(Object.entries(n).map(([a, v]) => [a, Math.round(v * k * 10) / 10]));
}

function pendingHtml(p) {
  const n = scaled(p.nutrients, p.factor);
  return `<img class="preview" src="${p.dataUrl}" alt="">
    <div class="row" style="justify-content:space-between;margin-top:10px"><h3 style="margin:0">${esc(p.title)}</h3><span class="badge ${p.verdict}">${{ bon: 'Bon pour toi', moyen: 'Moyen', a_limiter: 'À limiter' }[p.verdict]}</span></div>
    <div class="grid3" style="margin:10px 0">
      <div class="stat"><b>${fmt(n.kcal)}</b><span>kcal</span></div>
      <div class="stat"><b>${fmt(n.protein)} g</b><span>protéines</span></div>
      <div class="stat"><b>${p.quality}/100</b><span>qualité</span></div>
      <div class="stat"><b>${fmt(n.carbs)} g</b><span>glucides (sucres ${fmt(n.sugar)})</span></div>
      <div class="stat"><b>${fmt(n.fat)} g</b><span>lipides (sat. ${fmt(n.satFat)})</span></div>
      <div class="stat"><b>${fmt(n.fiber)} g</b><span>fibres</span></div>
    </div>
    <table>${p.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${fmt(i.grams * p.factor)} g</td><td class="num">${fmt(i.kcal * p.factor)} kcal</td></tr>`).join('')}</table>
    <p class="small">${esc(p.comment)}</p>
    <div class="insight small">💡 ${esc(p.advice)}</div>
    <p class="muted small">Sel : ${fmt(n.sodium)} mg sodium · NOVA ${p.nova} · confiance ${esc(p.confidence)}</p>
    <label>Portion réellement mangée : <b id="fac">${Math.round(p.factor * 100)} %</b></label>
    <input type="range" id="factor" min="0.25" max="2" step="0.05" value="${p.factor}">
    <div class="row" style="margin-top:10px"><button class="btn" id="p-save">Enregistrer ce repas</button><button class="btn ghost" id="p-cancel">Annuler</button></div>`;
}

function bindPending() {
  if (!pending || !$('#p-save')) return;
  $('#factor').oninput = (e) => { pending.factor = Number(e.target.value); $('#analysis').innerHTML = pendingHtml(pending); bindPending(); };
  $('#p-cancel').onclick = () => { pending = null; renderMeals(); };
  $('#p-save').onclick = () => {
    const p = pending;
    addMeal({ title: p.title, nutrients: scaled(p.nutrients, p.factor), items: p.items, nova: p.nova, quality: p.quality, verdict: p.verdict, comment: p.comment, advice: p.advice, thumb: p.thumb });
    pending = null;
  };
}

function addMeal(m) {
  const now = new Date();
  store.update((s) => s.meals.push({ id: crypto.randomUUID(), date: store.today(), time: now.toTimeString().slice(0, 5), slot: C.currentSlot(now), ...m }));
  toast('Repas enregistré ✅');
  renderMeals();
}

// ---------- Vue : Suivi ----------
let trackDay = 0;
const TRACK_FIELDS = [
  ['Sommeil', [['bed', 'Couché à', 'time'], ['wake', 'Levé à', 'time'], ['sleepQuality', 'Qualité (1-5)', 'number']]],
  ['Humeur', [['mood', 'Humeur (1-5)', 'number'], ['energy', 'Énergie (1-5)', 'number'], ['stress', 'Stress (1-5)', 'number']]],
  ['Activité', [['steps', 'Pas', 'number'], ['modMin', 'Min. modérées', 'number'], ['vigMin', 'Min. intenses', 'number'], ['strengthMin', 'Min. renforcement', 'number']]],
  ['Bien-être numérique', [['screenMin', "Temps d'écran (min)", 'number'], ['socialMin', 'Réseaux sociaux (min)', 'number'], ['unlocks', 'Déverrouillages', 'number']]],
  ['Autres', [['waterMl', 'Eau bue (mL)', 'number'], ['alcohol', "Verres d'alcool", 'number'], ['weight', 'Poids (kg)', 'number']]],
];

function renderTrack() {
  const st = store.get();
  const key = store.dayKey(trackDay);
  const d = store.getDay(key);
  const keys = store.lastDays(14);
  const series = (f, fn = (x) => x[f]) => keys.map((k) => ({ label: new Date(k).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), short: k.slice(8), v: st.days[k] ? fn(st.days[k]) ?? null : null }));
  const t = S.targets(st.profile);

  view.innerHTML = `
    <div class="card">
      <h2>📲 Importer automatiquement</h2>
      <p class="muted small">Fais une capture d'écran de <b>Bien-être numérique</b> (Paramètres → Bien-être numérique), de Google Fit, Samsung Health, Fitbit ou Temps d'écran (iPhone) : l'IA lit les valeurs et remplit le jour sélectionné.</p>
      <input id="shot" type="file" accept="image/*" multiple hidden>
      <div class="row"><button class="btn" id="shot-btn">Lire des captures d'écran</button><button class="btn ghost" id="csv-btn">Importer un CSV</button></div>
      <input id="csv" type="file" accept=".csv,text/csv" hidden>
      <div id="shot-res" class="small"></div>
      <details style="margin-top:8px"><summary class="small">Format CSV</summary><p class="muted small">Compatible export Google Fit (Takeout → « Daily activity metrics ») ou ce modèle (séparateur ; ou ,) :</p><pre class="small" style="white-space:pre-wrap">${esc(CSV_TEMPLATE)}</pre></details>
    </div>

    <div class="card">
      <div class="row" style="justify-content:space-between">
        <button class="chip" id="prev">◀</button><b>${new Date(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b><button class="chip" id="next" ${trackDay >= 0 ? 'disabled' : ''}>▶</button>
      </div>
      ${TRACK_FIELDS.map(([title, fields]) => `<h3>${title}</h3><div class="grid2">${fields.map(([f, l, type]) => `<div><label>${l}</label><input data-k="${f}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(d[f] ?? '')}"></div>`).join('')}</div>`).join('')}
      <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" data-k="phoneInBed" ${d.phoneInBed ? 'checked' : ''}> Téléphone utilisé au lit avant de dormir</label>
      <label>Note libre</label><textarea data-k="note" placeholder="Douleurs, événements, ressenti…">${esc(d.note || '')}</textarea>
    </div>

    <div class="card"><h2>Sommeil (h)</h2>${barChart(series('sleep', (x) => S.sleepHours(x.bed, x.wake)), { ref: 7, unit: 'h', digits: 1 })}${srcLinks(['watson2015'])}</div>
    <div class="card"><h2>Pas</h2>${barChart(series('steps'), { ref: t.steps, unit: 'pas' })}${srcLinks(['paluch2022'])}</div>
    <div class="card"><h2>Humeur (1-5)</h2>${barChart(series('mood'), { unit: '/5' })}</div>
    <div class="card"><h2>Réseaux sociaux (min)</h2>${barChart(series('socialMin'), { ref: 30, unit: 'min' })}${srcLinks(['hunt2018'])}</div>
    <div class="card"><h2>Temps d'écran (min)</h2>${barChart(series('screenMin'), { unit: 'min' })}</div>
    <div class="card"><h2>Calories consommées</h2>${barChart(keys.map((k) => ({ label: k, short: k.slice(8), v: store.mealsOn(k).length ? S.sumNutrients(store.mealsOn(k)).kcal : null })), { ref: t.kcal, unit: 'kcal' })}</div>`;

  $$('[data-k]', view).forEach((inp) =>
    inp.addEventListener('change', () => {
      const k = inp.dataset.k;
      let v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
      store.setDay(key, { [k]: v });
      if (k === 'weight' && v) store.update((s) => { s.weights = s.weights.filter((w) => w.date !== key); s.weights.push({ date: key, kg: v }); if (trackDay === 0) s.profile.weight = v; });
      toast('Enregistré', 1200);
    }),
  );
  $('#prev').onclick = () => { trackDay--; renderTrack(); };
  $('#next').onclick = () => { if (trackDay < 0) { trackDay++; renderTrack(); } };
  $('#shot-btn').onclick = () => $('#shot').click();
  $('#csv-btn').onclick = () => $('#csv').click();
  $('#shot').onchange = async (e) => {
    const res = $('#shot-res');
    const merged = {};
    for (const f of e.target.files) {
      res.innerHTML = `<p><span class="spinner"></span> Lecture de ${esc(f.name)}…</p>`;
      try {
        const r = await AI.readScreenshot(st.settings, await compressImage(f, 1600, 0.85));
        for (const [k, v] of Object.entries(r)) if (v != null && k !== 'note' && k !== 'notifications') merged[k] = v;
        merged._notes = [...(merged._notes || []), r.note];
      } catch (err) {
        res.innerHTML = `<p class="insight alerte">${esc(AI.friendlyError(err))}</p>`;
        return;
      }
    }
    const notes = merged._notes || [];
    delete merged._notes;
    store.setDay(key, merged);
    if (merged.weight) store.update((s) => s.weights.push({ date: key, kg: merged.weight }));
    renderTrack();
    $('#shot-res').innerHTML = `<p class="insight bon">✅ ${Object.keys(merged).length} valeur(s) importée(s). ${esc(notes.join(' '))}</p>`;
  };
  $('#csv').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rows = parseCSV(await f.text());
    const n = Object.keys(rows).length;
    store.update((s) => {
      for (const [k, v] of Object.entries(rows)) {
        s.days[k] = { ...(s.days[k] || {}), ...v };
        if (v.weight) s.weights.push({ date: k, kg: v.weight });
      }
    });
    toast(`${n} jour(s) importé(s)`);
    renderTrack();
  };
}

// ---------- Vue : Projection ----------
function renderFuture() {
  const st = store.get();
  const sm = summary();
  const b = sm.body;
  const pr = C.projection(sm, st.profile);
  const cur = pr.current, imp = pr.improved;
  const factors = [...cur[0].factors].sort((a, b) => b.rr - a.rr);
  const t = sm.t;
  const rrTxt = (rr) => `${rr >= 1 ? '+' : '−'}${Math.abs(Math.round((rr - 1) * 100))} %`;

  view.innerHTML = `
    <div class="card">
      <h2>Ton état physique</h2>
      <div class="grid3">
        <div class="stat"><b>${fmt(b.weight, 1)}</b><span>kg</span></div>
        <div class="stat"><b>${fmt(b.bmi, 1)}</b><span>IMC · ${esc(b.bmiCat)}</span></div>
        <div class="stat"><b>${b.bodyFat != null ? fmt(b.bodyFat, 0) + ' %' : '—'}</b><span>masse grasse (estim.)</span></div>
        <div class="stat"><b>${fmt(b.whtr, 2)}</b><span>tour de taille / taille (idéal &lt; 0,5)</span></div>
        <div class="stat"><b>${fmt(b.bmr)}</b><span>kcal métabolisme de base</span></div>
        <div class="stat"><b>${fmt(b.tdee)}</b><span>kcal dépense / jour</span></div>
      </div>
      <h3>Tes cibles quotidiennes</h3>
      <p class="small">${t.kcal} kcal · ${t.protein} g protéines · ≥ ${t.fiber} g fibres · ≥ ${t.fruitVeg} g fruits & légumes · sucres libres &lt; ${t.sugarMax} g · sodium &lt; ${t.sodiumMax} mg · ${t.steps} pas · 150 min d'activité modérée + 2 séances de renforcement / semaine · ${t.sleepMin}–${t.sleepMax} h de sommeil</p>
      ${srcLinks(['mifflin1990', 'ashwell2012', 'who2020', 'who2015sugar', 'who2012sodium', 'morton2018', 'bauer2013'])}
    </div>

    <div class="card">
      <h2>Évolution du poids sur 5 ans</h2>
      ${b.weight ? lineChart([{ name: 'Si rien ne change', color: 'var(--series-2)', pts: pr.curveCurrent }, { name: 'En suivant les conseils', color: 'var(--series-1)', pts: pr.curveImproved }]) : '<p class="muted">Renseigne ton poids dans le profil.</p>'}
      <p class="small">Bilan énergétique moyen : <b>${pr.balance > 0 ? '+' : ''}${fmt(pr.balance)} kcal/j</b> ${pr.reliable ? `(sur ${sm.dietDaysCount} jours de repas saisis)` : '— <i>pas assez de repas saisis (3 jours complets minimum) : projection à l’équilibre par défaut.</i>'}</p>
      ${srcLinks(['hall2011'])}
    </div>

    <div class="card">
      <h2>Projection de ton risque santé</h2>
      <p class="muted small">Risque relatif estimé de mortalité toutes causes comparé à un profil de référence (sommeil 7-9 h, 8000 pas/j, IMC 22,5, alimentation de qualité). Basé sur des associations issues de grandes méta-analyses.</p>
      <table><tr><th></th>${cur.map((c) => `<th class="num">${c.years === 0 ? 'Auj.' : c.years + ' an' + (c.years > 1 ? 's' : '')}</th>`).join('')}</tr>
        <tr><td>Poids actuel → </td>${cur.map((c) => `<td class="num">${fmt(c.weight, 1)}</td>`).join('')}</tr>
        <tr><td>Risque actuel → </td>${cur.map((c) => `<td class="num">${rrTxt(c.rr)}</td>`).join('')}</tr>
        <tr><td><b>Avec les conseils</b></td>${imp.map((c) => `<td class="num"><b>${fmt(c.weight, 1)}</b></td>`).join('')}</tr>
        <tr><td><b>Risque</b></td>${imp.map((c) => `<td class="num"><b>${rrTxt(c.rr)}</b></td>`).join('')}</tr></table>
      <h3>Ce qui pèse le plus</h3>
      ${factors.length ? factors.map((f) => `<div class="insight ${f.rr > 1.1 ? 'alerte' : f.rr > 1.0 ? 'attention' : 'bon'}"><div class="row" style="justify-content:space-between"><b>${esc(f.label)}</b><span>${rrTxt(f.rr)}</span></div><div class="small">${esc(String(f.value))}</div>${srcLinks(f.src)}</div>`).join('') : '<p class="muted">Pas encore assez de données.</p>'}
      <p class="muted small">⚠️ Ces chiffres sont des ordres de grandeur pédagogiques, pas un diagnostic : ils ne tiennent pas compte de tes antécédents, de ta tension, de ta glycémie ou de ton cholestérol. Un bilan médical reste indispensable.</p>
    </div>`;
}

// ---------- Vue : Coach ----------
const QUICK = ['Que devrais-je manger ce soir ?', 'Prépare-moi les repas de demain', 'Quel sport faire aujourd’hui et à quelle heure ?', 'Analyse ma semaine et donne-moi 3 priorités', 'Comment mieux dormir ?', 'Je me sens à plat, que faire ?'];

function renderCoach() {
  const st = store.get();
  view.innerHTML = `
    ${!st.settings.apiKey ? '<div class="card insight attention small">Ajoute ta clé API Anthropic dans Profil pour discuter avec le coach.</div>' : ''}
    <div class="chat" id="chat">${st.chat.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('') || '<div class="card muted small">Pose une question : le coach connaît ton profil, ton sommeil, ton humeur, tes écrans, ton activité et tes repas, et s’appuie sur la littérature scientifique.</div>'}</div>
    <div class="row" style="margin:10px 0">${QUICK.map((q) => `<button class="chip small" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div class="composer"><textarea id="ask" placeholder="Ta question…"></textarea><button class="btn" id="send">➤</button></div>
    ${st.chat.length ? '<button class="chip small" id="clear">Effacer la conversation</button>' : ''}`;
  const send = async (text) => {
    text = text.trim();
    if (!text) return;
    store.update((s) => s.chat.push({ role: 'user', content: text }));
    renderCoach();
    const chat = $('#chat');
    const bubble = document.createElement('div');
    bubble.className = 'msg assistant';
    bubble.innerHTML = '<span class="spinner"></span>';
    chat.appendChild(bubble);
    bubble.scrollIntoView({ block: 'end' });
    try {
      const answer = await AI.coachChat(st.settings, store.get().chat.slice(-20), personContext(), (acc) => { bubble.textContent = acc; });
      store.update((s) => s.chat.push({ role: 'assistant', content: answer }));
    } catch (e) {
      store.update((s) => s.chat.pop());
      bubble.textContent = '⚠️ ' + AI.friendlyError(e);
    }
  };
  $('#send').onclick = () => send($('#ask').value);
  $$('[data-q]', view).forEach((b) => (b.onclick = () => send(b.dataset.q)));
  $('#clear')?.addEventListener('click', () => { store.update((s) => (s.chat = [])); renderCoach(); });
  $('#chat').lastElementChild?.scrollIntoView({ block: 'end' });
}

// ---------- Vue : Profil ----------
function renderProfile() {
  const st = store.get();
  const p = st.profile;
  const sel = (id, opts) => `<select data-p="${id}">${Object.entries(opts).map(([v, l]) => `<option value="${v}" ${p[id] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (id, type = 'text', extra = '') => `<input data-p="${id}" type="${type}" value="${esc(p[id] ?? '')}" ${extra}>`;
  view.innerHTML = `
    <div class="card">
      <h2>Mon corps</h2>
      <label>Prénom</label>${inp('name')}
      <div class="grid2">
        <div><label>Sexe</label>${sel('sex', { h: 'Homme', f: 'Femme' })}</div>
        <div><label>Année de naissance</label>${inp('birthYear', 'number', 'inputmode="numeric"')}</div>
        <div><label>Taille (cm)</label>${inp('height', 'number', 'inputmode="decimal"')}</div>
        <div><label>Poids (kg)</label>${inp('weight', 'number', 'inputmode="decimal" step="0.1"')}</div>
        <div><label>Tour de taille (cm)</label>${inp('waist', 'number', 'inputmode="decimal"')}</div>
        <div><label>Fumeur</label>${sel('smoker', { false: 'Non', true: 'Oui' })}</div>
      </div>
      <label>Niveau d'activité habituel</label>${sel('activityLevel', { sedentaire: 'Sédentaire (bureau, peu de marche)', leger: 'Légèrement actif', modere: 'Modérément actif (3-5 séances/sem)', actif: 'Actif (sport quotidien)', tres_actif: 'Très actif (travail physique + sport)' })}
      <label>Objectif</label>${sel('goal', { perdre: 'Perdre du poids', maintenir: 'Rester en forme / maintenir', prendre: 'Prendre du muscle' })}
      <label>Régime alimentaire</label>${sel('diet', { omnivore: 'Omnivore', pescetarien: 'Pescétarien', vegetarien: 'Végétarien', vegan: 'Végan' })}
      <label>Allergies / aliments à éviter (séparés par des virgules)</label>${inp('allergies')}
      <label>Pathologies, traitements (facultatif, aide le coach)</label>${inp('conditions')}
      <label>Sport préféré</label>${inp('preferredSport', 'text', 'placeholder="ex. course, natation, padel…"')}
      <div class="grid2">
        <div><label>Réveil habituel</label>${inp('wakeTime', 'time')}</div>
        <div><label>Coucher visé</label>${inp('bedTime', 'time')}</div>
      </div>
    </div>

    <div class="card">
      <h2>Intelligence artificielle</h2>
      <p class="muted small">L'analyse photo, la lecture des captures et le coach utilisent Claude (Anthropic). Crée une clé sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Elle reste uniquement sur ce téléphone et n’est envoyée qu’à l’API Anthropic.</p>
      <label>Clé API</label><input id="key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(st.settings.apiKey)}">
      <label>Modèle</label><select id="model">${AI.MODELS.map((m) => `<option value="${m.id}" ${st.settings.model === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
    </div>

    <div class="card">
      <h2>Mes données</h2>
      <p class="muted small">Tout est stocké localement sur ton téléphone. Sauvegarde régulièrement.</p>
      <div class="row"><button class="btn ghost" id="exp">Exporter (JSON)</button><button class="btn ghost" id="imp">Restaurer</button><button class="btn ghost" id="demo">Charger des données de démo</button><button class="chip" id="reset">Tout effacer</button></div>
      <input id="imp-file" type="file" accept=".json,application/json" hidden>
    </div>

    <div class="card">
      <details><summary>📚 Base scientifique (${Object.keys(S.SOURCES).length} références)</summary>
        <ul class="small">${Object.values(S.SOURCES).map((s) => `<li><a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join('')}</ul>
      </details>
    </div>
    <p class="muted small">AppSanté n'est pas un dispositif médical et ne remplace pas l'avis d'un professionnel de santé.</p>`;

  $$('[data-p]', view).forEach((el) =>
    el.addEventListener('change', () => {
      const k = el.dataset.p;
      let v = el.value;
      if (el.type === 'number') v = v === '' ? null : Number(v);
      if (k === 'smoker') v = v === 'true';
      store.update((s) => {
        s.profile[k] = v;
        if (k === 'weight' && v) { s.weights = s.weights.filter((w) => w.date !== store.today()); s.weights.push({ date: store.today(), kg: v }); }
      });
      toast('Profil mis à jour', 1200);
    }),
  );
  $('#key').onchange = (e) => store.update((s) => (s.settings.apiKey = e.target.value.trim()));
  $('#model').onchange = (e) => store.update((s) => (s.settings.model = e.target.value));
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
    a.download = `appsante-${store.today()}.json`;
    a.click();
  };
  $('#imp').onclick = () => $('#imp-file').click();
  $('#imp-file').onchange = async (e) => {
    try { store.importJSON(await e.target.files[0].text()); toast('Données restaurées'); render(); } catch { toast('Fichier invalide'); }
  };
  $('#demo').onclick = () => { loadDemo(); toast('Données de démo chargées'); render(); };
  $('#reset').onclick = () => { if (confirm('Effacer toutes tes données ? (irréversible)')) { store.reset(); render(); } };
}

// Génère 14 jours réalistes pour découvrir l'application.
function loadDemo() {
  store.update((s) => {
    s.profile = { ...s.profile, name: s.profile.name || 'Démo', birthYear: s.profile.birthYear || 1992, height: s.profile.height || 178, weight: s.profile.weight || 82, waist: s.profile.waist || 92 };
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    for (const k of store.lastDays(14)) {
      s.days[k] = { bed: `${rnd(23, 24) % 24}:${String(rnd(0, 5) * 10).padStart(2, '0')}`.padStart(5, '0'), wake: `0${rnd(6, 7)}:${String(rnd(0, 5) * 10).padStart(2, '0')}`, sleepQuality: rnd(2, 4), mood: rnd(2, 4), energy: rnd(2, 4), stress: rnd(2, 4), steps: rnd(3500, 9500), modMin: rnd(0, 30), vigMin: rnd(0, 15), strengthMin: Math.random() < 0.2 ? 40 : 0, screenMin: rnd(150, 330), socialMin: rnd(30, 110), unlocks: rnd(50, 110), phoneInBed: Math.random() < 0.6, alcohol: Math.random() < 0.3 ? rnd(1, 2) : 0 };
      if (!s.meals.some((m) => m.date === k)) {
        const meals = [
          ['08:00', 'Tartines beurre-confiture, café', { kcal: 420, protein: 9, carbs: 62, sugar: 22, fat: 14, satFat: 8, fiber: 3, sodium: 450, fruitVeg: 0 }, 3],
          ['12:45', 'Sandwich jambon-fromage, chips, soda', { kcal: 980, protein: 32, carbs: 120, sugar: 40, fat: 40, satFat: 15, fiber: 5, sodium: 2100, fruitVeg: 20 }, 4],
          ['20:30', 'Pâtes bolognaise, salade', { kcal: 850, protein: 35, carbs: 100, sugar: 10, fat: 30, satFat: 11, fiber: 8, sodium: 900, fruitVeg: 150 }, 3],
        ];
        for (const [time, title, nutrients, nova] of meals) s.meals.push({ id: crypto.randomUUID(), date: k, time, title, nutrients, nova, quality: nova === 4 ? 30 : 55, verdict: nova === 4 ? 'a_limiter' : 'moyen' });
      }
    }
  });
}

// ---------- Navigation ----------
function render() {
  $('#title').textContent = tab === 'today' && store.get().profile.name ? `Bonjour ${store.get().profile.name}` : TITLES[tab];
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ({ today: renderToday, meals: renderMeals, track: renderTrack, future: renderFuture, coach: renderCoach, profile: renderProfile })[tab]();
}

function go(t) {
  tab = t;
  history.replaceState(null, '', '#' + t);
  window.scrollTo(0, 0);
  render();
}

$$('.tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
view.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); }
});
if (TITLES[location.hash.slice(1)]) tab = location.hash.slice(1);
render();

// ---------- PWA : installation et hors-ligne ----------
let deferred;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  $('#install').hidden = false;
});
$('#install').onclick = async () => {
  $('#install').hidden = true;
  deferred?.prompt();
};
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js');
