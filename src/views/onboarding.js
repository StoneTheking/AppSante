// Premier lancement : présentation et profil en 5 étapes.
import * as store from '../store.js';
import { icon, esc, toast, $, $$ } from '../ui.js';
import * as Diana from '../diana.js';
import { sportPrefsHtml, bindSportPrefs, applySportPref, sportTimeHtml } from './sport.js';
import { tastePanel } from './tastes.js';
import { DEFAULT_WORK } from '../schedule.js';

let step = 0;
const draft = {};
const work = (p) => ({ ...DEFAULT_WORK, ...(p.work || {}) });

// dir : 'l' (page suivante), 'r' (page précédente) ou rien (pas d'animation).
export function render(root, done, dir) {
  document.body.classList.add('onb-mode');
  const p = { ...store.get().profile, ...draft };
  const steps = [
    () => `<div class="logo diana-logo">${Diana.face('cheer', 76)}</div>
      <h1>Ton coach santé,<br>fondé sur la science.</h1>
      <p class="lead">Diana Health croise ton sommeil, ton humeur, tes écrans, ton activité et ce que tu manges pour te dire quoi faire, et quand.</p>
      ${[['camera', 'var(--c-food)', 'Photo ou code-barres', 'Calories, Nutri-Score et additifs en un geste'],
        ['calendar', 'var(--primary)', 'Ta journée et Coach Diana', 'Repas, séance, coucher et encouragements'],
        ['trend', 'var(--c-sleep)', 'Tes tendances', 'Ce qui joue sur ton sommeil et ton humeur'],
        ['cart', 'var(--c-move)', 'Menus & courses', 'Ta semaine planifiée, ta liste prête']]
        .map(([ic, c, t, s]) => `<div class="feature"><span class="icon-badge" style="background:color-mix(in srgb,${c} 15%,transparent);color:${c}">${icon(ic)}</span><div><b>${t}</b><div class="small muted">${s}</div></div></div>`).join('')}`,
    () => `<h1>Parle-moi de toi</h1><p class="lead">Pour calculer tes besoins (équation de Mifflin-St Jeor).</p>
      <label class="lbl">Prénom</label><input data-d="name" value="${esc(p.name)}" placeholder="Ton prénom">
      <label class="lbl">Sexe</label><div class="seg">${[['h', 'Homme'], ['f', 'Femme']].map(([v, l]) => `<button data-pick="sex" data-v="${v}" class="${p.sex === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="grid3">
        <div><label class="lbl">Naissance</label><input data-d="birthYear" type="number" inputmode="numeric" placeholder="1990" value="${esc(p.birthYear ?? '')}"></div>
        <div><label class="lbl">Taille cm</label><input data-d="height" type="number" inputmode="decimal" placeholder="175" value="${esc(p.height ?? '')}"></div>
        <div><label class="lbl">Poids kg</label><input data-d="weight" type="number" inputmode="decimal" placeholder="70" value="${esc(p.weight ?? '')}"></div>
      </div>
      <label class="lbl">Tour de taille (cm, facultatif)</label><input data-d="waist" type="number" inputmode="decimal" placeholder="85" value="${esc(p.waist ?? '')}">`,
    () => `<h1>Ton objectif</h1><p class="lead">On adapte calories, protéines et activité.</p>
      <div class="choice">${[['perdre', 'flame', 'Perdre du poids', '≈ −0,5 kg/semaine, en préservant le muscle'], ['maintenir', 'heart', 'Rester en forme', 'Équilibre, énergie, sommeil'], ['prendre', 'dumbbell', 'Prendre du muscle', 'Surplus léger, 1,6 g/kg de protéines']]
        .map(([v, ic, t, s]) => `<button data-pick="goal" data-v="${v}" class="${p.goal === v ? 'on' : ''}"><span class="icon-badge" style="background:var(--primary-soft);color:var(--primary)">${icon(ic)}</span><span><b>${t}</b><br><span class="small muted" style="font-weight:500">${s}</span></span></button>`).join('')}</div>
      <label class="lbl">Activité habituelle</label><select data-d="activityLevel">${Object.entries({ sedentaire: 'Sédentaire (bureau, peu de marche)', leger: 'Légèrement actif', modere: 'Modérément actif (3-5 séances/sem)', actif: 'Actif (sport quotidien)', tres_actif: 'Très actif' }).map(([v, l]) => `<option value="${v}" ${p.activityLevel === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label class="lbl">Régime</label><select data-d="diet">${Object.entries({ omnivore: 'Omnivore', pescetarien: 'Pescétarien', vegetarien: 'Végétarien', vegan: 'Végan' }).map(([v, l]) => `<option value="${v}" ${p.diet === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`,
    () => `<h1>Ton rythme</h1><p class="lead">Ton plan du jour et tes rappels s’organisent autour de ces horaires.</p>
      <div class="grid2"><div><label class="lbl">Réveil</label><input data-d="wakeTime" type="time" value="${esc(p.wakeTime)}"></div><div><label class="lbl">Coucher visé</label><input data-d="bedTime" type="time" value="${esc(p.bedTime)}"></div></div>
      <label class="lbl">Travail ou études</label>
      <div class="seg"><button data-work-on="0" class="${work(p).enabled ? '' : 'on'}">Pas d’horaires fixes</button><button data-work-on="1" class="${work(p).enabled ? 'on' : ''}">J’ai des horaires</button></div>
      <div id="work-f" style="${work(p).enabled ? '' : 'display:none'}">
        <div class="chips" style="margin-top:10px">${[[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']].map(([d, l]) => `<button class="chip ${work(p).days.includes(d) ? 'on' : ''}" data-wday="${d}" style="min-width:38px;justify-content:center">${l}</button>`).join('')}</div>
        <div class="grid3"><div><label class="lbl">Début</label><input type="time" data-w="start" value="${esc(work(p).start)}"></div><div><label class="lbl">Fin</label><input type="time" data-w="end" value="${esc(work(p).end)}"></div>
          <div><label class="lbl">Trajet</label><select data-w="commute">${[0, 15, 30, 45, 60, 90].map((m) => `<option value="${m}" ${Number(work(p).commute) === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></div></div>
      </div>
      <div class="note" style="margin-top:18px">${icon('shield', 18)}<span>Tes données restent sur ton téléphone. Rien n’est envoyé sauf aux fonctions IA que tu utilises.</span></div>`,
    () => `<h1>Ton sport</h1><p class="lead">Pour te proposer des séances à ta mesure.</p>
      <label class="lbl">Ton niveau</label>
      <div class="choice">${[['debutant', 'Débutant', 'Peu ou pas de sport ces derniers mois'], ['intermediaire', 'Intermédiaire', '1 à 3 séances par semaine'], ['avance', 'Avancé', 'Entraînement régulier depuis plus d’un an']].map(([v, t, d]) => `<button data-pick="fitnessLevel" data-v="${v}" class="${(p.fitnessLevel || 'debutant') === v ? 'on' : ''}" style="padding:10px 14px"><span><b>${t}</b><br><span class="small muted" style="font-weight:500">${d}</span></span></button>`).join('')}</div>
      ${sportTimeHtml(p, 'data-pick')}
      <label class="lbl">Matériel</label>
      <div class="seg">${[['aucun', 'Aucun'], ['halteres', 'Haltères'], ['salle', 'Salle']].map(([v, l]) => `<button data-pick="equipment" data-v="${v}" class="${(p.equipment || 'aucun') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="lbl">Les sports que tu aimes… ou jamais</label>
      <p class="tiny muted" style="margin:-4px 0 6px">« J’aime » : proposé en priorité · « Jamais » : jamais proposé.</p>
      ${sportPrefsHtml(p.favSports, p.excludedSports)}`,
    () => `<h1>Tes goûts</h1><p class="lead">Pour des menus et des idées de repas qui te plaisent vraiment. Tu pourras les changer dans Profil.</p>
      <div id="tastes"></div>`,
  ];
  root.innerHTML = `<div class="onb ${dir === 'l' ? 'slide-l' : dir === 'r' ? 'slide-r' : dir === 'in' ? 'view-enter' : ''}">
    <div class="dots">${steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="grow">${steps[step]()}</div>
    <div class="row" style="margin-top:20px;flex-wrap:nowrap">
      ${step > 0 ? `<button class="btn ghost" id="back">${icon('left', 18)}</button>` : `<button class="btn ghost" id="demo">Voir une démo</button>`}
      <button class="btn" id="next" style="flex:1">${step === steps.length - 1 ? 'C’est parti' : 'Continuer'} ${icon('arrow', 18)}</button>
    </div></div>`;
  window.scrollTo(0, 0);

  const save = () => $$('[data-d]', root).forEach((el) => { draft[el.dataset.d] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value; });
  $$('[data-d]', root).forEach((el) => el.addEventListener('change', save));
  // choix simples : on met à jour le bouton sans redessiner la page (pas d'animation qui rejoue)
  $$('[data-pick]', root).forEach((b) => (b.onclick = () => {
    draft[b.dataset.pick] = b.dataset.pick === 'sportMinutes' ? Number(b.dataset.v) : b.dataset.v;
    $$(`[data-pick="${b.dataset.pick}"]`, root).forEach((x) => x.classList.toggle('on', x === b));
  }));
  const setWork = (f) => { draft.work = work({ ...store.get().profile, ...draft }); f(draft.work); };
  $$('[data-work-on]', root).forEach((b) => (b.onclick = () => {
    setWork((w) => { w.enabled = b.dataset.workOn === '1'; });
    $$('[data-work-on]', root).forEach((x) => x.classList.toggle('on', x === b));
    $('#work-f', root).style.display = draft.work.enabled ? '' : 'none';
  }));
  $$('[data-wday]', root).forEach((b) => (b.onclick = () => {
    const d = Number(b.dataset.wday);
    setWork((w) => { w.days = w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d]; });
    b.classList.toggle('on', draft.work.days.includes(d));
  }));
  $$('[data-w]', root).forEach((el) => (el.onchange = () => setWork((w) => { w[el.dataset.w] = el.dataset.w === 'commute' ? Number(el.value) : el.value; })));
  bindSportPrefs(root, (id, v) => Object.assign(draft, applySportPref({ ...store.get().profile, ...draft }, id, v)));
  const tp = $('#tastes', root);
  if (tp) tastePanel(tp, { tabs: ['aliments', 'allergies', 'cuisines'] });

  const next = () => {
    save();
    if (step === 1 && (!draft.height || !draft.weight || !draft.birthYear)) return toast('Renseigne ta naissance, ta taille et ton poids');
    if (step < steps.length - 1) { step++; render(root, done, 'l'); return; }
    store.update((s) => {
      Object.assign(s.profile, draft);
      if (draft.weight) s.weights.push({ date: store.today(), kg: draft.weight });
    });
    finish(done);
  };
  const back = () => { if (step > 0) { save(); step--; render(root, done, 'r'); } };
  $('#back', root)?.addEventListener('click', back);
  $('#demo', root)?.addEventListener('click', () => { loadDemo(); finish(done); });
  $('#next', root).onclick = next;

  // glisser à gauche / à droite pour changer de page
  const onb = $('.onb', root);
  let x0 = null, y0 = 0;
  onb.addEventListener('touchstart', (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  onb.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || e.target.closest('input, select, textarea')) return;
    // une rangée qui défile horizontalement (onglets, aliments) garde son geste
    for (let n = e.target; n && n !== onb; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return;
    if (dx < 0) next(); else back();
  }, { passive: true });
}

function finish(done) {
  store.update((s) => { s.onboarded = true; });
  done();
}

// Génère 14 jours réalistes pour découvrir l'application.
export function loadDemo() {
  store.update((s) => {
    s.profile = { ...s.profile, name: s.profile.name || 'Alex', birthYear: s.profile.birthYear || 1992, height: s.profile.height || 178, weight: s.profile.weight || 82, waist: s.profile.waist || 92 };
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    for (const k of store.lastDays(14)) {
      s.days[k] = { bed: `${String(rnd(23, 24) % 24).padStart(2, '0')}:${String(rnd(0, 5) * 10).padStart(2, '0')}`, wake: `0${rnd(6, 7)}:${String(rnd(0, 5) * 10).padStart(2, '0')}`, sleepQuality: rnd(2, 4), mood: rnd(2, 4), energy: rnd(2, 4), stress: rnd(2, 4), steps: rnd(3500, 9500), modMin: rnd(0, 30), vigMin: rnd(0, 15), strengthMin: Math.random() < 0.2 ? 40 : 0, screenMin: rnd(150, 330), socialMin: rnd(30, 110), unlocks: rnd(50, 110), phoneInBed: Math.random() < 0.6, alcohol: Math.random() < 0.3 ? rnd(1, 2) : 0, restingHR: rnd(62, 72), waterMl: rnd(4, 8) * 250 };
      if (!s.meals.some((m) => m.date === k)) {
        const meals = [
          ['08:00', 'Tartines beurre-confiture, café', { kcal: 420, protein: 9, carbs: 62, sugar: 22, fat: 14, satFat: 8, fiber: 3, sodium: 450, fruitVeg: 0 }, 3],
          ['12:45', 'Sandwich jambon-fromage, chips, soda', { kcal: 980, protein: 32, carbs: 120, sugar: 40, fat: 40, satFat: 15, fiber: 5, sodium: 2100, fruitVeg: 20 }, 4],
          ['20:30', 'Pâtes bolognaise, salade', { kcal: 850, protein: 35, carbs: 100, sugar: 10, fat: 30, satFat: 11, fiber: 8, sodium: 900, fruitVeg: 150 }, 3],
        ];
        for (const [time, title, nutrients, nova] of meals) s.meals.push({ id: crypto.randomUUID(), date: k, time, title, nutrients, nova, quality: nova === 4 ? 30 : 55, verdict: nova === 4 ? 'a_limiter' : 'moyen' });
      }
    }
    // transit : selles plus molles après les journées « sandwich + soda »
    s.stools = store.lastDays(14).map((k, i) => ({ id: crypto.randomUUID(), at: new Date(`${k}T07:${String(10 + i).padStart(2, '0')}`).toISOString(), bristol: i % 3 === 0 ? 6 : 4, pain: i % 3 === 0 ? 2 : 0, bloating: i % 3 === 0 ? 2 : 0, urgency: false, blood: false }));
    s.meals.forEach((m, i) => { if (!m.rating && i % 4 === 0) m.rating = m.verdict === 'a_limiter' ? 4 : 3; });
    s.onboarded = true;
  });
}
