import { state, notify, persistState } from './store.js';

const OFF_ROUTE_METERS = 65;
const OFF_ROUTE_MS = 5000;
const REROUTE_COOLDOWN_MS = 15000;

let offRouteSince = 0;
let lastRerouteAt = 0;
let rerouting = false;
let spokenSteps = new Set(); // tracks `${stepIdx}:300`, `${stepIdx}:60`
let cachedThaiVoice = null;

// ===== Geo Math Helpers =====
export function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcBearing(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function minDistToPolylineM(lat, lng, coords) {
  if (!coords || !coords.length) return 0;
  let min = Infinity;
  // Sample every 2nd vertex for long polylines for O(n) speed on mobile
  const step = coords.length > 300 ? 2 : 1;
  for (let i = 0; i < coords.length; i += step) {
    const d = haversineM(lat, lng, coords[i][0], coords[i][1]);
    if (d < min) min = d;
  }
  return min;
}

// ===== Thai Voice Guidance (Web Speech API) =====
function findThaiVoice() {
  if (cachedThaiVoice) return cachedThaiVoice;
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  cachedThaiVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('th')) || null;
  return cachedThaiVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { cachedThaiVoice = null; findThaiVoice(); };
}

export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    u.lang = 'th-TH';
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

export function speakThai(text, force = false) {
  if (!state.voiceEnabled && !force) return;
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = 1.02;
    u.pitch = 1.0;
    const v = findThaiVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

export function toggleVoice() {
  state.voiceEnabled = !state.voiceEnabled;
  persistState();
  if (state.voiceEnabled) speakThai('เปิดเสียงนำทางแล้ว', true);
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  notify('nav');
}

// ===== Turn Formatting & Icons =====
export function turnIconSvg(type) {
  switch (type) {
    case 'left':
      return '<path d="M17 21V12a3 3 0 0 0-3-3H6"/><path d="M10 5L6 9l4 4"/>';
    case 'right':
      return '<path d="M7 21V12a3 3 0 0 1 3-3h8"/><path d="M14 5l4 4-4 4"/>';
    case 'uturn':
      return '<path d="M17 21V9a5 5 0 0 0-10 0v5"/><path d="M4 11l3 3 3-3"/>';
    case 'roundabout':
      return '<circle cx="12" cy="11" r="4"/><path d="M12 15v6"/><path d="M15 8l4-4M19 8V4h-4"/>';
    case 'arrive':
      return '<path d="M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>';
    default:
      return '<path d="M12 20V5"/><path d="M7 10l5-5 5 5"/>';
  }
}

function classifyStep(step) {
  const m = step?.maneuver || {};
  const { type, modifier } = m;
  const road = step?.name ? ` เข้าสู่ ${step.name}` : '';

  if (type === 'arrive') return { icon: 'arrive', text: 'ถึงจุดหมายปลายทาง' };
  if (type === 'roundabout' || type === 'rotary') return { icon: 'roundabout', text: 'เข้าสู่วงเวียน' + road };
  if (modifier === 'uturn') return { icon: 'uturn', text: 'กลับรถ' + road };
  if (modifier === 'left' || modifier === 'sharp left') return { icon: 'left', text: 'เลี้ยวซ้าย' + road };
  if (modifier === 'slight left') return { icon: 'left', text: 'เบี่ยงซ้าย' + road };
  if (modifier === 'right' || modifier === 'sharp right') return { icon: 'right', text: 'เลี้ยวขวา' + road };
  if (modifier === 'slight right') return { icon: 'right', text: 'เบี่ยงขวา' + road };
  return { icon: 'straight', text: 'ตรงไป' + road };
}

export function fmtMeters(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} กม.`;
  return `${Math.max(10, Math.round(m / 10) * 10)} ม.`;
}

function fmtEta(durationSec) {
  const eta = new Date(Date.now() + Math.max(60, durationSec) * 1000);
  const p2 = (n) => (n < 10 ? '0' + n : String(n));
  const mins = Math.max(1, Math.round(durationSec / 60));
  return `${p2(eta.getHours())}:${p2(eta.getMinutes())} (${mins} นาที)`;
}

// ===== Place & Nearby POI Search (Nominatim) =====
export async function searchPlaces(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const dLat = 0.14;
  const dLng = 0.14;
  const viewbox = `${(state.lng - dLng).toFixed(4)},${(state.lat + dLat).toFixed(4)},${(state.lng + dLng).toFixed(4)},${(state.lat - dLat).toFixed(4)}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=th&viewbox=${viewbox}&q=${encodeURIComponent(q)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed');
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];

  return rows.map((r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    const distKm = haversineM(state.lat, state.lng, lat, lng) / 1000;
    const parts = (r.display_name || '').split(',');
    return {
      lat,
      lng,
      shortName: parts[0].trim(),
      subName: parts.slice(1, 3).join(',').trim(),
      distKm
    };
  }).sort((a, b) => a.distKm - b.distKm);
}

// ===== Route Calculation (OSRM) =====
export async function calculateRoute(destLat, destLng, destName, opts = {}) {
  const { autoStart = false, isReroute = false } = opts;

  state.nav.destName = destName;
  state.nav.destLat = destLat;
  state.nav.destLng = destLng;
  if (!isReroute) {
    state.nav.phase = 'preview';
    state.nav.nextDistText = 'กำลังคำนวณ...';
    state.nav.nextText = destName;
    notify('nav');
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${state.lng},${state.lat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM HTTP ' + res.status);
  const data = await res.json();
  const route = data.routes && data.routes[0];
  if (!route) throw new Error('ไม่พบเส้นทาง');

  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  const rawSteps = (route.legs && route.legs[0] && route.legs[0].steps) || [];
  const steps = rawSteps.map((s) => {
    const info = classifyStep(s);
    return {
      lat: s.maneuver.location[1],
      lng: s.maneuver.location[0],
      distM: s.distance || 0,
      durationS: s.duration || 0,
      text: info.text,
      icon: info.icon
    };
  });

  // Skip step 0 ("depart") when there is a meaningful next maneuver
  const startIdx = steps.length > 1 ? 1 : 0;
  const firstStep = steps[startIdx] || { distM: route.distance, text: destName, icon: 'arrive' };

  state.nav = {
    phase: autoStart ? 'guiding' : 'preview',
    destName,
    destLat,
    destLng,
    coords,
    steps,
    stepIdx: startIdx,
    totalDistKm: route.distance / 1000,
    totalDurMin: Math.max(1, Math.round(route.duration / 60)),
    remDistM: route.distance,
    remDurSec: route.duration,
    etaText: fmtEta(route.duration),
    nextDistText: fmtMeters(firstStep.distM || route.distance),
    nextText: firstStep.text,
    nextIcon: firstStep.icon
  };

  spokenSteps = new Set();
  offRouteSince = 0;

  if (isReroute) {
    speakThai(`คำนวณเส้นทางใหม่แล้ว อีก ${state.nav.nextDistText} ${state.nav.nextText}`);
  } else if (autoStart) {
    announceRouteStart();
  }

  notify('route-ready');
  notify('nav');
  return state.nav;
}

function announceRouteStart() {
  const km = state.nav.totalDistKm >= 1
    ? `${state.nav.totalDistKm.toFixed(1)} กิโลเมตร`
    : `${Math.round(state.nav.totalDistKm * 1000)} เมตร`;
  speakThai(`เริ่มนำทางไปยัง ${state.nav.destName} ระยะทาง ${km} ใช้เวลาประมาณ ${state.nav.totalDurMin} นาที`);
}

export function startGuidance() {
  if (!state.nav.coords.length) return;
  unlockSpeech();
  state.nav.phase = 'guiding';
  spokenSteps = new Set();
  offRouteSince = 0;
  announceRouteStart();
  notify('nav');
}

export function stopNavigation() {
  state.routeSimActive = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  state.nav = {
    phase: 'idle',
    destName: '',
    destLat: null,
    destLng: null,
    coords: [],
    steps: [],
    stepIdx: 0,
    totalDistKm: 0,
    totalDurMin: 0,
    remDistM: 0,
    remDurSec: 0,
    etaText: '',
    nextDistText: 'พร้อมนำทาง',
    nextText: 'ค้นหาจุดหมายในแท็บแผนที่หรือหน้าหลัก',
    nextIcon: 'straight'
  };
  spokenSteps = new Set();
  offRouteSince = 0;
  notify('route-cleared');
  notify('nav');
}

// ===== Live GPS Step Tracking & Auto Re-routing =====
export function updateNavigationProgress(lat, lng) {
  const nav = state.nav;
  if (nav.phase !== 'guiding' || !nav.steps.length) return;

  // 1. Check arrival at destination
  const distToDest = haversineM(lat, lng, nav.destLat, nav.destLng);
  if (distToDest <= 35) {
    nav.phase = 'arrived';
    nav.remDistM = 0;
    nav.remDurSec = 0;
    nav.nextDistText = 'ถึงแล้ว!';
    nav.nextText = nav.destName;
    nav.nextIcon = 'arrive';
    nav.etaText = 'ถึงจุดหมายแล้ว';
    state.routeSimActive = false;
    speakThai(`ถึงจุดหมายปลายทาง ${nav.destName} แล้ว`);
    notify('nav');
    return;
  }

  // 2. Check distance to current upcoming maneuver
  let idx = nav.stepIdx;
  let step = nav.steps[idx];
  let distToTurn = haversineM(lat, lng, step.lat, step.lng);

  // Auto-advance when passing through maneuver point
  while (distToTurn < 32 && idx < nav.steps.length - 1) {
    idx++;
    step = nav.steps[idx];
    distToTurn = haversineM(lat, lng, step.lat, step.lng);
  }
  nav.stepIdx = idx;

  // 3. Update remaining distance & ETA smoothly
  let remM = distToTurn;
  let remS = step.durationS || 0;
  for (let i = idx + 1; i < nav.steps.length; i++) {
    remM += nav.steps[i].distM || 0;
    remS += nav.steps[i].durationS || 0;
  }
  const speedMs = Math.max(8, (state.speed || 35) / 3.6);
  const estSec = remS > 0 ? remS : remM / speedMs;

  nav.remDistM = remM;
  nav.remDurSec = estSec;
  nav.etaText = fmtEta(estSec);
  nav.nextDistText = fmtMeters(distToTurn);
  nav.nextText = step.text;
  nav.nextIcon = step.icon;

  // 4. Trigger Thai Voice Alerts at 300m and 65m before maneuver
  const key300 = `${idx}:300`;
  const key65 = `${idx}:65`;
  if (distToTurn <= 320 && distToTurn > 110 && !spokenSteps.has(key300)) {
    spokenSteps.add(key300);
    speakThai(`อีก 300 เมตร ${step.text}`);
  } else if (distToTurn <= 70 && !spokenSteps.has(key65)) {
    spokenSteps.add(key65);
    speakThai(`เตรียม${step.text}`);
  }

  // 5. Off-route detection & Auto Re-routing (only in real GPS mode)
  if (state.gpsMode === 'gps' && !rerouting && nav.coords.length) {
    const offDist = minDistToPolylineM(lat, lng, nav.coords);
    const now = Date.now();
    if (offDist > OFF_ROUTE_METERS) {
      if (!offRouteSince) offRouteSince = now;
      if (now - offRouteSince > OFF_ROUTE_MS && now - lastRerouteAt > REROUTE_COOLDOWN_MS) {
        rerouting = true;
        lastRerouteAt = now;
        offRouteSince = 0;
        speakThai('ออกนอกเส้นทาง กำลังคำนวณเส้นทางใหม่');
        calculateRoute(nav.destLat, nav.destLng, nav.destName, { autoStart: true, isReroute: true })
          .catch(() => {})
          .finally(() => { rerouting = false; });
      }
    } else {
      offRouteSince = 0;
    }
  }

  notify('nav');
}
