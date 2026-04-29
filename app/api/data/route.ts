// app/api/data/route.ts
// GET  → returns all 4 tables as 2D arrays (same format as GAS getAllData)
// POST → saves a table (same contract as GAS saveData)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import type { Row, SavePayload } from '@/types';

// ─── Helper: convert DB rows to 2D array ─────────────────────
function scheduleToGrid(rows: any[]): Row[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  return sorted.map((r: any) => [r.col0, r.col1, r.col2, r.col3, r.col4, r.col5, r.col6, r.col7, r.col8, r.col9, r.col10]);
}

function eventsToGrid(rows: any[]): Row[] {
  const header: Row = ['วันที่ (ว/ด/ป)', 'หมวดหมู่งาน', 'รายละเอียดกิจกรรม / หน้าที่', 'เวลา', 'ประเภท', 'แจ้งเตือนล่วงหน้า (วัน)', 'สถานะ'];
  const data: any[] = rows.map((r: any) => [
    r.event_date ? String(r.event_date) : '',
    String(r.category ?? ''),
    String(r.detail ?? ''),
    String(r.event_time ?? ''),
    String(r.event_type ?? 'ทำงาน'),
    r.alert_days ?? 3,
    String(r.status ?? 'รอดำเนินการ')
  ]);
  return [header, ...data];
}

function tasksToGrid(rows: Record<string, unknown>[]): Row[] {
  const header: Row = ['ID งาน', 'หมวดหมู่', 'ชื่องาน / โปรเจกต์', 'กำหนดส่ง (Deadline)', 'สถานะ', 'หมายเหตุ', 'จำนวนวันคงเหลือ (Formula)'];
  const data: any[] = rows.map((r: any) => [
    String(r.task_id ?? ''),
    String(r.category ?? ''),
    String(r.name ?? ''),
    r.deadline ? String(r.deadline) : '',
    String(r.status ?? 'ยังไม่เริ่ม'),
    String(r.notes ?? ''),
    ''  // computed on client
  ]);
  return [header, ...data];
}

function settingsToGrid(rows: Record<string, unknown>[]): Row[] {
  const header: Row = ['รายการ', 'ค่าที่กำหนด', 'คำอธิบาย'];
  const data: any[] = rows.map((r: any) => [String(r.key ?? ''), String(r.value ?? ''), String(r.description ?? '')]);
  return [header, ...data];
}

// ─── GET: fetch all data ─────────────────────────────────────
export async function GET() {
  try {
    const db = getAdminClient();

    const [{ data: schData }, { data: evData }, { data: tkData }, { data: stData }] = await Promise.all([
      db.from('master_schedule').select('*').order('sort_order'),
      db.from('events').select('*').order('event_date', { ascending: true }),
      db.from('tasks').select('*').order('created_at'),
      db.from('settings').select('*'),
    ]);

    return NextResponse.json({
      schedule: scheduleToGrid((schData ?? []) as any[]),
      events:   eventsToGrid((evData ?? []) as Record<string, unknown>[]),
      tasks:    tasksToGrid((tkData ?? []) as Record<string, unknown>[]),
      settings: settingsToGrid((stData ?? []) as Record<string, unknown>[]),
    });
  } catch (err) {
    console.error('GET /api/data error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด: ' + String(err) }, { status: 500 });
  }
}

// ─── POST: save data ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SavePayload;
    const { sheetName, data } = body;

    if (!sheetName || !data) {
      return NextResponse.json({ ok: false, msg: '❌ ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const db = getAdminClient();

    if (sheetName === 'Master Schedule') {
      await db.from('master_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const rows = data.map((row, i) => ({
        sort_order: i,
        col0: String(row[0] ?? ''), col1: String(row[1] ?? ''),
        col2: String(row[2] ?? ''), col3: String(row[3] ?? ''),
        col4: String(row[4] ?? ''), col5: String(row[5] ?? ''),
        col6: String(row[6] ?? ''), col7: String(row[7] ?? ''),
        col8: String(row[8] ?? ''), col9: String(row[9] ?? ''),
        col10: String(row[10] ?? ''),
      }));
      const { error } = await db.from('master_schedule').insert(rows);
      if (error) throw error;
    }

    else if (sheetName === 'Event & Exception') {
      await db.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const dataRows = data.slice(1).filter(r => r[0] || r[2]);
      if (dataRows.length > 0) {
        const rows = dataRows.map(row => ({
          event_date: row[0] ? String(row[0]) : null,
          category:   String(row[1] ?? ''),
          detail:     String(row[2] ?? ''),
          event_time: String(row[3] ?? ''),
          event_type: String(row[4] ?? 'ทำงาน'),
          alert_days: row[5] ? Number(row[5]) : 3,
          status:     String(row[6] ?? 'รอดำเนินการ'),
        }));
        const { error } = await db.from('events').insert(rows);
        if (error) throw error;
      }
    }

    else if (sheetName === 'Task Tracker') {
      await db.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const dataRows = data.slice(1).filter(r => r[0] || r[2]);
      if (dataRows.length > 0) {
        const rows = dataRows.map(row => ({
          task_id:  String(row[0] ?? ''),
          category: String(row[1] ?? ''),
          name:     String(row[2] ?? ''),
          deadline: row[3] ? String(row[3]) : null,
          status:   String(row[4] ?? 'ยังไม่เริ่ม'),
          notes:    String(row[5] ?? ''),
        }));
        const { error } = await db.from('tasks').insert(rows);
        if (error) throw error;
      }
    }

    else if (sheetName === 'System Settings') {
      const dataRows = data.slice(1).filter(r => r[0]);
      for (const row of dataRows) {
        await db.from('settings').upsert({ key: String(row[0]), value: String(row[1] ?? ''), description: String(row[2] ?? '') }, { onConflict: 'key' });
      }
    }

    return NextResponse.json({ ok: true, msg: `✅ บันทึก "${sheetName}" สำเร็จแล้วครับ!` });

  } catch (err) {
    console.error('POST /api/data error:', err);
    return NextResponse.json({ ok: false, msg: '❌ เกิดข้อผิดพลาด: ' + String(err) }, { status: 500 });
  }
}
