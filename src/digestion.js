// Transit : échelle de Bristol (Lewis & Heaton 1997) et repérage des aliments mal tolérés.
import { tokens } from './family.js';

export const BRISTOL = [
  { type: 1, label: 'Petites billes dures', meaning: 'Constipation sévère', zone: 'lent' },
  { type: 2, label: 'Saucisse grumeleuse', meaning: 'Constipation légère', zone: 'lent' },
  { type: 3, label: 'Saucisse craquelée', meaning: 'Normal', zone: 'ok' },
  { type: 4, label: 'Lisse et molle', meaning: 'Idéal', zone: 'ok' },
  { type: 5, label: 'Morceaux mous', meaning: 'Manque de fibres', zone: 'rapide' },
  { type: 6, label: 'Pâteuse', meaning: 'Diarrhée légère', zone: 'rapide' },
  { type: 7, label: 'Liquide', meaning: 'Diarrhée', zone: 'rapide' },
];

export const isBad = (s) => s.bristol <= 2 || s.bristol >= 6 || (s.pain || 0) >= 2 || (s.bloating || 0) >= 2;

// Fenêtre de transit : repas pris entre 8 h et 48 h avant la selle (transit médian ~1 jour, Asnicar 2021).
const WIN_MIN = 8 * 3600e3, WIN_MAX = 48 * 3600e3;
const mealTime = (m) => new Date(`${m.date}T${m.time || '12:00'}`).getTime();

// Repère les aliments plus souvent suivis de selles anormales ou de symptômes.
// Chaque repas est pondéré selon son délai : maximal vers 24 h (transit médian), faible aux bords de la fenêtre.
const weight = (hours) => Math.exp(-(((hours - 24) / 14) ** 2) / 2);
export function suspects(stools, meals) {
  const stats = new Map(); // mot → { bad, total (comptes), wBad, wAll (pondérés) }
  for (const s of stools) {
    const t = new Date(s.at).getTime();
    const bad = isBad(s);
    const seen = new Map();
    for (const m of meals) {
      const d = t - mealTime(m);
      if (d < WIN_MIN || d > WIN_MAX) continue;
      const w = weight(d / 3600e3);
      for (const word of tokens(m.title + ' ' + (m.items || []).map((i) => i.name).join(' '))) seen.set(word, Math.max(seen.get(word) || 0, w));
    }
    for (const [word, w] of seen) {
      const cur = stats.get(word) || { word, bad: 0, total: 0, wBad: 0, wAll: 0 };
      cur.total++;
      cur.wAll += w;
      if (bad) { cur.bad++; cur.wBad += w; }
      stats.set(word, cur);
    }
  }
  const badRate = stools.length ? stools.filter(isBad).length / stools.length : 0;
  return [...stats.values()]
    .map((x) => ({ ...x, rate: x.wAll ? x.wBad / x.wAll : 0 }))
    .filter((x) => x.bad >= 2 && x.rate > Math.max(0.5, badRate + 0.15))
    .sort((a, b) => b.rate - a.rate || b.bad - a.bad)
    .slice(0, 6);
}

// Synthèse sur 14 jours (fréquence, répartition Bristol) et conseils sourcés.
export function digestionSummary(stools, now = new Date()) {
  const recent = stools.filter((s) => now - new Date(s.at) < 14 * 86400e3);
  if (!recent.length) return null;
  const perWeek = recent.length / 2;
  const zones = { lent: 0, ok: 0, rapide: 0 };
  recent.forEach((s) => zones[BRISTOL[s.bristol - 1].zone]++);
  const advice = [];
  if (perWeek < 3) advice.push({ level: 'attention', text: `${perWeek.toLocaleString('fr-FR')} selle(s)/semaine : en dessous de la normale (3/semaine à 3/jour). Augmente fibres, eau et activité physique.`, src: ['heaton1992', 'reynolds2019'] });
  if (zones.lent / recent.length > 0.4) advice.push({ level: 'attention', text: 'Selles souvent dures (types 1–2) : transit lent. Fibres (fruits, légumes, légumineuses, céréales complètes), 1,5–2 L d’eau, marche quotidienne.', src: ['lewis1997', 'reynolds2019'] });
  if (zones.rapide / recent.length > 0.4) advice.push({ level: 'attention', text: 'Selles souvent molles ou liquides (types 6–7) : transit rapide. Repère les aliments suspects ci-dessous ; si cela persiste, parles-en à un médecin.', src: ['lewis1997', 'halmos2014'] });
  if (zones.ok / recent.length >= 0.6) advice.push({ level: 'bon', text: 'Selles majoritairement de type 3–4 : transit idéal.', src: ['lewis1997', 'vandeputte2016'] });
  const alarm = recent.some((s) => s.blood);
  if (alarm) advice.unshift({ level: 'alerte', text: 'Sang dans les selles signalé : consulte un médecin rapidement.', src: [] });
  return { count: recent.length, perWeek, zones, advice };
}
