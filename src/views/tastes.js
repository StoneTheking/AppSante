// Choix des goûts, cuisines et allergies par catégories (sans saisie au clavier).
import * as store from '../store.js';
import * as F from '../family.js';
import { icon, esc, sheet, $, $$ } from '../ui.js';

const allergyList = (p) => (p.allergies || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);

export function openTastePicker(done) {
  let tab = 'aliments';
  const body = sheet('<div id="tp"></div>', { title: 'Mes goûts', full: true, onClose: done });
  const el = $('#tp', body);
  const draw = () => {
    const p = store.get().profile;
    const t = p.tastes || {};
    const state = (item) => t[item] || 0;
    const mark = (v) => (v > 0 ? '♥' : v < 0 ? '✕' : '');
    el.innerHTML = `
      <div class="seg">${[['aliments', 'Aliments'], ['cuisines', 'Cuisines'], ['allergies', 'Allergies']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${tab === 'aliments' ? `
        <p class="tiny muted" style="margin:8px 0">Touche une fois : <b style="color:var(--good)">♥ j’aime</b> · deux fois : <b style="color:var(--bad)">✕ j’évite</b> · trois fois : neutre.</p>
        ${F.TASTE_CATALOG.map((c) => {
          const vals = c.items.map(state);
          const allOut = vals.every((v) => v < 0), allIn = vals.every((v) => v > 0);
          return `<div class="taste-cat">
            <div class="between"><b>${c.emoji} ${esc(c.cat)}</b>
              <span class="row" style="gap:6px;flex-wrap:nowrap">
                <button class="chip sm ${allIn ? 'on' : ''}" data-all="${esc(c.cat)}" data-v="1" aria-label="Tout aimer">♥ tout</button>
                <button class="chip sm ${allOut ? 'bad' : ''}" data-all="${esc(c.cat)}" data-v="-1" aria-label="Tout éviter">✕ tout</button>
              </span></div>
            <div class="chips" style="flex-wrap:wrap;margin-top:8px">${c.items.map((it) => `<button class="chip taste ${state(it) > 0 ? 'like' : state(it) < 0 ? 'dislike' : ''}" data-item="${esc(it)}">${mark(state(it)) ? `<span>${mark(state(it))}</span>` : ''}${esc(it)}</button>`).join('')}</div>
          </div>`;
        }).join('')}` : ''}
      ${tab === 'cuisines' ? `<p class="tiny muted" style="margin:8px 0">Les menus et suggestions privilégient ces cuisines.</p>
        <div class="chips" style="flex-wrap:wrap">${F.CUISINES.map((c) => `<button class="chip ${(p.cuisines || []).includes(c) ? 'on' : ''}" data-cuisine="${c}">${c}</button>`).join('')}</div>` : ''}
      ${tab === 'allergies' ? `<p class="tiny muted" style="margin:8px 0">Les 14 allergènes réglementaires : exclus des menus, signalés au scan des produits.</p>
        <div class="chips" style="flex-wrap:wrap">${F.ALLERGENS.map((a) => `<button class="chip ${allergyList(p).includes(a) ? 'bad' : ''}" data-allergen="${a}">${allergyList(p).includes(a) ? '⚠ ' : ''}${a}</button>`).join('')}</div>` : ''}
      <button class="btn block" id="ok" style="margin-top:16px">${icon('check', 18)} Terminé</button>`;

    $$('[data-tab]', el).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    $$('[data-item]', el).forEach((b) => (b.onclick = () => {
      const it = b.dataset.item;
      store.update((s) => {
        const cur = (s.profile.tastes ||= {})[it] || 0;
        const next = cur === 0 ? 1 : cur === 1 ? -1 : 0;
        if (next) s.profile.tastes[it] = next; else delete s.profile.tastes[it];
      });
      draw();
    }));
    $$('[data-all]', el).forEach((b) => (b.onclick = () => {
      const cat = F.TASTE_CATALOG.find((c) => c.cat === b.dataset.all);
      const v = Number(b.dataset.v);
      store.update((s) => {
        const t2 = (s.profile.tastes ||= {});
        const already = cat.items.every((it) => t2[it] === v);
        cat.items.forEach((it) => { if (already) delete t2[it]; else t2[it] = v; });
      });
      draw();
    }));
    $$('[data-cuisine]', el).forEach((b) => (b.onclick = () => {
      store.update((s) => { const c = new Set(s.profile.cuisines || []); c.has(b.dataset.cuisine) ? c.delete(b.dataset.cuisine) : c.add(b.dataset.cuisine); s.profile.cuisines = [...c]; });
      draw();
    }));
    $$('[data-allergen]', el).forEach((b) => (b.onclick = () => {
      store.update((s) => { const l = new Set(allergyList(s.profile)); l.has(b.dataset.allergen) ? l.delete(b.dataset.allergen) : l.add(b.dataset.allergen); s.profile.allergies = [...l].join(', '); });
      draw();
    }));
    $('#ok', el).onclick = () => body.close();
  };
  draw();
}

// Résumé compact affiché dans le profil.
export function tasteSummary(p) {
  const { likes, dislikes } = F.tasteLists(p);
  const parts = [];
  if (likes.length) parts.push(`<span style="color:var(--good)">♥</span> ${esc(likes.slice(0, 6).join(', '))}${likes.length > 6 ? '…' : ''}`);
  if (dislikes.length) parts.push(`<span style="color:var(--bad)">✕</span> ${esc(dislikes.slice(0, 6).join(', '))}${dislikes.length > 6 ? '…' : ''}`);
  if ((p.cuisines || []).length) parts.push(`${icon('chef', 12)} ${esc(p.cuisines.join(', '))}`);
  if (p.allergies) parts.push(`⚠ ${esc(p.allergies)}`);
  return parts.length ? parts.map((x) => `<div class="small" style="margin:4px 0">${x}</div>`).join('') : '<p class="small muted" style="margin:0">Aucun goût choisi pour l’instant.</p>';
}
