// Accueil : score, prochaine étape, actions rapides, plan de la journée, nutrition, analyses.
import * as store from '../store.js';
import * as C from '../coach.js';
import { summary } from '../context.js';
import { icon, esc, fmt, srcLinks, rings, DOMAIN, $$ } from '../ui.js';
import { SLOT_LABEL } from '../planner.js';

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
  const next = plan[nextIdx];
  const slot = C.currentSlot(now);
  const sugg = C.mealSuggestions(sm, profile, slot).slice(0, 2);
  const order = { alerte: 0, attention: 1, bon: 2 };
  const ins = C.insights(sm).sort((a, b) => order[a.level] - order[b.level]);
  const t = sm.t, tot = sm.totToday, d = sm.today;
  const water = d.waterMl || 0;
  const visiblePlan = showAllPlan ? plan : plan.slice(Math.max(0, nextIdx - 1), nextIdx + 4);

  view.innerHTML = `
    <section class="hero">
      <div class="hero-grid">
        ${rings(sm.scores, sm.scores.global)}
        <div class="legend-rows">
          ${['activite', 'sommeil', 'alimentation', 'humeur', 'numerique'].map((k) => `<div class="legend-row"><i style="background:${k === 'humeur' || k === 'numerique' ? 'rgba(255,255,255,.55)' : DOMAIN[k].color}"></i><span>${DOMAIN[k].label}</span><b>${sm.scores[k] ?? '–'}</b></div>`).join('')}
        </div>
      </div>
      <div class="verdict">${icon('sparkles', 18)}<span>${esc(headline(sm))}</span></div>
    </section>

    <div class="tiles">
      <button class="tile" data-act="photo"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-food) 16%,transparent);color:var(--c-food)">${icon('camera')}</span>Photo repas</button>
      <button class="tile" data-act="scan"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon('barcode')}</span>Scanner</button>
      <button class="tile" data-act="checkin"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-mood) 16%,transparent);color:var(--c-mood)">${icon('smile')}</span>Check-in</button>
      <button class="tile" data-act="water"><span class="icon-badge" style="background:color-mix(in srgb,var(--c-water) 16%,transparent);color:var(--c-water)">${icon('water')}</span>${fmt(water / 1000, 1)} L</button>
    </div>

    ${next ? `<div class="card next">
      <span class="icon-badge" style="background:var(--primary-soft);color:var(--primary)">${icon(PLAN_ICONS[next.icon] || 'clock')}</span>
      <div><div class="when">À ${next.time} · prochaine étape</div><div class="ttl">${esc(next.title)}</div></div>
      <button class="icon-btn" data-go="#plan" aria-label="Voir le plan">${icon('right')}</button>
    </div>` : ''}

    <div class="card" id="plan">
      <div class="card-head"><h2>${icon('calendar', 18)} Plan du jour</h2><button class="link" data-toggle-plan>${showAllPlan ? 'Réduire' : 'Tout voir'}</button></div>
      <ul class="timeline">${visiblePlan.map((p) => {
        const i = plan.indexOf(p);
        return `<li class="${i === nextIdx ? 'now' : i < nextIdx ? 'done' : ''}"><span class="t">${p.time}</span><span class="dot">${icon(PLAN_ICONS[p.icon] || 'clock', 16)}</span>
          <div><div class="ttl">${esc(p.title)}</div>${i >= nextIdx || showAllPlan ? `<div class="txt">${esc(p.text)}</div>${srcLinks(p.src)}` : ''}</div></li>`;
      }).join('')}</ul>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('salad', 18)} Nutrition du jour</h2><button class="link" data-tab="nutrition">Détails</button></div>
      ${meter('Calories', tot.kcal, t.kcal, 'kcal', 'var(--c-move)', true)}
      ${meter('Protéines', tot.protein, t.protein, 'g', 'var(--c-sleep)')}
      ${meter('Fibres', tot.fiber, t.fiber, 'g', 'var(--c-food)')}
      ${meter('Fruits & légumes', tot.fruitVeg, t.fruitVeg, 'g', 'var(--primary)')}
    </div>

    ${sugg.length ? `<div class="card">
      <div class="card-head"><h2>${icon('chef', 18)} Idées pour le ${SLOT_LABEL[slot].toLowerCase()}</h2></div>
      ${sugg.map((m) => `<div class="suggest"><div><div class="ttl">${esc(m.name)}</div><div class="tiny muted">${m.kcal} kcal · ${m.protein} g prot · ${m.fiber} g fibres</div>${m.why.length ? `<div class="why">${esc(m.why.slice(0, 2).join(' · '))}</div>` : ''}</div></div>`).join('')}
    </div>` : ''}

    ${ins.length ? `<div class="section-title">Ce que disent tes données</div>
    <div class="insights">${ins.map((i) => `<article class="insight ${i.level}"><h3><span style="color:var(--${i.level === 'bon' ? 'good' : i.level === 'alerte' ? 'bad' : 'warn'})">${icon(LEVEL_ICON[i.level], 18)}</span>${esc(i.title)}</h3><p>${esc(i.text)}</p>${srcLinks(i.src)}</article>`).join('')}</div>` : ''}

    <p class="tiny muted" style="text-align:center;margin-top:18px">Outil d'accompagnement, pas un dispositif médical.</p>`;

  $$('[data-act]', view).forEach((b) => (b.onclick = () => {
    if (b.dataset.act === 'water') {
      store.setDay(store.today(), { waterMl: water + 250 });
      ctx.toast('+250 mL 💧');
      render(view, ctx);
    } else ctx.action(b.dataset.act);
  }));
  view.querySelector('[data-toggle-plan]').onclick = () => { showAllPlan = !showAllPlan; render(view, ctx); };
  view.querySelector('[data-go="#plan"]')?.addEventListener('click', () => document.getElementById('plan').scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
