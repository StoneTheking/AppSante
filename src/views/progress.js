// Motivation : quêtes du jour (accueil), écran de progression, célébrations.
import * as store from '../store.js';
import * as G from '../gamify.js';
import { icon, esc, sheet, toast, srcLinks, $$ } from '../ui.js';

// Carte « Quêtes du jour » pour l'accueil.
export function questsCard(st) {
  const goals = G.dayGoals(st, G.dayKeyOffset(0));
  const done = goals.filter((g) => g.done).length;
  const s = G.streak(st);
  const p = G.progress(st);
  const msg = done >= G.VALIDATE
    ? (done === goals.length ? 'Journée parfaite ! +20 XP bonus' : `Journée validée · série de ${s.current} jour${s.current > 1 ? 's' : ''}`)
    : `Encore ${G.VALIDATE - done} quête${G.VALIDATE - done > 1 ? 's' : ''} pour ${s.atRisk ? 'sauver' : 'valider'} ta série`;
  return `<section class="card quests">
    <div class="between"><h2 style="font-size:1.02rem;display:flex;gap:8px;align-items:center">${icon('target', 18)} Quêtes du jour</h2><button class="xp-pill" data-progress>Niv. ${p.level} · +${p.today} XP</button></div>
    <div class="quest-row">${goals.map((g) => `<button class="quest ${g.done ? 'done' : ''}" data-quest="${g.id}" aria-label="${esc(g.label)} : ${esc(g.hint)}">
      <svg viewBox="0 0 44 44" width="52" height="52"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--line-2)" stroke-width="4"/><circle cx="22" cy="22" r="18" fill="none" stroke="${g.color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${113 * g.progress} 113" transform="rotate(-90 22 22)"/></svg>
      <span class="qi" style="color:${g.done ? '#fff' : g.color};${g.done ? `background:${g.color}` : ''}">${icon(g.done ? 'check' : g.icon, 16)}</span>
      <small>${esc(g.label)}</small></button>`).join('')}</div>
    <div class="quest-msg ${s.atRisk && done < G.VALIDATE ? 'risk' : ''}">${s.atRisk && done < G.VALIDATE ? '🔥 ' : ''}${esc(msg)}</div>
  </section>`;
}

export function bindQuests(view, ctx) {
  $$('[data-quest]', view).forEach((b) => (b.onclick = () => {
    const id = b.dataset.quest;
    if (id === 'move') ctx.go('sport');
    else if (id === 'food') ctx.action('photo');
    else if (id === 'sleep') ctx.action('sleep');
    else if (id === 'mood') ctx.action('checkin');
    else if (id === 'water') { const d = store.getDay(); store.setDay(store.today(), { waterMl: (d.waterMl || 0) + 250 }); toast('+25 cL 💧', 1000); ctx.render(); }
  }));
  $$('[data-progress]', view).forEach((b) => (b.onclick = () => openProgress()));
}

// Écran de progression : niveau, série, calendrier, badges.
export function openProgress() {
  const st = store.get();
  const p = G.progress(st);
  const s = G.streak(st);
  const bs = G.badges(st);
  const weeks = 5;
  const cells = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const k = G.dayKeyOffset(-i);
    const n = G.dayGoals(st, k).filter((g) => g.done).length;
    cells.push({ k, n, frozen: s.frozenDays.includes(k), today: i === 0 });
  }
  sheet(`
    <div class="streak-hero">
      <div class="flame">🔥</div>
      <div><div class="big">${s.current}</div><div class="small muted">jour${s.current > 1 ? 's' : ''} de série · record ${s.best}</div></div>
      <div class="freeze" title="Gels de série">❄️ ${s.freezes}<small>gel${s.freezes > 1 ? 's' : ''}</small></div>
    </div>
    <p class="tiny muted" style="margin:6px 0 12px">Une journée est validée avec ${G.VALIDATE} quêtes sur 5. Tous les 7 jours validés, tu gagnes un gel (2 max) qui protège ta série si tu rates un jour.</p>

    <div class="card" style="padding:14px">
      <div class="between"><b>Niveau ${p.level} · ${esc(p.title)}</b><span class="small muted">${p.xp} XP</span></div>
      <div class="meter"><div class="track" style="height:10px"><div class="fill" style="width:${Math.round((p.into / p.need) * 100)}%;background:linear-gradient(90deg,#fbbf24,#f97316)"></div></div></div>
      <div class="tiny muted">${p.need - p.into} XP avant le niveau ${p.level + 1}. Quête = 10 XP · journée parfaite = +20 · 1 XP par minute de sport.</div>
    </div>

    <div class="card" style="padding:14px">
      <b>${weeks} dernières semaines</b>
      <div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}${'<span></span>'.repeat((new Date(cells[0].k).getDay() + 6) % 7)}${cells.map((c) => `<span class="cell ${c.today ? 'today' : ''}" title="${c.k} : ${c.n}/5" style="background:${c.frozen ? '#60a5fa' : c.n >= G.VALIDATE ? `color-mix(in srgb,#f97316 ${40 + c.n * 12}%,transparent)` : c.n ? 'var(--card-2)' : 'var(--bg-2)'}">${c.frozen ? '❄' : ''}</span>`).join('')}</div>
    </div>

    <div class="card" style="padding:14px">
      <div class="between"><b>Badges</b><span class="small muted">${bs.filter((b) => b.unlocked).length}/${bs.length}</span></div>
      <div class="badge-grid">${bs.map((b) => `<div class="badge-item ${b.unlocked ? 'on' : ''}"><span>${icon(b.icon, 22)}</span><small>${esc(b.label)}</small></div>`).join('')}</div>
    </div>
    ${srcLinks(['lally2010', 'harkin2016', 'mazeas2022', 'patel2019'])}`, { title: 'Ta progression', full: true });
}

// Célébrations : nouvelles quêtes réussies, journée validée, nouveaux badges.
export function celebrate() {
  const st = store.get();
  const key = G.dayKeyOffset(0);
  const goals = G.dayGoals(st, key);
  const seen = st.celebrated?.[key] || [];
  const fresh = goals.filter((g) => g.done && !seen.includes(g.id));
  const doneCount = goals.filter((g) => g.done).length;
  const newBadges = G.badges(st).filter((b) => b.unlocked && !(st.badgesSeen || []).includes(b.id));
  const firstRun = !st.celebrated; // pas de feu d'artifice sur l'historique existant
  store.update((s) => {
    s.celebrated = { [key]: goals.filter((g) => g.done).map((g) => g.id) };
    s.badgesSeen = G.badges(s).filter((b) => b.unlocked).map((b) => b.id);
  });
  if (firstRun) return;
  if (newBadges.length) {
    confetti();
    toast(`🏅 Nouveau badge : ${newBadges.map((b) => b.label).join(', ')}`, 3500);
  } else if (fresh.length) {
    const validatedNow = doneCount >= G.VALIDATE && doneCount - fresh.length < G.VALIDATE;
    confetti(validatedNow ? 60 : 24);
    toast(validatedNow ? `🔥 Journée validée ! Série : ${G.streak(st).current} jour(s)` : `✓ ${fresh[0].label} · +10 XP`, 2500);
  }
}

function confetti(n = 40) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#f97316', '#fbbf24', '#34d399', '#818cf8', '#f472b6', '#38bdf8'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.25}s`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    c.style.setProperty('--r', `${Math.random() * 720}deg`);
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
}
