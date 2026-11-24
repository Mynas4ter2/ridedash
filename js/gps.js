import { state, notify } from './store.js';

let watchId = null;
let lastFix = null;
let simTimer = null;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function setGpsMode(mode) {
  if (mode === 'gps') {
    stopSim();
    startRealGps();
  } else {
    stopRealGps();
    state.gpsMode = 'sim';
    state.gpsStatus = 'โหมดจำลอง';
    state.speed = state.simSpeed;
    state.accuracy = null;
    startSim();
    notify('gps');
  }
}

export function setSimSpeed(val) {
  state.simSpeed = Math.max(0, Math.min(140, Number(val) || 0));
  if (state.gpsMode === 'sim') {
    state.speed = state.simSpeed;
    state.heading = (state.heading + 2) % 360;
    notify('gps');
  }
}

function startRealGps() {
  if (!navigator.geolocation) {
    state.gpsMode = 'sim';
    state.gpsStatus = 'ไม่รองรับ GPS (โหมดจำลอง)';
    startSim();
    notify('gps');
    return;
  }

  state.gpsMode = 'gps';
  state.gpsStatus = 'กำลังจับ GPS...';
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
        const distKm = haversineKm(lastFix.lat, lastFix.lng, latitude, longitude);
        const dtH = (now - lastFix.ts) / 3600000;
        if (distKm > 0.004 && dtH > 0) kmh = Math.min(240, distKm / dtH);
      }

      if (typeof heading === 'number' && !Number.isNaN(heading)) {
        state.heading = heading;
      } else if (lastFix) {
        const distKm = haversineKm(lastFix.lat, lastFix.lng, latitude, longitude);
        if (distKm > 0.005) state.heading = calcBearing(lastFix.lat, lastFix.lng, latitude, longitude);
      }

      if (state.trip.on && !state.trip.paused && lastFix && (accuracy == null || accuracy < 80)) {
        const stepKm = haversineKm(lastFix.lat, lastFix.lng, latitude, longitude);
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
      notify('gps');
    },
    (err) => {
      const msgs = {
        1: 'ไม่ได้รับอนุญาต GPS',
        2: 'ไม่พบสัญญาณ GPS',
        3: 'จับสัญญาณ GPS ช้า'
      };
      state.gpsStatus = msgs[err.code] || 'อ่าน GPS ไม่ได้';
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

function startSim() {
  if (simTimer) return;
  simTimer = setInterval(() => {
    if (state.gpsMode !== 'sim') return;
    if (state.speed > 0) {
      const distKm = state.speed / 3600;
      const rad = (state.heading * Math.PI) / 180;
      state.lat += (distKm / 111.32) * Math.cos(rad);
      state.lng += (distKm / (111.32 * Math.cos((state.lat * Math.PI) / 180))) * Math.sin(rad);
      state.heading = (state.heading + 0.35) % 360;
      if (state.trip.on && !state.trip.paused) {
        state.trip.distanceKm += distKm;
        state.trip.maxSpeed = Math.max(state.trip.maxSpeed, state.speed);
      }
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
