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

const WORKOUT_MAP = [[/running|treadmill/i, 'course'], [/walking|wheelchairWalk/i, 'marche'], [/cycling|biking|handCycling/i, 'velo'], [/swimming|waterFitness/i, 'natation'], [STRENGTH, 'renfo'], [/highIntensity|crossTraining|bootCamp|burpee|jumpRope|mixedCardio/i, 'hiit'], [/yoga|pilates|stretching|flexibility|mindAndBody|taiChi|barre/i, 'yoga'], [/hiking|snowshoe/i, 'randonnee'], [/soccer|basketball|handball|rugby|volleyball|hockey|football|cricket|baseball|softball|lacrosse/i, 'collectif'], [/tennis|badminton|squash|padel|pickleball|racquet|tableTennis/i, 'raquette'], [/danc/i, 'danse']];
const mapWorkout = (t) => WORKOUT_MAP.find(([re]) => re.test(t))?.[1] || 'autre';

// Lit les N derniers jours depuis Health Connect : { days: { 'AAAA-MM-JJ': {...} }, workouts: [...] }.
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

  // Séances Health Connect → séances AppSanté (les minutes du jour sont recalculées à partir des séances).
  const sessions = (workouts?.workouts || []).filter((w) => w.duration >= 60).map((w) => ({
    id: `hc-${w.platformId || w.startDate}`,
    type: mapWorkout(w.workoutType),
    intensity: VIGOROUS.test(w.workoutType) ? 'intense' : 'moderee',
    start: w.startDate,
    minutes: Math.round(w.duration / 60),
    kcal: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned) : undefined,
    source: w.sourceName ? `Health Connect · ${w.sourceName}` : 'Health Connect',
  }));
  return { days: out, workouts: sessions };
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

// ---------- Widget « Je vais dormir » ----------
const SleepWidget = registerPlugin('SleepWidget');
export const takeWidgetEvents = () => (isNative ? SleepWidget.takeEvents().then((r) => r.events || []).catch(() => []) : Promise.resolve([]));
export const setWidgetState = (sleeping, since) => (isNative ? SleepWidget.setState({ sleeping, since: since ? new Date(since).getTime() : Date.now() }).catch(() => {}) : Promise.resolve());
export const pinSleepWidget = () => (isNative ? SleepWidget.pin().then((r) => r.requested).catch(() => false) : Promise.resolve(false));

// ---------- Détection du réveil ----------
export const screenEvents = (from, to = Date.now()) => UsageStats.screenEvents({ from, to }).then((r) => r.events || []);
export const nextAlarm = () => (isNative ? SleepWidget.nextAlarm().then((r) => r.at || null).catch(() => null) : Promise.resolve(null));

// ---------- Mises à jour (APK installé hors Play Store) ----------
const RELEASES = 'https://api.github.com/repos/StoneTheking/AppSante/releases/latest';
export const APK_URL = 'https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk';

export async function appVersion() {
  if (!isNative) return null;
  const { App } = await import('@capacitor/app');
  return (await App.getInfo()).version;
}

const parse = (v) => (v || '').replace(/^v/, '').split('.').map(Number);
export const isNewer = (a, b) => {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

// Renvoie { current, latest, available } ; null hors application native.
export async function checkUpdate() {
  if (!isNative) return null;
  const current = await appVersion();
  const r = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error('Impossible de vérifier les mises à jour');
  const latest = (await r.json()).tag_name?.replace(/^v/, '');
  return { current, latest, available: isNewer(latest, current) };
}

// Ouvre la fiche Android de l'application (pour « Autoriser les paramètres restreints »).
export const openAppInfo = () => UsageStats.openAppInfo();
