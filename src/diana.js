// Coach Diana : petit visage en 3D avec un bandeau de sport, posé au-dessus du menu, qui encourage partout dans l'appli.
// Ses phrases dépendent de l'heure, de ce qui a déjà été fait dans la journée (repas, eau, pas, séance, nuit)
// et de l'analyse des 7 derniers jours (score, pilier le plus faible).
import * as store from './store.js';
import * as S from './science.js';
import * as G from './gamify.js';
import * as SP from './sport.js';
import { draw } from './diana3d.js';

// ---------- Visage en 3D animé ----------
// face(mood, size) renvoie un <canvas> ; il est animé automatiquement dès qu'il apparaît dans la page.
// mood : happy | cheer (grand sourire) | proud (clin d'œil) | sleepy (yeux fermés) | oops (bouche hésitante)
export function face(mood = 'happy', size = 56) {
  return `<canvas class="diana-orb" data-mood="${mood}" style="width:${size}px;height:${size}px" aria-hidden="true"></canvas>`;
}

const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const orbs = new Set();
let raf = 0, lastFrame = 0;

// Une instance par canvas : pose de la tête, clignements, tour sur elle-même au toucher, bouche qui parle.
function orbOf(cv) {
  if (cv._orb) return cv._orb;
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const css = parseFloat(cv.style.width) || 56;
  cv.width = cv.height = Math.round(css * dpr);
  const o = { cv, buf: {}, mood: cv.dataset.mood || 'happy', t0: performance.now() / 1000 + Math.random() * 20, blinkAt: 2 + Math.random() * 3, spinAt: -9, talkUntil: 0, visible: true };
  cv._orb = o;
  orbs.add(o);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { o.visible = e.isIntersecting; if (o.visible) wake(); }).observe(cv);
  render(o, performance.now() / 1000);
  return o;
}

function render(o, now) {
  const t = now - o.t0;
  if (t > o.blinkAt + 0.18) o.blinkAt = t + 2.5 + Math.random() * 3.5;
  const bt = (t - o.blinkAt) / 0.18;
  const blink = still ? 0 : bt > 0 && bt < 1 ? Math.sin(Math.PI * bt) : 0;
  const sp = (now - o.spinAt) / 1.1;
  const spin = sp > 0 && sp < 1 ? 1 - Math.pow(1 - sp, 3) : 0;
  const jump = sp > 0 && sp < 1 ? -0.04 * Math.sin(Math.PI * Math.min(1, sp * 1.6)) : 0;
  const k = still ? 0.4 : 1;
  const yaw = (0.22 * Math.sin(t * 0.5) + 0.06 * Math.sin(t * 1.27)) * k + spin * Math.PI * 2;
  // Elle regarde l'utilisateur, avec de temps en temps un bref coup d'œil sur le côté.
  if (t > (o.glanceAt ?? 4) + 0.9) { o.glanceAt = t + 5 + Math.random() * 6; o.glance = [Math.random() > 0.5 ? 0.9 : -0.9, 0.3 * (Math.random() - 0.5)]; }
  const gt = (t - (o.glanceAt ?? 4)) / 0.9;
  const gk = gt > 0 && gt < 1 ? Math.sin(Math.PI * gt) : 0;
  const talk = o.talking || now < o.talkUntil ? 0.5 + 0.5 * Math.sin(now * 16) * Math.sin(now * 5.3 + 1) : 0;
  if (t > (o.flickAt ?? 3) + 0.08) o.flickAt = t + 4 + Math.random() * 6;
  const flicker = !still && t > (o.flickAt ?? 3) && t < (o.flickAt ?? 3) + 0.08 ? 0.82 : 1; // petit grésillement d'hologramme
  draw(o.cv, {
    yaw, pitch: (0.07 * Math.sin(t * 0.7 + 1)) * k, roll: 0.05 * Math.sin(t * 0.43 + 2) * k,
    bob: still ? 0 : 0.018 * Math.sin(t * 1.8) + jump, blink, mood: now < (o.moodUntil || 0) ? o.moodNow : o.mood, talk,
    gaze: o.glance ? [o.glance[0] * gk, o.glance[1] * gk] : [0, 0], time: t, flicker,
  }, o.buf);
}

// Expression passagère sur un visage (ex. clin d'œil au lancement).
export function express(cv, mood, ms = 700) {
  const o = orbOf(cv);
  o.moodNow = mood; o.moodUntil = performance.now() / 1000 + ms / 1000;
  wake();
}

function loop(ts) {
  raf = 0;
  if (document.hidden) return;
  let any = false;
  for (const o of orbs) {
    if (!o.cv.isConnected) { orbs.delete(o); continue; }
    if (o.visible) any = true;
  }
  if (!any || still) return;
  if (ts - lastFrame > 30) { lastFrame = ts; for (const o of orbs) if (o.visible) render(o, ts / 1000); } // ~30 images/s suffisent
  raf = requestAnimationFrame(loop);
}
function wake() {
  if (!still) { raf ||= requestAnimationFrame(loop); return; }
  for (const o of orbs) if (o.cv.isConnected) render(o, performance.now() / 1000); // mouvement réduit : une image fixe
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', wake);
  // Les visages ajoutés à la page s'animent tout seuls.
  new MutationObserver(() => { document.querySelectorAll('canvas.diana-orb').forEach((cv) => { if (!cv._orb) orbOf(cv); }); wake(); })
    .observe(document.documentElement, { childList: true, subtree: true });
}

const hm = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
const toMin = (t = '00:00') => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const hTxt = (h) => `${Math.floor(h)} h${Math.round((h % 1) * 60) ? ` ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : ''}`;
const L = (x) => String(Math.round(x / 100) / 10).replace('.', ',');
const PILLAR = { sommeil: 'le sommeil', activite: 'bouger', alimentation: 'l’assiette', numerique: 'les écrans' };

// Phrases possibles, de la plus pertinente à la moins pertinente : [texte, humeur].
export function lines(where, st = store.get(), sm, extra = {}) {
  const out = [];
  const add = (text, mood = 'happy') => text && out.push([text, mood]);
  const p = st.profile || {};
  const name = p.name ? ` ${p.name}` : '';
  const now = hm();
  const wake = toMin(p.wakeTime || '07:00');
  let bed = toMin(p.bedTime || '23:00');
  if (bed < 12 * 60) bed += 1440;
  const nowAdj = now < wake - 60 ? now + 1440 : now;
  const d = sm?.today || {};
  const meals = (sm?.mealsToday || []).filter((m) => !m.snack);
  const has = (slot) => meals.some((m) => m.slot === slot);
  const tot = sm?.totToday || { kcal: 0, protein: 0, fiber: 0, sugar: 0 };
  const t = sm?.t || {};
  const water = d.waterMl || 0;
  const steps = d.steps || 0;
  const doneW = sm?.workoutsToday || [];
  const planned = sm?.sportToday?.type && !doneW.length ? sm.sportToday : null;
  const s = G.streak(st);
  const goals = G.dayGoals(st, store.today());
  const left = G.VALIDATE - goals.filter((g) => g.done).length;
  const scores = sm?.scores || {};
  const weakest = Object.entries(scores).filter(([k, v]) => PILLAR[k] && v != null).sort((a, b) => a[1] - b[1])[0];

  if (where === 'guided') {
    const { step, i = 0, n = 1 } = extra;
    if (step?.isRest) return [['Souffle, bois une gorgée d’eau. Tu repars dans un instant 💧', 'happy'], ['Relâche les épaules, respire par le ventre.', 'happy']];
    if (i === 0) return [['C’est parti ! Échauffe-toi bien, je suis avec toi 💪', 'cheer']];
    if (i >= n - 2) return [['Dernière ligne droite, tu y es presque !', 'cheer']];
    if (i / n > 0.45 && i / n < 0.6) return [['Déjà la moitié ! Garde ce rythme 🔥', 'proud']];
    const cheers = [['Allez, tu gères !', 'cheer'], ['Concentre-toi sur la technique, pas sur la vitesse.', 'happy'], ['Chaque répétition compte. Bravo !', 'proud'], ['Respire régulièrement, tu es très bien.', 'happy']];
    return [cheers[i % cheers.length]];
  }

  // Nuit / heure du coucher dépassée
  if (nowAdj >= bed + 30 || now < Math.max(0, wake - 90)) add(`Il est tard${name}… Ton corps répare tout pendant le sommeil : pose le téléphone, on se retrouve demain 😴`, 'sleepy');
  else if (nowAdj >= bed - 60 && where !== 'sport') add(`Coucher visé à ${p.bedTime || '23:00'} : c’est le moment d’éteindre les écrans et de te détendre 🌙`, 'sleepy');

  if (where === 'home' || where === 'health') {
    if (s.todayOk) add(`Journée validée 🔥 Ta série passe à ${s.current} jour${s.current > 1 ? 's' : ''}. Je suis fière de toi !`, 'proud');
    else if (left > 0 && now >= 17 * 60 && s.current > 0) add(`Encore ${left} quête${left > 1 ? 's' : ''} et ta série de ${s.current} jours est sauvée. Tu peux le faire !`, 'cheer');
  }

  // Nuit passée (le matin)
  if (sm?.lastNight != null && now < 12 * 60 && ['home', 'health'].includes(where)) {
    if (sm.lastNight >= 7) add(`Belle nuit de ${hTxt(sm.lastNight)} ! Tu pars avec de l’énergie pour la journée ☀️`, 'cheer');
    else if (sm.lastNight < 6.5) add(`Nuit courte (${hTxt(sm.lastNight)})… Vas-y doucement aujourd’hui, et une sieste de 20 min avant 15 h si tu peux.`, 'oops');
  }

  if (where === 'home' || where === 'nutrition') {
    // repas selon l'heure
    if (now >= wake && now < 10.5 * 60 && !has('petit-dej')) add('Petit-déj noté ? Des protéines le matin, c’est moins de fringales dans la journée 🍳');
    else if (now >= 11.75 * 60 && now < 14.5 * 60 && !has('dejeuner')) add('C’est l’heure de déjeuner : moitié légumes, un quart protéines… et une photo pour que je fasse les calculs 📸');
    else if (now >= 19 * 60 && nowAdj < bed - 90 && !has('diner')) add('Pour le dîner, reste léger et pas trop tard : ton sommeil te dira merci 🍽️');
    if (tot.kcal > 0 && t.kcal) {
      const rest = Math.round(t.kcal - tot.kcal);
      if (rest > 150) add(`Il te reste environ ${rest} kcal pour aujourd’hui${tot.protein < t.protein * 0.6 && now > 14 * 60 ? `, et ${Math.round(t.protein - tot.protein)} g de protéines à aller chercher` : ''}.`);
      else if (rest < -250) add('Tu as dépassé ta cible du jour. Pas grave du tout : demain est un nouveau jour, sans compenser à l’excès 😉', 'oops');
      else add('Pile dans ta cible du jour, bravo 👏', 'proud');
    }
    if (tot.sugar > (t.sugarMax || 50)) add('Beaucoup de sucres aujourd’hui : pour la suite, un fruit entier plutôt qu’un biscuit ?', 'oops');
    if (where === 'nutrition' && !meals.length) add('Rien de noté encore : photographie ton prochain repas ou cherche un produit par son nom, je m’occupe du reste.');
    if (tot.fiber >= (t.fiber || 30)) add('Objectif fibres atteint, ton intestin est content 🥦', 'proud');
  }

  if (where === 'home' || where === 'health') {
    if (now >= 14 * 60 && now < 21 * 60 && water < (t.waterMl || 2000) * 0.4) add(`Seulement ${L(water)} L d’eau pour l’instant… Un grand verre maintenant ? 💧`);
    if (now >= 15 * 60 && nowAdj < bed - 90 && steps && steps < (t.steps || 8000) / 2) add(`${steps.toLocaleString('fr-FR')} pas pour l’instant : 15 min de marche et tu rattrapes une bonne partie 🚶`);
    if (steps >= (t.steps || 8000)) add(`${steps.toLocaleString('fr-FR')} pas aujourd’hui, objectif atteint 👟`, 'proud');
  }

  if (where === 'home' || where === 'sport') {
    if (doneW.length) add(`Séance faite aujourd’hui, bravo 🏆 Pense aux protéines au prochain repas pour bien récupérer.`, 'proud');
    else if (planned) add(`Ta séance du jour (${SP.activity(planned.type).label.toLowerCase()}, ${planned.minutes} min) t’attend. Je compte sur toi 💪`, 'cheer');
  }
  if (where === 'sport') {
    const w = SP.weekStats(st.workouts || [], st.days || {});
    if (w.modEq >= 150) add(`${w.modEq} min d’activité cette semaine : tu as dépassé les 150 min conseillées par l’OMS !`, 'proud');
    else if (w.modEq > 0) add(`${w.modEq} min cette semaine sur les 150 conseillées. Encore ${150 - w.modEq} min et c’est gagné.`, 'cheer');
    else add('Aucune séance cette semaine pour l’instant. Même 10 minutes comptent : on commence petit ?', 'happy');
  }

  if (where === 'health') {
    const wk = S.sleepWeek(st.days || {}, p, Array.from({ length: 7 }, (_, i) => store.dayKey(i - 6)));
    if (wk.noted >= 2 && wk.debt > 90) add(`Tu as environ ${Math.round(wk.debt / 60)} h de sommeil en retard sur la semaine. Ce soir, couche-toi 30 min plus tôt ?`, 'oops');
    else if (wk.noted >= 2) add('Ton sommeil de la semaine couvre ton besoin, c’est la base de tout 💤', 'proud');
    if (d.screenMin > 240) add(`${Math.round(d.screenMin / 60)} h d’écran aujourd’hui : une pause sans téléphone ferait du bien à ta tête 📵`, 'oops');
  }

  // Analyse des 7 jours
  if (['home', 'health'].includes(where)) {
    if (scores.global >= 80) add(`Score de ${scores.global} sur la semaine : tu es en feu${name} ! Continue comme ça.`, 'proud');
    else if (weakest && weakest[1] < 65) add(`Cette semaine, ton point à travailler, c’est ${PILLAR[weakest[0]]}. On s’y met ensemble, un petit pas à la fois ?`, 'happy');
  }

  // Tard le soir : plus de conseils à appliquer (manger, marcher, boire), seulement le sommeil et les félicitations.
  if (nowAdj >= bed - 60 && where !== 'guided') {
    const calm = out.filter(([, m]) => m === 'sleepy' || m === 'proud');
    if (calm.length) return calm;
  }

  // Phrases de secours selon le moment de la journée
  if (now < 12 * 60) add(`Bonjour${name} ! Une journée de plus pour prendre soin de toi ☀️`, 'cheer');
  else if (now < 18 * 60) add('Belle après-midi ! Une petite pause, quelques pas, un verre d’eau ?');
  else add(`Bonne soirée${name} ! Tu as fait de ton mieux aujourd’hui, c’est ça qui compte.`);
  return out;
}

// ---------- Diana en haut à gauche, sur tous les écrans ----------
// Elle parle dans une bulle à l'ouverture de l'appli et quand on la touche, puis la bulle s'efface.
let dock = null, ctxArgs = ['home'], turn = {}, hideT = 0, greeted = false, lastGreet = 0;

export function mount(slot, onOpenCoach) {
  dock = slot;
  dock.classList.add('diana-dock');
  dock.innerHTML = `<button class="dd-face" type="button" aria-label="Coach Diana : une nouvelle phrase">${face('happy', 66)}</button>
    <div class="dd-bubble" role="status" aria-live="polite"><span></span><button class="dd-chat" type="button">Discuter →</button></div>`;
  dock.querySelector('.dd-face').onclick = () => { turn[ctxArgs[0]] = (turn[ctxArgs[0]] || 0) + 1; sayCurrent(true); };
  dock.querySelector('.dd-bubble').onclick = (e) => { if (e.target.closest('.dd-chat')) { hide(); onOpenCoach?.(); } else hide(); };
}

// Pendant que la réponse s'écrit dans la discussion, Diana bouge la bouche.
export function talking(on) {
  const cv = dock?.querySelector('canvas');
  if (!cv) return;
  const o = orbOf(cv);
  o.talking = on;
  wake();
}

// Écran affiché : ses phrases (et dès la première fois, un petit bonjour).
export function context(where, st, sm, extra) {
  ctxArgs = [where, st, sm, extra];
  if (!greeted) { greeted = true; greet(1900); } // après l'animation de lancement
}

// Onglet courant : pas de bulle sur l'écran de discussion (c'est déjà elle qui parle).
export function setTab(tab) {
  if (!dock) return;
  dock.classList.toggle('in-chat', tab === 'coach');
  if (tab === 'coach') hide();
}

// Bonjour à l'ouverture (ou au retour dans l'appli après 10 min d'absence), quand aucune fenêtre n'est ouverte.
export function greet(delay = 900, { again = false, tries = 6 } = {}) {
  if (again && Date.now() - lastGreet < 10 * 60e3) return;
  lastGreet = Date.now();
  setTimeout(() => {
    if (!dock || dock.classList.contains('in-chat')) return;
    if (document.querySelector('.sheet-root')) { if (tries) greet(1500, { tries: tries - 1 }); return; }
    sayCurrent(false, true);
  }, delay);
}

function sayCurrent(spin, hello = false) {
  const [where, st, sm, extra] = ctxArgs;
  const all = lines(where, st || store.get(), sm, extra);
  let [text, mood] = all[(turn[where] || 0) % all.length];
  // À l'ouverture, elle salue d'abord (elle remplace le « Bonjour Pierre » de l'en-tête).
  if (hello && !/^(bonjour|bonsoir|bonne|salut|il est tard)/i.test(text)) {
    const h = new Date().getHours(), name = (st || store.get()).profile?.name;
    text = `${h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir'}${name ? ' ' + name : ''} ! ${text}`;
  }
  say(text, mood, { spin, ms: hello ? 7000 : undefined });
}

export function say(text, mood = 'happy', { ms, spin = false } = {}) {
  if (!dock) return;
  if (dock.classList.contains('in-chat')) { const o = orbOf(dock.querySelector('canvas')); o.spinAt = spin ? performance.now() / 1000 : o.spinAt; wake(); return; }
  const bubble = dock.querySelector('.dd-bubble');
  bubble.querySelector('span').textContent = text;
  // la bulle prend la place libre de l'en-tête, entre Diana et les boutons de droite
  const right = document.querySelector('#streak-btn')?.getBoundingClientRect().left || innerWidth - 16;
  const left = dock.getBoundingClientRect().right + 6;
  bubble.style.setProperty('--bw', `${Math.max(170, Math.round(right - left - 8))}px`);
  bubble.classList.remove('on', 'tall'); void bubble.offsetWidth;
  // texte long : la bulle s'ouvre vers le bas plutôt que de déborder au-dessus de l'écran
  if (bubble.offsetHeight > 76) bubble.classList.add('tall');
  bubble.classList.add('on');
  dock.closest('.top')?.classList.add('speaking');
  const o = orbOf(dock.querySelector('canvas'));
  o.mood = mood;
  const now = performance.now() / 1000;
  o.talkUntil = now + Math.min(2.2, 0.5 + text.length / 45);
  if (spin) o.spinAt = now;
  wake();
  clearTimeout(hideT);
  hideT = setTimeout(hide, ms || Math.min(8000, Math.max(3800, 1800 + text.length * 55)));
}

function hide() {
  clearTimeout(hideT);
  dock?.querySelector('.dd-bubble').classList.remove('on');
  dock?.closest('.top')?.classList.remove('speaking');
  setTimeout(() => { const o = dock && orbOf(dock.querySelector('canvas')); if (o && !dock.querySelector('.dd-bubble.on')) o.mood = 'happy'; }, 400);
}

// Petite réaction de Diana (repas ajouté, séance terminée…).
export function pop(text, mood = 'proud', ms) { say(text, mood, { ms, spin: true }); }

// Version compacte dans le mode guidé du sport : hauteur fixe, une autre phrase au toucher.
export function inline(where, st, sm, extra) {
  const all = lines(where, st, sm, extra);
  const [text, mood] = all[(turn[where] || 0) % all.length];
  return `<div class="diana-inline" data-diana-inline="${where}">${face(mood, 40)}<span>${text}</span></div>`;
}
export function bindInline(root, where, st, sm, extra) {
  const el = root.querySelector(`[data-diana-inline="${where}"]`);
  if (!el) return;
  el.onclick = () => {
    turn[where] = (turn[where] || 0) + 1;
    const all = lines(where, st, sm, extra);
    const [text, mood] = all[turn[where] % all.length];
    el.querySelector('span').textContent = text;
    const o = orbOf(el.querySelector('canvas'));
    o.mood = mood; o.spinAt = performance.now() / 1000; wake();
  };
}

// Réaction à un repas ajouté.
export function mealReaction(m) {
  if (m.verdict === 'bon') return ['Super choix 👌 Ton corps te remercie !', 'proud'];
  if (m.verdict === 'a_limiter') return ['C’est noté ! Rien n’est interdit : équilibre simplement avec des légumes au prochain repas 😉', 'oops'];
  if (m.snack) return ['Noté ! Un grignotage de temps en temps, ça arrive à tout le monde.', 'happy'];
  return ['Repas noté, merci ! Plus tu notes, plus mes conseils sont précis 📈', 'happy'];
}
