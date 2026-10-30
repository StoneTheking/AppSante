// Accueil : score, prochaine étape, actions rapides, plan de la journée, nutrition, analyses.
import * as store from '../store.js';
import * as S from '../science.js';
import * as C from '../coach.js';
import { summary, taste, refreshReminders } from '../context.js';
import * as SL from '../sleep.js';
import * as N from '../native.js';
import { questsCard, bindQuests } from './progress.js';
import { aqiLabel } from '../env.js';
import { icon, esc, fmt, fmtMin, srcLinks, rings, DOMAIN, sheet, toast, onTapHold, $, $$ } from '../ui.js';
import * as R from '../review.js';
import { correlations } from '../correlate.js';
import { goodNightTips } from './actions.js';
import { openWeigh } from './health.js';
import { weighDue } from '../energy.js';

const PLAN_ICONS = { '🌅': 'sunrise', '🌇': 'sun', '⭐': 'star', '⚡': 'zap', '🌳': 'leaf', '☀️': 'sunrise', '🍳': 'coffee', '☕': 'coffee', '🥗': 'salad', '🚶': 'steps', '😴': 'bed', '🏃': 'dumbbell', '🍎': 'apple', '🍽️': 'utensils', '📵': 'phone', '🧘': 'brain', '🌙': 'moon', '💼': 'work' };
const LEVEL_ICON = { bon: 'ok', attention: 'alert', alerte: 'alert' };
let showAllPlan = false;

export function meter(label, v, max, unit, color, inverse = false) {
  const p = Math.min(100, max ? (v / max) * 100 : 0);
  return `<div class="meter ${inverse && v > max ? 'over' : ''}"><div class="between"><span>${label}</span><span class="muted"><b style="color:var(--text)">${fmt(v)}</b> / ${fmt(max)} ${unit}</span></div>
    <div class="track"><div class="fill" style="width:${p}%;background:${color}"></div></div></div>`;
}

function headline(sm, profile = {}) {
  const s = sm.scores;
  const entries = Object.entries(s).filter(([k, v]) => k !== 'global' && k !== 'humeur' && v != null);
  if (entries.length < 2) return 'Note ta nuit et tes repas, synchronise tes pas : ton score se construit en quelques jours.';
  const worst = entries.sort((a, b) => a[1] - b[1])[0];
  const msgs = {
    sommeil: 'Ta priorité : le sommeil. Vise un coucher régulier ce soir.',
    activite: `Ta priorité : bouger plus. 30 min de ${C.activityLabel(['marche', 'velo', 'course'], profile).toLowerCase().split(', ')[0].split(' ou ')[0]} feraient la différence.`,
    alimentation: 'Ta priorité : l’assiette. Plus de légumes, fibres et produits bruts.',
    humeur: 'Prends soin de ton moral : lumière du jour, activité et contacts sociaux.',
    numerique: 'Ta priorité : lever le pied sur les écrans, surtout le soir.',
  };
  return worst[1] >= 75 ? 'Excellente semaine, continue comme ça !' : msgs[worst[0]];
}

export function render(view, ctx) {
  const st = store.get();
  const { profile } = st;
  const sm = summary();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const plan = C.applyPlanEdits(C.dailyPlan(sm, profile), st.planEdits, store.today());
  // après minuit et avant le réveil, on est encore dans la journée d'hier (coucher à 00:30 = 24:30)
  const [wh, wm] = (profile.wakeTime || '07:00').split(':').map(Number);
  const nowAdj = nowMin < wh * 60 + wm - 60 ? nowMin + 1440 : nowMin;
  let nextIdx = plan.findIndex((p) => p.min >= nowAdj);
  if (nextIdx === -1) nextIdx = plan.length;
  const order = { alerte: 0, attention: 1, bon: 2 };
  const ins = C.insights(sm).sort((a, b) => order[a.level] - order[b.level]).slice(0, 3);
  const t = sm.t, tot = sm.totToday, d = sm.today;
  const water = d.waterMl || 0;
  const visiblePlan = showAllPlan ? plan : plan.slice(Math.max(0, nextIdx - 1), nextIdx + 4);

  // la bannière se fie à la version réellement installée : après la mise à jour, l’ancien « disponible » enregistré ne compte plus
  const up = st.update?.available && N.installedVersion() && N.isNewer(st.update.latest, N.installedVersion()) ? st.update : null;
  view.innerHTML = `
    ${up ? `<div class="note" style="margin:4px 0 10px">${icon('download', 18)}<span style="flex:1"><b>Mise à jour ${esc(up.latest)} disponible</b><br><span class="tiny">Télécharge puis ouvre le fichier : elle s’installe par-dessus, tes données sont conservées.</span></span><button class="btn sm" data-update>Installer</button></div>` : ''}
    ${hero(sm, st)}
    ${reviewCard(st)}
    ${questsCard(st)}
    ${goalCard(st)}
    ${weighDue(st).due && now.getHours() >= 6 && now.getHours() < 12 ? `<div class="card next" data-weigh><span class="icon-badge" style="background:color-mix(in srgb,var(--c-water) 16%,transparent);color:var(--c-water)">${icon('scale')}</span><div><div class="ttl">Jour de pesée</div><div class="tiny muted">${weighDue(st).days != null ? `Dernière il y a ${weighDue(st).days} jours` : 'Première pesée'}</div></div>${icon('right')}</div>` : ''}

    ${st.workoutNow ? `<div class="card next" data-tab="sport"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon('dumbbell')}</span><div><div class="ttl">Séance en cours</div><div class="tiny muted">depuis ${new Date(st.workoutNow.start).toTimeString().slice(0, 5)} · touche pour terminer</div></div>${icon('right')}</div>` : ''}
    ${sleepCard(st)}
    ${envCard(sm.env, st.location)}

    <div class="tiles">
      <button class="tile" data-act="photo"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-food) 16%,transparent);color:var(--c-food)">${icon('camera')}</span>Photo repas</button>
      <button class="tile" data-act="scan"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon('barcode')}</span>Scanner</button>
      <button class="tile" data-act="snack"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-mood) 16%,transparent);color:var(--c-mood)">${icon('apple')}</span>Grignotage</button>
      <button class="tile" data-water aria-label="Eau : appui = +25 cL, appui long = −25 cL"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-water) 16%,transparent);color:var(--c-water)">${icon('water')}</span><span id="water-v">${fmt(water / 10)} cL</span></button>
    </div>


    <div class="card" id="plan">
      <div class="card-head"><h2>${icon('calendar', 18)} Plan du jour</h2><span class="row" style="gap:12px;flex-wrap:nowrap"><button class="link" data-add-step aria-label="Ajouter une étape">${icon('plus', 14)} Ajouter</button><button class="link" data-toggle-plan>${showAllPlan ? 'Réduire' : 'Tout voir'}</button></span></div>
      <ul class="timeline">${visiblePlan.map((p) => {
        const i = plan.indexOf(p);
        return `<li class="${p.done ? 'done ok' : i === nextIdx ? 'now' : i < nextIdx ? 'done' : ''}" data-step="${i}"><span class="t">${p.time}</span><span class="dot">${icon(p.done ? 'check' : PLAN_ICONS[p.icon] || 'clock', 16)}</span>
          <div class="step-main"><div class="ttl">${esc(p.title)}${p.edited || p.custom ? ` <span class="edited-mark">${icon('pencil', 11)}</span>` : ''}</div>${p.note || p.text ? `<div class="txt one">${esc(p.note || p.text)}</div>` : ''}</div></li>`;
      }).join('')}</ul>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('salad', 18)} Nutrition du jour</h2><button class="link" data-tab="nutrition">Détails</button></div>
      ${meter('Calories', tot.kcal, t.kcal, 'kcal', 'var(--c-move)', true)}
      ${meter('Protéines', tot.protein, t.protein, 'g', 'var(--c-sleep)')}
    </div>


    ${ins.length ? `<div class="section-title">Ce que disent tes données</div>
    <div class="insights">${ins.map((i) => `<article class="insight ${i.level}"><h3><span style="color:var(--${i.level === 'bon' ? 'good' : i.level === 'alerte' ? 'bad' : 'warn'})">${icon(LEVEL_ICON[i.level], 18)}</span>${esc(i.title)}</h3><p>${esc(i.text.split(/(?<=\.)\s/)[0])}</p>${srcLinks(i.src)}</article>`).join('')}</div>` : ''}

`;

  $$('[data-act]', view).forEach((b) => (b.onclick = () => ctx.action(b.dataset.act)));
  const wb = $('[data-water]', view);
  onTapHold(wb, () => addWater(wb, 250, ctx), () => addWater(wb, -250, ctx));
  $('.hero', view).onclick = (e) => { if (e.target.closest('[data-hero-style]')) return; openScore(sm); };
  $('[data-hero-style]', view)?.addEventListener('click', () => {
    const order = ['barres', 'anneaux'];
    store.update((s2) => { s2.settings.heroStyle = order[(order.indexOf(heroStyle(s2)) + 1) % order.length]; });
    toast(`Style : ${{ barres: 'barres', anneaux: 'anneaux' }[heroStyle(store.get())]}`, 1200);
    render(view, ctx);
  });
  $$('[data-step]', view).forEach((li) => (li.onclick = () => openStep(plan[Number(li.dataset.step)], () => render(view, ctx))));
  $('[data-add-step]', view).onclick = () => openStep(null, () => render(view, ctx));
  view.querySelector('[data-review]')?.addEventListener('click', () => openReview(ctx, () => render(view, ctx)));
  view.querySelector('[data-goal]')?.addEventListener('click', () => openReview(ctx, () => render(view, ctx), { goalOnly: true }));
  bindQuests(view, ctx);
  view.querySelector('[data-weigh]')?.addEventListener('click', () => openWeigh(() => ctx.render()));
  view.querySelector('[data-update]')?.addEventListener('click', () => { location.href = N.APK_URL; });
  view.querySelector('[data-sleep]')?.addEventListener('click', () => ctx.action('sleep'));
  view.querySelector('[data-sleep-info]')?.addEventListener('click', () => goodNightTips());
  view.querySelector('[data-sleep-cancel]')?.addEventListener('click', () => { SL.cancelSleep(); ctx.syncWidget?.(); render(view, ctx); });
  view.querySelector('[data-env-setup]')?.addEventListener('click', () => ctx.go('profile', () => document.getElementById('loc')?.scrollIntoView({ block: 'center' })));
  view.querySelector('[data-toggle-plan]').onclick = () => { showAllPlan = !showAllPlan; render(view, ctx); };
}

// Carte « Je vais dormir » : un appui au coucher (sans menu), un appui au réveil ; ⓘ = conseils.
function sleepCard(st) {
  const p = st.profile;
  if (st.sleepNow) {
    const since = new Date(st.sleepNow);
    const min = Math.round((Date.now() - since) / 60000);
    return `<section class="sleep-card">
      <div class="between"><span class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Nuit en cours</span>${icon('moon', 18)}</div>
      <div class="big">${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}</div>
      <div class="small muted">Au lit depuis ${since.toTimeString().slice(0, 5)} · réveil visé ${esc(p.wakeTime)}</div>
      <div class="row" style="margin-top:14px;flex-wrap:nowrap"><button class="btn" style="flex:1" data-sleep>${icon('sun', 18)} Je suis réveillé</button><button class="btn ghost" data-sleep-cancel aria-label="Annuler">${icon('x', 18)}</button></div>
    </section>`;
  }
  const h = new Date().getHours();
  const wk = S.sleepWeek(st.days, p, Array.from({ length: 7 }, (_, i) => store.dayKey(i - 6)));
  const debtTxt = wk.noted >= 2 ? (wk.debt > 60 ? ` · ${fmtMin(wk.debt)} de retard cette semaine` : ' · semaine : besoin couvert') : '';
  if (h >= 6 && h < 19) return `<div class="card next"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-sleep) 16%,transparent);color:var(--c-sleep)">${icon('moon')}</span><div><div class="ttl">Je vais dormir</div><div class="tiny muted">Coucher visé ${esc(p.bedTime)}${debtTxt}</div></div><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="icon-btn" data-sleep-info aria-label="Bien dormir">${icon('info', 16)}</button><button class="btn sm" style="background:var(--c-sleep);color:#0b0f24" data-sleep aria-label="Je vais dormir">${icon('moon', 16)}</button></div></div>`;
  const toTarget = SL.minutesToTarget(p.bedTime);
  const reg = SL.regularity();
  const status = toTarget > 30 ? `Coucher visé à ${esc(p.bedTime)}, dans ${Math.floor(toTarget / 60) ? Math.floor(toTarget / 60) + ' h ' : ''}${toTarget % 60} min.` : toTarget >= -30 ? `C’est l’heure visée (${esc(p.bedTime)}) : parfait pour la régularité.` : `${Math.abs(toTarget)} min après ton heure visée (${esc(p.bedTime)}).`;
  return `<section class="sleep-card">
    <div class="between"><span class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Sommeil</span>${reg != null ? `<span class="tiny muted">régularité ±${Math.round(reg)} min</span>` : ''}</div>
    <div style="font-size:1.15rem;font-weight:700;margin:6px 0 2px">${status}</div>
    ${debtTxt ? `<div class="small muted">${debtTxt.slice(3).replace(/^./, (c) => c.toUpperCase())}${wk.debt > 60 ? ' : ce soir, couche-toi un peu plus tôt.' : '.'}</div>` : ''}
    <div class="sleep-row" style="margin-top:14px"><button class="btn" style="flex:1" data-sleep>${icon('moon', 18)} Je vais dormir</button><button class="btn ghost info" data-sleep-info aria-label="Les meilleures conditions pour dormir">${icon('info', 18)}</button></div>
  </section>`;
}

// Eau : +25 cL par appui, −25 cL par appui long (petite animation flottante).
function addWater(btn, ml, ctx) {
  const cur = store.getDay().waterMl || 0;
  const next = Math.max(0, cur + ml);
  store.setDay(store.today(), { waterMl: next });
  const v = $('#water-v', btn);
  if (v) v.textContent = `${fmt(next / 10)} cL`;
  const r = btn.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float-up';
  f.textContent = ml > 0 ? '+25 cL 💧' : '−25 cL';
  f.style.left = `${r.left + r.width / 2 - 34}px`;
  f.style.top = `${r.top}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
  navigator.vibrate?.(ml > 0 ? 12 : [20, 40, 20]);
  clearTimeout(addWater.t);
  addWater.t = setTimeout(() => ctx.render(), 900); // met à jour les quêtes sans couper l'animation
}

// Explication du score d'hygiène de vie : piliers, poids, données utilisées, action prioritaire.
// Détail du score : une ligne par pilier, le détail s'ouvre au toucher.
export function openScore(sm) {
  const rows = C.scoreBreakdown(sm);
  const g = sm.scores.global;
  const [word, col] = C.scoreWord(g);
  const counted = rows.filter((r) => r.weight && r.v != null).sort((a, b) => a.v - b.v);
  const focus = counted[0]?.v < 80 ? counted[0] : null;
  sheet(`
    <div class="score-top"><div class="score-big" style="color:${col}">${g ?? '–'}</div><div><span class="score-word" style="background:color-mix(in srgb,${col} 18%,transparent);color:${col}">${word}</span><div class="tiny muted" style="margin-top:4px">sur 100 · 7 derniers jours</div></div></div>
    ${focus ? `<div class="note" style="margin:12px 0 4px">${icon('target', 18)}<span><b>Priorité : ${esc(DOMAIN[focus.k].label.toLowerCase())}.</b> ${esc(focus.tip)}</span></div>` : ''}
    <div class="score-rows">${rows.map((r) => { const [, c] = C.scoreWord(r.v); return `<details class="score-row"><summary>
      <span class="sr-ic" style="color:${DOMAIN[r.k].color || 'var(--text-2)'}">${icon(DOMAIN[r.k].icon, 16)}</span>
      <span class="sr-l">${DOMAIN[r.k].label}<small>${r.weight ? `${Math.round(r.weight * 100)} %` : 'hors score'}</small></span>
      <span class="sr-bar"><i style="width:${r.v ?? 0}%;background:${c}"></i></span>
      <b style="color:${r.v == null ? 'var(--muted)' : c}">${r.v ?? '–'}</b></summary>
      <div class="sr-more"><p class="small" style="margin:0">${esc(r.what)}</p><p class="tiny muted" style="margin:4px 0 0">${esc(r.how)}</p>${r.v != null && r.v < 80 && r !== focus ? `<p class="tiny" style="color:var(--primary);font-weight:650;margin:4px 0 0">→ ${esc(r.tip)}</p>` : ''}${srcLinks(r.src)}</div></details>`; }).join('')}</div>
    <p class="tiny muted" style="margin-top:12px">Touche un pilier pour le détail. 80 et plus : excellent · 65–79 : bon · 50–64 : à améliorer. L’humeur est suivie mais ne compte pas : elle découle des autres piliers.</p>`, { title: 'Hygiène de vie', full: true });
}

function envCard(env, location) {
  if (!location) return `<div class="card next"><span class="icon-badge" style="background:var(--primary-soft);color:var(--primary)">${icon('leaf')}</span><div><div class="ttl">Air & météo</div><div class="tiny muted">Choisis ta ville</div></div><button class="icon-btn" data-env-setup aria-label="Configurer">${icon('right')}</button></div>`;
  if (!env) return '';
  const aq = aqiLabel(env.aqi);
  const col = aq.level === 'bon' ? 'var(--good)' : aq.level === 'moyen' ? 'var(--warn)' : 'var(--bad)';
  return `<div class="card">
    <div class="card-head"><h2>${icon('leaf', 18)} ${esc(env.place.split(',')[0])}</h2><span class="tiny muted">mis à jour ${new Date(env.fetched).toTimeString().slice(0, 5)}</span></div>
    <div class="env-strip">
      <div class="stat"><div class="k" style="justify-content:center">Air</div><div class="v" style="color:${col}">${Math.round(env.aqi ?? 0)}</div><div class="tiny muted">${aq.label}</div></div>
      <div class="stat"><div class="k" style="justify-content:center">Temp.</div><div class="v">${Math.round(env.temp)}°</div><div class="tiny muted">max ${Math.round(env.tMax)}°</div></div>
      <div class="stat"><div class="k" style="justify-content:center">UV max</div><div class="v">${Math.round(env.uvMax)}</div><div class="tiny muted">${env.uvMax >= 6 ? 'élevé' : env.uvMax >= 3 ? 'modéré' : 'faible'}</div></div>
      <div class="stat"><div class="k" style="justify-content:center">Pollen</div><div class="v">${env.pollen[0] ? Math.round(env.pollen[0].value) : 0}</div><div class="tiny muted">${env.pollen[0] ? esc(env.pollen[0].name) : 'faible'}</div></div>
    </div>
  </div>`;
}

// ---------- Score d'hygiène de vie : trois présentations au choix ----------
const heroStyle = (st) => (st.settings?.heroStyle === 'anneaux' ? 'anneaux' : 'barres');
function hero(sm, st) {
  const g = sm.scores.global;
  const [word, col] = C.scoreWord(g);
  const prev = R.weekReview(st).prevGlobal;
  const delta = g != null && prev != null ? g - prev : null;
  const trend = delta == null ? '' : `<span class="hero-trend ${delta >= 0 ? 'up' : 'down'}">${delta > 0 ? '↗ +' : delta < 0 ? '↘ ' : '→ '}${delta} <small>vs sem. dernière</small></span>`;
  const keys = ['sommeil', 'activite', 'alimentation', 'numerique'];
  const style = heroStyle(st);
  let main;
  if (style === 'anneaux') {
    main = `<div class="hero-grid">${rings(sm.scores, g)}<div class="legend-rows">${keys.map((k) => `<div class="legend-row"><i style="background:${k === 'numerique' ? 'rgba(255,255,255,.55)' : DOMAIN[k].color}"></i><span>${DOMAIN[k].label}</span><b>${sm.scores[k] ?? '–'}</b></div>`).join('')}</div></div>`;
  } else {
    main = `<div class="hero-line"><span class="hero-score">${g ?? '–'}<small>/100</small></span><span class="score-word" style="background:color-mix(in srgb,${col} 22%,transparent);color:${col}">${esc(word)}</span>${trend}</div>
      <div class="hero-bars">${keys.map((k) => `<div class="hb"><span>${icon(DOMAIN[k].icon, 13)} ${DOMAIN[k].label}</span><div class="bar-mini"><div style="width:${sm.scores[k] ?? 0}%;background:${DOMAIN[k].color}"></div></div><b>${sm.scores[k] ?? '–'}</b></div>`).join('')}</div>`;
  }
  return `<section class="hero hero-${style}">
    <div class="hero-kicker"><span style="white-space:nowrap">Hygiène de vie · 7 j</span><span class="row" style="gap:10px;flex-wrap:nowrap"><button class="hero-style" data-hero-style aria-label="Changer de présentation">${icon('palette', 13)}</button><span class="tapme" aria-label="Comprendre le score">${icon('info', 15)}</span></span></div>
    ${main}
    <div class="verdict">${icon('sparkles', 15)}<span>${esc(headline(sm, st.profile))}</span></div>
  </section>`;
}

// ---------- Plan du jour : détail, masquer, ajouter ----------
const DOW = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const ensureEdits = (s) => { s.planEdits = { hidden: {}, hiddenOn: {}, over: {}, overOn: {}, custom: [], ...(s.planEdits || {}) }; for (const k of ['hidden', 'hiddenOn', 'over', 'overOn']) s.planEdits[k] ||= {}; s.planEdits.custom ||= []; return s.planEdits; };

// Une étape du plan : détail, puis modification (nom, heure, note, fréquence) ou suppression.
// p = null → nouvelle étape.
function openStep(p, done) {
  const isNew = !p;
  const st = store.get();
  const now = new Date(Date.now() + 30 * 60000);
  const step = p || { custom: true, title: '', time: `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0')}`, note: '', daily: false, days: null };
  // fréquence : today | daily | days
  let freq = step.custom ? (step.daily ? (step.days ? 'days' : 'daily') : 'today') : step.edited === 'today' ? 'today' : step.days ? 'days' : 'daily';
  let days = new Set(step.days || [new Date().getDay()]);
  const hidden = Object.entries(st.planEdits?.hidden || {});
  const body = sheet(`
    ${isNew ? '' : `<div class="between"><span class="badge neutral">${icon('clock', 12)} ${step.time}</span>${step.done ? `<span class="badge" style="color:var(--good)">${icon('check', 12)} fait</span>` : ''}</div>
    ${step.text ? `<p class="small" style="color:var(--text-2);line-height:1.55;margin:10px 0 4px">${esc(step.text)}</p>` : ''}
    ${srcLinks(step.src)}`}
    <label class="lbl"${isNew ? ' style="margin-top:0"' : ''}>Nom</label><input id="t" value="${esc(step.title)}" placeholder="ex. Méditation, vitamines, appeler maman…" maxlength="60">
    <div class="grid2"><div><label class="lbl">Heure</label><input id="h" type="time" value="${esc(step.time)}"></div>
      <div><label class="lbl">Note</label><input id="x" value="${esc(step.note || '')}" placeholder="facultatif" maxlength="140"></div></div>
    <label class="lbl">Fréquence</label>
    <div class="seg" id="freq"><button data-f="today">Aujourd’hui</button><button data-f="daily">Tous les jours</button><button data-f="days">Certains jours</button></div>
    <div class="chips" id="days" style="margin-top:8px">${DOW.map(([d, l]) => `<button class="chip" data-d="${d}" style="min-width:38px;justify-content:center">${l}</button>`).join('')}</div>
    <button class="btn block" id="ok" style="margin-top:14px">${icon('check', 18)} ${isNew ? 'Ajouter au plan' : 'Enregistrer'}</button>
    ${isNew ? '' : step.custom
      ? `<button class="btn ghost block" id="del" style="margin-top:8px;color:var(--bad)">${icon('trash', 18)} Supprimer cette étape</button>`
      : `<div class="grid2" style="margin-top:8px"><button class="btn ghost" id="hide-today">${icon('x', 16)} Pas aujourd’hui</button><button class="btn ghost" id="hide-always" style="color:var(--bad)">${icon('trash', 16)} Ne plus proposer</button></div>
        ${step.edited ? `<button class="btn ghost block" id="reset" style="margin-top:8px">${icon('refresh', 16)} Revenir à la proposition du coach</button>` : ''}`}
    ${isNew && hidden.length ? `<h3 style="font-size:.9rem;margin:20px 0 6px">Étapes retirées</h3>${hidden.map(([k, t]) => `<div class="between" style="padding:6px 0;border-top:1px solid var(--line)"><span class="small">${esc(typeof t === 'string' ? t : k)}</span><button class="btn sm soft" data-restore="${esc(k)}">Rétablir</button></div>`).join('')}` : ''}`,
  { title: isNew ? 'Ajouter une étape' : 'Étape du plan', onClose: done });
  const paint = () => {
    $$('[data-f]', body).forEach((b) => b.classList.toggle('on', b.dataset.f === freq));
    $('#days', body).style.display = freq === 'days' ? '' : 'none';
    $$('[data-d]', body).forEach((b) => b.classList.toggle('on', days.has(Number(b.dataset.d))));
  };
  paint();
  $$('[data-f]', body).forEach((b) => (b.onclick = () => { freq = b.dataset.f; paint(); }));
  $$('[data-d]', body).forEach((b) => (b.onclick = () => { const d = Number(b.dataset.d); days.has(d) ? days.delete(d) : days.add(d); paint(); }));
  const edit = (f) => { store.update((s) => f(ensureEdits(s))); body.close(); refreshReminders().catch(() => {}); };
  const today = store.today();
  $('#ok', body).onclick = () => {
    const title = $('#t', body).value.trim(), time = $('#h', body).value || step.time, note = $('#x', body).value.trim();
    if (!title) return toast('Donne un nom à l’étape');
    if (freq === 'days' && !days.size) return toast('Choisis au moins un jour');
    const dl = freq === 'days' ? [...days].sort() : null;
    edit((e) => {
      if (step.custom) {
        const c = { id: step.id || crypto.randomUUID(), time, title, text: note, date: freq === 'today' ? today : null, days: dl };
        e.custom = [...e.custom.filter((x) => x.id !== c.id), c];
      } else {
        const o = { title, time, text: note };
        if (freq === 'today') { e.overOn = { [today]: { ...(e.overOn[today] || {}), [step.key]: o } }; }
        else { e.over[step.key] = { ...o, ...(dl ? { days: dl } : {}) }; if (e.overOn[today]) delete e.overOn[today][step.key]; }
      }
    });
    toast(isNew ? 'Étape ajoutée ⭐' : 'Étape modifiée', 1200);
  };
  $('#del', body)?.addEventListener('click', () => edit((e) => { e.custom = e.custom.filter((c) => c.id !== step.id); }));
  $('#hide-today', body)?.addEventListener('click', () => edit((e) => { e.hiddenOn = { [today]: [...(e.hiddenOn[today] || []), step.key] }; }));
  $('#hide-always', body)?.addEventListener('click', () => { edit((e) => { e.hidden[step.key] = step.title; }); toast('Étape retirée (rétablissable via « Ajouter »)', 2200); });
  $('#reset', body)?.addEventListener('click', () => edit((e) => { delete e.over[step.key]; if (e.overOn[today]) delete e.overOn[today][step.key]; }));
  $$('[data-restore]', body).forEach((b) => (b.onclick = () => { store.update((s) => { delete s.planEdits.hidden[b.dataset.restore]; }); b.closest('.between').remove(); toast('Étape rétablie', 1000); }));
}

// ---------- Bilan du dimanche et objectif de la semaine ----------
function reviewCard(st) {
  if (!R.reviewDue(st)) return '';
  return `<div class="card next review-card" data-review><span class="icon-badge" style="background:color-mix(in srgb,#fbbf24 20%,transparent);color:#fbbf24">${icon('star')}</span><div><div class="ttl">Ton bilan de la semaine est prêt</div><div class="tiny muted">Tes progrès et un objectif pour la semaine qui vient</div></div>${icon('right')}</div>`;
}

function goalCard(st) {
  const g = st.weekGoal;
  const pr = R.goalProgress(st, g);
  if (!pr || pr.over || g.start > store.today()) return '';
  const dots = Array.from({ length: pr.target }, (_, i) => `<i class="${i < pr.ok ? 'on' : ''}"></i>`).join('');
  return `<div class="card goal-card" data-goal><div class="between"><span class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em">${icon('target', 12)} Objectif de la semaine</span><span class="tiny muted">${pr.ok}/${pr.target}</span></div>
    <div style="font-weight:650;margin:6px 0 8px">${esc(g.text)}</div><div class="goal-dots">${dots}</div>${pr.done ? '<div class="tiny" style="color:var(--good);font-weight:700;margin-top:6px">Objectif atteint 🎉</div>' : ''}</div>`;
}

export function openReview(ctx, done, { goalOnly = false } = {}) {
  const st = store.get();
  const rv = R.weekReview(st);
  const week = R.reviewDue(st);
  const corr = correlations(st).slice(0, 2);
  const arrow = (d) => (d == null ? '' : `<span style="color:${d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'var(--muted)'};font-weight:700">${d > 0 ? '+' : ''}${d}</span>`);
  const cur = st.weekGoal && R.goalProgress(st, st.weekGoal);
  const body = sheet(`
    ${goalOnly && cur ? `<div class="card" style="padding:14px"><b>${esc(st.weekGoal.text)}</b><div class="tiny muted" style="margin-top:4px">${cur.ok} jour(s) réussi(s) sur ${cur.target} visés · jusqu’au ${new Date(cur.end + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</div></div>` : ''}
    <div class="between" style="align-items:flex-end"><div><div class="tiny muted" style="font-weight:700;text-transform:uppercase">Hygiène de vie</div><div style="font-size:2rem;font-weight:800;line-height:1.1">${rv.global ?? '–'}<small style="font-size:.9rem;color:var(--muted)">/100</small></div></div><div class="small">${rv.prevGlobal != null ? `semaine d’avant : ${rv.prevGlobal} ${arrow(rv.global - rv.prevGlobal)}` : ''}</div></div>
    ${rv.pillars.map((p) => `<div class="hb" style="margin-top:10px"><span>${icon(DOMAIN[p.k].icon, 13)} ${DOMAIN[p.k].label}</span><div class="bar-mini"><div style="width:${p.v ?? 0}%;background:${DOMAIN[p.k].color}"></div></div><b>${p.v ?? '–'} ${arrow(p.delta)}</b></div>`).join('')}
    <div class="grid2" style="margin-top:14px">
      <div class="stat"><div class="k">${icon('moon', 14)} Sommeil</div><div class="v">${rv.stats.sleepH != null ? fmtMin(rv.stats.sleepH * 60) : '–'}<small>/nuit</small></div></div>
      <div class="stat"><div class="k">${icon('steps', 14)} Pas</div><div class="v">${fmt(rv.stats.steps)}<small>/jour</small></div></div>
      <div class="stat"><div class="k">${icon('dumbbell', 14)} Séances</div><div class="v">${rv.stats.sessions}</div></div>
      <div class="stat"><div class="k">${icon('utensils', 14)} Repas notés</div><div class="v">${rv.stats.mealDays}<small>/7 j</small></div></div>
    </div>
    ${rv.best ? `<div class="note" style="margin-top:12px">${icon('trend', 18)}<span><b>Ton plus beau progrès :</b> ${DOMAIN[rv.best.k].label.toLowerCase()} (+${rv.best.delta} points). Bravo 👏</span></div>` : ''}
    ${corr.length ? `<h3 style="font-size:.9rem;margin:16px 0 6px">Ce que tes données révèlent</h3>${corr.map((c) => `<p class="small row" style="margin:4px 0;gap:8px;flex-wrap:nowrap;align-items:flex-start"><span style="color:var(${c.good ? '--good' : '--warn'});flex:none">${icon(c.good ? 'ok' : 'alert', 16)}</span><span>${esc(c.text)}</span></p>`).join('')}` : ''}
    <h3 style="font-size:.9rem;margin:18px 0 6px">${icon('target', 14)} Un seul objectif pour la semaine qui vient</h3>
    <div class="card" style="padding:14px;border-color:color-mix(in srgb,var(--primary) 40%,transparent)"><b>${esc(rv.goal.text)}</b><div class="tiny muted" style="margin-top:4px">Choisi sur ton point le plus faible : ${DOMAIN[rv.weakest].label.toLowerCase()}. Un objectif unique, précis et suivi chaque jour marche mieux qu’une liste de bonnes résolutions.</div></div>
    <button class="btn block" id="commit" style="margin-top:12px">${icon('check', 18)} Je m’engage</button>
    ${srcLinks(['harkin2016', 'lally2010'])}`, { title: 'Bilan de la semaine', full: true, onClose: done });
  if (week) store.update((s) => { s.reviewSeen = week; });
  $('#commit', body).onclick = () => {
    const d = new Date(); if (d.getDay() === 0) d.setDate(d.getDate() + 1); // le dimanche : la semaine commence demain
    const start = store.today(d);
    store.update((s) => { s.weekGoal = { ...rv.goal, start }; });
    toast('C’est noté : objectif de la semaine 🎯', 1800);
    body.close();
  };
}
