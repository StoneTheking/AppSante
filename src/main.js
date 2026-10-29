import './styles.css';
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

const VIEWS = { home: Home, nutrition: Nutrition, sport: Sport, health: Health, coach: Coach, profile: Profile };
const TITLES = { nutrition: 'Nutrition', sport: 'Sport', health: 'Santé', coach: 'Coach', profile: 'Profil' };
const app = $('#app');
const launchAction = location.hash === '#sleep' ? 'sleep' : null; // raccourci « Je vais dormir »
let tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
applyTheme();

const ctx = {
  toast,
  go,
  render: () => renderView(),
  syncWidget: () => { const s = store.get().sleepNow; N.setWidgetState(!!s, s); },
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
    await LocalNotifications.schedule({ notifications: [{ id: 900, title: 'Bien réveillé ? ☀︎', body: 'Ouvre AppSanté : ta nuit est enregistrée automatiquement.', schedule: { at, allowWhileIdle: true }, smallIcon: 'ic_stat_appsante' }] }).catch(() => {});
  },
  action(a) {
    if (a === 'photo') A.openPhoto(ctx);
    else if (a === 'scan') A.openScanner(ctx);
    else if (a === 'checkin') A.openCheckin(ctx);
    else if (a === 'manual') A.openManual(ctx);
    else if (a === 'sleep') A.openSleep(ctx);
    else if (a === 'stool') A.openStool(ctx);
    else if (a === 'receipt') A.openReceipt(ctx);
    else if (a === 'workout') go('sport', () => Sport.openWorkout(ctx, $('#view'), !store.get().workoutNow));
    else if (a === 'menus') go('nutrition', () => { $('[data-seg="nut"][data-v="menus"]')?.click(); });
    else if (a === 'sync') { Health.openSection('suivi'); go('health'); }
  },
};

function shell() {
  document.body.classList.remove('onb-mode');
  app.innerHTML = `
    <header class="top">
      <div class="hello"><span class="date" id="date"></span><h1 id="title"></h1></div>
      <div class="row" style="flex-wrap:nowrap"><button class="avatar" id="coach-btn" aria-label="Coach IA">${icon('chat', 19)}</button><button class="avatar" id="avatar" aria-label="Profil"></button></div>
    </header>
    <main id="view"></main>
    <nav class="nav" aria-label="Navigation principale">
      <button data-tab="home"><span class="pill">${icon('home', 22)}</span>Accueil</button>
      <button data-tab="nutrition"><span class="pill">${icon('utensils', 22)}</span>Nutrition</button>
      <button class="fab" id="fab" aria-label="Ajouter">${icon('plus', 28)}</button>
      <button data-tab="sport"><span class="pill">${icon('dumbbell', 22)}</span>Sport</button>
      <button data-tab="health"><span class="pill">${icon('heart', 22)}</span>Santé</button>
    </nav>`;
  $$('.nav [data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  $('#fab').onclick = () => A.openAddMenu(ctx);
  $('#avatar').onclick = () => go('profile');
  $('#coach-btn').onclick = () => go('coach');
  $('#view').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) go(t.dataset.tab);
  });
}

function renderView(after) {
  const { profile } = store.get();
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Bonne nuit' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  $('#title').textContent = tab === 'home' ? `${hello}${profile.name ? ' ' + profile.name : ''}` : TITLES[tab];
  $('#date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#avatar').innerHTML = profile.name ? esc(profile.name[0].toUpperCase()) : icon('user', 20);
  $$('.nav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const view = $('#view');
  view.className = 'view-enter';
  void view.offsetWidth;
  VIEWS[tab].render(view, ctx);
  after?.();
}

function go(t, after) {
  tab = t;
  history.replaceState(null, '', '#' + t);
  window.scrollTo(0, 0);
  renderView(after);
}

function start() {
  if (!store.get().onboarded) {
    Onboarding.render(app, () => { shell(); go('home'); refreshReminders(); });
    return;
  }
  shell();
  renderView();
  refreshReminders();
  onForeground();
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
  const events = await N.takeWidgetEvents();
  if (events.length) {
    const r = SL.applyWidgetEvents(events);
    ctx.syncWidget();
    if (r && !r.tooShort) toast(`Nuit enregistrée : ${Math.floor(r.sleepMinutes / 60)} h ${String(r.sleepMinutes % 60).padStart(2, '0')}`);
  }
  await detectMorning();
  if (N.isNative && (store.get().update?.available || Date.now() - (store.get().update?.checked || 0) > 12 * 3600e3)) {
    N.checkUpdate().then((u) => { store.update((s) => { s.update = { ...u, checked: Date.now() }; }); if (u.available && tab === 'home') renderView(); }).catch(() => {});
  }
  const before = store.get().env?.fetched;
  await refreshEnv();
  if (store.get().env?.fetched !== before && tab === 'home') renderView();
  if (events.length && ['home', 'health'].includes(tab)) renderView();
  autoSync();
}

// Synchronisation automatique dans l'application Android (au lancement puis au retour au premier plan).
let lastAuto = 0;
async function autoSync() {
  if (!N.isNative || !store.get().settings.autoSync || Date.now() - lastAuto < 10 * 60e3) return;
  lastAuto = Date.now();
  await Health.syncAll({ silent: true });
  if (['home', 'health'].includes(tab)) renderView();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.get().onboarded) { onForeground(); refreshReminders(); }
});

start();

if ('serviceWorker' in navigator && import.meta.env.PROD && !N.isNative) navigator.serviceWorker.register('./sw.js');
