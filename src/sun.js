// Lever et coucher du soleil (algorithme simplifié de la NOAA, précision ~1–2 min sous nos latitudes).
// Renvoie des minutes depuis minuit, heure locale du téléphone.
const RAD = Math.PI / 180;
export const PARIS = { lat: 48.86, lon: 2.35 };

export function sunTimes(date = new Date(), { lat, lon } = PARIS) {
  const start = new Date(date.getFullYear(), 0, 1);
  const doy = Math.floor((date - start) / 86400e3) + 1;
  const g = ((2 * Math.PI) / 365) * (doy - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return null; // nuit ou jour polaire
  const h = Math.acos(cosH) / RAD;
  const tz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset();
  return { rise: Math.round(720 - 4 * (lon + h) - eq + tz), set: Math.round(720 - 4 * (lon - h) - eq + tz) };
}
