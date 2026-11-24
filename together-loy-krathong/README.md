# Together Loy Krathong 🏮
เกม 2D Pixel Art ลอยกระทงสำหรับ 2 คน (Phaser 3 + Node.js + Socket.IO)

## รันในเครื่อง
```bash
npm install
cp .env.example .env   # (ไม่บังคับ) ใส่ค่า Supabase
node server.js         # เปิด http://localhost:3000
```
ทดสอบ: เปิด 2 แท็บ → แท็บ A กด Create Room ได้รหัส 6 หลัก → แท็บ B ใส่รหัสแล้วกด Join

## Supabase (ไม่บังคับ)
รัน SQL นี้ใน SQL Editor:
```sql
create table rooms (code text primary key, players jsonb, floated boolean default false, updated_at timestamptz);
alter table rooms enable row level security; -- ไม่มี policy = เข้าถึงได้เฉพาะ service key ฝั่ง server
```
ตั้ง `SUPABASE_URL` และ `SUPABASE_SERVICE_KEY` (ห้ามเปิดเผย key ฝั่ง client)

## Deploy
Render / Railway / Fly.io (ต้องรองรับ WebSocket และ Node 18+): Build `npm install`, Start `node server.js`, ตั้ง env ตาม `.env.example`
หมายเหตุ: Vercel/Netlify แบบ serverless ใช้ Socket.IO ไม่ได้

## ปุ่มควบคุม
WASD/ลูกศร เดิน · E โต้ตอบ · Space ส่งหัวใจ · Enter แชท · มือถือใช้จอยสติ๊ก

## ข้อจำกัดของเวอร์ชันนี้
- ห้องเก็บใน memory ของเซิร์ฟเวอร์ (รีสตาร์ทแล้วห้องหาย) ถ้าใช้หลาย instance ต้องเพิ่ม Redis adapter
- Collision ตรวจฝั่ง client; server ตรวจขอบแผนที่ + ความเร็ว (กันวาร์ป)
- กราฟิกและเสียงสร้างด้วยโค้ด (ไม่มีไฟล์ asset) สามารถเปลี่ยนเป็น sprite sheet / mp3 จริงได้

## ขึ้น GitHub + เปิดเว็บ
```bash
git init && git add . && git commit -m "Together Loy Krathong"
git branch -M main
git remote add origin https://github.com/<user>/together-loy-krathong.git
git push -u origin main
```
- **เล่นจริง 2 คน**: Render → New → Blueprint → เลือก repo (อ่าน `render.yaml` ให้เอง) → ได้ URL เช่น `https://xxx.onrender.com` ใช้ได้ทันที
- **เดโม (คู่หูจำลอง)**: GitHub → Settings → Pages → Branch `main` / โฟลเดอร์ `/docs` → ได้ `https://<user>.github.io/together-loy-krathong/`
- GitHub Pages ใช้โฮสต์เกมจริงไม่ได้ เพราะต้องมีเซิร์ฟเวอร์ Socket.IO (ถ้าจะแยกหน้าเว็บ ให้ตั้ง `SERVER_URL` ใน `public/config.js` และ `CORS_ORIGIN` ใน server)
