// Santé : saisie & synchronisation, tendances, projection.
import * as store from '../store.js';
import * as S from '../science.js';
import * as C from '../coach.js';
import * as AI from '../ai.js';
import * as N from '../native.js';
import { parseCSV, CSV_TEMPLATE } from '../importer.js';
import { summary } from '../context.js';
import * as Diana from '../diana.js';
import * as D from '../digestion.js';
import * as SP from '../sport.js';
import { icon, esc, fmt, fmtMin, segmented, srcLinks, barChart, timeChart, faces, bindFaces, toast, undoToast, compressImage, pickImage, sheet, $, $$ } from '../ui.js';
import * as E from '../energy.js';
import { correlations } from '../correlate.js';

let seg = 'suivi';
let dayOffset = 0;

let shownSeg = null;
export function render(view, ctx) {
  const dsm = summary();
  view.innerHTML = `${segmented('hl', [['suivi', 'Suivi'], ['tendances', 'Tendances'], ['projection', 'Projection'], ['science', 'Science']], seg)}<div id="hl-body" class="${seg !== shownSeg ? 'view-enter' : ''}"></div>`;
  shownSeg = seg; // animations d'entrée seulement au changement d'onglet, pas à chaque mise à jour
  $$('[data-seg="hl"]', view).forEach((b) => (b.onclick = () => { if (b.dataset.v === seg) return; seg = b.dataset.v; render(view, ctx); }));
  Diana.context('health', store.get(), dsm);
  const body = $('#hl-body', view);
  ({ suivi: renderTrack, tendances: renderTrends, projection: renderFuture, science: renderScience })[seg](body, ctx);
  setTimeout(() => body.classList.remove('view-enter'), 1200);
}

export function openSection(s) { seg = s; }

// ---------- Synchronisation ----------
// Health Connect (pas, sommeil, séances, poids) + temps d'écran ; podomètre du téléphone si Health Connect manque.
// Une seule synchro à la fois : un deuxième appel (bouton + synchro auto) attend la synchro en cours.
let running = null;
export function syncAll(opts) {
  if (!running) running = doSync(opts).finally(() => { running = null; });
  return running;
}
async function doSync({ silent = false } = {}) {
  const st = store.get();
  const results = [];
  if (!N.isNative) return results;
  let hcSteps = false;
  try {
    const diag = await Promise.race([N.healthDiagnose(), new Promise((r) => setTimeout(() => r({ ok: false, reason: 'error', detail: 'La vérification de Health Connect ne répond pas (plus de 25 s).' }), 25000))]);
    store.update((s) => { s.healthDiag = { ...diag, at: Date.now() }; });
    if (diag.ok) {
      const h = await N.syncHealth(7);
      merge(h.days);
      h.workouts.forEach((w) => SP.addWorkout(w));
      hcSteps = Object.values(h.days).some((d) => d.steps);
      store.update((s) => { s.hcReport = h.report; });
      results.push(`Health Connect : ${Object.keys(h.days).length} jour(s)${h.workouts.length ? `, ${h.workouts.length} séance(s)` : ''}`);
    }
  } catch (e) { if (!silent) results.push('Health Connect : ' + (e.message || e)); }
  // Samsung Health n'envoie pas toujours tous ses pas à Health Connect (envoi différé, pas de la montre…) :
  // le podomètre du téléphone tourne en complément et on garde le plus grand des deux totaux du jour.
  store.update((s) => { s.hcSteps = hcSteps; });
  const pedo = await N.stepsHasAccess();
  N.stepsBackground(pedo);
  try {
    if (pedo) {
      const r = await N.stepsRead();
      const bg = await N.stepsHistory(); // relevés d'arrière-plan : les pas entre deux ouvertures comptent aussi
      if (r) {
        store.update((s) => {
          const all = [...(s.stepSamples || []), ...bg, { t: r.t, v: r.value }].filter((x) => r.t - x.t < 3 * 86400e3);
          const seen = new Set();
          s.stepSamples = all.sort((a, b) => a.t - b.t).filter((x) => !seen.has(x.t) && seen.add(x.t));
        });
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const steps = N.stepsFromSamples(store.get().stepSamples, start.getTime());
        const k = store.today();
        store.update((s) => { if (s.hcReport) s.hcReport.phoneSteps = steps; });
        if (steps > (store.get().days[k]?.steps || 0)) store.setDay(k, { steps, stepsSource: 'téléphone' });
        results.push(`podomètre : ${steps} pas`);
      }
    }
  } catch { /* capteur indisponible */ }
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

const stat = (k, v, u = '', ic = '') => `<div class="stat"><div class="k">${ic ? icon(ic, 14) : ''}${k}</div><div class="v">${v}${u ? `<small>${u}</small>` : ''}</div></div>`;
const section = (ic, title, col, right = '') => `<div class="between" style="margin:18px 0 8px"><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="icon-badge" style="width:30px;height:30px;border-radius:10px;background:color-mix(in srgb,${col} 15%,transparent);color:${col}">${icon(ic, 16)}</span><b>${title}</b></div>${right}</div>`;

// Mesures de la montre ou de Samsung Health (affichées seulement si elles existent).
function watchStats(d) {
  const items = [
    d.hrAvg && stat('Cœur (moyenne)', d.hrAvg, 'bpm', 'heart'),
    d.hrMin && d.hrMax && stat('Cœur min – max', `${d.hrMin}–${d.hrMax}`, 'bpm', 'heart'),
    d.restingHR && stat('Cœur au repos', d.restingHR, 'bpm', 'heart'),
    d.hrv && stat('Variabilité cardiaque', d.hrv, 'ms', 'activity'),
    d.spo2 && stat('Oxygène du sang', d.spo2, '%'),
    d.respRate && stat('Respiration', fmt(d.respRate, 1), '/min'),
    d.vo2max && stat('VO₂ max', fmt(d.vo2max, 1), 'mL/kg/min'),
    d.bodyFat && stat('Masse grasse', fmt(d.bodyFat, 1), '%'),
  ].filter(Boolean);
  return items.length ? `${section('heart', 'Cœur et forme', 'var(--bad)', '<span class="tiny muted">montre · Samsung Health</span>')}<div class="ro-grid">${items.join('')}</div>` : '';
}

// Ce que Health Connect a réellement renvoyé à la dernière synchro (pour comprendre des pas qui ne bougent pas).
function hcReportLine(r) {
  const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const btn = `<button class="btn sm ghost" id="hc-sync">${icon('refresh', 14)} Synchroniser</button>`;
  if (!r) return `<div class="between" style="margin:-2px 0 6px"><span class="tiny muted">Pas encore synchronisé.</span>${btn}</div>`;
  const errs = Object.entries(r.errors || {});
  const txt = r.todaySteps
    ? `Aujourd’hui : <b>${fmt(r.todaySteps)} pas</b> reçus${r.sources?.length ? ` de ${esc(r.sources.join(', '))}` : ''}${r.firstStep && r.lastStep ? ` (relevés de ${hm(r.firstStep)} à ${hm(r.lastStep)})` : r.lastStep ? ` (dernier relevé ${hm(r.lastStep)})` : ''}.${r.firstStep && new Date(r.firstStep).getHours() >= 10 ? ` <span style="color:var(--warn)">Rien avant ${hm(r.firstStep)} : Samsung Health n’a pas transmis le début de journée à Health Connect.</span>` : ''}`
    : `<span style="color:var(--warn)">Aucun pas reçu de Health Connect aujourd’hui.</span> Dans Samsung Health → Paramètres → Health Connect, autorise l’<b>écriture</b> des pas ; Samsung Health les envoie ensuite toutes les quelques minutes à quelques heures.`;
  const phone = r.phoneSteps != null ? ` Podomètre du téléphone : <b>${fmt(r.phoneSteps)} pas</b>${r.phoneSteps > (r.todaySteps || 0) ? ' (utilisé, plus complet)' : ''}.` : '';
  return `<div style="margin:-2px 0 6px"><div class="between" style="gap:8px;align-items:flex-start"><span class="tiny muted">${txt}${phone} Synchro ${hm(r.at)}.</span>${btn}</div>
    ${errs.length ? `<details class="tiny muted"><summary>${errs.length} donnée(s) non lue(s) : ${esc(errs.map(([k]) => k).join(', '))}</summary>${errs.map(([k, v]) => `${esc(k)} : ${esc(v)}`).join('<br>')}</details>` : ''}</div>`;
}

// Nom lisible d'une appli quand Android ne donne que son identifiant (com.anthropic.claude → Claude).
const APP_NAMES = { 'com.whatsapp': 'WhatsApp', 'com.instagram.android': 'Instagram', 'com.zhiliaoapp.musically': 'TikTok', 'com.ss.android.ugc.trill': 'TikTok', 'com.google.android.youtube': 'YouTube', 'com.facebook.katana': 'Facebook', 'com.facebook.orca': 'Messenger', 'com.snapchat.android': 'Snapchat', 'com.twitter.android': 'X (Twitter)', 'com.android.chrome': 'Chrome', 'com.sec.android.app.sbrowser': 'Samsung Internet', 'com.google.android.gm': 'Gmail', 'com.samsung.android.messaging': 'Messages', 'com.google.android.apps.messaging': 'Messages', 'com.spotify.music': 'Spotify', 'com.netflix.mediaclient': 'Netflix', 'com.reddit.frontpage': 'Reddit', 'com.linkedin.android': 'LinkedIn', 'org.telegram.messenger': 'Telegram', 'com.discord': 'Discord', 'com.google.android.apps.maps': 'Google Maps', 'com.waze': 'Waze', 'com.sec.android.gallery3d': 'Galerie', 'com.sec.android.app.camera': 'Appareil photo', 'com.samsung.android.dialer': 'Téléphone', 'com.android.vending': 'Play Store', 'com.anthropic.claude': 'Claude', 'com.openai.chatgpt': 'ChatGPT', 'tv.twitch.android.app': 'Twitch', 'com.pinterest': 'Pinterest', 'com.amazon.mShop.android.shopping': 'Amazon' };
export function appName(n = '') {
  if (!/^[a-z][\w]*(\.[\w]+)+$/i.test(n)) return n;
  if (APP_NAMES[n]) return APP_NAMES[n];
  const parts = n.split('.').filter((x) => !/^(com|org|net|fr|io|app|android|apps|mobile|client|sec|google|samsung|main|prod|release)$/i.test(x));
  const w = parts.at(-1) || n.split('.').at(-1);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// Le compteur du téléphone ne connaît pas les pas faits avant le premier relevé : on l'indique.
function stepsSince(st) {
  const ss = st.stepSamples || [], d0 = new Date().setHours(0, 0, 0, 0);
  if (ss.some((x) => x.t <= d0)) return 'actif';
  const first = ss.find((x) => x.t > d0);
  return first ? `actif · compte depuis ${new Date(first.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'actif';
}

function sourcesCard(st) {
  const d = st.healthDiag;
  if (!N.isNative) return `<div class="card">
      <div class="card-head"><h2>${icon('refresh', 18)} Données automatiques</h2></div>
      <p class="small muted" style="margin-top:-6px">Dans l’application Android, pas, sommeil et temps d’écran arrivent tout seuls. Ici : capture d’écran ou fichier CSV.</p>
      <div class="grid2"><button class="btn soft" id="shot">${icon('image', 18)} Capture d’écran</button><button class="btn ghost" id="csv-btn">${icon('upload', 18)} Import CSV</button></div>
      <details style="margin-top:10px"><summary class="small">Format CSV ${icon('right', 14)}</summary><p class="tiny muted">Export Google Fit (Takeout → « Daily activity metrics ») ou ce modèle :</p><pre class="tiny" style="white-space:pre-wrap;background:var(--card-2);padding:8px;border-radius:10px">${esc(CSV_TEMPLATE)}</pre></details>
      <input id="csv" type="file" accept=".csv,text/csv" hidden><div id="sync-res" class="small" style="margin-top:8px"></div></div>`;
  const hc = !d ? ['…', 'vérification'] : d.ok ? ['ok', `connecté${d.steps ? '' : ' (pas non autorisés)'}`] : d.reason === 'unavailable' ? ['bad', d.info?.managedProfile ? 'bloqué (profil géré)' : 'indisponible sur ce téléphone'] : d.reason === 'update' ? ['warn', 'mise à jour nécessaire'] : d.reason === 'denied' ? ['warn', 'accès non autorisé'] : ['bad', 'erreur'];
  const line = (ic, name, [lvl, txt], btn) => `<div class="between" style="padding:8px 0;border-top:1px solid var(--line)"><span class="small">${icon(ic, 14)} <b>${name}</b> · <span style="color:var(--${lvl === 'ok' ? 'good' : lvl === 'warn' ? 'warn' : lvl === 'bad' ? 'bad' : 'muted'})">${txt}</span></span>${btn || ''}</div>`;
  return `<div class="card">
    <div class="card-head"><h2>${icon('refresh', 18)} Données du téléphone</h2>${st.lastSync ? `<span class="tiny muted">à jour ${new Date(st.lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}</div>
    <p class="tiny muted" style="margin-top:-6px">Synchronisées automatiquement à chaque ouverture de l’application.</p>
    ${line('heart', 'Health Connect', hc, d?.ok ? (d.missing?.length ? `<button class="btn sm soft" id="hc">+ de données</button>` : '') : `<button class="btn sm soft" id="hc">${d?.reason === 'unavailable' || d?.reason === 'update' ? 'Pourquoi ?' : 'Autoriser'}</button>`)}
    ${d?.ok ? hcReportLine(st.hcReport) : ''}
    ${st.hcSteps ? line('steps', 'Pas', ['ok', st.stepsAccess ? 'Health Connect + podomètre du téléphone' : 'Health Connect'], st.stepsAccess ? '' : `<button class="btn sm soft" id="steps-on">+ Podomètre</button>`) : line('steps', 'Podomètre du téléphone', st.stepsAccess ? ['ok', stepsSince(st)] : ['muted', d?.ok ? 'inutile (Health Connect)' : 'non activé'], st.stepsAccess || d?.ok ? '' : `<button class="btn sm soft" id="steps-on">Activer</button>`)}
    ${line('phone', 'Temps d’écran', st.usageOk ? ['ok', 'autorisé'] : ['warn', 'non autorisé'], st.usageOk ? '' : `<button class="btn sm soft" id="usage">Autoriser</button>`)}
    <div id="sync-res" class="small" style="margin-top:8px"></div>
  </div>`;
}

function renderTrack(el, ctx) {
  const st = store.get();
  const key = store.dayKey(dayOffset);
  const d = store.getDay(key);
  const ws = st.workouts.filter((w) => w.date === key);
  const kg = st.profile.weight || 70;
  const due = E.weighDue(st);
  el.innerHTML = `
    ${sourcesCard(st)}
    ${dayOffset === 0 ? sleepWeekCard(st) : ''}
    <div class="card">
      <div class="between">
        <button class="icon-btn" id="prev" aria-label="Jour précédent">${icon('left')}</button>
        <b style="text-transform:capitalize">${dayOffset === 0 ? 'Aujourd’hui' : new Date(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
        <button class="icon-btn" id="next" aria-label="Jour suivant" ${dayOffset >= 0 ? 'disabled style="opacity:.3"' : ''}>${icon('right')}</button>
      </div>

      ${section('moon', 'Sommeil', 'var(--c-sleep)', d.sleepMinutes ? `<span class="small muted">${fmtMin(d.sleepMinutes)} de sommeil</span>` : '')}
      <div class="grid2"><div><label class="lbl" style="margin-top:0">Couché à</label><input data-k="bed" type="time" value="${esc(d.bed || '')}"></div><div><label class="lbl" style="margin-top:0">Levé à</label><input data-k="wake" type="time" value="${esc(d.wake || '')}"></div></div>
      <label class="lbl">Qualité</label>${faces('sleepQuality', d.sleepQuality)}

      ${section('smile', 'Humeur', 'var(--c-mood)')}
      ${faces('mood', d.mood)}
      <details class="more-fields" ${d.energy || d.stress ? 'open' : ''}><summary class="small muted">Énergie et stress${d.energy || d.stress ? '' : ' (facultatif)'}</summary>
      <label class="lbl">Énergie</label>${faces('energy', d.energy)}
      <label class="lbl">Stress</label>${faces('stress', d.stress)}</details>

      ${section('steps', 'Activité', 'var(--c-move)', '<span class="tiny muted">mesurée par le téléphone</span>')}
      <div class="ro-grid">
        ${stat('Pas', d.steps != null ? fmt(d.steps) : '—', '', 'steps')}
        ${stat('Calories brûlées', d.steps != null || ws.length ? fmt(E.activeKcal(d, ws, kg)) : '—', 'kcal', 'flame')}
        ${stat('Activité modérée', fmtMin((d.modMin || 0) + (d.vigMin || 0)), '', 'activity')}
        ${stat('Séances', ws.length ? ws.map((w) => `${SP.activity(w.type).label.split(' ')[0]} ${w.minutes}′`).join(', ') : '0', '', 'dumbbell')}
        ${d.walkMin ? stat('Temps de marche', fmtMin(d.walkMin), '', 'steps') : ''}
        ${d.distanceM ? stat('Distance', fmt(d.distanceM / 1000, 1), 'km', 'pin') : ''}
        ${d.floors ? stat('Étages montés', fmt(d.floors)) : ''}
        ${d.totalKcalHC ? stat('Dépense totale', fmt(d.totalKcalHC), 'kcal', 'flame') : ''}
      </div>
      ${watchStats(d)}

      ${section('phone', 'Bien-être numérique', 'var(--c-screen)', '<span class="tiny muted">mesuré par le téléphone</span>')}
      <div class="ro-grid">
        ${stat('Temps d’écran', fmtMin(d.screenMin))}
        ${stat('Réseaux sociaux', fmtMin(d.socialMin))}
        ${stat('Déverrouillages', d.unlocks != null ? fmt(d.unlocks) : '—')}
        ${stat('Téléphone avant de dormir', d.phoneBeforeBedMin != null ? `${d.phoneBeforeBedMin} min` : (d.phoneInBed ?? d.phoneInBedGuess) != null ? ((d.phoneInBed ?? d.phoneInBedGuess) ? 'oui' : 'non') : '—')}
      </div>
      ${d.topApps?.length ? `<p class="tiny muted" style="margin-top:8px">Applis les plus utilisées : ${d.topApps.map((a) => `${esc(appName(a.name))} (${fmtMin(a.minutes)})`).join(', ')}</p>` : ''}

      ${section('scale', 'Poids & boissons', 'var(--c-water)', due.due && dayOffset === 0 ? '<span class="badge moyen">pesée à faire</span>' : due.days != null ? `<span class="tiny muted">${due.days === 0 ? 'pesé aujourd’hui' : due.days === 1 ? 'pesé hier' : `pesé il y a ${due.days} j`}</span>` : '')}
      <div class="grid2">
        <div><label class="lbl" style="margin-top:0">Poids (kg)</label><input data-k="weight" type="number" inputmode="decimal" step="0.1" value="${esc(d.weight ?? '')}" placeholder="${due.last ? fmt(due.last.kg, 1) : ''}"></div>
        <div><label class="lbl" style="margin-top:0">Eau</label><div class="stepper"><button data-water="-250">−</button><input value="${fmt((d.waterMl || 0) / 10)} cL" readonly><button data-water="250">+</button></div></div>
      </div>
      <label class="lbl">Verres d’alcool <span class="tiny muted">(ajoutés automatiquement d’après tes repas)</span></label>
      <div class="stepper" style="max-width:180px"><button data-alc="-1">−</button><input value="${fmt(d.alcohol || 0, 1)}" readonly><button data-alc="1">+</button></div>

      <label class="lbl">Note libre</label><textarea data-k="note" placeholder="Douleurs, événements, ressenti…">${esc(d.note || '')}</textarea>
    </div>
    ${stoolCard(key)}`;

  const re = () => renderTrack(el, ctx);
  $$('[data-k]', el).forEach((inp) => inp.addEventListener('change', () => {
    const k = inp.dataset.k;
    const v = inp.type === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
    store.setDay(key, { [k]: v });
    if (k === 'weight' && v) { store.update((s) => { s.weights = s.weights.filter((w) => w.date !== key); s.weights.push({ date: key, kg: v }); if (dayOffset === 0) s.profile.weight = v; }); toast('Pesée enregistrée ⚖️', 1200); return; }
    toast('Enregistré', 900);
  }));
  bindFaces(el, (f, v) => store.setDay(key, { [f]: v }));
  $$('[data-water]', el).forEach((b) => (b.onclick = () => { store.setDay(key, { waterMl: Math.max(0, (store.getDay(key).waterMl || 0) + Number(b.dataset.water)) }); re(); }));
  $$('[data-alc]', el).forEach((b) => (b.onclick = () => { store.setDay(key, { alcohol: Math.max(0, (store.getDay(key).alcohol || 0) + Number(b.dataset.alc)) }); re(); }));
  $('#prev', el).onclick = () => { dayOffset--; re(); };
  $('#next', el).onclick = () => { if (dayOffset < 0) { dayOffset++; re(); } };
  $('#add-stool', el).onclick = () => ctx.action('stool');
  $$('[data-stool-del]', el).forEach((b) => (b.onclick = () => { const undo = store.removing((s) => { s.stools = s.stools.filter((x) => x.id !== b.dataset.stoolDel); }); re(); undoToast('Entrée supprimée', undo); }));
  if (N.isNative) {
    $('#hc', el)?.addEventListener('click', async () => {
      const res = $('#sync-res', el);
      res.innerHTML = '<span class="spinner"></span> Vérification de Health Connect…';
      // toujours un état frais (pas celui de la dernière ouverture) ; jamais plus de 25 s d'attente
      const d0 = await Promise.race([N.healthDiagnose().catch((e) => ({ ok: false, reason: 'error', detail: e.message || String(e) })),
        new Promise((r) => setTimeout(() => r({ ok: false, reason: 'error', detail: 'La vérification de Health Connect ne répond pas (plus de 25 s).' }), 25000))]);
      store.update((s) => { s.healthDiag = { ...d0, at: Date.now() }; });
      if (['unavailable', 'update'].includes(d0.reason)) { res.innerHTML = ''; return openHealthHelp(d0, re); }
      if (!d0.ok || d0.missing?.length) {
        try { await N.connectHealth((m) => { res.innerHTML = `<span class="spinner"></span> ${m}`; }); } catch (e) { res.innerHTML = ''; return openHealthHelp({ ...d0, reason: d0.reason === 'error' ? 'error' : 'denied', detail: e.message, log: [...(d0.log || []), ...(e.log || [])] }, re); }
      }
      res.innerHTML = '<span class="spinner"></span> Synchronisation…';
      const timedOut = await Promise.race([syncAll().then(() => false), new Promise((r) => setTimeout(() => r(true), 20000))]);
      if (timedOut) { res.innerHTML = ''; return openHealthHelp({ ...(store.get().healthDiag || d0), reason: 'error', detail: 'Accès accordés, mais la lecture des données ne répond pas (plus de 20 s).' }, re); }
      res.innerHTML = '';
      if (!store.get().healthDiag?.ok) return openHealthHelp(store.get().healthDiag, re);
      toast('Health Connect synchronisé ✅');
      re();
    });
    $('#hc-sync', el)?.addEventListener('click', async (e) => {
      e.target.closest('button').disabled = true;
      $('#sync-res', el).innerHTML = '<span class="spinner"></span> Synchronisation…';
      await syncAll();
      if (el.isConnected) re();
      const r = store.get().hcReport;
      toast(r?.todaySteps ? `${fmt(r.todaySteps)} pas aujourd’hui ✅` : 'Synchronisé, mais aucun pas reçu aujourd’hui');
    });
    $('#steps-on', el)?.addEventListener('click', async () => {
      const ok = await N.stepsAccess();
      store.update((s) => { s.stepsAccess = ok; });
      if (ok) { await syncAll({ silent: true }); toast('Podomètre activé 👟'); } else toast('Autorisation « activité physique » refusée');
      re();
    });
    $('#usage', el)?.addEventListener('click', () => openUsageHelp());
    // états des accès, rafraîchis en arrière-plan
    Promise.all([N.usagePermission().catch(() => false), N.stepsHasAccess()]).then(([u, sa]) => {
      if (u !== store.get().usageOk || sa !== !!store.get().stepsAccess) { store.update((s) => { s.usageOk = u; s.stepsAccess = sa; }); if (el.isConnected) re(); }
    });
  } else {
    $('#shot', el).onclick = () => readShots(key, el, ctx);
    $('#csv-btn', el).onclick = () => $('#csv', el).click();
    $('#csv', el).onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const rows = parseCSV(await f.text());
      merge(rows);
      toast(`${Object.keys(rows).length} jour(s) importé(s)`);
      re();
    };
  }
}

// Explique pourquoi Health Connect ne répond pas, et ouvre directement la bonne page des réglages.
// Après deux refus, Android n'affiche plus la fenêtre d'autorisation : il faut activer l'accès depuis Health Connect.
function openHealthHelp(d = {}, done) {
  const inf = d.info || {};
  const diag = [`Diana ${N.installedVersion() || '?'}`, `Android ${inf.release || '?'} (API ${inf.sdk || '?'})`, inf.maker, inf.managedProfile ? 'profil géré par une organisation' : null, inf.sdk && inf.sdk < 34 ? `appli Health Connect ${inf.hcApp ? 'installée' : 'absente'}` : null, d.detail].filter(Boolean).join(' · ');
  const body = sheet(`
    ${d.reason === 'unavailable' || d.reason === 'update' ? `<div class="note warn">${icon('shield', 18)}<span>${d.reason === 'update' ? 'Health Connect doit être <b>mis à jour</b> depuis le Play Store.' : inf.managedProfile ? 'Diana Health est installée dans un <b>profil géré par une organisation</b> (profil professionnel) : Health Connect n’y est pas disponible. Installe l’APK dans ton profil personnel.' : inf.sdk && inf.sdk < 34 && !inf.hcApp ? 'Sur ton Android, Health Connect est une application à installer depuis le Play Store.' : 'Health Connect n’est pas disponible sur ce téléphone.'}</span></div>`
      : `${d.detail ? `<div class="note bad" style="margin:0 0 10px">${icon('alert', 18)}<span><b>Pourquoi ça ne marche pas :</b> ${esc(d.detail)}</span></div>` : ''}<p class="small" style="margin-top:0">${d.reason === 'denied' ? 'Diana Health n’a pas encore accès à tes données. Si aucune fenêtre ne s’est ouverte, c’est normal : <b>Android ne la réaffiche plus après deux refus</b>.' : 'La fenêtre d’autorisation n’a pas pu s’ouvrir.'}</p>
      <ol class="small" style="padding-left:20px;line-height:1.7;margin:6px 0 12px"><li>Touche <b>Ouvrir les autorisations</b> ci-dessous.</li><li>Active <b>Tout autoriser</b> (ou au moins Pas, Sommeil, Exercice, Poids).</li><li>Reviens dans Diana Health : la synchronisation se lance seule.</li></ol>
      <p class="tiny muted">Sur Android en français, Health Connect s’appelle <b>« Connexion santé »</b> (Paramètres → Sécurité et confidentialité → Confidentialité → Connexion santé, ou Paramètres → Applications → Connexion santé). Ce n’est pas « Bien-être numérique », qui sert au temps d’écran.</p>
      <p class="tiny muted">Il faut aussi qu’une application <b>écrive</b> dans Health Connect (Samsung Health, Google Fit, Fitbit, ta montre…). Dans Samsung Health : Paramètres → Health Connect → autoriser l’écriture.</p>`}
    <button class="btn block" id="open-hc">${icon('settings', 18)} ${d.reason === 'unavailable' || d.reason === 'update' ? 'Ouvrir Health Connect / Play Store' : 'Ouvrir les autorisations'}</button>
    <div class="note" style="margin-top:12px">${icon('steps', 18)}<span>En attendant, le <b>podomètre du téléphone</b> compte tes pas sans Health Connect.</span></div>
    <button class="btn ghost block" id="steps2">${icon('steps', 18)} Activer le podomètre</button>
    <p class="tiny muted" style="margin-top:12px">Diagnostic : ${esc(diag || d.reason || 'inconnu')}</p>
    ${d.log?.length ? `<details class="tiny muted"><summary>Journal de la tentative</summary><pre style="white-space:pre-wrap;margin:6px 0 0">${esc(d.log.join('\n'))}</pre></details>` : ''}
    <button class="btn ghost block sm" id="hc-copy" style="margin-top:8px">${icon('copy', 16)} Copier le rapport</button>`, { title: 'Health Connect', onClose: done });
  $('#hc-copy', body).onclick = async () => {
    const txt = [`Rapport Health Connect – ${new Date().toLocaleString('fr-FR')}`, `Raison : ${d.reason || '?'}`, d.detail ? `Erreur : ${d.detail}` : '', `Diagnostic : ${diag}`, ...(d.log || [])].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Rapport copié : colle-le dans ton message'); } catch { toast('Copie impossible'); }
  };
  $('#open-hc', body).onclick = async () => {
    try { await N.openHealthPermissions(); } catch { await N.openHealthSettings().catch(() => toast('Impossible d’ouvrir Health Connect')); }
    // au retour dans l'application : nouvelle tentative de synchronisation
    const back = async () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', back);
      await syncAll({ silent: true });
      const ok = store.get().healthDiag?.ok;
      toast(ok ? 'Health Connect connecté ✅' : 'Toujours pas d’accès à Health Connect');
      if (ok) body.close();
    };
    document.addEventListener('visibilitychange', back);
  };
  $('#steps2', body).onclick = async () => { const ok = await N.stepsAccess(); store.update((s) => { s.stepsAccess = ok; }); if (ok) await syncAll({ silent: true }); toast(ok ? 'Podomètre activé 👟' : 'Autorisation refusée'); body.close(); };
}

// Pesée rapide (rappel toutes les 2 semaines).
export function openWeigh(done) {
  const last = E.weighDue(store.get()).last;
  const body = sheet(`
    <p class="small muted" style="margin-top:0">Le matin, à jeun, après être passé aux toilettes : c’est la mesure la plus comparable d’une fois sur l’autre. Toutes les 2 semaines suffit.</p>
    <div class="stepper"><button data-d="-0.1">−</button><input id="kg" type="number" inputmode="decimal" step="0.1" value="${last ? last.kg : store.get().profile.weight || 70}"><button data-d="0.1">+</button></div>
    <button class="btn block" id="ok" style="margin-top:14px">${icon('check', 18)} Enregistrer</button>
    ${srcLinks(['zheng2014', 'burke2011'])}`, { title: 'Pesée', onClose: done });
  $$('[data-d]', body).forEach((b) => (b.onclick = () => { const i = $('#kg', body); i.value = (Math.round((Number(i.value) + Number(b.dataset.d)) * 10) / 10).toFixed(1); }));
  $('#ok', body).onclick = () => {
    const v = Number($('#kg', body).value);
    if (!v) return;
    const k = store.today();
    store.update((s) => { s.weights = s.weights.filter((w) => w.date !== k); s.weights.push({ date: k, kg: v }); s.profile.weight = v; s.days[k] = { ...(s.days[k] || {}), weight: v }; });
    toast('Pesée enregistrée ⚖️');
    body.close();
  };
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
// Chaque graphique peut passer de barres à courbe (préférence mémorisée).
const chartTypes = () => { try { return JSON.parse(localStorage.getItem('dh-charts') || '{}'); } catch { return {}; } };
function renderTrends(el) {
  const st = store.get();
  const keys = store.lastDays(14);
  const t = S.targets(st.profile);
  const types = chartTypes();
  const kg = st.profile.weight || 70;
  const series = (fn) => keys.map((k) => ({ label: new Date(k).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }), short: k.slice(8), v: fn(st.days[k] || {}, k) ?? null }));
  const sleepFn = (x) => (x.sleepMinutes ? x.sleepMinutes / 60 : S.sleepHours(x.bed, x.wake));
  const card = (id, ic, title, col, pts, opts, src = []) => {
    const type = types[id] || 'bar';
    return `<div class="card" data-chart="${id}"><div class="card-head"><h2><span style="color:${col}">${icon(ic, 18)}</span> ${title}</h2><button class="chart-toggle" data-toggle="${id}" aria-label="${type === 'bar' ? 'Afficher en courbe' : 'Afficher en barres'}">${icon(type === 'bar' ? 'trend' : 'list', 16)}</button></div>${barChart(pts, { ...opts, color: col, type })}${srcLinks(src)}</div>`;
  };
  const we = E.weightEstimate(st);
  el.innerHTML = [
    linksCard(st),
    weightCard(we),
    card('sleep', 'moon', 'Sommeil', 'var(--c-sleep)', series(sleepFn), { ref: 7, fmtV: (v) => fmtMin(v * 60) }, ['watson2015']),
    card('steps', 'steps', 'Pas', 'var(--c-move)', series((x) => x.steps), { ref: t.steps, unit: 'pas' }, ['paluch2022']),
    card('burn', 'flame', 'Calories brûlées par l’activité', 'var(--c-move)', series((x, k) => (x.steps != null || st.workouts.some((w) => w.date === k) ? E.activeKcal(x, st.workouts.filter((w) => w.date === k), kg) : null)), { unit: 'kcal' }, ['herrmann2024']),
    card('mood', 'smile', 'Humeur', 'var(--c-mood)', series((x) => x.mood), { unit: '/5' }),
    card('screen', 'phone', 'Temps d’écran', 'var(--c-screen)', series((x) => x.screenMin), { fmtV: fmtMin }),
    card('social', 'share', 'Réseaux sociaux', 'var(--c-screen)', series((x) => x.socialMin), { ref: 30, fmtV: fmtMin }, ['hunt2018']),
    card('kcal', 'utensils', 'Calories consommées', 'var(--c-food)', keys.map((k) => ({ label: k, short: k.slice(8), v: store.mealsOn(k).length ? S.sumNutrients(store.mealsOn(k)).kcal : null })), { ref: t.kcal, unit: 'kcal' }),
    digestionCard(),
  ].join('');
  el.onclick = (e) => {
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const ty = chartTypes();
      ty[tg.dataset.toggle] = (ty[tg.dataset.toggle] || 'bar') === 'bar' ? 'line' : 'bar';
      try { localStorage.setItem('dh-charts', JSON.stringify(ty)); } catch { /* stockage indisponible */ }
      renderTrends(el);
      return;
    }
    const tip = e.target.closest('[data-tip]');
    if (tip) tip.closest('.card').querySelector('.tip').textContent = tip.dataset.tip;
    if (e.target.closest('#weigh-now')) openWeigh(() => renderTrends(el));
  };
}

// Poids réel (pesées) vs poids estimé d'après les repas notés et l'activité mesurée.
function weightCard(we) {
  const head = `<div class="card-head"><h2><span style="color:var(--c-water)">${icon('scale', 18)}</span> Poids : réel et estimé</h2><button class="btn sm soft" id="weigh-now">${icon('plus', 14)} Pesée</button></div>`;
  if (!we || we.real.length < 1) return `<div class="card">${head}<p class="small muted" style="margin:0">Pèse-toi toutes les 2 semaines : on compare ton poids réel à celui calculé d’après tes repas et ton activité.</p></div>`;
  const msg = we.gap == null
    ? `Prochaine pesée dans quelques jours pour comparer avec l’estimation (${Math.round(we.coverage * 100)} % des jours avec repas notés).`
    : Math.abs(we.gap) < 0.5 ? `Estimation fidèle : ${we.gap > 0 ? '+' : ''}${fmt(we.gap, 1)} kg d’écart. Tes repas sont bien notés 👏`
    : we.gap > 0 ? `Tu pèses ${fmt(we.gap, 1)} kg de plus que l’estimation : il manque probablement ~${fmt(Math.abs(we.gapKcalPerDay))} kcal/j dans tes repas notés (grignotages, boissons, sauces, portions).`
    : `Tu pèses ${fmt(Math.abs(we.gap), 1)} kg de moins que l’estimation : portions surestimées ou dépense plus élevée que prévu (~${fmt(Math.abs(we.gapKcalPerDay))} kcal/j).`;
  return `<div class="card">${head}
    ${timeChart([{ name: 'Estimé (repas + activité)', color: 'var(--c-food)', pts: we.est, dashed: true }, { name: 'Réel (pesées)', color: 'var(--c-water)', pts: we.real.length > 1 ? we.real : [...we.real, { ...we.real[0], t: we.est.at(-1).t }], dots: true }], { unit: 'kg' })}
    <div class="note ${we.gap != null && Math.abs(we.gap) >= 1 ? 'warn' : ''}" style="margin-top:8px">${icon('info', 18)}<span>${msg}</span></div>
    ${srcLinks(['hall2011', 'dhurandhar2015', 'subar2015'])}</div>`;
}

// Ce qui joue sur ton sommeil et ton humeur : tes propres jours comparés entre eux.
function linksCard(st) {
  const found = correlations(st).slice(0, 5);
  return `<div class="card"><div class="card-head"><h2>${icon('bulb', 18)} Ce qui joue sur ton sommeil et ton humeur</h2></div>
    ${found.length ? found.map((c) => `<div class="link-row"><span style="color:var(${c.good ? '--good' : '--warn'})">${icon(c.good ? 'ok' : 'alert', 18)}</span><div><div class="small" style="font-weight:600">${esc(c.text)}</div><div class="tiny muted">${c.nYes} jours comparés à ${c.nNo}</div></div></div>`).join('')
      : '<p class="small muted" style="margin:0">Il faut quelques semaines de données (sommeil, pas, humeur…) pour repérer ce qui t’aide vraiment. Continue à noter ton sommeil et à répondre à la question du jour.</p>'}
    <p class="tiny muted" style="margin:10px 0 0">Comparaison de tes propres jours sur 60 jours : c’est une piste, pas une preuve que l’un cause l’autre.</p></div>`;
}

// ---------- Projection ----------
function renderFuture(el) {
  const st = store.get();
  const sm = summary();
  const b = sm.body, t = sm.t;
  const pr = C.projection(sm, st.profile);
  const cur = pr.current, imp = pr.improved;
  const factors = [...cur[0].factors].sort((a, c) => c.rr - a.rr);
  const riskSentence = (now, later, yrs) => {
    const pct = Math.abs(Math.round((now - 1) * 100));
    const a = now > 1.02 ? `Aujourd’hui, ton risque est <b style="color:var(--bad)">${pct} % plus élevé</b> que la référence.` : now < 0.98 ? `Aujourd’hui, ton risque est <b style="color:var(--good)">${pct} % plus faible</b> que la référence. Bravo !` : 'Aujourd’hui, ton risque est <b>dans la moyenne</b> de la référence.';
    const gain = later != null ? Math.round((now - later) * 100) : 0;
    return a + (gain > 1 ? ` En suivant les conseils, tu peux le réduire d’environ <b>${gain} points</b>${yrs ? ` d’ici ${yrs} an${yrs > 1 ? 's' : ''}` : ''}.` : '');
  };
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
      <div class="card-head"><h2>${icon('heart', 18)} Ton risque santé</h2></div>
      <p class="small" style="margin-top:-6px">${riskSentence(cur[0].rr, imp.at(-1)?.rr, imp.at(-1)?.years)}</p>
      <p class="tiny muted">Risque de maladie (cœur, diabète, certains cancers…) comparé à une personne du même âge aux habitudes recommandées : <b style="color:var(--good)">−</b> = plus faible, <b style="color:var(--bad)">+</b> = plus élevé.</p>
      <table><tr><th></th>${cur.map((c) => `<th class="num">${c.years === 0 ? 'Auj.' : c.years + ' an' + (c.years > 1 ? 's' : '')}</th>`).join('')}</tr>
        <tr><td><span style="color:var(--series-2)">●</span> Si rien ne change</td>${cur.map((c) => `<td class="num" style="white-space:nowrap">${rrTxt(c.rr)}</td>`).join('')}</tr>
        <tr><td><span style="color:var(--series-1)">●</span> En suivant les conseils</td>${imp.map((c) => `<td class="num" style="white-space:nowrap"><b>${rrTxt(c.rr)}</b></td>`).join('')}</tr></table>
      <h3 style="font-size:.9rem;margin:18px 0 2px">Ce qui pèse le plus</h3>
      <p class="tiny muted" style="margin:0 0 4px">Chaque habitude et son effet sur ce risque. En rouge : à améliorer en priorité.</p>
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
      <p class="small muted" style="margin-top:-6px">${total} résultats clés · ${Object.keys(S.SOURCES).length} publications</p>
      <input id="sci-q" type="search" placeholder="Rechercher : sommeil, protéines, café, écrans…" value="${esc(query)}">
    </div>
    <div id="sci-list"></div>
    <p class="tiny muted" style="text-align:center">Les études d’observation montrent des associations, pas forcément des causes. Les essais randomisés et méta-analyses sont privilégiés.</p>`;
  $('#sci-q', el).addEventListener('input', (e) => { query = e.target.value; draw(); });
  draw();
}

// ---------- Bilan sommeil de la semaine ----------
const keys7 = () => Array.from({ length: 7 }, (_, i) => store.dayKey(i - 6));
export function sleepWeekCard(st) {
  const w = S.sleepWeek(st.days, st.profile, keys7());
  const head = `<div class="card-head"><h2><span style="color:var(--c-sleep)">${icon('moon', 18)}</span> Sommeil des 7 derniers jours</h2></div>`;
  if (!w.noted) return `<div class="card">${head}<p class="small muted" style="margin:0">Aucune nuit notée cette semaine. Continue à noter ton sommeil (bouton du soir, widget ou Health Connect) pour voir ton bilan.</p></div>`;
  const tgt = w.need.target * 60, top = Math.max(tgt, ...w.nights.map((n) => n.min || 0)) * 1.1;
  const jl = S.socialJetlag(st.days, Array.from({ length: 28 }, (_, i) => store.dayKey(i - 27)), st.profile.work?.enabled ? st.profile.work.days : [1, 2, 3, 4, 5]);
  const debt = w.debt;
  const verdict = debt > 60 ? ['var(--warn)', `il te manque ${fmtMin(debt)}`] : debt < -60 ? ['var(--good)', `${fmtMin(-debt)} de plus que ton besoin`] : ['var(--good)', 'ton besoin est couvert'];
  return `<div class="card">${head}
    <div class="grid2" style="gap:10px">
      <div><div class="tiny muted">Dormi</div><div style="font-size:1.35rem;font-weight:800">${fmtMin(w.slept)}</div><div class="tiny muted">${w.noted} nuit${w.noted > 1 ? 's' : ''} notée${w.noted > 1 ? 's' : ''} · ${fmtMin(w.avg)} en moyenne</div></div>
      <div><div class="tiny muted">Conseillé</div><div style="font-size:1.35rem;font-weight:800">${fmtMin(w.needed)}</div><div class="tiny muted">${fmtMin(w.need.target * 60)} par nuit (${w.need.min}–${w.need.max} h à ton âge)</div></div>
    </div>
    <p class="small" style="margin:10px 0 4px"><b style="color:${verdict[0]}">Bilan : ${verdict[1]}</b>${debt > 60 ? `, soit ${fmtMin(Math.round(debt / w.noted))} par nuit.` : '.'}${w.short ? ` <span class="muted">${w.short} nuit${w.short > 1 ? 's' : ''} sous ${w.need.min} h.</span>` : ''}</p>
    <div class="sw-plot" role="img" aria-label="Sommeil nuit par nuit face à l’objectif de ${fmtMin(tgt)}">
      <i class="sw-target" style="bottom:${(tgt / top) * 100}%"><span>${fmtMin(tgt)}</span></i>
      ${w.nights.map((n) => `<div class="sw-bar ${n.min && n.min < w.need.min * 60 ? 'short' : ''}" style="height:${n.min ? Math.max(3, (n.min / top) * 100) : 0}%"></div>`).join('')}
    </div>
    <div class="sw-days">${w.nights.map((n) => `<span>${new Date(`${n.key}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}<b>${n.min ? `${Math.floor(n.min / 60)}h${String(n.min % 60).padStart(2, '0')}` : '–'}</b></span>`).join('')}</div>
    <div class="legend" style="margin-top:6px"><span><i style="background:var(--c-sleep)"></i>nuit</span><span><i style="background:var(--warn)"></i>moins de ${w.need.min} h</span><span><i style="background:none;border-top:2px dashed var(--muted);height:0;border-radius:0"></i>objectif</span></div>
    ${debt > 120 ? `<div class="note" style="margin-top:10px">${icon('bulb', 18)}<span>La dette s’accumule : dormir 6 h pendant 2 semaines pèse sur l’attention autant qu’une nuit blanche. La rattraper le week-end ne suffit pas : mieux vaut avancer le coucher de 20 à 30 min chaque soir.</span></div>` : ''}
    ${jl != null ? `<p class="small" style="margin:10px 0 0">${icon('clock', 14)} Décalage horaire social : <b style="color:${jl >= 60 ? 'var(--warn)' : 'var(--good)'}">${fmtMin(jl)}</b> <span class="muted">${jl >= 60 ? 'entre ta semaine et tes jours libres. Au-delà d’1 h, c’est associé à plus de surpoids : garde des horaires proches le week-end.' : 'entre semaine et jours libres : horaires réguliers.'}</span></p>` : ''}
    ${srcLinks(['hirshkowitz2015', 'vandongen2003', 'depner2019', ...(jl != null ? ['wittmann2006', 'roenneberg2012'] : [])])}
  </div>`;
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

// Digestion : synthèse lisible du transit, puis aliments à tester (avec explication du calcul).
function digestionCard() {
  const st = store.get();
  const sum = D.digestionSummary(st.stools);
  const sus = D.suspects(st.stools, st.meals);
  const head = `<div class="card-head"><h2><span style="color:var(--c-food)">${icon('activity', 18)}</span> Digestion</h2></div>`;
  const how = `<details style="margin-top:10px"><summary class="small">${icon('info', 14)} Comment ça marche ?</summary><p class="tiny muted" style="margin:6px 0 0">Note chaque passage aux toilettes (bouton +) avec l’échelle de Bristol, qui reflète la vitesse du transit. L’application regarde ensuite ce que tu as mangé 8 à 48 h avant (le temps moyen de transit est d’environ 1 jour) : si un aliment revient souvent avant des selles difficiles, des douleurs ou des ballonnements, il est signalé « à tester ».</p></details>`;
  if (!sum) return `<div class="card">${head}<p class="small muted" style="margin:0">Pas encore de passage noté sur 14 jours.</p>${how}${srcLinks(['lewis1997', 'asnicar2021'])}</div>`;
  const total = sum.count;
  const pOk = Math.round((sum.zones.ok / total) * 100);
  const verdict = sum.zones.lent / total > 0.4 ? ['Plutôt lent', 'var(--warn)', 'Selles souvent dures : plus de fibres, d’eau et de marche.'] : sum.zones.rapide / total > 0.4 ? ['Plutôt rapide', 'var(--warn)', 'Selles souvent molles : regarde les aliments à tester ci-dessous.'] : ['Normal', 'var(--good)', 'Ton transit est dans la norme.'];
  const seg = (n, col) => (n ? `<div style="width:${(n / total) * 100}%;background:${col}"></div>` : '');
  const badN = st.stools.filter(D.isBad).length;
  return `<div class="card">${head}
    <div class="between"><div><div class="tiny muted">Ton transit sur 14 jours</div><div style="font-size:1.3rem;font-weight:800;color:${verdict[1]}">${verdict[0]}</div></div><div style="text-align:right"><div style="font-size:1.3rem;font-weight:800">${fmt(sum.perWeek, 1)}</div><div class="tiny muted">passages / semaine</div></div></div>
    <p class="small" style="margin:6px 0">${verdict[2]} <span class="muted">${pOk} % de selles idéales (types 3–4).</span></p>
    <div class="bar-mini" style="display:flex;height:10px;margin:8px 0 4px">${seg(sum.zones.lent, 'var(--warn)')}${seg(sum.zones.ok, 'var(--good)')}${seg(sum.zones.rapide, 'var(--c-move)')}</div>
    <div class="legend"><span><i style="background:var(--warn)"></i>dures</span><span><i style="background:var(--good)"></i>idéales</span><span><i style="background:var(--c-move)"></i>molles</span></div>
    ${sum.advice.filter((a) => a.level !== 'bon').slice(0, 2).map((a) => `<div class="note ${a.level === 'alerte' ? 'bad' : 'warn'}" style="margin:8px 0">${icon('alert', 16)}<span>${esc(a.text)}</span></div>`).join('')}
    <h3 style="font-size:.95rem;margin:16px 0 4px">Aliments à tester</h3>
    ${sus.length ? `<p class="tiny muted" style="margin:0 0 6px">Souvent mangés dans les 8–48 h avant un passage difficile :</p>${sus.map((x) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="between small"><b style="text-transform:capitalize">${esc(x.word)}</b><span style="color:var(--warn);font-weight:700">${x.bad} fois sur ${x.total}</span></div><div class="bar-mini" style="margin-top:4px"><div style="width:${Math.round(x.rate * 100)}%;background:var(--warn)"></div></div></div>`).join('')}
      <div class="note" style="margin-top:8px">${icon('bulb', 18)}<span>Pour vérifier : retire l’aliment 2 à 3 semaines, puis réintroduis-le. Si les troubles reviennent, le lien est probable. Idéalement avec un médecin ou un diététicien.</span></div>`
    : `<p class="small muted" style="margin:0">${badN < 2 ? `Rien à signaler : il faut au moins 2 passages difficiles (dures, molles, douleurs ou ballonnements) pour commencer à chercher un aliment en cause${badN ? ` — 1 noté pour l’instant` : ''}.` : 'Aucun aliment ne revient de façon répétée avant tes passages difficiles.'}</p>`}
    ${how}
    ${srcLinks(['lewis1997', 'asnicar2021', 'halmos2014', 'vandeputte2016'])}
  </div>`;
}

// Accès « données d'utilisation » : Android 13+ le bloque pour les applis installées hors Play Store
// tant que les « paramètres restreints » ne sont pas autorisés pour l'appli.
export function openUsageHelp() {
  const body = sheet(`
    <p class="small" style="margin-top:0">Cet accès sert à mesurer ton temps d’écran, tes réseaux sociaux et à <b>détecter ton réveil</b>. Les données restent sur ton téléphone.</p>
    <div class="note warn">${icon('shield', 18)}<span>Si Android affiche « Contrôlé par les paramètres restreints » ou « L’accès a été refusé à cette appli », c’est normal pour une application installée hors Play Store : il faut d’abord l’autoriser une fois.</span></div>
    <ol class="small" style="padding-left:20px;line-height:1.7">
      <li>Touche <b>Ouvrir les infos de l’appli</b> ci-dessous.</li>
      <li>En haut à droite, touche <b>⋮</b> puis <b>Autoriser les paramètres restreints</b> et confirme (code ou empreinte).</li>
      <li>Reviens ici et touche <b>Activer l’accès</b>, puis active <b>Diana Health</b>.</li>
    </ol>
    <p class="tiny muted">Si l’option n’apparaît pas dans le menu ⋮, ton téléphone est géré par une organisation qui l’interdit : l’import par capture d’écran reste possible.</p>
    <div class="grid2"><button class="btn ghost" id="info">${icon('settings', 18)} Ouvrir les infos de l’appli</button><button class="btn" id="usage-go">${icon('phone', 18)} Activer l’accès</button></div>`, { title: 'Temps d’écran et réveil' });
  $('#info', body).onclick = () => N.openAppInfo();
  $('#usage-go', body).onclick = () => { N.openUsageSettings(); body.close(); };
}
