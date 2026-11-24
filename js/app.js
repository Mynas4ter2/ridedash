import {
  state,
  APPS,
  PROV,
  RATIOS,
  RES,
  MODES,
  ACTS,
  loadState,
  persistState,
  subscribe,
  notify,
  isSafeActive,
  visibleDock,
  effectiveResolution,
  svgIcon,
  esc
} from './store.js';
import { initGps, setGpsMode, setSimSpeed } from './gps.js';
import { initMap, applyMapTheme, invalidateMap } from './map.js';
import { initMedia } from './media.js';
import { initTrip, renderTripTab } from './trip.js';
import { initFuel } from './fuel.js';
import { initQrModal, openQrModal } from './qr.js';
import {
  initBridge,
  requestScanQr,
  connectBike,
  disconnectBike,
  syncStreamConfig,
  setBridgeHandlers,
  isNativeAndroid
} from './bridge.js';
import {
  initDash,
  openScreen,
  goFocus,
  okFocus,
  backHome,
  fitDisplay,
  renderDashLayout,
  renderTelemetry,
  renderMediaUi,
  renderMediaProgress
} from './dash.js';

const $ = (id) => document.getElementById(id);
let wakeLock = null;

const BTN = [
  ['L', 'ซ้าย', 'bL'],
  ['R', 'ขวา', 'bR'],
  ['O', 'OK', 'bOk'],
  ['B', 'กลับ', 'bBack']
];

function aname(v) {
  const f = ACTS.find((a) => a[0] === v);
  return f ? f[1] : v;
}

function toast(msg) {
  if ($('toast')) $('toast').textContent = msg;
}

function runAction(a) {
  const v = visibleDock();
  if (a === 'left') goFocus(-1);
  else if (a === 'right') goFocus(1);
  else if (a === 'open') okFocus();
  else if (a === 'back') backHome();
  else if (a === 'map' || a === 'music') {
    if (!v.includes(a)) {
      toast(`ไม่มี ${APPS[a].n} ในทางลัดตอนนี้`);
      return;
    }
    openScreen(a);
  } else if (a === 'mode') {
    state.mode = state.mode === 'contain' ? 'cover' : state.mode === 'cover' ? 'fill' : 'contain';
    persistState();
    syncStreamConfig();
    renderDisplayTab();
    fitDisplay();
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#080B11' : '#F7F3EC');
  const btn = $('headerThemeBtn');
  if (btn) {
    btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
    btn.title = state.theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด';
  }
  applyMapTheme();
}

function chips(id, list, isOn, onSelect) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = list.map(([val, label]) =>
    `<button class="chip" type="button" aria-pressed="${isOn(val)}" data-v="${esc(val)}">${esc(label)}</button>`
  ).join('');
  el.querySelectorAll('[data-v]').forEach((b) => {
    b.onclick = () => onSelect(b.dataset.v);
  });
}

function renderAppsTab() {
  const mine = $('mine');
  const all = $('all');
  if (!mine || !all) return;

  const ic = (a) => `<span class="app-badge" style="background:linear-gradient(155deg,${a.grad[0]},${a.grad[1]})">${a.p ? svgIcon(a.p, 19) : esc(a.l)}</span>`;

  mine.innerHTML = state.dock.map((id, i) => {
    const a = APPS[id];
    return `<li class="list-item">
      ${ic(a)}
      <span class="nm">${esc(a.n)}</span>
      <button class="icon-btn" data-m="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">▲</button>
      <button class="icon-btn" data-m="${i}" data-d="1" ${i === state.dock.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">▼</button>
      <button class="icon-btn" data-r="${id}" aria-label="เอาออก">✕</button>
    </li>`;
  }).join('');

  if ($('cnt')) $('cnt').textContent = `${state.dock.length}/4`;
  if ($('addBtn')) $('addBtn').disabled = state.dock.length >= 4;
  if (state.dock.length >= 4 && $('picker')) $('picker').hidden = true;

  const q = ($('q')?.value || '').trim().toLowerCase();
  const avail = Object.keys(APPS).filter((k) => !state.dock.includes(k) && (!q || APPS[k].n.toLowerCase().includes(q)));
  all.innerHTML = avail.length
    ? avail.map((k) => {
        const a = APPS[k];
        return `<li class="list-item">${ic(a)}<span class="nm">${esc(a.n)}</span><button class="btn btn-sm btn-primary" data-a="${k}" type="button">+ เพิ่ม</button></li>`;
      }).join('')
    : '<li class="list-item"><span class="nm"><small>ไม่พบแอป</small></span></li>';
}

function renderDisplayTab() {
  chips('prov', PROV.map((x) => [x, x]), (v) => v === state.prov, (v) => {
    state.prov = v;
    persistState();
    syncStreamConfig();
    renderDisplayTab();
    renderDashLayout();
  });

  chips('ratio', RATIOS.map((r) => [r[0], r[0] === 'Auto' ? 'อัตโนมัติ (Auto)' : r[0]]), (v) => v === state.rname, (v) => {
    state.rname = v;
    state.res = RES[v][0];
    const found = RATIOS.find((r) => r[0] === v);
    state.ratio = found && found[1] ? found[1] : 5 / 3;
    if ($('deviceRatioBadge')) $('deviceRatioBadge').textContent = v === 'Auto' ? 'Auto Display' : `${v} Display`;
    persistState();
    syncStreamConfig();
    renderDisplayTab();
    fitDisplay();
    renderDiag();
  });

  chips('res', (RES[state.rname] || RES['5:3']).map((x) => [x, x === 'Auto' ? `อัตโนมัติ (${effectiveResolution().text})` : x]), (v) => v === state.res, (v) => {
    state.res = v;
    persistState();
    syncStreamConfig();
    renderDisplayTab();
    fitDisplay();
    renderDiag();
  });

  chips('mode', MODES, (v) => v === state.mode, (v) => {
    state.mode = v;
    persistState();
    syncStreamConfig();
    renderDisplayTab();
    fitDisplay();
  });
}

function renderSafeSection() {
  if ($('safeOn')) $('safeOn').setAttribute('aria-pressed', String(state.safeOn));
  if ($('safeOff')) $('safeOff').setAttribute('aria-pressed', String(!state.safeOn));

  const st = $('safeStatus');
  if (st) {
    if (!state.safeOn) {
      st.textContent = 'สถานะ: ปิด';
      st.className = 'status-banner';
    } else if (isSafeActive()) {
      st.textContent = `สถานะ: ทำงานอยู่ · ${state.speed} ≥ ${state.limit} km/h`;
      st.className = 'status-banner warn';
    } else {
      st.textContent = `สถานะ: เปิด · จะทำงานเมื่อถึง ${state.limit} km/h (ตอนนี้ ${state.speed})`;
      st.className = 'status-banner acc';
    }
  }

  if ($('spv')) $('spv').textContent = state.speed;
  if ($('spd') && document.activeElement !== $('spd')) $('spd').value = state.speed;

  const isRealGps = state.gpsMode === 'gps' || state.gpsMode === 'native';
  if ($('gpsToggleBtn')) {
    $('gpsToggleBtn').textContent = isRealGps ? 'ใช้ GPS จริงอยู่ (สลับเป็นจำลอง)' : 'สลับใช้ GPS จริง';
    $('gpsToggleBtn').setAttribute('aria-pressed', String(isRealGps));
  }

  chips('lim', [40, 60, 80, 100].map((x) => [String(x), `${x} km/h`]), (v) => Number(v) === state.limit, (v) => {
    state.limit = Number(v);
    persistState();
    syncStreamConfig();
    renderSafeSection();
    renderDashLayout();
  });

  if ($('safeMsg')) {
    $('safeMsg').textContent = !state.safeOn
      ? 'โหมดปลอดภัยปิดอยู่'
      : isSafeActive()
        ? 'ซ่อนทางลัดที่ไม่จำเป็น · ขยายแผนที่และมาตรวัดความเร็ว'
        : `จะทำงานอัตโนมัติเมื่อความเร็วถึง ${state.limit} km/h`;
  }
}

function renderDiag() {
  const dg = $('diag');
  if (!dg) return;

  const res = effectiveResolution();
  let d;
  if (state.nativeDiag) {
    d = {
      fps: state.nativeDiag.fps,
      lat: state.nativeDiag.lat,
      tmp: state.nativeDiag.tmp,
      br: state.nativeDiag.br,
      conn: state.recon ? 'กำลังต่อใหม่' : (state.conn.status === 'streaming' ? 'เชื่อมต่อแล้ว (Native)' : state.conn.message)
    };
  } else {
    const fpsBase = state.hot ? 20 : 30;
    d = {
      fps: Math.round(fpsBase + (state.hot ? 0 : (Math.random() - 0.5) * 2)),
      lat: Math.round(state.hot ? 140 + Math.random() * 25 : 58 + Math.random() * 22),
      tmp: state.hot ? 44 : 38,
      br: ((res.w * res.h * fpsBase * 0.08) / 1e6).toFixed(1),
      conn: state.recon ? 'กำลังต่อใหม่' : (state.conn.status === 'streaming' ? 'เชื่อมต่อแล้ว' : 'โหมดทดสอบ')
    };
  }
  state.lastDiag = d;

  const items = [
    ['FPS', d.fps],
    ['ความหน่วง', `${d.lat} ms`],
    ['อุณหภูมิเครื่อง', `${d.tmp} °C`],
    ['บิตเรต (ประมาณ)', `${d.br} Mbps`],
    ['การเชื่อมต่อ', d.conn],
    ['ต่อใหม่แล้ว', `${state.rc} ครั้ง`]
  ];
  dg.innerHTML = items.map(([k, v]) => `<div class="stat-tile"><small>${k}</small><b>${v}</b></div>`).join('');

  if (!state.logMsg && $('dmsg')) {
    $('dmsg').textContent = state.nativeDiag
      ? 'กำลังแสดงค่าจริงจาก Android Native Bridge'
      : (state.hot ? 'เครื่องร้อน: ลดเฟรมเรตเหลือ 20 FPS อัตโนมัติ' : 'ค่าจำลองสำหรับทดสอบ (จะเปลี่ยนเป็นค่าจริงอัตโนมัติเมื่อต่อผ่าน Android Bridge)');
  }
}

function renderConnStatus() {
  const pill = $('connPill');
  const txt = $('connPillText');
  if (!pill || !txt) return;

  const s = state.conn.status;
  if (s === 'streaming') {
    pill.className = 'status-pill conn-ok';
    txt.textContent = isNativeAndroid() ? 'กำลังส่งภาพ' : 'เชื่อมต่อแล้ว';
  } else if (s === 'connecting' || s === 'scanning' || s === 'reconnecting') {
    pill.className = 'status-pill conn-warn';
    txt.textContent = s === 'reconnecting' ? 'กำลังต่อใหม่...' : 'กำลังเชื่อมต่อ...';
  } else {
    pill.className = 'status-pill';
    txt.textContent = isNativeAndroid() ? 'รอเชื่อมรถ' : 'Demo Mode';
  }
}

function renderFocusCap() {
  const v = visibleDock();
  const a = state.screen === 'home' ? APPS[v[state.foc]] : APPS[state.screen];
  if ($('fcap')) $('fcap').textContent = a ? `· ${state.screen === 'home' ? 'โฟกัส' : 'เปิดอยู่'}: ${a.n}` : '';
}

async function setMirror(on) {
  state.mirrorMode = on;
  document.body.classList.toggle('mirror-mode', on);
  if (on) {
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
    try { if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    try { if (navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request('screen').catch(() => null); } catch (e) {}
  } else {
    try { if (wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {}
    try { if (screen.orientation?.unlock) screen.orientation.unlock(); } catch (e) {}
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
  }
  setTimeout(() => { fitDisplay(); invalidateMap(); }, 100);
}

function showTab(n) {
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.hidden = el.dataset.tab !== String(n);
  });
  document.querySelectorAll('.bank-nav button[data-nav]').forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === String(n));
  });
}

function bindEvents() {
  // Bottom Nav
  document.querySelectorAll('.bank-nav button[data-nav]').forEach((btn) => {
    btn.onclick = () => {
      showTab(Number(btn.dataset.nav));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  // Center QR Scan button
  if ($('scanBtn')) {
    $('scanBtn').onclick = () => {
      if (!requestScanQr()) openQrModal();
    };
  }

  // Header controls
  if ($('headerThemeBtn')) {
    $('headerThemeBtn').onclick = () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      persistState();
      applyTheme();
    };
  }
  if ($('mirrorBtn')) $('mirrorBtn').onclick = () => setMirror(!state.mirrorMode);
  if ($('mirrorExit')) $('mirrorExit').onclick = () => setMirror(false);
  if ($('connPill')) {
    $('connPill').onclick = () => {
      if (state.conn.status === 'streaming') disconnectBike();
      else if (!requestScanQr()) openQrModal();
    };
  }

  // Handlebar pad (short press + 600ms long press)
  BTN.forEach(([code, label, id]) => {
    const el = $(id);
    if (!el) return;
    let timer = null;
    let fired = false;
    el.onpointerdown = () => {
      fired = false;
      timer = setTimeout(() => {
        fired = true;
        timer = null;
        const a = state.map[code][1];
        toast(`${label} กดค้าง → ${aname(a)}`);
        runAction(a);
      }, 600);
    };
    el.onpointerup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        if (!fired) {
          const a = state.map[code][0];
          toast(`${label} กดสั้น → ${aname(a)}`);
          runAction(a);
        }
      }
    };
    el.onpointerleave = el.onpointercancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };
    el.oncontextmenu = (e) => e.preventDefault();
    el.onclick = (e) => {
      if (e.detail === 0) {
        const a = state.map[code][0];
        toast(`${label} → ${aname(a)}`);
        runAction(a);
      }
    };
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const tg = e.target?.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') goFocus(-1);
    else if (e.key === 'ArrowRight') goFocus(1);
    else if (e.key === 'Enter' && tg !== 'BUTTON') okFocus();
    else if (e.key === 'Escape') {
      if (state.mirrorMode && state.screen === 'home') setMirror(false);
      else backHome();
    }
  });

  // Dock shortcuts management
  if ($('addBtn')) {
    $('addBtn').onclick = () => {
      const p = $('picker');
      p.hidden = !p.hidden;
      if (!p.hidden) $('q')?.focus();
    };
  }
  if ($('q')) $('q').oninput = renderAppsTab;

  if ($('mine')) {
    $('mine').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.r) {
        if (state.dock.length <= 1) {
          if ($('msg')) $('msg').textContent = 'ต้องมีทางลัดอย่างน้อย 1 รายการ';
          return;
        }
        const id = b.dataset.r;
        state.dock = state.dock.filter((x) => x !== id);
        if (state.screen === id) state.screen = 'home';
        if ($('msg')) $('msg').textContent = `เอา ${APPS[id].n} ออกแล้ว`;
        persistState();
        renderAppsTab();
        renderDashLayout();
      } else if (b.dataset.m != null) {
        const i = Number(b.dataset.m);
        const j = i + Number(b.dataset.d);
        if (j >= 0 && j < state.dock.length) {
          [state.dock[i], state.dock[j]] = [state.dock[j], state.dock[i]];
          persistState();
          renderAppsTab();
          renderDashLayout();
        }
      }
    };
  }

  if ($('all')) {
    $('all').onclick = (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b || state.dock.length >= 4) return;
      const id = b.dataset.a;
      state.dock.push(id);
      if ($('msg')) $('msg').textContent = `เพิ่ม ${APPS[id].n} แล้ว`;
      persistState();
      renderAppsTab();
      renderDashLayout();
    };
  }

  // Safe mode & GPS
  if ($('safeOn')) $('safeOn').onclick = () => { state.safeOn = true; persistState(); syncStreamConfig(); renderSafeSection(); renderDashLayout(); };
  if ($('safeOff')) $('safeOff').onclick = () => { state.safeOn = false; persistState(); syncStreamConfig(); renderSafeSection(); renderDashLayout(); };
  if ($('spd')) $('spd').oninput = (e) => setSimSpeed(e.target.value);
  if ($('gpsToggleBtn')) {
    $('gpsToggleBtn').onclick = () => setGpsMode(state.gpsMode === 'gps' ? 'sim' : 'gps');
  }

  // Diagnostics buttons
  if ($('hotT')) {
    $('hotT').onclick = function () {
      state.hot = !state.hot;
      this.setAttribute('aria-pressed', String(state.hot));
      renderDiag();
    };
  }
  if ($('dropT')) {
    $('dropT').onclick = () => {
      if (state.recon) return;
      state.recon = true;
      renderDashLayout();
      renderDiag();
      setTimeout(() => {
        state.recon = false;
        state.rc += 1;
        renderDashLayout();
        renderDiag();
      }, 2500);
    };
  }
  if ($('logB')) {
    $('logB').onclick = () => {
      const L = state.lastDiag;
      const text = `RideDash diag ${new Date().toISOString()}\nfps=${L.fps} latency_ms=${L.lat} temp_c=${L.tmp} bitrate_mbps=${L.br} ratio=${state.rname} res=${state.res} mode=${state.mode} speed=${state.speed} safe=${isSafeActive()} reconnects=${state.rc}`;
      state.logMsg = true;
      navigator.clipboard?.writeText(text)
        .then(() => { if ($('dmsg')) $('dmsg').textContent = 'คัดลอก log แล้ว'; })
        .catch(() => { if ($('dmsg')) $('dmsg').textContent = text; });
      setTimeout(() => { state.logMsg = false; }, 4000);
    };
  }

  // Terms & Privacy modal
  const openLegal = (reviewMode = false) => {
    const m = $('legalModal');
    const btn = $('legalAcceptBtn');
    if (!m) return;
    if (btn) btn.textContent = reviewMode ? 'ปิดหน้าต่าง' : 'ยอมรับและเริ่มใช้งาน';
    m.hidden = false;
  };
  if (!state.termsAccepted) openLegal(false);
  if ($('openLegalBtn')) $('openLegalBtn').onclick = () => openLegal(true);
  if ($('legalAcceptBtn')) {
    $('legalAcceptBtn').onclick = () => {
      if (!state.termsAccepted) {
        state.termsAccepted = true;
        persistState();
      }
      if ($('legalModal')) $('legalModal').hidden = true;
    };
  }
  if ($('legalModal')) {
    $('legalModal').onclick = (e) => {
      if (e.target === $('legalModal') && state.termsAccepted) $('legalModal').hidden = true;
    };
  }

  // Re-acquire Wake Lock in mirror mode
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.mirrorMode && !wakeLock && navigator.wakeLock?.request) {
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
initBridge();
setBridgeHandlers({
  onHandlebar(key, pressType) {
    const mapRow = state.map[key];
    if (!mapRow) return;
    const action = mapRow[pressType ? 1 : 0];
    toast(`แฮนด์ ${key} (${pressType ? 'กดค้าง' : 'กดสั้น'}) → ${aname(action)}`);
    runAction(action);
  },
  onQrResult(raw) {
    toast(`สแกน QR สำเร็จ: ${raw.slice(0, 28)}`);
    connectBike(raw);
  }
});

initMedia();
initMap();
initDash();
initTrip();
initFuel();
initGps();
initQrModal(setMirror);
bindEvents();

renderAppsTab();
renderDisplayTab();
renderSafeSection();
renderDiag();
renderConnStatus();
renderFocusCap();
registerServiceWorker();

setInterval(renderDiag, 1200);

subscribe((topic) => {
  if (topic === 'gps') {
    renderTelemetry();
    renderSafeSection();
  } else if (topic === 'media') {
    renderMediaUi();
  } else if (topic === 'media-progress') {
    renderMediaProgress();
  } else if (topic === 'trip' || topic === 'trip-tick') {
    renderTripTab();
    renderTelemetry();
  } else if (topic === 'screen') {
    renderFocusCap();
  } else if (topic === 'conn') {
    renderConnStatus();
    renderDashLayout();
    renderDiag();
  } else if (topic === 'diag') {
    renderDiag();
  }
});

notify('all');
