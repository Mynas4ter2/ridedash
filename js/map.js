import { state } from './store.js';

let map = null;
let tileLayer = null;
let riderMarker = null;
let destMarker = null;
let routeLine = null;
let routeGlow = null;
let followMode = true;

const TILES = {
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenStreetMap',
    darkFilter: false
  },
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenStreetMap',
    darkFilter: true
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '&copy; Esri Imagery',
    darkFilter: false
  }
};

function riderIconHtml(deg) {
  return `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(deg)}deg);transition:transform 0.35s ease">
    <svg width="30" height="30" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10.5" fill="rgba(2,132,199,0.28)"/>
      <path d="M12 2.8 L18.5 19.2 L12 15.6 L5.5 19.2 Z" fill="#0284C7" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  </div>`;
}

export function initMap() {
  const container = document.getElementById('liveMap');
  if (!container || typeof window.L === 'undefined') return;

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
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    }),
    zIndexOffset: 1000
  }).addTo(map);

  map.on('dragstart', () => {
    followMode = false;
    updateFollowButtons();
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (map) map.invalidateSize({ animate: false });
    }).observe(container);
  }
}

// Moves the single live Leaflet DOM node cleanly between Map Tab and Fullscreen Ride HUD!
export function mountMapInto(targetId) {
  const mapEl = document.getElementById('liveMap');
  const target = document.getElementById(targetId);
  if (!mapEl || !target || mapEl.parentElement === target) {
    invalidateMap();
    return;
  }
  target.insertBefore(mapEl, target.firstChild);
  invalidateMap();
}

export function applyMapStyle(styleId) {
  if (!map || typeof window.L === 'undefined') return;
  const spec = TILES[styleId] || TILES.light;
  const container = document.getElementById('liveMap');
  if (container) container.classList.toggle('map-dark', !!spec.darkFilter);
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = window.L.tileLayer(spec.url, {
    attribution: spec.attr,
    maxZoom: 19
  }).addTo(map);
}

export function invalidateMap() {
  if (!map) return;
  setTimeout(() => map.invalidateSize({ animate: false }), 60);
  setTimeout(() => map.invalidateSize({ animate: false }), 220);
}

export function updateMapPosition() {
  if (!map || !riderMarker) return;
  riderMarker.setLatLng([state.lat, state.lng]);
  const el = riderMarker.getElement();
  if (el?.firstElementChild) {
    el.firstElementChild.style.transform = `rotate(${Math.round(state.heading)}deg)`;
  }
  if (followMode) {
    map.panTo([state.lat, state.lng], { animate: true, duration: 0.45 });
  }
}

export function recenterMap(zoom = 16) {
  followMode = true;
  if (map) map.setView([state.lat, state.lng], Math.max(map.getZoom(), zoom), { animate: true });
  updateFollowButtons();
}

function updateFollowButtons() {
  const hudBtn = document.getElementById('hudFollowBtn');
  if (hudBtn) hudBtn.classList.toggle('active', followMode);
}

export function drawActiveRoute(fit = true) {
  if (!map || typeof window.L === 'undefined') return;
  clearRouteLayers();

  const { coords, destLat, destLng } = state.nav;
  if (!coords || !coords.length) return;

  routeGlow = window.L.polyline(coords, { color: '#0369A1', weight: 10, opacity: 0.45 }).addTo(map);
  routeLine = window.L.polyline(coords, { color: '#0EA5E9', weight: 5.5, opacity: 1 }).addTo(map);
  if (destLat != null && destLng != null) {
    destMarker = window.L.circleMarker([destLat, destLng], {
      radius: 9,
      fillColor: '#DC2626',
      color: '#FFFFFF',
      weight: 3,
      fillOpacity: 1
    }).addTo(map);
  }

  if (fit) {
    followMode = false;
    updateFollowButtons();
    map.fitBounds(routeLine.getBounds(), { padding: [52, 52] });
  }
}

export function clearRouteLayers() {
  if (!map) return;
  if (routeGlow) { map.removeLayer(routeGlow); routeGlow = null; }
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
}

export function openInGoogleMaps() {
  const nav = state.nav;
  if (nav.destLat != null && nav.destLng != null) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${nav.destLat},${nav.destLng}&travelmode=driving`, '_blank', 'noopener');
  } else {
    window.open(`https://www.google.com/maps/@${state.lat},${state.lng},15z`, '_blank', 'noopener');
  }
}
