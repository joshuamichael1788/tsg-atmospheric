const FALLBACK = { lat: 39.2467, lon: -94.4194, name: 'Liberty, MO' };
let locationState = { ...FALLBACK };
let weatherState = 'clear';
let particleFrame = null;

const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const WMO = {
  0: ['Clear', 'clear', 'wxClear'], 1: ['Mainly clear', 'clear', 'wxClear'], 2: ['Partly cloudy', 'cloudy', 'wxPartly'], 3: ['Overcast', 'cloudy', 'wxCloud'],
  45: ['Fog', 'cloudy', 'wxFog'], 48: ['Rime fog', 'cloudy', 'wxFog'], 51: ['Light drizzle', 'rain', 'wxRain'], 53: ['Drizzle', 'rain', 'wxRain'], 55: ['Dense drizzle', 'rain', 'wxRain'],
  61: ['Light rain', 'rain', 'wxRain'], 63: ['Rain', 'rain', 'wxRain'], 65: ['Heavy rain', 'rain', 'wxRain'],
  71: ['Light snow', 'snow', 'wxSnow'], 73: ['Snow', 'snow', 'wxSnow'], 75: ['Heavy snow', 'snow', 'wxSnow'], 77: ['Snow grains', 'snow', 'wxSnow'],
  80: ['Showers', 'rain', 'wxRain'], 81: ['Heavy showers', 'rain', 'wxRain'], 82: ['Violent showers', 'storm', 'wxStorm'],
  95: ['Thunderstorm', 'storm', 'wxStorm'], 96: ['Storm with hail', 'storm', 'wxStorm'], 99: ['Storm with hail', 'storm', 'wxStorm']
};

function decodeWeather(code) { return WMO[code] || ['Unknown', 'clear', 'wxClear']; }
function fmtTime(value) { const d = value instanceof Date ? value : new Date(value); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m} ${ap}`; }
function fmtHour(value) { const d = new Date(value); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}${ap}`; }
function title(text) { return String(text || '').toUpperCase(); }

function startClock() {
  function tick() {
    const now = new Date();
    $('clockTime').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    $('clockDate').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ...FALLBACK });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Current area' }),
      () => resolve({ ...FALLBACK }),
      { timeout: 4500, maximumAge: 600000 }
    );
  });
}

async function resolvePlaceName(loc) {
  if (loc.name !== 'Current area') return loc.name;
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.lat}&longitude=${loc.lon}&localityLanguage=en`);
    if (!res.ok) throw new Error('reverse geocode failed');
    const data = await res.json();
    const city = data.city || data.locality || data.principalSubdivision || 'Current area';
    const state = String(data.principalSubdivisionCode || data.principalSubdivision || '').replace(/^US-/, '');
    return state ? `${city}, ${state}` : city;
  } catch { return 'Current area'; }
}

async function fetchWeather(loc) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,dew_point_2m'
    + '&hourly=temperature_2m,precipitation_probability,visibility'
    + '&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max'
    + '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
  return res.json();
}

function generateDemoData() {
  const now = new Date();
  const hourly = { time: [], temperature_2m: [], precipitation_probability: [], visibility: [] };
  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() + i * 3600000);
    hourly.time.push(t.toISOString());
    hourly.temperature_2m.push(Math.round(62 + Math.sin((i + now.getHours()) / 24 * Math.PI * 2) * 9));
    hourly.precipitation_probability.push(i < 4 ? 35 : i < 8 ? 22 : i < 12 ? 8 : 12);
    hourly.visibility.push(14000);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daily = { time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [], uv_index_max: [], sunrise: [], sunset: [], precipitation_probability_max: [] };
  const codes = [61, 2, 3, 0, 80, 1, 2];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    daily.time.push(d.toISOString().split('T')[0]);
    daily.temperature_2m_max.push(61 + Math.round(Math.sin(i * 1.1) * 7) + i);
    daily.temperature_2m_min.push(47 + Math.round(Math.sin(i) * 5));
    daily.weather_code.push(codes[i]);
    daily.uv_index_max.push(3 + Math.round(Math.sin(i) * 2));
    daily.sunrise.push(new Date(d.getTime() + 6.25 * 3600000).toISOString());
    daily.sunset.push(new Date(d.getTime() + 20.2 * 3600000).toISOString());
    daily.precipitation_probability_max.push(20 + Math.round(Math.sin(i * 1.4) * 25));
  }
  return { current: { temperature_2m: 52, apparent_temperature: 46, relative_humidity_2m: 83, surface_pressure: 983, wind_speed_10m: 10, wind_direction_10m: 45, weather_code: 61, dew_point_2m: 45 }, hourly, daily };
}

function stormLevel(wx) {
  const code = wx.current.weather_code;
  const precip = wx.hourly.precipitation_probability[0] || 0;
  if ([82,95,96,99].includes(code)) return ['Active', 'Thunderstorm signal present. Stay tight outdoors.'];
  if ([61,63,65,80,81].includes(code) || precip >= 50) return ['Passing', 'Rain/storm edge may be nearby or moving through.'];
  if (precip >= 30) return ['Watch', 'Moisture signal is building. Watch the sky.'];
  return ['Low', 'No strong storm signal right now.'];
}

function outdoorScore(temp, precip, visibility) {
  let score = 100;
  score -= Math.abs(temp - 72) * 1.35;
  score -= precip * 0.8;
  if (visibility < 5000) score -= 18;
  return clamp(Math.round(score), 0, 100);
}

function windDir(deg) { const dirs = ['N','NE','E','SE','S','SW','W','NW']; return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }
function moonPhase(date = new Date()) { const ref = new Date('2000-01-06T18:14:00Z').getTime(); const syn = 29.530588853 * 86400000; const diff = date.getTime() - ref; return ((diff % syn) + syn) % syn / syn; }
function moonName(p) { if (p < .03 || p > .97) return 'New moon'; if (p < .22) return 'Waxing crescent'; if (p < .28) return 'First quarter'; if (p < .47) return 'Waxing gibbous'; if (p < .53) return 'Full moon'; if (p < .72) return 'Waning gibbous'; if (p < .78) return 'Last quarter'; return 'Waning crescent'; }

function renderWeather(wx) {
  const c = wx.current;
  const [condition, state, icon] = decodeWeather(c.weather_code);
  weatherState = state;
  document.body.dataset.weatherState = state;
  $('weatherVeil').className = state;

  $('currentTemp').textContent = Math.round(c.temperature_2m);
  $('conditionText').textContent = title(condition);
  $('feelsText').textContent = `FEELS ${Math.round(c.apparent_temperature)}°F`;
  $('windSpeed').textContent = `${Math.round(c.wind_speed_10m)} mph`;
  $('windDirection').textContent = `From ${windDir(c.wind_direction_10m)}`;
  $('windArrow').style.transform = `rotate(${(c.wind_direction_10m + 180) % 360}deg)`;

  const precip = wx.hourly.precipitation_probability[0] || 0;
  const vis = wx.hourly.visibility[0] || 15000;
  const score = outdoorScore(c.apparent_temperature, precip, vis);
  const [storm, stormNote] = stormLevel(wx);
  $('goScore').textContent = score;
  $('goScoreNote').textContent = score >= 82 ? 'Prime pocket for being outside.' : score >= 62 ? 'Usable, but watch the sky.' : 'Stay tight unless necessary.';
  $('stormSignal').textContent = storm;
  $('stormNote').textContent = stormNote;

  let feel = 'Balanced air';
  let note = 'Comfortable enough to move without overthinking it.';
  if (storm === 'Active') { feel = 'Storm signal active'; note = 'Thunderstorm signal is present. Outdoor plans are unstable.'; }
  else if (storm === 'Passing') { feel = 'Rain/storm edge may be passing'; note = 'Rain energy is nearby. Watch the next 30–90 minutes.'; }
  else if (precip >= 30) { feel = 'Wet signal rising'; note = 'The sky is leaning damp. Keep plans flexible.'; }
  else if (c.wind_speed_10m > 18) { feel = 'Restless wind'; note = 'Movement in the air is high. Watch loose objects and road feel.'; }
  else if (score >= 84) { feel = 'Open-window weather'; note = 'This is the kind of pocket worth using while it is here.'; }
  $('fieldFeel').textContent = title(feel);
  $('fieldNote').textContent = note;

  const best = bestWindow(wx.hourly);
  $('bestWindow').textContent = `${fmtTime(best.start)} – ${fmtTime(best.end)}`;
  $('bestWindowNote').textContent = best.score >= 80 ? 'Cleanest 90-minute pocket nearby.' : best.score >= 60 ? 'Best available window, but not perfect.' : 'No clean window yet. Keep watching.';

  renderSunMoon(wx.daily);
  renderHourly(wx.hourly);
  renderDaily(wx.daily);
  renderMetrics(wx);
  renderRadar();
  startParticles();
  $('lastSync').textContent = `SYNC ${fmtTime(new Date())}`;
}

function bestWindow(hourly) {
  let best = { score: -1, index: 0 };
  for (let i = 0; i < Math.min(12, hourly.time.length); i++) {
    const score = outdoorScore(hourly.temperature_2m[i], hourly.precipitation_probability[i] || 0, hourly.visibility[i] || 15000);
    if (score > best.score) best = { score, index: i };
  }
  const start = new Date(hourly.time[best.index]);
  return { score: best.score, start, end: new Date(start.getTime() + 90 * 60000) };
}

function renderSunMoon(daily) {
  const sunrise = new Date(daily.sunrise[0]);
  const sunset = new Date(daily.sunset[0]);
  $('sunriseTime').textContent = fmtTime(sunrise);
  $('sunsetTime').textContent = fmtTime(sunset);
  const golden = new Date(sunset.getTime() - 60 * 60000);
  const blueEnd = new Date(sunset.getTime() + 35 * 60000);
  $('goldenHour').textContent = fmtTime(golden);
  $('goldenNote').textContent = `Golden into blue until ${fmtTime(blueEnd)}`;

  const now = new Date();
  const elapsed = now - sunrise;
  const dayLength = sunset - sunrise;
  const marker = $('sunMarker');
  if (elapsed >= 0 && elapsed <= dayLength) {
    const t = elapsed / dayLength;
    const x = (1 - t) * (1 - t) * 15 + 2 * (1 - t) * t * 150 + t * t * 285;
    const y = (1 - t) * (1 - t) * 58 + 2 * (1 - t) * t * -18 + t * t * 58;
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
  }

  const p = moonPhase();
  $('moonPhaseName').textContent = title(moonName(p));
  const shadow = $('moonShadow');
  const illum = 1 - Math.abs(p - .5) * 2;
  shadow.style.left = p < .5 ? `${illum * 100}%` : 'auto';
  shadow.style.right = p >= .5 ? `${illum * 100}%` : 'auto';
}

function renderHourly(hourly) {
  const strip = $('hourlyStrip');
  strip.innerHTML = '';
  for (let i = 0; i < Math.min(12, hourly.time.length); i++) {
    const pop = hourly.precipitation_probability[i] || 0;
    const node = document.createElement('div');
    node.className = 'hour-node';
    node.innerHTML = `<span class="hour-time">${fmtHour(hourly.time[i])}</span><span class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</span><span class="hour-bar"><i style="width:${pop}%"></i></span><span class="hour-pop">${pop}%</span>`;
    strip.appendChild(node);
  }
}

function renderDaily(daily) {
  const list = $('dailyList');
  list.innerHTML = '';
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const highs = daily.temperature_2m_max.slice(0,7);
  const minH = Math.min(...highs);
  const maxH = Math.max(...highs);
  const span = Math.max(1, maxH - minH);
  for (let i = 0; i < 7; i++) {
    const date = new Date(daily.time[i]);
    const lo = Math.round(daily.temperature_2m_min[i]);
    const hi = Math.round(daily.temperature_2m_max[i]);
    const icon = decodeWeather(daily.weather_code[i])[2];
    const width = 38 + ((hi - minH) / span) * 62;
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `<span class="day-name">${i === 0 ? 'TODAY' : days[date.getDay()]}</span><span class="day-icon"><svg><use href="#${icon}"></use></svg></span><span class="day-bar"><i style="width:${Math.round(width)}%"></i></span><span class="day-low">${lo}°</span><span class="day-high">${hi}°</span>`;
    list.appendChild(row);
  }
}

function renderMetrics(wx) {
  const c = wx.current;
  $('pressureValue').textContent = `${Math.round(c.surface_pressure)} hPa`;
  $('humidityValue').textContent = `${c.relative_humidity_2m}%`;
  $('dewPointValue').textContent = `Dew ${Math.round(c.dew_point_2m)}°F`;
  $('uvValue').textContent = wx.daily.uv_index_max?.[0] ?? '—';
  $('visibilityValue').textContent = wx.hourly.visibility?.[0] ? `${(wx.hourly.visibility[0] / 1609.34).toFixed(1)} mi` : '—';
}

function renderRadar() {
  const frame = $('radarFrame');
  if (!frame.src) {
    frame.src = `https://www.rainviewer.com/map.html?loc=${locationState.lat},${locationState.lon},7&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&c=3&o=83&lm=1&layer=radar&sm=1&sn=1`;
  }
}

function startParticles() {
  const canvas = $('weatherCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const mode = weatherState;
  const count = mode === 'rain' || mode === 'storm' ? 70 : mode === 'snow' ? 55 : 32;
  const particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.8 + .6,
    speed: mode === 'rain' || mode === 'storm' ? Math.random() * 3 + 5 : mode === 'snow' ? Math.random() * 1 + .7 : -(Math.random() * .45 + .1),
    drift: (Math.random() - .5) * (mode === 'rain' || mode === 'storm' ? 1.2 : .35),
    alpha: Math.random() * .42 + .12
  }));
  if (particleFrame) cancelAnimationFrame(particleFrame);
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for (const p of particles) {
      p.x += p.drift;
      p.y += p.speed;
      if (p.y > canvas.height + 20) p.y = -10;
      if (p.y < -20) p.y = canvas.height + 10;
      if (p.x < -20) p.x = canvas.width + 10;
      if (p.x > canvas.width + 20) p.x = -10;
      if (mode === 'rain' || mode === 'storm') {
        ctx.strokeStyle = `rgba(0,229,255,${p.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 6, p.y + 18); ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${mode === 'snow' ? '244,234,208' : '212,175,55'},${p.alpha})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      }
    }
    particleFrame = requestAnimationFrame(draw);
  }
  draw();
}

async function init() {
  startClock();
  $('syncButton').addEventListener('click', initWeather);
  await initWeather();
}

async function initWeather() {
  $('locationText').textContent = 'Resolving position...';
  locationState = await getLocation();
  locationState.name = await resolvePlaceName(locationState);
  $('locationText').textContent = `LOC: ${title(locationState.name)}`;
  try {
    const wx = await fetchWeather(locationState);
    renderWeather(wx);
  } catch (err) {
    console.warn(err);
    $('locationText').textContent = `LOC: ${title(FALLBACK.name)} · DEMO MODE`;
    locationState = { ...FALLBACK };
    renderWeather(generateDemoData());
  }
}

window.addEventListener('load', init);
window.addEventListener('resize', () => startParticles());
