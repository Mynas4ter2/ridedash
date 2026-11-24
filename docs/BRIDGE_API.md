# RideDash Frontend ↔ Android Native Bridge API

เอกสารนี้สำหรับนักพัฒนาฝั่ง **Android (Kotlin / Java)** ที่จะนำโฟลเดอร์ Frontend ของ **RideDash** ไปฝังใน Android Studio เพื่อเชื่อมต่อกับระบบ **MotoPlay / EasyConn / VirtualDisplay + MediaCodec H.264** (เช่นแนวทางของ `ridescreen-aa` / `open-cfmoto`)

---

## 1. การจัดวางไฟล์ใน Android Studio

คัดลอกโฟลเดอร์โปรเจกต์เว็บทั้งหมด (`index.html`, `display.html`, `css/`, `js/`, `icons/`) ไปวางใน:
```
app/src/main/assets/www/
```
ทุกไฟล์ใช้ Relative Path (`./...`) ทั้งหมด สามารถโหลดผ่าน `WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/www/index.html`) ได้ทันทีโดยไม่ติดปัญหา CORS ของ ES Modules

### หน้าจอ 2 จุด (Dual-Entry Architecture)
1. **`index.html` (Companion Control UI)**: โหลดใน `WebView` บนหน้าจอมือถือ สำหรับตั้งค่าทางลัด, สแกน QR, ปรับอัตราส่วน/ความละเอียด, ดูสถานะสตรีม, บันทึกทริป และค่าน้ำมัน
2. **`display.html` (VirtualDisplay Screen)**: โหลดใน `WebView` บน **`VirtualDisplay` (`800×480` หรือขนาดตามสเปกจอรถ)** — เป็นหน้าจอ Dashboard ล้วน 100% ไร้กรอบ ไร้เมนูตั้งค่า พร้อมส่งภาพเข้า `MediaCodec` H.264 ขึ้นจอรถ Zontes 368K แม้ปิดหน้าจอมือถือ

---

## 2. คำสั่งจาก Frontend → Android (`window.RideDashNative`)

ฉีด JavaScript Interface ชื่อ `"RideDashNative"` เข้ากับ `WebView`:
```kotlin
webView.addJavascriptInterface(RideDashBridge(context, webView), "RideDashNative")
```

| เมธอด (Kotlin `@JavascriptInterface`) | พารามิเตอร์ | คำอธิบาย |
|---|---|---|
| `scanQr()` | ไม่มี | เปิดหน้ากล้องสแกน QR ของรถ Zontes 368K แล้วส่งผลกลับทาง `onQrResult(raw)` |
| `connectBike(qrPayloadJson: String)` | JSON หรือข้อความ QR | เริ่ม Handshake Wi-Fi / MotoPlay และเริ่มสตรีม H.264 |
| `disconnectBike()` | ไม่มี | หยุดสตรีมและตัดการเชื่อมต่อจอรถ |
| `updateStreamConfig(configJson: String)` | `{"ratio":"5:3","resolution":"800×480","fitMode":"contain","mapProvider":"Google Maps","safeOn":true,"safeLimit":60}` | อัปเดตความละเอียด/สัดส่วนของ `VirtualDisplay` และตั้งค่า Safe Mode |
| `launchApp(appId: String, packageName: String)` | `appId`, `packageName` | สั่งเปิดแอป Android จริงบน VirtualDisplay (เช่น `com.spotify.music`) |
| `setHandlebarMap(mapJson: String)` | `{"L":["left","map"],...}` | ซิงก์การตั้งค่าปุ่มแฮนด์กดสั้น/กดค้าง |

---

## 3. อีเวนต์จาก Android → Frontend (`window.RideDashBridge`)

เรียกผ่าน `webView.evaluateJavascript(...)` บน Main Thread เพื่ออัปเดต UI แบบเรียลไทม์:

| ฟังก์ชัน JS | ตัวอย่างการเรียกจาก Kotlin | ผลลัพธ์บนหน้าจอ |
|---|---|---|
| `onConnectionState(json)` | `window.RideDashBridge.onConnectionState('{"state":"streaming","bikeName":"Zontes 368K","ip":"192.168.43.1","message":"กำลังส่งภาพ H.264"}')` | อัปเดตป้ายสถานะการเชื่อมต่อ และแสดง Overlay `กำลังเชื่อมต่อใหม่…` เมื่อ `state === "reconnecting"` |
| `onTelemetry(json)` | `window.RideDashBridge.onTelemetry('{"fps":30,"latencyMs":42,"tempC":37,"bitrateMbps":3.1,"reconnects":0}')` | แสดงค่า FPS, ความหน่วง, อุณหภูมิ, บิตเรตจริงในแท็บ **ระบบ** (แทนค่าจำลองอัตโนมัติ) |
| `onGps(json)` | `window.RideDashBridge.onGps('{"lat":13.7367,"lng":100.5612,"speedKmh":64,"heading":90,"accuracy":8}')` | อัปเดตพิกัดแผนที่, ความเร็ว, เข็มทิศ และกระตุ้น Safe Mode (ทำงานได้แม้ปิดจอมือถือ) |
| `onHandlebarKey(key, type)` | `window.RideDashBridge.onHandlebarKey("R", "short")` | สั่งเลื่อนโฟกัส / กด OK / กลับหน้าโฮม ตามปุ่มแฮนด์ (`L`, `R`, `O`, `B` และ `short` หรือ `long`) |
| `onQrResult(rawText)` | `window.RideDashBridge.onQrResult("ZT368K|192.168.43.1|...")` | รับค่าจาก QR Scanner ของ Android เพื่อแสดงและสั่งเชื่อมต่อ |

---

## 4. การทดสอบ Bridge บนเบราว์เซอร์ (ไม่ต้องมี Android Studio)

เปิด `index.html` หรือ `display.html` บน Chrome แล้วลองพิมพ์ใน DevTools Console:
```js
window.RideDashBridge.onTelemetry({ fps: 30, latencyMs: 38, tempC: 36, bitrateMbps: 3.4 });
window.RideDashBridge.onConnectionState({ state: "streaming", bikeName: "Zontes 368K V1", message: "เชื่อมต่อแล้ว" });
window.RideDashBridge.onHandlebarKey("R", "short");
```
