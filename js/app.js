import {
  state,
  APPS,
  MAP_STYLES,
  loadState,
  persistState,
  subscribe,
  notify,
  isSafeActive,
  svgIcon,
  esc
} from './store.js';
import { initGps, setGpsMode, setSimSpeed, toggleRouteSim } from './gps.js';
import { refreshWeather } from './weather.js';
import {
  initMap,
  mountMapInto,
  applyMapStyle,
  invalidateMap,
  recenterMap,
  drawActiveRoute,
  clearRouteLayers,
  openInGoogleMaps
} from './map.js';
import {
  searchPlaces,
  calculateRoute,
  startGuidance,
  stopNavigation,
  speakThai,
  toggleVoice
} from './nav.js';
import { initMedia } from './media.js';
import { initTrip, renderTripTab } from './trip.js';
import { initFuel, renderFuel } from './fuel.js';
import {
  initDash,
  openHudScreen,
  applyHudTheme,
  renderHudLayout,
  renderHudTelemetry,
  renderHudNav,
  renderMediaUi,
  renderMediaProgress,
  renderWeatherUi,
  renderHudPhoneGrid,
  renderHudClockAndBattery
} from './dash.js';

const $ = (id) => document.getElementById(id);
let wakeLock = null;

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function showTab(idx) {
  state.activeTab = idx;
  document.querySelectorAll('.tab-view[data-tab]').forEach((el) => {
    el.hidden = el.dataset.tab !== String(idx);
  });
  document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === String(idx));
  });

  if (idx === 1 && !state.rideMode) {
    mountMapInto('mapTabStage');
    applyMapStyle(state.mapStyle);
    invalidateMap();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showTripSubTab(sub) {
  state.tripSubTab = sub;
  if ($('subTripBtn')) $('subTripBtn').setAttribute('aria-pressed', String(sub === 'trip'));
  if ($('subFuelBtn')) $('subFuelBtn').setAttribute('aria-pressed', String(sub === 'fuel'));
  if ($('tripSubPane')) $('tripSubPane').hidden = sub !== 'trip';
  if ($('fuelSubPane')) $('fuelSubPane').hidden = sub !== 'fuel';
}

async function setRideMode(on) {
  state.rideMode = on;
  document.body.classList.toggle('ride-mode', on);

  if (on) {
    mountMapInto('hudMapWrap');
    applyHudTheme();
    renderHudLayout();
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    try { if (navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request('screen').catch(() => null); } catch (e) {}
    recenterMap(16);
  } else {
    try { if (wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {}
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
    if (state.activeTab === 1) {
      mountMapInto('mapTabStage');
      applyMapStyle(state.mapStyle);
    }
    invalidateMap();
  }
  renderSettingsUi();
}

// ===== Place Search & Route Preview =====
async function runPlaceSearch(query) {
  const q = String(query || '').trim();
  if (!q) return;

  showTab(1);
  if ($('mapSearchInput')) $('mapSearchInput').value = q;
  const box = $('mapResultsBox');
  if (!box) return;
  box.hidden = false;
  box.innerHTML = '<div class="map-res-item" style="color:var(--muted)">กำลังค้นหาสถานที่ใกล้คุณ...</div>';

  try {
    const items = await searchPlaces(q);
    if (!items.length) {
      box.innerHTML = '<div class="map-res-item" style="color:var(--muted)">ไม่พบสถานที่นี้ ลองใช้คำค้นอื่น</div>';
      return;
    }

    box.innerHTML = items.map((it, i) => `
      <button class="map-res-item" type="button" data-pidx="${i}">
        <b>${esc(it.shortName)}</b> <span style="color:var(--acc);font-size:12px;font-weight:700">${it.distKm.toFixed(1)} กม.</span>
        ${it.subName ? `<div style="font-size:12px;color:var(--muted)">${esc(it.subName)}</div>` : ''}
      </button>
    `).join('');

    box.querySelectorAll('[data-pidx]').forEach((btn) => {
      btn.onclick = async () => {
        const picked = items[Number(btn.dataset.pidx)];
        if (!picked) return;
        box.hidden = true;
        try {
          await calculateRoute(picked.lat, picked.lng, picked.shortName, { autoStart: false });
        } catch (err) {
          alert('ไม่สามารถคำนวณเส้นทางได้ในขณะนี้ ลองเปิดใน Google Maps แทนได้ครับ');
        }
      };
    });
  } catch (err) {
    box.innerHTML = '<div class="map-res-item" style="color:var(--danger)">ค้นหาไม่สำเร็จ (ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต)</div>';
  }
}

function renderRouteSheet() {
  const sheet = $('routeSheet');
  if (!sheet) return;
  const n = state.nav;
  if (n.phase === 'idle') {
    sheet.hidden = true;
    return;
  }

  sheet.hidden = false;
  if ($('routeSheetTitle')) $('routeSheetTitle').textContent = n.destName || 'เส้นทางนำทาง';
  if ($('routeSheetMeta')) {
    $('routeSheetMeta').textContent = n.totalDistKm > 0
      ? `${n.totalDistKm.toFixed(1)} กม. · ${n.totalDurMin} นาที · ถึง ${n.etaText}`
      : 'กำลังคำนวณเส้นทาง...';
  }
  if ($('routeSimBtn')) {
    $('routeSimBtn').hidden = state.gpsMode !== 'sim';
    $('routeSimBtn').textContent = state.routeSimActive ? '⏹ หยุดจำลอง' : '🧪 จำลองขี่';
  }
}

// ===== Home Quick Dial Strip =====
function renderHomeQuickDial() {
  const row = $('homeQuickDial');
  if (!row) return;
  row.innerHTML = state.contacts.map((c) => `
    <a class="quick-dial-pill" href="tel:${esc(c.tel)}">
      <span class="call-ico">☎</span>
      <span>${esc(c.name)}</span>
    </a>
  `).join('');
}

// ===== Settings UI =====
function renderDockSettings() {
  const mine = $('dockMineList');
  const all = $('dockAllList');
  if (!mine || !all) return;

  const badge = (a) => {
    const inner = a.icon ? svgIcon(a.icon, 18) : esc(a.letter || a.name[0]);
    return `<span class="app-badge" style="background:linear-gradient(145deg,${a.grad[0]},${a.grad[1]})">${inner}</span>`;
  };

  mine.innerHTML = state.dock.map((id, i) => {
    const a = APPS[id];
    return `<li class="list-item">
      ${badge(a)}
      <span class="nm">${esc(a.name)}</span>
      <button class="icon-btn" data-mv="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="ขึ้น">▲</button>
      <button class="icon-btn" data-mv="${i}" data-dir="1" ${i === state.dock.length - 1 ? 'disabled' : ''} aria-label="ลง">▼</button>
      <button class="icon-btn" data-rm="${id}" aria-label="ลบ">✕</button>
    </li>`;
  }).join('');

  if ($('dockCount')) $('dockCount').textContent = `${state.dock.length}/4`;
  if ($('addAppBtn')) $('addAppBtn').disabled = state.dock.length >= 4;
  if (state.dock.length >= 4 && $('appPicker')) $('appPicker').hidden = true;

  const avail = Object.keys(APPS).filter((id) => !state.dock.includes(id));
  all.innerHTML = avail.map((id) => {
    const a = APPS[id];
    return `<li class="list-item">
      ${badge(a)}
      <span class="nm">${esc(a.name)}</span>
      <button class="btn btn-sm btn-primary" data-add="${id}" type="button">+ เพิ่ม</button>
    </li>`;
  }).join('');
}

function renderContactsSettings() {
  const ul = $('contactList');
  if (!ul) return;
  ul.innerHTML = state.contacts.map((c, i) => `
    <li class="list-item">
      <div class="nm">${esc(c.name)}<small>${esc(c.tel)}</small></div>
      <button class="icon-btn" data-cdel="${i}" aria-label="ลบ">✕</button>
    </li>`).join('');

  ul.querySelectorAll('[data-cdel]').forEach((btn) => {
    btn.onclick = () => {
      state.contacts.splice(Number(btn.dataset.cdel), 1);
      persistState();
      renderContactsSettings();
      renderHomeQuickDial();
      renderHudPhoneGrid();
    };
  });
}

function renderSettingsUi() {
  const isReal = state.gpsMode === 'gps';

  // Header GPS Pill
  const hPill = $('gpsHeaderPill');
  if (hPill) {
    hPill.className = 'status-pill ' + (isReal ? 'gps-real' : 'gps-sim');
    if ($('gpsHeaderText')) $('gpsHeaderText').textContent = isReal ? 'GPS จริง' : 'โหมดจำลอง';
  }

  // Settings GPS controls
  if ($('gpsModeReal')) $('gpsModeReal').setAttribute('aria-pressed', String(isReal));
  if ($('gpsModeSim')) $('gpsModeSim').setAttribute('aria-pressed', String(!isReal));
  if ($('simSpeedField')) $('simSpeedField').hidden = isReal;
  if ($('gpsBanner')) {
    $('gpsBanner').textContent = state.gpsStatus;
    $('gpsBanner').className = 'status-banner ' + (isReal ? 'ok' : 'warn');
  }
  if ($('spdVal')) $('spdVal').textContent = state.simSpeed;
  if ($('spdSlider') && document.activeElement !== $('spdSlider')) $('spdSlider').value = state.simSpeed;

  // Voice button
  if ($('voiceToggleBtn')) {
    $('voiceToggleBtn').textContent = state.voiceEnabled ? '🔊 เสียงนำทางไทย: เปิด' : '🔇 เสียงนำทางไทย: ปิด';
  }

  // Safe mode
  if ($('safeOnBtn')) $('safeOnBtn').setAttribute('aria-pressed', String(state.safeOn));
  if ($('safeOffBtn')) $('safeOffBtn').setAttribute('aria-pressed', String(!state.safeOn));
  if ($('safeBanner')) {
    if (!state.safeOn) {
      $('safeBanner').textContent = 'ปิดโหมดปลอดภัยอยู่';
      $('safeBanner').className = 'status-banner';
    } else if (isSafeActive()) {
      $('safeBanner').textContent = `กำลังทำงาน · ${state.speed} ≥ ${state.safeLimit} km/h`;
      $('safeBanner').className = 'status-banner warn';
    } else {
      $('safeBanner').textContent = `ทำงานอัตโนมัติเมื่อถึง ${state.safeLimit} km/h`;
      $('safeBanner').className = 'status-banner acc';
    }
  }

  const limRow = $('safeLimitRow');
  if (limRow) {
    limRow.innerHTML = [40, 60, 80, 100].map((v) =>
      `<button class="chip" type="button" aria-pressed="${state.safeLimit === v}" data-lim="${v}">${v} km/h</button>`
    ).join('');
    limRow.querySelectorAll('[data-lim]').forEach((b) => {
      b.onclick = () => {
        state.safeLimit = Number(b.dataset.lim);
        persistState();
        renderSettingsUi();
        renderHudLayout();
      };
    });
  }

  // Theme & Map Style chips
  const mapRow = $('mapStyleRow');
  if (mapRow) {
    mapRow.innerHTML = MAP_STYLES.map((s) =>
      `<button class="chip" type="button" aria-pressed="${state.mapStyle === s.id}" data-ms="${s.id}">${s.label}</button>`
    ).join('');
    mapRow.querySelectorAll('[data-ms]').forEach((b) => {
      b.onclick = () => {
        state.mapStyle = b.dataset.ms;
        persistState();
        applyMapStyle(state.mapStyle);
        renderSettingsUi();
      };
    });
  }

  const themeRow = $('themeRow');
  if (themeRow) {
    themeRow.innerHTML = [['light', 'ครีมอุ่น-ฟ้า (แนะนำ)'], ['dark', 'โหมดมืด']].map(([id, label]) =>
      `<button class="chip" type="button" aria-pressed="${state.theme === id}" data-th="${id}">${label}</button>`
    ).join('');
    themeRow.querySelectorAll('[data-th]').forEach((b) => {
      b.onclick = () => {
        state.theme = b.dataset.th;
        persistState();
        applyTheme();
        renderSettingsUi();
      };
    });
  }

  const hudRow = $('hudThemeRow');
  if (hudRow) {
    hudRow.innerHTML = [['day', '☀️ กลางวัน (สว่าง)'], ['night', '🌙 กลางคืน (ตัดแสง)']].map(([id, label]) =>
      `<button class="chip" type="button" aria-pressed="${state.hudTheme === id}" data-ht="${id}">${label}</button>`
    ).join('');
    hudRow.querySelectorAll('[data-ht]').forEach((b) => {
      b.onclick = () => {
        state.hudTheme = b.dataset.ht;
        persistState();
        applyHudTheme();
        renderSettingsUi();
      };
    });
  }
}

function initBattery() {
  const updateUI = () => {
    const pct = Math.round(state.battery.level * 100);
    const cls = state.battery.level <= 0.2 ? 'low' : state.battery.level <= 0.5 ? 'mid' : 'good';
    if ($('battIcon')) $('battIcon').className = 'batt ' + cls;
    if ($('battFill')) $('battFill').style.width = `${pct}%`;
    if ($('battTxt')) $('battTxt').textContent = `${pct}%${state.battery.charging ? '⚡' : ''}`;
    renderHudClockAndBattery();
  };

  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      state.battery.real = true;
      const sync = () => {
        state.battery.level = b.level;
        state.battery.charging = b.charging;
        updateUI();
      };
      sync();
      b.onlevelchange = sync;
      b.onchargingchange = sync;
    }).catch(updateUI);
  } else {
    updateUI();
  }
}

function bindEvents() {
  // Onboarding dismiss
  if ($('welcomeTip')) $('welcomeTip').hidden = state.onboardingDismissed;
  if ($('welcomeClose')) {
    $('welcomeClose').onclick = () => {
      state.onboardingDismissed = true;
      $('welcomeTip').hidden = true;
      persistState();
    };
  }

  // Bottom Navigation
  document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach((btn) => {
    btn.onclick = () => showTab(Number(btn.dataset.nav));
  });

  // Launch / Exit Ride Mode
  if ($('navRideLaunch')) $('navRideLaunch').onclick = () => setRideMode(true);
  if ($('heroStartRide')) $('heroStartRide').onclick = () => setRideMode(true);
  if ($('hudExitBtn')) $('hudExitBtn').onclick = () => setRideMode(false);

  // Home Search + Quick POI chips
  if ($('homeSearchGo')) $('homeSearchGo').onclick = () => runPlaceSearch($('homeSearchInput')?.value);
  if ($('homeSearchInput')) {
    $('homeSearchInput').onkeydown = (e) => { if (e.key === 'Enter') runPlaceSearch(e.target.value); };
  }
  document.querySelectorAll('[data-poi]').forEach((btn) => {
    btn.onclick = () => runPlaceSearch(btn.dataset.poi);
  });

  // Map Tab Search & Route Sheet Actions
  if ($('mapSearchGo')) $('mapSearchGo').onclick = () => runPlaceSearch($('mapSearchInput')?.value);
  if ($('mapSearchInput')) {
    $('mapSearchInput').onkeydown = (e) => { if (e.key === 'Enter') runPlaceSearch(e.target.value); };
  }
  if ($('mapRecenterBtn')) $('mapRecenterBtn').onclick = () => recenterMap(16);

  if ($('routeStartBtn')) {
    $('routeStartBtn').onclick = () => {
      startGuidance();
      openHudScreen('home');
      setRideMode(true);
    };
  }
  if ($('routeSimBtn')) {
    $('routeSimBtn').onclick = () => {
      if (state.routeSimActive) {
        toggleRouteSim(false);
      } else {
        startGuidance();
        toggleRouteSim(true);
        openHudScreen('home');
        setRideMode(true);
      }
    };
  }
  if ($('routeGmapsBtn')) $('routeGmapsBtn').onclick = openInGoogleMaps;
  if ($('routeCloseBtn')) $('routeCloseBtn').onclick = stopNavigation;

  // Trip / Fuel Sub-Tabs
  if ($('subTripBtn')) $('subTripBtn').onclick = () => showTripSubTab('trip');
  if ($('subFuelBtn')) $('subFuelBtn').onclick = () => showTripSubTab('fuel');

  // GPS toggles
  if ($('gpsHeaderPill')) {
    $('gpsHeaderPill').onclick = () => setGpsMode(state.gpsMode === 'gps' ? 'sim' : 'gps');
  }
  if ($('gpsModeReal')) $('gpsModeReal').onclick = () => setGpsMode('gps');
  if ($('gpsModeSim')) $('gpsModeSim').onclick = () => setGpsMode('sim');
  if ($('spdSlider')) $('spdSlider').oninput = (e) => setSimSpeed(e.target.value);

  // Voice controls in settings
  if ($('voiceToggleBtn')) $('voiceToggleBtn').onclick = toggleVoice;
  if ($('voiceTestBtn')) {
    $('voiceTestBtn').onclick = () => speakThai('ทดสอบระบบนำทางด้วยเสียงภาษาไทย อีก 300 เมตร เลี้ยวขวาเข้าสู่ถนนสุขุมวิท', true);
  }

  // Safe mode
  if ($('safeOnBtn')) $('safeOnBtn').onclick = () => { state.safeOn = true; persistState(); renderSettingsUi(); renderHudLayout(); };
  if ($('safeOffBtn')) $('safeOffBtn').onclick = () => { state.safeOn = false; persistState(); renderSettingsUi(); renderHudLayout(); };

  // Dock customization
  if ($('addAppBtn')) $('addAppBtn').onclick = () => { $('appPicker').hidden = !$('appPicker').hidden; };
  if ($('dockMineList')) {
    $('dockMineList').onclick = (e) => {
      const rm = e.target.closest('[data-rm]');
      const mv = e.target.closest('[data-mv]');
      if (rm) {
        if (state.dock.length <= 1) return;
        state.dock = state.dock.filter((x) => x !== rm.dataset.rm);
        persistState();
        renderDockSettings();
        renderHudLayout();
      } else if (mv && !mv.disabled) {
        const i = Number(mv.dataset.mv);
        const j = i + Number(mv.dataset.dir);
        if (j >= 0 && j < state.dock.length) {
          [state.dock[i], state.dock[j]] = [state.dock[j], state.dock[i]];
          persistState();
          renderDockSettings();
          renderHudLayout();
        }
      }
    };
  }
  if ($('dockAllList')) {
    $('dockAllList').onclick = (e) => {
      const add = e.target.closest('[data-add]');
      if (!add || state.dock.length >= 4) return;
      state.dock.push(add.dataset.add);
      persistState();
      renderDockSettings();
      renderHudLayout();
    };
  }

  // Add speed dial contact
  if ($('contactAddBtn')) {
    $('contactAddBtn').onclick = () => {
      const name = $('contactNameIn').value.trim();
      const tel = $('contactTelIn').value.trim();
      if (!name || !tel) return;
      state.contacts.push({ name: name.slice(0, 24), tel: tel.slice(0, 20) });
      $('contactNameIn').value = '';
      $('contactTelIn').value = '';
      persistState();
      renderContactsSettings();
      renderHomeQuickDial();
      renderHudPhoneGrid();
    };
  }

  // Export / Import Backup
  if ($('exportDataBtn')) {
    $('exportDataBtn').onclick = () => {
      const blob = new Blob([localStorage.getItem('ridedash.v3') || '{}'], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ridedash-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      if ($('sysNote')) $('sysNote').textContent = 'ดาวน์โหลดไฟล์สำรองข้อมูลเรียบร้อย';
    };
  }
  if ($('importDataInput')) {
    $('importDataInput').onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = JSON.parse(String(reader.result));
          localStorage.setItem('ridedash.v3', JSON.stringify(d));
          loadState();
          applyTheme();
          applyHudTheme();
          renderDockSettings();
          renderContactsSettings();
          renderHomeQuickDial();
          renderSettingsUi();
          renderTripTab();
          renderFuel();
          renderHudLayout();
          if ($('sysNote')) $('sysNote').textContent = 'นำเข้าข้อมูลเรียบร้อยแล้ว';
        } catch (err) {
          if ($('sysNote')) $('sysNote').textContent = 'ไฟล์ JSON ไม่ถูกต้อง';
        }
      };
      reader.readAsText(file);
    };
  }

  // Re-acquire Wake Lock when returning to Ride Mode
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.rideMode && !wakeLock && navigator.wakeLock?.request) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ===== Bootstrap =====
loadState();
applyTheme();
initMedia();
initMap();
initDash();
initTrip();
initFuel();
initGps();
initBattery();
bindEvents();

renderDockSettings();
renderContactsSettings();
renderHomeQuickDial();
renderSettingsUi();
renderRouteSheet();
showTripSubTab('trip');
refreshWeather(true);
registerServiceWorker();

subscribe((topic) => {
  if (topic === 'gps') {
    renderHudTelemetry();
    renderSettingsUi();
    renderRouteSheet();
    refreshWeather(false);
  } else if (topic === 'route-ready') {
    drawActiveRoute(state.nav.phase !== 'guiding');
    renderRouteSheet();
  } else if (topic === 'route-cleared') {
    clearRouteLayers();
    renderRouteSheet();
  } else if (topic === 'nav') {
    renderHudNav();
    renderRouteSheet();
    renderHudTelemetry();
    renderSettingsUi();
  } else if (topic === 'media') {
    renderMediaUi();
  } else if (topic === 'media-progress') {
    renderMediaProgress();
  } else if (topic === 'weather') {
    renderWeatherUi();
  } else if (topic === 'trip' || topic === 'trip-tick') {
    renderTripTab();
    renderHudTelemetry();
  }
});

notify('all');
