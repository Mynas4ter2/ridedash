import { state } from './store.js';

let map = null;
let tileLayer = null;
let riderMarker = null;
let followMode = true;

function riderIconHtml(deg) {
  return `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(deg)}deg);transition:transform 0.35s ease">
    <svg width="26" height="26" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="rgba(10,132,255,0.3)"/>
      <path d="M12 3 L18 19 L12 15.5 L6 19 Z" fill="#0A84FF" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>
  </div>`;
}

export function initMap() {
  const el = document.getElementById('liveMap');
  if (!el || typeof window.L === 'undefined') return;

  map = window.L.map(el, {
    center: [state.lat, state.lng],
    zoom: 15,
    zoomControl: false,
    attributionControl: false
  });
  window.L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);

  tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM',
    maxZoom: 19
  }).addTo(map);

  applyMapTheme();

  riderMarker = window.L.marker([state.lat, state.lng], {
    icon: window.L.divIcon({
      className: 'rider-pin',
      html: riderIconHtml(state.heading),
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    }),
    zIndexOffset: 1000
  }).addTo(map);

  map.on('dragstart', () => { followMode = false; });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (map) map.invalidateSize({ animate: false });
    }).observe(el);
  }
}

export function applyMapTheme() {
  const el = document.getElementById('liveMap');
  if (el) el.classList.toggle('map-dark', state.theme === 'dark');
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

export function recenterMap() {
  followMode = true;
  if (map) map.setView([state.lat, state.lng], Math.max(map.getZoom(), 15), { animate: true });
}
