// Sport : recommandation du jour, chronomètre, semaine type, historique des séances.
import * as store from '../store.js';
import * as C from '../coach.js';
import * as SP from '../sport.js';
import { summary } from '../context.js';
import { icon, esc, fmt, donut, sheet, toast, srcLinks, $, $$ } from '../ui.js';

let timer = null;

// Activité conseillée aujourd'hui : semaine type + état du jour (sommeil, humeur, air, ce qui est déjà fait).
export function todayAdvice(sm, st) {
  const plan = SP.weekPlan(st.profile, st.workouts, new Date(), st.days);
  const slot = plan.find((d) => d.today);
  const reco = C.recommendActivity(sm, st.profile);
  const dayPlan = C.dailyPlan(sm, st.profile);
  const when = dayPlan.find((p) => p.icon === '🏃');
  let type = slot?.type || 'marche', minutes = slot?.minutes || 30, intensity = slot?.intensity || 'moderee';
  const why = [];
  if (!slot?.type) { type = 'marche'; minutes = 30; intensity = 'legere'; why.push('Jour de récupération dans ta semaine type : une marche légère suffit.'); }
  if (sm.ctx.poorSleep && intensity === 'intense') { type = 'marche'; intensity = 'moderee'; minutes = 30; why.push('Nuit courte : on remplace la séance intense par une marche rapide.'); }
  if (slot?.matches) { type = 'yoga'; intensity = 'legere'; minutes = 20; why.push('Séance du jour déjà faite 👏 : mobilité ou étirements pour récupérer.'); }
  if (sm.env && (sm.env.aqi > 60 || sm.env.tMax >= 33) && ['course', 'velo', 'randonnee', 'marche'].includes(type)) why.push('Air ou chaleur défavorables : fais-la en intérieur (tapis, vélo d’appartement, salle).');
  return { type, minutes, intensity, when: when?.time, whenText: when?.text, reco, why: [...why, ...reco.why], src: [...new Set([...reco.src, ...(when?.src || [])])], plan };
}

export function render(view, ctx) {
  clearInterval(timer);
  const st = store.get();
  const sm = summary();
  const wk = SP.weekStats(st.workouts, st.days);
  const zones = SP.hrZones(st.profile.birthYear);
  const adv = todayAdvice(sm, st);
  const a = SP.activity(adv.type);
  const cur = st.workoutNow;
  const recent = [...st.workouts].sort((x, y) => y.start.localeCompare(x.start)).slice(0, 25);

  view.innerHTML = `
    ${cur ? `<section class="sleep-card" style="background:radial-gradient(120% 160% at 100% 0%,rgba(251,146,60,.28),rgba(251,146,60,0) 60%),#140f0b;border-color:rgba(251,146,60,.3)">
      <div class="between"><span class="tiny muted" style="font-weight:700;letter-spacing:.08em;text-transform:uppercase">Séance en cours</span>${icon(SP.activity(cur.type).icon, 18)}</div>
      <div class="big" id="chrono">00:00</div>
      <div class="small muted">${esc(SP.activity(cur.type).label)} · ${SP.INTENSITY[cur.intensity].label.toLowerCase()} · depuis ${new Date(cur.start).toTimeString().slice(0, 5)}</div>
      <div class="row" style="margin-top:14px;flex-wrap:nowrap"><button class="btn" style="flex:1;background:var(--c-move);color:#1a0d02" id="stop">${icon('check', 18)} Terminer</button><button class="btn ghost" id="cancel" aria-label="Annuler">${icon('x', 18)}</button></div>
    </section>` : ''}

    <div class="card">
      <div class="card-head"><h2>${icon('activity', 18)} Ces 7 derniers jours</h2><span class="tiny muted">${wk.sessions.length} séance(s)</span></div>
      <div class="row" style="flex-wrap:nowrap;gap:16px">
        ${donut(wk.modEq, 150, { label: fmt(wk.modEq), sub: 'min / 150', color: 'var(--c-move)', size: 120, overColor: 'var(--good)' })}
        <div style="flex:1" class="stack">
          <div class="stat"><div class="k">${icon('dumbbell', 14)} Renforcement</div><div class="v">${wk.strengthSessions}<small>/ 2 séances</small></div></div>
          <div class="stat"><div class="k">${icon('flame', 14)} Dépense des séances</div><div class="v">${fmt(wk.kcal)}<small>kcal</small></div></div>
        </div>
      </div>
      <p class="tiny muted" style="margin:10px 0 0">Minutes « équivalent modéré » : 1 min intense = 2 min modérées. Repère OMS : 150 à 300 min + 2 séances de renforcement par semaine.</p>
      ${srcLinks(['who2020'])}
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('target', 18)} Conseillé aujourd’hui</h2>${adv.when ? `<span class="badge neutral">${icon('clock', 12)} ${adv.when}</span>` : ''}</div>
      <div class="row" style="flex-wrap:nowrap;gap:12px">
        <span class="icon-badge" style="width:48px;height:48px;background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon(a.icon, 24)}</span>
        <div><div style="font-weight:750;font-size:1.1rem">${esc(a.label)}</div><div class="small muted">${adv.minutes} min · intensité ${SP.INTENSITY[adv.intensity].label.toLowerCase()} · ~${SP.kcal(adv.type, adv.intensity, adv.minutes, st.profile.weight || 70)} kcal</div></div>
      </div>
      <div class="kpi-row" style="margin:12px 0">
        <div class="stat"><div class="k">FC cible</div><div class="v" style="font-size:1rem">${adv.intensity === 'intense' ? `${zones.vig[0]}–${zones.vig[1]}` : `${zones.mod[0]}–${zones.mod[1]}`}<small>bpm</small></div></div>
        <div class="stat"><div class="k">Test de la parole</div><div class="v" style="font-size:.85rem;font-weight:650">${SP.INTENSITY[adv.intensity].talk}</div></div>
        <div class="stat"><div class="k">FC max estimée</div><div class="v" style="font-size:1rem">${zones.max}<small>bpm</small></div></div>
      </div>
      ${adv.why.slice(0, 3).map((w) => `<div class="small" style="margin:6px 0;color:var(--text-2)">• ${esc(w)}</div>`).join('')}
      ${srcLinks([...adv.src, 'tanaka2001', 'sorensen2020', 'knaier2021', 'bruggisser2023'])}
      ${cur ? '' : `<div class="grid2" style="margin-top:12px"><button class="btn" id="go">${icon('zap', 18)} Démarrer</button><button class="btn ghost" id="other">${icon('plus', 18)} Autre séance</button></div>`}
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('calendar', 18)} Ta semaine type</h2><span class="tiny muted">objectif : ${esc(st.profile.goal)}</span></div>
      ${adv.plan.map((d) => `<div class="list-item" style="grid-template-columns:76px 1fr auto;${d.today ? 'background:var(--primary-soft);border-radius:12px;padding-left:8px;padding-right:8px' : ''}">
        <b class="small">${d.day}</b>
        <div><div class="small" style="font-weight:600">${d.type ? esc(SP.activity(d.type).label) : 'Repos'}</div><div class="tiny muted">${d.type ? `${d.minutes} min · ${SP.INTENSITY[d.intensity].label.toLowerCase()}` : 'récupération'}${d.done.length ? ` · fait : ${d.done.map((w) => `${esc(SP.activity(w.type).label.split(' ')[0].toLowerCase())} ${w.minutes} min`).join(', ')}` : ''}</div></div>
        ${d.matches ? `<span style="color:var(--good)">${icon('ok', 20)}</span>` : d.past && d.type ? '<span class="tiny muted">manqué</span>' : ''}
      </div>`).join('')}
      <p class="tiny muted">Construite pour couvrir les repères OMS, avec 48 h entre deux séances de musculation et du fractionné pour la capacité cardio. ${SP.preferredActivity(st.profile) ? `Ton sport préféré (${esc(st.profile.preferredSport)}) remplace le cardio.` : 'Indique ton sport préféré dans Profil pour l’intégrer.'}</p>
      ${srcLinks(['who2020', 'acsm2009', 'schoenfeld2016', 'milanovic2016'])}
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('list', 18)} Séances</h2><button class="btn sm soft" id="add">${icon('plus', 16)} Ajouter</button></div>
      ${recent.length ? recent.map((w) => `<div class="list-item">
        <span class="icon-badge" style="background:color-mix(in srgb,var(--c-move) 14%,transparent);color:var(--c-move)">${icon(SP.activity(w.type).icon, 18)}</span>
        <div><div class="ttl">${esc(SP.activity(w.type).label)}</div><div class="tiny muted">${new Date(w.start).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à ${new Date(w.start).toTimeString().slice(0, 5)} · <b style="color:var(--text)">${w.minutes} min</b> · ${SP.INTENSITY[w.intensity]?.label.toLowerCase() || ''} · ${fmt(w.kcal)} kcal${w.source !== 'manuel' ? ` · ${esc(w.source)}` : ''}</div>${w.note ? `<div class="tiny muted">${esc(w.note)}</div>` : ''}</div>
        <button class="icon-btn" data-del="${w.id}" aria-label="Supprimer">${icon('trash', 14)}</button>
      </div>`).join('') : `<div class="empty">${icon('dumbbell', 28)}<p>Aucune séance. Lance le chronomètre ou ajoute une séance.</p></div>`}
      ${srcLinks(['herrmann2024'])}
    </div>`;

  if (cur) {
    const tick = () => {
      const el = $('#chrono', view);
      if (!el) return clearInterval(timer);
      const s = Math.floor((Date.now() - new Date(cur.start)) / 1000);
      el.textContent = `${s >= 3600 ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    tick();
    timer = setInterval(tick, 1000);
    $('#stop', view).onclick = () => {
      const w = SP.stopWorkout();
      toast(w ? `Séance enregistrée : ${w.minutes} min, ~${w.kcal} kcal` : 'Moins d’une minute : séance ignorée');
      render(view, ctx);
    };
    $('#cancel', view).onclick = () => { if (confirm('Annuler la séance en cours ?')) { store.update((s) => { s.workoutNow = null; }); render(view, ctx); } };
  } else {
    $('#go', view).onclick = () => { SP.startWorkout(adv.type, adv.intensity); toast('C’est parti ! 💪'); render(view, ctx); };
    $('#other', view).onclick = () => openWorkout(ctx, view, true);
  }
  $('#add', view).onclick = () => openWorkout(ctx, view, false);
  $$('[data-del]', view).forEach((b) => (b.onclick = () => { SP.removeWorkout(b.dataset.del); render(view, ctx); }));
}

// Démarrer une autre activité (chrono) ou saisir une séance passée.
export function openWorkout(ctx, view, live) {
  const now = new Date();
  let type = 'marche', intensity = 'moderee';
  const body = sheet(`
    <label class="lbl">Activité</label>
    <div class="chips" style="flex-wrap:wrap">${SP.ACTIVITIES.map((a) => `<button class="chip ${a.id === type ? 'on' : ''}" data-type="${a.id}">${icon(a.icon, 14)} ${esc(a.label)}</button>`).join('')}</div>
    <label class="lbl">Intensité</label>
    <div class="seg">${Object.entries(SP.INTENSITY).map(([k, v]) => `<button data-int="${k}" class="${k === intensity ? 'on' : ''}">${v.label}</button>`).join('')}</div>
    <p class="tiny muted" id="talk">${SP.INTENSITY[intensity].talk}</p>
    ${live ? '' : `<div class="grid2">
      <div><label class="lbl">Début</label><input type="datetime-local" id="start" value="${new Date(now.getTime() - 60 * 60000 - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}"></div>
      <div><label class="lbl">Durée (min)</label><input type="number" id="dur" inputmode="numeric" value="30"></div>
    </div>
    <label class="lbl">Note (facultatif)</label><input id="note" placeholder="ex. 5 km, séance jambes…">
    <p class="small" id="est" style="margin:10px 0 0"></p>`}
    <button class="btn block" id="ok" style="margin-top:14px">${live ? `${icon('zap', 18)} Démarrer le chronomètre` : `${icon('check', 18)} Enregistrer`}</button>`, { title: live ? 'Démarrer une séance' : 'Ajouter une séance' });
  const est = () => {
    $('#talk', body).textContent = `Repère : ${SP.INTENSITY[intensity].talk}.`;
    if (live) return;
    const m = Number($('#dur', body).value) || 0;
    $('#est', body).textContent = `≈ ${SP.kcal(type, intensity, m, store.get().profile.weight || 70)} kcal · compte comme activité ${SP.whoClass(type, intensity) === 'vig' ? 'intense (×2 pour l’OMS)' : SP.whoClass(type, intensity) === 'mod' ? 'modérée' : 'légère'}`;
  };
  $$('[data-type]', body).forEach((b) => (b.onclick = () => { type = b.dataset.type; $$('[data-type]', body).forEach((x) => x.classList.toggle('on', x === b)); est(); }));
  $$('[data-int]', body).forEach((b) => (b.onclick = () => { intensity = b.dataset.int; $$('[data-int]', body).forEach((x) => x.classList.toggle('on', x === b)); est(); }));
  $('#dur', body)?.addEventListener('input', est);
  est();
  $('#ok', body).onclick = () => {
    if (live) SP.startWorkout(type, intensity);
    else {
      const w = SP.addWorkout({ type, intensity, start: new Date($('#start', body).value), minutes: Number($('#dur', body).value) || 0, note: $('#note', body).value });
      toast(`Séance ajoutée : ${w.minutes} min, ~${w.kcal} kcal`);
    }
    body.close();
    render(view, ctx);
  };
}
