/**
 * RideDash Frontend <-> Android Native Bridge
 *
 * When running inside Android WebView with:
 *   webView.addJavascriptInterface(RideDashBridge(...), "RideDashNative")
 * calls automatically route to native MotoPlay / VirtualDisplay / H.264 services.
 *
 * When running in a standard Web Browser (e.g. GitHub Pages preview),
 * calls safely fall back to browser simulation so UI & flows remain 100% testable.
 */

import { state, notify } from './store.js';

const handlers = {
  handlebar: null,
  qrResult: null
};

export function isNativeAndroid() {
  return typeof window !== 'undefined' && typeof window.RideDashNative === 'object' && window.RideDashNative !== null;
}

function callNative(method, ...args) {
  if (!isNativeAndroid()) return false;
  const fn = window.RideDashNative[method];
  if (typeof fn !== 'function') return false;
  try {
    fn.apply(window.RideDashNative, args);
    return true;
  } catch (err) {
    console.warn(`[RideDashBridge] Native call ${method} failed:`, err);
    return false;
  }
}

// ===== Frontend -> Android Native Commands =====

export function requestScanQr() {
  if (callNative('scanQr')) {
    state.conn.status = 'scanning';
    state.conn.message = 'กำลังเปิดกล้องสแกน QR ของ Android...';
    notify('conn');
    return true;
  }
  return false; // Caller opens Web QR / Sim modal fallback
}

export function connectBike(qrPayload) {
  const payload = typeof qrPayload === 'string' ? qrPayload : JSON.stringify(qrPayload || {});
  if (callNative('connectBike', payload)) {
    state.conn.status = 'connecting';
    state.conn.message = 'กำลังเชื่อมต่อจอรถผ่าน MotoPlay Wi-Fi...';
    notify('conn');
    return;
  }
  // Browser simulation fallback
  state.conn.status = 'connecting';
  state.conn.qrData = payload;
  state.conn.message = 'จำลองการเชื่อมต่อจอรถ Zontes 368K...';
  notify('conn');
  setTimeout(() => {
    state.conn.status = 'streaming';
    state.conn.bikeName = 'Zontes 368K (Demo)';
    state.conn.message = 'เชื่อมต่อแล้ว (โหมดจำลองบนเบราว์เซอร์)';
    notify('conn');
  }, 900);
}

export function disconnectBike() {
  if (!callNative('disconnectBike')) {
    state.conn.status = 'disconnected';
    state.conn.message = 'ตัดการเชื่อมต่อแล้ว';
    notify('conn');
  }
}

export function syncStreamConfig() {
  const cfg = {
    ratio: state.rname,
    resolution: state.res,
    fitMode: state.mode,
    mapProvider: state.prov,
    safeOn: state.safeOn,
    safeLimit: state.limit
  };
  callNative('updateStreamConfig', JSON.stringify(cfg));
}

export function launchNativeApp(appId, packageName) {
  return callNative('launchApp', String(appId || ''), String(packageName || ''));
}

export function syncHandlebarMap() {
  callNative('setHandlebarMap', JSON.stringify(state.map));
}

// ===== Register Frontend Listeners for Native Callbacks =====

export function setBridgeHandlers({ onHandlebar, onQrResult } = {}) {
  if (onHandlebar) handlers.handlebar = onHandlebar;
  if (onQrResult) handlers.qrResult = onQrResult;
}

// ===== Android Native -> Frontend Callbacks (window.RideDashBridge) =====

function parseArg(input) {
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch (e) { return { raw: input }; }
  }
  return input && typeof input === 'object' ? input : {};
}

export function initBridge() {
  window.RideDashBridge = {
    isReady: true,

    /** Native pushes connection state: disconnected | scanning | connecting | streaming | reconnecting */
    onConnectionState(payload) {
      const d = parseArg(payload);
      if (d.state) state.conn.status = d.state;
      if (d.bikeName != null) state.conn.bikeName = d.bikeName;
      if (d.ip != null) state.conn.ip = d.ip;
      if (d.message != null) state.conn.message = d.message;
      state.recon = state.conn.status === 'reconnecting';
      if (typeof d.reconnects === 'number') state.rc = d.reconnects;
      notify('conn');
      notify('diag');
    },

    /** Native pushes real encoder/device stats: { fps, latencyMs, tempC, bitrateMbps, reconnects } */
    onTelemetry(payload) {
      const d = parseArg(payload);
      state.nativeDiag = {
        fps: typeof d.fps === 'number' ? d.fps : state.nativeDiag?.fps ?? 30,
        lat: typeof d.latencyMs === 'number' ? d.latencyMs : state.nativeDiag?.lat ?? 45,
        tmp: typeof d.tempC === 'number' ? d.tempC : state.nativeDiag?.tmp ?? 38,
        br: d.bitrateMbps != null ? Number(d.bitrateMbps).toFixed(1) : state.nativeDiag?.br ?? '2.5'
      };
      if (typeof d.reconnects === 'number') state.rc = d.reconnects;
      notify('diag');
    },

    /** Native pushes real background GPS (keeps running when phone screen is off) */
    onGps(payload) {
      const d = parseArg(payload);
      if (typeof d.lat === 'number' && typeof d.lng === 'number') {
        state.lat = d.lat;
        state.lng = d.lng;
      }
      if (typeof d.speedKmh === 'number') state.speed = Math.round(Math.max(0, d.speedKmh));
      if (typeof d.heading === 'number') state.heading = ((d.heading % 360) + 360) % 360;
      if (typeof d.accuracy === 'number') state.accuracy = Math.round(d.accuracy);
      state.gpsMode = 'native';
      state.gpsStatus = `Native GPS (±${state.accuracy ?? '-'} ม.)`;
      notify('gps');
    },

    /** Native pushes handlebar button press: key = 'L'|'R'|'O'|'B', pressType = 'short'|'long' */
    onHandlebarKey(key, pressType = 'short') {
      if (handlers.handlebar) handlers.handlebar(String(key).toUpperCase(), pressType === 'long' ? 1 : 0);
    },

    /** Native pushes scanned QR code text from CameraX / MLKit */
    onQrResult(rawText) {
      state.conn.qrData = String(rawText || '');
      if (handlers.qrResult) handlers.qrResult(state.conn.qrData);
      notify('conn');
    }
  };
}
