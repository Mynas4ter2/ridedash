import { state, notify, persistState, fmtDuration, esc } from './store.js';

let tripTimer = null;

export function startOrFinishTrip() {
  const T = state.trip;
  if (T.on) {
    T.on = false;
    T.paused = false;
    if (T.seconds > 0 || T.distanceKm > 0) {
      const now = new Date();
      const p2 = (n) => (n < 10 ? '0' + n : String(n));
      const defaultName = `ทริป ${p2(now.getDate())}/${p2(now.getMonth() + 1)}`;
      const label = state.rideMode ? defaultName : (prompt('ชื่อทริป (ไม่บังคับ)', defaultName) || defaultName);
      const avg = T.seconds > 0 ? Math.round(T.distanceKm / (T.seconds / 3600)) : 0;
      state.trips.unshift({
        id: 't-' + now.getTime(),
        name: label.trim().slice(0, 40),
        when: `${p2(now.getHours())}:${p2(now.getMinutes())}`,
        d: Number(T.distanceKm.toFixed(2)),
        t: T.seconds,
        avg,
        max: T.maxSpeed,
        ts: now.getTime()
      });
      state.trips = state.trips.slice(0, 50);
      persistState();
    }
    state.trip = { on: false, paused: false, seconds: 0, distanceKm: 0, maxSpeed: 0 };
  } else {
    state.trip = { on: true, paused: false, seconds: 0, distanceKm: 0, maxSpeed: state.speed };
  }
  notify('trip');
}

export function togglePauseTrip() {
  if (!state.trip.on) return;
  state.trip.paused = !state.trip.paused;
  notify('trip');
}

export function resetTrip() {
  if (state.trip.on && !state.trip.paused) return;
  state.trip = { on: false, paused: false, seconds: 0, distanceKm: 0, maxSpeed: 0 };
  notify('trip');
}

export function deleteTrip(id) {
  state.trips = state.trips.filter((r) => r.id !== id);
  persistState();
  notify('trip');
}

export function clearAllTrips() {
  if (!state.trips.length) return;
  if (!confirm('ลบประวัติทริปทั้งหมด?')) return;
  state.trips = [];
  persistState();
  notify('trip');
}

export function setTripFilter(filter) {
  state.tripFilter = filter;
  notify('trip');
}

export function renderTripTab() {
  const statsEl = document.getElementById('tripStats');
  if (!statsEl) return;

  const T = state.trip;
  const avg = T.seconds > 0 ? Math.round(T.distanceKm / (T.seconds / 3600)) : 0;

  statsEl.innerHTML = [
    ['ระยะทาง', `${T.distanceKm.toFixed(2)} กม.`],
    ['เวลา', fmtDuration(T.seconds)],
    ['ความเร็วเฉลี่ย', `${avg} km/h`],
    ['ความเร็วสูงสุด', `${T.maxSpeed} km/h`]
  ].map(([k, v]) => `<div class="stat-tile"><small>${k}</small><b>${v}</b></div>`).join('');

  const btnMain = document.getElementById('tripBtnMain');
  const btnPause = document.getElementById('tripBtnPause');
  const btnReset = document.getElementById('tripBtnReset');
  const badge = document.getElementById('tripBadge');

  if (T.on && !T.paused) {
    btnMain.textContent = 'จบทริปและบันทึก';
    badge.textContent = '● กำลังบันทึก';
    badge.className = 'badge ok';
    btnPause.hidden = false;
    btnPause.textContent = 'พัก';
    btnReset.disabled = true;
  } else if (T.on && T.paused) {
    btnMain.textContent = 'จบทริปและบันทึก';
    badge.textContent = '❚❚ พักชั่วคราว';
    badge.className = 'badge warn';
    btnPause.hidden = false;
    btnPause.textContent = 'บันทึกต่อ';
    btnReset.disabled = false;
  } else {
    btnMain.textContent = 'เริ่มบันทึกทริป';
    badge.textContent = 'พร้อมใช้งาน';
    badge.className = 'badge';
    btnPause.hidden = true;
    btnReset.disabled = T.seconds === 0 && T.distanceKm === 0;
  }

  // Filter chips
  const filterRow = document.getElementById('tripFilterRow');
  if (filterRow) {
    const filters = [['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['week', '7 วันล่าสุด']];
    filterRow.innerHTML = filters.map(([val, lbl]) =>
      `<button class="chip" aria-pressed="${state.tripFilter === val}" data-tf="${val}">${lbl}</button>`
    ).join('');
    filterRow.querySelectorAll('[data-tf]').forEach((b) => {
      b.onclick = () => setTripFilter(b.dataset.tf);
    });
  }

  const now = new Date();
  const list = state.trips.filter((r) => {
    if (state.tripFilter === 'all') return true;
    const d = new Date(r.ts || 0);
    if (state.tripFilter === 'today') return d.toDateString() === now.toDateString();
    if (state.tripFilter === 'week') return d >= new Date(now.getTime() - 7 * 86400000);
    return true;
  });

  const ul = document.getElementById('tripList');
  if (ul) {
    ul.innerHTML = list.length
      ? list.map((r) => `
          <li class="list-item">
            <div class="nm">
              ${esc(r.name)} · ${r.d.toFixed(2)} กม. · ${fmtDuration(r.t)}
              <small>${esc(r.when)} · เฉลี่ย ${r.avg} · สูงสุด ${r.max} km/h</small>
            </div>
            <button class="icon-btn" data-tdel="${esc(r.id)}" aria-label="ลบทริป">✕</button>
          </li>`).join('')
      : '<li class="list-item"><div class="nm"><small>ยังไม่มีประวัติทริปในช่วงเวลานี้</small></div></li>';

    ul.querySelectorAll('[data-tdel]').forEach((btn) => {
      btn.onclick = () => deleteTrip(btn.dataset.tdel);
    });
  }

  const sum = document.getElementById('tripSummary');
  if (sum) {
    const totD = state.trips.reduce((acc, r) => acc + r.d, 0);
    const totT = state.trips.reduce((acc, r) => acc + r.t, 0);
    sum.textContent = state.trips.length
      ? `รวม ${state.trips.length} ทริป · ${totD.toFixed(1)} กม. · เวลารวม ${fmtDuration(totT)}`
      : 'ประวัติทริปจะถูกบันทึกไว้ในเครื่องอัตโนมัติ';
  }
}

export function initTrip() {
  if (!tripTimer) {
    tripTimer = setInterval(() => {
      if (state.trip.on && !state.trip.paused) {
        state.trip.seconds += 1;
        notify('trip-tick');
      }
    }, 1000);
  }

  const mainBtn = document.getElementById('tripBtnMain');
  const pauseBtn = document.getElementById('tripBtnPause');
  const resetBtn = document.getElementById('tripBtnReset');
  const clearBtn = document.getElementById('tripBtnClear');

  if (mainBtn) mainBtn.onclick = startOrFinishTrip;
  if (pauseBtn) pauseBtn.onclick = togglePauseTrip;
  if (resetBtn) resetBtn.onclick = resetTrip;
  if (clearBtn) clearBtn.onclick = clearAllTrips;

  renderTripTab();
}
