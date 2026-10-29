// Emploi du temps : horaires de travail, créneaux occupés de l'agenda, meilleur moment pour le sport, export agenda.
// Repères : planifier quand/où faire son sport augmente l'activité (Bélanger-Gravel 2013) ; performances maximales
// en fin d'après-midi (Knaier 2021) mais la régularité prime (Bruggisser 2023) ; pas d'effort intense < 1 h avant
// le coucher (Stutz 2019) ; éviter les pics de pollution et de chaleur (Sinharay 2018, Ebi 2021).

export const toMin = (hhmm) => { const [h, m] = (hhmm || '00:00').split(':').map(Number); return h * 60 + m; };
export const hm = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export const DEFAULT_WORK = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:30', commute: 30, enabled: false };

// Créneaux occupés d'une journée (minutes depuis minuit) : travail + trajets + événements d'agenda.
export function busyBlocks(date, work, calEvents = []) {
  const blocks = [];
  const dow = date.getDay();
  if (work?.enabled && work.days.includes(dow)) blocks.push({ from: toMin(work.start) - (work.commute || 0), to: toMin(work.end) + (work.commute || 0), label: 'Travail' });
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  for (const e of calEvents) {
    if (e.allDay) continue;
    const s = (new Date(e.start) - dayStart) / 60000, en = (new Date(e.end) - dayStart) / 60000;
    if (en > 0 && s < 1440) blocks.push({ from: Math.max(0, s), to: Math.min(1440, en), label: e.title || 'Agenda' });
  }
  return blocks.sort((a, b) => a.from - b.from);
}

const free = (start, dur, busy) => busy.every((b) => start + dur + 10 <= b.from || start >= b.to + 10);

// Meilleur créneau pour une séance : renvoie { start, label, why[] } ou null.
export function suggestSlot({ date = new Date(), duration = 30, intensity = 'moderee', wake = '07:00', bed = '23:00', busy = [], pref = 'auto', usualHour = null, env = null }) {
  const w = toMin(wake);
  let b = toMin(bed); if (b <= w) b += 1440;
  const latest = b - (intensity === 'intense' ? 120 : 75) - duration; // fin de séance ≥ 1–2 h avant le coucher
  const earliest = w + 45;
  const cands = [];
  for (let t = Math.ceil(earliest / 15) * 15; t <= latest; t += 15) if (free(t, duration, busy)) cands.push(t);
  if (!cands.length) return null;
  const hourAir = (t) => env?.hours?.find((h) => h.hour === Math.floor(t / 60));
  const score = (t) => {
    let s = 0;
    const h = t / 60;
    if (h >= 16 && h <= 19.5) s += 3; // pic de performance (fin d'après-midi)
    if (pref === 'matin' && h < 10) s += 6;
    if (pref === 'midi' && h >= 11.5 && h <= 14) s += 6;
    if (pref === 'soir' && h >= 17) s += 6;
    if (usualHour != null) s += Math.max(0, 4 - Math.abs(h - usualHour)); // régularité
    const a = hourAir(t);
    if (a) { s -= Math.max(0, (a.aqi ?? 0) - 40) / 10; s -= Math.max(0, a.temp - 27) * 0.6; s -= (a.rain || 0) / 40; }
    if (busy.some((x) => Math.abs(t - x.to) < 30 || Math.abs(t + duration - x.from) < 30)) s -= 1; // pas collé à un rendez-vous
    return s;
  };
  const start = cands.reduce((a, c) => (score(c) > score(a) ? c : a));
  const why = [];
  const workBlock = busy.find((x) => x.label === 'Travail');
  if (workBlock) why.push(start < workBlock.from ? 'avant le travail' : start >= workBlock.to ? 'après le travail' : 'pendant ta pause');
  if (usualHour != null && Math.abs(start / 60 - usualHour) <= 1) why.push('à ton heure habituelle (la régularité aide à ancrer l’habitude)');
  else if (start / 60 >= 16 && start / 60 <= 19.5) why.push('en fin d’après-midi, quand force et endurance sont au plus haut');
  const a = hourAir(start);
  if (a && env.aqi > 40) why.push(`air le plus propre de la journée (indice ${Math.round(a.aqi)})`);
  return { start, label: hm(start), why };
}

// Heure habituelle des séances (médiane des 20 dernières), pour favoriser la régularité.
export function usualHour(workouts) {
  const hs = workouts.slice(-20).map((w) => { const d = new Date(w.start); return d.getHours() + d.getMinutes() / 60; }).sort((a, b) => a - b);
  return hs.length >= 3 ? hs[Math.floor(hs.length / 2)] : null;
}

// ---------- Export agenda ----------
const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

export function googleCalendarUrl({ title, start, end, details = '' }) {
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(start)}/${icsDate(end)}&details=${encodeURIComponent(details)}`;
}

export function toIcs(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AppSante//Seances//FR', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid || crypto.randomUUID()}@appsante`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`, `SUMMARY:${icsEsc(e.title)}`, `DESCRIPTION:${icsEsc(e.details || '')}`, 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.title)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
