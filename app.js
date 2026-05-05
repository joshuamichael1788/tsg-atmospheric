const FALLBACK = { lat: 39.2467, lon: -94.4194, name: 'LIBERTY, MO' };
let currentLocation = { ...FALLBACK };
let weatherState = 'clear';
let particleFrame = null;

const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const WMO = {
  0: ['CLEAR', 'clear', 'wxClear'],
  1: ['MAINLY CLEAR', 'clear', 'wxClear'],
  2: ['PARTLY CLOUDY', 'cloudy', 'wxPartlyCloudy'],
  3: ['OVERCAST', 'cloudy', 'wxCloudy'],
  45: ['FOG', 'cloudy', 'wxFog'],
  48: ['RIME FOG', 'cloudy', 'wxFog'],
  51: ['LIGHT DRIZZLE', 'rain', 'wxRain'],
  53: ['DRIZZLE', 'rain', 'wxRain'],
  55: ['DENSE DRIZZLE', 'rain', 'wxRain'],
  61: ['LIGHT RAIN', 'rain', 'wxRain'],
  63: ['RAIN', 'rain', 'wxRain'],
  65: ['HEAVY RAIN', 'rain', 'wxRain'],
  71: ['LIGHT SNOW', 'snow', 'wxSnow'],
  73: ['SNOW', 'snow', 'wxSnow'],
  75: ['HEAVY SNOW', 'snow', 'wxSnow'],
  80: ['SHOWERS', 'rain', 'wxRain'],
  81: ['HEAVY SHOWERS', 'rain', 'wxRain'],
  82: ['VIOLENT SHOWERS', 'storm', 'wxStorm'],
  95: ['THUNDERSTORM', 'storm', 'wxStorm'],
  96: ['STORM W/ HAIL', 'storm', 'wxStorm'],
  99: ['STORM W/ HAIL', 'storm', 'wxStorm']
};

function decodeWeather(code) {
  return WMO[code] || ['UNKNOWN', 'clear', 'wxClear'];
}

function fmtTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function fmtHour(value) {
  const date = new Date(value);
  let hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}${suffix}`;
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...FALLBACK, name: 'LIBERTY FALLBACK' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name: 'CURRENT POSITION'
      }),
      () => resolve({ ...FALLBACK, name: 'LIBERTY FALLBACK' }),
      { timeout: 4500, maximumAge: 600000 }
    );
  });
}

function generateDemoData() {
  const now = new Date();
  const hourly = { time: [], temperature_2m: [], precipitation_probability: [], visibility: [] };

  for (let i = 0; i < 24; i += 1) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    hourly.time.push(time.toISOString());
    hourly.temperature_2m.push(Math.round(68 + Math.sin((i + now.getHours()) / 24 * Math.PI * 2) * 8));
    hourly.precipitation_probability.push(i < 4 ? 8 : i < 8 ? 28 : i < 12 ? 44 : 16);
    hourly.visibility.push(15000);
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daily = {
    time: [], temperature_2m_max: [], temperature_2m_min: [], weather_code: [],
    uv_index_max: [], sunrise: [], sunset: [], precipitation_probability_max: []
  };
  const codes = [1, 2, 61, 80, 3, 1, 0];

  for (let i = 0; i < 7; i += 1) {
    const day = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    daily.time.push(day.toISOString().split('T')[0]);
    daily.temperature_2m_max.push(72 + Math.round(Math.sin(i) * 6));
    daily.temperature_2m_min.push(58 + Math.round(Math.sin(i) * 4));
    daily.weather_code.push(codes[i]);
    daily.uv_index_max.push(5 + Math.round(Math.sin(i) * 2));
    daily.sunrise.push(new Date(day.getTime() + 6.4 * 60 * 60 * 1000).toISOString());
    daily.sunset.push(new Date(day.getTime() + 19.9 * 60 * 60 * 1000).toISOString());
    daily.precipitation_probability_max.push(20 + Math.round(Math.sin(i) * 30));
  }

  return {
    current: {
      temperature_2m: 71,
      apparent_temperature: 69,
      relative_humidity_2m: 58,
      surface_pressure: 1014,
      wind_speed_10m: 8,
      wind_direction_10m: 215,
      weather_code: 2,
      dew_point_2m: 54
    },
    hourly,
    daily
  };
}

async function initTelemetry() {
  $('demoBanner').classList.remove('show');
  currentLocation = await getLocation();
  $('locationLine').textContent = `LOC: ${currentLocation.name}`;

  let weather = null;
  let errorMessage = '';

  try {
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${currentLocation.lat}&longitude=${currentLocation.lon}`
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,dew_point_2m'
      + '&hourly=temperature_2m,precipitation_probability,visibility'
      + '&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max'
      + '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto';

    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
    weather = await response.json();
  } catch (error) {
    errorMessage = error.message || String(error);
  }

  if (!weather) {
    weather = generateDemoData();
    $('demoBanner').classList.add('show');
    $('demoBannerDetail').textContent = errorMessage ? `Reason: ${errorMessage}` : 'Network blocked or no response.';
  }

  renderAll(weather);
}

function renderAll(weather) {
  renderCurrent(weather);
  renderHourly(weather.hourly);
  renderDaily(weather.daily);
  renderCelestial(weather.daily);
  renderSignals(weather);
  renderPrecipLine(weather);
  renderPressure(weather.current.surface_pressure);
  $('lastSyncTime').textContent = `SYNC ${fmtTime(new Date())}`;
  startAmbient();
}

function renderCurrent(weather) {
  const current = weather.current;
  const [condition, state] = decodeWeather(current.weather_code);
  weatherState = state;

  $('currentTemp').textContent = Math.round(current.temperature_2m);
  $('conditionsText').textContent = condition;
  $('feelsLikeText').textContent = `FEELS ${Math.round(current.apparent_temperature)}°F`;
  $('windSpeed').textContent = `${Math.round(current.wind_speed_10m)} mph`;
  $('windNeedle').style.transform = `rotate(${current.wind_direction_10m}deg)`;
  $('humidityValue').textContent = `${current.relative_humidity_2m}%`;
  $('dewPointVal').textContent = `DEW ${Math.round(current.dew_point_2m)}°F`;
  $('uvVal').textContent = weather.daily.uv_index_max?.[0] ?? '—';
  $('visVal').textContent = weather.hourly.visibility?.[0] ? `${(weather.hourly.visibility[0] / 1609.34).toFixed(1)}mi` : '—';
  $('aqiVal').textContent = '—';
}

function renderHourly(hourly) {
  const strip = $('hourlyStrip');
  strip.innerHTML = '';

  for (let i = 0; i < Math.min(12, hourly.time.length); i += 1) {
    const precipitation = hourly.precipitation_probability[i] ?? 0;
    const node = document.createElement('div');
    node.className = 'hour-node';
    node.innerHTML = `
      <div class="hour-time">${fmtHour(hourly.time[i])}</div>
      <div class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</div>
      <div class="hour-precip-bar"><div class="hour-precip-fill" style="width:${precipitation}%"></div></div>
      <div class="hour-precip-pct">${precipitation}%</div>`;
    strip.appendChild(node);
  }
}

function renderDaily(daily) {
  const strip = $('dailyStrip');
  strip.innerHTML = '';
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const low = Math.min(...daily.temperature_2m_min.slice(0, 7));
  const high = Math.max(...daily.temperature_2m_max.slice(0, 7));
  const spread = high - low || 1;

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(daily.time[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const icon = decodeWeather(daily.weather_code[i])[2];
    const left = ((min - low) / spread) * 100;
    const width = Math.max(2, ((max - min) / spread) * 100);
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <div class="day-name">${i === 0 ? 'TODAY' : dayNames[date.getDay()]}</div>
      <div class="day-icon"><svg viewBox="0 0 24 24"><use href="#${icon}"/></svg></div>
      <div class="day-range-bar"><div class="day-range-fill" style="left:${left}%;width:${width}%"></div></div>
      <div class="day-low">${min}°</div>
      <div class="day-high">${max}°</div>`;
    strip.appendChild(row);
  }
}

function renderCelestial(daily) {
  const sunrise = new Date(daily.sunrise[0]);
  const sunset = new Date(daily.sunset[0]);
  $('sunriseTime').textContent = fmtTime(sunrise);
  $('sunsetTime').textContent = fmtTime(sunset);
  $('riseLabel').textContent = `↑ ${fmtTime(sunrise)}`;
  $('setLabel').textContent = `${fmtTime(sunset)} ↓`;

  const goldenStart = new Date(sunset.getTime() - 60 * 60 * 1000);
  const blueEnd = new Date(sunset.getTime() + 35 * 60 * 1000);
  $('skyClock').textContent = fmtTime(goldenStart);
  $('skyClockNote').textContent = `Golden into blue hour until ${fmtTime(blueEnd)}`;

  const marker = $('arcMarker');
  const now = new Date();
  const dayLength = sunset - sunrise;
  const elapsed = now - sunrise;

  if (elapsed >= 0 && elapsed <= dayLength) {
    const t = elapsed / dayLength;
    const x = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 240 + t * t * 460;
    const y = (1 - t) * (1 - t) * 60 + 2 * (1 - t) * t * -30 + t * t * 60;
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
  }
}

function scoreHour(temp, precipitation, visibility) {
  let score = 100;
  score -= Math.abs(temp - 72) * 1.4;
  score -= precipitation * 0.75;
  if (visibility < 5000) score -= 18;
  return clamp(Math.round(score), 0, 100);
}

function renderSignals(weather) {
  const current = weather.current;
  const hourly = weather.hourly;
  const precipitation = hourly.precipitation_probability[0] ?? 0;
  const visibility = hourly.visibility[0] ?? 15000;
  const score = scoreHour(current.apparent_temperature, precipitation, visibility);

  $('goScore').textContent = score;
  $('goScoreNote').textContent = score >= 82 ? 'Prime pocket for being outside' : score >= 65 ? 'Usable, but check wind/precip' : 'Stay tight unless necessary';

  let feel = 'Balanced air';
  let subtext = 'Comfortable enough to move without overthinking it.';

  if (precipitation >= 50) {
    feel = 'Wet signal rising';
    subtext = 'The sky is leaning toward rain. Keep plans flexible.';
  } else if (current.relative_humidity_2m > 78 && current.temperature_2m > 72) {
    feel = 'Heavy warm air';
    subtext = 'Sticky, dense, and slower-feeling. Hydrate and pace it.';
  } else if (current.wind_speed_10m > 18) {
    feel = 'Restless wind';
    subtext = 'Movement in the air is high. Watch loose objects and road feel.';
  } else if (current.temperature_2m < 45) {
    feel = 'Clean cold edge';
    subtext = 'Crisp air. Layer up, but visibility and stillness may be strong.';
  } else if (score >= 84) {
    feel = 'Open-window weather';
    subtext = 'This is the kind of pocket worth using while it is here.';
  }

  $('fieldFeel').textContent = feel;
  $('fieldSubtext').textContent = subtext;

  let best = { score: -1, index: 0 };
  for (let i = 0; i < Math.min(12, hourly.time.length); i += 1) {
    const hourScore = scoreHour(hourly.temperature_2m[i], hourly.precipitation_probability[i] || 0, hourly.visibility[i] || 15000);
    if (hourScore > best.score) best = { score: hourScore, index: i };
  }

  const start = new Date(hourly.time[best.index]);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  $('bestWindow').textContent = `${fmtTime(start)} – ${fmtTime(end)}`;
  $('bestWindowNote').textContent = best.score >= 80 ? 'Best 90-minute adventure pocket nearby.' : best.score >= 60 ? 'Best available window, but not perfect.' : 'No clean window yet. Keep watching the sky.';
}

function renderPrecipLine(weather) {
  const peak = Math.max(weather.hourly.precipitation_probability[0] || 0, weather.hourly.precipitation_probability[1] || 0);
  const element = $('minutelyText');
  if (peak >= 50) {
    element.textContent = `${peak}% precipitation chance next 2hr`;
    element.className = 'minutely-precip precip';
  } else if (peak >= 20) {
    element.textContent = `${peak}% light chance next 2hr`;
    element.className = 'minutely-precip precip';
  } else {
    element.textContent = 'clear for the next hour';
    element.className = 'minutely-precip clear';
  }
}

function renderPressure(pressure) {
  $('pressureValue').textContent = `${Math.round(pressure)} hPa`;
  $('pressureOmen').textContent = 'Listening';
  $('pressureTrend').textContent = 'Pressure memory begins after repeated syncs';
}

function startAmbient() {
  const canvas = $('ambientCanvas');
  const context = canvas.getContext('2d');
  const config = weatherState === 'rain' || weatherState === 'storm'
    ? { count: 75, color: '0,229,255', fall: 6, streak: true }
    : { count: 40, color: '212,175,55', fall: -0.25, streak: false };

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = Array.from({ length: config.count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.8 + 0.5,
    alpha: Math.random() * 0.55 + 0.1,
    drift: (Math.random() - 0.5) * 0.35
  }));

  if (particleFrame) cancelAnimationFrame(particleFrame);

  function animate() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((particle) => {
      particle.y += config.fall;
      particle.x += particle.drift;
      if (particle.y < -20) particle.y = canvas.height + 10;
      if (particle.y > canvas.height + 20) particle.y = -10;
      context.fillStyle = `rgba(${config.color}, ${particle.alpha})`;
      if (config.streak) context.fillRect(particle.x, particle.y, particle.size, particle.size * 5);
      else {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
    });
    particleFrame = requestAnimationFrame(animate);
  }

  animate();
}

$('syncBtn')?.addEventListener('click', initTelemetry);
window.addEventListener('load', initTelemetry);
