import { state, notify } from './store.js';
import { haversineM, calcBearing, updateNavigationProgress } from './nav.js';

let watchId = null;
let lastFix = null;
let simTimer = null;
let simCoordIdx = 0;

export function setGpsMode(mode) {
  if (mode === 'gps') {
    state.routeSimActive = false;
    stopSim();
    startRealGps();
  } else {
    stopRealGps();
    state.gpsMode = 'sim';
    state.gpsStatus = 'โหมดจำลอง (ทดสอบ)';
    state.speed = state.routeSimActive ? state.simSpeed : 0;
    state.accuracy = null;
    startSim();
    notify('gps');
  }
}

export function setSimSpeed(val) {
  state.simSpeed = Math.max(0, Math.min(180, Number(val) || 0));
  if (state.gpsMode === 'sim') {
    state.speed = state.simSpeed;
    notify('gps');
  }
}

export function toggleRouteSim(force) {
  const next = typeof force === 'boolean' ? force : !state.routeSimActive;
  if (next) {
    if (state.gpsMode !== 'sim') setGpsMode('sim');
    simCoordIdx = 0;
    state.routeSimActive = true;
    state.speed = Math.max(30, state.simSpeed || 45);
    state.simSpeed = state.speed;
    if (state.nav.coords.length) {
      state.lat = state.nav.coords[0][0];
      state.lng = state.nav.coords[0][1];
    }
    startSim();
  } else {
    state.routeSimActive = false;
  }
  notify('gps');
}

function startRealGps() {
  if (!navigator.geolocation) {
    state.gpsMode = 'sim';
    state.gpsStatus = 'เบราว์เซอร์ไม่รองรับ GPS';
    startSim();
    notify('gps');
    return;
  }

  state.gpsMode = 'gps';
  state.gpsStatus = 'กำลังจับสัญญาณ GPS...';
  lastFix = null;
  notify('gps');

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const now = pos.timestamp || Date.now();
      let kmh = 0;

      if (typeof speed === 'number' && !Number.isNaN(speed) && speed >= 0) {
        kmh = speed * 3.6;
      } else if (lastFix && now > lastFix.ts) {
        const distM = haversineM(lastFix.lat, lastFix.lng, latitude, longitude);
        const dtSec = (now - lastFix.ts) / 1000;
        if (distM > 4 && dtSec > 0) kmh = Math.min(240, (distM / dtSec) * 3.6);
      }

      if (typeof heading === 'number' && !Number.isNaN(heading)) {
        state.heading = heading;
      } else if (lastFix) {
        const distM = haversineM(lastFix.lat, lastFix.lng, latitude, longitude);
        if (distM > 5) state.heading = calcBearing(lastFix.lat, lastFix.lng, latitude, longitude);
      }

      if (state.trip.on && !state.trip.paused && lastFix && (accuracy == null || accuracy < 80)) {
        const stepKm = haversineM(lastFix.lat, lastFix.lng, latitude, longitude) / 1000;
        if (stepKm >= 0.004 && stepKm < 2) state.trip.distanceKm += stepKm;
      }

      state.lat = latitude;
      state.lng = longitude;
      state.speed = kmh < 1.5 ? 0 : Math.round(kmh);
      state.accuracy = accuracy != null ? Math.round(accuracy) : null;
      state.gpsStatus = `GPS จริง (±${state.accuracy ?? '-'} ม.)`;

      if (state.trip.on && !state.trip.paused) {
        state.trip.maxSpeed = Math.max(state.trip.maxSpeed, state.speed);
      }

      lastFix = { lat: latitude, lng: longitude, ts: now };
      updateNavigationProgress(latitude, longitude);
      notify('gps');
    },
    (err) => {
      const msgs = {
        1: 'ไม่ได้รับอนุญาต GPS (เปิดสิทธิ์ในเบราว์เซอร์)',
        2: 'ไม่พบสัญญาณ GPS (ลองขยับไปที่โล่ง)',
        3: 'จับสัญญาณ GPS ช้ากว่ากำหนด'
      };
      state.gpsStatus = msgs[err.code] || 'อ่าน GPS ไม่สำเร็จ';
      notify('gps');
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
  );
}

function stopRealGps() {
  if (watchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  lastFix = null;
}

function advanceAlongRoute(stepMeters) {
  const coords = state.nav.coords;
  if (!coords || coords.length < 2) return false;

  let remain = stepMeters;
  while (remain > 0 && simCoordIdx < coords.length - 1) {
    const [lat1, lng1] = [state.lat, state.lng];
    const [lat2, lng2] = coords[simCoordIdx + 1];
    const segM = haversineM(lat1, lng1, lat2, lng2);
    if (segM <= remain) {
      state.heading = calcBearing(lat1, lng1, lat2, lng2);
      state.lat = lat2;
      state.lng = lng2;
      remain -= segM;
      simCoordIdx++;
    } else {
      const ratio = remain / segM;
      state.heading = calcBearing(lat1, lng1, lat2, lng2);
      state.lat = lat1 + (lat2 - lat1) * ratio;
      state.lng = lng1 + (lng2 - lng1) * ratio;
      remain = 0;
    }
  }
  return true;
}

function startSim() {
  if (simTimer) return;
  simTimer = setInterval(() => {
    if (state.gpsMode !== 'sim') return;

    if (state.routeSimActive && state.nav.coords.length >= 2 && state.nav.phase === 'guiding') {
      const metersPerSec = Math.max(8, (state.speed || state.simSpeed || 45) / 3.6);
      advanceAlongRoute(metersPerSec);
      if (state.trip.on && !state.trip.paused) {
        state.trip.distanceKm += metersPerSec / 1000;
        state.trip.maxSpeed = Math.max(state.trip.maxSpeed, state.speed);
      }
      updateNavigationProgress(state.lat, state.lng);
      notify('gps');
    } else if (state.speed > 0) {
      const distKm = state.speed / 3600;
      const rad = (state.heading * Math.PI) / 180;
      state.lat += (distKm / 111.32) * Math.cos(rad);
      state.lng += (distKm / (111.32 * Math.cos((state.lat * Math.PI) / 180))) * Math.sin(rad);
      state.heading = (state.heading + 0.5) % 360;
      if (state.trip.on && !state.trip.paused) {
        state.trip.distanceKm += distKm;
        state.trip.maxSpeed = Math.max(state.trip.maxSpeed, state.speed);
      }
      updateNavigationProgress(state.lat, state.lng);
      notify('gps');
    }
  }, 1000);
}

function stopSim() {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
  }
}

export function initGps() {
  setGpsMode(state.gpsMode);
}
