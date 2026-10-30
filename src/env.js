// Lieu de vie, qualité de l'air, pollens, UV et météo (Open-Meteo, données libres sans clé).

export async function searchPlace(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);
  if (!r.ok) throw new Error('Recherche de lieu indisponible');
  const j = await r.json();
  return (j.results || []).map((p) => ({ name: [p.name, p.admin1, p.country_code].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude }));
}

export function currentPosition(maximumAge = 3600e3) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation indisponible'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ name: 'Ma position', auto: true, lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 }),
      () => reject(new Error('Position refusée : choisis ta ville à la main')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge },
    );
  });
}

const POLLENS = { alder_pollen: 'aulne', birch_pollen: 'bouleau', grass_pollen: 'graminées', mugwort_pollen: 'armoise', olive_pollen: 'olivier', ragweed_pollen: 'ambroisie' };

export async function fetchEnv(loc) {
  const q = `latitude=${loc.lat}&longitude=${loc.lon}&timezone=auto`;
  const [aq, wx] = await Promise.all([
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&forecast_days=2&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,uv_index,${Object.keys(POLLENS).join(',')}&hourly=european_aqi,pm2_5,uv_index`).then((r) => r.json()),
    fetch(`https://api.open-meteo.com/v1/forecast?${q}&forecast_days=2&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&hourly=temperature_2m,apparent_temperature,precipitation_probability&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max`).then((r) => r.json()),
  ]);
  if (aq.error || wx.error) throw new Error(aq.reason || wx.reason || 'Données environnementales indisponibles');
  const today = wx.daily.time[0];
  const hours = wx.hourly.time.map((t, i) => ({
    t,
    hour: Number(t.slice(11, 13)),
    day: t.slice(0, 10),
    temp: wx.hourly.apparent_temperature[i] ?? wx.hourly.temperature_2m[i],
    rain: wx.hourly.precipitation_probability[i] ?? 0,
    aqi: aq.hourly.european_aqi[aq.hourly.time.indexOf(t)] ?? null,
    uv: aq.hourly.uv_index[aq.hourly.time.indexOf(t)] ?? null,
  }));
  const pollen = Object.entries(POLLENS)
    .map(([k, name]) => ({ name, value: aq.current?.[k] ?? 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
  return {
    fetched: new Date().toISOString(),
    place: loc.name,
    aqi: aq.current?.european_aqi ?? null,
    pm25: aq.current?.pm2_5 ?? null,
    pm10: aq.current?.pm10 ?? null,
    no2: aq.current?.nitrogen_dioxide ?? null,
    o3: aq.current?.ozone ?? null,
    uv: aq.current?.uv_index ?? null,
    uvMax: wx.daily.uv_index_max[0],
    temp: wx.current.temperature_2m,
    feels: wx.current.apparent_temperature,
    humidity: wx.current.relative_humidity_2m,
    tMax: wx.daily.temperature_2m_max[0],
    tMin: wx.daily.temperature_2m_min[1] ?? wx.daily.temperature_2m_min[0], // nuit à venir
    rainMax: wx.daily.precipitation_probability_max[0],
    sunrise: wx.daily.sunrise[0]?.slice(11, 16),
    sunset: wx.daily.sunset[0]?.slice(11, 16),
    pollen,
    hours: hours.filter((h) => h.day === today),
  };
}

// Indice européen de qualité de l'air (EAQI) : libellé et couleur.
export function aqiLabel(v) {
  if (v == null) return { label: '—', level: 'neutral' };
  if (v <= 20) return { label: 'Bonne', level: 'bon' };
  if (v <= 40) return { label: 'Correcte', level: 'bon' };
  if (v <= 60) return { label: 'Moyenne', level: 'moyen' };
  if (v <= 80) return { label: 'Mauvaise', level: 'a_limiter' };
  if (v <= 100) return { label: 'Très mauvaise', level: 'a_limiter' };
  return { label: 'Extrêmement mauvaise', level: 'a_limiter' };
}

// Meilleure heure pour une activité dehors entre deux heures (pénalise pollution, chaleur, pluie, UV).
export function bestOutdoorHour(env, fromMin, toMin) {
  if (!env?.hours?.length) return null;
  const cands = env.hours.filter((h) => h.hour * 60 >= fromMin && h.hour * 60 <= toMin);
  if (!cands.length) return null;
  const cost = (h) => (h.aqi ?? 30) + Math.max(0, h.temp - 26) * 6 + Math.max(0, 5 - h.temp) * 2 + h.rain * 0.4 + Math.max(0, (h.uv ?? 0) - 5) * 4;
  return cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
}

// Conseils environnementaux fondés sur les recommandations (OMS, Lancet…).
export function envInsights(env, profile) {
  if (!env) return [];
  const out = [];
  const push = (level, title, text, src) => out.push({ level, title, text, src });
  const aq = aqiLabel(env.aqi);
  if (env.aqi > 60) push('alerte', `Qualité de l’air ${aq.label.toLowerCase()}`, `Indice ${Math.round(env.aqi)} à ${env.place}. Fais ton sport en intérieur ou à l’heure la moins polluée, loin des grands axes ; évite l’effort intense dehors.`, ['who2021air', 'sinharay2018']);
  else if (env.aqi > 40) push('attention', 'Qualité de l’air moyenne', 'Bouger dehors reste bénéfique : privilégie les parcs et rues calmes plutôt que les axes à fort trafic.', ['andersen2015', 'sinharay2018']);
  if (env.pm25 != null && env.pm25 > 15) push('attention', 'Particules fines', `PM2,5 : ${Math.round(env.pm25)} µg/m³ (repère OMS sur 24 h : 15). Aère tôt le matin, évite les axes routiers.`, ['who2021air']);
  if (env.tMax >= 30) push('alerte', 'Forte chaleur', `Jusqu’à ${Math.round(env.tMax)} °C : sport tôt le matin ou en soirée, bois régulièrement, rafraîchis-toi.`, ['ebi2021']);
  if (env.tMin >= 20) push('attention', 'Nuit chaude', `${Math.round(env.tMin)} °C cette nuit : ferme les volets le jour, aère le soir, douche tiède avant de dormir. Les nuits chaudes raccourcissent le sommeil.`, ['obradovich2017']);
  if (env.uvMax >= 6) push('attention', 'UV élevés', `Indice UV max ${Math.round(env.uvMax)} : ombre, chapeau et crème entre 11 h et 16 h. 10–15 min de soleil le matin suffisent pour la lumière.`, ['whouv']);
  const allergic = /pollen|graminée|bouleau|ambroisie|rhume des foins/i.test(`${profile.allergies} ${profile.conditions}`);
  const high = env.pollen.find((p) => p.value >= 50);
  if (high && allergic) push('attention', `Pollens de ${high.name}`, 'Concentration élevée : sport plutôt en fin de journée ou après la pluie, douche et vêtements propres en rentrant, fenêtres fermées en journée.', []);
  return out;
}
