// Briques d'interface partagées : icônes, échappement, formatage, feuilles modales, toasts.
import {
  House, Utensils, Plus, HeartPulse, MessageCircle, User, Camera, ScanBarcode, Moon, Sun, Footprints, Smartphone, Smile, Flame,
  Droplet, Coffee, Dumbbell, Apple, Salad, ChefHat, ShoppingCart, CalendarDays, TrendingUp, Bell, Sparkles, ChevronLeft,
  ChevronRight, Check, X, Trash2, RefreshCw, Download, Upload, Settings, Activity, Brain, Bed, Clock, Scale, Wine, Info,
  TriangleAlert, CircleCheck, Send, Zap, BookOpen, Share2, Leaf, Watch, Link, ListChecks, Pencil, Image as ImageIcon, Lightbulb, Target,
  Sunrise, Bike, Copy, ArrowRight, KeyRound, Shield, Star, Users, MapPin, Receipt, Palette, Briefcase, CirclePlay, EyeOff, Search,
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
  key: KeyRound, shield: Shield, star: Star, users: Users, pin: MapPin, receipt: Receipt, palette: Palette, work: Briefcase, video: CirclePlay, hide: EyeOff, search: Search,
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

// Sources : touchées, elles expliquent ce que l'étude a montré et pourquoi elle appuie ce conseil.
export function srcLinks(ids = []) {
  const ok = [...new Set(ids)].filter((id) => S.SOURCES[id]);
  return ok.length ? `<details class="src"><summary>${icon('book', 12)} ${ok.length} source${ok.length > 1 ? 's' : ''}</summary><div class="src-chips">${ok.map((id) => `<button type="button" class="src-chip" data-src="${id}">${esc(S.SOURCES[id].t.split(' – ')[0])}</button>`).join('')}</div></details>` : '';
}

// Ce que la source vient appuyer : le titre et le texte de l'élément qui la cite.
function citedFor(el) {
  const box = el.closest('.insight, .pillar, li, .suggest, .feature, .sheet-body > div, .card, details:not(.src), .sheet-body') || el.parentElement;
  const pick = (sel) => [...box.querySelectorAll(sel)].map((x) => x.textContent.trim()).find((t) => t && !t.match(/^\d+ sources?$/));
  const title = pick('h2, h3, .ttl, summary:not(.src summary), b');
  const text = pick('.txt, p, .small');
  return { title, text: text && text !== title ? text : '' };
}

export function openSource(id, from) {
  const info = S.sourceInfo(id);
  if (!info) return;
  const why = from ? citedFor(from) : {};
  const cut = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') + '…' : t);
  sheet(`
    <div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em">${esc(info.name)}</div>
    <p style="font-weight:650;margin:4px 0 12px">${esc(info.title)}</p>
    ${why.title ? `<div class="note">${icon('target', 18)}<span><b>Pourquoi elle est citée ici</b><br>Elle appuie « ${esc(cut(why.title, 90))} »${why.text ? ` : ${esc(cut(why.text, 170))}` : '.'}</span></div>` : ''}
    ${info.facts.length ? `<h3 style="font-size:.9rem;margin:14px 0 6px">Ce qu’elle a montré</h3><ul class="small" style="padding-left:18px;margin:0;line-height:1.55">${info.facts.slice(0, 4).map((f) => `<li>${esc(f.text)}</li>`).join('')}</ul>` : ''}
    <a class="btn block" style="margin-top:16px" href="${info.url}" target="_blank" rel="noopener">${icon('book', 18)} Lire l’étude</a>
    <p class="tiny muted" style="margin-top:8px">Lien DOI vers la publication originale (résumé gratuit, article parfois payant).</p>`, { title: 'Source scientifique' });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-src]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  openSource(b.dataset.src, b);
}, true);

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
  // une fois ouverte, la feuille ne rejoue plus ses animations d'entrée quand son contenu est redessiné
  setTimeout(() => root.classList.add('settled'), 1000);
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

// Choix d'image. Photo : caméra intégrée (aperçu immédiat, sans ouvrir l'appli Appareil photo) ;
// galerie : sélecteur natif dans l'application Android, sélecteur de fichiers sinon.
export async function pickImage({ camera = true, multiple = false } = {}) {
  if (camera && navigator.mediaDevices?.getUserMedia) {
    const r = await quickCamera().catch(() => null);
    if (r === 'gallery') return pickImage({ camera: false, multiple });
    if (r) return [r];
    if (r === null && quickCamera.denied) { /* repli ci-dessous */ } else return [];
  }
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const toFile = async (path) => (await fetch(path)).blob();
      if (multiple && !camera) {
        const r = await Camera.pickImages({ quality: 85, limit: 6 });
        return Promise.all(r.photos.map((ph) => toFile(ph.webPath)));
      }
      const ph = await Camera.getPhoto({ quality: 85, resultType: CameraResultType.Uri, source: camera ? CameraSource.Camera : CameraSource.Photos, saveToGallery: false });
      return [await toFile(ph.webPath)];
    } catch (e) {
      if (/cancel/i.test(e?.message || '')) return [];
    }
  }
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

// Caméra plein écran dans l'application : renvoie un Blob JPEG, 'gallery', ou undefined si annulé.
let camStream = null, camStop = null;
// Image vide : sans « poster », la WebView Android affiche une grosse icône ▶ avant la première image.
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
function quickCamera() {
  return new Promise(async (resolve, reject) => {
    const root = document.createElement('div');
    root.className = 'qcam';
    root.innerHTML = `<video playsinline muted autoplay poster="${BLANK}"></video><div class="qcam-flash"></div>
      <button class="qcam-x" aria-label="Fermer">${icon('x', 26)}</button>
      <div class="qcam-bar"><button class="qcam-side" data-gal aria-label="Galerie">${icon('image', 24)}</button><button class="qcam-shot" aria-label="Prendre la photo"></button><span class="qcam-side"></span></div>`;
    document.body.appendChild(root);
    const video = root.querySelector('video');
    const close = (v) => { clearTimeout(camStop); camStop = setTimeout(() => { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; }, 20000); root.remove(); resolve(v); };
    root.querySelector('.qcam-x').onclick = () => close(undefined);
    root.querySelector('[data-gal]').onclick = () => close('gallery');
    try {
      clearTimeout(camStop);
      // le flux reste ouvert 20 s après fermeture : la photo suivante s'ouvre instantanément
      if (!camStream || !camStream.active) camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.addEventListener('playing', () => video.classList.add('on'), { once: true });
      video.srcObject = camStream;
      await video.play().catch(() => {});
    } catch (e) {
      quickCamera.denied = true;
      root.remove();
      reject(e);
      return;
    }
    root.querySelector('.qcam-shot').onclick = () => {
      if (!video.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      root.querySelector('.qcam-flash').classList.add('on');
      navigator.vibrate?.(15);
      c.toBlob((b) => close(b), 'image/jpeg', 0.9);
    };
  });
}

// Logo : trois anneaux (activité, sommeil, alimentation) autour d'un point, comme le score.
export function logo(size = 40) {
  const a = (r, deg) => { const x = 256 + r * Math.cos((deg * Math.PI) / 180), y = 256 + r * Math.sin((deg * Math.PI) / 180); return `M256 ${256 - r}A${r} ${r} 0 ${deg > 90 ? 1 : 0} 1 ${x.toFixed(1)} ${y.toFixed(1)}`; };
  const rings = [[150, '#fb923c', 200], [108, '#818cf8', 140], [66, '#4ade80', 230]];
  return `<svg width="${size}" height="${size}" viewBox="60 60 392 392" aria-hidden="true">${rings.map(([r, c, d]) => `<circle cx="256" cy="256" r="${r}" fill="none" stroke="${c}" stroke-opacity=".18" stroke-width="30"/><path d="${a(r, d)}" fill="none" stroke="${c}" stroke-width="30" stroke-linecap="round"/>`).join('')}<circle cx="256" cy="256" r="20" fill="#2dd4bf"/></svg>`;
}

// Visages 1 à 5 (plus rapide à remplir qu'une échelle chiffrée) ; onPick(valeur) à chaque choix.
// Dessinés au trait comme les autres icônes (pas d'émojis) ; g = de 1 (mauvais) à 5 (très bien).
const TONE = ['var(--bad)', 'var(--warn)', 'var(--text-2)', 'var(--primary)', 'var(--good)'];
function faceSvg(g) {
  const c = (g - 3) * 1.6; // courbure de la bouche
  const brows = g === 1 ? '<path d="M7.5 8.2 10 9.2M16.5 8.2 14 9.2"/>' : '';
  const eyes = g === 5 ? '<path d="M8 10.2q1-1.2 2 0M14 10.2q1-1.2 2 0"/>' : '<circle cx="9" cy="10.5" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r=".9" fill="currentColor" stroke="none"/>';
  return `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/>${brows}${eyes}<path d="M8.2 ${15.4 - c / 2} Q12 ${15.4 + c * 1.3} 15.8 ${15.4 - c / 2}"/></svg>`;
}
function batterySvg(n) {
  return `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="17" height="10" rx="2.2"/><path d="M21.5 10.5v3"/>${Array.from({ length: n }, (_, i) => `<rect x="${4.3 + i * 2.9}" y="8.9" width="2" height="6.2" rx=".6" fill="currentColor" stroke="none"/>`).join('')}</svg>`;
}
// FACES[champ][i] = { svg, g } ; g sert à la couleur (stress : 1 = zen = très bien).
export const FACES = {
  mood: [1, 2, 3, 4, 5].map((g) => ({ svg: faceSvg(g), g })),
  energy: [1, 2, 3, 4, 5].map((g) => ({ svg: batterySvg(g), g })),
  stress: [5, 4, 3, 2, 1].map((g) => ({ svg: faceSvg(g), g })),
  sleepQuality: [1, 2, 3, 4, 5].map((g) => ({ svg: faceSvg(g), g })),
};
export const FACE_LABELS = {
  mood: ['Très bas', 'Bas', 'Neutre', 'Bon', 'Très bon'],
  energy: ['Épuisé', 'Fatigué', 'Moyen', 'En forme', 'Plein'],
  stress: ['Zen', 'Calme', 'Moyen', 'Tendu', 'Très tendu'],
  sleepQuality: ['Très mal', 'Mal', 'Moyen', 'Bien', 'Très bien'],
};
export function faces(field, value) {
  return `<div class="faces" data-faces="${field}">${FACES[field].map((f, i) => `<button type="button" class="${value === i + 1 ? 'on' : ''}" data-v="${i + 1}" style="--tone:${TONE[f.g - 1]}" aria-label="${FACE_LABELS[field][i]}"><span>${f.svg}</span><small>${FACE_LABELS[field][i]}</small></button>`).join('')}</div>`;
}
export function bindFaces(el, onPick) {
  $$('[data-faces]', el).forEach((box) => box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', box).forEach((x) => x.classList.toggle('on', x === b));
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    navigator.vibrate?.(10);
    onPick(box.dataset.faces, Number(b.dataset.v));
  }));
}

// Appui court / appui long sur un même bouton (ex. eau : +25 cL / −25 cL).
// Appui court / appui long. Un appui long ne déclenche qu'une seule action, même si la page se redessine
// sous le doigt (Android envoie alors « contextmenu » au nouveau bouton) : verrou commun à tous les boutons.
let lastHold = 0;
export function onTapHold(btn, tap, hold, ms = 420) {
  let t = null, x0 = 0, y0 = 0;
  const recent = () => Date.now() - lastHold < 900;
  const fire = () => { clearTimeout(t); if (recent()) return; lastHold = Date.now(); navigator.vibrate?.(30); hold(); };
  const start = (x, y) => { x0 = x; y0 = y; clearTimeout(t); t = setTimeout(fire, ms); };
  const move = (x, y) => { if (Math.hypot(x - x0, y - y0) > 12) clearTimeout(t); };
  const stop = () => clearTimeout(t);
  btn.classList.add('holdable');
  // au doigt : événements tactiles (le pointeur est annulé par Android dès que le système envisage un défilement)
  btn.addEventListener('touchstart', (e) => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  btn.addEventListener('touchmove', (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  btn.addEventListener('touchend', (e) => { stop(); if (recent()) e.preventDefault(); });
  btn.addEventListener('touchcancel', stop);
  // à la souris
  btn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') start(e.clientX, e.clientY); });
  btn.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') stop(); });
  btn.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') stop(); });
  // appui long système d'Android : même effet (ignoré si l'appui long vient d'être compté)
  btn.addEventListener('contextmenu', (e) => { e.preventDefault(); fire(); });
  btn.addEventListener('click', (e) => { if (recent()) { e.preventDefault(); return; } tap(); });
}

// Durées lisibles : 95 → « 1 h 35 », 40 → « 40 min ».
export function fmtMin(min) {
  if (min == null || Number.isNaN(min)) return '—';
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

// Nombre qui « monte » jusqu'à sa valeur (petite récompense visuelle).
export function countUp(el, to, ms = 700) {
  if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
    <text x="50%" y="63%" text-anchor="middle" class="ring-sub">hygiène de vie</text></svg>`;
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
export function barChart(points, { ref, unit = '', digits = 0, color = 'var(--primary)', type = 'bar', fmtV = null } = {}) {
  const show = (v) => (fmtV ? fmtV(v) : fmt(v, digits) + (unit ? ' ' + unit : ''));
  const W = 320, H = 130, pad = 20, n = points.length;
  const max = Math.max(ref || 0, ...points.map((p) => p.v || 0)) * 1.15 || 1;
  const bw = (W - 8) / n;
  const y = (v) => H - pad - (v / max) * (H - pad - 16);
  const bars = points.map((p, i) => {
    const x = 4 + i * bw, has = p.v != null;
    const h = has ? Math.max(3, H - pad - y(p.v)) : 3;
    const tip = `${p.label} : ${has ? show(p.v) : 'pas de données'}`;
    if (type === 'line') return `${has ? `<circle cx="${x + bw / 2}" cy="${y(p.v)}" r="3.5" fill="${color}" stroke="var(--card)" stroke-width="2"/>` : ''}<rect class="hit" x="${x}" y="0" width="${bw}" height="${H}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>
      ${n <= 7 || i % 2 === (n - 1) % 2 ? `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${esc(p.short)}</text>` : ''}`;
    return `<rect class="bar" style="animation-delay:${i * 25}ms" x="${x + 3}" y="${has ? y(p.v) : H - pad - 3}" width="${bw - 6}" height="${h}" rx="4" fill="${has ? color : 'var(--line)'}"/>
      <rect class="hit" x="${x}" y="0" width="${bw}" height="${H}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>
      ${n <= 7 || i % 2 === (n - 1) % 2 ? `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${esc(p.short)}</text>` : ''}`;
  });
  const last = [...points].reverse().find((p) => p.v != null);
  const li = points.lastIndexOf(last);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    <line class="grid" x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}"/>
    ${ref ? `<line class="ref" x1="0" x2="${W}" y1="${y(ref)}" y2="${y(ref)}"/><text x="6" y="${y(ref) - 4}">objectif ${fmt(ref, digits)}</text>` : ''}
    ${type === 'line' ? (() => { const pts = points.map((p, i) => (p.v != null ? `${4 + i * bw + bw / 2},${y(p.v)}` : null)).filter(Boolean); return pts.length > 1 ? `<path d="M${pts.join(' L')} L${pts.at(-1).split(',')[0]},${H - pad} L${pts[0].split(',')[0]},${H - pad} Z" fill="${color}" opacity=".12"/><polyline class="draw" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(' ')}"/>` : ''; })() : ''}
    ${bars.join('')}
    ${last ? `<text class="val" x="${4 + li * bw + bw / 2}" y="${y(last.v) - 7}" text-anchor="middle">${esc(fmtV ? fmtV(last.v) : fmt(last.v, digits))}</text>` : ''}
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

// Courbes datées (ex. poids réel vs estimé) : series = [{ name, color, pts: [{ t: ms, v }], dashed }].
export function timeChart(series, { unit = '', digits = 1 } = {}) {
  const W = 320, H = 150, padL = 34, padB = 20, padT = 10, padR = 10;
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) return '';
  let lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t)) || t0 + 1;
  const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [lo, (lo + hi) / 2, hi];
  const dates = [t0, (t0 + t1) / 2, t1];
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 5}" y="${y(t) + 3}" text-anchor="end">${fmt(t, digits)}</text>`).join('')}
    ${dates.map((d, i) => `<text x="${x(d)}" y="${H - 5}" text-anchor="${['start', 'middle', 'end'][i]}">${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>`).join('')}
    ${series.map((s) => `<polyline class="draw" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round" points="${s.pts.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}"/>
      ${s.dots ? s.pts.map((p) => `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/><circle cx="${x(p.t)}" cy="${y(p.v)}" r="12" fill="transparent" data-tip="${esc(`${s.name} — ${new Date(p.t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${fmt(p.v, digits)} ${unit}`)}"/>`).join('') : ''}`).join('')}
  </svg><div class="tip">Touche un point pour voir la valeur</div>`;
}

// Libère la caméra gardée ouverte (avant le scanner de code-barres, qui ouvre son propre flux).
export function releaseCamera() {
  clearTimeout(camStop);
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
}
