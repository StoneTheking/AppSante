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
    else if (a === 'sync') { Health.openSection('suivi'); go('health'); }
  },
};

function shell() {
  document.body.classList.remove('onb-mode');
  app.innerHTML = `
    <header class="top">
      <div class="hello-wrap"><div id="diana-slot"></div><div class="hello"><span class="date" id="date"></span><h1 id="title"></h1></div></div>
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
  $('#date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
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
  after?.();
}

function go(t, after, dir) {
  tab = t;
  history.replaceState(null, '', '#' + t);
  window.scrollTo(0, 0);
  renderView(after, true);
  if (dir) { const v = $('#view'); v.classList.add(dir > 0 ? 'swipe-l' : 'swipe-r'); setTimeout(() => v.classList.remove('swipe-l', 'swipe-r'), 400); }
}

// Glisser vers la gauche ou la droite : menu suivant ou précédent (dans l'ordre de la barre du bas).
const ORDER = ['home', 'nutrition', 'sport', 'health'];
function swipeNav() {
  let x0 = 0, y0 = 0, t0 = 0, ok = false;
  // Pas de changement de menu depuis un élément qui défile ou se manipule à l'horizontale.
  const blocked = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.matches?.('input, textarea, select, canvas, .sheet-root, [data-noswipe]')) return true;
      if (e.scrollWidth > e.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)) return true;
    }
    return false;
  };
  document.addEventListener('touchstart', (e) => {
    const p = e.touches[0];
    ok = e.touches.length === 1 && ORDER.includes(tab) && !$('.sheet-root') && !blocked(e.target);
    x0 = p.clientX; y0 = p.clientY; t0 = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!ok) return;
    ok = false;
    const p = e.changedTouches[0], dx = p.clientX - x0, dy = p.clientY - y0;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - t0 > 700) return;
    // le bord gauche est réservé au geste « retour » d'Android
    if (x0 < 18 || x0 > innerWidth - 18) return;
    const i = ORDER.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < ORDER.length) go(ORDER[i], null, dx < 0 ? 1 : -1);
  }, { passive: true });
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
  const all = await N.takeWidgetEvents();
  // widget « Photo du repas »
  if (all.some((e) => e.type === 'photo') && Date.now() - Math.max(...all.filter((e) => e.type === 'photo').map((e) => e.t)) < 5 * 60e3) setTimeout(() => ctx.action('photo'), 250);
  const events = all.filter((e) => e.type !== 'photo');
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
  if (store.get().env?.fetched !== before && tab === 'home') renderView();
  if (events.length && ['home', 'health'].includes(tab)) renderView();
  autoSync();
  A.repairScannedMeals().then((n) => { if (n && ['home', 'nutrition'].includes(tab)) renderView(); });
  A.processPendingPhotos().then((n) => { if (n && ['home', 'nutrition'].includes(tab)) renderView(); });
}

// Synchronisation automatique dans l'application Android (au lancement puis au retour au premier plan).
let lastAuto = 0;
async function autoSync() {
  if (!N.isNative || Date.now() - lastAuto < 5 * 60e3) return;
  lastAuto = Date.now();
  await Health.syncAll({ silent: true });
  if (['home', 'health'].includes(tab)) renderView();
}
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
