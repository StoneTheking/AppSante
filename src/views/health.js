// Santé : saisie & synchronisation, tendances, projection.
import * as store from '../store.js';
import * as S from '../science.js';
import * as C from '../coach.js';
import * as AI from '../ai.js';
import * as N from '../native.js';
import { parseCSV, CSV_TEMPLATE } from '../importer.js';
import { summary } from '../context.js';
import * as D from '../digestion.js';
import { icon, esc, fmt, segmented, srcLinks, barChart, lineChart, toast, compressImage, pickImage, $, $$ } from '../ui.js';

let seg = 'suivi';
let dayOffset = 0;

export function render(view, ctx) {
  view.innerHTML = `${segmented('hl', [['suivi', 'Suivi'], ['tendances', 'Tendances'], ['projection', 'Projection'], ['science', 'Science']], seg)}<div id="hl-body" class="view-enter"></div>`;
  $$('[data-seg="hl"]', view).forEach((b) => (b.onclick = () => { seg = b.dataset.v; render(view, ctx); }));
  ({ suivi: renderTrack, tendances: renderTrends, projection: renderFuture, science: renderScience })[seg]($('#hl-body', view), ctx);
}

export function openSection(s) { seg = s; }

// ---------- Synchronisation ----------
export async function syncAll({ silent = false } = {}) {
  const st = store.get();
  const results = [];
  if (!N.isNative) return results;
  try {
    const h = await N.syncHealth(7);
    merge(h);
    results.push(`${Object.keys(h).length} j. Health Connect`);
  } catch (e) { if (!silent) results.push('Health Connect : ' + (e.message || e)); }
  try {
    if (await N.usagePermission()) {
      const u = await N.syncUsage(7, st.profile.bedTime);
      merge(u);
      results.push('temps d’écran');
    }
  } catch (e) { if (!silent) results.push('Temps d’écran : ' + (e.message || e)); }
  store.update((s) => { s.lastSync = new Date().toISOString(); });
  return results;
}

function merge(byDay) {
  store.update((s) => {
    for (const [k, v] of Object.entries(byDay)) {
      s.days[k] = { ...(s.days[k] || {}), ...v };
      if (v.weight) {
        s.weights = s.weights.filter((w) => w.date !== k);
        s.weights.push({ date: k, kg: v.weight });
      }
    }
  });
}

const FIELDS = [
  ['moon', 'Sommeil', 'var(--c-sleep)', [['bed', 'Couché à', 'time'], ['wake', 'Levé à', 'time'], ['sleepQuality', 'Qualité (1-5)', 'number']]],
  ['smile', 'Humeur', 'var(--c-mood)', [['mood', 'Humeur (1-5)', 'number'], ['energy', 'Énergie (1-5)', 'number'], ['stress', 'Stress (1-5)', 'number']]],
  ['steps', 'Activité', 'var(--c-move)', [['steps', 'Pas', 'number'], ['modMin', 'Min. modérées', 'number'], ['vigMin', 'Min. intenses', 'number'], ['strengthMin', 'Min. renforcement', 'number']]],
  ['phone', 'Bien-être numérique', 'var(--c-screen)', [['screenMin', "Temps d'écran (min)", 'number'], ['socialMin', 'Réseaux sociaux (min)', 'number'], ['unlocks', 'Déverrouillages', 'number'], ['lateMin', 'Écran après 22 h (min)', 'number']]],
  ['heart', 'Corps', 'var(--bad)', [['weight', 'Poids (kg)', 'number'], ['restingHR', 'FC repos (bpm)', 'number'], ['waterMl', 'Eau (mL)', 'number'], ['alcohol', "Verres d'alcool", 'number']]],
];

function renderTrack(el, ctx) {
  const st = store.get();
  const key = store.dayKey(dayOffset);
  const d = store.getDay(key);
  const native = N.isNative;
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${icon('refresh', 18)} Données automatiques</h2>${st.lastSync ? `<span class="tiny muted">sync. ${new Date(st.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}</div>
      ${native ? `
        <p class="small muted" style="margin-top:-6px">Pas, sommeil, fréquence cardiaque, poids et séances via <b>Health Connect</b> ; temps d’écran, réseaux sociaux et déverrouillages via <b>Bien-être numérique</b>.</p>
        <button class="btn block" id="sync">${icon('refresh', 18)} Synchroniser maintenant</button>
        <div class="grid2" style="margin-top:8px">
          <button class="btn ghost sm" id="hc">${icon('heart', 16)} Autoriser Health Connect</button>
          <button class="btn ghost sm" id="usage">${icon('phone', 16)} Autoriser le temps d’écran</button>
        </div>` : `
        <p class="small muted" style="margin-top:-6px">Dans le navigateur, Android ne donne pas accès à Bien-être numérique ni à Health Connect. <b>Installe l’application Android</b> (Profil → Application Android) pour une synchronisation automatique, ou :</p>
        <div class="grid2">
          <button class="btn soft" id="shot">${icon('image', 18)} Capture d’écran</button>
          <button class="btn ghost" id="csv-btn">${icon('upload', 18)} Import CSV</button>
        </div>
        <details style="margin-top:10px"><summary class="small">Format CSV ${icon('right', 14)}</summary><p class="tiny muted">Export Google Fit (Takeout → « Daily activity metrics ») ou ce modèle :</p><pre class="tiny" style="white-space:pre-wrap;background:var(--card-2);padding:8px;border-radius:10px">${esc(CSV_TEMPLATE)}</pre></details>`}
      <input id="csv" type="file" accept=".csv,text/csv" hidden>
      <div id="sync-res" class="small" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <div class="between">
        <button class="icon-btn" id="prev" aria-label="Jour précédent">${icon('left')}</button>
        <b style="text-transform:capitalize">${dayOffset === 0 ? "Aujourd'hui" : new Date(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
        <button class="icon-btn" id="next" aria-label="Jour suivant" ${dayOffset >= 0 ? 'disabled style="opacity:.3"' : ''}>${icon('right')}</button>
      </div>
      ${FIELDS.map(([ic, title, col, fields]) => `<div class="row" style="margin:18px 0 0;gap:10px"><span class="icon-badge" style="width:30px;height:30px;border-radius:10px;background:color-mix(in srgb,${col} 15%,transparent);color:${col}">${icon(ic, 16)}</span><b>${title}</b></div>
        <div class="grid2">${fields.map(([f, l, type]) => `<div><label class="lbl">${l}</label><input data-k="${f}" type="${type}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(d[f] ?? '')}"></div>`).join('')}</div>`).join('')}
      <label class="row" style="margin-top:16px;justify-content:space-between;flex-wrap:nowrap"><span class="small">Téléphone utilisé au lit avant de dormir</span><span class="switch"><input type="checkbox" data-k="phoneInBed" ${d.phoneInBed ? 'checked' : ''}><span></span></span></label>
      ${d.topApps?.length ? `<p class="tiny muted" style="margin-top:10px">Applis les plus utilisées : ${d.topApps.map((a) => `${esc(a.name)} (${a.minutes} min)`).join(', ')}</p>` : ''}
      <label class="lbl">Note libre</label><textarea data-k="note" placeholder="Douleurs, événements, ressenti…">${esc(d.note || '')}</textarea>
    </div>
    ${stoolCard(key)}`;

  $$('[data-k]', el).forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.k;
    const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
    store.setDay(key, { [k]: v });
    if (k === 'weight' && v) store.update((s) => { s.weights = s.weights.filter((w) => w.date !== key); s.weights.push({ date: key, kg: v }); if (dayOffset === 0) s.profile.weight = v; });
    toast('Enregistré', 1000);
  }));
  $('#prev', el).onclick = () => { dayOffset--; renderTrack(el, ctx); };
  $('#add-stool', el).onclick = () => ctx.action('stool');
  $$('[data-stool-del]', el).forEach((b) => (b.onclick = () => { store.update((s) => (s.stools = s.stools.filter((x) => x.id !== b.dataset.stoolDel))); renderTrack(el, ctx); }));
  $('#next', el).onclick = () => { if (dayOffset < 0) { dayOffset++; renderTrack(el, ctx); } };
  const res = $('#sync-res', el);
  if (native) {
    $('#sync', el).onclick = async () => {
      res.innerHTML = '<span class="spinner"></span> Synchronisation…';
      const r = await syncAll();
      renderTrack(el, ctx);
      $('#sync-res', el).innerHTML = `<div class="note good">${icon('ok', 18)}<span>${esc(r.join(' · ') || 'Rien à synchroniser : autorise d’abord les accès.')}</span></div>`;
    };
    $('#hc', el).onclick = async () => {
      try { await N.connectHealth(); toast('Health Connect autorisé'); } catch (e) { res.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(e.message)}</span></div>`; }
    };
    $('#usage', el).onclick = () => { N.openUsageSettings(); toast('Active « AppSanté » puis reviens ici'); };
  } else {
    $('#shot', el).onclick = () => readShots(key, el, ctx);
    $('#csv-btn', el).onclick = () => $('#csv', el).click();
    $('#csv', el).onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const rows = parseCSV(await f.text());
      merge(rows);
      toast(`${Object.keys(rows).length} jour(s) importé(s)`);
      renderTrack(el, ctx);
    };
  }
}

async function readShots(key, el, ctx) {
  const files = await pickImage({ camera: false, multiple: true });
  if (!files.length) return;
  const res = $('#sync-res', el);
  const merged = {};
  const notes = [];
  for (const f of files) {
    res.innerHTML = `<span class="spinner"></span> Lecture de la capture…`;
    try {
      const r = await AI.readScreenshot(store.get().settings, await compressImage(f, 1600, 0.85));
      for (const [k, v] of Object.entries(r)) if (v != null && k !== 'note' && k !== 'notifications') merged[k] = v;
      notes.push(r.note);
    } catch (err) {
      res.innerHTML = `<div class="note bad">${icon('alert', 18)}<span>${esc(AI.friendlyError(err))}</span></div>`;
      return;
    }
  }
  merge({ [key]: merged });
  renderTrack(el, ctx);
  $('#sync-res', el).innerHTML = `<div class="note good">${icon('ok', 18)}<span>${Object.keys(merged).length} valeur(s) importée(s). ${esc(notes.join(' '))}</span></div>`;
}

// ---------- Tendances ----------
function renderTrends(el) {
  const dig = digestionCard();
  const st = store.get();
  const keys = store.lastDays(14);
  const t = S.targets(st.profile);
  const series = (fn) => keys.map((k) => ({ label: new Date(k).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), short: k.slice(8), v: st.days[k] ? fn(st.days[k]) ?? null : null }));
  const sleepFn = (x) => (x.sleepMinutes ? x.sleepMinutes / 60 : S.sleepHours(x.bed, x.wake));
  const card = (ic, title, col, chart, src = []) => `<div class="card"><div class="card-head"><h2><span style="color:${col}">${icon(ic, 18)}</span> ${title}</h2></div>${chart}${srcLinks(src)}</div>`;
  el.innerHTML = [
    card('moon', 'Sommeil (h)', 'var(--c-sleep)', barChart(series(sleepFn), { ref: 7, unit: 'h', digits: 1, color: 'var(--c-sleep)' }), ['watson2015']),
    card('steps', 'Pas', 'var(--c-move)', barChart(series((x) => x.steps), { ref: t.steps, unit: 'pas', color: 'var(--c-move)' }), ['paluch2022']),
    card('smile', 'Humeur (1-5)', 'var(--c-mood)', barChart(series((x) => x.mood), { unit: '/5', color: 'var(--c-mood)' })),
    card('phone', "Temps d'écran (min)", 'var(--c-screen)', barChart(series((x) => x.screenMin), { unit: 'min', color: 'var(--c-screen)' })),
    card('share', 'Réseaux sociaux (min)', 'var(--c-screen)', barChart(series((x) => x.socialMin), { ref: 30, unit: 'min', color: 'var(--c-screen)' }), ['hunt2018']),
    card('flame', 'Calories consommées', 'var(--c-food)', barChart(keys.map((k) => ({ label: k, short: k.slice(8), v: store.mealsOn(k).length ? S.sumNutrients(store.mealsOn(k)).kcal : null })), { ref: t.kcal, unit: 'kcal', color: 'var(--c-food)' })),
    st.days[keys.at(-1)]?.restingHR != null || keys.some((k) => st.days[k]?.restingHR) ? card('heart', 'FC au repos (bpm)', 'var(--bad)', barChart(series((x) => x.restingHR), { unit: 'bpm', color: 'var(--bad)' })) : '',
    dig,
  ].join('');
  el.addEventListener('click', (e) => {
    const tip = e.target.closest('[data-tip]');
    if (tip) tip.closest('.card').querySelector('.tip').textContent = tip.dataset.tip;
  });
}

// ---------- Projection ----------
function renderFuture(el) {
  const st = store.get();
  const sm = summary();
  const b = sm.body, t = sm.t;
  const pr = C.projection(sm, st.profile);
  const cur = pr.current, imp = pr.improved;
  const factors = [...cur[0].factors].sort((a, c) => c.rr - a.rr);
  const rrTxt = (rr) => `${rr >= 1 ? '+' : '−'}${Math.abs(Math.round((rr - 1) * 100))} %`;
  const stat = (k, v, u, ic) => `<div class="stat"><div class="k">${ic ? icon(ic, 14) : ''}${k}</div><div class="v">${v}<small>${u}</small></div></div>`;

  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${icon('user', 18)} Ton état physique</h2></div>
      <div class="grid2">
        ${stat('Poids', fmt(b.weight, 1), 'kg', 'scale')}
        ${stat('IMC', fmt(b.bmi, 1), b.bmiCat, '')}
        ${stat('Masse grasse (estim.)', b.bodyFat != null ? fmt(b.bodyFat) : '–', '%', '')}
        ${stat('Taille / tour de taille', fmt(b.whtr, 2), 'idéal < 0,5', '')}
        ${stat('Métabolisme de base', fmt(b.bmr), 'kcal', 'flame')}
        ${stat('Dépense / jour', fmt(b.tdee), 'kcal', 'activity')}
      </div>
      <h3 style="font-size:.9rem;margin:16px 0 6px">Tes cibles quotidiennes</h3>
      <div class="chips" style="flex-wrap:wrap">${[`${t.kcal} kcal`, `${t.protein} g protéines`, `≥ ${t.fiber} g fibres`, `≥ ${t.fruitVeg} g fruits & légumes`, `sucres < ${t.sugarMax} g`, `sel < 5 g`, `${t.steps} pas`, '150 min d’activité/sem', '2 séances renfo/sem', `${t.sleepMin}–${t.sleepMax} h de sommeil`].map((x) => `<span class="chip">${x}</span>`).join('')}</div>
      ${srcLinks(['mifflin1990', 'ashwell2012', 'who2020', 'who2015sugar', 'who2012sodium', 'morton2018'])}
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('trend', 18)} Ton poids dans 5 ans</h2></div>
      ${b.weight ? lineChart([{ name: 'Si rien ne change', color: 'var(--series-2)', pts: pr.curveCurrent }, { name: 'En suivant les conseils', color: 'var(--series-1)', pts: pr.curveImproved }]) : '<p class="muted">Renseigne ton poids dans le profil.</p>'}
      <div class="note ${pr.reliable ? '' : 'warn'}" style="margin-top:10px">${icon('info', 18)}<span>Bilan énergétique moyen : <b>${pr.balance > 0 ? '+' : ''}${fmt(pr.balance)} kcal/j</b>. ${pr.reliable ? `Calculé sur ${sm.dietDaysCount} jours de repas saisis.` : 'Saisis tes repas au moins 3 jours complets pour une projection fiable.'}</span></div>
      ${srcLinks(['hall2011'])}
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('heart', 18)} Ton risque santé</h2></div>
      <p class="small muted" style="margin-top:-6px">Risque relatif de mortalité toutes causes comparé à un profil de référence, d’après de grandes méta-analyses.</p>
      <table><tr><th></th>${cur.map((c) => `<th class="num">${c.years === 0 ? 'Auj.' : c.years + ' an' + (c.years > 1 ? 's' : '')}</th>`).join('')}</tr>
        <tr><td><span style="color:var(--series-2)">●</span> Habitudes actuelles</td>${cur.map((c) => `<td class="num">${rrTxt(c.rr)}</td>`).join('')}</tr>
        <tr><td><span style="color:var(--series-1)">●</span> Avec les conseils</td>${imp.map((c) => `<td class="num"><b>${rrTxt(c.rr)}</b></td>`).join('')}</tr></table>
      <h3 style="font-size:.9rem;margin:18px 0 6px">Ce qui pèse le plus</h3>
      ${factors.length ? factors.map((f) => {
        const col = f.rr > 1.1 ? 'var(--bad)' : f.rr > 1.0 ? 'var(--warn)' : 'var(--good)';
        const w = Math.min(100, Math.abs(f.rr - 1) * 250);
        return `<div style="margin:12px 0"><div class="between small"><b>${esc(f.label)}</b><span style="color:${col};font-weight:700">${rrTxt(f.rr)}</span></div>
          <div class="tiny muted">${esc(String(f.value))}</div><div class="meter" style="margin:4px 0"><div class="track"><div class="fill" style="width:${w}%;background:${col}"></div></div></div>${srcLinks(f.src)}</div>`;
      }).join('') : '<p class="muted">Pas encore assez de données.</p>'}
      <div class="note warn">${icon('alert', 18)}<span>Ordres de grandeur pédagogiques, pas un diagnostic : tension, glycémie, cholestérol et antécédents ne sont pas pris en compte. Un bilan médical reste indispensable.</span></div>
    </div>`;
  el.addEventListener('click', (e) => {
    const tip = e.target.closest('[data-tip]');
    if (tip) tip.closest('.card').querySelector('.tip').textContent = tip.dataset.tip;
  });
}

// ---------- Bibliothèque scientifique ----------
let query = '';
function renderScience(el) {
  const total = S.EVIDENCE.reduce((a, t) => a + t.facts.length, 0);
  const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const draw = () => {
    const q = norm(query.trim());
    const themes = S.EVIDENCE.map((t) => ({ ...t, facts: t.facts.filter(([f, src]) => !q || norm(f + ' ' + src.map((id) => S.SOURCES[id].t).join(' ')).includes(q)) })).filter((t) => t.facts.length);
    $('#sci-list', el).innerHTML = themes.map((t) => `<div class="card">
      <div class="card-head"><h2><span class="icon-badge" style="width:32px;height:32px;border-radius:10px;background:color-mix(in srgb,${t.color} 15%,transparent);color:${t.color}">${icon(t.icon, 16)}</span>${esc(t.theme)}</h2><span class="tiny muted">${t.facts.length}</span></div>
      ${t.facts.map(([f, src]) => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="small">${esc(f)}</div>${srcLinks(src)}</div>`).join('')}
    </div>`).join('') || '<div class="empty">Aucun résultat.</div>';
  };
  el.innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${icon('book', 18)} Bibliothèque scientifique</h2></div>
      <p class="small muted" style="margin-top:-6px">${total} résultats clés tirés de ${Object.keys(S.SOURCES).length} publications (OMS, ANSES, Lancet, BMJ, JAMA, Nature…). Ce sont eux qui pilotent tes scores, ton plan du jour, tes projections et le coach.</p>
      <input id="sci-q" type="search" placeholder="Rechercher : sommeil, protéines, café, écrans…" value="${esc(query)}">
    </div>
    <div id="sci-list"></div>
    <p class="tiny muted" style="text-align:center">Les études d’observation montrent des associations, pas forcément des causes. Les essais randomisés et méta-analyses sont privilégiés.</p>`;
  $('#sci-q', el).addEventListener('input', (e) => { query = e.target.value; draw(); });
  draw();
}

// ---------- Transit ----------
function stoolCard(key) {
  const localKey = (iso) => { const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const list = store.get().stools.filter((s) => localKey(s.at) === key);
  return `<div class="card">
    <div class="card-head"><h2>${icon('activity', 18)} Transit</h2><button class="btn sm soft" id="add-stool">${icon('plus', 16)} Ajouter</button></div>
    ${list.length ? list.map((s) => { const b = D.BRISTOL[s.bristol - 1]; return `<div class="list-item" style="grid-template-columns:auto 1fr auto"><span class="badge ${b.zone === 'ok' ? 'bon' : 'moyen'}">Type ${s.bristol}</span><div><div class="small"><b>${new Date(s.at).toTimeString().slice(0, 5)}</b> · ${b.label}</div><div class="tiny muted">${b.meaning}${s.pain ? ' · douleurs' : ''}${s.bloating ? ' · ballonnements' : ''}${s.urgency ? ' · urgence' : ''}</div></div><button class="icon-btn" data-stool-del="${s.id}" aria-label="Supprimer">${icon('trash', 14)}</button></div>`; }).join('') : '<p class="small muted" style="margin:0">Rien de noté ce jour. Le suivi aide à repérer les aliments qui ne te conviennent pas.</p>'}
  </div>`;
}

function digestionCard() {
  const st = store.get();
  const sum = D.digestionSummary(st.stools);
  const sus = D.suspects(st.stools, st.meals);
  const head = `<div class="card-head"><h2><span style="color:var(--c-food)">${icon('activity', 18)}</span> Digestion & tolérance</h2></div>`;
  if (!sum) return `<div class="card">${head}<p class="small muted" style="margin:0">Note tes passages aux toilettes (bouton +) : l’application croise l’échelle de Bristol avec tes repas des 8 à 48 h précédentes pour repérer les aliments mal tolérés.</p>${srcLinks(['lewis1997', 'asnicar2021'])}</div>`;
  const total = sum.count;
  const seg = (n, col) => `<div style="width:${(n / total) * 100}%;background:${col}"></div>`;
  return `<div class="card">${head}
    <div class="kpi-row"><div class="stat"><div class="k">Par semaine</div><div class="v">${fmt(sum.perWeek, 1)}</div></div><div class="stat"><div class="k">Types 3–4</div><div class="v">${Math.round((sum.zones.ok / total) * 100)}<small>%</small></div></div><div class="stat"><div class="k">Notés (14 j)</div><div class="v">${total}</div></div></div>
    <div class="bar-mini" style="display:flex;height:10px;margin:12px 0 4px">${seg(sum.zones.lent, 'var(--warn)')}${seg(sum.zones.ok, 'var(--good)')}${seg(sum.zones.rapide, 'var(--c-move)')}</div>
    <div class="legend"><span><i style="background:var(--warn)"></i>lent (1–2)</span><span><i style="background:var(--good)"></i>idéal (3–4)</span><span><i style="background:var(--c-move)"></i>rapide (5–7)</span></div>
    ${sum.advice.map((a) => `<div class="note ${a.level === 'bon' ? 'good' : a.level === 'alerte' ? 'bad' : 'warn'}" style="margin:8px 0">${icon(a.level === 'bon' ? 'ok' : 'alert', 16)}<span>${esc(a.text)}</span></div>${srcLinks(a.src)}`).join('')}
    <h3 style="font-size:.9rem;margin:14px 0 6px">Aliments à surveiller</h3>
    ${sus.length ? sus.map((x) => `<div class="between small" style="padding:6px 0;border-top:1px solid var(--line)"><span style="text-transform:capitalize">${esc(x.word)}</span><span class="muted">suivi de troubles ${x.bad} fois sur ${x.total}</span></div>`).join('') + '<p class="tiny muted">Corrélation, pas preuve : retire un aliment 2–3 semaines puis réintroduis-le pour vérifier, idéalement avec un professionnel.</p>' : '<p class="small muted" style="margin:0">Aucun aliment suspect pour l’instant (il faut au moins 2 épisodes liés).</p>'}
    ${srcLinks(['halmos2014', 'vandeputte2016'])}
  </div>`;
}
