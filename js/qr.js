/**
 * Browser Fallback QR Scanner Modal for Zontes 368K Pairing
 * When running inside Android WebView, Bridge.requestScanQr() calls native CameraX/MLKit instead.
 */

import { connectBike, isNativeAndroid } from './bridge.js';

let stream = null;
let scanRaf = null;
let detector = null;

const $ = (id) => document.getElementById(id);

export function openQrModal() {
  const modal = $('qrModal');
  if (!modal) return;
  modal.hidden = false;
  if ($('qrStatus')) {
    $('qrStatus').textContent = isNativeAndroid()
      ? 'กำลังรอข้อมูลจาก Android Native Scanner...'
      : 'ส่องกล้องไปที่ QR บนจอรถ Zontes 368K หรือกดทดสอบเชื่อมต่อจำลอง';
  }
  startCamera();
}

export function closeQrModal() {
  stopCamera();
  const modal = $('qrModal');
  if (modal) modal.hidden = true;
}

async function startCamera() {
  const video = $('qrVideo');
  const status = $('qrStatus');
  if (!video || !navigator.mediaDevices?.getUserMedia) {
    if (status) status.textContent = 'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง — กรอกรหัส QR หรือกดจำลองเชื่อมต่อด้านล่าง';
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();

    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        scanLoop(video);
      } catch (e) {}
    } else if (status) {
      status.textContent = 'เปิดกล้องแล้ว (เบราว์เซอร์ไม่รองรับ BarcodeDetector อัตโนมัติ — ฝั่ง Android Native จะอ่าน QR ให้อัตโนมัติ)';
    }
  } catch (err) {
    if (status) status.textContent = 'ไม่สามารถเข้าถึงกล้อง (อนุญาตสิทธิ์กล้อง หรือใช้ปุ่มจำลองเชื่อมต่อด้านล่าง)';
  }
}

async function scanLoop(video) {
  if (!stream || !detector) return;
  try {
    const codes = await detector.detect(video);
    if (codes && codes.length) {
      const val = codes[0].rawValue || '';
      if (val) {
        if ($('qrManualIn')) $('qrManualIn').value = val;
        closeQrModal();
        connectBike(val);
        return;
      }
    }
  } catch (e) {}
  scanRaf = requestAnimationFrame(() => scanLoop(video));
}

function stopCamera() {
  if (scanRaf) { cancelAnimationFrame(scanRaf); scanRaf = null; }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  const video = $('qrVideo');
  if (video) video.srcObject = null;
}

export function initQrModal(onToggleMirror) {
  if ($('qrCloseBtn')) $('qrCloseBtn').onclick = closeQrModal;
  if ($('qrModal')) {
    $('qrModal').onclick = (e) => {
      if (e.target === $('qrModal')) closeQrModal();
    };
  }
  if ($('qrConnectBtn')) {
    $('qrConnectBtn').onclick = () => {
      const code = ($('qrManualIn')?.value || '').trim() || 'ZT368K-MOTOPLAY-DEMO';
      closeQrModal();
      connectBike(code);
    };
  }
  if ($('qrMirrorBtn')) {
    $('qrMirrorBtn').onclick = () => {
      closeQrModal();
      if (onToggleMirror) onToggleMirror(true);
    };
  }
}
