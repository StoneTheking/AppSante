// Sport : recommandation du jour, chronomètre, semaine type, historique des séances.
import * as V from '../videos.js';
import * as store from '../store.js';
import * as C from '../coach.js';
import * as SP from '../sport.js';
import * as W from '../workouts.js';
import * as SC from '../schedule.js';
import * as N from '../native.js';
import { summary } from '../context.js';
import * as Diana from '../diana.js';
import { icon, esc, fmt, donut, sheet, toast, undoToast, srcLinks, $, $$ } from '../ui.js';

let timer = null;

// Activité conseillée aujourd'hui : semaine type + état du jour (sommeil, humeur, air, ce qui est déjà fait).
export function todayAdvice(sm, st) {
  const plan = SP.weekPlan(st.profile, st.workouts, new Date(), st.days);
  const slot = plan.find((d) => d.today);
  const reco = C.recommendActivity(sm, st.profile);
  const dayPlan = C.dailyPlan(sm, st.profile);
  const when = dayPlan.find((p) => p.icon === '🏃');
  const { type, minutes, intensity, ad, why } = C.sportOfDay(sm, st.profile);
  return { type, minutes, intensity, ad, when: when?.time, whenText: when?.text, reco, why: slot?.matches ? why : [...why, ...reco.why], src: [...new Set([...reco.src, ...(when?.src || [])])], plan };
}

export function render(view, ctx) {
  clearInterval(timer);
  const st = store.get();
  const sm = summary();
  const wk = SP.weekStats(st.workouts, st.days);
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
      <div class="card-head"><h2>${icon('activity', 18)} Ces 7 derniers jours</h2>${wk.sessions.length ? `<span class="tiny muted">${wk.sessions.length} séance${wk.sessions.length > 1 ? 's' : ''} notée${wk.sessions.length > 1 ? 's' : ''}</span>` : ''}</div>
      <div class="row" style="flex-wrap:nowrap;gap:16px">
        ${donut(wk.modEq, 150, { label: fmt(wk.modEq), sub: 'min / 150', color: 'var(--c-move)', size: 120, overColor: 'var(--good)' })}
        <div style="flex:1" class="stack">
          <div class="stat"><div class="k">${icon('dumbbell', 14)} Renforcement</div><div class="v">${wk.strengthSessions}<small>/ 2 séances</small></div></div>
          ${wk.kcal ? `<div class="stat"><div class="k">${icon('flame', 14)} Dépense des séances</div><div class="v">${fmt(wk.kcal)}<small>kcal</small></div></div>` : `<div class="stat"><div class="k">${icon('zap', 14)} Activité intense</div><div class="v">${fmt(wk.vig)}<small>min</small></div></div>`}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('target', 18)} Conseillé aujourd’hui</h2>${adv.when ? `<span class="badge neutral">${icon('clock', 12)} ${adv.when}</span>` : ''}</div>
      <div class="row" style="flex-wrap:nowrap;gap:12px">
        <span class="icon-badge" style="width:48px;height:48px;background:color-mix(in srgb,var(--c-move) 16%,transparent);color:var(--c-move)">${icon(a.icon, 24)}</span>
        <div><div style="font-weight:750;font-size:1.1rem">${esc(a.label)}</div><div class="small muted">${adv.minutes} min · intensité ${SP.INTENSITY[adv.intensity].label.toLowerCase()} · ~${SP.kcal(adv.type, adv.intensity, adv.minutes, st.profile.weight || 70)} kcal</div></div>
      </div>
      <div style="height:10px"></div>
      ${adv.why.slice(0, 1).map((w) => `<div class="small" style="margin:6px 0;color:var(--text-2)">• ${esc(w)}</div>`).join('')}
      ${srcLinks([...adv.src, 'borg1982', 'knaier2021', 'bruggisser2023', ...(adv.ad?.note ? ['foster2001', 'greig2020'] : [])])}
      ${cur ? '' : `<button class="btn block" id="guided" style="margin-top:12px">${icon('list', 18)} Voir la séance et ses exercices</button>
      <div class="grid2" style="margin-top:8px"><button class="btn ghost" id="go">${icon('zap', 18)} Chrono seul</button><button class="btn ghost" id="other">${icon('plus', 18)} Autre séance</button></div>`}
    </div>

    <div class="card">
      <div class="card-head"><h2 style="white-space:nowrap">${icon('calendar', 18)} Ta semaine</h2><span class="row" style="gap:14px;flex-wrap:nowrap;white-space:nowrap"><button class="link" id="edit-week">${icon('pencil', 14)} Modifier</button><button class="link" id="my-sports">${icon('settings', 14)} Sports</button></span></div>
      ${adv.plan.map((d, i) => `<div class="list-item" data-day="${i}" style="cursor:pointer;grid-template-columns:76px 1fr auto;${d.today ? 'background:var(--primary-soft);border-radius:12px;padding-left:8px;padding-right:8px' : ''}">
        <b class="small">${d.day}</b>
        <div><div class="small" style="font-weight:600">${d.type ? esc(SP.activity(d.type).label) : 'Repos'}</div><div class="tiny muted">${d.type ? `${d.minutes} min · ${SP.INTENSITY[d.intensity].label.toLowerCase()}` : 'récupération'}${d.done.length ? ` · fait : ${d.done.map((w) => `${esc(SP.activity(w.type).label.split(' ')[0].toLowerCase())} ${w.minutes} min`).join(', ')}` : ''}</div></div>
        ${d.matches ? `<span style="color:var(--good)">${icon('ok', 20)}</span>` : d.past && d.type ? '<span class="tiny muted">manqué</span>' : d.type ? `<span class="muted">${icon('right', 16)}</span>` : ''}
      </div>`).join('')}
      <button class="btn soft block" id="plan-week" style="margin-top:10px">${icon('calendar', 18)} Planifier ma semaine dans l’agenda</button>
      ${srcLinks(['who2020', 'acsm2009', 'schoenfeld2016', 'milanovic2016', 'belanger2011'])}
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
      if (w) askFeedback(w, () => render(view, ctx));
    };
    $('#cancel', view).onclick = () => { if (confirm('Annuler la séance en cours ?')) { store.update((s) => { s.workoutNow = null; }); render(view, ctx); } };
  } else {
    $('#go', view).onclick = () => { SP.startWorkout(adv.type, adv.intensity); toast('C’est parti ! 💪'); render(view, ctx); };
    $('#other', view).onclick = () => openWorkout(ctx, view, true);
  }
  $('#add', view).onclick = () => openWorkout(ctx, view, false);
  Diana.context('sport', st, sm);
  $('#plan-week', view).onclick = () => planWeekInCalendar(adv.plan);
  $('#guided', view)?.addEventListener('click', () => openSession(ctx, view, { activity: adv.type, minutes: adv.minutes, intensity: adv.intensity, dayIndex: adv.plan.findIndex((d) => d.today) }));
  $$('[data-day]', view).forEach((r) => (r.onclick = () => {
    const d = adv.plan[Number(r.dataset.day)];
    if (d.type) openSession(ctx, view, { activity: d.type, minutes: d.minutes, intensity: d.intensity, dayIndex: Number(r.dataset.day), day: d.day });
  }));
  $('#my-sports', view).onclick = () => openMySports(() => render(view, ctx));
  $('#edit-week', view).onclick = () => openWeekEditor(() => render(view, ctx));
  $$('[data-del]', view).forEach((b) => (b.onclick = () => { const id = b.dataset.del; const undo = store.removing(() => {}); SP.removeWorkout(id); render(view, ctx); undoToast('Séance supprimée', undo); }));
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
    ${live ? `<label class="lbl">Durée</label><div class="chips">${[20, 30, 45, 60, 90].map((m) => `<button class="chip ${m === 30 ? 'on' : ''}" data-lmin="${m}">${m} min</button>`).join('')}</div>
    <button class="btn block" id="see" style="margin-top:14px">${icon('list', 18)} Voir la séance et ses exercices</button>` : ''}
    <button class="btn ${live ? 'ghost' : ''} block" id="ok" style="margin-top:${live ? 8 : 14}px">${live ? `${icon('zap', 18)} Chrono seul` : `${icon('check', 18)} Enregistrer`}</button>`, { title: live ? 'Autre séance' : 'Ajouter une séance' });
  let lmin = 30;
  $$('[data-lmin]', body).forEach((b) => (b.onclick = () => { lmin = Number(b.dataset.lmin); $$('[data-lmin]', body).forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#see', body)?.addEventListener('click', () => { body.close(); setTimeout(() => openSession(ctx, view, { activity: type, minutes: lmin, intensity }), 250); });
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

const level = (st) => st.profile.fitnessLevel || 'debutant';
// Exercices personnalisés : { [libellé]: { video: url, hidden: true } }
const exCustom = () => store.get().exerciseCustom || {};
const hiddenEx = () => new Set(Object.entries(exCustom()).filter(([, v]) => v.hidden).map(([k]) => k));
const videoFor = (label) => exCustom()[label]?.video || V.DEFAULT_VIDEOS[label] || W.tutoUrl(label);
const setEx = (label, patch) => store.update((s) => { s.exerciseCustom = s.exerciseCustom || {}; const v = { ...(s.exerciseCustom[label] || {}), ...patch }; for (const k of Object.keys(v)) if (v[k] == null) delete v[k]; if (Object.keys(v).length) s.exerciseCustom[label] = v; else delete s.exerciseCustom[label]; });

// Choisir sa propre vidéo pour un exercice (lien copié depuis YouTube ou ailleurs).
function openVideoPicker(label, done) {
  const cur = exCustom()[label]?.video || '';
  const def = V.DEFAULT_VIDEOS[label];
  const body = sheet(`
    <p class="small" style="margin-top:0"><b>${esc(label)}</b></p>
    ${def ? `<a class="btn soft block" href="${esc(cur || def)}" target="_blank" rel="noopener" style="margin-bottom:12px">${icon('video', 18)} Voir ${cur ? 'ma vidéo' : 'la vidéo choisie'}</a><p class="tiny muted" style="margin:0 0 6px">Pour en mettre une autre :</p>` : ''}
    <ol class="small" style="padding-left:18px;line-height:1.6;margin:0 0 10px">
      <li><a class="tuto" href="${W.tutoUrl(label)}" target="_blank" rel="noopener" style="margin:0">Chercher sur YouTube</a> (ou ailleurs)</li>
      <li>Sous la vidéo qui te plaît : <b>Partager → Copier le lien</b></li>
      <li>Reviens ici et colle le lien</li>
    </ol>
    <div class="row" style="flex-wrap:nowrap;gap:8px"><input id="u" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${esc(cur)}" style="flex:1"><button class="btn soft sm" id="paste">Coller</button></div>
    <button class="btn block" id="ok" style="margin-top:12px">${icon('check', 18)} Utiliser cette vidéo</button>
    ${cur ? `<button class="btn ghost block" id="reset" style="margin-top:8px">${icon('refresh', 16)} ${def ? 'Revenir à la vidéo choisie' : 'Revenir à la recherche automatique'}</button>` : ''}`, { title: 'Ma vidéo pour cet exercice', onClose: done });
  $('#paste', body).onclick = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) $('#u', body).value = t.trim(); else toast('Presse-papiers vide'); } catch { toast('Appui long dans le champ → Coller'); $('#u', body).focus(); }
  };
  $('#ok', body).onclick = () => {
    const m = $('#u', body).value.match(/https?:\/\/\S+/);
    if (!m) return toast('Colle un lien qui commence par https://');
    setEx(label, { video: m[0] });
    toast('Vidéo enregistrée 🎬', 1200);
    body.close();
  };
  $('#reset', body)?.addEventListener('click', () => { setEx(label, { video: null }); body.close(); });
}
// Toutes les vidéos d'exercices au même endroit, avec import d'une liste « Exercice | lien ».
export function openVideoList(done) {
  const body = sheet('<div id="vl"></div>', { title: 'Vidéos des exercices', full: true, onClose: done });
  const el = $('#vl', body);
  const draw = () => {
    const c = exCustom();
    const n = [...V.NEEDS_VIDEO].filter((l) => c[l]?.video).length;
    const kind = (l) => (c[l]?.video ? 'ma vidéo' : V.DEFAULT_VIDEOS[l] ? 'choisie' : 'recherche');
    el.innerHTML = `<p class="small muted" style="margin-top:0">Une vidéo n’est proposée que pour les exercices où la technique compte. Chacun a déjà une démonstration choisie ; touche un exercice pour la voir ou mettre la tienne${n ? ` (${n} perso)` : ''}.</p>
      <details class="card" style="padding:12px;margin-bottom:12px"><summary class="small" style="font-weight:600">${icon('upload', 14)} Importer une liste (Exercice | lien)</summary>
        <p class="tiny muted">Colle ici le contenu du fichier « videos-exercices.txt » une fois rempli.</p>
        <textarea id="imp" rows="5" placeholder="Pompes | https://youtu.be/…"></textarea>
        <button class="btn sm block" id="imp-ok" style="margin-top:8px">Importer</button></details>
      ${V.VIDEO_GROUPS.map(([g, xs]) => `<h3 style="font-size:.9rem;margin:14px 0 4px">${esc(g)}</h3>${xs.map((l) => `<button class="list-item vid-row" data-vl="${esc(l)}"><span class="icon-badge" style="color:${kind(l) === 'recherche' ? 'var(--muted)' : kind(l) === 'ma vidéo' ? 'var(--good)' : 'var(--c-move)'}">${icon(kind(l) === 'recherche' ? 'search' : 'video', 16)}</span><span class="small" style="text-align:left">${esc(l)}</span><span class="tiny muted">${kind(l)}</span></button>`).join('')}`).join('')}`;
    $$('[data-vl]', el).forEach((b) => (b.onclick = () => openVideoPicker(b.dataset.vl, draw)));
    $('#imp-ok', el).onclick = () => {
      const m = Object.fromEntries(Object.entries(V.parseVideoList($('#imp', el).value)).filter(([l, u]) => u !== V.DEFAULT_VIDEOS[l] || exCustom()[l]?.video));
      const k = Object.keys(m).length;
      if (!k) return toast('Aucun lien nouveau : la liste est identique aux vidéos déjà choisies');
      Object.entries(m).forEach(([l, u]) => setEx(l, { video: u }));
      toast(`${k} vidéo${k > 1 ? 's' : ''} importée${k > 1 ? 's' : ''} 🎬`);
      draw();
    };
  };
  draw();
}

const equip = (st) => st.profile.equipment || 'aucun';
const fmtDur = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)} min${sec % 60 ? ` ${sec % 60} s` : ''}` : `${sec} s`);

// Détail d'une séance : durée au choix (une durée conseillée), blocs, exercices, séries, repos, consignes.
export function openSession(ctx, view, { activity, minutes, intensity, dayIndex = 0, day }) {
  const st = store.get();
  const ad = SP.adaptation(st.sportFeedback, activity);
  const lvl = SP.adaptedLevel(level(st), ad);
  const advised = minutes;
  let chosen = minutes;
  const body = sheet('<div id="ss"></div>', { title: 'Séance', full: true });
  const el = $('#ss', body);
  const draw = () => {
    const hidden = hiddenEx();
    const session = W.buildSession({ activity, minutes: chosen, intensity, level: lvl, equipment: equip(st), goal: st.profile.goal, dayIndex, zones: SP.hrZones(st.profile.birthYear), hidden });
    const opts = [...new Set([15, 20, 30, 45, 60, advised])].sort((a, b) => a - b);
    el.innerHTML = `
      <div class="between"><div><div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em">${esc(day || 'Aujourd’hui')} · ${{ debutant: 'débutant', intermediaire: 'intermédiaire', avance: 'avancé' }[lvl]}</div><h2 style="margin:2px 0">${esc(session.title)}</h2></div>
        <div style="text-align:right"><div style="font-size:1.4rem;font-weight:800">${session.minutes}<small style="font-size:.75rem;color:var(--muted)"> min</small></div><div class="tiny muted">~${SP.kcal(activity, intensity, session.minutes, st.profile.weight || 70)} kcal</div></div></div>
      <label class="lbl">Durée</label>
      <div class="chips">${opts.map((m) => `<button class="chip ${m === chosen ? 'on' : ''}" data-min="${m}">${m} min${m === advised ? ' ★' : ''}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:2px 0 0">★ conseillé${ad.note ? ` · ${esc(ad.note)}` : ' d’après ta semaine type et ton ressenti'} · touche un exercice pour sa vidéo, choisir la tienne ou le retirer</p>
      ${session.blocks.map((b) => `<div class="card" style="margin:12px 0;padding:14px">
        <div class="between"><b>${esc(b.title)}</b><span class="tiny muted">${W.minutesOf([b])} min</span></div>
        ${b.note ? `<p class="tiny muted" style="margin:4px 0 6px">${esc(b.note)}</p>` : ''}
        ${b.items.map((it) => `<details style="padding:8px 0;border-top:1px solid var(--line)"><summary><span class="small" style="font-weight:600">${esc(it.label)}${W.hasTuto(it) || exCustom()[it.label]?.video ? ` <span style="color:var(--c-move);vertical-align:-2px">${icon('video', 13)}</span>` : ''}</span><span class="tiny muted" style="white-space:nowrap;margin-left:8px">${it.sets && !b.circuit ? `${it.sets} × ` : ''}${it.kind === 'reps' ? `${esc(String(it.reps))}${String(it.reps).includes('m') ? '' : ' rép.'}` : it.seconds ? fmtDur(it.seconds) : ''}${it.rest && !b.circuit ? ` · repos ${it.rest} s` : ''}</span></summary>${it.detail ? `<p class="tiny muted" style="margin:6px 0 0">${esc(it.detail)}</p>` : ''}<div class="ex-actions">${W.hasTuto(it) || exCustom()[it.label]?.video ? `<a class="tuto" href="${esc(videoFor(it.label))}" target="_blank" rel="noopener">▶ ${exCustom()[it.label]?.video ? 'Ma vidéo' : 'Voir la démo'}</a><button class="link tiny" data-vid="${esc(it.label)}">${icon('pencil', 12)} Changer</button>` : ''}<button class="link tiny" data-hide-ex="${esc(it.label)}" style="color:var(--bad)">${icon('trash', 12)} Retirer</button></div></details>`).join('')}
      </div>`).join('')}
      ${hidden.size ? `<details class="small" style="margin:8px 0"><summary class="muted">${hidden.size} exercice${hidden.size > 1 ? 's' : ''} retiré${hidden.size > 1 ? 's' : ''}</summary>${[...hidden].map((l) => `<div class="between" style="padding:6px 0;border-top:1px solid var(--line)"><span class="small">${esc(l)}</span><button class="btn sm soft" data-unhide-ex="${esc(l)}">Rétablir</button></div>`).join('')}</details>` : ''}
      ${srcLinks([...session.src, ...(ad.note ? ['foster2001', 'greig2020'] : [])])}
      <button class="btn block" id="start-guided" style="margin-top:12px">${icon('zap', 18)} Lancer le mode guidé</button>
      <button class="btn ghost block" id="vid-list" style="margin-top:8px">${icon('video', 18)} Choisir les vidéos des exercices</button>`;
    $$('[data-min]', el).forEach((b) => (b.onclick = () => { chosen = Number(b.dataset.min); draw(); }));
    $$('[data-vid]', el).forEach((b) => (b.onclick = () => openVideoPicker(b.dataset.vid, draw)));
    $$('[data-hide-ex]', el).forEach((b) => (b.onclick = () => { setEx(b.dataset.hideEx, { hidden: true }); toast('Exercice retiré : il ne te sera plus proposé', 1800); draw(); }));
    $$('[data-unhide-ex]', el).forEach((b) => (b.onclick = () => { setEx(b.dataset.unhideEx, { hidden: null }); draw(); }));
    $('#vid-list', el).onclick = () => openVideoList(draw);
    $('#start-guided', el).onclick = () => { body.close(); setTimeout(() => guided(ctx, view, session, activity, intensity), 250); };
  };
  draw();
}

// Fin de séance : ressenti → la séance suivante s'adapte.
export function askFeedback(w, done) {
  const body = sheet(`
    <p class="small muted" style="margin-top:0">${esc(SP.activity(w.type).label)} · ${w.minutes} min. Ta réponse ajuste la prochaine séance.</p>
    <div class="feedback">
      <button data-fb="-1"><span>🥵</span>Trop dur</button>
      <button data-fb="0"><span>👌</span>Bien</button>
      <button data-fb="1"><span>💪</span>Pas assez dur</button>
    </div>
    ${srcLinks(['foster2001', 'greig2020', 'ekkekakis2011'])}`, { title: 'C’était comment ?', onClose: done });
  $$('[data-fb]', body).forEach((b) => (b.onclick = () => {
    const rating = Number(b.dataset.fb);
    store.update((s) => { s.sportFeedback = [...(s.sportFeedback || []), { date: w.date, type: w.type, rating }].slice(-40); });
    b.classList.add('pop');
    toast(rating < 0 ? 'Noté : la prochaine séance sera allégée' : rating > 0 ? 'Noté : on monte d’un cran la prochaine fois 💪' : 'Parfait, on garde ce rythme 👌', 2200);
    setTimeout(() => body.close(), 350);
  }));
}

// Semaine type personnalisée : un sport (ou repos), une durée et une intensité par jour.
export function openWeekEditor(done) {
  const body = sheet('<div id="we"></div>', { title: 'Ma semaine type', full: true, onClose: done });
  const el = $('#we', body);
  let open = -1;
  const draw = () => {
    const st = store.get();
    const tpl = SP.currentTemplate(st.profile);
    el.innerHTML = `<p class="small muted" style="margin-top:0">Touche un jour pour choisir son sport, sa durée et son intensité. Repère OMS : 150 min d’activité modérée et 2 séances de renforcement par semaine.</p>
      ${tpl.map((d, i) => `<div class="week-day ${open === i ? 'open' : ''}">
        <button class="between wd-head" data-open="${i}"><b class="small">${SP.DAYS[i]}</b><span class="small">${d.type ? `${esc(SP.activity(d.type).label)} · ${d.minutes} min · ${SP.INTENSITY[d.intensity].label.toLowerCase()}` : '<span class="muted">Repos</span>'}</span></button>
        ${open === i ? `<div class="wd-body">
          <div class="chips" style="flex-wrap:wrap"><button class="chip ${!d.type ? 'on' : ''}" data-type="">Repos</button>${SP.ACTIVITIES.filter((a) => a.id !== 'autre' && !(st.profile.excludedSports || []).includes(a.id)).map((a) => `<button class="chip ${d.type === a.id ? 'on' : ''}" data-type="${a.id}">${icon(a.icon, 13)} ${esc(a.label)}</button>`).join('')}</div>
          ${d.type ? `<label class="lbl">Durée</label><div class="chips">${[15, 20, 30, 40, 45, 60, 75, 90].map((m) => `<button class="chip ${d.minutes === m ? 'on' : ''}" data-dmin="${m}">${m} min</button>`).join('')}</div>
          <label class="lbl">Intensité</label><div class="seg">${Object.entries(SP.INTENSITY).map(([k, v]) => `<button data-int="${k}" class="${d.intensity === k ? 'on' : ''}">${v.label}</button>`).join('')}</div>` : ''}
        </div>` : ''}</div>`).join('')}
      <p class="small" style="margin:12px 0 0">${(() => { const w = SP.templateStats(tpl); return `Total : <b>${w.modEq} min</b> d’activité (équivalent modéré) · <b>${w.strength}</b> séance(s) de renforcement ${w.modEq >= 150 && w.strength >= 2 ? '✅' : '· en dessous des repères OMS'}`; })()}</p>
      <div class="grid2" style="margin-top:14px"><button class="btn ghost" id="reset">${icon('refresh', 16)} Semaine conseillée</button><button class="btn" id="ok">${icon('check', 16)} Terminé</button></div>
      ${srcLinks(['who2020', 'acsm2009'])}`;
    const set = (f) => { store.update((s) => { const t = SP.currentTemplate(s.profile).map((x) => ({ ...x })); f(t[open]); s.profile.weekTemplate = t; }); draw(); };
    $$('[data-open]', el).forEach((b) => (b.onclick = () => { const i = Number(b.dataset.open); open = open === i ? -1 : i; draw(); }));
    $$('[data-type]', el).forEach((b) => (b.onclick = () => set((d) => { d.type = b.dataset.type || null; if (d.type && !d.minutes) d.minutes = 30; if (d.type === 'yoga') d.intensity = 'legere'; })));
    $$('[data-dmin]', el).forEach((b) => (b.onclick = () => set((d) => { d.minutes = Number(b.dataset.dmin); })));
    $$('[data-int]', el).forEach((b) => (b.onclick = () => set((d) => { d.intensity = b.dataset.int; })));
    $('#reset', el).onclick = () => { store.update((s) => { delete s.profile.weekTemplate; }); open = -1; draw(); toast('Semaine conseillée rétablie', 1200); };
    $('#ok', el).onclick = () => body.close();
  };
  draw();
}

// Préférences de sports : pour chaque sport, « J'aime » (proposé en priorité), neutre, ou « Jamais » (jamais proposé).
export function sportPrefsHtml(fav = [], ex = []) {
  return `<div class="sport-rows">${SP.ACTIVITIES.filter((a) => a.id !== 'autre').map((a) => {
    const v = fav.includes(a.id) ? 1 : ex.includes(a.id) ? -1 : 0;
    return `<div class="sport-row"><span class="lab">${icon(a.icon, 16)} ${esc(a.label)}</span><span class="tri" data-sport="${a.id}">
      <button data-v="1" class="${v === 1 ? 'on like' : ''}" aria-label="J’aime">♥ J’aime</button><button data-v="0" class="${v === 0 ? 'on neutral' : ''}" aria-label="Neutre">–</button><button data-v="-1" class="${v === -1 ? 'on dislike' : ''}" aria-label="Jamais">✕ Jamais</button></span></div>`;
  }).join('')}</div>`;
}
export function bindSportPrefs(el, onPick) {
  $$('[data-sport] button', el).forEach((b) => (b.onclick = () => {
    const box = b.closest('[data-sport]');
    $$('button', box).forEach((x) => { x.className = x === b ? `on ${['dislike', 'neutral', 'like'][Number(x.dataset.v) + 1]}` : ''; });
    navigator.vibrate?.(8);
    onPick(box.dataset.sport, Number(b.dataset.v));
  }));
}
export function applySportPref(p, id, v) {
  const f = new Set(p.favSports || []), x = new Set(p.excludedSports || []);
  f.delete(id); x.delete(id);
  if (v > 0) f.add(id); else if (v < 0) x.add(id);
  return { favSports: [...f], excludedSports: [...x] };
}

// Temps dispo par jour et format de séance (tuto et Mes sports) : la semaine type s'y adapte.
export function sportTimeHtml(p, attr) {
  return `<label class="lbl">Temps dispo pour le sport, par jour</label>
    <div class="chips">${[15, 20, 30, 45, 60, 90].map((m) => `<button class="chip ${Number(p.sportMinutes || 45) === m ? 'on' : ''}" ${attr}="sportMinutes" data-v="${m}">${m === 90 ? '1 h 30+' : m === 60 ? '1 h' : `${m} min`}</button>`).join('')}</div>
    <label class="lbl">Tu préfères</label>
    <div class="choice">${[['courtes', 'Des séances courtes, souvent', '5–6 jours par semaine'], ['equilibre', 'Un peu des deux', '4–5 séances moyennes'], ['longues', 'Quelques grosses séances', '3–4 jours par semaine']].map(([v, t, d]) => `<button ${attr}="sessionStyle" data-v="${v}" class="${(p.sessionStyle || 'equilibre') === v ? 'on' : ''}" style="padding:10px 14px"><span><b>${t}</b><br><span class="small muted" style="font-weight:500">${d}</span></span></button>`).join('')}</div>
    ${p.weekTemplate ? '<p class="tiny muted" style="margin:6px 0 0">Tu as modifié ta semaine à la main : changer un de ces choix la recalcule.</p>' : ''}`;
}

// Mes sports : préférés (proposés en priorité), exclus (jamais proposés, remplacés par un équivalent).
export function openMySports(done) {
  const body = sheet('<div id="ms"></div>', { title: 'Mes sports', onClose: done });
  const el = $('#ms', body);
  const draw = () => {
    const p = store.get().profile;
    el.innerHTML = `<p class="small muted" style="margin-top:0">« Jamais » : ce sport n’est plus proposé et il est remplacé par une activité équivalente.</p>
      ${sportPrefsHtml(p.favSports, p.excludedSports)}
      ${sportTimeHtml(p, 'data-sp')}
      <label class="lbl">Matériel</label>
      <div class="seg">${[['aucun', 'Sans matériel'], ['halteres', 'Haltères'], ['salle', 'Salle']].map(([v, l]) => `<button data-equip="${v}" class="${(p.equipment || 'aucun') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button class="btn ghost block" id="vids" style="margin-top:16px">${icon('video', 18)} Vidéos des exercices</button>
      <button class="btn block" id="ok" style="margin-top:8px">${icon('check', 18)} Terminé</button>`;
    $('#vids', el).onclick = () => openVideoList();
    // Changer ses préférences recalcule la semaine (même si elle avait été modifiée à la main).
    const recompute = (s) => { if (s.profile.weekTemplate) { delete s.profile.weekTemplate; toast('Semaine recalculée selon tes préférences', 1600); } };
    bindSportPrefs(el, (id, v) => store.update((s) => { Object.assign(s.profile, applySportPref(s.profile, id, v)); recompute(s); }));
    $$('[data-sp]', el).forEach((b) => (b.onclick = () => { store.update((s) => { s.profile[b.dataset.sp] = b.dataset.sp === 'sportMinutes' ? Number(b.dataset.v) : b.dataset.v; recompute(s); }); draw(); }));
    $$('[data-equip]', el).forEach((b) => (b.onclick = () => { store.update((s) => { s.profile.equipment = b.dataset.equip; }); draw(); }));
    $('#ok', el).onclick = () => body.close();
  };
  draw();
}

// Mode guidé : une étape à la fois, minuteur pour les exercices chronométrés et les repos.
function guided(ctx, view, session, activity, intensity) {
  const steps = W.flatten(session);
  let i = 0, left = 0, paused = false, tick = null, lastPct = 0;
  if (!store.get().workoutNow) SP.startWorkout(activity, intensity);
  // écran allumé pendant la séance (repris au retour dans l'appli)
  let lock = null;
  const keepAwake = async () => { try { if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen'); } catch { /* non pris en charge */ } };
  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
  const body = sheet(`<div id="gd"></div>`, { title: session.title, full: true, onClose: () => { clearInterval(tick); lock?.release?.().catch(() => {}); document.removeEventListener('visibilitychange', keepAwake); render(view, ctx); } });
  const el = $('#gd', body);
  // fin d'étape : vibration + deux bips courts (le téléphone est souvent posé au sol)
  let audio = null;
  const beep = () => {
    navigator.vibrate?.([120, 60, 120]);
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22].forEach((t) => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.15); o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.16); });
    } catch { /* pas de son */ }
  };
  const draw = () => {
    const s = steps[i];
    const next = steps[i + 1];
    const pct = Math.round((i / steps.length) * 100);
    el.innerHTML = `
      <div class="meter" style="margin-top:0"><div class="between tiny muted"><span>${esc(s.block)}</span><span>étape ${i + 1}/${steps.length}</span></div><div class="track"><div class="fill" id="gd-fill" style="width:${lastPct}%;background:var(--c-move);animation:none"></div></div></div>
      <div class="gd-main">
        <div class="gd-set">${s.isRest || !(s.sets > 1) ? '' : `${s.block.startsWith('Circuit') ? 'Tour' : 'Série'} ${s.set} / ${s.sets}`}</div>
        <div class="gd-label">${esc(s.label)}</div>
        <div class="gd-big" style="color:${s.isRest ? 'var(--c-sleep)' : 'var(--c-move)'}" id="big">${s.kind === 'time' ? fmtClock(left) : `${esc(String(s.reps))}${String(s.reps).includes('m') ? '' : ' rép.'}`}</div>
      </div>
      <!-- zones de hauteur fixe : les boutons restent au même endroit quel que soit l'exercice -->
      <p class="small muted gd-detail">${esc(s.detail || '')}</p>
      <p class="gd-tuto">${!s.isRest && (W.hasTuto(s) || exCustom()[s.label]?.video) ? `<a class="tuto" href="${esc(videoFor(s.label))}" target="_blank" rel="noopener">▶ ${exCustom()[s.label]?.video ? 'Ma vidéo' : 'Voir la démo'}</a>` : ''}</p>
      <p class="tiny muted gd-next">${next && !s.isRest ? `Ensuite : ${esc(next.label)}` : ''}</p>
      <div class="row gd-ctrl">
        <button class="btn ghost" id="prev" ${i === 0 ? 'disabled' : ''} aria-label="Précédent">${icon('left', 18)}</button>
        ${s.kind === 'time' ? `<button class="btn ghost" id="pause" style="flex:1">${paused ? 'Reprendre' : 'Pause'}</button>` : ''}
        <button class="btn" id="next" style="flex:2;background:var(--c-move);color:#1a0d02">${s.kind === 'reps' ? `${icon('check', 18)} Série faite` : i === steps.length - 1 ? 'Terminer' : `Passer ${icon('right', 18)}`}</button>
      </div>
      <button class="btn ghost block" id="finish" style="margin-top:10px">${icon('check', 18)} Terminer et enregistrer la séance</button>
      ${Diana.inline('guided', store.get(), null, { step: s, i, n: steps.length })}`;
    // la barre avance depuis sa position précédente au lieu de repartir de zéro
    requestAnimationFrame(() => { const f = $('#gd-fill', el); if (f) f.style.width = `${pct}%`; });
    lastPct = pct;
    $('#prev', el).onclick = () => go(i - 1);
    $('#next', el).onclick = () => go(i + 1);
    $('#pause', el)?.addEventListener('click', () => { paused = !paused; draw(); });
    $('#finish', el).onclick = finish;
    Diana.bindInline(el, 'guided', store.get(), null, { step: s, i, n: steps.length });
  };
  const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const go = (k) => {
    if (k >= steps.length) return finish();
    i = Math.max(0, k);
    left = steps[i].seconds || 0;
    paused = false;
    draw();
  };
  const finish = () => {
    clearInterval(tick);
    const w = SP.stopWorkout();
    if (w) Diana.pop(`Bravo, séance terminée ! ${w.minutes} min enregistrées (~${w.kcal} kcal). Tu peux être fier·e de toi 🏆`, 'proud', 4200);
    else toast('Séance trop courte pour être enregistrée');
    body.close();
    if (w) setTimeout(() => askFeedback(w, () => render(view, ctx)), 350);
  };
  tick = setInterval(() => {
    const s = steps[i];
    if (paused || s.kind !== 'time' || !el.isConnected) return;
    left--;
    const big = $('#big', el);
    if (big) big.textContent = fmtClock(Math.max(0, left));
    if (left === 3) navigator.vibrate?.(60);
    if (left <= 0) { beep(); go(i + 1); }
  }, 1000);
  go(0);
}

// ---------- Agenda ----------
// Android : agenda du téléphone (dont Google Agenda) ; web : fichier .ics ou lien Google Agenda.
export async function connectCalendar() {
  try {
    if (!(await N.calendarAccess())) { toast('Accès à l’agenda refusé'); return false; }
    const cals = await N.calendarList();
    if (!cals.length) { toast('Aucun agenda modifiable trouvé'); return false; }
    const pick = cals.find((c) => c.google && c.primary) || cals.find((c) => c.google) || cals[0];
    store.update((s) => { s.settings.calendarId = pick.id; s.settings.calendarName = `${pick.name}${pick.account && pick.account !== pick.name ? ` (${pick.account})` : ''}`; });
    await refreshCalendar();
    toast(`Agenda connecté : ${pick.name}`);
    return true;
  } catch (e) { toast(e.message || 'Agenda indisponible'); return false; }
}

// Événements des 8 prochains jours, pour éviter les conflits.
export async function refreshCalendar() {
  if (!N.isNative || !store.get().settings.calendarId || !(await N.calendarHasAccess())) return;
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const evts = await N.calendarEvents(from.getTime(), from.getTime() + 8 * 86400e3).catch(() => []);
  store.update((s) => { s.calEvents = evts.filter((e) => !(e.title || '').match(/AppSant(é|e)|Diana Health/)); });
}

function sessionEvents(plan) {
  const st = store.get();
  const p = st.profile;
  const out = [];
  for (const d of plan) {
    if (!d.type || d.matches || (d.past && !d.today)) continue;
    const date = new Date(d.date + 'T12:00');
    const dayEvents = st.calEvents.filter((e) => new Date(e.start).toDateString() === date.toDateString());
    const slot = SC.suggestSlot({ date, duration: d.minutes + 10, intensity: d.intensity, wake: p.wakeTime, bed: p.bedTime, busy: SC.busyBlocks(date, p.work, dayEvents), pref: p.sportPref || 'auto', usualHour: SC.usualHour(st.workouts) });
    if (!slot) continue;
    const start = new Date(d.date + 'T00:00'); start.setMinutes(slot.start);
    if (start < new Date()) continue;
    const session = W.buildSession({ activity: d.type, minutes: d.minutes, intensity: d.intensity, level: level(st), equipment: equip(st), goal: p.goal, dayIndex: plan.indexOf(d), zones: SP.hrZones(p.birthYear), hidden: hiddenEx() });
    const end = new Date(start.getTime() + session.minutes * 60000);
    const details = session.blocks.map((b) => `${b.title} : ${b.items.map((i) => i.label).join(', ')}`).join('\n') + '\n\nOuvre Diana Health pour le mode guidé.';
    out.push({ title: `${SP.activity(d.type).label} (${session.minutes} min) · Diana Health`, start, end, details, day: d.day, why: slot.why });
  }
  return out;
}

async function planWeekInCalendar(plan) {
  const events = sessionEvents(plan);
  if (!events.length) { toast('Rien à planifier : semaine faite ou pas de créneau libre'); return; }
  const list = events.map((e) => `<div class="list-item" style="grid-template-columns:auto 1fr"><span class="badge neutral">${e.day.slice(0, 3)} ${SC.hm(e.start.getHours() * 60 + e.start.getMinutes())}</span><div><div class="small" style="font-weight:600">${esc(e.title.split(' · ')[0])}</div>${e.why.length ? `<div class="tiny muted">${esc(e.why.join(', '))}</div>` : ''}</div></div>`).join('');
  const st = store.get();
  const body = sheet(`
    <p class="small muted" style="margin-top:0">Créneaux choisis selon ${st.profile.work?.enabled ? 'tes horaires de travail, ' : ''}${st.calEvents.length ? 'ton agenda, ' : ''}ton heure de coucher et ton heure habituelle. Planifier quand faire son sport augmente nettement les chances de le faire.</p>
    ${list}
    ${N.isNative
      ? `<button class="btn block" id="cal-go" style="margin-top:12px">${icon('calendar', 18)} Ajouter à ${esc(st.settings.calendarName || 'mon agenda')}</button>`
      : `<button class="btn block" id="ics" style="margin-top:12px">${icon('download', 18)} Télécharger pour Google Agenda (.ics)</button>
         <button class="btn ghost block" id="gcal" style="margin-top:8px">${icon('calendar', 18)} Ajouter la prochaine séance à Google Agenda</button>
         <p class="tiny muted">Le fichier .ics s’importe dans Google Agenda (Paramètres → Importer) ou s’ouvre directement sur le téléphone.</p>`}
    ${srcLinks(['belanger2011'])}`, { title: 'Planifier la semaine' });
  $('#cal-go', body)?.addEventListener('click', async () => {
    if (!st.settings.calendarId && !(await connectCalendar())) return;
    const n = await N.calendarInsert(store.get().settings.calendarId, events.map((e) => ({ title: e.title, details: e.details, start: e.start.getTime(), end: e.end.getTime() }))).catch((err) => { toast(err.message); return 0; });
    if (n) { toast(`${n} séance(s) ajoutée(s) à ton agenda 📅`); body.close(); }
  });
  $('#ics', body)?.addEventListener('click', () => {
    const blob = new Blob([SC.toIcs(events)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'seances-appsante.ics';
    a.click();
    toast('Fichier prêt : ouvre-le pour l’ajouter à ton agenda');
  });
  $('#gcal', body)?.addEventListener('click', () => window.open(SC.googleCalendarUrl(events[0]), '_blank'));
}
