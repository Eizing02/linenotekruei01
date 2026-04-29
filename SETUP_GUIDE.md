# เลขาอี้ Dashboard V.2 — คู่มือติดตั้ง

## 📦 Tech Stack
- **Frontend**: Next.js 14 (App Router) + React + Tailwind CSS + Framer Motion
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **LINE Bot**: LINE Messaging API

---

## 🚀 ขั้นตอนติดตั้งทั้งหมด (ละเอียด)

### Step 1 — สร้าง Supabase Project

1. ไปที่ [https://supabase.com](https://supabase.com) → Sign up / Login
2. กด **New Project** → ตั้งชื่อ (เช่น `kru-yi`) → เลือก Region ใกล้ที่สุด (Singapore)
3. ตั้ง Database Password → กด Create Project → รอ ~2 นาที
4. ไปที่ **SQL Editor** (แถบซ้าย) → กด **New query**
5. วางโค้ดทั้งหมดจากไฟล์ `schema.sql` → กด **Run**
6. ตรวจสอบว่าสร้าง Table สำเร็จใน **Table Editor**

#### เก็บ Keys ไว้ (ใช้ใน Step 3):
- **Project URL**: `https://xxxx.supabase.co`  
  ที่ Project Settings → API → Project URL
- **anon public key**: `eyJhbGc...`  
  ที่ Project Settings → API → Project API Keys → anon
- **service_role key**: `eyJhbGc...`  
  ที่ Project Settings → API → Project API Keys → service_role (**ห้าม expose สาธารณะ**)

---

### Step 2 — Upload โค้ดขึ้น GitHub

1. สร้าง GitHub Repository ใหม่ (Private แนะนำ)
2. อัปโหลดทุกไฟล์จากโฟลเดอร์ `kru-yi-dashboard/` ขึ้น repo
3. ตรวจสอบว่ามีไฟล์ครบ:
   ```
   app/
   ├── api/data/route.ts
   ├── api/webhook/line/route.ts
   ├── api/cron/morning/route.ts
   ├── api/cron/evening/route.ts
   ├── globals.css
   ├── layout.tsx
   └── page.tsx
   lib/ (supabase.ts, dateUtils.ts, lineBot.ts)
   types/index.ts
   vercel.json
   package.json
   tsconfig.json
   ```

---

### Step 3 — Deploy บน Vercel

1. ไปที่ [https://vercel.com](https://vercel.com) → Sign up/Login (ใช้ GitHub)
2. กด **Add New → Project** → เลือก GitHub Repository ที่สร้างไว้
3. ตั้งค่า Framework: **Next.js** (auto-detect)
4. กด **Environment Variables** → เพิ่มตัวแปรเหล่านี้:

| Variable | ค่า |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL จาก Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key จาก Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key จาก Supabase |
| `CRON_SECRET` | รหัสผ่านสุ่มเอง เช่น `abc123xyz` |

5. กด **Deploy** → รอ Build ~2 นาที
6. เมื่อ Deploy สำเร็จ จะได้ URL เช่น `https://kru-yi.vercel.app`

---

### Step 4 — ตั้งค่า LINE Bot

1. ไปที่ [LINE Developer Console](https://developers.line.biz/console/)
2. สร้าง Provider → สร้าง **Messaging API Channel**
3. ใน Channel Settings → **Messaging API** tab:
   - คัดลอก **Channel Access Token** (Long-lived)
   - คัดลอก **User ID** ของตัวเอง (ใน LINE app → Profile → User ID)
4. เปิด Dashboard → ไปที่แท็บ **⚙️ ตั้งค่า**
5. ใส่ `LINE_TOKEN` และ `LINE_USER_ID` → กด **💾 บันทึก**
6. กลับไป LINE Console → **Webhook URL**:
   ```
   https://your-app.vercel.app/api/webhook/line
   ```
7. กด **Verify** → ต้องได้ `200 OK` ✅
8. เปิด **Use Webhook** → `ON`

---

### Step 5 — ทดสอบระบบ

- เปิด Dashboard URL → ตรวจสอบข้อมูลโหลดครบ
- พิมพ์ "วันนี้" ใน LINE → ต้องได้รับ reply
- ตรวจสอบ Cron Jobs ใน Vercel Dashboard → Settings → Cron Jobs

---

## ⚙️ Cron Schedule

| Route | เวลา UTC | เวลาไทย (UTC+7) | หน้าที่ |
|---|---|---|---|
| `/api/cron/morning` | 23:30 UTC | 06:30 | ส่งตารางวันนี้ |
| `/api/cron/evening` | 10:30 UTC | 17:30 | เตรียมพรุ่งนี้ |

---

## 🛠 Development Local

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. Copy และแก้ไข environment variables
cp .env.local.example .env.local
# แก้ไขค่าใน .env.local

# 3. รัน development server
npm run dev

# เปิด http://localhost:3000
```

---

## 📋 Features ครบ 100%

- ✅ 5 แท็บ: ภาพรวม, ตารางสอน, กิจกรรม, งานค้าง, ตั้งค่า
- ✅ ตารางแก้ไขได้ (Inline editable) + Dropdown Status
- ✅ Loading Overlay 12 วินาที + ปุ่ม Retry
- ✅ Stats: คาบสอนวันนี้, งานค้าง, เลยกำหนด, เสร็จแล้ว
- ✅ LINE Bot commands: วันนี้, พรุ่งนี้, งานค้าง, สรุปสัปดาห์
- ✅ ดัก dummy payload ของ LINE (00000...) → 200 OK
- ✅ Push Notification เช้า 06:30 / เย็น 17:30
- ✅ Framer Motion tab transitions + row animations
