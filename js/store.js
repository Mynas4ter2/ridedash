export const STORAGE_KEY = 'ridedash.classic.v1';
export const LEGACY_KEYS = ['ridedash.v3', 'ridedash.v2', 'ridedash.fuel.v1'];

export const APP_ICONS = {
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  trip: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-4"/>',
  home: '<rect x="3" y="5" width="5" height="5" rx="1.2"/><rect x="9.5" y="5" width="5" height="5" rx="1.2"/><rect x="16" y="5" width="5" height="5" rx="1.2"/><rect x="3" y="12" width="5" height="5" rx="1.2"/><rect x="9.5" y="12" width="5" height="5" rx="1.2"/><rect x="16" y="12" width="5" height="5" rx="1.2"/>'
};

export const APPS = {
  map:     { id: 'map',     n: 'แผนที่',        p: APP_ICONS.map,   grad: ['#34C759', '#1F9D45'], pkg: 'com.google.android.apps.maps', internal: true },
  music:   { id: 'music',   n: 'เพลง',          p: APP_ICONS.music, grad: ['#FF453A', '#C4122F'], pkg: '', internal: true },
  trip:    { id: 'trip',    n: 'ทริป',          p: APP_ICONS.trip,  grad: ['#FF9F0A', '#E0640A'], pkg: '', internal: true },
  spotify: { id: 'spotify', n: 'Spotify',       l: 'S',             grad: ['#1ED760', '#0E8F3D'], pkg: 'com.spotify.music', url: 'https://open.spotify.com' },
  ytm:     { id: 'ytm',     n: 'YouTube Music', l: 'Y',             grad: ['#FF3B30', '#B80D00'], pkg: 'com.google.android.apps.youtube.music', url: 'https://music.youtube.com' },
  pod:     { id: 'pod',     n: 'Podcasts',      l: 'P',             grad: ['#BF5AF2', '#7A2BD1'], pkg: 'com.google.android.apps.podcasts', url: 'https://podcasts.google.com' },
  phone:   { id: 'phone',   n: 'โทรศัพท์',      l: 'โ',             grad: ['#30D158', '#1B9A3E'], pkg: 'com.android.dialer', url: 'tel:' },
  line:    { id: 'line',    n: 'LINE',          l: 'L',             grad: ['#34C759', '#1AA34A'], pkg: 'jp.naver.line.android', url: 'https://line.me' },
  cal:     { id: 'cal',     n: 'ปฏิทิน',        l: 'ป',             grad: ['#5E5CE6', '#3634A3'], pkg: 'com.google.android.calendar', url: 'https://calendar.google.com' }
};

export const PROV = ['Amap', 'Google Maps', 'Waze', 'Apple Maps'];

export const RATIOS = [
  ['Auto', null],
  ['5:3', 5 / 3],
  ['16:9', 16 / 9],
  ['16:10', 1.6],
  ['4:3', 4 / 3]
];

export const RES = {
  'Auto':  ['Auto', '800×480', '1000×600', '1280×720'],
  '5:3':   ['800×480', '1000×600', '1280×768'],
  '16:9':  ['1280×720', '960×540', '640×360'],
  '16:10': ['1280×800', '1024×640', '800×500'],
  '4:3':   ['1024×768', '800×600', '640×480']
};

export const MODES = [
  ['contain', 'ขอบดำ'],
  ['cover', 'ครอบภาพ'],
  ['fill', 'ยืดภาพ']
];

export const SAFE_ALLOW = ['map', 'music', 'phone'];

export const ACTS = [
  ['left', 'เลื่อนซ้าย'],
  ['right', 'เลื่อนขวา'],
  ['open', 'เปิดที่โฟกัส'],
  ['back', 'กลับหน้าโฮม'],
  ['map', 'เปิดแผนที่'],
  ['music', 'เปิดเพลง'],
  ['mode', 'สลับโหมดภาพ'],
  ['none', 'ไม่ทำอะไร']
];

export const DEFAULT_RADIOS = [
  { id: 'r1', title: 'Night Ride · Groove', artist: 'SomaFM · Chill / Ambient', url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
  { id: 'r2', title: 'Lush', artist: 'SomaFM · Vocal / Mellow', url: 'https://ice2.somafm.com/lush-128-mp3' },
  { id: 'r3', title: 'Def CON Drive', artist: 'SomaFM · Electronic', url: 'https://ice2.somafm.com/defcon-128-mp3' }
];

export const state = {
  theme: 'dark',
  termsAccepted: false,
  mirrorMode: false,

  // Handlebar button mapping (short, long)
  map: {
    L: ['left', 'map'],
    R: ['right', 'music'],
    O: ['open', 'back'],
    B: ['back', 'none']
  },

  // Dashboard display & dock
  dock: ['map', 'music', 'trip'],
  screen: 'home',
  foc: 0,
  prov: 'Amap',
  rname: 'Auto',
  ratio: 5 / 3,
  res: 'Auto',
  mode: 'contain',

  // Safe mode & speed/GPS
  safeOn: true,
  limit: 60,
  gpsMode: 'sim', // 'sim' | 'gps' | 'native'
  gpsStatus: 'โหมดจำลอง',
  lat: 13.736717,
  lng: 100.5612,
  accuracy: null,
  speed: 38,
  simSpeed: 38,
  heading: 45,

  // Diagnostics & connection
  hot: false,
  recon: false,
  rc: 0,
  logMsg: false,
  lastDiag: { fps: 30, lat: 68, tmp: 38, br: '2.9', conn: 'พร้อมเชื่อมต่อ' },
  nativeDiag: null,
  conn: {
    status: 'disconnected', // disconnected | scanning | connecting | streaming | reconnecting
    bikeName: 'Zontes 368K',
    ip: '',
    qrData: '',
    message: 'รอสแกน QR ที่จอรถ'
  },

  // Active trip & history
  trip: { on: false, paused: false, seconds: 0, distanceKm: 0, maxSpeed: 0 },
  tripFilter: 'all',
  trips: [],

  // Fuel records
  fuels: [],
  lastFuelPrice: '',

  // Radios for music player
  radios: [...DEFAULT_RADIOS]
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(topic = 'all') {
  listeners.forEach((fn) => {
    try { fn(topic, state); } catch (e) { console.error(e); }
  });
}

export function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.theme === 'dark' || s.theme === 'light') state.theme = s.theme;
      if (typeof s.termsAccepted === 'boolean') state.termsAccepted = s.termsAccepted;
      if (Array.isArray(s.dock) && s.dock.length) state.dock = s.dock.filter((id) => APPS[id]).slice(0, 4);
      if (s.prov && PROV.includes(s.prov)) state.prov = s.prov;
      if (s.rname && RES[s.rname]) {
        state.rname = s.rname;
        const found = RATIOS.find((r) => r[0] === s.rname);
        state.ratio = found && found[1] ? found[1] : 5 / 3;
      }
      if (s.res) state.res = s.res;
      if (s.mode) state.mode = s.mode;
      if (typeof s.safeOn === 'boolean') state.safeOn = s.safeOn;
      if (typeof s.limit === 'number') state.limit = s.limit;
      if (s.map && typeof s.map === 'object') state.map = s.map;
      if (Array.isArray(s.trips)) state.trips = s.trips.slice(0, 50);
      if (Array.isArray(s.fuels)) state.fuels = s.fuels.slice(0, 100);
      if (s.lastFuelPrice) state.lastFuelPrice = s.lastFuelPrice;
      return;
    }

    // Migrate saved trips/fuels/terms from previous RideDash versions if present
    for (const k of LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(k);
      if (!legacyRaw) continue;
      const d = JSON.parse(legacyRaw);
      if (Array.isArray(d.trips) && !state.trips.length) state.trips = d.trips.slice(0, 50);
      if (Array.isArray(d.fuels) && !state.fuels.length) state.fuels = d.fuels.slice(0, 100);
      if ((d.lastFuelPrice || d.price) && !state.lastFuelPrice) state.lastFuelPrice = d.lastFuelPrice || d.price;
      if (typeof d.termsAccepted === 'boolean') state.termsAccepted = d.termsAccepted;
    }
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }
}

export function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      theme: state.theme,
      termsAccepted: state.termsAccepted,
      dock: state.dock,
      prov: state.prov,
      rname: state.rname,
      res: state.res,
      mode: state.mode,
      safeOn: state.safeOn,
      limit: state.limit,
      map: state.map,
      trips: state.trips,
      fuels: state.fuels,
      lastFuelPrice: state.lastFuelPrice
    }));
  } catch (e) {}
}

export function isSafeActive() {
  return state.safeOn && state.speed >= state.limit;
}

export function visibleDock() {
  return isSafeActive()
    ? state.dock.filter((id) => SAFE_ALLOW.includes(id))
    : state.dock;
}

export function autoResolution() {
  const w = Math.max(320, Math.round((window.innerWidth || 800) * (window.devicePixelRatio || 1)));
  const h = Math.max(240, Math.round((window.innerHeight || 480) * (window.devicePixelRatio || 1)));
  const lw = Math.max(w, h);
  const lh = Math.min(w, h);
  return { w: lw, h: lh, text: `${lw}×${lh}` };
}

export function effectiveResolution() {
  if (state.res === 'Auto') return autoResolution();
  const [w, h] = String(state.res).split('×').map(Number);
  return { w: w || 800, h: h || 480, text: state.res };
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
