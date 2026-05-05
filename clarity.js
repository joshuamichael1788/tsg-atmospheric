function installClarityStyles() {
  if (document.getElementById('clarityStyles')) return;
  const style = document.createElement('style');
  style.id = 'clarityStyles';
  style.textContent = `
    .weather-foreground-overlay{position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden;opacity:.13}.weather-foreground-overlay:before,.weather-foreground-overlay:after{content:'';position:absolute;inset:-18%;pointer-events:none}.weather-foreground-overlay.rain:before,.weather-foreground-overlay.storm:before{background-image:radial-gradient(ellipse at center,rgba(0,229,255,.38) 0 18%,rgba(0,229,255,0) 58%);background-size:18px 46px;background-position:0 0;transform:skewX(-16deg);animation:fgRainSoft .95s linear infinite}.weather-foreground-overlay.rain:after,.weather-foreground-overlay.storm:after{background-image:linear-gradient(105deg,rgba(244,234,208,0) 0 44%,rgba(244,234,208,.18) 48%,rgba(244,234,208,0) 54%);background-size:32px 74px;transform:skewX(-16deg);animation:fgRainSoft 1.35s linear infinite}.weather-foreground-overlay.storm{opacity:.16}.weather-foreground-overlay.snow:before{background-image:radial-gradient(circle,rgba(244,234,208,.8) 1px,transparent 1.6px),radial-gradient(circle,rgba(244,234,208,.52) 1px,transparent 1.7px);background-size:36px 36px,58px 58px;animation:fgSnow 9s linear infinite}.weather-foreground-overlay.clear:before{background:radial-gradient(circle at 82% 12%,rgba(240,200,80,.2),rgba(240,200,80,.06) 18%,transparent 40%);animation:fgSun 5s ease-in-out infinite}.weather-foreground-overlay.cloudy:before{background:radial-gradient(ellipse at 20% 12%,rgba(216,200,154,.08),transparent 36%),radial-gradient(ellipse at 82% 10%,rgba(216,200,154,.07),transparent 42%);animation:fgCloud 14s ease-in-out infinite}
    @keyframes fgRainSoft{to{background-position:-38px 120px}}@keyframes fgSnow{to{background-position:0 130px,45px 190px}}@keyframes fgSun{50%{opacity:.55;transform:scale(1.03)}}@keyframes fgCloud{50%{transform:translateX(3%)}}
    .hub-container,.clock-card,.sky-brief,.signal-card,.metric-card,.rune,.celestial-times,.minutely-precip,.radar-chamber{backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
    .wind-rose{display:none!important}.cluster{justify-content:center;margin-top:8px}.wind-speed{margin-top:4px;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;line-height:1.15}.wind-flow{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border:1px solid rgba(0,229,255,.56);border-radius:999px;color:var(--teal);filter:drop-shadow(0 0 6px rgba(0,229,255,.38));font-size:1rem;transform-origin:center;flex:0 0 auto}.wind-from{color:var(--papyrus);font-size:.58rem;letter-spacing:1px;white-space:nowrap}.day-range-fill{left:0!important;width:100%!important;opacity:.78}.day-range-bar{background:rgba(216,200,154,.16)!important}.day-legend,.radar-loop-note,.pressure-help{color:#c9bb91;font-size:.56rem;line-height:1.35;letter-spacing:.7px}.day-legend{margin:-2px 0 8px;text-align:center;text-transform:uppercase}.day-legend strong,.pressure-help strong{color:var(--gold2);font-weight:600}.radar-body::after{display:none!important}.radar-loop-ui{margin-top:10px;padding-top:11px;border-top:1px solid rgba(216,200,154,.16)}.radar-loop-label{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;color:var(--papyrus);font-size:.5rem;letter-spacing:.8px;text-transform:uppercase;margin-bottom:7px;text-align:center}.radar-loop-track-real{position:relative;height:5px;border-radius:999px;background:rgba(216,200,154,.18);overflow:hidden}.radar-loop-track-real i{position:absolute;inset:0 auto 0 0;width:28%;border-radius:999px;background:linear-gradient(90deg,var(--teal),var(--gold2));animation:clarityRadarSweep 4.2s ease-in-out infinite}@keyframes clarityRadarSweep{0%{transform:translateX(-110%)}100%{transform:translateX(440%)}}.pressure-help{margin-top:5px}.build-visible{opacity:.85;color:var(--teal2)!important}
  `;
  document.head.appendChild(style);
}

function getWindDirectionLabel(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function readWindDegrees() {
  const raw = document.getElementById('windNeedle')?.style?.transform || '';
  const match = raw.match(/rotate\(([-0-9.]+)deg\)/);
  return match ? Number(match[1]) : 0;
}

function ensureForegroundWeather() {
  let overlay = document.getElementById('weatherForegroundOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'weatherForegroundOverlay';
    overlay.className = 'weather-foreground-overlay clear';
    document.body.appendChild(overlay);
  }
  const state = document.body.dataset.weatherState || 'clear';
  overlay.className = `weather-foreground-overlay ${state}`;
}

function patchWindArrow() {
  const wind = document.getElementById('windSpeed');
  if (!wind) return;
  const degFrom = readWindDegrees();
  const degTo = (degFrom + 180) % 360;
  const fromLabel = getWindDirectionLabel(degFrom);
  const speedMatch = wind.textContent.match(/(\d+(?:\.\d+)?)\s*mph/i);
  const speed = speedMatch ? `${Math.round(Number(speedMatch[1]))} mph` : '— mph';
  wind.innerHTML = `<span class="wind-flow" style="transform:rotate(${degTo}deg)">↑</span><span>${speed}</span><span class="wind-from">FROM ${fromLabel}</span>`;
}

function patchDayLegend() {
  const label = [...document.querySelectorAll('.strip-label')].find(el => el.textContent.toLowerCase().includes('7-day'));
  if (!label || document.getElementById('dayLegend')) return;
  const legend = document.createElement('div');
  legend.id = 'dayLegend';
  legend.className = 'day-legend';
  legend.innerHTML = '<strong>Color rail only</strong> — compare the actual low/high numbers at right';
  label.insertAdjacentElement('afterend', legend);
}

function normalizeDailyRails() {
  document.querySelectorAll('.day-range-fill').forEach(fill => {
    fill.style.left = '0%';
    fill.style.width = '100%';
  });
}

function patchRadarTimeline() {
  const body = document.querySelector('.radar-body');
  if (!body || document.getElementById('radarLoopUI')) return;
  const ui = document.createElement('div');
  ui.id = 'radarLoopUI';
  ui.className = 'radar-loop-ui';
  ui.innerHTML = `<div class="radar-loop-label"><span>Recent</span><span>Moving</span><span>Latest</span><span>Now</span></div><div class="radar-loop-track-real"><i></i></div><div class="radar-loop-note">Radar is an embedded recent-loop view. Use motion direction for the read; exact frame timestamps inside the radar are the source of truth.</div>`;
  const status = body.querySelector('.radar-status');
  if (status) status.insertAdjacentElement('afterend', ui);
  else body.appendChild(ui);
}

function patchPressureHelp() {
  const pressure = document.getElementById('pressureValue');
  if (!pressure || document.getElementById('pressureHelp')) return;
  const help = document.createElement('div');
  help.id = 'pressureHelp';
  help.className = 'pressure-help';
  help.innerHTML = '<strong>hPa</strong> = air pressure. Around 1013 is typical sea-level pressure; falling can mean changing weather.';
  pressure.insertAdjacentElement('afterend', help);
}

function patchBuildStamp() {
  const stamp = document.getElementById('buildStamp');
  if (stamp) {
    stamp.textContent = 'BUILD clarity-5';
    stamp.classList.add('build-visible');
  }
}

function runClarityPass() {
  installClarityStyles();
  ensureForegroundWeather();
  patchWindArrow();
  patchDayLegend();
  normalizeDailyRails();
  patchRadarTimeline();
  patchPressureHelp();
  patchBuildStamp();
}

window.addEventListener('load', () => {
  setTimeout(runClarityPass, 700);
  setInterval(runClarityPass, 2200);
});
