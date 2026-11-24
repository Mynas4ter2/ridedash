import {
  state,
  APPS,
  RATIOS,
  MAP_STYLES,
  loadState,
  persistState,
  subscribe,
  notify,
  isSafeActive,
  visibleDock,
  svgIcon,
  esc
} from './store.js';
import { initGps, setGpsMode, setSimSpeed } from './gps.js';
import { refreshWeather } from './weather.js';
import { initMap, applyMapStyle, invalidateMap } from './map.js';
import { initMedia } from './media.js';
import { initTrip, renderTripTab } from './trip.js';
import { initFuel, renderFuel } from './fuel.js';
import {
  initDash,
  renderDashLayout,
  renderTelemetry,
  renderNavUi,
  renderMediaUi,
  renderMediaProgress,
  renderWeatherUi,
  renderPhoneGrid,
  renderClockAndBattery,
  applyViewportRatio,
  moveFocus,
  triggerFocused,
  goHome
} from './dash.js';

const $ = (id) => document.getElementById(id);
let wakeLock = null;

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const labels = { auto: '◐', light: '☀', dark: '☾' };
  if ($('themeBtn')) $('themeBtn').textContent = labels[state.theme] || '◐';
}

function renderCompanionDock() {
  const mine = $('dockMineList');
  const all = $('dockAllList');
  if (!mine || !all) return;

  const badge = (a) => {
    const inner = a.icon ? svgIcon(a.icon, 19) : esc(a.letter || a.name[0]);
    return `<span class="app-badge" style="background:linear-gradient(150deg,${a.grad[0]},${a.grad[1]})">${inner}</span>`;
  };

  mine.innerHTML = state.dock.map((id, i) => {
    const a = APPS[id];
    return `<li class="list-item">
      ${badge(a)}
      <span class="nm">${esc(a.name)}</span>
      <button class="icon-btn" data-mv="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">▲</button>
      <button class="icon-btn" data-mv="${i}" data-dir="1" ${i === state.dock.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">▼</button>
      <button class="icon-btn" data-rm="${id}" aria-label="ลบออก">✕</button>
    </li>`;
  }).join('');

  if ($('dockCount')) $('dockCount').textContent = `${state.dock.length}/4`;
  if ($('addAppBtn')) $('addAppBtn').disabled = state.dock.length >= 4;
  if (state.dock.length >= 4 && $('appPicker')) $('appPicker').hidden = true;

  const q = ($('appSearch')?.value || '').trim().toLowerCase();
  const available = Object.keys(APPS).filter((id) => {
    if (state.dock.includes(id)) return false;
    return !q || APPS[id].name.toLowerCase().includes(q);
  });

  all.innerHTML = available.length
    ? available.map((id) => {
        const a = APPS[id];
        return `<li class="list-item">
          ${badge(a)}
          <span class="nm">${esc(a.name)}</span>
          <button class="btn btn-sm btn-primary" data-add="${id}" type="button">+ เพิ่ม</button>
        </li>`;
      }).join('')
    : '<li class="list-item"><span class="nm"><small>ไม่พบแอปที่ค้นหา</small></span></li>';
}

function renderContactsManager() {
  const ul = $('contactList');
  if (!ul) return;
  ul.innerHTML = state.contacts.length
    ? state.contacts.map((c, i) => `
        <li class="list-item">
          <div class="nm">${esc(c.name)}<small>${esc(c.tel)}</small></div>
          <button class="icon-btn" data-cdel="${i}" aria-label="ลบเบอร์">✕</button>
        </li>`).join('')
    : '<li class="list-item"><div class="nm"><small>ยังไม่มีเบอร์โทรด่วน</small></div></li>';

  ul.querySelectorAll('[data-cdel]').forEach((btn) => {
    btn.onclick = () => {
      state.contacts.splice(Number(btn.dataset.cdel), 1);
      persistState();
      renderContactsManager();
      renderPhoneGrid();
    };
  });
}

function renderDisplaySettings() {
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
        renderDisplaySettings();
      };
    });
  }

  const ratioRow = $('ratioRow');
  if (ratioRow) {
    ratioRow.innerHTML = RATIOS.map((r) =>
      `<button class="chip" type="button" aria-pressed="${state.ratioId === r.id}" data-rt="${r.id}">${r.label}</button>`
    ).join('');
    ratioRow.querySelectorAll('[data-rt]').forEach((b) => {
      b.onclick = () => {
        state.ratioId = b.dataset.rt;
        persistState();
        if ($('deviceRatioLabel')) $('deviceRatioLabel').textContent = state.ratioId === 'fill' ? 'FULL' : state.ratioId;
        applyViewportRatio();
        renderDisplaySettings();
      };
    });
  }

  const themeRow = $('themeRow');
  if (themeRow) {
    const themes = [['auto', 'อัตโนมัติตามเครื่อง'], ['light', 'สว่าง'], ['dark', 'มืด']];
    themeRow.innerHTML = themes.map(([id, label]) =>
      `<button class="chip" type="button" aria-pressed="${state.theme === id}" data-th="${id}">${label}</button>`
    ).join('');
    themeRow.querySelectorAll('[data-th]').forEach((b) => {
      b.onclick = () => {
        state.theme = b.dataset.th;
        persistState();
        applyTheme();
        renderDisplaySettings();
      };
    });
  }
}

function renderSystemControls() {
  const isReal = state.gpsMode === 'gps';
  if ($('gpsModeReal')) $('gpsModeReal').setAttribute('aria-pressed', String(isReal));
  if ($('gpsModeSim')) $('gpsModeSim').setAttribute('aria-pressed', String(!isReal));
  if ($('simSpeedField')) $('simSpeedField').hidden = isReal;

  if ($('gpsBanner')) {
    $('gpsBanner').textContent = state.gpsStatus;
    $('gpsBanner').className = 'status-banner ' + (isReal ? 'ok' : 'acc');
  }
  if ($('gpsHeaderDot')) $('gpsHeaderDot').className = 'dot' + (isReal ? '' : ' sim');
  if ($('gpsHeaderText')) $('gpsHeaderText').textContent = isReal ? 'GPS จริง' : 'โหมดจำลอง';
  if ($('gpsQuickToggle')) $('gpsQuickToggle').textContent = isReal ? 'สลับเป็นโหมดจำลอง' : 'เปิด GPS จริง';

  if ($('spdVal')) $('spdVal').textContent = state.simSpeed;
  if ($('spdSlider') && document.activeElement !== $('spdSlider')) $('spdSlider').value = state.simSpeed;

  // Safe mode controls (clean toggle without inline background bugs)
  if ($('safeOnBtn')) $('safeOnBtn').setAttribute('aria-pressed', String(state.safeOn));
  if ($('safeOffBtn')) $('safeOffBtn').setAttribute('aria-pressed', String(!state.safeOn));

  const sb = $('safeBanner');
  if (sb) {
    if (!state.safeOn) {
      sb.textContent = 'สถานะ: ปิดโหมดปลอดภัย';
      sb.className = 'status-banner';
    } else if (isSafeActive()) {
      sb.textContent = `กำลังทำงาน · ${state.speed} ≥ ${state.safeLimit} km/h`;
      sb.className = 'status-banner warn';
    } else {
      sb.textContent = `พร้อมทำงานเมื่อความเร็วถึง ${state.safeLimit} km/h (ตอนนี้ ${state.speed})`;
      sb.className = 'status-banner acc';
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
        renderSystemControls();
        renderDashLayout();
      };
    });
  }

  // Diagnostics
  const dg = $('diagGrid');
  if (dg) {
    const pct = Math.round(state.battery.level * 100);
    dg.innerHTML = [
      ['โหมดพิกัด', isReal ? 'GPS จริง' : 'จำลอง'],
      ['ความแม่นยำ', state.accuracy != null ? `±${state.accuracy} ม.` : '—'],
      ['กันหน้าจอดับ', wakeLock ? 'เปิดอยู่' : 'ปิดอยู่'],
      ['แบตเตอรี่', `${pct}%${state.battery.charging ? ' ⚡' : ''}`]
    ].map(([k, v]) => `<div class="stat-tile"><small>${k}</small><b>${v}</b></div>`).join('');
  }

  // Focus caption
  if ($('fcap')) {
    const dock = visibleDock();
    const cur = state.screen === 'home' ? APPS[dock[state.focusIdx]] : APPS[state.screen];
    $('fcap').textContent = cur ? `· ${state.screen === 'home' ? 'โฟกัส' : 'เปิดอยู่'}: ${cur.name}` : '';
  }

  if ($('rideSafeQuickBtn')) {
    $('rideSafeQuickBtn').textContent = state.safeOn ? '🛡️ ปลอดภัย: เปิด' : '🛡️ ปลอดภัย: ปิด';
  }
}

async function setRideMode(on) {
  state.rideMode = on;
  document.body.classList.toggle('ride-mode', on);

  if (on) {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
    try {
      if (navigator.wakeLock?.request) {
        wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
      }
    } catch (e) {}
  } else {
    try { if (wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {}
    try { if (screen.orientation?.unlock) screen.orientation.unlock(); } catch (e) {}
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
  }

  renderSystemControls();
  applyViewportRatio();
  invalidateMap();
}

function showTab(index) {
  document.querySelectorAll('.tab-pane[data-tab]').forEach((pane) => {
    pane.hidden = pane.dataset.tab !== String(index);
  });
  document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === String(index));
  });
}

function initBattery() {
  const updateUI = () => {
    const pct = Math.round(state.battery.level * 100);
    const cls = state.battery.level <= 0.2 ? 'low' : state.battery.level <= 0.5 ? 'mid' : 'good';
    if ($('battIcon')) $('battIcon').className = 'batt ' + cls;
    if ($('battFill')) $('battFill').style.width = `${pct}%`;
    if ($('battTxt')) $('battTxt').textContent = `${pct}%${state.battery.charging ? '⚡' : ''}`;
    renderClockAndBattery();
    renderSystemControls();
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
  // Bottom Nav
  document.querySelectorAll('.bottom-nav .nav-item[data-nav]').forEach((btn) => {
    btn.onclick = () => {
      showTab(Number(btn.dataset.nav));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  // Launch / Exit Ride Mode
  if ($('navRideLaunch')) $('navRideLaunch').onclick = () => setRideMode(true);
  if ($('rideLaunchTop')) $('rideLaunchTop').onclick = () => setRideMode(true);
  if ($('rideExitBtn')) $('rideExitBtn').onclick = () => setRideMode(false);
  if ($('rideSafeQuickBtn')) {
    $('rideSafeQuickBtn').onclick = () => {
      state.safeOn = !state.safeOn;
      persistState();
      renderSystemControls();
      renderDashLayout();
    };
  }

  // Theme cycle button
  if ($('themeBtn')) {
    $('themeBtn').onclick = () => {
      const order = ['auto', 'light', 'dark'];
      state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
      persistState();
      applyTheme();
      renderDisplaySettings();
    };
  }

  // GPS quick toggles
  const toggleGps = () => setGpsMode(state.gpsMode === 'gps' ? 'sim' : 'gps');
  if ($('gpsHeaderPill')) $('gpsHeaderPill').onclick = toggleGps;
  if ($('gpsQuickToggle')) $('gpsQuickToggle').onclick = toggleGps;
  if ($('gpsModeReal')) $('gpsModeReal').onclick = () => setGpsMode('gps');
  if ($('gpsModeSim')) $('gpsModeSim').onclick = () => setGpsMode('sim');
  if ($('spdSlider')) $('spdSlider').oninput = (e) => setSimSpeed(e.target.value);

  // Safe mode toggles
  if ($('safeOnBtn')) {
    $('safeOnBtn').onclick = () => {
      state.safeOn = true;
      persistState();
      renderSystemControls();
      renderDashLayout();
    };
  }
  if ($('safeOffBtn')) {
    $('safeOffBtn').onclick = () => {
      state.safeOn = false;
      persistState();
      renderSystemControls();
      renderDashLayout();
    };
  }

  // Handlebar pad + keyboard
  if ($('bL')) $('bL').onclick = () => moveFocus(-1);
  if ($('bR')) $('bR').onclick = () => moveFocus(1);
  if ($('bOk')) $('bOk').onclick = () => triggerFocused();
  if ($('bBack')) $('bBack').onclick = () => goHome();

  document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'Enter' && tag !== 'BUTTON') { triggerFocused(); }
    else if (e.key === 'Escape') {
      if (state.rideMode && state.screen === 'home') setRideMode(false);
      else goHome();
    }
  });

  // Dock customization
  if ($('addAppBtn')) {
    $('addAppBtn').onclick = () => {
      const p = $('appPicker');
      p.hidden = !p.hidden;
      if (!p.hidden) $('appSearch')?.focus();
    };
  }
  if ($('appSearch')) $('appSearch').oninput = renderCompanionDock;

  if ($('dockMineList')) {
    $('dockMineList').onclick = (e) => {
      const rm = e.target.closest('[data-rm]');
      const mv = e.target.closest('[data-mv]');
      if (rm) {
        if (state.dock.length <= 1) {
          $('dockMsg').textContent = 'ต้องมีทางลัดอย่างน้อย 1 แอป';
          return;
        }
        const id = rm.dataset.rm;
        state.dock = state.dock.filter((x) => x !== id);
        if (state.screen === id) state.screen = 'home';
        $('dockMsg').textContent = `นำ ${APPS[id].name} ออกจากแถบแล้ว`;
        persistState();
        renderCompanionDock();
        renderDashLayout();
      } else if (mv && !mv.disabled) {
        const i = Number(mv.dataset.mv);
        const j = i + Number(mv.dataset.dir);
        if (j >= 0 && j < state.dock.length) {
          [state.dock[i], state.dock[j]] = [state.dock[j], state.dock[i]];
          persistState();
          renderCompanionDock();
          renderDashLayout();
        }
      }
    };
  }

  if ($('dockAllList')) {
    $('dockAllList').onclick = (e) => {
      const add = e.target.closest('[data-add]');
      if (!add) return;
      if (state.dock.length >= 4) return;
      const id = add.dataset.add;
      state.dock.push(id);
      $('dockMsg').textContent = `เพิ่ม ${APPS[id].name} บนแถบแล้ว`;
      persistState();
      renderCompanionDock();
      renderDashLayout();
    };
  }

  // Contacts add
  if ($('contactAddBtn')) {
    $('contactAddBtn').onclick = () => {
      const name = $('contactNameIn').value.trim();
      const tel = $('contactTelIn').value.trim();
      if (!name || !tel) return;
      state.contacts.push({ name: name.slice(0, 24), tel: tel.slice(0, 20) });
      $('contactNameIn').value = '';
      $('contactTelIn').value = '';
      persistState();
      renderContactsManager();
      renderPhoneGrid();
    };
  }

  // Backup / Restore JSON
  if ($('exportDataBtn')) {
    $('exportDataBtn').onclick = () => {
      const blob = new Blob([localStorage.getItem('ridedash.v2') || '{}'], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ridedash-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      if ($('sysNote')) $('sysNote').textContent = 'ดาวน์โหลดไฟล์สำรองข้อมูล JSON แล้ว';
    };
  }

  if ($('importDataInput')) {
    $('importDataInput').onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          localStorage.setItem('ridedash.v2', JSON.stringify(data));
          loadState();
          applyTheme();
          renderCompanionDock();
          renderContactsManager();
          renderDisplaySettings();
          renderSystemControls();
          renderTripTab();
          renderFuel();
          renderDashLayout();
          if ($('sysNote')) $('sysNote').textContent = 'นำเข้าข้อมูลเรียบร้อยแล้ว';
        } catch (err) {
          if ($('sysNote')) $('sysNote').textContent = 'ไฟล์ JSON ไม่ถูกต้อง';
        }
      };
      reader.readAsText(file);
    };
  }

  // Re-acquire Wake Lock if returning to tab in Ride Mode
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

// Bootstrap
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

renderCompanionDock();
renderContactsManager();
renderDisplaySettings();
renderSystemControls();
refreshWeather(true);
registerServiceWorker();

subscribe((topic) => {
  if (topic === 'gps') {
    renderTelemetry();
    renderSystemControls();
    applyViewportRatio();
    refreshWeather(false);
  } else if (topic === 'nav') {
    renderNavUi();
  } else if (topic === 'media') {
    renderMediaUi();
  } else if (topic === 'media-progress') {
    renderMediaProgress();
  } else if (topic === 'weather') {
    renderWeatherUi();
  } else if (topic === 'trip' || topic === 'trip-tick') {
    renderTripTab();
    renderTelemetry();
  } else if (topic === 'screen') {
    renderSystemControls();
  }
});

notify('all');
