import {
  state,
  APPS,
  APP_ICONS,
  isSafeActive,
  visibleDock,
  headingInfo,
  fmtDuration,
  effectiveResolution,
  svgIcon,
  esc,
  notify
} from './store.js';
import { invalidateMap, updateMapPosition, recenterMap } from './map.js';
import { getMediaState, togglePlay, nextTrack, prevTrack, seekPercent, renderRadioButtons } from './media.js';
import { startOrFinishTrip, togglePauseTrip } from './trip.js';
import { launchNativeApp } from './bridge.js';

const $ = (id) => document.getElementById(id);

const PLAY_SVG = '<svg viewBox="0 0 24 24"><polygon points="7,5 19,12 7,19"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

export function openScreen(id) {
  state.screen = id;
  const app = APPS[id];
  if (app && !app.internal && app.pkg) {
    launchNativeApp(id, app.pkg);
  }
  renderDashLayout();
  if (id === 'home' || id === 'map') invalidateMap();
  notify('screen');
}

export function goFocus(delta) {
  const v = visibleDock();
  if (!v.length) return;
  if (state.screen === 'home') {
    state.foc = ((state.foc + delta) % v.length + v.length) % v.length;
    renderDock();
    notify('screen');
  }
}

export function okFocus() {
  const v = visibleDock();
  if (state.screen === 'home' && v[state.foc]) {
    openScreen(v[state.foc]);
  }
}

export function backHome() {
  openScreen('home');
}

export function fitDisplay() {
  const vp = $('dashViewport');
  const surf = $('dashSurface');
  const info = $('info');
  if (!vp || !surf) return;

  const isDisplayPage = document.body.classList.contains('display-only');
  const W = vp.clientWidth || 800;
  const H = vp.clientHeight || 480;
  const res = effectiveResolution();

  if (isDisplayPage || state.rname === 'Auto') {
    vp.dataset.fit = 'auto';
    surf.style.width = '100%';
    surf.style.height = '100%';
    surf.style.aspectRatio = '';
    surf.style.transform = '';
    if (info) {
      info.textContent = `อัตโนมัติ (${Math.round(W)}×${Math.round(H)}) · ส่ง ${res.text} (ภาระเข้ารหัส ${((res.w * res.h) / 384000).toFixed(1)}× ของ 800×480)`;
    }
    invalidateMap();
    return;
  }

  const targetRatio = state.ratio || (5 / 3);
  const vpRatio = W / H;

  surf.style.transform = '';
  if (state.mode === 'fill') {
    vp.dataset.fit = 'fill';
    surf.style.width = '100%';
    surf.style.height = '100%';
    surf.style.aspectRatio = '';
  } else if (state.mode === 'cover') {
    vp.dataset.fit = 'cover';
    if (targetRatio > vpRatio) {
      surf.style.height = '100%';
      surf.style.width = `${Math.round(H * targetRatio)}px`;
    } else {
      surf.style.width = '100%';
      surf.style.height = `${Math.round(W / targetRatio)}px`;
    }
    surf.style.aspectRatio = '';
  } else {
    // contain
    vp.dataset.fit = 'contain';
    if (targetRatio > vpRatio) {
      surf.style.width = '100%';
      surf.style.height = `${Math.round(W / targetRatio)}px`;
    } else {
      surf.style.height = '100%';
      surf.style.width = `${Math.round(H * targetRatio)}px`;
    }
    surf.style.aspectRatio = '';
  }

  if (info) {
    const sw = surf.clientWidth || W;
    const sh = surf.clientHeight || H;
    let desc = '';
    if (state.mode === 'contain') {
      const blackPct = Math.max(0, Math.round((1 - (sw * sh) / (W * H)) * 100));
      desc = `ภาพ ${state.rname} บนจอ 5:3 · เหลือขอบดำ ${blackPct}%`;
    } else if (state.mode === 'cover') {
      const cropPct = Math.max(0, Math.round((1 - (W * H) / (sw * sh)) * 100));
      desc = `ภาพ ${state.rname} บนจอ 5:3 · ตัดขอบภาพ ${cropPct}%`;
    } else {
      const k = targetRatio / vpRatio;
      const dist = k >= 1 ? k : 1 / k;
      desc = `ภาพ ${state.rname} บนจอ 5:3 · ยืดภาพ ${dist.toFixed(2)}×${Math.abs(dist - 1) < 0.02 ? ' (พอดี)' : ''}`;
    }
    info.textContent = `${desc} · ส่ง ${res.text} (ภาระเข้ารหัส ${((res.w * res.h) / 384000).toFixed(1)}×)`;
  }

  invalidateMap();
}

export function renderDock() {
  const appsBox = $('dockApps');
  const homeBtn = $('dockHomeBtn');
  if (!appsBox) return;

  const v = visibleDock();
  if (state.foc >= v.length) state.foc = Math.max(0, v.length - 1);

  let html = v.map((id, i) => {
    const a = APPS[id];
    const isCur = state.screen === id;
    const isFoc = state.screen === 'home' && state.foc === i;
    const content = a.p ? svgIcon(a.p, 24) : esc(a.l);
    return `<button class="di${isCur ? ' cur' : ''}${isFoc ? ' foc' : ''}" type="button" data-dapp="${id}" title="${esc(a.n)}" aria-label="${esc(a.n)}" style="background:linear-gradient(155deg,${a.grad[0]},${a.grad[1]})">${content}</button>`;
  }).join('');

  if (!isSafeActive() && state.dock.length < 4 && !document.body.classList.contains('display-only')) {
    html += '<button class="di add0" type="button" data-dadd="1" title="เพิ่มทางลัด" aria-label="เพิ่มทางลัด">+</button>';
  }

  appsBox.innerHTML = html;

  appsBox.querySelectorAll('[data-dapp]').forEach((btn) => {
    btn.onclick = () => openScreen(btn.dataset.dapp);
  });
  const addSlot = appsBox.querySelector('[data-dadd]');
  if (addSlot) {
    addSlot.onclick = () => {
      const picker = $('picker');
      if (picker) {
        picker.hidden = false;
        $('q')?.focus();
      }
    };
  }

  if (homeBtn) {
    homeBtn.classList.toggle('cur', state.screen === 'home');
    homeBtn.innerHTML = svgIcon(APP_ICONS.home, 22);
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

  const isInternal = ['home', 'map', 'music', 'trip'].includes(view);
  main.dataset.view = isInternal ? view : 'ext';
  main.dataset.safe = safe ? 'true' : 'false';

  if (!isInternal) {
    const a = APPS[view];
    if (a) {
      if ($('extBadge')) {
        $('extBadge').textContent = a.l || a.n[0];
        $('extBadge').style.background = `linear-gradient(155deg,${a.grad[0]},${a.grad[1]})`;
      }
      if ($('extTitle')) $('extTitle').textContent = a.n;
      if ($('extLink')) {
        $('extLink').href = a.url || '#';
        $('extLink').hidden = !a.url;
      }
    }
  }

  if ($('reconOvl')) $('reconOvl').hidden = !state.recon;
  if ($('dashProv')) $('dashProv').textContent = state.prov;

  renderDock();
  renderTelemetry();
  renderMediaUi();
  if (view === 'home' || view === 'map') invalidateMap();
}

export function renderTelemetry() {
  const spd = state.speed;
  const h = headingInfo(state.heading);
  const T = state.trip;
  const avg = T.seconds > 0 ? Math.round(T.distanceKm / (T.seconds / 3600)) : 0;

  if ($('homeSpeed')) $('homeSpeed').textContent = spd;
  if ($('safeSpeed')) $('safeSpeed').textContent = spd;
  if ($('safeHeading')) $('safeHeading').textContent = `km/h · ${h.arrow} ${h.short}`;
  if ($('homeHeading')) $('homeHeading').textContent = `${h.arrow} ${h.short} ${h.deg}°`;
  if ($('homeTripStat')) $('homeTripStat').textContent = `${T.distanceKm.toFixed(1)} กม. · ${fmtDuration(T.seconds)}`;

  if ($('tripDashSpeed')) $('tripDashSpeed').textContent = spd;
  if ($('tripDashHeading')) $('tripDashHeading').textContent = `${h.arrow} ${h.name} · ${h.deg}°`;
  if ($('tripDashDist')) $('tripDashDist').textContent = T.distanceKm.toFixed(2);
  if ($('tripDashTime')) $('tripDashTime').textContent = fmtDuration(T.seconds);
  if ($('tripDashAvg')) $('tripDashAvg').textContent = avg;

  const ds = $('dashTripStart');
  const dp = $('dashTripPause');
  if (ds) ds.textContent = T.on ? 'จบทริป' : 'เริ่มทริป';
  if (dp) {
    dp.hidden = !T.on;
    dp.textContent = T.paused ? 'ต่อ' : 'พัก';
  }

  const main = $('dashMain');
  if (main && (main.dataset.safe === 'true') !== isSafeActive()) {
    renderDashLayout();
  }

  updateMapPosition();
}

export function renderMediaUi() {
  const m = getMediaState();
  const playHtml = m.playing ? PAUSE_SVG : PLAY_SVG;
  const sub = m.loading ? 'กำลังเชื่อมต่อ...' : (m.errorMsg || m.track.artist);

  if ($('miniTitle')) $('miniTitle').textContent = m.track.title;
  if ($('miniArtist')) $('miniArtist').textContent = sub;
  if ($('miniPlay')) $('miniPlay').innerHTML = playHtml;

  if ($('fullTitle')) $('fullTitle').textContent = m.track.title;
  if ($('fullArtist')) $('fullArtist').textContent = sub;
  if ($('fullPlay')) $('fullPlay').innerHTML = playHtml;
  if ($('musicBarFill')) $('musicBarFill').style.width = `${m.progressPct}%`;

  renderRadioButtons($('musicPresets'));
}

export function renderMediaProgress() {
  const m = getMediaState();
  if ($('musicBarFill')) $('musicBarFill').style.width = `${m.progressPct}%`;
}

export function renderClock() {
  const now = new Date();
  const p2 = (n) => (n < 10 ? '0' + n : String(n));
  if ($('dockClock')) $('dockClock').textContent = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
}

export function initDash() {
  if ($('dockHomeBtn')) $('dockHomeBtn').onclick = backHome;
  if ($('homeSpeedCard')) $('homeSpeedCard').onclick = () => openScreen('trip');
  if ($('homeMediaCard')) {
    $('homeMediaCard').onclick = (e) => {
      if (e.target.closest('button')) return;
      openScreen('music');
    };
  }
  if ($('mapRecenterDash')) $('mapRecenterDash').onclick = recenterMap;

  if ($('miniPrev')) $('miniPrev').onclick = prevTrack;
  if ($('miniPlay')) $('miniPlay').onclick = togglePlay;
  if ($('miniNext')) $('miniNext').onclick = nextTrack;

  if ($('fullPrev')) $('fullPrev').onclick = prevTrack;
  if ($('fullPlay')) $('fullPlay').onclick = togglePlay;
  if ($('fullNext')) $('fullNext').onclick = nextTrack;

  if ($('musicBar')) {
    $('musicBar').onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      seekPercent((e.clientX - r.left) / r.width);
    };
  }

  if ($('dashTripStart')) $('dashTripStart').onclick = startOrFinishTrip;
  if ($('dashTripPause')) $('dashTripPause').onclick = togglePauseTrip;

  renderClock();
  setInterval(renderClock, 1000);
  renderDashLayout();
  fitDisplay();
  window.addEventListener('resize', fitDisplay);
}
