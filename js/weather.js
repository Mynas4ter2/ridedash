import { state, notify } from './store.js';

const CACHE_MS = 15 * 60 * 1000;
let lastCoords = null;
let fetching = false;

function decodeWmo(code) {
  if (code === 0) return { desc: 'ท้องฟ้าแจ่มใส', icon: '☀️' };
  if (code <= 3) return { desc: 'มีเมฆบางส่วน', icon: '⛅' };
  if (code <= 48) return { desc: 'มีหมอก', icon: '🌫️' };
  if (code <= 57) return { desc: 'ฝนปรอยๆ', icon: '🌦️' };
  if (code <= 67) return { desc: 'ฝนตก', icon: '🌧️' };
  if (code <= 77) return { desc: 'ลูกเห็บ/หิมะ', icon: '🌨️' };
  if (code <= 82) return { desc: 'ฝนตกหนักเป็นช่วงๆ', icon: '🌧️' };
  if (code >= 95) return { desc: 'พายุฝนฟ้าคะนอง', icon: '⛈️' };
  return { desc: 'มีเมฆมาก', icon: '☁️' };
}

export async function refreshWeather(force = false) {
  if (fetching) return;
  const now = Date.now();
  const movedEnough =
    !lastCoords ||
    Math.abs(lastCoords.lat - state.lat) > 0.05 ||
    Math.abs(lastCoords.lng - state.lng) > 0.05;

  if (!force && !movedEnough && now - state.weather.updatedAt < CACHE_MS) return;

  fetching = true;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat.toFixed(4)}&longitude=${state.lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const cur = data.current;
    if (cur) {
      const info = decodeWmo(cur.weather_code);
      state.weather = {
        temp: Math.round(cur.temperature_2m),
        humidity: Math.round(cur.relative_humidity_2m),
        wind: Math.round(cur.wind_speed_10m),
        desc: info.desc,
        icon: info.icon,
        updatedAt: now
      };
      lastCoords = { lat: state.lat, lng: state.lng };
      notify('weather');
    }
  } catch (err) {
    if (state.weather.temp == null) {
      state.weather.desc = 'ออฟไลน์';
      state.weather.icon = '📡';
      notify('weather');
    }
  } finally {
    fetching = false;
  }
}
