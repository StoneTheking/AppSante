// Profil : corps, objectifs, rappels, connexions, IA, données.
import * as store from '../store.js';
import * as S from '../science.js';
import * as AI from '../ai.js';
import * as R from '../reminders.js';
import * as N from '../native.js';
import { refreshReminders } from '../context.js';
import { icon, esc, toast, $, $$ } from '../ui.js';
import { loadDemo } from './onboarding.js';

const APK_URL = 'https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk';

export function render(view, ctx) {
  const st = store.get();
  const p = st.profile;
  const rs = st.settings.reminders;
  const sel = (id, opts) => `<select data-p="${id}">${Object.entries(opts).map(([v, l]) => `<option value="${v}" ${String(p[id]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (id, type = 'text', extra = '') => `<input data-p="${id}" type="${type}" value="${esc(p[id] ?? '')}" ${extra}>`;
  const sw = (attr, on) => `<span class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''}><span></span></span>`;

  view.innerHTML = `
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

    <div class="section-title">Rappels</div>
    <div class="card">
      <label class="between" style="flex-wrap:nowrap"><span><b>Activer les rappels</b><div class="tiny muted">${N.isNative ? 'Notifications programmées, même application fermée.' : 'Dans le navigateur, les rappels ne s’affichent que si l’application est ouverte récemment. Pour des rappels fiables, installe l’application Android.'}</div></span>${sw('id="rem-on"', rs.enabled)}</label>
      <div id="rem-kinds" style="${rs.enabled ? '' : 'opacity:.45;pointer-events:none'}">
        ${Object.entries(R.KINDS).map(([k, v]) => `<label class="between" style="padding:10px 0;border-top:1px solid var(--line);flex-wrap:nowrap"><span class="small">${v.label}</span>${sw(`data-kind="${k}"`, rs.kinds[k])}</label>`).join('')}
      </div>
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
