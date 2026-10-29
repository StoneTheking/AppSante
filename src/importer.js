// Import CSV : format générique de l'app, ou export Google Fit (Takeout « Daily activity metrics »).
const ALIASES = {
  date: ['date', 'jour', 'day'],
  steps: ['steps', 'pas', 'step count', 'nombre de pas'],
  modMin: ['modmin', 'move minutes count', 'minutes actives', 'active minutes', 'minutes d\'activité'],
  vigMin: ['vigmin', 'heart points', 'minutes intenses'],
  strengthMin: ['strengthmin', 'musculation'],
  screenMin: ['screenmin', 'screen time', 'temps d\'écran', "temps d'ecran"],
  socialMin: ['socialmin', 'réseaux sociaux', 'social'],
  unlocks: ['unlocks', 'déverrouillages', 'deverrouillages'],
  bed: ['bed', 'coucher', 'bedtime'],
  wake: ['wake', 'réveil', 'reveil', 'waketime'],
  sleepQuality: ['sleepquality', 'qualité sommeil'],
  mood: ['mood', 'humeur'],
  energy: ['energy', 'énergie', 'energie'],
  stress: ['stress'],
  weight: ['weight', 'poids', 'average weight (kg)'],
};

function splitLine(line, sep) {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Renvoie { 'AAAA-MM-JJ': { champ: valeur } }
export function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return {};
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitLine(lines[0], sep).map((h) => h.toLowerCase());
  const map = header.map((h) => Object.keys(ALIASES).find((k) => ALIASES[k].some((a) => h === a || h.startsWith(a))));
  const out = {};
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep);
    const row = {};
    map.forEach((k, i) => {
      if (!k || cells[i] === '' || cells[i] == null) return;
      row[k] = ['bed', 'wake', 'date'].includes(k) ? cells[i] : Number(cells[i].replace(',', '.'));
    });
    if (!row.date) continue;
    const m = row.date.match(/(\d{4})-(\d{2})-(\d{2})/) || row.date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) continue;
    const key = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
    delete row.date;
    for (const k of Object.keys(row)) if (Number.isNaN(row[k])) delete row[k];
    out[key] = row;
  }
  return out;
}

export const CSV_TEMPLATE = 'date;steps;modMin;vigMin;strengthMin;screenMin;socialMin;unlocks;bed;wake;sleepQuality;mood;energy;stress;weight\n2026-10-28;8200;35;10;30;190;45;70;23:30;07:10;4;4;3;2;72.5\n';
