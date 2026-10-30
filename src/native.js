// Ponts vers l'application Android native (Capacitor) : Health Connect et statistiques d'utilisation.
// Dans le navigateur, isNative est faux et ces fonctions ne sont pas proposées.
import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

// Plugin maison (android/app/src/main/java/.../UsageStatsPlugin.java)
const UsageStats = registerPlugin('UsageStats');

const HEALTH_READ = ['steps', 'sleep', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'weight', 'calories', 'workouts'];

// Une promesse du plugin qui ne revient jamais ne doit pas bloquer l'écran (« Connexion… » à l'infini).
const timeout = (p, ms, msg) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(msg)), ms))]);

// Attention : le plugin Capacitor est un Proxy qui répond à toutes les propriétés, y compris « then ».
// Le renvoyer tel quel depuis une fonction async le ferait passer pour une promesse : JavaScript appellerait
// une méthode native « then » inexistante et l'attente ne finirait jamais. On l'enveloppe donc dans un objet.
const healthMod = () => timeout(import('@capgo/capacitor-health'), 8000, 'Le module Health Connect ne se charge pas');
async function health() {
  const { Health } = await healthMod();
  return { H: Health };
}

export async function healthStatus() {
  if (!isNative) return { available: false, reason: 'web' };
  const { H } = await health();
  return H.isAvailable();
}


// Autorisations Android correspondant aux types lus (voir HealthDataType.kt du plugin).
const HEALTH_PERMS = ['STEPS', 'SLEEP', 'HEART_RATE', 'RESTING_HEART_RATE', 'HEART_RATE_VARIABILITY', 'WEIGHT', 'ACTIVE_CALORIES_BURNED', 'EXERCISE']
  .map((x) => `android.permission.health.READ_${x}`);

// Accès accordés lus directement auprès d'Android 14+ (null si inconnu : Android plus ancien ou APK sans cette fonction).
const nativeGranted = () => timeout(UsageStats.healthGranted({ permissions: HEALTH_PERMS }), 3000, '')
  .then((r) => (r.known ? r.granted || [] : null)).catch(() => null);
// Correspondance autorisation Android → type lu par l'appli.
const PERM_TYPE = Object.fromEntries(HEALTH_PERMS.map((p, i) => [p, HEALTH_READ[i]]));

// Accès accordés : plugin Health Connect, sinon Android directement (les deux peuvent diverger juste après l'accord).
async function grantedTypes(H) {
  const st = await timeout(H.checkAuthorization({ read: HEALTH_READ }), 8000, 'Health Connect ne répond pas (autorisations)').catch(() => null);
  const viaPlugin = st?.readAuthorized || [];
  if (viaPlugin.length) return viaPlugin;
  const nat = await nativeGranted();
  if (nat) return nat.map((p) => PERM_TYPE[p]).filter(Boolean);
  if (!st) throw new Error('Health Connect ne répond pas (autorisations)');
  return [];
}

// Demande d'accès : la fenêtre est ouverte en natif et la promesse se résout quand on la ferme.
// Android 14+ : autorisations système (requestPermissions) ; Android 13 et moins : appli Health Connect.
// Chaque étape est notée dans un journal : en cas d'échec, l'erreur l'emporte (rapport à copier pour comprendre).
export async function connectHealth(onStep = () => {}) {
  const t0 = Date.now(), log = [];
  const step = (m) => { log.push(`${((Date.now() - t0) / 1000).toFixed(1)} s ${m}`); onStep(m); };
  const fail = (m) => { const e = new Error(m); e.log = log; return e; };
  const { H } = await health();
  step('Vérification de Health Connect…');
  const a = await timeout(H.isAvailable(), 5000, 'Health Connect ne répond pas').catch((e) => { throw fail(e.message); });
  log.push(`disponible : ${a.available} ${a.reason || ''}`);
  if (!a.available) throw fail('Health Connect n’est pas disponible. Installe « Health Connect » depuis le Play Store (inclus d’office depuis Android 14).');
  step('Choisis les accès dans la fenêtre de Health Connect…');
  // Surveillance de la fenêtre : si l'appli ne passe jamais en arrière-plan, c'est qu'Android n'a rien affiché ;
  // si elle revient sans recevoir de réponse, on relit directement les accès accordés.
  let left = false, back = 0;
  const onVis = () => { if (document.visibilityState === 'hidden') { left = true; log.push(`${((Date.now() - t0) / 1000).toFixed(1)} s fenêtre ouverte`); } else if (left) { back = Date.now(); log.push(`${((Date.now() - t0) / 1000).toFixed(1)} s retour dans l'appli`); } };
  const onBlur = () => { if (!left) { left = true; log.push(`${((Date.now() - t0) / 1000).toFixed(1)} s fenêtre ouverte (focus perdu)`); } };
  document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', onBlur); document.addEventListener('pause', onBlur);
  const watchdog = new Promise((resolve, reject) => {
    const tick = setInterval(() => {
      const el = Date.now() - t0;
      if (!left && el > 9000) { clearInterval(tick); reject(fail('La fenêtre d’autorisation de Health Connect ne s’est pas ouverte : Android n’a rien affiché (souvent après deux refus, ou si Health Connect doit être mis à jour).')); }
      else if (back && Date.now() - back > 4000) { clearInterval(tick); resolve({ lost: true }); }
      else if (el > 120000) { clearInterval(tick); reject(fail('Aucune réponse de Health Connect après 2 minutes.')); }
    }, 500);
  });
  try {
    const r = await Promise.race([UsageStats.requestHealth({ permissions: HEALTH_PERMS }), watchdog]);
    log.push(r?.lost ? 'réponse non transmise à l’appli : lecture directe des accès' : `réponse reçue : ${(r?.granted || []).length} accès`);
  } catch (e) {
    if (/not implemented/i.test(e.message || '')) {
      log.push('APK sans fenêtre native : fenêtre du plugin');
      await timeout(H.requestAuthorization({ read: HEALTH_READ }), 60000, 'Pas de réponse de Health Connect').catch((x) => log.push(x.message));
    } else throw e.log ? e : fail(e.message || String(e));
  } finally {
    document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); document.removeEventListener('pause', onBlur);
  }
  step('Lecture des accès accordés…');
  const granted = await grantedTypes(H).catch((e) => { throw fail(e.message); });
  log.push(`accès accordés : ${granted.join(', ') || 'aucun'}`);
  if (!granted.length) throw fail('Aucun accès accordé (si la fenêtre ne s’est pas affichée, Android l’a bloquée après des refus)');
  return { readAuthorized: granted, log };
}

export const openHealthSettings = async () => (await health()).H.openHealthConnectSettings();
// Page « Autorisations » de Diana Health dans Health Connect (repli : réglages de Health Connect, puis Play Store).
export const openHealthPermissions = () => UsageStats.openHealthPermissions().then((r) => r.opened);
const healthInfo = () => timeout(UsageStats.healthInfo(), 3000, '').catch(() => ({}));

// État détaillé de Health Connect pour expliquer ce qui bloque.
export async function healthDiagnose() {
  if (!isNative) return { ok: false, reason: 'web' };
  const t0 = Date.now(), log = [];
  const step = (m) => log.push(`${((Date.now() - t0) / 1000).toFixed(1)} s ${m}`);
  const info = await healthInfo();
  step(`infos téléphone : ${info.sdk ? `API ${info.sdk}` : 'non lues'}`);
  try {
    const { H } = await health();
    step('module Health Connect chargé');
    const a = await timeout(H.isAvailable(), 5000, 'Health Connect ne répond pas (disponibilité)');
    step(`disponible : ${a.available} ${a.reason || ''}`);
    if (!a.available) return { ok: false, reason: /update/i.test(a.reason || '') ? 'update' : 'unavailable', detail: a.reason || '', info, log };
    const granted = await grantedTypes(H);
    step(`accès accordés : ${granted.join(', ') || 'aucun'}`);
    return { ok: granted.length > 0, reason: granted.length ? 'ok' : 'denied', granted, steps: granted.includes('steps'), info, log };
  } catch (e) { step(`erreur : ${e.message || e}`); return { ok: false, reason: 'error', detail: e.message || String(e), info, log }; }
}

// ---------- Podomètre intégré (repli sans Health Connect) ----------
// Compteur matériel cumulé depuis le démarrage du téléphone : on garde des relevés et on en déduit les pas du jour.
const Steps = registerPlugin('Steps');
export const stepsAccess = () => Steps.requestAccess().then((r) => r.granted).catch(() => false);
export const stepsHasAccess = () => Steps.hasAccess().then((r) => r.granted).catch(() => false);
export const stepsRead = () => Steps.read().catch(() => null); // { value, t } ou null

// Pas du jour à partir des relevés [{ t, v }] (v = compteur cumulé ; une baisse = redémarrage).
export function stepsFromSamples(samples, dayStart) {
  const ss = [...samples].sort((a, b) => a.t - b.t);
  let total = 0;
  for (let i = 1; i < ss.length; i++) {
    const a = ss[i - 1], b = ss[i];
    if (b.t <= dayStart) continue;
    const delta = b.v >= a.v ? b.v - a.v : b.v; // redémarrage : le compteur repart de 0
    const frac = a.t >= dayStart ? 1 : (b.t - dayStart) / (b.t - a.t); // part de l'intervalle tombée aujourd'hui
    total += delta * Math.max(0, Math.min(1, frac));
  }
  return Math.round(total);
}

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
  const { H } = await health();
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

  // Séances Health Connect → séances Diana Health (les minutes du jour sont recalculées à partir des séances).
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
      phoneInBedGuess: d.lastUseMinute != null && d.lastUseMinute >= bh * 60 + bm - 30,
      topApps: d.topApps,
    };
  }
  return out;
}

// ---------- Widget « Je vais dormir » ----------
const SleepWidget = registerPlugin('SleepWidget');
export const takeWidgetEvents = () => (isNative ? SleepWidget.takeEvents().then((r) => r.events || []).catch(() => []) : Promise.resolve([]));
export const setWidgetState = (sleeping, since, target) => (isNative ? SleepWidget.setState({ sleeping, since: since ? new Date(since).getTime() : Date.now(), ...(target ? { target } : {}) }).catch(() => {}) : Promise.resolve());
export const pinSleepWidget = () => (isNative ? SleepWidget.pin().then((r) => r.requested).catch(() => false) : Promise.resolve(false));
export const pinPhotoWidget = () => (isNative ? SleepWidget.pin({ kind: 'photo' }).then((r) => r.requested).catch(() => false) : Promise.resolve(false));

// ---------- Détection du réveil ----------
export const screenEvents = (from, to = Date.now()) => UsageStats.screenEvents({ from, to }).then((r) => r.events || []);
export const nextAlarm = () => (isNative ? SleepWidget.nextAlarm().then((r) => r.at || null).catch(() => null) : Promise.resolve(null));

// ---------- Mises à jour (APK installé hors Play Store) ----------
const RELEASES = 'https://api.github.com/repos/StoneTheking/AppSante/releases/latest';
export const APK_URL = 'https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk';

let installed = null;
export async function appVersion() {
  if (!isNative) return null;
  const { App } = await import('@capacitor/app');
  installed = (await App.getInfo()).version;
  return installed;
}
// Version installée, connue une fois appVersion() appelée (null avant).
export const installedVersion = () => installed;

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

// ---------- Agenda du téléphone (Google Agenda synchronisé) ----------
const Calendar = registerPlugin('Calendar');
export const calendarAccess = () => Calendar.requestAccess().then((r) => r.granted);
export const calendarHasAccess = () => (isNative ? Calendar.hasAccess().then((r) => r.granted).catch(() => false) : Promise.resolve(false));
export const calendarList = () => Calendar.calendars().then((r) => r.calendars || []);
export const calendarEvents = (from, to) => Calendar.events({ from, to }).then((r) => r.events || []);
export const calendarInsert = (calendarId, events) => Calendar.insert({ calendarId, events }).then((r) => r.inserted);
