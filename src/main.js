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
import * as Profile from './views/profile.js';
import * as Onboarding from './views/onboarding.js';
import * as A from './views/actions.js';

const VIEWS = { home: Home, nutrition: Nutrition, health: Health, coach: Coach, profile: Profile };
const TITLES = { nutrition: 'Nutrition', health: 'Santé', coach: 'Coach', profile: 'Profil' };
const app = $('#app');
const launchAction = location.hash === '#sleep' ? 'sleep' : null; // raccourci « Je vais dormir »
let tab = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
applyTheme();

const ctx = {
  toast,
  go,
  render: () => renderView(),
  syncWidget: () => { const s = store.get().sleepNow; N.setWidgetState(!!s, s); },
  action(a) {
    if (a === 'photo') A.openPhoto(ctx);
    else if (a === 'scan') A.openScanner(ctx);
    else if (a === 'checkin') A.openCheckin(ctx);
    else if (a === 'manual') A.openManual(ctx);
    else if (a === 'sleep') A.openSleep(ctx);
    else if (a === 'stool') A.openStool(ctx);
    else if (a === 'receipt') A.openReceipt(ctx);
    else if (a === 'menus') go('nutrition', () => { $('[data-seg="nut"][data-v="menus"]')?.click(); });
    else if (a === 'sync') { Health.openSection('suivi'); go('health'); }
  },
};

function shell() {
  app.innerHTML = `
    <header class="top">
      <div class="hello"><span class="date" id="date"></span><h1 id="title"></h1></div>
      <button class="avatar" id="avatar" aria-label="Profil"></button>
    </header>
    <main id="view"></main>
    <nav class="nav" aria-label="Navigation principale">
      <button data-tab="home"><span class="pill">${icon('home', 22)}</span>Accueil</button>
      <button data-tab="nutrition"><span class="pill">${icon('utensils', 22)}</span>Nutrition</button>
      <button class="fab" id="fab" aria-label="Ajouter">${icon('plus', 28)}</button>
      <button data-tab="health"><span class="pill">${icon('activity', 22)}</span>Santé</button>
      <button data-tab="coach"><span class="pill">${icon('chat', 22)}</span>Coach</button>
    </nav>`;
  $$('.nav [data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  $('#fab').onclick = () => A.openAddMenu(ctx);
  $('#avatar').onclick = () => go('profile');
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

// À chaque retour au premier plan : appuis du widget, air & météo, données de santé.
async function onForeground() {
  const events = await N.takeWidgetEvents();
  if (events.length) {
    const r = SL.applyWidgetEvents(events);
    ctx.syncWidget();
    if (r && !r.tooShort) toast(`Nuit enregistrée : ${Math.floor(r.sleepMinutes / 60)} h ${String(r.sleepMinutes % 60).padStart(2, '0')}`);
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
