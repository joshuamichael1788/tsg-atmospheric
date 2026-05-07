const FALLBACK = { lat: 39.2467, lon: -94.4194, name: 'LIBERTY, MO', isFallback: true };
let currentLocation = { ...FALLBACK };
let weatherState = 'clear';
let particleFrame = null;
let syncController = null;
let resizeTimer = null;

const $ = (id) => document.getElementById(id);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ── WMO codes (added 56,57,66,67,77,85,86) ──────────────────────────────────
const WMO = {
  0:['CLEAR','clear','wxClear'], 1:['MAINLY CLEAR','clear','wxClear'],
  2:['PARTLY CLOUDY','cloudy','wxPartlyCloudy'], 3:['OVERCAST','cloudy','wxCloudy'],
  45:['FOG','cloudy','wxFog'], 48:['RIME FOG','cloudy','wxFog'],
  51:['LIGHT DRIZZLE','rain','wxRain'], 53:['DRIZZLE','rain','wxRain'],
  55:['DENSE DRIZZLE','rain','wxRain'],
  56:['FREEZING DRIZZLE','rain','wxRain'], 57:['HEAVY FREEZING DRIZZLE','rain','wxRain'],
  61:['LIGHT RAIN','rain','wxRain'], 63:['RAIN','rain','wxRain'],
  65:['HEAVY RAIN','rain','wxRain'],
  66:['FREEZING RAIN','rain','wxRain'], 67:['HEAVY FREEZING RAIN','rain','wxRain'],
  71:['LIGHT SNOW','snow','wxSnow'], 73:['SNOW','snow','wxSnow'],
  75:['HEAVY SNOW','snow','wxSnow'], 77:['SNOW GRAINS','snow','wxSnow'],
  80:['SHOWERS','rain','wxRain'], 81:['HEAVY SHOWERS','rain','wxRain'],
  82:['VIOLENT SHOWERS','storm','wxStorm'],
  85:['SNOW SHOWERS','snow','wxSnow'], 86:['HEAVY SNOW SHOWERS','snow','wxSnow'],
  95:['THUNDERSTORM','storm','wxStorm'],
  96:['STORM W/ HAIL','storm','wxStorm'], 99:['STORM W/ HAIL','storm','wxStorm'],
};
const decodeWeather = (code) => WMO[code] || ['UNKNOWN','clear','wxClear'];

// ── formatting ────────────────────────────────────────────────────────────────
function fmtTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const s = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${s}`;
}
function fmtHour(value) {
  const d = new Date(value);
  let h = d.getHours();
  const s = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}${s}`;
}
const ARROWS = ['↑','↗','→','↘','↓','↙','←','↖'];
const CARDS  = ['N','NE','E','SE','S','SW','W','NW'];
const cardinalArrow = (deg) => ARROWS[Math.round(deg / 45) % 8];
const cardinalName  = (deg) => CARDS[Math.round(deg / 45) % 8];

// ── moon phase ────────────────────────────────────────────────────────────────
function moonPhase(date = new Date()) {
  const ref = new Date('2000-01-06T18:14:00Z').getTime();
  const syn = 29.530588853 * 86400000;
  return (((date.getTime() - ref) % syn) + syn) % syn / syn;
}
function moonPhaseName(p) {
  if (p < 0.03 || p > 0.97) return 'NEW MOON';
  if (p < 0.22) return 'WAXING CRESCENT';
  if (p < 0.28) return 'FIRST QUARTER';
  if (p < 0.47) return 'WAXING GIBBOUS';
  if (p < 0.53) return 'FULL MOON';
  if (p < 0.72) return 'WANING GIBBOUS';
  if (p < 0.78) return 'LAST QUARTER';
  return 'WANING CRESCENT';
}
function renderMoonPhase(p) {
  const shadow = $('moonShadow');
  if (!shadow) return;
  const illum = 1 - Math.abs(p - 0.5) * 2;
  const pct = Math.round(illum * 100);
  shadow.style.cssText = 'position:absolute;top:0;height:100%;background:var(--base);border-radius:50%;display:block;';
  if (p < 0.5) {
    // waxing: lit right, shadow retreats left
    shadow.style.left = '0';
    shadow.style.right = 'auto';
    shadow.style.width = `${100 - pct}%`;
  } else {
    // waning: lit left, shadow grows from right
    shadow.style.right = '0';
    shadow.style.left = 'auto';
    shadow.style.width = `${100 - pct}%`;
  }
}

// ── geolocation ───────────────────────────────────────────────────────────────
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ ...FALLBACK }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'RESOLVING...', isFallback: false }),
      ()    => resolve({ ...FALLBACK }),
      { timeout: 6000, maximumAge: 300000, enableHighAccuracy: true }
    );
  });
}
async function resolvePlaceName(loc) {
  if (loc.isFallback) return loc.name;
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.lat}&longitude=${loc.lon}&localityLanguage=en`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    const city  = d.city || d.locality || d.principalSubdivision || 'Current Area';
    const state = String(d.principalSubdivisionCode || d.principalSubdivision || '').replace(/^US-/,'');
    return state ? `${city}, ${state}` : city;
  } catch { return 'CURRENT AREA'; }
}
function installLocationButton() {
  if ($('locBtn') || !currentLocation.isFallback) return;
  const line = $('locationLine');
  if (!line) return;
  const btn = document.createElement('button');
  btn.id = 'locBtn';
  btn.className = 'loc-btn';
  btn.type = 'button';
  btn.textContent = '📍 Use my location';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Locating…';
    const loc = await getLocation();
    if (!loc.isFallback) {
      currentLocation = loc;
      btn.remove();
      const name = await resolvePlaceName(loc);
      currentLocation.name = name;
      $('locationLine').textContent = `LOC: ${name}`;
      initTelemetry();
    } else {
      btn.textContent = '📍 Use my location';
      btn.disabled = false;
    }
  });
  line.insertAdjacentElement('afterend', btn);
}

// ── demo data (starts from NOW, not midnight) ─────────────────────────────────
function generateDemoData() {
  const now = new Date();
  const hourly = { time:[], temperature_2m:[], apparent_temperature:[], wind_speed_10m:[], precipitation_probability:[], visibility:[] };
  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() + i * 3600000);
    hourly.time.push(t.toISOString());
    hourly.temperature_2m.push(Math.round(68 + Math.sin((i/24)*Math.PI*2)*8));
    hourly.apparent_temperature.push(Math.round(66 + Math.sin((i/24)*Math.PI*2)*8));
    hourly.wind_speed_10m.push(Math.round(6 + Math.sin((i/12)*Math.PI)*4));
    hourly.precipitation_probability.push(i<4?8:i<8?28:i<12?44:16);
    hourly.visibility.push(15000);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daily = { time:[], temperature_2m_max:[], temperature_2m_min:[], weather_code:[], uv_index_max:[], sunrise:[], sunset:[], precipitation_probability_max:[] };
  for (let i = 0; i < 7; i++) {
    const day = new Date(today.getTime() + i * 86400000);
    daily.time.push(day.toISOString().split('T')[0]);
    daily.temperature_2m_max.push(72 + Math.round(Math.sin(i)*6));
    daily.temperature_2m_min.push(58 + Math.round(Math.sin(i)*4));
    daily.weather_code.push([1,2,61,80,3,1,0][i]);
    daily.uv_index_max.push(5 + Math.round(Math.sin(i)*2));
    daily.sunrise.push(new Date(day.getTime() + 6.4*3600000).toISOString());
    daily.sunset.push(new Date(day.getTime() + 19.9*3600000).toISOString());
    daily.precipitation_probability_max.push(20 + Math.round(Math.sin(i)*30));
  }
  return {
    current: { temperature_2m:71, apparent_temperature:69, relative_humidity_2m:58, surface_pressure:1014, wind_speed_10m:8, wind_direction_10m:215, weather_code:2, dew_point_2m:54 },
    hourly, daily,
  };
}

// ── score ─────────────────────────────────────────────────────────────────────
function scoreHour(apparentTemp, wind, precip, vis) {
  let s = 100;
  s -= Math.abs(apparentTemp - 72) * 1.4;
  s -= precip * 0.75;
  s -= clamp((wind - 8) * 0.8, 0, 20);
  if (vis < 5000) s -= 18;
  return clamp(Math.round(s), 0, 100);
}

// ── model ─────────────────────────────────────────────────────────────────────
function modelForecast(weather, aqi) {
  const now = new Date();
  // i0 = first hourly index >= now  (fixes midnight-array bug)
  const i0 = Math.max(0, weather.hourly.time.findIndex(t => new Date(t) >= now));

  const next12 = Array.from({ length: 12 }, (_, k) => {
    const idx = i0 + k;
    return {
      time:         weather.hourly.time[idx],
      temp:         weather.hourly.temperature_2m[idx]         ?? weather.current.temperature_2m,
      apparentTemp: weather.hourly.apparent_temperature?.[idx] ?? weather.current.apparent_temperature,
      wind:         weather.hourly.wind_speed_10m?.[idx]       ?? weather.current.wind_speed_10m,
      precip:       weather.hourly.precipitation_probability[idx] ?? 0,
      vis:          weather.hourly.visibility[idx]             ?? 15000,
    };
  });

  const sunrise = new Date(weather.daily.sunrise[0]);
  const sunset  = new Date(weather.daily.sunset[0]);
  const isDay   = now >= sunrise && now <= sunset;

  // M3 fix: if today's golden hour has passed, show tomorrow's
  const todayGolden = new Date(sunset.getTime() - 3600000);
  const blueEnd     = new Date(sunset.getTime() + 35*60000);
  let goldenDisplay, goldenNote;
  if (now > blueEnd && weather.daily.sunset[1]) {
    const tmrSunset = new Date(weather.daily.sunset[1]);
    goldenDisplay = new Date(tmrSunset.getTime() - 3600000);
    goldenNote = `Tomorrow: golden hour at ${fmtTime(goldenDisplay)}`;
  } else {
    goldenDisplay = todayGolden;
    goldenNote = `Into blue hour until ${fmtTime(blueEnd)}`;
  }

  // Storm level using current-hour data
  const code      = weather.current.weather_code;
  const curPrecip = next12[0]?.precip ?? 0;
  let storm = 'low';
  if ([82,95,96,99].includes(code))                           storm = 'active';
  else if ([61,63,65,80,81].includes(code) || curPrecip>=55) storm = 'passing';
  else if (curPrecip >= 30)                                   storm = 'watch';

  // Best window among next 12 hours
  let bestWindow = { score: -1, index: 0 };
  next12.forEach((h, k) => {
    const s = scoreHour(h.apparentTemp, h.wind, h.precip, h.vis);
    if (s > bestWindow.score) bestWindow = { score: s, index: k };
  });

  const peakPrecip = Math.max(next12[0]?.precip ?? 0, next12[1]?.precip ?? 0);

  return {
    raw: weather, i0, now, isDay, sunrise, sunset, storm,
    goldenDisplay, goldenNote, blueEnd,
    next12, bestWindow, peakPrecip,
    visNow:  weather.hourly.visibility[i0]             ?? 15000,
    uvNow:   weather.daily.uv_index_max?.[0]           ?? null,
    aqiNow:  aqi?.current?.us_aqi                      ?? null,
    narration: narrate(next12, weather.current, isDay, storm),
  };
}

// ── narration ─────────────────────────────────────────────────────────────────
function narrate(next12, current, isDay, storm) {
  if (storm === 'active')  return 'Thunderstorm signal present. Treat outdoor plans as unstable.';
  if (storm === 'passing') return 'Rain or storm energy nearby. Watch the next 30–90 minutes.';
  const h0  = next12[0];
  const mid = next12[Math.min(5, next12.length-1)];
  const end = next12[Math.min(11, next12.length-1)];
  let c1 = h0.precip >= 60 ? `${h0.precip}% rain chance now`
         : h0.temp >= 88   ? `Hot at ${Math.round(h0.temp)}°`
         : h0.temp <= 35   ? `Cold at ${Math.round(h0.temp)}°`
         : `${Math.round(h0.temp)}° and ${h0.precip < 20 ? 'dry' : `${h0.precip}% precip`}`;
  const dt = mid.temp - h0.temp;
  let c2 = mid.precip > h0.precip + 20  ? `rain building toward ${fmtHour(mid.time)}`
         : mid.precip < h0.precip - 25   ? `clearing by ${fmtHour(mid.time)}`
         : dt > 6                        ? `warming through ${fmtHour(mid.time)}`
         : dt < -6                       ? `cooling through ${fmtHour(mid.time)}`
         : '';
  let c3 = end.precip >= 50 ? `${end.precip}% rain by ${fmtHour(end.time)}` : '';
  return [c1, c2, c3].filter(Boolean).join(' · ') + '.';
}

// ── NWS alerts ────────────────────────────────────────────────────────────────
async function fetchNwsAlerts(lat, lon, signal) {
  try {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { signal, headers: { Accept: 'application/geo+json' } }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.features || []).slice(0,3).map(f => ({
      headline: f.properties.headline || f.properties.event || '',
      severity: (f.properties.severity || 'minor').toLowerCase(),
    }));
  } catch { return []; }
}
function renderNwsAlerts(alerts) {
  let el = $('nwsAlerts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nwsAlerts';
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    const header = document.querySelector('.header');
    if (header) header.insertAdjacentElement('afterend', el);
  }
  if (!alerts.length) { el.className = 'nws-alerts'; el.innerHTML = ''; return; }
  el.className = 'nws-alerts active';
  el.innerHTML = alerts.map(a => {
    const cls = a.severity==='extreme' ? 'extreme' : a.severity==='severe' ? 'severe' : 'moderate';
    return `<div class="nws-alert nws-${cls}">⚠ ${a.headline}</div>`;
  }).join('');
}

// ── AQI ───────────────────────────────────────────────────────────────────────
async function fetchAqi(lat, lon, signal) {
  try {
    const r = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`,
      { signal }
    );
    if (!r.ok) throw new Error();
    return await r.json();
  } catch { return null; }
}

// ── pressure trend (localStorage ring buffer) ─────────────────────────────────
function loadPressureBuf() {
  try { return JSON.parse(localStorage.getItem('tsg_pressure') || '[]'); } catch { return []; }
}
function derivePressureTrend(hPa) {
  const buf = loadPressureBuf();
  buf.push({ t: Date.now(), hPa });
  const trimmed = buf.slice(-24);
  try { localStorage.setItem('tsg_pressure', JSON.stringify(trimmed)); } catch {}
  const window3h = trimmed.filter(e => Date.now() - e.t < 3*3600000);
  if (window3h.length < 2) return { label: `${Math.round(hPa)} hPa`, note: 'Building baseline' };
  const delta = window3h[window3h.length-1].hPa - window3h[0].hPa;
  if (delta >=  1.5) return { label: `${Math.round(hPa)} hPa · Rising ▲`,  note: 'Clearing or dry edge moving in' };
  if (delta <= -1.5) return { label: `${Math.round(hPa)} hPa · Falling ▼`, note: 'Front approaching — watch the sky' };
  return { label: `${Math.round(hPa)} hPa · Steady`, note: 'Pressure holding' };
}

// ── Hours of Ra ───────────────────────────────────────────────────────────────
const RA_HOURS = [
  {name:'First Hour of Ra',    desc:'The bark sets forth upon the waters',      tint:'rgba(232,100,40,.16)'},
  {name:'Second Hour of Ra',   desc:'Morning light fills the east',             tint:'rgba(240,160,60,.13)'},
  {name:'Third Hour of Ra',    desc:'The sky brightens toward zenith',          tint:'rgba(240,200,80,.10)'},
  {name:'Fourth Hour of Ra',   desc:'The shadow shortens',                      tint:'rgba(240,200,80,.09)'},
  {name:'Fifth Hour of Ra',    desc:'Ra stands high in the solar bark',         tint:'rgba(240,200,80,.09)'},
  {name:'Sixth Hour of Ra',    desc:'The sun holds its full power',             tint:'rgba(240,180,60,.10)'},
  {name:'Seventh Hour of Ra',  desc:'The light begins to lean west',            tint:'rgba(232,140,50,.12)'},
  {name:'Eighth Hour of Ra',   desc:'The Field of Reeds glows gold',            tint:'rgba(232,120,40,.15)'},
  {name:'Ninth Hour of Ra',    desc:'The warm amber hour',                      tint:'rgba(220,90,40,.18)'},
  {name:'Tenth Hour of Ra',    desc:'Golden light at the rim of day',           tint:'rgba(200,70,40,.20)'},
  {name:'Eleventh Hour of Ra', desc:'The bark descends toward the west',        tint:'rgba(160,50,60,.22)'},
  {name:'Twelfth Hour of Ra',  desc:'Dusk — Ra approaches the Duat',           tint:'rgba(80,30,70,.26)'},
  {name:'First Hour of Night',    desc:'Ra enters the gates of the underworld', tint:'rgba(26,16,80,.30)'},
  {name:'Second Hour of Night',   desc:'The Duat opens its first gate',         tint:'rgba(20,12,68,.34)'},
  {name:'Third Hour of Night',    desc:'Stars rise in their sequence',          tint:'rgba(16,10,56,.36)'},
  {name:'Fourth Hour of Night',   desc:'The serpent Apophis stirs',             tint:'rgba(14,8,48,.38)'},
  {name:'Fifth Hour of Night',    desc:'The deep middle of night begins',       tint:'rgba(12,8,42,.40)'},
  {name:'Sixth Hour of Night',    desc:'Midnight — the bark crosses the deep',  tint:'rgba(10,6,38,.42)'},
  {name:'Seventh Hour of Night',  desc:'Apophis is defeated by the light',      tint:'rgba(12,8,44,.40)'},
  {name:'Eighth Hour of Night',   desc:'The dead are judged by the feather',    tint:'rgba(14,10,52,.38)'},
  {name:'Ninth Hour of Night',    desc:'Stars of the eastern horizon stir',     tint:'rgba(18,12,60,.34)'},
  {name:'Tenth Hour of Night',    desc:'Ra prepares for renewal',               tint:'rgba(26,14,68,.30)'},
  {name:'Eleventh Hour of Night', desc:'The horizon begins to warm',            tint:'rgba(44,20,58,.26)'},
  {name:'Twelfth Hour of Night',  desc:'The bark approaches the gates of dawn', tint:'rgba(70,28,50,.22)'},
];
function getHourOfRa(now, sunrise, sunset) {
  const dayMs   = sunset.getTime() - sunrise.getTime();
  const nightMs = 86400000 - dayMs;
  const isDay   = now >= sunrise && now <= sunset;
  if (isDay) {
    const idx = Math.min(11, Math.floor(((now - sunrise) / dayMs) * 12));
    return { ...RA_HOURS[idx], isDay: true };
  }
  const nightStart = sunset.getTime();
  const elapsed = now.getTime() >= nightStart
    ? now.getTime() - nightStart
    : now.getTime() + 86400000 - nightStart;
  const idx = Math.min(11, Math.floor((elapsed / nightMs) * 12));
  return { ...RA_HOURS[12 + idx], isDay: false };
}
function renderHourOfRa(hour) {
  let card = $('hourOfRaCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'hourOfRaCard';
    card.className = 'hour-of-ra';
    const brief = document.querySelector('.sky-brief');
    if (brief) brief.insertAdjacentElement('beforebegin', card);
  }
  card.innerHTML = `<span class="ra-name">${hour.name}</span><span class="ra-desc">${hour.desc}</span>`;
  document.documentElement.style.setProperty('--ra-tint', hour.tint);
}

// ── sky-stop colour per hour node ─────────────────────────────────────────────
function skyStopColor(t, sunrise, sunset) {
  const ms  = t instanceof Date ? t.getTime() : new Date(t).getTime();
  const sr  = sunrise.getTime();
  const ss  = sunset.getTime();
  const gld = ss - 3600000;
  const blu = ss + 35*60000;
  if (ms < sr - 3600000) return 'rgba(20,14,70,.30)';
  if (ms < sr)           return 'rgba(50,24,56,.24)';
  if (ms < sr + 3600000) return 'rgba(220,90,40,.16)';
  if (ms < gld)          return 'rgba(240,200,80,.05)';
  if (ms < ss)           return 'rgba(220,80,30,.18)';
  if (ms < blu)          return 'rgba(50,90,180,.18)';
  return 'rgba(20,14,70,.30)';
}

// ── crepuscular mode ──────────────────────────────────────────────────────────
function checkCrepuscular(now, sunrise, sunset) {
  const W = 20*60000;
  const near = Math.abs(now - sunrise) < W || Math.abs(now - sunset) < W;
  document.body.classList.toggle('crepuscular', near);
  let msg = $('crepuscularMsg');
  if (near) {
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'crepuscularMsg';
      msg.className = 'crepuscular-msg';
      msg.setAttribute('aria-live','assertive');
      const arc = document.querySelector('.celestial-arc');
      if (arc) arc.insertAdjacentElement('afterend', msg);
    }
    msg.textContent = Math.abs(now - sunrise) < W ? 'The field is opening.' : 'The field is changing.';
  } else if (msg) { msg.remove(); }
}

// ── Sky Stamp (daily IndexedDB-lite via localStorage) ─────────────────────────
const STAMP_GLYPHS = { clear:'☀', cloudy:'☁', rain:'🌧', snow:'❄', storm:'⚡' };
function snapshotSkyStamp(weather, model) {
  const today = new Date().toLocaleDateString('en-CA');
  const key   = `tsg_stamp_${today}`;
  if (localStorage.getItem(key)) return;
  const [,state] = decodeWeather(weather.current.weather_code);
  try {
    localStorage.setItem(key, JSON.stringify({
      date: today,
      temp: Math.round(weather.current.temperature_2m),
      state, glyph: STAMP_GLYPHS[state] || '◈',
      precip: model.peakPrecip,
    }));
    // prune entries older than 90 days
    const cutoff = Date.now() - 90*86400000;
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('tsg_stamp_') && new Date(k.replace('tsg_stamp_','')+'T12:00:00').getTime() < cutoff)
        localStorage.removeItem(k);
    });
  } catch {}
}
function renderStampWall() {
  const stamps = Object.keys(localStorage)
    .filter(k => k.startsWith('tsg_stamp_'))
    .map(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } })
    .filter(Boolean)
    .sort((a,b) => b.date.localeCompare(a.date));
  if (!stamps.length) return;
  let wall = $('stampWall');
  if (!wall) {
    wall = document.createElement('section');
    wall.id = 'stampWall';
    wall.className = 'stamp-wall';
    wall.setAttribute('aria-label','Sky stamp archive');
    const footer = document.querySelector('.footer');
    if (footer) footer.insertAdjacentElement('beforebegin', wall);
  }
  wall.innerHTML = `<h2 class="stamp-wall-label">Sky stamps</h2><div class="stamp-grid">${
    stamps.slice(0,30).map(s =>
      `<div class="stamp-tile" title="${s.date}: ${s.temp}° ${s.state}">
        <span class="stamp-glyph">${s.glyph}</span>
        <span class="stamp-temp">${s.temp}°</span>
        <span class="stamp-date">${s.date.slice(5)}</span>
      </div>`
    ).join('')
  }</div>`;
}

// ── clock ─────────────────────────────────────────────────────────────────────
function installClock() {
  const header = document.querySelector('.header');
  if (!header || $('currentClockTime')) return;
  const card = document.createElement('section');
  card.className = 'clock-card';
  card.setAttribute('aria-label','Current time and date');
  card.innerHTML = `
    <div class="clock-label">Current local time</div>
    <time class="clock-time" id="currentClockTime">--:--</time>
    <div class="clock-date" id="currentClockDate">—</div>`;
  header.insertAdjacentElement('afterend', card);
  updateClock();
  setInterval(updateClock, 1000);
}
function updateClock() {
  const te = $('currentClockTime'), de = $('currentClockDate');
  if (!te || !de) return;
  const now = new Date();
  te.textContent = now.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  de.textContent = now.toLocaleDateString([], { weekday:'long', month:'short', day:'numeric' });
}

// ── ambient canvas ────────────────────────────────────────────────────────────
function startAmbient() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = $('ambientCanvas');
  const ctx = canvas.getContext('2d');
  const cfg = weatherState==='rain'||weatherState==='storm'
    ? { count:90, color:'0,229,255', fall:7,    streak:true  }
    : weatherState==='snow'
    ? { count:70, color:'244,234,208', fall:1.1, streak:false }
    : { count:40, color:'212,175,55',  fall:-0.25,streak:false };
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const pts = Array.from({ length: cfg.count }, () => ({
    x: Math.random()*canvas.width, y: Math.random()*canvas.height,
    size: Math.random()*1.8+0.5, alpha: Math.random()*0.55+0.1,
    drift: (Math.random()-0.5)*0.35,
  }));
  if (particleFrame) cancelAnimationFrame(particleFrame);
  function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pts.forEach(p => {
      p.y += cfg.fall; p.x += p.drift;
      if (p.y < -20) p.y = canvas.height+10;
      if (p.y > canvas.height+20) p.y = -10;
      ctx.fillStyle = `rgba(${cfg.color},${p.alpha})`;
      if (cfg.streak) ctx.fillRect(p.x, p.y, p.size, p.size*5);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
    });
    particleFrame = requestAnimationFrame(animate);
  }
  animate();
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (particleFrame) startAmbient(); }, 200);
});

// ── radar chamber ─────────────────────────────────────────────────────────────
function radarSrc(lat, lon) {
  return `https://www.rainviewer.com/map.html?loc=${lat},${lon},7&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&c=3&o=83&lm=1&layer=radar&sm=1&sn=1`;
}
function ensureRadarChamber(lat, lon, storm) {
  const existing = $('radarChamber');
  if (existing) {
    // M4: update iframe src if location drifted
    const iframe = existing.querySelector('.radar-frame');
    if (iframe) {
      const newSrc = radarSrc(lat, lon);
      if (Math.abs(parseFloat(iframe.src.match(/loc=([\d.-]+)/)?.[1]||0) - lat) > 0.05)
        iframe.src = newSrc;
    }
    updateRadarStatus(storm);
    return;
  }
  const anchor = document.querySelector('.rune-row') || document.querySelector('.celestial-times');
  if (!anchor) return;
  const sec = document.createElement('section');
  sec.id = 'radarChamber';
  sec.className = 'radar-chamber';
  sec.innerHTML = `
    <button class="radar-toggle" type="button" aria-expanded="false" aria-controls="radarBody">
      <span>
        <span class="radar-title">Radar Chamber</span>
        <span class="radar-subtitle">Live radar · storm signal</span>
      </span>
      <span class="radar-chevron" aria-hidden="true">⌄</span>
    </button>
    <div class="radar-body" id="radarBody">
      <iframe class="radar-frame" title="Interactive radar" loading="lazy"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups"
        src="${radarSrc(lat, lon)}"></iframe>
      <p class="radar-fallback"><a href="https://www.rainviewer.com" target="_blank" rel="noopener">Open RainViewer ↗</a></p>
      <div class="radar-status">
        <div class="radar-pill"><div class="radar-pill-label">Radar</div><div class="radar-pill-value">RainViewer live</div></div>
        <div class="radar-pill"><div class="radar-pill-label">Storm signal</div><div class="radar-pill-value" id="lightningRiskValue">Reading sky…</div></div>
      </div>
    </div>`;
  anchor.insertAdjacentElement('afterend', sec);
  sec.querySelector('.radar-toggle').addEventListener('click', () => {
    const open = sec.classList.toggle('open');
    sec.querySelector('.radar-toggle').setAttribute('aria-expanded', String(open));
  });
  updateRadarStatus(storm);
}
function updateRadarStatus(storm) {
  const el = $('lightningRiskValue');
  if (!el) return;
  const map = {
    active:  ['ACTIVE — thunderstorm signal present', 'active'],
    passing: ['PASSING — rain/storm energy nearby',   'elevated'],
    watch:   ['WATCHING — moisture building',          'elevated'],
    low:     ['LOW — no strong storm signal',          ''],
  };
  const [txt, cls] = map[storm] || map.low;
  el.textContent = txt;
  el.className = `radar-pill-value${cls?' '+cls:''}`;
}

// ── render ────────────────────────────────────────────────────────────────────
function renderAll(model) {
  const weather = model.raw;
  renderCurrent(model);
  renderHourly(model);
  renderDaily(weather.daily);
  renderCelestial(model);
  renderSignals(model);
  renderPrecipLine(model);
  renderPressure(weather.current.surface_pressure);
  ensureRadarChamber(currentLocation.lat, currentLocation.lon, model.storm);
  renderHourOfRa(getHourOfRa(model.now, model.sunrise, model.sunset));
  checkCrepuscular(model.now, model.sunrise, model.sunset);
  snapshotSkyStamp(weather, model);
  renderStampWall();
  startAmbient();
}

function renderCurrent(model) {
  const c = model.raw.current;
  const [condition, state] = decodeWeather(c.weather_code);
  weatherState = state;
  document.body.dataset.weatherState = state;
  const overlay = $('weatherOverlay');
  if (overlay) overlay.className = `phone-weather-overlay wx-${state}`;

  $('currentTemp').textContent = Math.round(c.temperature_2m);
  $('conditionsText').textContent = condition;
  $('feelsLikeText').textContent = `FEELS ${Math.round(c.apparent_temperature)}°F`;

  // Wind: inject .wind-flow chip + cardinal name + speed
  const windEl = $('windSpeed');
  windEl.innerHTML = `<span class="wind-flow" title="${cardinalName(c.wind_direction_10m)} wind">${cardinalArrow(c.wind_direction_10m)}</span>${Math.round(c.wind_speed_10m)} mph`;

  // Also update aria-label on wind-rose
  const rose = document.querySelector('.wind-rose');
  if (rose) rose.setAttribute('aria-label', `Wind from ${cardinalName(c.wind_direction_10m)}`);

  $('humidityValue').textContent = `${c.relative_humidity_2m}%`;
  $('dewPointVal').textContent = `DEW ${Math.round(c.dew_point_2m)}°F`;

  // UV with context
  if (model.uvNow !== null) {
    const uvLabel = model.uvNow <= 2 ? 'low' : model.uvNow <= 5 ? 'moderate' : model.uvNow <= 7 ? 'high' : 'very high';
    $('uvVal').textContent = `${model.uvNow} ${uvLabel}`;
  } else { $('uvVal').textContent = '—'; }

  // AQI
  if (model.aqiNow !== null) {
    const aqiLabel = model.aqiNow<=50 ? 'good' : model.aqiNow<=100 ? 'moderate' : model.aqiNow<=150 ? 'sensitive' : 'unhealthy';
    $('aqiVal').textContent = `${model.aqiNow} ${aqiLabel}`;
  } else { $('aqiVal').textContent = '—'; }

  // Visibility from current hour (not midnight)
  $('visVal').textContent = model.visNow ? `${(model.visNow/1609.34).toFixed(1)} mi` : '—';
}

function renderHourly(model) {
  const strip = $('hourlyStrip');
  strip.innerHTML = '';
  model.next12.forEach((h) => {
    if (!h.time) return;
    const node = document.createElement('div');
    node.className = 'hour-node';
    node.setAttribute('tabindex','0');
    node.style.background = skyStopColor(h.time, model.sunrise, model.sunset);
    node.innerHTML = `
      <div class="hour-time">${fmtHour(h.time)}</div>
      <div class="hour-temp">${Math.round(h.temp)}°</div>
      <div class="hour-precip-bar"><div class="hour-precip-fill" style="width:${h.precip}%"></div></div>
      <div class="hour-precip-pct">${h.precip}%</div>`;
    strip.appendChild(node);
  });
}

function renderDaily(daily) {
  const strip = $('dailyStrip');
  strip.innerHTML = '';
  const NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const lo = Math.min(...daily.temperature_2m_min.slice(0,7));
  const hi = Math.max(...daily.temperature_2m_max.slice(0,7));
  const spread = hi - lo || 1;
  for (let i = 0; i < 7; i++) {
    // M2 fix: anchor at T12:00:00 so getDay() is correct in negative-offset zones
    const date = new Date(daily.time[i] + 'T12:00:00');
    const min  = Math.round(daily.temperature_2m_min[i]);
    const max  = Math.round(daily.temperature_2m_max[i]);
    const icon = decodeWeather(daily.weather_code[i])[2];
    const left  = ((min - lo) / spread) * 100;
    const width = Math.max(2, ((max - min) / spread) * 100);
    const row = document.createElement('div');
    row.className = 'day-row';
    row.setAttribute('tabindex','0');
    row.innerHTML = `
      <div class="day-name">${i===0?'TODAY':NAMES[date.getDay()]}</div>
      <div class="day-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${icon}"/></svg></div>
      <div class="day-range-bar"><div class="day-range-fill" style="left:${left}%;width:${width}%"></div></div>
      <div class="day-low">${min}°</div>
      <div class="day-high">${max}°</div>`;
    strip.appendChild(row);
  }
}

function renderCelestial(model) {
  const { sunrise, sunset, isDay, goldenDisplay, goldenNote, now } = model;
  $('sunriseTime').textContent = fmtTime(sunrise);
  $('sunsetTime').textContent  = fmtTime(sunset);
  $('riseLabel').textContent   = 'DAWN';
  $('setLabel').textContent    = 'DUSK';

  // M3 fix: show tomorrow's golden hour if today's has passed
  $('skyClock').textContent    = fmtTime(goldenDisplay);
  $('skyClockNote').textContent = goldenNote;

  // M1 fix: hide marker pre-dawn and post-sunset
  const marker = $('arcMarker');
  if (isDay) {
    const t = (now - sunrise) / (sunset - sunrise);
    marker.setAttribute('cx', (1-t)*(1-t)*20 + 2*(1-t)*t*240 + t*t*460);
    marker.setAttribute('cy', (1-t)*(1-t)*60 + 2*(1-t)*t*(-30) + t*t*60);
    marker.style.display = '';
  } else {
    marker.style.display = 'none';
  }

  const phase = moonPhase();
  const orb = document.querySelector('.moon-phase');
  const shadow = $('moonShadow');
  if (orb) orb.className = isDay ? 'moon-phase sun-mode' : 'moon-phase moon-mode';
  if (isDay) {
    if (shadow) shadow.style.display = 'none';
    $('moonPhaseName').textContent = `SUN ABOVE · MOON ${moonPhaseName(phase)}`;
  } else {
    renderMoonPhase(phase);
    $('moonPhaseName').textContent = moonPhaseName(phase);
  }
}

function renderSignals(model) {
  const { next12, bestWindow, storm, narration } = model;
  const c = model.raw.current;
  const h0 = next12[0];
  const score = scoreHour(h0.apparentTemp, h0.wind, h0.precip, h0.vis);

  // Outdoor index (was "Go score")
  $('goScore').textContent = score;
  $('goScoreNote').textContent = score>=82 ? 'Prime pocket for being outside'
    : score>=65 ? 'Usable — check wind and precip' : 'Stay tight unless necessary';

  // Field feel
  let feel='Balanced air', subtext='Comfortable enough to move without overthinking it.';
  if (storm==='active')        { feel='Storm signal active';      subtext='Thunderstorm signal present. Treat outdoor plans as unstable.'; }
  else if (storm==='passing')  { feel='Storm/rain edge passing';  subtext='Rain or storm energy nearby. Watch the next 30–90 minutes.'; }
  else if (h0.precip>=50)      { feel='Wet signal rising';        subtext='The sky is leaning toward rain. Keep plans flexible.'; }
  else if (c.relative_humidity_2m>78&&c.temperature_2m>72) { feel='Heavy warm air'; subtext='Sticky, dense, and slower-feeling. Hydrate and pace it.'; }
  else if (c.wind_speed_10m>18){ feel='Restless wind';            subtext='Movement in the air is high. Watch loose objects and road feel.'; }
  else if (c.temperature_2m<45){ feel='Clean cold edge';          subtext='Crisp air. Layer up, but visibility and stillness may be strong.'; }
  else if (score>=84)          { feel='Open-window weather';      subtext='This is the kind of pocket worth using while it is here.'; }
  $('fieldFeel').textContent    = feel;
  $('fieldSubtext').textContent = subtext;

  // Narration line
  const narEl = $('skyNarration');
  if (narEl) narEl.textContent = narration;

  // Best window
  const bwHour = next12[bestWindow.index];
  if (bwHour?.time) {
    const start = new Date(bwHour.time);
    const end   = new Date(start.getTime() + 90*60000);
    $('bestWindow').textContent = `${fmtTime(start)} – ${fmtTime(end)}`;
    $('bestWindowNote').textContent = bestWindow.score>=80 ? 'Best 90-minute pocket.'
      : bestWindow.score>=60 ? 'Best available window, but not ideal.'
      : 'No clean window yet — keep watching.';
  }
}

function renderPrecipLine(model) {
  const { peakPrecip, storm } = model;
  const el = $('minutelyText');
  if (storm==='active')        { el.textContent='Storm signal active nearby';        el.className='minutely-precip precip storm-active'; }
  else if (storm==='passing')  { el.textContent='Rain / storm edge may be passing';  el.className='minutely-precip precip'; }
  else if (peakPrecip>=50)     { el.textContent=`${peakPrecip}% chance next 2 hr`;   el.className='minutely-precip precip'; }
  else if (peakPrecip>=20)     { el.textContent=`${peakPrecip}% light chance next 2 hr`; el.className='minutely-precip precip'; }
  else                         { el.textContent='Clear for the next hour';            el.className='minutely-precip clear'; }
}

function renderPressure(hPa) {
  const trend = derivePressureTrend(hPa);
  $('pressureValue').textContent = `${Math.round(hPa)} hPa`;
  $('pressureOmen').textContent  = trend.label;
  $('pressureTrend').textContent = trend.note;
}

// ── init ──────────────────────────────────────────────────────────────────────
async function initTelemetry() {
  // M5: abort any in-flight sync
  if (syncController) syncController.abort();
  syncController = new AbortController();
  const { signal } = syncController;

  const btn = $('syncBtn');
  if (btn) { btn.textContent='SYNCING…'; btn.disabled=true; }

  $('demoBanner').classList.remove('show');

  const lat = currentLocation.lat;
  const lon = currentLocation.lon;

  // Fetch AQI + NWS alerts in parallel (non-blocking on failure)
  const [aqiRes, alertRes] = await Promise.allSettled([
    fetchAqi(lat, lon, signal),
    fetchNwsAlerts(lat, lon, signal),
  ]);
  const aqi    = aqiRes.status==='fulfilled'   ? aqiRes.value   : null;
  const alerts = alertRes.status==='fulfilled' ? alertRes.value : [];
  renderNwsAlerts(alerts);

  let weather = null, errorMsg = '';
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${lat}&longitude=${lon}`
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,dew_point_2m'
      + '&hourly=temperature_2m,apparent_temperature,wind_speed_10m,precipitation_probability,visibility'
      + '&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max'
      + '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto',
      { signal }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    weather = await r.json();
  } catch (err) {
    if (err.name==='AbortError') return;
    errorMsg = err.message || String(err);
  }

  if (!weather) {
    weather = generateDemoData();
    const banner = $('demoBanner');
    if (banner) {
      banner.querySelector('div').textContent = '◆ Showing sample atmosphere — couldn\'t reach the live feed ◆';
      banner.classList.add('show');
      $('demoBannerDetail').textContent = errorMsg || 'Network unavailable.';
    }
  }

  const model = modelForecast(weather, aqi);
  renderAll(model);
  $('lastSyncTime').textContent = `SYNC ${fmtTime(new Date())}`;
  if (btn) { btn.textContent='RESYNC'; btn.disabled=false; }
}

// ── boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  installClock();
  $('locationLine').textContent = `LOC: ${currentLocation.name}`;
  installLocationButton();
  initTelemetry();
});

$('syncBtn')?.addEventListener('click', initTelemetry);
