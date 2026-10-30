// Profil : corps, objectifs, rappels, connexions, IA, données.
import * as store from '../store.js';
import * as S from '../science.js';
import * as AI from '../ai.js';
import * as R from '../reminders.js';
import * as N from '../native.js';
import { refreshReminders, refreshEnv, taste } from '../context.js';
import * as E from '../env.js';
import * as F from '../family.js';
import { applyTheme } from '../theme.js';
import { openTastePicker, tasteSummary } from './tastes.js';
import { connectCalendar, openMySports } from './sport.js';
import { icon, esc, toast, sheet, srcLinks, $, $$ } from '../ui.js';
import { loadDemo } from './onboarding.js';
import { sourcesCard, bindSources } from './health.js';

const APK_URL = 'https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk';

let cur = null;
// Ouvre directement une rubrique (ex. depuis Santé → Données du téléphone).
export function openSection(id) { cur = id; }
let last = null;
window.addEventListener('popstate', () => {
  if (!cur) return;
  cur = null;
  if (last?.view.querySelector('.pf-root')) { render(last.view, last.ctx); window.scrollTo(0, 0); }
});

export function render(view, ctx) {
  last = { view, ctx };
  const st = store.get();
  const p = st.profile;
  const rs = st.settings.reminders;
  const sel = (id, opts) => `<select data-p="${id}">${Object.entries(opts).map(([v, l]) => `<option value="${v}" ${String(p[id]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (id, type = 'text', extra = '') => `<input data-p="${id}" type="${type}" value="${esc(p[id] ?? '')}" ${extra}>`;
  const sw = (attr, on) => `<span class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><span></span></span>`;

  // Réglages rangés comme ceux d'un téléphone : un menu à gauche (ou en liste sur petit écran), une page par rubrique.
  const SECS = [
    { id: 'body', icon: 'user', label: 'Mon corps', sub: 'Âge, taille, poids', html: `<div class="card">
      <label class="lbl">Prénom</label>${inp('name')}
      <div class="grid2">
        <div><label class="lbl">Sexe</label>${sel('sex', { h: 'Homme', f: 'Femme' })}</div>
        <div><label class="lbl">Année de naissance</label>${inp('birthYear', 'number', 'inputmode="numeric"')}</div>
        <div><label class="lbl">Taille (cm)</label>${inp('height', 'number', 'inputmode="decimal"')}</div>
        <div><label class="lbl">Poids (kg)</label>${inp('weight', 'number', 'inputmode="decimal" step="0.1"')}</div>
        <div><label class="lbl">Tour de taille (cm)</label>${inp('waist', 'number', 'inputmode="decimal"')}</div>
        <div><label class="lbl">Fumeur</label>${sel('smoker', { false: 'Non', true: 'Oui' })}</div>
      </div>
      <label class="lbl">Pathologies, traitements (facultatif)</label>${inp('conditions')}
    </div>` },
    { id: 'goals', icon: 'target', label: 'Objectifs & sport', sub: 'Objectif, régime, sports, horaires', html: `<div class="card">
      <label class="lbl">Objectif</label>${sel('goal', { perdre: 'Perdre du poids', maintenir: 'Rester en forme', prendre: 'Prendre du muscle' })}
      <label class="lbl">Niveau d'activité habituel</label>${sel('activityLevel', { sedentaire: 'Sédentaire', leger: 'Légèrement actif', modere: 'Modérément actif (3-5 séances/sem)', actif: 'Actif (sport quotidien)', tres_actif: 'Très actif' })}
      <label class="lbl">Régime</label>${sel('diet', { omnivore: 'Omnivore', pescetarien: 'Pescétarien', vegetarien: 'Végétarien', vegan: 'Végan' })}
      <button class="btn ghost block" id="my-sports" style="margin-top:12px">${icon('dumbbell', 18)} Mes sports, temps et matériel</button>
      <div class="grid2">
        <div><label class="lbl">Réveil</label>${inp('wakeTime', 'time')}</div>
        <div><label class="lbl">Coucher visé</label>${inp('bedTime', 'time')}</div>
      </div>
    </div>` },
    { id: 'tastes', icon: 'chef', label: 'Goûts & allergies', sub: 'Ce que tu aimes ou évites', html: `<div class="card">
      ${tasteSummary(p)}
      <button class="btn soft block" id="tastes" style="margin-top:10px">${icon('chef', 18)} Choisir mes goûts</button>
      ${srcLinks(['dansinger2005'])}
    </div>` },
    { id: 'family', icon: 'users', label: 'Foyer', sub: 'Repas en famille', html: `<div class="card">
      ${st.household.map((m) => `<div class="member"><span class="avatar">${esc((m.name || '?')[0].toUpperCase())}</span><div><b>${esc(m.name || 'Membre')}</b><div class="tiny muted">${m.age} ans · ~${F.memberKcal(m)} kcal/j${m.allergies ? ` · allergies : ${esc(m.allergies)}` : ''}${m.diet && m.diet !== 'omnivore' ? ` · ${esc(m.diet)}` : ''}</div></div><button class="icon-btn" data-member-del="${m.id}" aria-label="Retirer">${icon('trash', 14)}</button></div>`).join('')}
      <button class="btn soft block" id="add-member" style="margin-top:10px">${icon('users', 18)} Ajouter un membre</button>
      ${srcLinks(['hammons2011', 'efsa2013energy'])}
    </div>` },
    { id: 'work', icon: 'work', label: 'Travail & agenda', sub: 'Horaires, moment du sport', html: `<div class="card" id="work">
      <label class="between" style="flex-wrap:nowrap"><b class="small">J’ai des horaires de travail</b>${sw('id="work-on"', (p.work || {}).enabled)}</label>
      <div style="${(p.work || {}).enabled ? '' : 'opacity:.45;pointer-events:none'}">
        <div class="chips" style="margin-top:10px">${[[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']].map(([d, l]) => `<button class="chip ${(p.work?.days || []).includes(d) ? 'on' : ''}" data-wday="${d}" style="min-width:40px;justify-content:center">${l}</button>`).join('')}</div>
        <div class="grid3">
          <div><label class="lbl">Début</label><input type="time" data-work="start" value="${esc(p.work?.start || '09:00')}"></div>
          <div><label class="lbl">Fin</label><input type="time" data-work="end" value="${esc(p.work?.end || '17:30')}"></div>
          <div><label class="lbl">Trajet</label><select data-work="commute">${[0, 15, 30, 45, 60, 90].map((m) => `<option value="${m}" ${Number(p.work?.commute ?? 30) === m ? 'selected' : ''}>${m} min</option>`).join('')}</select></div>
        </div>
      </div>
      <label class="lbl">Moment préféré pour le sport</label>
      <div class="seg">${[['auto', 'Auto'], ['matin', 'Matin'], ['midi', 'Midi'], ['soir', 'Soir']].map(([v, l]) => `<button data-spref="${v}" class="${(p.sportPref || 'auto') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${N.isNative ? `<button class="btn ghost block" id="cal-connect" style="margin-top:10px">${icon('calendar', 18)} ${st.settings.calendarId ? 'Agenda connecté ✓' : 'Connecter mon agenda (Google Agenda)'}</button>` : '<p class="tiny muted" style="margin:10px 0 0">Les séances s’ajoutent à Google Agenda depuis l’onglet Sport.</p>'}
      ${srcLinks(['belanger2011'])}
    </div>` },
    { id: 'place', icon: 'pin', label: 'Lieu de vie', sub: 'Air, météo, soleil', html: `<div class="card" id="loc">
      ${st.location ? `<div class="between"><b>${icon('pin', 16)} ${esc(st.location.name)}</b><button class="btn sm ghost" id="loc-clear">Changer</button></div>` : `
      <div class="row" style="flex-wrap:nowrap"><input id="city" placeholder="Ta ville…"><button class="btn" id="city-go">${icon('arrow', 18)}</button></div>
      <button class="btn ghost block" id="geo" style="margin-top:8px">${icon('pin', 18)} Utiliser ma position</button>
      <div id="city-res"></div>`}
      ${srcLinks(['who2021air', 'andersen2015'])}
    </div>` },
    { id: 'phone', icon: 'phone', label: 'Données du téléphone', sub: 'Pas, sommeil, temps d’écran', html: `${sourcesCard(st)}` },
    { id: 'reminders', icon: 'bell', label: 'Rappels', sub: 'Notifications', html: `<div class="card">
      <label class="between" style="flex-wrap:nowrap"><span><b>Activer les rappels</b><div class="tiny muted">${N.isNative ? 'Notifications programmées, même application fermée.' : 'Dans le navigateur, les rappels ne s’affichent que si l’application est ouverte récemment. Pour des rappels fiables, installe l’application Android.'}</div></span>${sw('id="rem-on"', rs.enabled)}</label>
      <div id="rem-kinds" style="${rs.enabled ? '' : 'opacity:.45;pointer-events:none'}">
        ${Object.entries(R.KINDS).map(([k, v]) => `<label class="between" style="padding:10px 0;border-top:1px solid var(--line);flex-wrap:nowrap"><span class="small" style="padding-right:12px"><b style="font-weight:600">${v.label}</b><span class="tiny muted" style="display:block;margin-top:2px;line-height:1.4">${v.desc}</span></span>${sw(`data-kind="${k}"`, rs.kinds[k])}</label>`).join('')}
      </div>
    </div>` },
    { id: 'look', icon: 'palette', label: 'Apparence', sub: 'Thème, widgets', html: `<div class="card">
      <div class="seg">${[['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Système']].map(([v, l]) => `<button data-theme-pick="${v}" class="${st.settings.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${N.isNative ? `<button class="btn ghost block" id="pin-widget" style="margin-top:10px">${icon('moon', 18)} Ajouter le widget « Je vais dormir »</button><button class="btn ghost block" id="pin-photo" style="margin-top:8px">${icon('camera', 18)} Ajouter le widget « Photo ou code-barres »</button><button class="btn ghost block" id="pin-quests" style="margin-top:8px">${icon('target', 18)} Ajouter le widget « Quêtes du jour »</button>` : '<p class="tiny muted" style="margin:10px 0 0">Raccourci : appui long sur l’icône Diana Health → « Je vais dormir ».</p>'}
    </div>` },
    { id: 'ai', icon: 'sparkles', label: 'Intelligence artificielle', sub: 'Clé, modèle, vitesse', html: `<div class="card">
      <p class="small" style="margin-top:0">Pour l’analyse photo, les recettes et le coach. Sans clé, l’appli marche quand même (menus, scanner, recherche de produits, plan, sport).</p>
      <div class="ai-opt"><b>${icon('sparkles', 16)} Gratuit : Google Gemini</b>
        <ol class="small" style="padding-left:18px;margin:6px 0;line-height:1.6"><li>Ouvre <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> avec ton compte Google</li><li>Touche <b>Create API key</b> (aucune carte bancaire)</li><li>Copie la clé (elle commence par <b>AIza</b>) et colle-la ci-dessous</li></ol>
        <p class="tiny muted" style="margin:0">Quota gratuit largement suffisant pour un usage perso. En gratuit, Google peut utiliser les échanges pour améliorer ses modèles.</p></div>
      <div class="ai-opt"><b>${icon('key', 16)} Payant à l’usage : Claude</b>
        <p class="tiny muted" style="margin:4px 0 0">Clé sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (commence par sk-ant-), environ 1 centime par photo. L’abonnement Claude Pro ne donne pas accès à l’API et ne peut pas être branché à une appli.</p></div>
      <label class="lbl">Clé API</label><input id="key" type="password" autocomplete="off" placeholder="AIza… (Gemini) ou sk-ant-… (Claude)" value="${esc(st.settings.apiKey)}">
      <p class="tiny" id="key-kind" style="margin:6px 0 0;color:var(--good)">${AI.provider(st.settings.apiKey) === 'gemini' ? '✓ Clé Google Gemini (gratuite)' : AI.provider(st.settings.apiKey) === 'claude' ? '✓ Clé Claude' : ''}</p>
      <label class="between" style="flex-wrap:nowrap;margin-top:14px"><span><b class="small">Recherche scientifique en ligne</b><div class="tiny muted">Le coach peut consulter PubMed, Cochrane, OMS, ANSES, Lancet, BMJ…</div></span><span class="switch"><input type="checkbox" id="web" ${st.settings.webSearch ? 'checked' : ''}><span></span></span></label>
      <label class="lbl">Vitesse des réponses</label>
      <div class="seg">${AI.SPEEDS.map(([v, l]) => `<button data-speed="${v}" class="${(st.settings.aiSpeed || 'rapide') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:6px 0 0">${{ rapide: 'Modèle léger pour le coach et les recettes (réponse en quelques secondes), modèle plus fin pour les photos et les menus. Les questions simples (sport du jour, repas, sommeil, priorités) sont répondues instantanément sur le téléphone.', equilibre: 'Un modèle intermédiaire partout : un peu plus lent, un peu plus nuancé.', precis: 'Le modèle le plus puissant partout : le plus précis, mais nettement plus lent (jusqu’à 20–30 s).' }[st.settings.aiSpeed || 'rapide']}</p>
      <div ${AI.provider(st.settings.apiKey) === 'gemini' || (st.settings.aiSpeed || 'rapide') !== 'precis' ? 'hidden' : ''}><label class="lbl">Modèle Claude</label><select id="model">${AI.MODELS.map((m) => `<option value="${m.id}" ${st.settings.model === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
    </div>` },
    { id: 'data', icon: 'download', label: 'Mes données', sub: 'Exporter, restaurer, effacer', html: `<div class="card">
      <div class="grid2"><button class="btn ghost" id="exp">${icon('download', 18)} Exporter</button><button class="btn ghost" id="imp">${icon('upload', 18)} Restaurer</button></div>
      <div class="grid2" style="margin-top:10px"><button class="btn ghost" id="demo">${icon('sparkles', 18)} Démo</button><button class="btn danger" id="reset">${icon('trash', 18)} Tout effacer</button></div>
      <input id="imp-file" type="file" accept=".json,application/json" hidden>
    </div>` },
    { id: 'app', icon: 'info', label: 'Application', sub: 'Version, sources, confidentialité', html: `${N.isNative ? `<div class="card" id="update-card"><div class="between"><div><b>${icon('download', 16)} Application</b><div class="tiny muted" id="ver">Version…</div></div><button class="btn sm soft" id="check-up">Vérifier les mises à jour</button></div></div>` : ''}
    ${!N.isNative ? `<div class="card" style="background:var(--hero);color:#fff;border:0">
      <div class="row" style="flex-wrap:nowrap;gap:14px"><span class="icon-badge" style="background:rgba(255,255,255,.18)">${icon('phone')}</span>
      <div><b>Application Android</b><div class="small" style="opacity:.85">Synchronisation automatique du temps d’écran, des pas, du sommeil et du cœur + rappels fiables.</div></div></div>
      <a class="btn block" href="${APK_URL}" style="margin-top:12px;background:#fff;color:#0f766e;text-decoration:none">${icon('download', 18)} Télécharger l’APK</a>
      <p class="tiny" style="opacity:.8;margin:8px 0 0">Ouvre le fichier téléchargé et autorise l’installation depuis Chrome. Tes données restent sur le téléphone : exporte-les ci-dessous puis restaure-les dans l’application.</p>
    </div>` : ''}

    <div class="card">
      <details><summary>${icon('book', 18)} Base scientifique (${Object.keys(S.SOURCES).length} références) ${icon('right', 16)}</summary>
        <ul class="small" style="padding-left:18px">${Object.values(S.SOURCES).map((s) => `<li style="margin:6px 0"><a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join('')}</ul>
      </details>
    </div>
    <p class="tiny muted" style="text-align:center">Diana Health n’est pas un dispositif médical et ne remplace pas l’avis d’un professionnel de santé.<br><a href="privacy.html" target="_blank">Confidentialité</a></p>` },
  ];
  const wide = window.matchMedia('(min-width: 760px)').matches;
  const curId = cur || (wide ? 'body' : null);
  const menu = `<nav class="pf-menu" aria-label="Rubriques du profil">
      <div class="pf-me"><span class="avatar" style="width:46px;height:46px;font-size:1.2rem">${p.name ? esc(p.name[0].toUpperCase()) : icon('user', 22)}</span><div><b>${esc(p.name || 'Mon profil')}</b><div class="tiny muted">${[p.birthYear && `${S.age(p.birthYear)} ans`, p.weight && `${p.weight} kg`, { perdre: 'perdre du poids', maintenir: 'rester en forme', prendre: 'prendre du muscle' }[p.goal]].filter(Boolean).join(' · ')}</div></div></div>
      ${SECS.map((x) => `<button class="pf-item ${x.id === curId ? 'on' : ''}" data-sec="${x.id}"><span class="pf-ic">${icon(x.icon, 18)}</span><span class="pf-txt"><b>${x.label}</b><span>${x.sub}</span></span>${icon('right', 16)}</button>`).join('')}
    </nav>`;
  view.innerHTML = `<div class="pf-root ${curId ? 'has-sec' : ''}">
    ${menu}
    <div class="pf-pages">${SECS.map((x) => `<section class="pf-page" data-page="${x.id}" ${x.id === curId ? '' : 'hidden'}>
      <button class="pf-back" data-back>${icon('left', 18)} Profil</button>
      <h2 class="pf-title">${icon(x.icon, 20)} ${x.label}</h2>
      ${x.html}
    </section>`).join('')}</div>
  </div>`;
  const open = (id) => {
    const had = !!cur;
    cur = id;
    // le bouton « retour » du téléphone ramène au menu
    if (id && !had && !wide) history.pushState({ pf: id }, '', '#profile');
    render(view, ctx);
    window.scrollTo(0, 0);
  };
  $$('[data-sec]', view).forEach((b) => (b.onclick = () => open(b.dataset.sec)));
  $$('[data-back]', view).forEach((b) => (b.onclick = () => (history.state?.pf ? history.back() : open(null))));
  bindSources(view, () => render(view, ctx));
  if (N.isNative) {
    N.appVersion().then((v) => { const el = $('#ver', view); if (el) el.textContent = `Version ${v}`; });
    $('#check-up', view).onclick = async () => {
      try {
        const u = await N.checkUpdate();
        store.update((s) => { s.update = { ...u, checked: Date.now() }; });
        if (u.available) { toast(`Version ${u.latest} disponible : téléchargement…`); location.href = N.APK_URL; }
        else toast(`Tu as la dernière version (${u.current})`);
      } catch (e) { toast(e.message); }
    };
  }
  $$('[data-p]', view).forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.p;
    let v = el.value;
    if (el.type === 'number') v = v === '' ? null : Number(v);
    if (k === 'smoker') v = v === 'true';
    store.update((s) => {
      s.profile[k] = v;
      if (k === 'weight' && v) { s.weights = s.weights.filter((w) => w.date !== store.today()); s.weights.push({ date: store.today(), kg: v }); }
    });
    if (['wakeTime', 'bedTime'].includes(k)) refreshReminders();
    toast('Profil mis à jour', 1000);
  }));
  $('#rem-on', view).onchange = async (e) => {
    if (e.target.checked && !(await R.requestPermission())) { e.target.checked = false; toast('Notifications refusées dans les réglages du téléphone'); return; }
    store.update((s) => { s.settings.reminders.enabled = e.target.checked; });
    const n = await refreshReminders();
    toast(e.target.checked ? `${n} rappel(s) programmé(s)` : 'Rappels désactivés');
    render(view, ctx);
  };
  $$('[data-kind]', view).forEach((c) => (c.onchange = async () => {
    store.update((s) => { s.settings.reminders.kinds[c.dataset.kind] = c.checked; });
    await refreshReminders();
  }));
  $('#work-on', view).onchange = (e) => { store.update((s) => { s.profile.work = { ...(s.profile.work || {}), enabled: e.target.checked }; }); render(view, ctx); };
  $$('[data-wday]', view).forEach((b) => (b.onclick = () => {
    store.update((s) => { const d = new Set(s.profile.work.days); const n = Number(b.dataset.wday); d.has(n) ? d.delete(n) : d.add(n); s.profile.work.days = [...d]; });
    b.classList.toggle('on');
  }));
  $$('[data-work]', view).forEach((el) => (el.onchange = () => { store.update((s) => { s.profile.work[el.dataset.work] = el.dataset.work === 'commute' ? Number(el.value) : el.value; }); toast('Horaires enregistrés', 1000); }));
  $$('[data-spref]', view).forEach((b) => (b.onclick = () => { store.update((s) => { s.profile.sportPref = b.dataset.spref; }); render(view, ctx); }));
  $('#my-sports', view)?.addEventListener('click', () => openMySports(() => render(view, ctx)));
  $('#cal-connect', view)?.addEventListener('click', async () => { if (await connectCalendar()) render(view, ctx); });
  $('#tastes', view).onclick = () => openTastePicker(() => render(view, ctx));
  $$('[data-member-del]', view).forEach((b) => (b.onclick = () => { store.update((s) => (s.household = s.household.filter((m) => m.id !== b.dataset.memberDel))); render(view, ctx); }));
  $('#add-member', view).onclick = () => openMember(() => render(view, ctx));
  $$('[data-theme-pick]', view).forEach((b) => (b.onclick = () => { store.update((s) => (s.settings.theme = b.dataset.themePick)); applyTheme(); render(view, ctx); }));
  $('#pin-photo', view)?.addEventListener('click', async () => { const r = await N.pinPhotoWidget(); toast(r ? 'Confirme l’ajout du widget' : 'Appui long sur l’écran d’accueil → Widgets → Diana Health'); });
  $('#pin-quests', view)?.addEventListener('click', async () => { ctx.syncQuests?.(true); const r = await N.pinQuestsWidget(); toast(r ? 'Confirme l’ajout du widget' : 'Appui long sur l’écran d’accueil → Widgets → Diana Health'); });
  $('#pin-widget', view)?.addEventListener('click', async () => { const r = await N.pinSleepWidget(); toast(r ? 'Confirme l’ajout du widget' : 'Appui long sur l’écran d’accueil → Widgets → Diana Health'); });
  const setLoc = async (loc) => {
    store.update((s) => { s.location = loc; s.env = null; });
    toast('Lieu enregistré');
    await refreshEnv(true);
    render(view, ctx);
  };
  $('#loc-clear', view)?.addEventListener('click', () => { store.update((s) => { s.location = null; s.env = null; }); render(view, ctx); });
  $('#geo', view)?.addEventListener('click', async () => { try { setLoc(await E.currentPosition()); } catch (e) { toast(e.message); } });
  $('#city-go', view)?.addEventListener('click', async () => {
    const res = $('#city-res', view);
    try {
      const list = await E.searchPlace($('#city', view).value);
      res.innerHTML = list.map((l, i) => `<button class="suggest" style="width:100%;border:0;text-align:left" data-place="${i}"><span>${esc(l.name)}</span>${icon('right', 16)}</button>`).join('') || '<p class="small muted">Aucun lieu trouvé.</p>';
      $$('[data-place]', res).forEach((b) => (b.onclick = () => setLoc(list[Number(b.dataset.place)])));
    } catch (e) { res.innerHTML = `<p class="small muted">${esc(e.message)}</p>`; }
  });
  $('#key', view).onchange = (e) => {
    const k = e.target.value.trim();
    store.update((s) => (s.settings.apiKey = k));
    toast(!k ? 'Clé retirée' : AI.provider(k) === 'gemini' ? 'Clé Gemini enregistrée ✅' : k.startsWith('sk-ant-') ? 'Clé Claude enregistrée ✅' : 'Clé enregistrée (format inattendu : vérifie-la)');
    render(view, ctx);
  };
  $('#web', view).onchange = (e) => store.update((s) => (s.settings.webSearch = e.target.checked));
  $$('[data-speed]', view).forEach((b) => (b.onclick = () => { store.update((s) => (s.settings.aiSpeed = b.dataset.speed)); render(view, ctx); }));
  $('#model', view).onchange = (e) => store.update((s) => (s.settings.model = e.target.value));
  $('#exp', view).onclick = async () => {
    const json = store.exportJSON();
    const file = new File([json], `appsante-${store.today()}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: 'Sauvegarde Diana Health' }).catch(() => {});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
  };
  $('#imp', view).onclick = () => $('#imp-file', view).click();
  $('#imp-file', view).onchange = async (e) => {
    try { store.importJSON(await e.target.files[0].text()); toast('Données restaurées'); ctx.render(); } catch { toast('Fichier invalide'); }
  };
  $('#demo', view).onclick = () => { loadDemo(); toast('Données de démo chargées'); ctx.go('home'); };
  $('#reset', view).onclick = () => { if (confirm('Effacer toutes tes données ? (irréversible)')) { store.reset(); location.reload(); } };
}

function openMember(done) {
  const body = sheet(`
    <label class="lbl">Prénom</label><input id="m-name" placeholder="ex. Léa">
    <div class="grid2">
      <div><label class="lbl">Âge</label><input id="m-age" type="number" inputmode="numeric" placeholder="8"></div>
      <div><label class="lbl">Sexe</label><select id="m-sex"><option value="f">Femme / fille</option><option value="h">Homme / garçon</option></select></div>
      <div><label class="lbl">Poids kg (adulte)</label><input id="m-weight" type="number" inputmode="decimal"></div>
      <div><label class="lbl">Taille cm (adulte)</label><input id="m-height" type="number" inputmode="decimal"></div>
    </div>
    <label class="lbl">Régime</label><select id="m-diet"><option value="omnivore">Omnivore</option><option value="pescetarien">Pescétarien</option><option value="vegetarien">Végétarien</option><option value="vegan">Végan</option></select>
    <label class="lbl">Allergies</label><div class="chips" style="flex-wrap:wrap">${F.ALLERGENS.map((a) => `<button class="chip" data-mal="${a}">${a}</button>`).join('')}</div>
    <label class="lbl">N’aime pas</label><div class="chips" style="flex-wrap:wrap;max-height:180px;overflow-y:auto">${F.TASTE_CATALOG.flatMap((c) => c.items).map((it) => `<button class="chip" data-mdis="${esc(it)}">${esc(it)}</button>`).join('')}</div>
    <button class="btn block" id="m-save" style="margin-top:16px">Ajouter</button>`, { title: 'Membre du foyer' });
  $$('[data-mal], [data-mdis]', body).forEach((b) => (b.onclick = () => b.classList.toggle(b.dataset.mal ? 'bad' : 'on')));
  $('#m-save', body).onclick = () => {
    const v = (id) => $('#m-' + id, body).value.trim();
    if (!v('age')) return toast('Indique au moins l’âge');
    store.update((s) => s.household.push({ id: crypto.randomUUID(), name: v('name'), age: Number(v('age')), sex: v('sex'), weight: Number(v('weight')) || null, height: Number(v('height')) || null, diet: v('diet'), allergies: $$('[data-mal].bad', body).map((b) => b.dataset.mal).join(', '), dislikes: $$('[data-mdis].on', body).map((b) => b.dataset.mdis).join(', ') }));
    body.close();
    done();
  };
}
