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
import { icon, esc, toast, sheet, srcLinks, $, $$ } from '../ui.js';
import { loadDemo } from './onboarding.js';

const CUISINES = ['Méditerranéenne', 'Française', 'Italienne', 'Asiatique', 'Indienne', 'Mexicaine', 'Libanaise', 'Africaine', 'Japonaise', 'Végétale'];
const APK_URL = 'https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk';

export function render(view, ctx) {
  const st = store.get();
  const p = st.profile;
  const rs = st.settings.reminders;
  const sel = (id, opts) => `<select data-p="${id}">${Object.entries(opts).map(([v, l]) => `<option value="${v}" ${String(p[id]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (id, type = 'text', extra = '') => `<input data-p="${id}" type="${type}" value="${esc(p[id] ?? '')}" ${extra}>`;
  const sw = (attr, on) => `<span class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><span></span></span>`;

  view.innerHTML = `
    ${N.isNative ? `<div class="card" id="update-card"><div class="between"><div><b>${icon('download', 16)} Application</b><div class="tiny muted" id="ver">Version…</div></div><button class="btn sm soft" id="check-up">Vérifier les mises à jour</button></div></div>` : ''}
    ${!N.isNative ? `<div class="card" style="background:var(--hero);color:#fff;border:0">
      <div class="row" style="flex-wrap:nowrap;gap:14px"><span class="icon-badge" style="background:rgba(255,255,255,.18)">${icon('phone')}</span>
      <div><b>Application Android</b><div class="small" style="opacity:.85">Synchronisation automatique du temps d’écran, des pas, du sommeil et du cœur + rappels fiables.</div></div></div>
      <a class="btn block" href="${APK_URL}" style="margin-top:12px;background:#fff;color:#0f766e;text-decoration:none">${icon('download', 18)} Télécharger l’APK</a>
      <p class="tiny" style="opacity:.8;margin:8px 0 0">Ouvre le fichier téléchargé et autorise l’installation depuis Chrome. Tes données restent sur le téléphone : exporte-les ci-dessous puis restaure-les dans l’application.</p>
    </div>` : ''}

    <div class="section-title">Mon corps</div>
    <div class="card">
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
    </div>

    <div class="section-title">Objectifs & habitudes</div>
    <div class="card">
      <label class="lbl">Objectif</label>${sel('goal', { perdre: 'Perdre du poids', maintenir: 'Rester en forme', prendre: 'Prendre du muscle' })}
      <label class="lbl">Niveau d'activité habituel</label>${sel('activityLevel', { sedentaire: 'Sédentaire', leger: 'Légèrement actif', modere: 'Modérément actif (3-5 séances/sem)', actif: 'Actif (sport quotidien)', tres_actif: 'Très actif' })}
      <label class="lbl">Régime</label>${sel('diet', { omnivore: 'Omnivore', pescetarien: 'Pescétarien', vegetarien: 'Végétarien', vegan: 'Végan' })}
      <label class="lbl">Allergies / aliments à éviter</label>${inp('allergies', 'text', 'placeholder="ex. arachide, lactose"')}
      <label class="lbl">Sport préféré</label>${inp('preferredSport', 'text', 'placeholder="ex. course, natation, padel"')}
      <div class="grid2">
        <div><label class="lbl">Réveil</label>${inp('wakeTime', 'time')}</div>
        <div><label class="lbl">Coucher visé</label>${inp('bedTime', 'time')}</div>
      </div>
    </div>

    <div class="section-title">Goûts</div>
    <div class="card">
      <p class="small muted" style="margin-top:0">Un plan qui te plaît est un plan que tu suis : l’adhésion compte plus que le type de régime. Les étoiles données à tes repas affinent aussi tes goûts.</p>
      <label class="lbl">J’aime (aliments, plats)</label>${inp('likes', 'text', 'placeholder="ex. saumon, curry, pâtes, avocat"')}
      <label class="lbl">Je n’aime pas</label>${inp('dislikes', 'text', 'placeholder="ex. brocolis, coriandre, abats"')}
      <label class="lbl">Cuisines préférées</label>
      <div class="chips" style="flex-wrap:wrap">${CUISINES.map((c) => `<button class="chip ${(p.cuisines || []).includes(c) ? 'on' : ''}" data-cuisine="${c}">${c}</button>`).join('')}</div>
      ${(() => { const t = F.topTastes(taste(), 6); return t.likes.length || t.dislikes.length ? `<p class="tiny muted">Appris de tes notes : 👍 ${esc(t.likes.join(', ') || '—')} · 👎 ${esc(t.dislikes.join(', ') || '—')}</p>` : ''; })()}
      ${srcLinks(['dansinger2005'])}
    </div>

    <div class="section-title">Foyer & repas en famille</div>
    <div class="card">
      <p class="small muted" style="margin-top:0">Les menus, quantités et la liste de courses s’adaptent à tout le foyer (besoins des enfants selon l’EFSA, allergies et régimes de chacun).</p>
      ${st.household.map((m) => `<div class="member"><span class="avatar">${esc((m.name || '?')[0].toUpperCase())}</span><div><b>${esc(m.name || 'Membre')}</b><div class="tiny muted">${m.age} ans · ~${F.memberKcal(m)} kcal/j${m.allergies ? ` · allergies : ${esc(m.allergies)}` : ''}${m.diet && m.diet !== 'omnivore' ? ` · ${esc(m.diet)}` : ''}</div></div><button class="icon-btn" data-member-del="${m.id}" aria-label="Retirer">${icon('trash', 14)}</button></div>`).join('')}
      <button class="btn soft block" id="add-member" style="margin-top:10px">${icon('users', 18)} Ajouter un membre</button>
      ${srcLinks(['hammons2011', 'efsa2013energy'])}
    </div>

    <div class="section-title">Lieu de vie</div>
    <div class="card" id="loc">
      <p class="small muted" style="margin-top:0">Qualité de l’air, pollens, UV, chaleur et heures de soleil adaptent ton plan (sport dehors ou dedans, meilleur créneau, conseils sommeil).</p>
      ${st.location ? `<div class="between"><b>${icon('pin', 16)} ${esc(st.location.name)}</b><button class="btn sm ghost" id="loc-clear">Changer</button></div>` : `
      <div class="row" style="flex-wrap:nowrap"><input id="city" placeholder="Ta ville…"><button class="btn" id="city-go">${icon('arrow', 18)}</button></div>
      <button class="btn ghost block" id="geo" style="margin-top:8px">${icon('pin', 18)} Utiliser ma position</button>
      <div id="city-res"></div>`}
      ${srcLinks(['who2021air', 'andersen2015'])}
    </div>

    <div class="section-title">Rappels</div>
    <div class="card">
      <label class="between" style="flex-wrap:nowrap"><span><b>Activer les rappels</b><div class="tiny muted">${N.isNative ? 'Notifications programmées, même application fermée.' : 'Dans le navigateur, les rappels ne s’affichent que si l’application est ouverte récemment. Pour des rappels fiables, installe l’application Android.'}</div></span>${sw('id="rem-on"', rs.enabled)}</label>
      <div id="rem-kinds" style="${rs.enabled ? '' : 'opacity:.45;pointer-events:none'}">
        ${Object.entries(R.KINDS).map(([k, v]) => `<label class="between" style="padding:10px 0;border-top:1px solid var(--line);flex-wrap:nowrap"><span class="small">${v.label}</span>${sw(`data-kind="${k}"`, rs.kinds[k])}</label>`).join('')}
      </div>
    </div>

    <div class="section-title">Apparence</div>
    <div class="card">
      <div class="seg">${[['dark', 'Sombre'], ['light', 'Clair'], ['auto', 'Système']].map(([v, l]) => `<button data-theme-pick="${v}" class="${st.settings.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${N.isNative ? `<button class="btn ghost block" id="pin-widget" style="margin-top:10px">${icon('moon', 18)} Ajouter le widget « Je vais dormir » à l’écran d’accueil</button>` : '<p class="tiny muted" style="margin:10px 0 0">Raccourci : appui long sur l’icône AppSanté → « Je vais dormir ».</p>'}
    </div>

    <div class="section-title">Intelligence artificielle</div>
    <div class="card">
      <p class="small muted" style="margin-top:0">Analyse photo, lecture de captures, menus et coach utilisent Claude (Anthropic). Crée une clé sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> ; elle reste sur ce téléphone.</p>
      <label class="lbl">Clé API</label><input id="key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(st.settings.apiKey)}">
      <label class="between" style="flex-wrap:nowrap;margin-top:14px"><span><b class="small">Recherche scientifique en ligne</b><div class="tiny muted">Le coach peut consulter PubMed, Cochrane, OMS, ANSES, Lancet, BMJ… (coût API légèrement supérieur)</div></span><span class="switch"><input type="checkbox" id="web" ${st.settings.webSearch ? 'checked' : ''}><span></span></span></label>
      <label class="lbl">Modèle</label><select id="model">${AI.MODELS.map((m) => `<option value="${m.id}" ${st.settings.model === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
    </div>

    <div class="section-title">Mes données</div>
    <div class="card">
      <p class="small muted" style="margin-top:0">Tout est stocké localement sur ton téléphone.</p>
      <div class="grid2"><button class="btn ghost" id="exp">${icon('download', 18)} Exporter</button><button class="btn ghost" id="imp">${icon('upload', 18)} Restaurer</button></div>
      <div class="grid2" style="margin-top:10px"><button class="btn ghost" id="demo">${icon('sparkles', 18)} Démo</button><button class="btn danger" id="reset">${icon('trash', 18)} Tout effacer</button></div>
      <input id="imp-file" type="file" accept=".json,application/json" hidden>
    </div>

    <div class="card">
      <details><summary>${icon('book', 18)} Base scientifique (${Object.keys(S.SOURCES).length} références) ${icon('right', 16)}</summary>
        <ul class="small" style="padding-left:18px">${Object.values(S.SOURCES).map((s) => `<li style="margin:6px 0"><a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join('')}</ul>
      </details>
    </div>
    <p class="tiny muted" style="text-align:center">AppSanté n’est pas un dispositif médical et ne remplace pas l’avis d’un professionnel de santé.<br><a href="privacy.html" target="_blank">Confidentialité</a></p>`;

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
  $$('[data-cuisine]', view).forEach((b) => (b.onclick = () => {
    store.update((s) => { const c = new Set(s.profile.cuisines || []); c.has(b.dataset.cuisine) ? c.delete(b.dataset.cuisine) : c.add(b.dataset.cuisine); s.profile.cuisines = [...c]; });
    b.classList.toggle('on');
  }));
  $$('[data-member-del]', view).forEach((b) => (b.onclick = () => { store.update((s) => (s.household = s.household.filter((m) => m.id !== b.dataset.memberDel))); render(view, ctx); }));
  $('#add-member', view).onclick = () => openMember(() => render(view, ctx));
  $$('[data-theme-pick]', view).forEach((b) => (b.onclick = () => { store.update((s) => (s.settings.theme = b.dataset.themePick)); applyTheme(); render(view, ctx); }));
  $('#pin-widget', view)?.addEventListener('click', async () => { const r = await N.pinSleepWidget(); toast(r ? 'Confirme l’ajout du widget' : 'Appui long sur l’écran d’accueil → Widgets → AppSanté'); });
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
  $('#key', view).onchange = (e) => { store.update((s) => (s.settings.apiKey = e.target.value.trim())); toast('Clé enregistrée'); };
  $('#web', view).onchange = (e) => store.update((s) => (s.settings.webSearch = e.target.checked));
  $('#model', view).onchange = (e) => store.update((s) => (s.settings.model = e.target.value));
  $('#exp', view).onclick = async () => {
    const json = store.exportJSON();
    const file = new File([json], `appsante-${store.today()}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: 'Sauvegarde AppSanté' }).catch(() => {});
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
    <label class="lbl">Allergies</label><input id="m-allergies" placeholder="ex. arachide">
    <label class="lbl">N’aime pas</label><input id="m-dislikes" placeholder="ex. épinards">
    <button class="btn block" id="m-save" style="margin-top:16px">Ajouter</button>`, { title: 'Membre du foyer' });
  $('#m-save', body).onclick = () => {
    const v = (id) => $('#m-' + id, body).value.trim();
    if (!v('age')) return toast('Indique au moins l’âge');
    store.update((s) => s.household.push({ id: crypto.randomUUID(), name: v('name'), age: Number(v('age')), sex: v('sex'), weight: Number(v('weight')) || null, height: Number(v('height')) || null, diet: v('diet'), allergies: v('allergies'), dislikes: v('dislikes') }));
    body.close();
    done();
  };
}
