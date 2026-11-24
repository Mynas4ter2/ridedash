# RideDash — Personal Riding Dashboard (PWA)

หน้าจอขับขี่สไตล์ Android Auto / CarPlay ส่วนตัวสำหรับมือถือและ Mirror ขึ้นจอรถ (รองรับทั้งรถยนต์และมอเตอร์ไซค์ เช่น Zontes 368K) สร้างเป็น Static Web App / PWA ไม่ต้องใช้ Backend หรือ API Key

## ฟีเจอร์หลักที่ใช้งานได้จริง
- **โหมดขับขี่เต็มจอ (Ride / Mirror Mode)**: กดแตะใช้งานทุกปุ่มบนหน้าจอได้จริง พร้อม Screen Wake Lock (กันหน้าจอดับ), Fullscreen, ล็อกแนวนอน และรองรับสัดส่วนจอหลายขนาด (`เต็มจอ`, `5:3`, `16:9`, `16:10`, `4:3`)
- **แผนที่และนำทางจริง (Leaflet + OpenStreetMap + OSRM)**: แสดงตำแหน่ง GPS แบบเรียลไทม์, ค้นหาสถานที่ (Nominatim), คำนวณเส้นทางพร้อมคำแนะนำเลี้ยวและเวลาถึง (ETA), และปุ่มเปิดนำทางต่อใน Google Maps
- **GPS จริง + โหมดจำลอง (Demo Mode)**: วัดความเร็ว (km/h), ทิศทาง/เข็มทิศ, ระยะทางจริง พร้อมสวิตช์สลับโหมดจำลองสำหรับทดลองในบ้าน
- **โหมดปลอดภัย (Safe Mode)**: เมื่อความเร็วถึงเกณฑ์ที่ตั้งไว้ ระบบจะขยายแผนที่ คำแนะนำเลี้ยว และมาตรวัดความเร็ว พร้อมซ่อนทางลัดที่ไม่จำเป็นอัตโนมัติ
- **เครื่องเล่นเพลงในตัว + Media Session API**: เลือกไฟล์เพลงจากเครื่อง (`.mp3`, `.m4a`, `.wav`), ฟังวิทยุออนไลน์ (เพิ่มลิงก์สตรีมเองได้), รองรับปุ่ม Play/Pause/Next/Prev บนหูฟัง Bluetooth หมวกกันน็อก และปุ่มทางลัดเปิด Spotify / YouTube Music
- **โทรด่วน (Speed Dial)**: ปุ่มใหญ่กดง่าย โทรออกได้ทันทีผ่าน `tel:` พร้อมเพิ่ม/ลบเบอร์เองได้
- **สภาพอากาศจริง (Open-Meteo)**: แสดงอุณหภูมิและสภาพอากาศตามพิกัด GPS ปัจจุบันฟรี
- **บันทึกทริปและคำนวณค่าน้ำมัน**: บันทึกลงเครื่องถาวร (`localStorage`), คัดลอก CSV, ประมาณการค่าน้ำมันเดินทาง, และสำรอง/กู้คืนข้อมูล JSON

## วิธี Deploy ขึ้น GitHub Pages (HTTPS ฟรี)

1. สร้าง Repository ใหม่บน GitHub (เช่นชื่อ `ridedash`)
2. เปิด Terminal ในโฟลเดอร์โปรเจกต์นี้แล้วรันคำสั่ง:
   ```bash
   git init
   git add .
   git commit -m "Initial RideDash PWA"
   git branch -M main
   git remote add origin https://github.com/<ชื่อผู้ใช้ของคุณ>/ridedash.git
   git push -u origin main
   ```
3. ไปที่หน้า Repository บน GitHub → **Settings** → **Pages**
4. ตรง **Build and deployment** เลือก Source เป็น **Deploy from a branch** → เลือก Branch `main` โฟลเดอร์ `/ (root)` → กด **Save**
5. รอประมาณ 1–2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้ของคุณ>.github.io/ridedash/` (HTTPS พร้อมใช้ GPS จริง)

## วิธีติดตั้งเป็นแอปบนมือถือ (PWA)
- **Android (Chrome)**: เปิดลิงก์ GitHub Pages → แตะเมนู `⋮` → เลือก **Add to Home screen (เพิ่มลงหน้าจอหลัก)**
- **iOS (Safari)**: เปิดลิงก์ → แตะปุ่ม **Share** → เลือก **Add to Home Screen (เพิ่มไปยังหน้าจอโฮม)**

## วิธีรันทดสอบในเครื่อง (Local)
```bash
python -m http.server 8080
```
จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:8080`
"# ridedash" 
