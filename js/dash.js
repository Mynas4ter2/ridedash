import {
  state,
  APPS,
  APP_ICONS,
  isSafeActive,
  visibleDock,
  headingInfo,
  fmtDuration,
  svgIcon,
  esc,
  persistState,
  notify
} from './store.js';
import { invalidateMap, updateMapPosition, recenterMap, openInGoogleMaps, applyMapStyle } from './map.js';
import { turnIconSvg, toggleVoice, stopNavigation, fmtMeters } from './nav.js';
import { getMediaState, togglePlay, nextTrack, prevTrack, seekPercent, renderRadioButtons } from './media.js';
import { startOrFinishTrip, togglePauseTrip } from './trip.js';
import { refreshWeather } from './weather.js';

const $ = (id) => document.getElementById(id);

const PLAY_SVG = '<svg viewBox="0 0 24 24"><polygon points="7,5 19,12 7,19"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

export function openHudScreen(id) {
  state.screen = id;
  if (id === 'weather') refreshWeather(true);
  renderHudLayout();
  if (id === 'home' || id === 'map') invalidateMap();
  notify('screen');
}

export function applyHudTheme() {
  const hud = $('rideHud');
  if (hud) hud.dataset.hud = state.hudTheme;
  const btn = $('hudThemeToggle');
  if (btn) btn.textContent = state.hudTheme === 'night' ? '☀️' : '🌙';
  if (state.rideMode && state.mapStyle !== 'satellite') {
    applyMapStyle(state.hudTheme === 'night' ? 'dark' : 'light');
  }
}

export function renderHudDock() {
  const box = $('hudDockApps');
  const homeBtn = $('hudHomeBtn');
  if (!box) return;

  const dock = visibleDock();
  box.innerHTML = dock.map((id) => {
    const a = APPS[id];
    const active = state.screen === id;
    const inner = a.icon ? svgIcon(a.icon, 21) : esc(a.letter || a.name[0]);
    return `<button class="hud-dock-btn${active ? ' active' : ''}" data-happ="${id}" title="${esc(a.name)}" aria-label="${esc(a.name)}" style="background:linear-gradient(145deg,${a.grad[0]},${a.grad[1]})">${inner}</button>`;
  }).join('');

  box.querySelectorAll('[data-happ]').forEach((btn) => {
    btn.onclick = () => openHudScreen(btn.dataset.happ);
  });

  if (homeBtn) {
    homeBtn.classList.toggle('active', state.screen === 'home');
    homeBtn.innerHTML = svgIcon(APP_ICONS.home, 21);
  }
}

export function renderHudLayout() {
  const hud = $('rideHud');
  if (!hud) return;

  const safe = isSafeActive();
  let view = state.screen;
  if (safe && view !== 'home' && !['map', 'music', 'phone'].includes(view)) {
    view = 'home';
    state.screen = 'home';
  }

  const isInternal = ['home', 'map', 'music', 'trip', 'phone', 'weather'].includes(view);
  hud.dataset.view = isInternal ? view : 'ext';
  hud.dataset.safe = safe ? 'true' : 'false';

  if (!isInternal) {
    const app = APPS[view];
    if (app) {
      if ($('extAppIcon')) {
        $('extAppIcon').textContent = app.letter || app.name[0];
        $('extAppIcon').style.background = `linear-gradient(145deg,${app.grad[0]},${app.grad[1]})`;
      }
      if ($('extAppTitle')) $('extAppTitle').textContent = app.name;
      if ($('extAppLaunch')) {
        $('extAppLaunch').href = app.url || '#';
        $('extAppLaunch').textContent = `เปิด ${app.name}`;
      }
    }
  }

  renderHudDock();
  renderHudPhoneGrid();
  renderHudTelemetry();
  renderHudNav();
  renderMediaUi();
  renderWeatherUi();
  if (view === 'home' || view === 'map') invalidateMap();
}

export function renderHudTelemetry() {
  const spd = state.speed;
  const h = headingInfo(state.heading);
  const T = state.trip;
  const avg = T.seconds > 0 ? Math.round(T.distanceKm / (T.seconds / 3600)) : 0;

  // Home Hero live numbers
  if ($('heroSpeed')) $('heroSpeed').textContent = spd;
  if ($('heroTripVal')) $('heroTripVal').textContent = `${T.distanceKm.toFixed(1)} กม.`;
  if ($('heroGpsVal')) $('heroGpsVal').textContent = state.gpsMode === 'gps' ? (state.accuracy != null ? `±${state.accuracy} ม.` : 'จับสัญญาณ...') : 'โหมดจำลอง';
  if ($('heroVoiceVal')) $('heroVoiceVal').textContent = state.voiceEnabled ? 'เสียงไทยเปิด' : 'ปิดเสียง';

  // Ride HUD live numbers
  if ($('hudSpeed')) $('hudSpeed').textContent = spd;
  if ($('hudHeading')) $('hudHeading').textContent = `${h.arrow} ${h.short} ${h.deg}°`;
  if ($('hudTripMini')) $('hudTripMini').textContent = `${T.distanceKm.toFixed(1)} กม. · ${fmtDuration(T.seconds)}`;

  // HUD Full Trip Screen
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

  // Auto-update Safe Mode state on HUD when crossing speed threshold
  const hud = $('rideHud');
  if (hud) {
    const wasSafe = hud.dataset.safe === 'true';
    const nowSafe = isSafeActive();
    if (wasSafe !== nowSafe) renderHudLayout();
  }

  updateMapPosition();
}

export function renderHudNav() {
  const n = state.nav;
  if ($('hudTurnIcon')) {
    $('hudTurnIcon').innerHTML = `<svg viewBox="0 0 24 24">${turnIconSvg(n.nextIcon)}</svg>`;
  }
  if ($('hudTurnDist')) $('hudTurnDist').textContent = n.nextDistText;
  if ($('hudTurnText')) $('hudTurnText').textContent = n.nextText;

  const voiceBtn = $('hudVoiceToggle');
  if (voiceBtn) {
    voiceBtn.textContent = state.voiceEnabled ? '🔊' : '🔇';
    voiceBtn.classList.toggle('muted', !state.voiceEnabled);
  }

  const etaPill = $('hudEtaPill');
  if (etaPill) {
    if (n.phase === 'guiding' || n.phase === 'arrived') {
      etaPill.hidden = false;
      etaPill.textContent = n.phase === 'arrived'
        ? '🏁 ถึงจุดหมายแล้ว'
        : `ถึง ${n.etaText} · ${fmtMeters(n.remDistM)}`;
    } else {
      etaPill.hidden = true;
    }
  }

  const stopBtn = $('hudStopNavBtn');
  if (stopBtn) stopBtn.hidden = n.phase === 'idle';
}

export function renderMediaUi() {
  const m = getMediaState();
  const playHtml = m.playing ? PAUSE_SVG : PLAY_SVG;
  const sub = m.loading ? 'กำลังเชื่อมต่อเสียง...' : (m.errorMsg || m.track.artist);

  // Home Mini Card
  if ($('homeMediaTitle')) $('homeMediaTitle').textContent = m.track.title;
  if ($('homeMediaSub')) $('homeMediaSub').textContent = sub;
  if ($('homePlayBtn')) $('homePlayBtn').innerHTML = playHtml;

  // HUD Compact Strip
  if ($('hudMediaTitle')) $('hudMediaTitle').textContent = m.track.title;
  if ($('hudMediaSub')) $('hudMediaSub').textContent = sub;
  if ($('hudPlayBtn')) $('hudPlayBtn').innerHTML = playHtml;

  // HUD Full Music Screen
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
  if ($('heroWeatherTemp')) $('heroWeatherTemp').textContent = t;
  if ($('heroWeatherDesc')) $('heroWeatherDesc').textContent = w.desc;

  if ($('fullWeatherTemp')) $('fullWeatherTemp').textContent = w.temp != null ? `${w.icon} ${w.temp}°C` : `${w.icon} --°C`;
  if ($('fullWeatherDesc')) $('fullWeatherDesc').textContent = w.desc;
  if ($('fullWeatherMeta')) {
    $('fullWeatherMeta').textContent = w.humidity != null
      ? `ความชื้น ${w.humidity}% · ลม ${w.wind} กม./ชม.`
      : 'แตะอัปเดตเพื่อดึงสภาพอากาศตามพิกัดปัจจุบัน';
  }
}

export function renderHudPhoneGrid() {
  const grid = $('hudDialGrid');
  if (!grid) return;
  grid.innerHTML = state.contacts.map((c) => `
    <a class="hud-dial-tile" href="tel:${esc(c.tel)}">
      <div class="hud-dial-avatar">${esc((c.name || '?')[0])}</div>
      <b>${esc(c.name)}</b>
      <small style="color:var(--hud-muted)">${esc(c.tel)}</small>
    </a>
  `).join('');
}

export function renderHudClock() {
  const now = new Date();
  const p2 = (n) => (n < 10 ? '0' + n : String(n));
  if ($('hudClock')) $('hudClock').textContent = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
}

export function initDash() {
  if ($('hudHomeBtn')) $('hudHomeBtn').onclick = () => openHudScreen('home');
  if ($('hudSpeedTile')) $('hudSpeedTile').onclick = () => openHudScreen('trip');
  if ($('hudMediaTile')) {
    $('hudMediaTile').onclick = (e) => {
      if (e.target.closest('button')) return;
      openHudScreen('music');
    };
  }

  if ($('hudVoiceToggle')) $('hudVoiceToggle').onclick = toggleVoice;
  if ($('hudThemeToggle')) {
    $('hudThemeToggle').onclick = () => {
      state.hudTheme = state.hudTheme === 'night' ? 'day' : 'night';
      persistState();
      applyHudTheme();
    };
  }

  if ($('hudFollowBtn')) $('hudFollowBtn').onclick = () => recenterMap(16);
  if ($('hudGmapsBtn')) $('hudGmapsBtn').onclick = openInGoogleMaps;
  if ($('hudStopNavBtn')) $('hudStopNavBtn').onclick = stopNavigation;

  if ($('homePlayBtn')) $('homePlayBtn').onclick = togglePlay;
  if ($('homeNextBtn')) $('homeNextBtn').onclick = nextTrack;

  if ($('hudPrevBtn')) $('hudPrevBtn').onclick = prevTrack;
  if ($('hudPlayBtn')) $('hudPlayBtn').onclick = togglePlay;
  if ($('hudNextBtn')) $('hudNextBtn').onclick = nextTrack;

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

  applyHudTheme();
  renderHudClock();
  setInterval(renderHudClock, 1000);
  renderHudLayout();
}
