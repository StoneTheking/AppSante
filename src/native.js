// Ponts vers l'application Android native (Capacitor) : Health Connect et statistiques d'utilisation.
// Dans le navigateur, isNative est faux et ces fonctions ne sont pas proposées.
import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

// Plugin maison (android/app/src/main/java/.../UsageStatsPlugin.java)
const UsageStats = registerPlugin('UsageStats');

const HEALTH_READ = ['steps', 'sleep', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'weight', 'calories', 'workouts'];

async function health() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

export async function healthStatus() {
  if (!isNative) return { available: false, reason: 'web' };
  const H = await health();
  return H.isAvailable();
}

export async function connectHealth() {
  const H = await health();
  const a = await H.isAvailable();
  if (!a.available) throw new Error('Health Connect n’est pas disponible. Installe « Health Connect » depuis le Play Store (inclus d’office depuis Android 14).');
  return H.requestAuthorization({ read: HEALTH_READ });
}

export const openHealthSettings = async () => (await health()).openHealthConnectSettings();

const localKey = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const hhmm = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const STRENGTH = /strength|weight|calisthenics|crossTraining|bootCamp|benchPress|deadlift|lunge|plank|pilates|coreTraining/i;
const VIGOROUS = /running|highIntensity|hiit|swimming|rowing|boxing|kickboxing|martialArts|squash|soccer|basketball|tennis|jumpRope|stairClimbing|crossCountry|cycling/i;

// Lit les N derniers jours depuis Health Connect et renvoie { 'AAAA-MM-JJ': {...} }.
export async function syncHealth(days = 7) {
  const H = await health();
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const range = { startDate: start.toISOString(), endDate: end.toISOString() };
  const out = {};
  const day = (k) => (out[k] ||= {});
  const safe = (p) => p.catch(() => null);

  const [steps, rhr, hrv, weight, sleep, workouts] = await Promise.all([
    safe(H.queryAggregated({ dataType: 'steps', ...range, bucket: 'day', aggregation: 'sum' })),
    safe(H.queryAggregated({ dataType: 'restingHeartRate', ...range, bucket: 'day', aggregation: 'average' })),
    safe(H.queryAggregated({ dataType: 'heartRateVariability', ...range, bucket: 'day', aggregation: 'average' })),
    safe(H.readSamples({ dataType: 'weight', ...range, limit: 50 })),
    safe(H.readSamples({ dataType: 'sleep', startDate: new Date(start.getTime() - 12 * 3600e3).toISOString(), endDate: end.toISOString(), limit: 500 })),
    safe(H.queryWorkouts({ ...range, limit: 200 })),
  ]);

  for (const s of steps?.samples || []) if (s.value) day(localKey(new Date(s.startDate))).steps = Math.round(s.value);
  for (const s of rhr?.samples || []) if (s.value) day(localKey(new Date(s.startDate))).restingHR = Math.round(s.value);
  for (const s of hrv?.samples || []) if (s.value) day(localKey(new Date(s.startDate))).hrv = Math.round(s.value);
  for (const s of weight?.samples || []) day(localKey(new Date(s.startDate))).weight = Math.round(s.value * 10) / 10;

  // Sommeil : on rattache chaque session au jour du réveil ; durée = temps endormi (hors éveil / au lit).
  const byWake = {};
  for (const s of sleep?.samples || []) {
    const k = localKey(new Date(s.endDate));
    const g = (byWake[k] ||= { start: s.startDate, end: s.endDate, asleep: 0 });
    if (s.startDate < g.start) g.start = s.startDate;
    if (s.endDate > g.end) g.end = s.endDate;
    if (!['awake', 'inBed'].includes(s.sleepState)) g.asleep += s.value || (new Date(s.endDate) - new Date(s.startDate)) / 60000;
  }
  for (const [k, g] of Object.entries(byWake)) {
    if (new Date(g.end) - new Date(g.start) < 3 * 3600e3) continue; // ignore les siestes
    Object.assign(day(k), { bed: hhmm(g.start), wake: hhmm(g.end), sleepMinutes: Math.round(g.asleep) });
  }

  for (const w of workouts?.workouts || []) {
    const k = localKey(new Date(w.startDate));
    const min = Math.round((w.duration || 0) / 60);
    const field = STRENGTH.test(w.workoutType) ? 'strengthMin' : VIGOROUS.test(w.workoutType) ? 'vigMin' : 'modMin';
    day(k)[field] = (day(k)[field] || 0) + min;
  }
  return out;
}

// ---------- Bien-être numérique (UsageStatsManager) ----------
export const usagePermission = () => UsageStats.hasPermission().then((r) => r.granted);
export const openUsageSettings = () => UsageStats.openSettings();

// Renvoie { 'AAAA-MM-JJ': { screenMin, socialMin, unlocks, lateMin, phoneInBed, topApps } }
export async function syncUsage(days = 7, bedTime = '23:00') {
  const { days: list } = await UsageStats.getDaily({ days });
  const [bh, bm] = bedTime.split(':').map(Number);
  const out = {};
  for (const d of list) {
    out[d.date] = {
      screenMin: Math.round(d.totalMs / 60000),
      socialMin: Math.round(d.socialMs / 60000),
      unlocks: d.unlocks,
      lateMin: Math.round(d.lateMs / 60000),
      // usage du téléphone dans les 30 min autour de l'heure de coucher visée → « téléphone au lit »
      phoneInBed: d.lastUseMinute != null && d.lastUseMinute >= bh * 60 + bm - 30,
      topApps: d.topApps,
    };
  }
  return out;
}
