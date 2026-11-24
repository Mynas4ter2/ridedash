# RideDash — Zontes 368K Dashboard Frontend (Android WebView Handoff Ready)

ชุด Frontend ต้นแบบและหน้าจอควบคุมสำหรับ **RideDash (Zontes 368K)** ที่ปรับแต่งให้รองรับหลายแพลตฟอร์ม (มือถือ, แท็บเล็ต, คอมพิวเตอร์) พร้อมระบบปรับความละเอียดอัตโนมัติ (**Auto Resolution**) และโครงสร้างสะพานเชื่อมต่อ (**Android Native Bridge**) เพื่อส่งต่อให้ฝั่ง Android Studio นำไปเชื่อมกับระบบ **MotoPlay / EasyConn / VirtualDisplay + H.264** ได้ทันที

## ฟีเจอร์ที่ใช้งานได้ในชุด Frontend นี้
- **หน้าจอ Zontes 368K Display + Auto Resolution**: ปรับเลย์เอาต์อัตโนมัติตามขนาดจอด้วย Container Queries ไม่มีปุ่มเบียดหรือตัดขอบทั้งบนจอมือถือและจอคอม
- **Dual-Entry สำหรับ Android Studio**:
  - `index.html` — หน้าควบคุมบนมือถือ (Preview + ปุ่มแฮนด์ + 4 แท็บ `ทางลัด / จอ / ระบบ / ทริป` + ปุ่มสแกน QR ตรงกลาง)
  - `display.html` — หน้าจอ Dashboard ล้วน 100% ไร้กรอบ ไร้เมนู สำหรับให้ Android เรนเดอร์ขึ้น **`VirtualDisplay` (`800×480` / `5:3`)** เพื่อเอนโค้ด H.264 ส่งขึ้นจอรถ
- **Android Native Bridge (`js/bridge.js`)**:
  - มีตัวกลางเชื่อมต่อ 2 ทาง (`window.RideDashNative` ↔ `window.RideDashBridge`) สำหรับสแกน QR, เชื่อมต่อ Wi-Fi MotoPlay, ส่งค่าสัดส่วน/ความละเอียด, รับค่า FPS/Latency/อุณหภูมิ/บิตเรตจริง, รับ GPS เบื้องหลัง และรับปุ่มแฮนด์จริง
  - เมื่อเปิดบนเบราว์เซอร์ปกติ (เช่น GitHub Pages) จะสลับเป็น **Browser Fallback** อัตโนมัติ (เปิดกล้องเว็บสแกน QR, จำลองการเชื่อมต่อ, จำลอง Diagnostics)
  - อ่านสเปกและตัวอย่างโค้ด Kotlin ได้ที่ [`docs/BRIDGE_API.md`](./docs/BRIDGE_API.md) และ [`docs/RideDashBridge.kt.example`](./docs/RideDashBridge.kt.example)
- **ระบบจริงใต้ UI ต้นฉบับ**: แผนที่ OpenStreetMap จริง, นาฬิกาจริง, เครื่องเล่นเพลงจริง (ไฟล์ในเครื่อง + วิทยุ + Media Session API), GPS จริงสลับโหมดจำลอง, โหมดปลอดภัย (Safe Mode), บันทึกทริปถาวร และคำนวณ/บันทึกค่าน้ำมันพร้อมคัดลอก CSV
- **Dark Mode เริ่มต้น + ปุ่มสลับโหมดสว่างขวาบน** และ **Terms & Privacy**

## วิธีทดสอบในเครื่อง (Local)
```bash
python -m http.server 8080
```
- หน้าควบคุมหลัก: `http://localhost:8080/index.html`
- หน้า VirtualDisplay (`800×480`): `http://localhost:8080/display.html`

## วิธีดาวน์โหลดไฟล์ `.apk` (Build อัตโนมัติผ่าน GitHub Actions)
ไม่ต้องติดตั้ง Android Studio ในเครื่อง — ทุกครั้งที่ Push โค้ด GitHub Actions (`.github/workflows/build-apk.yml`) จะรวมไฟล์ Frontend ล่าสุดเข้า `assets/www/` และคอมไพล์ไฟล์ **`.apk`** ให้อัตโนมัติ:
1. ไปที่หน้า Repository บน GitHub → แท็บ **Actions**
2. คลิกที่ Workflow ล่าสุด **Build Android APK**
3. เลื่อนลงไปส่วน **Artifacts** แล้วกดดาวน์โหลด **`RideDash-Android-APK`** (แตกไฟล์ซิปจะได้ `RideDash-debug.apk`)
4. ส่งไฟล์ `RideDash-debug.apk` เข้ามือถือ Android แล้วกดติดตั้ง (อนุญาต *Install from unknown sources* หากระบบถาม)

### โครงสร้างโปรเจกต์ Android (`android/`)
- `MainActivity.kt` — โฮสต์ WebView (`WebViewAssetLoader`), กล้องสแกน QR แบบ Native (ZXing), เปิดแอปภายนอกจริง, เลือกไฟล์เพลงจากเครื่อง
- `RideDashBridge.kt` — `@JavascriptInterface` เชื่อมต่อ `window.RideDashNative` ↔ `window.RideDashBridge`
- `RideDashForegroundService.kt` — บริการเบื้องหลัง (Foreground Location Service) อ่าน GPS จริงและอุณหภูมิเครื่องแม้สลับแอปหรือปิดจอ
- `VirtualDisplayStreamer.kt` — โครงสร้าง `VirtualDisplay` + `MediaCodec H.264` Hardware Encoder เรนเดอร์ `display.html` พร้อมจุดต่อ `FrameOutputSink` สำหรับใส่ MotoPlay Wi-Fi Socket ในขั้นถัดไป

## วิธีเปิดต่อยอดใน Android Studio
1. เปิดโฟลเดอร์ `android/` ใน Android Studio (Gradle จะดึงไฟล์ Frontend จากรูทเข้า `app/src/main/assets/www/` อัตโนมัติตอน Build)
2. ดูรายละเอียดสัญญาเชื่อมต่อทั้งหมดใน [`docs/BRIDGE_API.md`](./docs/BRIDGE_API.md)

---
*จัดทำโดย ratchapoom และ Mynas4ter2*
