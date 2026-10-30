// Coach Diana : petit smiley en 3D avec un bandeau éponge, qui encourage un peu partout dans l'appli.
// Ses phrases dépendent de l'heure, de ce qui a déjà été fait dans la journée (repas, eau, pas, séance, nuit)
// et de l'analyse des 7 derniers jours (score, pilier le plus faible).
import * as store from './store.js';
import * as S from './science.js';
import * as G from './gamify.js';
import * as SP from './sport.js';

let uid = 0;

// Visage en SVG : sphère bleu nuit éclairée de l'intérieur, deux anneaux lumineux, grands yeux pâles,
// sourire en trait fin et bandeau de sport discret dans les mêmes tons.
// mood : happy | cheer (grand sourire) | proud (clin d'œil) | sleepy (yeux fermés) | oops (bouche hésitante)
export function face(mood = 'happy', size = 56) {
  const id = `dn${++uid}`;
  const eye = (x) => mood === 'sleepy' || (mood === 'proud' && x > 50)
    ? `<path d="M${x - 6} 47 q6 4.5 12 0" stroke="#d6e4f5" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${x}" cy="45" rx="8.6" ry="9.6" fill="url(#${id}e)"/><circle class="diana-pupil" cx="${x + 0.6}" cy="45.8" r="4" fill="#5b6b80"/>`;
  const mouth = {
    happy: '<path d="M39 64 Q50 68.5 61 64" stroke="#dbe7f6" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
    proud: '<path d="M38 62.5 Q50 70 62 62.5" stroke="#dbe7f6" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
    cheer: '<path d="M37 61 Q50 74 63 61" stroke="#dbe7f6" stroke-width="3" fill="none" stroke-linecap="round"/>',
    sleepy: '<path d="M44 65 Q50 66.5 56 65" stroke="#dbe7f6" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    oops: '<path d="M40 66 Q45 62.5 50 65.5 T60 64" stroke="#dbe7f6" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
  }[mood] || '';
  return `<svg class="diana-svg mood-${mood}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="${id}b" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="#2f5684"/><stop offset=".55" stop-color="#1b3254"/><stop offset="1" stop-color="#101c33"/></radialGradient>
      <radialGradient id="${id}e" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#f4f8fd"/><stop offset="1" stop-color="#c3d3e6"/></radialGradient>
      <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa3cc" stop-opacity=".55"/><stop offset="1" stop-color="#4d6f99" stop-opacity=".55"/></linearGradient>
      <clipPath id="${id}c"><circle cx="50" cy="50" r="38"/></clipPath>
    </defs>
    <circle class="diana-ring" cx="50" cy="50" r="47" fill="none" stroke="#8394ad" stroke-opacity=".55" stroke-width="1.6"/>
    <g class="diana-head">
      <circle cx="50" cy="50" r="40" fill="url(#${id}b)"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#8b9bb3" stroke-opacity=".7" stroke-width="1.6"/>
      <g clip-path="url(#${id}c)">
        <path d="M8 24 Q50 10 92 24 L92 31 Q50 17 8 31 Z" fill="url(#${id}h)"/>
        <path d="M8 27.5 Q50 13.5 92 27.5" stroke="#dbe7f6" stroke-opacity=".5" stroke-width="1" fill="none"/>
      </g>
      <g class="diana-eyes">${eye(36)}${eye(64)}</g>
      ${mouth}
    </g>
  </svg>`;
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
    if (now >= 15 * 60 && steps && steps < (t.steps || 8000) / 2) add(`${steps.toLocaleString('fr-FR')} pas pour l’instant : 15 min de marche et tu rattrapes une bonne partie 🚶`);
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

  // Phrases de secours selon le moment de la journée
  if (now < 12 * 60) add(`Bonjour${name} ! Une journée de plus pour prendre soin de toi ☀️`, 'cheer');
  else if (now < 18 * 60) add('Belle après-midi ! Une petite pause, quelques pas, un verre d’eau ?');
  else add(`Bonne soirée${name} ! Tu as fait de ton mieux aujourd’hui, c’est ça qui compte.`);
  return out;
}

// Décalage choisi au toucher (une autre phrase à chaque appui).
const turn = {};

// Bulle de Diana : visage + phrase. Toucher le visage ou la bulle = phrase suivante.
export function card(where, st, sm, extra) {
  const all = lines(where, st, sm, extra);
  const [text, mood] = all[(turn[where] || 0) % all.length];
  return `<div class="diana" data-diana="${where}" role="button" aria-label="Coach Diana : ${text.replace(/"/g, '&quot;')}">
    <span class="diana-face">${face(mood, 60)}</span>
    <div class="diana-bubble"><b>Coach Diana</b><span>${text}</span></div>
  </div>`;
}

export function bind(root, where, st, sm, extra) {
  const el = root.querySelector(`[data-diana="${where}"]`);
  if (!el) return;
  el.onclick = () => {
    turn[where] = (turn[where] || 0) + 1;
    const fresh = document.createElement('div');
    fresh.innerHTML = card(where, st, sm, extra);
    const n = fresh.firstElementChild;
    n.classList.add('diana-pop');
    el.replaceWith(n);
    bind(n.parentElement, where, st, sm, extra);
  };
}

// Petite apparition de Diana en bas de l'écran (repas ajouté, séance terminée…).
export function pop(text, mood = 'proud', ms = 3600) {
  document.querySelector('.diana-float')?.remove();
  const el = document.createElement('div');
  el.className = 'diana-float';
  el.innerHTML = `<span class="diana-face">${face(mood, 46)}</span><div class="diana-bubble"><b>Coach Diana</b><span>${text}</span></div>`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms);
}

// Réaction à un repas ajouté.
export function mealReaction(m) {
  if (m.verdict === 'bon') return ['Super choix 👌 Ton corps te remercie !', 'proud'];
  if (m.verdict === 'a_limiter') return ['C’est noté ! Rien n’est interdit : équilibre simplement avec des légumes au prochain repas 😉', 'oops'];
  if (m.snack) return ['Noté ! Un grignotage de temps en temps, ça arrive à tout le monde.', 'happy'];
  return ['Repas noté, merci ! Plus tu notes, plus mes conseils sont précis 📈', 'happy'];
}
