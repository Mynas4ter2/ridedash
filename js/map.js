import { state, notify, esc } from './store.js';

let map = null;
let tileLayer = null;
let riderMarker = null;
let destMarker = null;
let routeLine = null;
let routeGlow = null;
let followMode = true;
let searchOpen = false;

const TILES = {
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenStreetMap',
    darkFilter: true
  },
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenStreetMap',
    darkFilter: false
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '&copy; Esri World Imagery',
    darkFilter: false
  }
};

function riderIconHtml(deg) {
  return `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(deg)}deg);transition:transform 0.35s ease">
    <svg width="26" height="26" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="rgba(10,132,255,0.28)"/>
      <path d="M12 3 L18 19 L12 15.5 L6 19 Z" fill="#0A84FF" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>
  </div>`;
}

export function initMap() {
  const container = document.getElementById('liveMap');
  if (!container || typeof window.L === 'undefined') {
    if (container) {
      container.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#94A3B8;font-size:13px;padding:16px;text-align:center">แผนที่ออฟไลน์ (เชื่อมต่ออินเทอร์เน็ตเพื่อโหลดแผนที่ Leaflet)</div>';
    }
    return;
  }

  map = window.L.map(container, {
    center: [state.lat, state.lng],
    zoom: 15,
    zoomControl: false,
    attributionControl: false
  });
  window.L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);

  applyMapStyle(state.mapStyle);

  riderMarker = window.L.marker([state.lat, state.lng], {
    icon: window.L.divIcon({
      className: 'rider-pin',
      html: riderIconHtml(state.heading),
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    }),
    zIndexOffset: 1000
  }).addTo(map);

  map.on('dragstart', () => {
    followMode = false;
    updateFollowBtn();
  });

  // Automatically keep map sized cleanly across Preview, Safe Mode, and Fullscreen Ride Mode
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (map) map.invalidateSize({ animate: false });
    });
    ro.observe(container);
  }

  bindMapUi();
  updateFollowBtn();
}

export function applyMapStyle(styleId) {
  if (!map || typeof window.L === 'undefined') return;
  const spec = TILES[styleId] || TILES.dark;
  const container = document.getElementById('liveMap');
  if (container) container.classList.toggle('map-dark', !!spec.darkFilter);
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = window.L.tileLayer(spec.url, {
    attribution: spec.attr,
    maxZoom: 19
  }).addTo(map);
}

export function invalidateMap() {
  if (map) setTimeout(() => map.invalidateSize({ animate: false }), 80);
}

export function updateMapPosition() {
  if (!map || !riderMarker) return;
  riderMarker.setLatLng([state.lat, state.lng]);
  const el = riderMarker.getElement();
  if (el) {
    const inner = el.firstElementChild;
    if (inner) inner.style.transform = `rotate(${Math.round(state.heading)}deg)`;
  }
  if (followMode) {
    map.panTo([state.lat, state.lng], { animate: true, duration: 0.45 });
  }
}

export function recenterMap() {
  followMode = true;
  if (map) map.setView([state.lat, state.lng], Math.max(map.getZoom(), 15), { animate: true });
  updateFollowBtn();
}

function updateFollowBtn() {
  const btn = document.getElementById('mapFollowBtn');
  if (btn) btn.classList.toggle('active', followMode);
}

function translateManeuver(step) {
  if (!step || !step.maneuver) return 'ขับตรงไปตามเส้นทาง';
  const { type, modifier } = step.maneuver;
  const road = step.name ? ` เข้าสู่ ${step.name}` : '';
  if (type === 'arrive') return 'ถึงจุดหมายปลายทาง';
  if (type === 'roundabout') return 'เข้าสู่วงเวียน' + road;
  if (modifier === 'left' || modifier === 'sharp left') return 'เลี้ยวซ้าย' + road;
  if (modifier === 'slight left') return 'เบี่ยงซ้าย' + road;
  if (modifier === 'right' || modifier === 'sharp right') return 'เลี้ยวขวา' + road;
  if (modifier === 'slight right') return 'เบี่ยงขวา' + road;
  if (modifier === 'uturn') return 'กลับรถ' + road;
  return 'ตรงไป' + road;
}

function fmtDist(meters) {
  if (meters >= 1000) return (meters / 1000).toFixed(1) + ' กม.';
  return Math.max(10, Math.round(meters / 10) * 10) + ' ม.';
}

export async function routeTo(destLat, destLng, destName) {
  state.nav.destName = destName;
  state.nav.destLat = destLat;
  state.nav.destLng = destLng;
  state.nav.nextDist = 'กำลังคำนวณ...';
  state.nav.nextText = destName;
  state.nav.active = true;
  notify('nav');

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${state.lng},${state.lat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM error');
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (!route) throw new Error('No route found');

    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    if (map && typeof window.L !== 'undefined') {
      if (routeGlow) map.removeLayer(routeGlow);
      if (routeLine) map.removeLayer(routeLine);
      if (destMarker) map.removeLayer(destMarker);

      routeGlow = window.L.polyline(coords, { color: '#064A99', weight: 9, opacity: 0.7 }).addTo(map);
      routeLine = window.L.polyline(coords, { color: '#38A1FF', weight: 5, opacity: 1 }).addTo(map);
      destMarker = window.L.circleMarker([destLat, destLng], {
        radius: 9,
        fillColor: '#EF4444',
        color: '#FFFFFF',
        weight: 3,
        fillOpacity: 1
      }).addTo(map);

      followMode = false;
      updateFollowBtn();
      map.fitBounds(routeLine.getBounds(), { padding: [48, 48] });
    }

    const leg = route.legs && route.legs[0];
    const steps = (leg && leg.steps) || [];
    const nextStep = steps.length > 1 ? steps[1] : steps[0];
    const eta = new Date(Date.now() + route.duration * 1000);
    const p2 = (n) => (n < 10 ? '0' + n : String(n));

    state.nav.distKm = route.distance / 1000;
    state.nav.durationMin = Math.max(1, Math.round(route.duration / 60));
    state.nav.etaText = `${p2(eta.getHours())}:${p2(eta.getMinutes())} · ${state.nav.durationMin} นาที (${state.nav.distKm.toFixed(1)} กม.)`;
    state.nav.nextDist = nextStep ? fmtDist(nextStep.distance) : fmtDist(route.distance);
    state.nav.nextText = nextStep ? translateManeuver(nextStep) : destName;
    notify('nav');
  } catch (err) {
    state.nav.nextDist = 'ไม่พบเส้นทาง';
    state.nav.nextText = 'แตะปุ่ม Google Maps เพื่อนำทางแทน';
    notify('nav');
  }
}

export function clearRoute() {
  if (map) {
    if (routeGlow) { map.removeLayer(routeGlow); routeGlow = null; }
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
  }
  state.nav = {
    active: false,
    destName: '',
    destLat: null,
    destLng: null,
    nextDist: 'พร้อมนำทาง',
    nextText: 'แตะค้นหาเพื่อเลือกจุดหมาย',
    etaText: '',
    distKm: 0,
    durationMin: 0
  };
  recenterMap();
  notify('nav');
}

export function openInGoogleMaps() {
  if (state.nav.active && state.nav.destLat != null) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${state.nav.destLat},${state.nav.destLng}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
  } else {
    window.open(`https://www.google.com/maps/@${state.lat},${state.lng},15z`, '_blank', 'noopener');
  }
}

export function toggleMapSearch(force) {
  searchOpen = typeof force === 'boolean' ? force : !searchOpen;
  const panel = document.getElementById('mapSearchPanel');
  if (panel) {
    panel.hidden = !searchOpen;
    if (searchOpen) {
      const inp = document.getElementById('mapSearchInput');
      if (inp) setTimeout(() => inp.focus(), 50);
    }
  }
}

async function performSearch() {
  const inp = document.getElementById('mapSearchInput');
  const box = document.getElementById('mapSearchResults');
  if (!inp || !box) return;
  const q = inp.value.trim();
  if (!q) return;

  box.innerHTML = '<div style="padding:8px;font-size:12px;color:#94A3B8">กำลังค้นหา...</div>';
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=th&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) {
      box.innerHTML = '<div style="padding:8px;font-size:12px;color:#94A3B8">ไม่พบสถานที่ที่ค้นหา</div>';
      return;
    }
    box.innerHTML = items.map((it, idx) =>
      `<button class="map-search-item" data-sidx="${idx}">${esc(it.display_name)}</button>`
    ).join('');

    box.querySelectorAll('.map-search-item').forEach((btn) => {
      btn.onclick = () => {
        const picked = items[Number(btn.dataset.sidx)];
        if (!picked) return;
        const shortName = picked.display_name.split(',')[0].trim();
        toggleMapSearch(false);
        routeTo(Number(picked.lat), Number(picked.lon), shortName);
      };
    });
  } catch (err) {
    box.innerHTML = '<div style="padding:8px;font-size:12px;color:#F87171">ค้นหาไม่สำเร็จ (ตรวจสอบอินเทอร์เน็ต)</div>';
  }
}

function bindMapUi() {
  const searchBtn = document.getElementById('mapSearchBtn');
  const closeBtn = document.getElementById('mapSearchClose');
  const goBtn = document.getElementById('mapSearchGo');
  const inp = document.getElementById('mapSearchInput');
  const followBtn = document.getElementById('mapFollowBtn');
  const gmapsBtn = document.getElementById('mapGmapsBtn');
  const clearBtn = document.getElementById('mapClearRouteBtn');
  const turnBanner = document.getElementById('turnBanner');

  if (searchBtn) searchBtn.onclick = () => toggleMapSearch();
  if (closeBtn) closeBtn.onclick = () => toggleMapSearch(false);
  if (goBtn) goBtn.onclick = performSearch;
  if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') performSearch(); };
  if (followBtn) followBtn.onclick = recenterMap;
  if (gmapsBtn) gmapsBtn.onclick = openInGoogleMaps;
  if (clearBtn) clearBtn.onclick = clearRoute;
  if (turnBanner) turnBanner.onclick = () => toggleMapSearch(true);
}
