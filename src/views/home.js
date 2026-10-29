// Accueil : score, prochaine étape, actions rapides, plan de la journée, nutrition, analyses.
import * as store from '../store.js';
import * as C from '../coach.js';
import { summary, taste } from '../context.js';
import * as SL from '../sleep.js';
import * as N from '../native.js';
import { questsCard, bindQuests } from './progress.js';
import { aqiLabel } from '../env.js';
import { icon, esc, fmt, srcLinks, rings, DOMAIN, $$ } from '../ui.js';

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
      <div class="hero-kicker"><span>Score santé · 7 jours</span></div>
      <div class="hero-grid">
        ${rings(sm.scores, sm.scores.global)}
        <div class="legend-rows">
          ${['activite', 'sommeil', 'alimentation', 'humeur', 'numerique'].map((k) => `<div class="legend-row"><i style="background:${k === 'humeur' || k === 'numerique' ? 'rgba(255,255,255,.55)' : DOMAIN[k].color}"></i><span>${DOMAIN[k].label}</span><b>${sm.scores[k] ?? '–'}</b></div>`).join('')}
        </div>
      </div>
      <div class="verdict">${icon('sparkles', 18)}<span>${esc(headline(sm))}</span></div>
    </section>

    ${questsCard(st)}

    ${st.workoutNow ? `<div class="card next" data-tab="sport"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon('dumbbell')}</span><div><div class="ttl">Séance en cours</div><div class="tiny muted">depuis ${new Date(st.workoutNow.start).toTimeString().slice(0, 5)} · touche pour terminer</div></div>${icon('right')}</div>` : ''}
    ${sleepCard(st)}
    ${envCard(sm.env, st.location)}

    <div class="tiles">
      <button class="tile" data-act="photo"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-food) 16%,transparent);color:var(--c-food)">${icon('camera')}</span>Photo repas</button>
      <button class="tile" data-act="scan"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon('barcode')}</span>Scanner</button>
      <button class="tile" data-act="snack"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-mood) 16%,transparent);color:var(--c-mood)">${icon('apple')}</span>Grignotage</button>
      <button class="tile" data-act="water"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-water) 16%,transparent);color:var(--c-water)">${icon('water')}</span>${fmt(water / 1000, 1)} L</button>
    </div>


    <div class="card" id="plan">
      <div class="card-head"><h2>${icon('calendar', 18)} Plan du jour</h2><button class="link" data-toggle-plan>${showAllPlan ? 'Réduire' : 'Tout voir'}</button></div>
      <ul class="timeline">${visiblePlan.map((p) => {
        const i = plan.indexOf(p);
        return `<li class="${i === nextIdx ? 'now' : i < nextIdx ? 'done' : ''}"><span class="t">${p.time}</span><span class="dot">${icon(PLAN_ICONS[p.icon] || 'clock', 16)}</span>
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

  $$('[data-act]', view).forEach((b) => (b.onclick = () => {
    if (b.dataset.act === 'water') {
      store.setDay(store.today(), { waterMl: water + 250 });
      ctx.toast('+250 mL 💧');
      ctx.render();
    } else ctx.action(b.dataset.act);
  }));
  bindQuests(view, ctx);
  view.querySelector('[data-update]')?.addEventListener('click', () => { location.href = N.APK_URL; });
  view.querySelector('[data-sleep]')?.addEventListener('click', () => ctx.action('sleep'));
  view.querySelector('[data-sleep-cancel]')?.addEventListener('click', () => { SL.cancelSleep(); ctx.syncWidget?.(); render(view, ctx); });
  view.querySelector('[data-env-setup]')?.addEventListener('click', () => ctx.go('profile', () => document.getElementById('loc')?.scrollIntoView({ block: 'center' })));
  view.querySelector('[data-toggle-plan]').onclick = () => { showAllPlan = !showAllPlan; render(view, ctx); };
}

// Carte « Je vais dormir » : un appui au coucher, un appui au réveil.
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
  // en journée : simple raccourci, la carte complète apparaît le soir
  if (h >= 6 && h < 19) return `<div class="card next"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-sleep) 16%,transparent);color:var(--c-sleep)">${icon('moon')}</span><div><div class="ttl">Je vais dormir</div><div class="tiny muted">Coucher visé ${esc(p.bedTime)}</div></div><button class="btn sm" style="background:var(--c-sleep);color:#0b0f24" data-sleep>${icon('moon', 16)}</button></div>`;
  const toTarget = SL.minutesToTarget(p.bedTime);
  const reg = SL.regularity();
  const status = toTarget > 30 ? `Coucher visé à ${esc(p.bedTime)}, dans ${Math.floor(toTarget / 60) ? Math.floor(toTarget / 60) + ' h ' : ''}${toTarget % 60} min.` : toTarget >= -30 ? `C’est l’heure visée (${esc(p.bedTime)}) : parfait pour la régularité.` : `${Math.abs(toTarget)} min après ton heure visée (${esc(p.bedTime)}).`;
  return `<section class="sleep-card">
    <div class="between"><span class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Sommeil</span>${reg != null ? `<span class="tiny muted">régularité ±${Math.round(reg)} min</span>` : ''}</div>
    <div style="font-size:1.15rem;font-weight:700;margin:6px 0 2px">${status}</div>
    <button class="btn block" style="margin-top:14px" data-sleep>${icon('moon', 18)} Je vais dormir</button>
    ${srcLinks(['windred2024', 'phillips2017'])}
  </section>`;
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
