export const STORAGE_KEY = 'ridedash.v2';
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
  map:     { id: 'map',     name: 'แผนที่',        icon: APP_ICONS.map,     grad: ['#22C55E', '#15803D'], internal: true },
  music:   { id: 'music',   name: 'เพลง',          icon: APP_ICONS.music,   grad: ['#FF375F', '#C4122F'], internal: true },
  trip:    { id: 'trip',    name: 'ทริป',          icon: APP_ICONS.trip,    grad: ['#F59E0B', '#D97706'], internal: true },
  phone:   { id: 'phone',   name: 'โทรด่วน',       icon: APP_ICONS.phone,   grad: ['#30D158', '#15803D'], internal: true },
  weather: { id: 'weather', name: 'อากาศ',         icon: APP_ICONS.weather, grad: ['#38BDF8', '#0284C7'], internal: true },
  spotify: { id: 'spotify', name: 'Spotify',       letter: 'S',             grad: ['#1ED760', '#0E8F3D'], url: 'https://open.spotify.com' },
  ytm:     { id: 'ytm',     name: 'YouTube Music', letter: 'Y',             grad: ['#FF3B30', '#B80D00'], url: 'https://music.youtube.com' },
  gmaps:   { id: 'gmaps',   name: 'Google Maps',   letter: 'G',             grad: ['#4285F4', '#1D4ED8'], url: 'https://www.google.com/maps' },
  line:    { id: 'line',    name: 'LINE',          letter: 'L',             grad: ['#06C755', '#049940'], url: 'https://line.me' }
};

export const SAFE_ALLOW = ['map', 'music', 'phone'];

export const RATIOS = [
  { id: 'fill',  label: 'เต็มจอ',  ratio: null },
  { id: '5:3',   label: '5:3 (Zontes)', ratio: 5 / 3 },
  { id: '16:9',  label: '16:9',   ratio: 16 / 9 },
  { id: '16:10', label: '16:10',  ratio: 1.6 },
  { id: '4:3',   label: '4:3',    ratio: 4 / 3 }
];

export const MAP_STYLES = [
  { id: 'dark', label: 'โหมดมืด (แนะนำ)' },
  { id: 'light', label: 'โหมดสว่าง (OSM)' },
  { id: 'satellite', label: 'ภาพถ่ายดาวเทียม' }
];

export const DEFAULT_CONTACTS = [
  { name: 'ฉุกเฉินการแพทย์', tel: '1669' },
  { name: 'ตำรวจทางหลวง', tel: '1193' },
  { name: 'แจ้งเหตุด่วน', tel: '191' }
];

export const DEFAULT_RADIOS = [
  { id: 'r1', title: 'Groove Salad', artist: 'SomaFM · Chill / Ambient', url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
  { id: 'r2', title: 'Lush', artist: 'SomaFM · Vocal / Mellow', url: 'https://ice2.somafm.com/lush-128-mp3' },
  { id: 'r3', title: 'Def CON Radio', artist: 'SomaFM · Electronic / Drive', url: 'https://ice2.somafm.com/defcon-128-mp3' }
];

export const state = {
  theme: 'auto',          // 'auto' | 'light' | 'dark'
  screen: 'home',         // 'home' | 'map' | 'music' | 'trip' | 'phone' | 'weather' | external app id
  focusIdx: 0,
  rideMode: false,
  dock: ['map', 'music', 'trip', 'phone'],
  ratioId: '5:3',
  mapStyle: 'dark',
  safeOn: true,
  safeLimit: 60,

  // GPS & Telemetry
  gpsMode: 'sim',         // 'gps' | 'sim'
  gpsStatus: 'พร้อมจำลอง',
  lat: 13.736717,         // Bangkok Sukhumvit default
  lng: 100.5612,
  accuracy: null,
  speed: 38,
  simSpeed: 38,
  heading: 45,

  // Navigation
  nav: {
    active: false,
    destName: '',
    destLat: null,
    destLng: null,
    nextDist: 'พร้อมนำทาง',
    nextText: 'แตะค้นหาเพื่อเลือกจุดหมาย',
    etaText: '',
    distKm: 0,
    durationMin: 0
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

  // System / Battery
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.theme) state.theme = saved.theme;
      if (Array.isArray(saved.dock) && saved.dock.length) {
        state.dock = saved.dock.filter((id) => APPS[id]).slice(0, 4);
      }
      if (saved.ratioId) state.ratioId = saved.ratioId;
      if (saved.mapStyle) state.mapStyle = saved.mapStyle;
      if (typeof saved.safeOn === 'boolean') state.safeOn = saved.safeOn;
      if (typeof saved.safeLimit === 'number') state.safeLimit = saved.safeLimit;
      if (Array.isArray(saved.trips)) state.trips = saved.trips.slice(0, 50);
      if (Array.isArray(saved.fuels)) state.fuels = saved.fuels.slice(0, 100);
      if (saved.lastFuelPrice) state.lastFuelPrice = saved.lastFuelPrice;
      if (Array.isArray(saved.contacts) && saved.contacts.length) state.contacts = saved.contacts.slice(0, 12);
      if (Array.isArray(saved.radios) && saved.radios.length) state.radios = saved.radios.slice(0, 12);
    } else {
      // Import legacy fuel records if user used original file
      const legacy = localStorage.getItem(LEGACY_FUEL_KEY);
      if (legacy) {
        const d = JSON.parse(legacy);
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
      v: 2,
      theme: state.theme,
      dock: state.dock,
      ratioId: state.ratioId,
      mapStyle: state.mapStyle,
      safeOn: state.safeOn,
      safeLimit: state.safeLimit,
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
