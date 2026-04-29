-- ============================================================
-- KRU YI ASSISTANT – Supabase Database Schema
-- Run this in Supabase SQL Editor (once)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. MASTER SCHEDULE ──────────────────────────────────────
-- Stores schedule rows (header row, time row, and day rows)
-- sort_order: 0=header, 1=time, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
CREATE TABLE IF NOT EXISTS master_schedule (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sort_order  int  NOT NULL DEFAULT 0,
  col0        text DEFAULT '',   -- วัน/คาบ label or day name
  col1        text DEFAULT '',   -- Period 1
  col2        text DEFAULT '',   -- Period 2
  col3        text DEFAULT '',   -- Period 3
  col4        text DEFAULT '',   -- Period 4
  col5        text DEFAULT '',   -- Period 5
  col6        text DEFAULT '',   -- Period 6
  col7        text DEFAULT '',   -- Period 7
  col8        text DEFAULT '',   -- Period 8
  col9        text DEFAULT '',   -- Period 9
  col10       text DEFAULT '',   -- Period 10
  created_at  timestamptz DEFAULT now()
);

-- ── 2. EVENTS & EXCEPTIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date  date,
  category    text DEFAULT '',
  detail      text DEFAULT '',
  event_time  text DEFAULT '',
  event_type  text DEFAULT 'ทำงาน',
  alert_days  int  DEFAULT 3,
  status      text DEFAULT 'รอดำเนินการ',
  created_at  timestamptz DEFAULT now()
);

-- ── 3. TASK TRACKER ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     text DEFAULT '',
  category    text DEFAULT '',
  name        text DEFAULT '',
  deadline    date,
  status      text DEFAULT 'ยังไม่เริ่ม',
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- ── 4. SYSTEM SETTINGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key         text NOT NULL UNIQUE,
  value       text DEFAULT '',
  description text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- ── SEED DATA: Master Schedule ───────────────────────────────
-- Sort 0: header row
INSERT INTO master_schedule (sort_order, col0, col1, col2, col3, col4, col5, col6, col7, col8, col9, col10)
VALUES
  (0, 'วัน / คาบ', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'),
  (1, 'เวลา', '08.30-09.20', '09.20-10.10', '10.15-11.05', '11.05-11.55', '13.00-13.50', '13.50-14.40', '14.40-15.30', '15.30-16.20', '16.20-17.30', 'หมายเหตุ'),
  (2, 'จันทร์',      'แนะแนว ม.4/1', 'ค31102 ม.4/1', '', 'ค22102 ม.2/1', '', 'ค22102 ม.2/2', 'กิจกรรมชุมนุม', 'PLC', '', ''),
  (3, 'อังคาร',      'ค32102 ม.5/1', '', 'ค21102 ม.1/1', 'ค33202 ม.6/1', 'ค31102 ม.4/1', '', 'กิจกรรมลดเวลาเรียน', '', '', ''),
  (4, 'พุธ',         'ค22102 ม.2/2', 'ค33202 ม.6/1', '', 'ค22102 ม.2/1', '', '', '', '', '', ''),
  (5, 'พฤหัสบดี',    'ค22102 ม.2/2', 'ค21102 ม.1/1', '', '', 'ค32102 ม.5/1', 'ค22102 ม.2/1', 'กิจกรรมลูกเสือ', 'PLC', '', ''),
  (6, 'ศุกร์',       'ธรรมนำใจ', 'ค21102 ม.1/1', 'ค33202 ม.6/1', '', '', '', 'ONET', '', '', ''),
  (7, 'เสาร์',       '', '', '', '', '', '', '', '', '', 'ใช้สำหรับกรณีสอนชดเชย');

-- ── SEED DATA: Settings ──────────────────────────────────────
INSERT INTO settings (key, value, description) VALUES
  ('LINE_TOKEN',    '(ใส่ Token ที่นี่)',          'ใช้สำหรับส่งข้อความทาง LINE'),
  ('LINE_USER_ID',  '(ใส่ User ID ที่นี่)',        'LINE User ID สำหรับ Push Notification'),
  ('SCHOOL_NAME',   'โรงเรียนกุงแก้ววิทยาคาร',     'ชื่อโรงเรียนสำหรับหัวข้อแจ้งเตือน'),
  ('TEACHER_NAME',  'ครูอี้',                       'ชื่อผู้ใช้งานสำหรับคำทักทาย')
ON CONFLICT (key) DO NOTHING;

-- ── ROW LEVEL SECURITY (RLS) ─────────────────────────────────
-- Disable RLS for service_role access from API (using anon key via .env)
ALTER TABLE master_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;

-- Allow all operations using service role (for API routes)
CREATE POLICY "service_role_all" ON master_schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON events          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON tasks           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON settings        FOR ALL USING (true) WITH CHECK (true);
