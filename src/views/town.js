// Écran « Ta ville » : la ville 3D en plein écran, avec gestion (construire, améliorer, collecter),
// personnalisation et habitants avec qui interagir.
import * as store from '../store.js';
import * as T from '../town.js';
import { icon, esc, toast } from '../ui.js';

let open = null;

const townOf = (st) => st.town || null;
function ensureTown() {
  if (!store.get().town) store.update((s) => { s.town = T.starter(); });
  return store.get().town;
}
export function summary(st = store.get()) {
  const t = townOf(st);
  if (!t) return null;
  const m = T.model(st, t);
  return { name: m.name, population: m.population, happiness: m.happiness, vitality: m.vitality, coins: m.coins, buildings: m.buildings.length, weather: m.weather };
}

// Carte d'entrée dans « Ta progression ».
export function townCard(st = store.get()) {
  const s = summary(st);
  const w = s ? { soleil: '☀️', nuages: '⛅', pluie: '🌧️' }[s.weather.split('+')[0]] : '🏝️';
  return `<button class="card town-card" data-town>
    <div class="town-card-art" aria-hidden="true"><span>🏘️</span><span>${w}</span><span>🌳</span></div>
    <div style="flex:1;min-width:0;text-align:left">
      <b>${s ? esc(s.name) : 'Ta ville'}</b>
      <div class="tiny muted">${s ? `👥 ${s.population} habitants · 😊 ${s.happiness} % · Vitalité ${s.vitality}` : 'Fonde une ville qui vit au rythme de ta santé'}</div>
      <div class="tiny" style="margin-top:4px;color:var(--primary)">${s ? `🪙 ${s.coins} pièces à investir` : 'Ton niveau la fait grandir, tes habitudes la rendent heureuse'}</div>
    </div>${icon('right', 18)}</button>`;
}

const pct = (x) => Math.round(x * 100);
const coin = (n) => `<span class="tw-coin">🪙 ${n}</span>`;
const WEATHER = { soleil: ['☀️', 'Grand soleil'], nuages: ['⛅', 'Nuageux'], pluie: ['🌧️', 'Pluie'] };

export function openTown({ onClose } = {}) {
  if (open) return;
  ensureTown();
  const root = document.createElement('div');
  root.className = 'sheet-root town-root';
  root.innerHTML = `<canvas class="tw-cv" aria-label="Ta ville en 3D"></canvas>
    <div class="tw-loading"><div class="tw-spin"></div><span>Construction de la ville…</span></div>
    <header class="tw-top">
      <button class="tw-icon" data-close aria-label="Fermer">${icon('left', 20)}</button>
      <button class="tw-title" data-p="style"><b></b><small></small></button>
      <button class="tw-vital" data-p="vital" aria-label="Vitalité de la ville"></button>
    </header>
    <div class="tw-stats"></div>
    <div class="tw-events"></div>
    <div class="tw-cam"><button class="tw-icon" data-zoom="0.8" aria-label="Zoomer">+</button><button class="tw-icon" data-zoom="1.25" aria-label="Dézoomer">−</button><button class="tw-icon" data-rot aria-label="Tourner">⟳</button></div>
    <section class="tw-panel" hidden></section>
    <nav class="tw-bar">
      <button data-p="build"><span>🏗️</span>Construire</button>
      <button data-p="people"><span>👥</span>Habitants</button>
      <button data-collect><span>🪙</span><b class="tw-pending"></b>Collecter</button>
      <button data-p="goals"><span>🎯</span>Objectifs<i class="tw-dot" hidden></i></button>
      <button data-p="style"><span>🎨</span>Style</button>
    </nav>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('open'));
  const $ = (s) => root.querySelector(s);
  const panel = $('.tw-panel');
  let m = null, scene = null, ui = { p: null }, timer = 0;

  const save = (fn) => { store.update((s) => fn(s.town)); refresh(); };
  const readyKeys = () => {
    const now = Date.now();
    return m.buildings.filter((b) => (b.b === 'hall' ? m.tax : T.rateOf(b, m.dom, m.vitality)) * Math.min(T.INCOME_CAP_H, (now - (b.at || now)) / 3.6e6) >= 3).map((b) => b.k);
  };
  function refresh() {
    m = T.model(store.get(), store.get().town);
    scene?.update(m, { ready: readyKeys() });
    hud();
    if (ui.p) render(ui.p, ui.arg, true);
  }
  function hud() {
    $('.tw-title b').textContent = m.name;
    $('.tw-title small').textContent = `Niv. ${m.level} · ${m.title}`;
    const [we, wl] = WEATHER[m.weather.split('+')[0]];
    const col = m.vitality >= 68 ? 'var(--good)' : m.vitality >= 45 ? 'var(--warn)' : 'var(--bad)';
    $('.tw-vital').innerHTML = `<svg viewBox="0 0 44 44" width="46" height="46"><circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="4"/><circle cx="22" cy="22" r="18" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${1.13 * m.vitality} 113" transform="rotate(-90 22 22)"/></svg><span>${we}</span><small>${m.vitality}</small>`;
    $('.tw-vital').setAttribute('aria-label', `Vitalité ${m.vitality} sur 100, ${wl}`);
    $('.tw-stats').innerHTML = `<span>🪙 <b>${m.coins}</b></span><span>👥 <b>${m.population}</b><small>/${m.capacity}</small></span><span>${T.moodEmoji(m.happiness)} <b>${m.happiness} %</b></span>`;
    $('.tw-events').innerHTML = m.events.map((e) => `<span class="tw-chip">${e.emoji} ${esc(e.label)}</span>`).join('') + (m.weather.includes('brume') ? '<span class="tw-chip">🌫️ Brume de fatigue</span>' : '') + (m.dormant ? `<span class="tw-chip">🌲 ${m.dormant} bâtiment${m.dormant > 1 ? 's' : ''} sous la forêt : reviens au niveau ${m.nextRadiusLevel}</span>` : '');
    $('.tw-pending').textContent = m.pending > 0 ? `+${m.pending}` : '';
    $('.tw-dot').hidden = !m.goals.some((g) => g.done && !g.claimed);
  }

  function show(html) { panel.innerHTML = `<div class="tw-grip"></div>${html}`; panel.hidden = false; root.classList.add('has-panel'); requestAnimationFrame(() => scene?.inset(panel.hidden ? 0 : panel.offsetHeight + 20)); }
  function closePanel() {
    panel.hidden = true; root.classList.remove('has-panel'); ui = { p: null }; scene?.inset(0);
    scene?.select(null); scene?.selectResident(null); scene?.highlight([]); scene?.ghost(null);
    root.querySelectorAll('.tw-bar [data-p]').forEach((b) => b.classList.remove('on'));
  }
  function render(p, arg, quiet) {
    ui = { p, arg };
    root.querySelectorAll('.tw-bar [data-p]').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    const fn = PANELS[p];
    if (fn) fn(arg, quiet);
  }

  // ---------------------------------------------------------------- panneaux
  const PANELS = {};
  PANELS.build = (arg = {}) => {
    const cat = arg.cat || ui.cat || 'home';
    ui.cat = cat;
    const items = Object.entries(T.BUILDINGS).filter(([, d]) => d.kind === cat && !d.fixed);
    show(`<div class="between"><h3>Construire${arg.at ? ' ici' : ''}</h3>${coin(m.coins)}</div>
      <div class="tw-tabs">${T.CATEGORIES.map(([id, l]) => `<button class="${id === cat ? 'on' : ''}" data-cat="${id}">${l}</button>`).join('')}</div>
      <div class="tw-cards">${items.map(([id, d]) => {
        const locked = d.lvl > m.level, poor = m.coins < d.cost;
        const dom = d.dom && d.dom !== 'all' ? T.DOMAINS[d.dom] : null;
        return `<button class="tw-card ${locked ? 'locked' : ''} ${poor && !locked ? 'poor' : ''}" data-b="${id}" ${locked ? 'aria-disabled="true"' : ''}>
          <span class="e">${d.emoji}</span><b>${esc(d.name)}</b>
          <small>${locked ? `🔒 Niv. ${d.lvl}` : coin(d.cost)}</small>
          <i>${d.cap ? `👥 ${d.cap}` : dom ? `${dom.icon} ${dom.label}` : d.dom === 'all' ? '❤️ Vitalité' : d.charm ? `✨ Charme +${d.charm}` : ''}</i></button>`;
      }).join('')}</div>
      <p class="tiny muted" style="margin:8px 2px 0">${m.free.length ? `${m.free.length} parcelle${m.free.length > 1 ? 's' : ''} libre${m.free.length > 1 ? 's' : ''}.` : 'Plus de parcelle libre : vends un bâtiment ou monte de niveau.'}${m.nextRadiusLevel ? ` Le terrain s’agrandit au niveau ${m.nextRadiusLevel}.` : ''}</p>`);
    panel.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => render('build', { ...arg, cat: b.dataset.cat })));
    panel.querySelectorAll('[data-b]').forEach((b) => (b.onclick = () => {
      const d = T.BUILDINGS[b.dataset.b];
      if (d.lvl > m.level) return toast(`${d.name} : débloqué au niveau ${d.lvl}. Valide tes quêtes pour monter !`);
      if (m.coins < d.cost) return toast(`Il manque ${d.cost - m.coins} pièces. Réussis tes quêtes ou collecte les recettes.`);
      if (!m.free.length) return toast('Aucune parcelle libre');
      if (arg.at && m.free.includes(arg.at)) return render('place', { id: b.dataset.b, at: arg.at, rot: 2 });
      render('place', { id: b.dataset.b });
    }));
  };
  PANELS.place = (arg) => {
    const d = T.BUILDINGS[arg.id];
    scene.highlight(arg.at ? [] : m.free);
    if (arg.at) { scene.ghost(arg.at, arg.id, arg.rot); scene.select(arg.at); }
    show(`<div class="tw-place"><span class="e">${d.emoji}</span><div style="flex:1"><b>${esc(d.name)}</b><div class="tiny muted">${arg.at ? 'Pivote si besoin, puis construis.' : 'Touche une parcelle verte.'}</div></div>
      ${arg.at ? `<button class="tw-btn ghost" data-rot>↻</button><button class="tw-btn" data-ok>Construire ${coin(d.cost)}</button>` : ''}<button class="tw-btn ghost" data-cancel>✕</button></div>`);
    panel.querySelector('[data-cancel]').onclick = () => { scene.ghost(null); scene.highlight([]); scene.select(null); render('build'); };
    if (arg.at) {
      panel.querySelector('[data-rot]').onclick = () => render('place', { ...arg, rot: (arg.rot + 1) % 4 });
      panel.querySelector('[data-ok]').onclick = () => {
        const t = structuredClone(store.get().town);
        const err = T.build(t, m, arg.at, arg.id);
        if (err) return toast(err);
        t.lots[arg.at].rot = arg.rot;
        scene.ghost(null); scene.highlight([]);
        store.update((s) => { s.town = t; });
        refresh();
        toast(`${d.emoji} ${d.name} construit !`);
        render('lot', arg.at);
      };
    }
  };
  PANELS.lot = (k) => {
    scene.select(k);
    const b = m.buildings.find((x) => x.k === k);
    if (!b) {
      if (!T.inRadius(k, m.radius)) {
        const [i, j] = T.parse(k), need = T.levelForRadius(Math.max(Math.abs(i - T.C), Math.abs(j - T.C)));
        return show(`<div class="tw-place"><span class="e">🌲</span><div style="flex:1"><b>Forêt sauvage</b><div class="tiny muted">Ce terrain s’ouvrira au niveau ${need}. Valide tes journées pour gagner de l’XP.</div></div><button class="tw-btn ghost" data-x>✕</button></div>`), (panel.querySelector('[data-x]').onclick = closePanel);
      }
      show(`<div class="tw-place"><span class="e">🌱</span><div style="flex:1"><b>Parcelle libre</b><div class="tiny muted">Prête à accueillir un bâtiment.</div></div><button class="tw-btn" data-here>Construire ici</button><button class="tw-btn ghost" data-x>✕</button></div>`);
      panel.querySelector('[data-here]').onclick = () => render('build', { at: k });
      panel.querySelector('[data-x]').onclick = closePanel;
      return;
    }
    const d = b.def, hall = b.b === 'hall';
    const rate = hall ? m.tax : T.rateOf(b, m.dom, m.vitality);
    const h = Math.min(T.INCOME_CAP_H, (Date.now() - (b.at || Date.now())) / 3.6e6);
    const pend = Math.floor(rate * h);
    const dom = d.dom === 'all' ? { label: 'Vitalité globale', icon: '❤️', color: '#f87171' } : d.dom ? T.DOMAINS[d.dom] : null;
    const occ = d.kind === 'home' ? m.residents.filter((r) => r.home === k) : [];
    const staff = m.residents.filter((r) => r.work === k);
    const st = b.state;
    const effect = d.dom && d.dom !== 'all' ? T.EFFECTS[d.dom][st === 'low' ? 1 : 0] : '';
    const upLvl = T.canUpgrade(b) ? T.upgradeLevel(b) : null, upCost = T.canUpgrade(b) ? T.upgradeCost(b) : 0;
    show(`<div class="tw-head"><span class="e">${d.emoji}</span><div style="flex:1;min-width:0"><b>${esc(d.name)} ${'★'.repeat(b.lvl)}<span class="muted">${'☆'.repeat(Math.max(0, (d.kind === 'deco' ? 1 : 3) - b.lvl))}</span></b><div class="tiny muted">${esc(d.desc)}</div></div><button class="tw-icon sm" data-x aria-label="Fermer">✕</button></div>
      ${dom ? `<div class="tw-dom ${st}"><span>${dom.icon}</span><div style="flex:1"><div class="between small"><b>${esc(dom.label)}</b><b>${T.STATE_LABEL[st]}</b></div><div class="track"><div class="fill" style="width:${pct(b.score)}%;background:${dom.color}"></div></div>${effect ? `<div class="tiny muted" style="margin-top:4px">${esc(effect)}${st === 'low' && d.dom ? ` · quête « ${esc(T.DOMAINS[d.dom].quest)} »` : ''}</div>` : ''}</div></div>` : ''}
      <div class="tw-kpis">
        ${d.kind === 'home' ? `<span><b>${occ.length}/${T.capOf(b)}</b><small>habitants</small></span>` : ''}
        ${hall ? `<span><b>${m.population}</b><small>habitants</small></span><span><b>${m.jobs}</b><small>emplois</small></span>` : ''}
        ${d.jobs ? `<span><b>${staff.length}</b><small>employé${staff.length > 1 ? 's' : ''}</small></span>` : ''}
        ${rate ? `<span><b>${rate.toFixed(1).replace('.', ',')}</b><small>🪙 / heure</small></span><span><b>${pend}</b><small>à collecter</small></span>` : ''}
        ${d.charm ? `<span><b>+${d.charm}</b><small>charme</small></span>` : ''}
      </div>
      ${occ.length ? `<div class="tw-faces">${occ.slice(0, 12).map((r) => `<button data-res="${r.id}" title="${esc(r.name)}" style="background:${r.shirt}">${T.moodEmoji(r.happy)}</button>`).join('')}</div>` : ''}
      <div class="tw-actions">
        ${pend > 0 ? `<button class="tw-btn" data-collect1>Collecter ${coin(pend)}</button>` : ''}
        ${upLvl ? `<button class="tw-btn ${m.level < upLvl || m.coins < upCost ? 'off' : ''}" data-up>⬆ Améliorer ${m.level < upLvl ? `· 🔒 Niv. ${upLvl}` : coin(upCost)}</button>` : ''}
        ${!hall ? `<button class="tw-btn ghost" data-rot>↻ Pivoter</button><button class="tw-btn ghost" data-color>🎨 Couleur</button><button class="tw-btn ghost" data-move>✥ Déplacer</button><button class="tw-btn ghost danger" data-sell>Vendre +${T.refund(b)}</button>` : `<button class="tw-btn ghost" data-p2="style">🎨 Drapeau et nom</button>`}
      </div>`);
    panel.querySelector('[data-x]').onclick = closePanel;
    panel.querySelectorAll('[data-res]').forEach((x) => (x.onclick = () => render('res', +x.dataset.res)));
    panel.querySelector('[data-p2]')?.addEventListener('click', () => render('style'));
    panel.querySelector('[data-collect1]')?.addEventListener('click', () => {
      let got = 0; save((t) => { got = T.collect(t, m, k); });
      toast(`+${got} 🪙`);
    });
    panel.querySelector('[data-up]')?.addEventListener('click', () => {
      const t = structuredClone(store.get().town);
      const err = T.upgrade(t, m, k);
      if (err) return toast(err);
      store.update((s) => { s.town = t; }); refresh(); toast(`⬆ ${d.name} niveau ${t.lots[k].lvl} !`);
    });
    panel.querySelector('[data-rot]')?.addEventListener('click', () => save((t) => T.rotate(t, k)));
    panel.querySelector('[data-color]')?.addEventListener('click', () => save((t) => T.recolor(t, k)));
    panel.querySelector('[data-move]')?.addEventListener('click', () => render('move', k));
    panel.querySelector('[data-sell]')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (!btn.dataset.sure) { btn.dataset.sure = '1'; btn.textContent = `Confirmer la vente (+${T.refund(b)} 🪙)`; return; }
      save((t) => T.sell(t, m, k)); closePanel(); toast(`${d.name} vendu`);
    });
  };
  PANELS.move = (k) => {
    const b = m.buildings.find((x) => x.k === k);
    scene.highlight(m.free); scene.select(k);
    show(`<div class="tw-place"><span class="e">${b.def.emoji}</span><div style="flex:1"><b>Déplacer ${esc(b.def.name)}</b><div class="tiny muted">Touche une parcelle verte.</div></div><button class="tw-btn ghost" data-cancel>✕</button></div>`);
    panel.querySelector('[data-cancel]').onclick = () => { scene.highlight([]); render('lot', k); };
  };
  PANELS.res = (id) => {
    const r = m.residents.find((x) => x.id === id);
    if (!r) return closePanel();
    scene.selectResident(id);
    const home = m.buildings.find((b) => b.k === r.home), work = r.work ? m.buildings.find((b) => b.k === r.work) : null;
    show(`<div class="tw-head"><span class="tw-ava" style="background:${r.shirt}">${T.moodEmoji(r.happy)}</span><div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div class="tiny muted">${r.age} ans · ${home ? esc(home.def.name) : 'sans logement'} · ${work ? `travaille : ${esc(work.def.name)}` : 'sans emploi'}</div></div><button class="tw-icon sm" data-x aria-label="Fermer">✕</button></div>
      <blockquote class="tw-quote">« ${esc(T.thought(r, m))} »</blockquote>
      <div class="meter"><div class="between small"><span>Bonheur</span><b>${r.happy} %</b></div><div class="track"><div class="fill" style="width:${r.happy}%;background:linear-gradient(90deg,#f472b6,#fbbf24)"></div></div></div>
      <details class="tw-why"><summary class="tiny">Pourquoi ${r.happy} % ?</summary>${r.parts.map(([l, v]) => `<div class="between tiny"><span>${esc(l)}</span><b style="color:${v > 0 ? 'var(--good)' : v < 0 ? 'var(--bad)' : 'var(--muted)'}">${v > 0 ? '+' : ''}${v}</b></div>`).join('')}<div class="tiny muted" style="margin-top:4px">Adore ${esc(T.hobby(r))}.</div></details>
      <div class="tw-actions">${T.ACTIONS.map((a) => {
        const lock = a.lvl > m.level, need = a.needs && !m.buildings.some((b) => b.b === a.needs), done = r.done.includes(a.id);
        return `<button class="tw-btn ${lock || need || done ? 'off' : 'ghost'}" data-act="${a.id}">${a.emoji} ${esc(a.label)}${lock ? ` · 🔒 ${a.lvl}` : done ? ' ✓' : a.cost ? ` ${coin(a.cost)}` : a.gain ? ` <small>+${a.gain}🪙</small>` : ''}</button>`;
      }).join('')}<button class="tw-btn ghost" data-follow>🎥 Suivre</button></div>`);
    panel.querySelector('[data-x]').onclick = closePanel;
    panel.querySelector('[data-follow]').onclick = () => { scene.follow(id); toast(`La caméra suit ${r.name.split(' ')[0]}`); };
    panel.querySelectorAll('[data-act]').forEach((x) => (x.onclick = () => {
      const a = T.ACTIONS.find((q) => q.id === x.dataset.act);
      const t = structuredClone(store.get().town);
      const err = T.interact(t, m, id, a.id);
      if (err) return toast(err);
      store.update((s) => { s.town = t; });
      scene.react(id, a.emoji === '👋' ? '😊' : a.emoji);
      if (['walk', 'sport', 'party'].includes(a.id)) scene.send(id, a.id);
      refresh();
      toast(`${r.name.split(' ')[0]} ${a.text}${a.gain ? ` · +${a.gain} 🪙` : ''}`);
    }));
  };
  PANELS.people = () => {
    const list = [...m.residents].sort((a, b) => a.happy - b.happy);
    const sad = list.filter((r) => r.happy < 45).length;
    show(`<div class="between"><h3>${m.population} habitants</h3><span class="small">${T.moodEmoji(m.happiness)} ${m.happiness} %</span></div>
      <p class="tiny muted" style="margin:2px 0 8px">${m.capacity ? `Logements remplis à ${Math.round((m.population / m.capacity) * 100)} % : plus ta vitalité est haute, plus de gens s’installent.` : 'Construis des logements pour accueillir des habitants.'}${sad ? ` ${sad} habitant${sad > 1 ? 's' : ''} ne va pas bien.` : ''} ${m.jobs < m.population ? `Il manque ${m.population - m.jobs} emplois : ouvre des commerces.` : ''}</p>
      <div class="tw-list">${list.map((r) => `<button data-res="${r.id}"><span class="tw-ava sm" style="background:${r.shirt}">${T.moodEmoji(r.happy)}</span><span style="flex:1;min-width:0;text-align:left"><b>${esc(r.name)}</b><small class="muted">${T.DOMAINS[r.fav].icon} ${r.work ? esc(m.buildings.find((b) => b.k === r.work)?.def.name || '') : 'sans emploi'}</small></span><b>${r.happy} %</b></button>`).join('') || '<p class="small muted">Personne pour l’instant.</p>'}</div>`);
    panel.querySelectorAll('[data-res]').forEach((x) => (x.onclick = () => { scene.follow(+x.dataset.res); render('res', +x.dataset.res); }));
  };
  PANELS.goals = () => {
    show(`<h3>Objectifs du maire</h3>
      <div class="tw-list">${m.goals.map((g) => `<div class="tw-goal ${g.claimed ? 'claimed' : g.done ? 'done' : ''}"><span>${g.claimed ? '✅' : g.done ? '🎁' : '⬜'}</span><span style="flex:1">${esc(g.label)}</span>${g.claimed ? '<small class="muted">reçu</small>' : g.done ? `<button class="tw-btn" data-claim="${g.id}">+${g.reward} 🪙</button>` : `<small class="muted">${coin(g.reward)}</small>`}</div>`).join('')}</div>
      <p class="tiny muted" style="margin-top:10px;line-height:1.5"><b>Gagner des pièces :</b> 3 🪙 par quête réussie, 8 par journée validée, 12 de plus pour une journée parfaite. Les commerces et loisirs rapportent chaque heure (jusqu’à ${T.INCOME_CAP_H} h), davantage quand ton domaine de santé lié va bien ; la mairie collecte l’impôt des habitants heureux.</p>`);
    panel.querySelectorAll('[data-claim]').forEach((x) => (x.onclick = () => { let got = 0; save((t) => { got = T.claim(t, m, x.dataset.claim); }); toast(`🎁 +${got} pièces`); }));
  };
  PANELS.vital = () => {
    const [we, wl] = WEATHER[m.weather.split('+')[0]];
    show(`<div class="between"><h3>Vitalité ${m.vitality}/100</h3><span class="small">${we} ${wl}${m.weather.includes('brume') ? ' · 🌫️ brume' : ''}</span></div>
      <p class="tiny muted" style="margin:2px 0 6px">Tes quêtes des 7 derniers jours. Chaque domaine fait vivre une partie de la ville.</p>
      ${Object.entries(T.DOMAINS).map(([id, d]) => { const v = m.dom[id], s = T.stateOf(v); return `<div class="tw-dom ${s}"><span>${d.icon}</span><div style="flex:1"><div class="between small"><b>${d.label}</b><b>${pct(v)} %</b></div><div class="track"><div class="fill" style="width:${pct(v)}%;background:${d.color}"></div></div><div class="tiny muted" style="margin-top:3px">${esc(T.EFFECTS[id][s === 'low' ? 1 : 0])}</div></div></div>`; }).join('')}
      <div class="note" style="margin-top:10px">${esc(T.advice(m))}</div>`);
  };
  PANELS.style = () => {
    const t = store.get().town;
    show(`<h3>Personnaliser</h3>
      <label class="tiny muted">Nom de la ville</label>
      <div class="row" style="gap:8px;margin:4px 0 10px"><input class="input" id="tw-name" maxlength="24" value="${esc(t.name)}" style="flex:1"><button class="tw-btn" id="tw-name-ok">OK</button></div>
      <label class="tiny muted">Saison et paysage</label>
      <div class="tw-chips">${Object.entries(T.THEMES).map(([id, x]) => `<button class="${m.theme === id ? 'on' : ''}" data-theme="${id}"><i style="background:${x.grass}"></i>${x.label}</button>`).join('')}</div>
      <label class="tiny muted">Couleurs des toits et façades</label>
      <div class="tw-chips">${Object.entries(T.PALETTES).map(([id, x]) => `<button class="${m.palette === id ? 'on' : ''}" data-pal="${id}"><i style="background:linear-gradient(135deg,${x.roofs[0]} 50%,${x.walls[0]} 50%)"></i>${x.label}</button>`).join('')}</div>
      <label class="tiny muted">Drapeau de la mairie</label>
      <div class="tw-chips">${T.FLAGS.map((c) => `<button class="sw ${m.flag === c ? 'on' : ''}" data-flag="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}</div>
      <label class="tiny muted">Heure dans la ville</label>
      <div class="tw-chips">${[['reel', '🕐 Heure réelle'], ['jour', '☀️ Jour'], ['soir', '🌇 Soir'], ['nuit', '🌙 Nuit']].map(([id, l]) => `<button class="${m.time === id ? 'on' : ''}" data-time="${id}">${l}</button>`).join('')}</div>`);
    const nm = panel.querySelector('#tw-name');
    panel.querySelector('#tw-name-ok').onclick = () => { const v = nm.value.trim().slice(0, 24); if (v) { save((t) => { t.name = v; }); toast('Ville renommée'); } };
    panel.querySelectorAll('[data-theme]').forEach((x) => (x.onclick = () => save((t) => { t.theme = x.dataset.theme; })));
    panel.querySelectorAll('[data-pal]').forEach((x) => (x.onclick = () => save((t) => { t.palette = x.dataset.pal; })));
    panel.querySelectorAll('[data-flag]').forEach((x) => (x.onclick = () => save((t) => { t.flag = x.dataset.flag; })));
    panel.querySelectorAll('[data-time]').forEach((x) => (x.onclick = () => save((t) => { t.time = x.dataset.time; })));
  };

  // ---------------------------------------------------------------- interactions avec la scène
  function onLot(k) {
    if (!k) return ui.p === 'lot' || ui.p === 'res' ? closePanel() : null;
    if (ui.p === 'place' && !ui.arg.at) { if (m.free.includes(k)) render('place', { ...ui.arg, at: k, rot: 2 }); else toast('Choisis une parcelle verte'); return; }
    if (ui.p === 'place' && ui.arg.at) { if (m.free.includes(k)) render('place', { ...ui.arg, at: k }); return; }
    if (ui.p === 'move') {
      if (!m.free.includes(k)) return toast('Choisis une parcelle verte');
      const from = ui.arg;
      save((t) => T.move(t, m, from, k));
      scene.highlight([]);
      return render('lot', k);
    }
    scene.selectResident(null);
    render('lot', k);
  }
  function onResident(id) {
    if (ui.p === 'place' || ui.p === 'move') return;
    scene.select(null);
    render('res', id);
    const r = m.residents.find((x) => x.id === id);
    if (r) scene.react(id, T.moodEmoji(r.happy));
  }

  root.querySelector('[data-close]').onclick = close;
  root.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => (ui.p === b.dataset.p && !panel.hidden ? closePanel() : (scene.select(null), scene.selectResident(null), scene.ghost(null), scene.highlight([]), render(b.dataset.p)))));
  root.querySelector('[data-collect]').onclick = () => {
    let got = 0;
    save((t) => { got = T.collectAll(t, m); });
    toast(got ? `+${got} 🪙 collectées dans toute la ville` : 'Rien à collecter pour l’instant : repasse dans quelques heures');
  };
  root.querySelectorAll('[data-zoom]').forEach((b) => (b.onclick = () => scene.zoom(+b.dataset.zoom)));
  root.querySelector('[data-rot]').onclick = () => scene.rotate(Math.PI / 4);
  // la feuille du bas se ferme en la glissant vers le bas
  let sy = null;
  panel.addEventListener('touchstart', (e) => { sy = panel.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  panel.addEventListener('touchend', (e) => { if (sy != null && e.changedTouches[0].clientY - sy > 70) closePanel(); sy = null; });

  function close() {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
    root.classList.remove('open');
    setTimeout(() => { scene?.dispose(); root.remove(); }, 250);
    open = null;
    onClose?.();
  }
  const onVis = () => { if (!document.hidden) refresh(); };
  document.addEventListener('visibilitychange', onVis);
  open = { close };

  m = T.model(store.get(), store.get().town);
  hud();
  import('../town3d.js').then((E) => {
    if (!open) return;
    try {
      scene = E.createTown($('.tw-cv'), { onLot, onResident });
      scene.update(m, { ready: readyKeys() });
      root._scene = scene; // accès pour les tests visuels
    } catch (e) {
      $('.tw-loading').innerHTML = `<span>La 3D n’est pas disponible sur cet appareil (${esc(e.message || 'WebGL')}).</span>`;
      return;
    }
    setTimeout(() => $('.tw-loading')?.remove(), 350);
    timer = setInterval(refresh, 60000);
  });
  return open;
}
export const isOpen = () => !!open;
