// Dépense énergétique du jour et poids estimé à partir des repas notés.
// Marche : ~0,5 kcal par kg et par 1000 pas au-delà du métabolisme de repos (≈ 35 kcal/1000 pas à 70 kg, d'après les MET du Compendium, Herrmann 2024).
// Bilan → poids : ~7700 kcal par kg sur quelques semaines ; au-delà le corps s'adapte et la règle surestime (Hall 2011).
import * as S from './science.js';

export const stepsKcal = (steps, kg = 70) => Math.round(((steps || 0) / 1000) * 0.5 * kg);

// Calories brûlées par l'activité : pas + séances (sans compter deux fois la marche enregistrée en séance).
export function activeKcal(day = {}, workouts = [], kg = 70) {
  // calories actives mesurées par Samsung Health / la montre (séances comprises) : prioritaires sur l'estimation
  if (day.activeKcalHC) return day.activeKcalHC;
  const w = workouts.reduce((a, x) => a + (x.kcal || 0), 0);
  const walkMin = workouts.filter((x) => ['marche', 'randonnee', 'course'].includes(x.type)).reduce((a, x) => a + x.minutes, 0);
  const steps = Math.max(0, (day.steps || 0) - walkMin * 110); // ~110 pas/min déjà comptés dans la séance
  return stepsKcal(steps, kg) + w;
}

// Dépense totale d'une journée : repos (Mifflin) × 1,2 + activité mesurée + effet thermique des aliments (10 %).
export function dayExpenditure(profile, day, workouts, intakeKcal) {
  const b = S.bmr(profile);
  if (!b) return null;
  const measured = day && (day.steps || workouts.length);
  if (!measured) return S.tdee(profile);
  return b * 1.2 + activeKcal(day, workouts, profile.weight || 70) + 0.1 * (intakeKcal || 0);
}

// Série « poids estimé » depuis la première pesée de la période, et comparaison avec les pesées réelles.
// Les jours sans repas notés (< 800 kcal) sont supposés à l'équilibre et signalés comme incertains.
export function weightEstimate(st, days = 60, now = new Date()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); keys.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)); }
  const real = [...st.weights].filter((w) => w.date >= keys[0]).sort((a, b) => a.date.localeCompare(b.date));
  const startW = real[0] || (st.profile.weight ? { date: keys[0], kg: st.profile.weight } : null);
  if (!startW) return null;
  let kg = startW.kg, logged = 0, total = 0, balSum = 0;
  const est = [];
  for (const k of keys.filter((x) => x >= startW.date)) {
    const meals = st.meals.filter((m) => m.date === k);
    const intake = S.sumNutrients(meals).kcal;
    const ws = st.workouts.filter((w) => w.date === k);
    total++;
    if (intake >= 800) {
      const exp = dayExpenditure({ ...st.profile, weight: kg }, st.days[k], ws, intake);
      if (exp) { const bal = intake - exp; kg += bal / 7700; balSum += bal; logged++; }
    }
    est.push({ t: new Date(k + 'T12:00').getTime(), v: Math.round(kg * 100) / 100 });
  }
  const lastReal = real.at(-1);
  const estAtLast = lastReal ? est.find((p) => new Date(p.t).toISOString().slice(0, 10) === lastReal.date)?.v : null;
  const gap = lastReal && estAtLast != null && lastReal.date !== startW.date ? Math.round((lastReal.kg - estAtLast) * 10) / 10 : null;
  const span = lastReal ? Math.max(1, (new Date(lastReal.date) - new Date(startW.date)) / 86400e3) : 1;
  return {
    start: startW,
    est,
    real: real.map((w) => ({ t: new Date(w.date + 'T12:00').getTime(), v: w.kg })),
    gap, // réel − estimé (kg) à la dernière pesée
    gapKcalPerDay: gap != null ? Math.round((gap * 7700) / span) : null,
    coverage: total ? logged / total : 0,
    avgBalance: logged ? Math.round(balSum / logged) : null,
  };
}

// Prochaine pesée conseillée : toutes les 2 semaines.
export function weighDue(st, now = new Date()) {
  const last = [...st.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!last) return { due: true, days: null };
  const days = Math.floor((now - new Date(last.date + 'T12:00')) / 86400e3);
  return { due: days >= 14, days, last };
}
