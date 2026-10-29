// Accueil : score, prochaine étape, actions rapides, plan de la journée, nutrition, analyses.
import * as store from '../store.js';
import * as C from '../coach.js';
import { summary, taste } from '../context.js';
import * as SL from '../sleep.js';
import * as N from '../native.js';
import { questsCard, bindQuests } from './progress.js';
import { aqiLabel } from '../env.js';
import { icon, esc, fmt, srcLinks, rings, DOMAIN, sheet, onTapHold, $, $$ } from '../ui.js';
import { goodNightTips } from './actions.js';
import { openWeigh } from './health.js';
import { weighDue } from '../energy.js';

const PLAN_ICONS = { '⚡': 'zap', '🌳': 'leaf', '☀️': 'sunrise', '🍳': 'coffee', '☕': 'coffee', '🥗': 'salad', '🚶': 'steps', '😴': 'bed', '🏃': 'dumbbell', '🍎': 'apple', '🍽️': 'utensils', '📵': 'phone', '🧘': 'brain', '🌙': 'moon' };
const LEVEL_ICON = { bon: 'ok', attention: 'alert', alerte: 'alert' };
let showAllPlan = false;

export function meter(label, v, max, unit, color, inverse = false) {
  const p = Math.min(100, max ? (v / max) * 100 : 0);
  return `<div class="meter ${inverse && v > max ? 'over' : ''}"><div class="between"><span>${label}</span><span class="muted"><b style="color:var(--text)">${fmt(v)}</b> / ${fmt(max)} ${unit}</span></div>
    <div class="track"><div class="fill" style="width:${p}%;background:${color}"></div></div></div>`;
}

function headline(sm) {
  const s = sm.scores;
  const entries = Object.entries(s).filter(([k, v]) => k !== 'global' && v != null);
  if (!entries.length) return 'Fais ton check-in pour obtenir ton premier score.';
  const worst = entries.sort((a, b) => a[1] - b[1])[0];
  const msgs = {
    sommeil: 'Ta priorité : le sommeil. Vise un coucher régulier ce soir.',
    activite: 'Ta priorité : bouger plus. Une marche rapide de 30 min ferait la différence.',
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
  const plan = C.dailyPlan(sm, profile);
  let nextIdx = plan.findIndex((p) => (p.min % 1440) >= nowMin);
  if (nextIdx === -1) nextIdx = plan.length;
  const order = { alerte: 0, attention: 1, bon: 2 };
  const ins = C.insights(sm).sort((a, b) => order[a.level] - order[b.level]).slice(0, 3);
  const t = sm.t, tot = sm.totToday, d = sm.today;
  const water = d.waterMl || 0;
  const visiblePlan = showAllPlan ? plan : plan.slice(Math.max(0, nextIdx - 1), nextIdx + 4);

  const up = st.update?.available ? st.update : null;
  view.innerHTML = `
    ${up ? `<div class="note" style="margin:4px 0 10px">${icon('download', 18)}<span style="flex:1"><b>Mise à jour ${esc(up.latest)} disponible</b><br><span class="tiny">Télécharge puis ouvre le fichier : elle s’installe par-dessus, tes données sont conservées.</span></span><button class="btn sm" data-update>Installer</button></div>` : ''}
    <section class="hero">
      <div class="hero-kicker"><span>Hygiène de vie · 7 jours</span><span class="tapme">${icon('info', 13)} comprendre</span></div>
      <div class="hero-grid">
        ${rings(sm.scores, sm.scores.global)}
        <div class="legend-rows">
          ${['activite', 'sommeil', 'alimentation', 'humeur', 'numerique'].map((k) => `<div class="legend-row"><i style="background:${k === 'humeur' || k === 'numerique' ? 'rgba(255,255,255,.55)' : DOMAIN[k].color}"></i><span>${DOMAIN[k].label}</span><b>${sm.scores[k] ?? '–'}</b></div>`).join('')}
        </div>
      </div>
      <div class="verdict">${icon('sparkles', 18)}<span>${sm.scores.global != null ? `<b>${C.scoreWord(sm.scores.global)[0]}</b> · ` : ''}${esc(headline(sm))}</span></div>
    </section>

    ${questsCard(st)}
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
      <div class="card-head"><h2>${icon('calendar', 18)} Plan du jour</h2><button class="link" data-toggle-plan>${showAllPlan ? 'Réduire' : 'Tout voir'}</button></div>
      <ul class="timeline">${visiblePlan.map((p) => {
        const i = plan.indexOf(p);
        return `<li class="${p.done ? 'done ok' : i === nextIdx ? 'now' : i < nextIdx ? 'done' : ''}"><span class="t">${p.time}</span><span class="dot">${icon(p.done ? 'check' : PLAN_ICONS[p.icon] || 'clock', 16)}</span>
          <details><summary class="ttl">${esc(p.title)}</summary><div class="txt">${esc(p.text)}</div>${srcLinks(p.src)}</details></li>`;
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
  $('.hero', view).onclick = () => openScore(sm);
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
  if (h >= 6 && h < 19) return `<div class="card next"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-sleep) 16%,transparent);color:var(--c-sleep)">${icon('moon')}</span><div><div class="ttl">Je vais dormir</div><div class="tiny muted">Coucher visé ${esc(p.bedTime)}</div></div><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="icon-btn" data-sleep-info aria-label="Bien dormir">${icon('info', 16)}</button><button class="btn sm" style="background:var(--c-sleep);color:#0b0f24" data-sleep aria-label="Je vais dormir">${icon('moon', 16)}</button></div></div>`;
  const toTarget = SL.minutesToTarget(p.bedTime);
  const reg = SL.regularity();
  const status = toTarget > 30 ? `Coucher visé à ${esc(p.bedTime)}, dans ${Math.floor(toTarget / 60) ? Math.floor(toTarget / 60) + ' h ' : ''}${toTarget % 60} min.` : toTarget >= -30 ? `C’est l’heure visée (${esc(p.bedTime)}) : parfait pour la régularité.` : `${Math.abs(toTarget)} min après ton heure visée (${esc(p.bedTime)}).`;
  return `<section class="sleep-card">
    <div class="between"><span class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Sommeil</span>${reg != null ? `<span class="tiny muted">régularité ±${Math.round(reg)} min</span>` : ''}</div>
    <div style="font-size:1.15rem;font-weight:700;margin:6px 0 2px">${status}</div>
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
export function openScore(sm) {
  const rows = C.scoreBreakdown(sm);
  const g = sm.scores.global;
  const [word, col] = C.scoreWord(g);
  sheet(`
    <div class="between" style="align-items:center"><div><div style="font-size:2.6rem;font-weight:800;line-height:1">${g ?? '–'}<small style="font-size:1rem;color:var(--muted)">/100</small></div><span class="score-word" style="background:color-mix(in srgb,${col} 18%,transparent);color:${col}">${word}</span></div>
      <p class="small muted" style="max-width:60%;margin:0">Moyenne pondérée de 5 piliers sur les 7 derniers jours. Plus de 80 : excellent · 65–79 : bon · 50–64 : à améliorer.</p></div>
    ${rows.map((r) => { const [w, c] = C.scoreWord(r.v); return `<div class="pillar">
      <div class="between"><b>${icon(DOMAIN[r.k].icon, 16)} ${DOMAIN[r.k].label} <span class="tiny muted">· compte pour ${Math.round(r.weight * 100)} %</span></b><span style="font-weight:800;color:${c}">${r.v ?? '–'}</span></div>
      <div class="bar-mini"><div style="width:${r.v ?? 0}%;background:${c}"></div></div>
      <div class="small" style="margin-top:6px">${esc(r.what)}</div>
      <div class="tiny muted">${esc(r.how)}</div>
      ${r.v != null && r.v < 80 ? `<div class="tiny" style="color:var(--primary);font-weight:650;margin-top:4px">→ ${esc(r.tip)}</div>` : ''}
      ${srcLinks(r.src)}</div>`; }).join('')}`, { title: 'Ton score d’hygiène de vie', full: true });
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
