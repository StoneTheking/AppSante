// Réponses instantanées du coach, calculées sur le téléphone à partir des données de l'appli (sans IA ni réseau) :
// sport du jour, repas à venir, priorités de la semaine, sommeil. L'IA reste proposée pour approfondir.
import * as C from './coach.js';
import * as SP from './sport.js';

const INTENS = { legere: 'légère', moderee: 'modérée', intense: 'soutenue' };
const SLOT_NAME = { 'petit-dej': 'petit-déjeuner', dejeuner: 'déjeuner', collation: 'goûter', diner: 'dîner' };
const short = (q) => q.length <= 70;

function sport(sm, profile) {
  const s = C.sportOfDay(sm, profile);
  const when = C.dailyPlan(sm, profile).find((p) => p.icon === '🏃');
  const a = SP.activity(s.type);
  const reasons = s.why.length ? s.why : sm.sportToday?.type ? [`C’est la séance prévue dans ta semaine type.`] : [];
  return `**${a.label}**, ${s.minutes} min, intensité ${INTENS[s.intensity]}${when?.time && !when.done ? `, idéalement vers **${when.time}**` : ''}.\n\n${reasons.map((r) => `- ${r}`).join('\n')}${when?.text && !when.done ? `\n- ${when.text.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')}` : ''}\n\nLa séance détaillée (exercices animés en 3D, mode guidé) est dans l’onglet **Sport**.`;
}

function meal(sm, profile, taste, q) {
  const slot = /soir|dîner|diner/i.test(q) ? 'diner' : /midi|déj|dej/i.test(q) && !/petit/i.test(q) ? 'dejeuner' : /petit|matin/i.test(q) ? 'petit-dej' : /goûter|gouter|collation|faim/i.test(q) ? 'collation' : C.currentSlot();
  const list = C.mealSuggestions(sm, profile, slot, taste);
  if (!list.length) return null;
  const left = Math.max(0, sm.t.kcal - sm.totToday.kcal);
  return `Pour ton **${SLOT_NAME[slot]}**${sm.totToday.kcal && left >= Math.min(...list.map((m) => m.kcal)) ? ` (il te reste environ ${Math.round(left)} kcal aujourd’hui)` : sm.totToday.kcal ? ' (ta cible du jour est presque atteinte : prends une petite portion)' : ''} :\n\n${list.map((m) => `- **${m.name}** · ${Math.round(m.kcal)} kcal, ${Math.round(m.protein)} g de protéines${m.why.length ? ` · ${m.why.slice(0, 2).join(', ')}` : ''}`).join('\n')}\n\nRecettes et liste de courses dans l’onglet **Nutrition**.`;
}

function priorities(sm) {
  const rank = { alerte: 0, attention: 1 };
  const top = C.insights(sm).filter((x) => x.level in rank).sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 3);
  if (!top.length) return 'Rien d’alarmant cette semaine 👏 Sommeil, activité et alimentation sont dans les repères. Continue comme ça, et garde la régularité des horaires de coucher.';
  return `Tes 3 priorités cette semaine :\n\n${top.map((x, i) => `${i + 1}. **${x.title}** : ${x.text}`).join('\n')}`;
}

function sleep(sm, profile) {
  const w = sm.w;
  const tips = [];
  if (w.sleepH != null) tips.push(`Tu dors **${Math.floor(w.sleepH)} h ${String(Math.round((w.sleepH % 1) * 60)).padStart(2, '0')}** en moyenne (repère : 7 à 9 h).`);
  if (w.bedVar != null && w.bedVar > 45) tips.push(`Ton heure de coucher varie de ±${Math.round(w.bedVar)} min : vise **${profile.bedTime}** tous les soirs, week-end compris. La régularité compte autant que la durée.`);
  if (w.phoneInBedDays >= 2) tips.push(`Téléphone au lit ${w.phoneInBedDays} soirs sur 7 : laisse-le hors de la chambre (réveil classique), c’est l’un des leviers les plus efficaces.`);
  if (sm.lateMeals >= 2) tips.push('Dîne au moins 2 à 3 h avant le coucher, et un repas léger le soir.');
  tips.push('Lumière du jour le matin (10–30 min dehors) pour caler ton horloge interne.');
  tips.push('Caféine : pas après 14 h. Alcool : il raccourcit le sommeil profond.');
  tips.push(`Chambre fraîche (17–19 °C), sombre et calme ; 30 min sans écran avant **${profile.bedTime}**.`);
  return tips.map((t) => `- ${t}`).join('\n');
}

// Renvoie une réponse en Markdown, ou null si la question demande vraiment l'IA.
export function instantAnswer(q, { sm, profile, taste }) {
  const t = q.trim();
  if (!short(t)) return null;
  try {
    if (/(quel|quelle|quoi).*(sport|séance|seance|entraîn|entrain|activité)|sport.*(aujourd|quelle heure)/i.test(t)) return sport(sm, profile);
    if (/(que|quoi|qu.est-ce que).*(manger|cuisiner)|idée.*(repas|dîner|diner|déj)/i.test(t)) return meal(sm, profile, taste, t);
    if (/priorit|analyse ma semaine|bilan.*semaine/i.test(t)) return priorities(sm);
    if (/mieux dormir|bien dormir|sommeil.*(améliorer|ameliorer|conseil)/i.test(t)) return sleep(sm, profile);
  } catch { return null; }
  return null;
}
