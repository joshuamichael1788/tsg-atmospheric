function installClarityStyles() {
  if (document.getElementById('clarityStyles')) return;
  const style = document.createElement('style');
  style.id = 'clarityStyles';
  style.textContent = `
    .hub-container,
    .gradient-frame,
    .clock-card,
    .sky-brief,
    .signal-card,
    .metric-card,
    .rune,
    .celestial-times,
    .minutely-precip,
    .radar-chamber {
      background-color: rgba(22, 18, 16, 0.44) !important;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .hub-container {
      background:
        linear-gradient(145deg, rgba(49, 36, 24, 0.62), rgba(34, 28, 66, 0.48)) padding-box,
        linear-gradient(90deg, rgba(0, 229, 255, 0.45), rgba(240, 200, 80, 0.78)) border-box !important;
    }

    .sky-brief,
    .signal-card,
    .metric-card,
    .rune,
    .clock-card,
    .celestial-times,
    .minutely-precip,
    .radar-chamber {
      background:
        linear-gradient(145deg, rgba(34, 25, 17, 0.50), rgba(26, 21, 56, 0.32)) padding-box,
        linear-gradient(90deg, rgba(0, 229, 255, 0.55), rgba(240, 200, 80, 0.65)) border-box !important;
    }

    .wind-rose::after {
      content: 'COMPASS REF';
      position: absolute;
      left: 50%;
      bottom: -18px;
      transform: translateX(-50%);
      color: var(--papyrus);
      font-size: 0.45rem;
      letter-spacing: 1px;
      white-space: nowrap;
      opacity: 0.82;
    }

    .wind-speed {
      margin-top: 14px;
      text-align: center;
    }

    .wind-flow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: 1px solid rgba(0, 229, 255, 0.5);
      border-radius: 999px;
      color: var(--teal);
      margin-right: 6px;
      filter: drop-shadow(0 0 5px rgba(0, 229, 255, 0.35));
      transform-origin: center;
    }

    .day-legend,
    .radar-loop-note,
    .pressure-help {
      color: #c9bb91;
      font-size: 0.56rem;
      line-height: 1.35;
      letter-spacing: 0.7px;
    }

    .day-legend {
      margin: -2px 0 8px;
      text-align: center;
      text-transform: uppercase;
    }

    .day-legend strong,
    .pressure-help strong {
      color: var(--gold2);
      font-weight: 600;
    }

    .radar-loop-ui {
      margin-top: 10px;
      padding-top: 11px;
      border-top: 1px solid rgba(216, 200, 154, 0.16);
    }

    .radar-loop-label {
      display: flex;
      justify-content: space-between;
      color: var(--papyrus);
      font-size: 0.52rem;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 7px;
    }

    .radar-loop-track-real {
      position: relative;
      height: 5px;
      border-radius: 999px;
      background: rgba(216, 200, 154, 0.18);
      overflow: hidden;
    }

    .radar-loop-track-real i {
      position: absolute;
      inset: 0 auto 0 0;
      width: 34%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--teal), var(--gold2));
      animation: clarityRadarSweep 4.2s ease-in-out infinite;
    }

    @keyframes clarityRadarSweep {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(330%); }
    }
  `;
  document.head.appendChild(style);
}

function getWindDirectionLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function readWindDegrees() {
  const needle = document.getElementById('windNeedle');
  const raw = needle?.style?.transform || '';
  const match = raw.match(/rotate\(([-0-9.]+)deg\)/);
  return match ? Number(match[1]) : 0;
}

function patchWindArrow() {
  const wind = document.getElementById('windSpeed');
  if (!wind || wind.dataset.clarityPatched === 'true') return;
  const deg = readWindDegrees();
  const label = getWindDirectionLabel(deg);
  const original = wind.textContent.replace(/\s*WIND\s*/i, '').trim();
  wind.innerHTML = `<span class="wind-flow" style="transform:rotate(${deg}deg)">↑</span><span>${original}</span><span style="color:var(--papyrus);font-size:.58rem;letter-spacing:1px;">FROM ${label}</span>`;
  wind.dataset.clarityPatched = 'true';
}

function patchDayLegend() {
  const label = [...document.querySelectorAll('.strip-label')].find(el => el.textContent.toLowerCase().includes('7-day'));
  if (!label || document.getElementById('dayLegend')) return;
  const legend = document.createElement('div');
  legend.id = 'dayLegend';
  legend.className = 'day-legend';
  legend.innerHTML = '<strong>Bars show daily temperature range</strong> — low to high within this week';
  label.insertAdjacentElement('afterend', legend);
}

function patchRadarTimeline() {
  const body = document.querySelector('.radar-body');
  if (!body || document.getElementById('radarLoopUI')) return;
  const ui = document.createElement('div');
  ui.id = 'radarLoopUI';
  ui.className = 'radar-loop-ui';
  ui.innerHTML = `
    <div class="radar-loop-label"><span>Past frames</span><span>Now</span></div>
    <div class="radar-loop-track-real"><i></i></div>
    <div class="radar-loop-note">Radar animation is a loop of recent radar frames moving toward current conditions. Use motion direction more than exact clock time.</div>`;
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

function runClarityPass() {
  installClarityStyles();
  patchWindArrow();
  patchDayLegend();
  patchRadarTimeline();
  patchPressureHelp();
}

window.addEventListener('load', () => {
  setTimeout(runClarityPass, 900);
  setInterval(runClarityPass, 2500);
});
