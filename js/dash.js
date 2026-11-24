import {
  state,
  APPS,
  APP_ICONS,
  RATIOS,
  isSafeActive,
  visibleDock,
  headingInfo,
  fmtDuration,
  svgIcon,
  esc,
  notify
} from './store.js';
import { invalidateMap, updateMapPosition } from './map.js';
import {
  getMediaState,
  togglePlay,
  nextTrack,
  prevTrack,
  seekPercent,
  renderRadioButtons
} from './media.js';
import { startOrFinishTrip, togglePauseTrip } from './trip.js';
import { refreshWeather } from './weather.js';

const $ = (id) => document.getElementById(id);

const PLAY_SVG = '<svg viewBox="0 0 24 24"><polygon points="7,5 19,12 7,19"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

export function openScreen(id) {
  state.screen = id;
  if (id === 'weather') refreshWeather(true);
  renderDashLayout();
  if (id === 'home' || id === 'map') invalidateMap();
  notify('screen');
}

export function moveFocus(delta) {
  const dock = visibleDock();
  if (!dock.length) return;
  if (state.screen !== 'home') {
    state.screen = 'home';
  }
  state.focusIdx = ((state.focusIdx + delta) % dock.length + dock.length) % dock.length;
  renderDock();
  notify('screen');
}

export function triggerFocused() {
  const dock = visibleDock();
  if (state.screen === 'home' && dock[state.focusIdx]) {
    openScreen(dock[state.focusIdx]);
  }
}

export function goHome() {
  openScreen('home');
}

export function applyViewportRatio() {
  const vp = $('dashViewport');
  const surf = $('dashSurface');
  const info = $('previewMetaText');
  if (!vp || !surf) return;

  const spec = RATIOS.find((r) => r.id === state.ratioId) || RATIOS[0];
  if (spec.ratio == null) {
    vp.dataset.fit = 'fill';
    surf.style.aspectRatio = '';
    surf.style.width = '100%';
    surf.style.height = '100%';
    if (info) info.textContent = `โหมดเต็มหน้าจอ · ${state.gpsStatus}`;
  } else {
    vp.dataset.fit = 'ratio';
    surf.style.aspectRatio = String(spec.ratio);
    surf.style.width = '';
    surf.style.height = '';
    if (info) info.textContent = `สัดส่วน ${spec.label} · ${state.gpsStatus}`;
  }
  invalidateMap();
}

export function renderDock() {
  const appsBox = $('dockApps');
  const homeBtn = $('dockHomeBtn');
  if (!appsBox) return;

  const dock = visibleDock();
  if (state.focusIdx >= dock.length) state.focusIdx = Math.max(0, dock.length - 1);
  if (state.screen !== 'home' && !dock.includes(state.screen) && !APPS[state.screen]?.internal) {
    state.screen = 'home';
  }

  appsBox.innerHTML = dock.map((id, i) => {
    const a = APPS[id];
    const isActive = state.screen === id;
    const isFocused = state.screen === 'home' && state.focusIdx === i;
    const content = a.icon ? svgIcon(a.icon, 26) : esc(a.letter || a.name[0]);
    return `<button class="dock-btn${isActive ? ' active' : ''}${isFocused ? ' focused' : ''}" data-app="${id}" title="${esc(a.name)}" aria-label="${esc(a.name)}" style="background:linear-gradient(150deg,${a.grad[0]},${a.grad[1]})">${content}</button>`;
  }).join('');

  appsBox.querySelectorAll('[data-app]').forEach((btn) => {
    btn.onclick = () => openScreen(btn.dataset.app);
  });

  if (homeBtn) {
    homeBtn.classList.toggle('active', state.screen === 'home');
    homeBtn.innerHTML = svgIcon(APP_ICONS.home, 24);
  }
}

export function renderDashLayout() {
  const main = $('dashMain');
  if (!main) return;

  const safe = isSafeActive();
  let view = state.screen;
  if (safe && view !== 'home' && !['map', 'music', 'phone'].includes(view)) {
    view = 'home';
    state.screen = 'home';
  }

  const isInternal = ['home', 'map', 'music', 'trip', 'phone', 'weather'].includes(view);
  main.dataset.view = isInternal ? view : 'ext';
  main.dataset.safe = safe ? 'true' : 'false';

  if (!isInternal) {
    renderExternalScreen(view);
  }

  renderDock();
  renderPhoneGrid();
  renderTelemetry();
  renderMediaUi();
  renderWeatherUi();
  renderNavUi();
  if (view === 'home' || view === 'map') invalidateMap();
}

function renderExternalScreen(appId) {
  const app = APPS[appId];
  if (!app) return;
  const icon = $('extAppIcon');
  const title = $('extAppTitle');
  const link = $('extAppLaunch');
  if (icon) {
    icon.textContent = app.letter || app.name[0];
    icon.style.background = `linear-gradient(150deg,${app.grad[0]},${app.grad[1]})`;
  }
  if (title) title.textContent = app.name;
  if (link) {
    link.href = app.url || '#';
    link.textContent = `เปิด ${app.name}`;
  }
}

export function renderTelemetry() {
  const spd = state.speed;
  const h = headingInfo(state.heading);
  const T = state.trip;
  const avg = T.seconds > 0 ? Math.round(T.distanceKm / (T.seconds / 3600)) : 0;

  if ($('homeSpeed')) $('homeSpeed').textContent = spd;
  if ($('mapSpeed')) $('mapSpeed').textContent = spd;
  if ($('mapHeading')) $('mapHeading').textContent = `km/h · ${h.arrow} ${h.name}`;
  if ($('homeHeading')) $('homeHeading').textContent = `${h.arrow} ${h.short} · ${h.deg}°`;
  if ($('homeTripMini')) $('homeTripMini').textContent = `${T.distanceKm.toFixed(1)} กม. · ${fmtDuration(T.seconds)}`;

  if ($('tripHeroSpeed')) $('tripHeroSpeed').textContent = spd;
  if ($('tripHeroHeading')) $('tripHeroHeading').textContent = `${h.arrow} ทิศ${h.name} (${h.deg}°)`;
  if ($('dashTripDist')) $('dashTripDist').textContent = T.distanceKm.toFixed(2);
  if ($('dashTripTime')) $('dashTripTime').textContent = fmtDuration(T.seconds);
  if ($('dashTripAvg')) $('dashTripAvg').textContent = avg;
  if ($('dashTripMax')) $('dashTripMax').textContent = T.maxSpeed;

  const dashStartBtn = $('dashTripStart');
  const dashPauseBtn = $('dashTripPause');
  if (dashStartBtn) dashStartBtn.textContent = T.on ? 'จบทริป' : 'เริ่มทริป';
  if (dashPauseBtn) {
    dashPauseBtn.hidden = !T.on;
    dashPauseBtn.textContent = T.paused ? 'บันทึกต่อ' : 'พัก';
  }

  // Re-evaluate safe mode whenever speed changes
  const main = $('dashMain');
  if (main) {
    const wasSafe = main.dataset.safe === 'true';
    const nowSafe = isSafeActive();
    if (wasSafe !== nowSafe) {
      renderDashLayout();
    }
  }

  updateMapPosition();
}

export function renderNavUi() {
  const n = state.nav;
  if ($('turnDist')) $('turnDist').textContent = n.nextDist;
  if ($('turnDesc')) $('turnDesc').textContent = n.active && n.etaText ? `${n.nextText} · ${n.etaText}` : n.nextText;
  if ($('mapClearRouteBtn')) $('mapClearRouteBtn').hidden = !n.active;
}

export function renderMediaUi() {
  const m = getMediaState();
  const playHtml = m.playing ? PAUSE_SVG : PLAY_SVG;
  const sub = m.loading ? 'กำลังเชื่อมต่อเสียง...' : (m.errorMsg || m.track.artist);

  if ($('miniMediaTitle')) $('miniMediaTitle').textContent = m.track.title;
  if ($('miniMediaArtist')) $('miniMediaArtist').textContent = sub;
  if ($('miniPlayBtn')) $('miniPlayBtn').innerHTML = playHtml;

  if ($('fullMediaTitle')) $('fullMediaTitle').textContent = m.track.title;
  if ($('fullMediaArtist')) $('fullMediaArtist').textContent = sub;
  if ($('fullPlayBtn')) $('fullPlayBtn').innerHTML = playHtml;
  if ($('mediaProgressFill')) $('mediaProgressFill').style.width = `${m.progressPct}%`;

  renderRadioButtons($('musicPresets'));
}

export function renderMediaProgress() {
  const m = getMediaState();
  if ($('mediaProgressFill')) $('mediaProgressFill').style.width = `${m.progressPct}%`;
}

export function renderWeatherUi() {
  const w = state.weather;
  const t = w.temp != null ? `${w.icon} ${w.temp}°C` : `${w.icon} --°`;
  if ($('homeWeatherTemp')) $('homeWeatherTemp').textContent = t;
  if ($('homeWeatherDesc')) $('homeWeatherDesc').textContent = w.desc;

  if ($('fullWeatherTemp')) $('fullWeatherTemp').textContent = w.temp != null ? `${w.icon} ${w.temp}°C` : `${w.icon} --°C`;
  if ($('fullWeatherDesc')) $('fullWeatherDesc').textContent = w.desc;
  if ($('fullWeatherMeta')) {
    $('fullWeatherMeta').textContent = w.humidity != null
      ? `ความชื้น ${w.humidity}% · ลม ${w.wind} กม./ชม.`
      : 'แตะรีเฟรชเพื่ออัปเดตสภาพอากาศตามพิกัดปัจจุบัน';
  }
}

export function renderPhoneGrid() {
  const grid = $('dialGrid');
  if (!grid) return;
  grid.innerHTML = state.contacts.map((c) => `
    <a class="dial-tile" href="tel:${esc(c.tel)}">
      <div class="dial-avatar">${esc((c.name || '?')[0])}</div>
      <b>${esc(c.name)}</b>
      <small>${esc(c.tel)}</small>
    </a>
  `).join('');
}

export function renderClockAndBattery() {
  const now = new Date();
  const p2 = (n) => (n < 10 ? '0' + n : String(n));
  const clockEl = $('dockClock');
  if (clockEl) clockEl.textContent = `${p2(now.getHours())}:${p2(now.getMinutes())}`;

  const pct = Math.round(state.battery.level * 100);
  const battEl = $('dockBatt');
  if (battEl) battEl.textContent = `${pct}%${state.battery.charging ? '⚡' : ''}`;
}

export function initDash() {
  if ($('dockHomeBtn')) $('dockHomeBtn').onclick = goHome;
  if ($('homeSpeedCard')) $('homeSpeedCard').onclick = () => openScreen('trip');
  if ($('homeMediaCard')) {
    $('homeMediaCard').onclick = (e) => {
      if (e.target.closest('button')) return;
      openScreen('music');
    };
  }

  if ($('miniPrevBtn')) $('miniPrevBtn').onclick = prevTrack;
  if ($('miniPlayBtn')) $('miniPlayBtn').onclick = togglePlay;
  if ($('miniNextBtn')) $('miniNextBtn').onclick = nextTrack;

  if ($('fullPrevBtn')) $('fullPrevBtn').onclick = prevTrack;
  if ($('fullPlayBtn')) $('fullPlayBtn').onclick = togglePlay;
  if ($('fullNextBtn')) $('fullNextBtn').onclick = nextTrack;

  if ($('mediaProgressBar')) {
    $('mediaProgressBar').onclick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      seekPercent((e.clientX - rect.left) / rect.width);
    };
  }

  if ($('dashTripStart')) $('dashTripStart').onclick = startOrFinishTrip;
  if ($('dashTripPause')) $('dashTripPause').onclick = togglePauseTrip;
  if ($('weatherRefreshBtn')) $('weatherRefreshBtn').onclick = () => refreshWeather(true);

  renderClockAndBattery();
  setInterval(renderClockAndBattery, 1000);
  renderDashLayout();
  applyViewportRatio();
}
