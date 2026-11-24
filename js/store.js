export const STORAGE_KEY = 'ridedash.v3';
export const LEGACY_V2_KEY = 'ridedash.v2';
export const LEGACY_FUEL_KEY = 'ridedash.fuel.v1';

export const APP_ICONS = {
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  trip: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>',
  weather: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>',
  home: '<rect x="3" y="4" width="6" height="6" rx="1.5"/><rect x="15" y="4" width="6" height="6" rx="1.5"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><rect x="15" y="14" width="6" height="6" rx="1.5"/>'
};

export const APPS = {
  map:     { id: 'map',     name: 'แผนที่',        icon: APP_ICONS.map,     grad: ['#0284C7', '#0EA5E9'], internal: true },
  music:   { id: 'music',   name: 'เพลง',          icon: APP_ICONS.music,   grad: ['#6366F1', '#8B5CF6'], internal: true },
  trip:    { id: 'trip',    name: 'ทริป',          icon: APP_ICONS.trip,    grad: ['#EA580C', '#F59E0B'], internal: true },
  phone:   { id: 'phone',   name: 'โทรด่วน',       icon: APP_ICONS.phone,   grad: ['#16A34A', '#22C55E'], internal: true },
  weather: { id: 'weather', name: 'อากาศ',         icon: APP_ICONS.weather, grad: ['#0284C7', '#38BDF8'], internal: true },
  spotify: { id: 'spotify', name: 'Spotify',       letter: 'S',             grad: ['#16A34A', '#15803D'], url: 'https://open.spotify.com' },
  ytm:     { id: 'ytm',     name: 'YouTube Music', letter: 'Y',             grad: ['#DC2626', '#B91C1C'], url: 'https://music.youtube.com' },
  gmaps:   { id: 'gmaps',   name: 'Google Maps',   letter: 'G',             grad: ['#0284C7', '#1D4ED8'], url: 'https://www.google.com/maps' },
  line:    { id: 'line',    name: 'LINE',          letter: 'L',             grad: ['#16A34A', '#15803D'], url: 'https://line.me' }
};

export const SAFE_ALLOW = ['map', 'music', 'phone'];

export const MAP_STYLES = [
  { id: 'light', label: 'กลางวัน (สว่าง)' },
  { id: 'dark', label: 'กลางคืน (มืด)' },
  { id: 'satellite', label: 'ดาวเทียม' }
];

export const DEFAULT_CONTACTS = [
  { name: 'การแพทย์ฉุกเฉิน', tel: '1669' },
  { name: 'ตำรวจทางหลวง', tel: '1193' },
  { name: 'เหตุด่วนเหตุร้าย', tel: '191' }
];

export const DEFAULT_RADIOS = [
  { id: 'r1', title: 'Groove Salad', artist: 'SomaFM · Chill / Ambient', url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
  { id: 'r2', title: 'Lush', artist: 'SomaFM · Vocal / Mellow', url: 'https://ice2.somafm.com/lush-128-mp3' },
  { id: 'r3', title: 'Def CON Radio', artist: 'SomaFM · Electronic / Drive', url: 'https://ice2.somafm.com/defcon-128-mp3' }
];

export const state = {
  theme: 'light',         // 'light' (Warm Cream + Ocean Blue default) | 'dark'
  hudTheme: 'day',        // 'day' | 'night'
  activeTab: 0,           // 0: Home, 1: Map, 2: Trip/Fuel, 3: Settings
  tripSubTab: 'trip',     // 'trip' | 'fuel'
  screen: 'home',         // HUD view: 'home' | 'map' | 'music' | 'trip' | 'phone' | 'weather' | ext
  rideMode: false,
  onboardingDismissed: false,
  termsAccepted: false,

  dock: ['map', 'music', 'trip', 'phone'],
  mapStyle: 'light',
  safeOn: true,
  safeLimit: 60,
  voiceEnabled: true,

  // GPS & Telemetry
  gpsMode: 'sim',         // 'gps' | 'sim'
  gpsStatus: 'โหมดจำลอง (ทดสอบ)',
  lat: 13.736717,         // Bangkok Asok default
  lng: 100.5612,
  accuracy: null,
  speed: 0,
  simSpeed: 45,
  heading: 45,
  routeSimActive: false,

  // Live Navigation State
  nav: {
    phase: 'idle',        // 'idle' | 'preview' | 'guiding' | 'arrived'
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
  },

  // Active Trip
  trip: {
    on: false,
    paused: false,
    seconds: 0,
    distanceKm: 0,
    maxSpeed: 0
  },
  tripFilter: 'all',
  trips: [],

  // Fuel
  fuels: [],
  lastFuelPrice: '',

  // Contacts & Radios
  contacts: [...DEFAULT_CONTACTS],
  radios: [...DEFAULT_RADIOS],

  // Weather
  weather: {
    temp: null,
    desc: 'กำลังโหลด...',
    icon: '⛅',
    humidity: null,
    wind: null,
    updatedAt: 0
  },

  // Battery
  battery: { level: 0.87, charging: false, real: false }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(topic = 'all') {
  listeners.forEach((fn) => {
    try { fn(topic, state); } catch (err) { console.error(err); }
  });
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_V2_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.theme === 'light' || saved.theme === 'dark') state.theme = saved.theme;
      if (saved.hudTheme === 'day' || saved.hudTheme === 'night') state.hudTheme = saved.hudTheme;
      if (typeof saved.onboardingDismissed === 'boolean') state.onboardingDismissed = saved.onboardingDismissed;
      if (typeof saved.termsAccepted === 'boolean') state.termsAccepted = saved.termsAccepted;
      if (Array.isArray(saved.dock) && saved.dock.length) {
        state.dock = saved.dock.filter((id) => APPS[id]).slice(0, 4);
      }
      if (saved.mapStyle && ['light', 'dark', 'satellite'].includes(saved.mapStyle)) {
        state.mapStyle = saved.mapStyle;
      }
      if (typeof saved.safeOn === 'boolean') state.safeOn = saved.safeOn;
      if (typeof saved.safeLimit === 'number') state.safeLimit = saved.safeLimit;
      if (typeof saved.voiceEnabled === 'boolean') state.voiceEnabled = saved.voiceEnabled;
      if (Array.isArray(saved.trips)) state.trips = saved.trips.slice(0, 50);
      if (Array.isArray(saved.fuels)) state.fuels = saved.fuels.slice(0, 100);
      if (saved.lastFuelPrice) state.lastFuelPrice = saved.lastFuelPrice;
      if (Array.isArray(saved.contacts) && saved.contacts.length) state.contacts = saved.contacts.slice(0, 12);
      if (Array.isArray(saved.radios) && saved.radios.length) state.radios = saved.radios.slice(0, 12);
    } else {
      const legacyFuel = localStorage.getItem(LEGACY_FUEL_KEY);
      if (legacyFuel) {
        const d = JSON.parse(legacyFuel);
        if (d && Array.isArray(d.fuels)) state.fuels = d.fuels.slice(0, 100);
        if (d && d.price) state.lastFuelPrice = d.price;
      }
    }
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

export function persistState() {
  try {
    const payload = {
      v: 3,
      theme: state.theme,
      hudTheme: state.hudTheme,
      onboardingDismissed: state.onboardingDismissed,
      termsAccepted: state.termsAccepted,
      dock: state.dock,
      mapStyle: state.mapStyle,
      safeOn: state.safeOn,
      safeLimit: state.safeLimit,
      voiceEnabled: state.voiceEnabled,
      trips: state.trips,
      fuels: state.fuels,
      lastFuelPrice: state.lastFuelPrice,
      contacts: state.contacts,
      radios: state.radios
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

export function isSafeActive() {
  return state.safeOn && state.speed >= state.safeLimit;
}

export function visibleDock() {
  return isSafeActive()
    ? state.dock.filter((id) => SAFE_ALLOW.includes(id))
    : state.dock;
}

export function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p2 = (n) => (n < 10 ? '0' + n : String(n));
  return h > 0 ? `${p2(h)}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}`;
}

export function headingInfo(deg) {
  const d = ((Number(deg) || 0) % 360 + 360) % 360;
  const names = ['เหนือ', 'ตะวันออกเฉียงเหนือ', 'ตะวันออก', 'ตะวันออกเฉียงใต้', 'ใต้', 'ตะวันตกเฉียงใต้', 'ตะวันตก', 'ตะวันตกเฉียงเหนือ'];
  const short = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  const i = Math.round(d / 45) % 8;
  return { deg: Math.round(d), name: names[i], short: short[i], arrow: arrows[i] };
}

export function svgIcon(pathMarkup, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathMarkup}</svg>`;
}
