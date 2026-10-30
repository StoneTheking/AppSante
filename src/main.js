import './styles.css';
import './net.js';
import * as store from './store.js';
import * as N from './native.js';
import { refreshReminders, refreshEnv } from './context.js';
import { applyTheme } from './theme.js';
import * as SL from './sleep.js';
import { icon, esc, toast, $, $$ } from './ui.js';
import * as Home from './views/home.js';
import * as Nutrition from './views/nutrition.js';
import * as Health from './views/health.js';
import * as Coach from './views/coach.js';
import * as Sport from './views/sport.js';
import * as Profile from './views/profile.js';
import * as Onboarding from './views/onboarding.js';
import * as A from './views/actions.js';
import * as P from './views/progress.js';
import * as G from './gamify.js';
import * as Diana from './diana.js';
import * as S from './science.js';

const VIEWS = { home: Home, nutrition: Nutrition, sport: Sport, health: Health, coach: Coach, profile: Profile };
const TITLES = { nutrition: 'Nutrition', sport: 'Sport', health: 'Santé', coach: 'Coach', profile: 'Profil' };
const app = $('#app');
const launchAction = location.hash === '#sleep' ? 'sleep' : location.hash === '#photo' ? 'photo' : null; // raccourcis
let tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
applyTheme();

const ctx = {
  toast,
  go,
  render: () => renderView(),
  // Widget « Quêtes du jour » : même calcul que la carte de l'accueil, envoyé seulement s'il a changé.
  syncQuests(force = false) {
    if (!N.isNative || !store.get().onboarded) return;
    const st = store.get();
    const goals = G.dayGoals(st, G.dayKeyOffset(0));
    const s = G.streak(st);
    const t = goals.find((g) => g.id === 'water');
    const data = {
      date: G.dayKeyOffset(0), need: G.VALIDATE, streak: s.current, atRisk: s.atRisk, done: goals.filter((g) => g.done).length,
      items: goals.map((g) => ({ id: g.id, progress: Math.round(g.progress * 100) / 100, done: g.done })),
      waterMl: store.getDay().waterMl || 0, waterTarget: S.targets(st.profile).waterMl, hint: t?.hint,
    };
    const json = JSON.stringify(data);
    if (!force && json === ctx.syncQuests.last) return;
    ctx.syncQuests.last = json;
    N.setQuestsWidget(data);
  },
  syncWidget: () => { const s = store.get().sleepNow; N.setWidgetState(!!s, s, store.get().profile.bedTime); },
  // Au coucher : mémorise l'alarme du téléphone et programme un rappel « Bien réveillé ? » juste après.
  async scheduleMorning() {
    if (!N.isNative) return;
    const alarm = await N.nextAlarm();
    const ok = alarm && alarm - Date.now() < 16 * 3600e3;
    store.update((s) => { s.sleepAlarm = ok ? alarm : null; });
    const [h, m] = store.get().profile.wakeTime.split(':').map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    if (target < new Date()) target.setDate(target.getDate() + 1);
    const at = new Date((ok ? alarm : target.getTime()) + 15 * 60000);
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.requestPermissions().catch(() => {});
    await LocalNotifications.schedule({ notifications: [{ id: 900, title: 'Bonjour ☀︎', body: 'Ouvre Diana Health : ta nuit est enregistrée automatiquement.', schedule: { at, allowWhileIdle: true }, smallIcon: 'ic_stat_appsante' }] }).catch(() => {});
  },
  action(a) {
    if (a === 'photo') A.openPhoto(ctx);
    else if (a === 'scan') A.openScanner(ctx);
    else if (a === 'product') A.openProductSearch(ctx);
    else if (a === 'checkin') A.openCheckin(ctx);
    else if (a === 'manual') A.openManual(ctx);
    else if (a === 'sleep') A.openSleep(ctx);
    else if (a === 'stool') A.openStool(ctx);
    else if (a === 'receipt') A.openReceipt(ctx);
    else if (a === 'snack') A.openSnack(ctx);
    else if (a === 'workout') go('sport', () => Sport.openWorkout(ctx, $('#view'), !store.get().workoutNow));
    else if (a === 'menus') go('nutrition', () => { $('[data-seg="nut"][data-v="menus"]')?.click(); });
    else if (a === 'sync') { Profile.openSection('phone'); go('profile'); }
  },
};

function shell() {
  document.body.classList.remove('onb-mode');
  app.innerHTML = `
    <header class="top">
      <div class="hello-wrap"><div id="diana-slot"></div><div class="hello"><h1 id="title"></h1></div></div>
      <div class="row" style="flex-wrap:nowrap"><button class="streak-btn" id="streak-btn" aria-label="Ma progression"></button><button class="avatar" id="coach-btn" aria-label="Coach IA">${icon('chat', 19)}</button><button class="avatar" id="avatar" aria-label="Profil"></button></div>
    </header>
    <main id="view"></main>
    <nav class="nav" aria-label="Navigation principale">
      <button data-tab="home"><span class="pill">${icon('home', 22)}</span>Accueil</button>
      <button data-tab="nutrition"><span class="pill">${icon('utensils', 22)}</span>Nutrition</button>
      <button class="fab" id="fab" aria-label="Ajouter">${icon('plus', 28)}</button>
      <button data-tab="sport"><span class="pill">${icon('dumbbell', 22)}</span>Sport</button>
      <button data-tab="health"><span class="pill">${icon('heart', 22)}</span>Santé</button>
    </nav>`;
  // Onglet déjà ouvert : on remonte simplement en haut, sans rejouer l'animation d'entrée.
  $$('.nav [data-tab]').forEach((b) => (b.onclick = () => (b.dataset.tab === tab ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go(b.dataset.tab))));
  $('#fab').onclick = () => A.openAddMenu(ctx);
  $('#avatar').onclick = () => tab !== 'profile' && go('profile');
  $('#coach-btn').onclick = () => tab !== 'coach' && go('coach');
  $('#streak-btn').onclick = () => P.openProgress();
  Diana.mount($('#diana-slot'), () => go('coach'));
  if (!swipeNav.on) { swipeNav.on = true; swipeNav(); }
  $('#view').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) go(t.dataset.tab);
  });
}

function renderView(after, animate = false) {
  const { profile } = store.get();
  // Accueil : seule Diana (elle salue dans sa bulle), sans titre à côté.
  $('#title').textContent = TITLES[tab] || '';
  $('#title').hidden = tab === 'home';
  $('#avatar').innerHTML = profile.name ? esc(profile.name[0].toUpperCase()) : icon('user', 20);
  $$('.nav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  Diana.setTab(tab);
  const view = $('#view');
  view.className = animate ? 'view-enter' : '';
  if (animate) void view.offsetWidth;
  VIEWS[tab].render(view, ctx);
  // l'animation d'entrée ne joue qu'à la navigation, pas à chaque mise à jour
  clearTimeout(renderView.t);
  renderView.t = setTimeout(() => $$('.view-enter').forEach((e) => e.classList.remove('view-enter')), 1200);
  const s = G.streak(store.get());
  const sb = $('#streak-btn');
  sb.innerHTML = `${icon('flame', 17)}<span>${s.current}</span>`;
  sb.className = `streak-btn ${s.atRisk ? 'risk' : s.current ? '' : 'cold'}`;
  P.celebrate();
  clearTimeout(renderView.q);
  renderView.q = setTimeout(() => ctx.syncQuests(), 600); // hors du chemin critique de l'affichage
  after?.();
}

function go(t, after, dir) {
  tab = t;
  if (['health', 'home', 'sport'].includes(t)) autoSync(); // données fraîches (Samsung Health envoie pas et séances au fil de l'eau)
  history.replaceState(null, '', '#' + t);
  window.scrollTo(0, 0);
  // en glissant : simple glissement latéral, sans l'animation d'entrée des cartes (qui partent transparentes → flash noir)
  renderView(after, !dir);
  if (dir) {
    // la nouvelle page entre depuis le côté où le doigt l'a poussée ; l'animation démarre une fois la page dessinée
    const v = $('#view');
    v.classList.remove('swipe-l', 'swipe-r');
    requestAnimationFrame(() => { v.classList.add(dir > 0 ? 'swipe-l' : 'swipe-r'); clearTimeout(go.t); go.t = setTimeout(() => v.classList.remove('swipe-l', 'swipe-r'), 400); });
  }
}

// Glisser vers la gauche ou la droite : menu suivant ou précédent (dans l'ordre de la barre du bas).
// La page suit le doigt dès que le geste est clairement horizontal ; sur l'accueil, tirer vers le bas
// depuis le haut de la page relance la synchronisation (pas, sommeil, air…).
const ORDER = ['home', 'nutrition', 'sport', 'health'];
function swipeNav() {
  let x0 = 0, y0 = 0, t0 = 0, ok = false, lock = null, dx = 0, dy = 0, pull = false, raf = 0, leaving = false;
  // Pas de changement de menu depuis un élément qui défile ou se manipule à l'horizontale.
  const blocked = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.matches?.('input, textarea, select, canvas, .sheet-root, [data-noswipe]')) return true;
      if (e.scrollWidth > e.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)) return true;
    }
    return false;
  };
  const ptr = () => $('#ptr') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'ptr', innerHTML: icon('refresh', 20) }));
  const view = () => $('#view');
  document.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    // le bord de l'écran est réservé au geste « retour » d'Android
    ok = !leaving && e.touches.length === 1 && ORDER.includes(tab) && !$('.sheet-root') && p.clientX > 14 && p.clientX < innerWidth - 14 && !blocked(e.target);
    pull = ok && tab === 'home' && window.scrollY <= 0;
    x0 = p.clientX; y0 = p.clientY; t0 = Date.now(); lock = null; dx = dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!ok) return;
    const p = e.touches[0];
    dx = p.clientX - x0; dy = p.clientY - y0;
    if (!lock && Math.hypot(dx, dy) > 10) lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    if (lock === 'x') {
      e.preventDefault(); // pas de défilement vertical pendant le glissement
      const i = ORDER.indexOf(tab) + (dx < 0 ? 1 : -1);
      const room = i >= 0 && i < ORDER.length ? 1 : 0.25; // résistance au bout de la liste
      // une seule écriture par image, sur un calque GPU (.dragging) : pas de repeinture de la page à chaque mouvement
      if (!view().classList.contains('dragging')) view().classList.add('dragging');
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; view().style.transform = `translate3d(${dx * 0.45 * room}px,0,0)`; });
    } else if (lock === 'y' && pull && dy > 0 && window.scrollY <= 0) {
      const el = ptr(), h = Math.min(dy, 140);
      el.style.opacity = Math.min(1, h / 80);
      el.style.transform = `translate(-50%, ${h * 0.6}px) rotate(${h * 2.5}deg)`;
      el.classList.toggle('ready', h >= 80);
    }
  }, { passive: false });
  const end = () => {
    if (!ok) return;
    ok = false;
    const v = view();
    if (lock === 'x') {
      cancelAnimationFrame(raf); raf = 0;
      const fast = Math.abs(dx) > 40 && Date.now() - t0 < 300;
      const i = ORDER.indexOf(tab) + (dx < 0 ? 1 : -1);
      if ((Math.abs(dx) > 60 || fast) && i >= 0 && i < ORDER.length) {
        // La page continue sa course et s'efface, puis la suivante se dessine hors de vue :
        // le calcul de la nouvelle page ne fige plus l'écran à mi-geste.
        leaving = true;
        const d = dx < 0 ? 1 : -1;
        v.style.transition = 'transform .14s ease-in, opacity .14s ease-in';
        v.style.transform = `translate3d(${-d * 70}px,0,0)`;
        v.style.opacity = '0';
        setTimeout(() => {
          v.style.transition = 'none'; v.style.transform = ''; v.style.opacity = '';
          v.classList.remove('dragging');
          go(ORDER[i], null, d);
          requestAnimationFrame(() => { v.style.transition = ''; leaving = false; });
        }, 140);
      } else {
        v.style.transition = 'transform .2s ease';
        v.style.transform = '';
        setTimeout(() => { v.style.transition = ''; v.classList.remove('dragging'); }, 220);
      }
    }
    const el = $('#ptr');
    if (el) {
      if (lock === 'y' && pull && dy >= 80) {
        el.classList.add('spin');
        refreshAll().finally(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); });
      } else { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}

// « Tirer pour actualiser » : tout est relu tout de suite (sans attendre le délai habituel).
async function refreshAll() {
  const before = store.get().env?.fetched;
  await Promise.all([autoSync(true), refreshEnv(true)]);
  if (store.get().env?.fetched !== before && !busy()) renderView();
  toast('Données à jour', 1200);
}

// Lancement : Diana apparaît, fait un clin d'œil, puis s'efface sur l'appli déjà prête (rien ne se dessine sous les yeux).
function boot() {
  const el = $('#boot');
  if (!el) return;
  const slot = $('#boot-face');
  slot.innerHTML = Diana.face('happy', 124);
  const cv = slot.querySelector('canvas');
  cv.classList.add('boot-orb');
  setTimeout(() => Diana.express(cv, 'proud', 650), 450);
  setTimeout(() => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }, 1250);
  setTimeout(() => el.remove(), 1750);
}

function start() {
  boot();
  if (!store.get().onboarded) {
    Onboarding.render(app, () => { shell(); go('home'); refreshReminders(); }, 'in');
    return;
  }
  shell();
  renderView(null, true);
  refreshReminders();
  onForeground();
  askMoodToday();
  if (launchAction) setTimeout(() => ctx.action(launchAction), 300);
}

// Si une nuit est en cours depuis au moins 3 h : détection du réveil (Android) ou question (web).
let morningAsked = false;
async function detectMorning() {
  const st = store.get();
  if (!st.sleepNow) return;
  const bed = new Date(st.sleepNow).getTime();
  const now = Date.now();
  if (now - bed < 3 * 3600e3) return;
  if (N.isNative && (await N.usagePermission().catch(() => false))) {
    try {
      const events = await N.screenEvents(bed, now);
      const r = SL.detectWake(bed, events, { alarmMs: st.sleepAlarm, nowMs: now, wakeTarget: st.profile.wakeTime });
      if (r.wake) {
        const night = SL.recordNight(new Date(bed), new Date(r.wake), { source: r.source, nightWakes: r.nightWakes });
        await SL.estimatePhoneInBed(night);
        ctx.syncWidget();
        if (!night.tooShort) { renderView(); A.showMorning(ctx, night); }
        return;
      }
    } catch { /* on retombe sur la question */ }
  }
  const h = new Date().getHours();
  if (!morningAsked && h >= 4 && h < 14) { morningAsked = true; A.askWakeTime(ctx); }
}

// À chaque retour au premier plan : appuis du widget, air & météo, données de santé.
async function onForeground() {
  autoSync(); // pas et sommeil relus dès le retour dans l'appli
  const all = await N.takeWidgetEvents();
  // widgets « Photo ou code-barres » et « Quêtes du jour » : seule la dernière demande récente est suivie
  const asks = all.filter((e) => ['photo', 'scan', 'quest'].includes(e.type) && Date.now() - e.t < 5 * 60e3);
  const ask = asks.at(-1);
  if (ask) setTimeout(() => widgetAsk(ask), 250);
  // eau ajoutée depuis le widget : 25 cL par appui, comptés le jour de l'appui
  const water = all.filter((e) => e.type === 'water');
  if (water.length) {
    store.update((s) => { for (const e of water) { const k = G.dayKeyOffset(0, new Date(e.t)); s.days[k] = { ...(s.days[k] || {}), waterMl: (s.days[k]?.waterMl || 0) + 250 }; } });
    if (['home', 'health'].includes(tab)) renderView();
  }
  const events = all.filter((e) => !['photo', 'scan', 'quest', 'water'].includes(e.type));
  if (events.length) {
    const r = SL.applyWidgetEvents(events);
    if (r && !r.tooShort) await SL.estimatePhoneInBed?.(r);
    ctx.syncWidget();
    if (r && !r.tooShort) setTimeout(() => A.showMorning(ctx, r), 300);
  }
  await detectMorning();
  await Sport.refreshCalendar?.().catch(() => {});
  if (N.isNative && !N.installedVersion()) await N.appVersion().catch(() => {});
  if (N.isNative && store.get().update?.available && !N.isNewer(store.get().update.latest, N.installedVersion())) store.update((s) => { s.update.available = false; });
  if (N.isNative && (store.get().update?.available || Date.now() - (store.get().update?.checked || 0) > 12 * 3600e3)) {
    N.checkUpdate().then((u) => { store.update((s) => { s.update = { ...u, checked: Date.now() }; }); if (u.available && tab === 'home') renderView(); }).catch(() => {});
  }
  const before = store.get().env?.fetched;
  await refreshEnv();
  if (store.get().env?.fetched !== before && tab === 'home' && !busy()) renderView();
  if (events.length && ['home', 'health'].includes(tab)) renderView();
  A.repairScannedMeals().then((n) => { if (n && ['home', 'nutrition'].includes(tab)) renderView(); });
  A.processPendingPhotos().then((n) => { if (n && ['home', 'nutrition'].includes(tab)) renderView(); });
}

function widgetAsk(e) {
  if (e.type !== 'quest') return ctx.action(e.type);
  const q = e.source;
  if (q === 'move') go('sport');
  else if (q === 'sleep') ctx.action('sleep');
  else if (q === 'mood') ctx.action('checkin');
  else if (q === 'food') go('nutrition');
  else if (tab !== 'home') go('home');
}

// Synchronisation automatique dans l'application Android (au lancement puis au retour au premier plan).
let lastAuto = 0;
const busy = () => document.activeElement?.matches?.('input, textarea, select') || document.querySelector('.sheet-root');
async function autoSync(force = false) {
  if (!N.isNative || (!force && Date.now() - lastAuto < 20e3)) return;
  lastAuto = Date.now();
  const before = JSON.stringify([store.get().days, store.get().hcReport?.todaySteps, store.get().workouts.map((w) => w.id + w.minutes)]);
  await Health.syncAll({ silent: true });
  // on ne redessine que si quelque chose a changé, et jamais pendant une saisie ou avec une fenêtre ouverte
  const changed = before !== JSON.stringify([store.get().days, store.get().hcReport?.todaySteps, store.get().workouts.map((w) => w.id + w.minutes)]);
  if (changed && !busy() && ORDER.includes(tab)) renderView();
}
// Appli ouverte : air, météo et pas se mettent à jour tout seuls toutes les 10 min.
setInterval(() => {
  if (document.visibilityState !== 'visible' || !store.get().onboarded) return;
  autoSync();
  const before = store.get().env?.fetched;
  refreshEnv().then(() => { if (store.get().env?.fetched !== before && tab === 'home' && !busy()) renderView(); });
}, 10 * 60e3);
// « Annuler » après une suppression : l'écran affiché reprend l'état d'avant.
window.addEventListener('store-restored', () => { if (!document.querySelector('.sheet-root')) renderView(); toast('Restauré', 1200); });
// Réseau retrouvé : les photos de repas mises de côté sont analysées.
window.addEventListener('online', () => { if (store.get().onboarded) A.processPendingPhotos().then((n) => { if (n && ['home', 'nutrition'].includes(tab)) renderView(); }); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.get().onboarded) { onForeground(); refreshReminders(); askMoodToday(); Diana.greet(1200, { again: true }); }
});

// Humeur : demandée une fois par jour à la première ouverture (après 7 h, hors nuit en cours).
function askMoodToday() {
  const st = store.get();
  if (st.sleepNow || new Date().getHours() < 7 || st.moodAsked === store.today() || store.getDay().mood || document.querySelector('.sheet-root')) return;
  setTimeout(() => { if (!document.querySelector('.sheet-root')) A.openCheckin(ctx, { daily: true }); }, 1500);
}

start();

if ('serviceWorker' in navigator && import.meta.env.PROD && !N.isNative) navigator.serviceWorker.register('./sw.js');
