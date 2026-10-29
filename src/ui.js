// Briques d'interface partagées : icônes, échappement, formatage, feuilles modales, toasts.
import {
  House, Utensils, Plus, HeartPulse, MessageCircle, User, Camera, ScanBarcode, Moon, Sun, Footprints, Smartphone, Smile, Flame,
  Droplet, Coffee, Dumbbell, Apple, Salad, ChefHat, ShoppingCart, CalendarDays, TrendingUp, Bell, Sparkles, ChevronLeft,
  ChevronRight, Check, X, Trash2, RefreshCw, Download, Upload, Settings, Activity, Brain, Bed, Clock, Scale, Wine, Info,
  TriangleAlert, CircleCheck, Send, Zap, BookOpen, Share2, Leaf, Watch, Link, ListChecks, Pencil, Image as ImageIcon, Lightbulb, Target,
  Sunrise, Bike, Copy, ArrowRight, KeyRound, Shield, Star, Users, MapPin, Receipt, Palette,
} from 'lucide';
import * as S from './science.js';

const ICONS = {
  home: House, utensils: Utensils, plus: Plus, heart: HeartPulse, chat: MessageCircle, user: User, camera: Camera, barcode: ScanBarcode,
  moon: Moon, sun: Sun, steps: Footprints, phone: Smartphone, smile: Smile, flame: Flame, water: Droplet, coffee: Coffee, dumbbell: Dumbbell,
  apple: Apple, salad: Salad, chef: ChefHat, cart: ShoppingCart, calendar: CalendarDays, trend: TrendingUp, bell: Bell, sparkles: Sparkles,
  left: ChevronLeft, right: ChevronRight, check: Check, x: X, trash: Trash2, refresh: RefreshCw, download: Download, upload: Upload,
  settings: Settings, activity: Activity, brain: Brain, bed: Bed, clock: Clock, scale: Scale, wine: Wine, info: Info, alert: TriangleAlert,
  ok: CircleCheck, send: Send, zap: Zap, book: BookOpen, share: Share2, leaf: Leaf, watch: Watch, link: Link, list: ListChecks,
  pencil: Pencil, image: ImageIcon, bulb: Lightbulb, target: Target, sunrise: Sunrise, bike: Bike, copy: Copy, arrow: ArrowRight,
  key: KeyRound, shield: Shield, star: Star, users: Users, pin: MapPin, receipt: Receipt, palette: Palette,
};

const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
const node = ([tag, a, children]) => `<${tag} ${attrs(a)}>${(children || []).map(node).join('')}</${tag}>`;

export function icon(name, size = 20, cls = '') {
  const n = ICONS[name] || ICONS.info;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${n.map(node).join('')}</svg>`;
}

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (x, d = 0) => (x == null || Number.isNaN(x) ? '—' : S.round(x, d).toLocaleString('fr-FR'));

export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

export function srcLinks(ids = []) {
  const links = ids.map((id) => S.SOURCES[id] && `<a href="${S.SOURCES[id].u}" target="_blank" rel="noopener">${esc(S.SOURCES[id].t.split(' – ')[0])}</a>`).filter(Boolean);
  return links.length ? `<details class="src"><summary>${icon('book', 12)} ${links.length} source${links.length > 1 ? 's' : ''}</summary><div>${links.join(' · ')}</div></details>` : '';
}

// Feuille modale montant du bas de l'écran. Renvoie l'élément de contenu ; close() la ferme.
export function sheet(html, { title = '', onClose, full = false } = {}) {
  const root = document.createElement('div');
  root.className = 'sheet-root';
  root.innerHTML = `<div class="sheet-backdrop"></div>
    <section class="sheet ${full ? 'full' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip"></div>
      <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></header>
      <div class="sheet-body">${html}</div>
    </section>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('open'));
  const close = () => {
    root.classList.remove('open');
    setTimeout(() => root.remove(), 250);
    onClose?.();
  };
  root.querySelector('.sheet-backdrop').onclick = close;
  root.querySelector('[data-close]').onclick = close;
  const body = root.querySelector('.sheet-body');
  body.close = close;
  return body;
}

export function segmented(name, options, value) {
  return `<div class="seg" role="tablist">${options.map(([v, l]) => `<button role="tab" class="${v === value ? 'on' : ''}" data-seg="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
}

// Mini-rendu Markdown pour les réponses du coach (gras, titres, listes).
export function md(text) {
  const lines = esc(text).split('\n');
  let html = '', list = null;
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');
  for (const l of lines) {
    const ul = l.match(/^\s*[-•*]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/), h = l.match(/^#{1,4}\s+(.*)/);
    const kind = ul ? 'ul' : ol ? 'ol' : null;
    if (list && kind !== list) { html += `</${list}>`; list = null; }
    if (kind) { if (!list) { html += `<${kind}>`; list = kind; } html += `<li>${inline((ul || ol)[1])}</li>`; }
    else if (h) html += `<h4>${inline(h[1])}</h4>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (list) html += `</${list}>`;
  return html;
}

export function compressImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function pickImage({ camera = true, multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.multiple = multiple;
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

export const DOMAIN = {
  sommeil: { label: 'Sommeil', icon: 'moon', color: 'var(--c-sleep)' },
  activite: { label: 'Activité', icon: 'steps', color: 'var(--c-move)' },
  alimentation: { label: 'Alimentation', icon: 'salad', color: 'var(--c-food)' },
  humeur: { label: 'Humeur', icon: 'smile', color: 'var(--c-mood)' },
  numerique: { label: 'Écrans', icon: 'phone', color: 'var(--c-screen)' },
};

// Anneaux concentriques (façon « anneaux d'activité ») pour 3 scores + score global au centre.
export function rings(scores, global) {
  const keys = ['activite', 'sommeil', 'alimentation'];
  const size = 168, sw = 13, gap = 4;
  const out = keys.map((k, i) => {
    const r = size / 2 - sw / 2 - i * (sw + gap);
    const c = 2 * Math.PI * r, v = scores[k] ?? 0;
    return `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${DOMAIN[k].color}" stroke-opacity=".16" stroke-width="${sw}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${DOMAIN[k].color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-anim"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Score global ${global ?? 'inconnu'} sur 100">${out.join('')}
    <text x="50%" y="49%" text-anchor="middle" class="ring-num">${global ?? '–'}</text>
    <text x="50%" y="63%" text-anchor="middle" class="ring-sub">score santé</text></svg>`;
}

export function donut(value, max, { size = 120, color = 'var(--c-food)', label = '', sub = '', overColor = 'var(--bad)' } = {}) {
  const sw = 12, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  const p = Math.min(1, max ? value / max : 0);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)} ${esc(sub)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${sw}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${value > max ? overColor : color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="48%" text-anchor="middle" class="donut-num">${esc(label)}</text>
    <text x="50%" y="64%" text-anchor="middle" class="ring-sub">${esc(sub)}</text></svg>`;
}

// Barres simples (une série) ; toucher une barre affiche la valeur dans .tip de la carte.
export function barChart(points, { ref, unit = '', digits = 0, color = 'var(--primary)' } = {}) {
  const W = 320, H = 130, pad = 20, n = points.length;
  const max = Math.max(ref || 0, ...points.map((p) => p.v || 0)) * 1.15 || 1;
  const bw = (W - 8) / n;
  const y = (v) => H - pad - (v / max) * (H - pad - 16);
  const bars = points.map((p, i) => {
    const x = 4 + i * bw, has = p.v != null;
    const h = has ? Math.max(3, H - pad - y(p.v)) : 3;
    const tip = `${p.label} : ${has ? fmt(p.v, digits) + ' ' + unit : 'pas de données'}`;
    return `<rect x="${x + 3}" y="${has ? y(p.v) : H - pad - 3}" width="${bw - 6}" height="${h}" rx="4" fill="${has ? color : 'var(--line)'}"/>
      <rect class="hit" x="${x}" y="0" width="${bw}" height="${H}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>
      ${n <= 7 || i % 2 === (n - 1) % 2 ? `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${esc(p.short)}</text>` : ''}`;
  });
  const last = [...points].reverse().find((p) => p.v != null);
  const li = points.lastIndexOf(last);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <line class="grid" x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}"/>
    ${ref ? `<line class="ref" x1="0" x2="${W}" y1="${y(ref)}" y2="${y(ref)}"/><text x="6" y="${y(ref) - 4}">objectif ${fmt(ref, digits)}</text>` : ''}
    ${bars.join('')}
    ${last ? `<text class="val" x="${4 + li * bw + bw / 2}" y="${y(last.v) - 5}" text-anchor="middle">${fmt(last.v, digits)}</text>` : ''}
  </svg><div class="tip">Touche une barre pour voir la valeur</div>`;
}

export function lineChart(series) {
  const W = 320, H = 160, padL = 30, padB = 20, padT = 12;
  const all = series.flatMap((s) => s.pts.map((p) => p.w));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const maxD = Math.max(...series.flatMap((s) => s.pts.map((p) => p.d)));
  const x = (d) => padL + (d / maxD) * (W - padL - 52);
  const y = (w) => padT + (1 - (w - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - 52}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 5}" y="${y(t) + 3}" text-anchor="end">${fmt(t, 0)}</text>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map((yr) => `<text x="${x(yr * 365)}" y="${H - 5}" text-anchor="middle">${yr === 0 ? 'auj.' : yr + ' an' + (yr > 1 ? 's' : '')}</text>`).join('')}
    ${series.map((s) => {
      const end = s.pts.at(-1);
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${s.pts.map((p) => `${x(p.d)},${y(p.w)}`).join(' ')}"/>
      <circle cx="${x(end.d)}" cy="${y(end.w)}" r="4.5" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>
      <text class="val" x="${x(end.d) + 8}" y="${y(end.w) + 4}">${fmt(end.w, 1)} kg</text>
      ${s.pts.filter((p) => p.d % 365 === 0).map((p) => `<circle cx="${x(p.d)}" cy="${y(p.w)}" r="12" fill="transparent" data-tip="${esc(`${s.name} — ${p.d === 0 ? "aujourd'hui" : (p.d / 365) + ' an(s)'} : ${fmt(p.w, 1)} kg`)}"/>`).join('')}`;
    }).join('')}
  </svg><div class="tip">Touche un point pour voir la valeur</div>`;
}
