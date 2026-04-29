// lib/lineBot.ts
// LINE Bot message logic – mirrors Code.gs sections 5-6 exactly

import { DAYS_TH, MONTHS_TH, formatDateTh, diffDays, parseDateToMs, dateOnly } from './dateUtils';
import type { AppData } from '@/types';

// ── Format daily summary message ────────────────────────────
export function formatMessage(title: string, data: DailyData): string {
  const lines: string[] = [title, '━━━━━━━━━━━━━━', `📅 ${data.dateDisplay} (${data.dayName})`];

  if (data.isHoliday) {
    lines.push('🎉 วันหยุด!');
    data.events.forEach(e => lines.push(`  📌 ${e.name} ${e.time ? '(' + e.time + ')' : ''}`));
  } else if (data.isWeekend) {
    lines.push('🌿 วันหยุดสุดสัปดาห์');
  } else {
    if (data.classes.length > 0) {
      lines.push(`📚 ตารางสอน (${data.classes.length} คาบ)`);
      data.classes.forEach(c => lines.push(`  คาบ${c.period} ${c.time ? '[' + c.time + ']' : ''} ${c.subject}`));
    } else {
      lines.push('📚 ไม่มีคาบสอนวันนี้');
    }

    if (data.duties.length > 0) {
      lines.push('', `📌 ภารกิจ (${data.duties.length} รายการ)`);
      data.duties.forEach(d => lines.push(`  • ${d.name} ${d.time ? '(' + d.time + ')' : ''}`));
    }
  }

  if (data.tasks.length > 0) {
    lines.push('', `⚠️ งานใกล้ครบกำหนด (${data.tasks.length} รายการ)`);
    data.tasks.forEach(t => {
      const badge = t.diffDays < 0 ? `⚠️[เลยมา ${Math.abs(t.diffDays)} วัน]`
                  : t.diffDays === 0 ? '🔴[วันนี้]'
                  : t.diffDays <= 3  ? '🟡[ด่วน]' : '🟢';
      lines.push(`  ${badge} ${t.name}`);
    });
  }

  return lines.join('\n');
}

export interface DailyData {
  dateDisplay: string;
  dayName: string;
  isHoliday: boolean;
  isWeekend: boolean;
  events: Array<{ name: string; time: string; type: string; category: string; status: string }>;
  duties: Array<{ name: string; time: string; type: string; category: string; status: string }>;
  classes: Array<{ period: number; time: string; subject: string }>;
  tasks: Array<{ name: string; diffDays: number; status: string; id: string }>;
}

// ── Build DailyData from AppData ─────────────────────────────
export function getDailyData(targetDate: Date, appData: AppData): DailyData {
  const dayIdx  = targetDate.getDay();
  const dayName = DAYS_TH[dayIdx];
  const targetMs = dateOnly(targetDate).getTime();
  const todayMs  = dateOnly(new Date()).getTime();

  const result: DailyData = {
    dateDisplay: formatDateTh(targetDate),
    dayName,
    isHoliday: false,
    isWeekend: dayIdx === 0 || dayIdx === 6,
    events: [], duties: [], classes: [], tasks: []
  };

  // Events / Duties / Holidays
  const evRows = appData.events ?? [];
  for (let i = 1; i < evRows.length; i++) {
    const row = evRows[i];
    if (!row[0]) continue;
    const rowMs  = parseDateToMs(row[0] as string);
    if (rowMs === null) continue;
    const status = String(row[6] ?? '').trim();
    if (rowMs === targetMs && status !== 'ยกเลิก') {
      const type   = String(row[4] ?? '').trim();
      const detail = {
        name: String(row[2] ?? ''), time: String(row[3] ?? ''),
        type, category: String(row[1] ?? ''), status
      };
      if (type === 'วันหยุด') { result.isHoliday = true; result.events.push(detail); }
      else { result.duties.push(detail); result.events.push(detail); }
    }
  }

  // Class schedule
  if (!result.isHoliday && !result.isWeekend) {
    const schRows = appData.schedule ?? [];
    const timeRow = schRows.length > 1 ? schRows[1] : [];
    for (let r = 2; r < schRows.length; r++) {
      if (String(schRows[r][0]).trim() === dayName) {
        for (let c = 1; c <= 10; c++) {
          const subj = String(schRows[r][c] ?? '').trim();
          if (subj) result.classes.push({ period: c, time: String(timeRow[c] ?? '').trim(), subject: subj });
        }
        break;
      }
    }
  }

  // Pending tasks
  const taskRows = appData.tasks ?? [];
  for (let t = 1; t < taskRows.length; t++) {
    const tr = taskRows[t];
    if (!tr[0] && !tr[2]) continue;
    const tstatus = String(tr[4] ?? '').trim();
    if (tstatus === 'เสร็จแล้ว' || tstatus === 'ยกเลิก') continue;
    const deadlineMs = parseDateToMs(tr[3] as string);
    if (!deadlineMs) continue;
    const diff = Math.ceil((deadlineMs - todayMs) / 86400000);
    if (diff <= 5) {
      result.tasks.push({ name: String(tr[2] ?? ''), diffDays: diff, status: tstatus, id: String(tr[0] ?? '') });
    }
  }

  return result;
}

// ── Handle chatbot commands ──────────────────────────────────
export function handleCommand(text: string, appData: AppData): string {
  const cmd = text.toLowerCase().trim();

  if (cmd === 'วันนี้') {
    return formatMessage('📅 ตารางวันนี้', getDailyData(new Date(), appData));
  }
  if (cmd === 'พรุ่งนี้') {
    const tm = new Date(); tm.setDate(tm.getDate() + 1);
    return formatMessage('📅 ตารางพรุ่งนี้', getDailyData(tm, appData));
  }
  if (cmd === 'งานค้าง' || cmd === 'งาน') {
    return getTasksSummary(appData);
  }
  if (cmd === 'สรุปสัปดาห์' || cmd === 'อาทิตย์นี้') {
    return getWeekSummary(appData);
  }
  if (cmd === 'ช่วยเหลือ' || cmd === 'help' || cmd === '?') {
    return getHelpMessage();
  }

  return '🤖 สวัสดีครับ! คำสั่งที่ใช้ได้:\n• "วันนี้" – ตารางสอนและภารกิจวันนี้\n• "พรุ่งนี้" – ตารางพรุ่งนี้\n• "งานค้าง" – รายการงานที่ยังไม่เสร็จ\n• "สรุปสัปดาห์" – ภาพรวมอาทิตย์นี้\n• "ช่วยเหลือ" – แสดงคำสั่งทั้งหมด';
}

function getTasksSummary(appData: AppData): string {
  const taskRows = appData.tasks ?? [];
  const todayMs  = dateOnly(new Date()).getTime();
  const pending: Array<{ name: string; diffDays: number; status: string; id: string }> = [];
  let done = 0;

  for (let t = 1; t < taskRows.length; t++) {
    const tr = taskRows[t];
    if (!tr[0] && !tr[2]) continue;
    const status = String(tr[4] ?? '').trim();
    if (status === 'เสร็จแล้ว') { done++; continue; }
    if (status === 'ยกเลิก') continue;
    const deadlineMs = parseDateToMs(tr[3] as string);
    const diff = deadlineMs ? Math.ceil((deadlineMs - todayMs) / 86400000) : 999;
    pending.push({ name: String(tr[2] ?? ''), diffDays: diff, status, id: String(tr[0] ?? '') });
  }

  if (pending.length === 0) return `🎉 ไม่มีงานค้างเลยครับ! สบายใจได้เลย ✨\n(เสร็จไปแล้ว ${done} งาน)`;

  pending.sort((a, b) => a.diffDays - b.diffDays);
  const lines = [`📝 งานค้างทั้งหมด ${pending.length} รายการ:`, ''];
  pending.forEach(task => {
    const badge    = task.diffDays < 0 ? '⚠️[เลยกำหนด]' : task.diffDays === 0 ? '🔴[วันนี้]' : task.diffDays <= 3 ? '🟡[ด่วน]' : '🟢';
    const daysText = task.diffDays < 0 ? `เลยมา ${Math.abs(task.diffDays)} วัน` : `อีก ${task.diffDays} วัน`;
    lines.push(`${badge} ${task.name} (${daysText})`);
  });
  lines.push('', `✅ เสร็จแล้ว ${done} งาน`);
  return lines.join('\n');
}

function getWeekSummary(appData: AppData): string {
  const lines  = ['📆 สรุปตารางสัปดาห์นี้', '━━━━━━━━━━━━━━'];
  const today  = new Date();
  const dow    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  for (let d = 0; d < 5; d++) {
    const day  = new Date(monday);
    day.setDate(monday.getDate() + d);
    const data = getDailyData(day, appData);
    const mark = data.isHoliday ? '🎉' : data.classes.length === 0 ? '😌' : '📚';
    lines.push(`${mark} ${DAYS_TH[day.getDay()]} ${day.getDate()} ${MONTHS_TH[day.getMonth()]} – ${
      data.isHoliday ? 'วันหยุด' : `${data.classes.length} คาบ${data.duties.length > 0 ? ' + ' + data.duties.length + ' กิจกรรม' : ''}`}`);
  }

  return lines.join('\n');
}

function getHelpMessage(): string {
  return '📖 คู่มือเลขาอี้ V.2\n━━━━━━━━━━━━━━\n📅 ดูตาราง:\n  • วันนี้ / พรุ่งนี้ / สรุปสัปดาห์\n\n📝 งาน:\n  • งานค้าง\n\n❓ ช่วยเหลือ:\n  • ช่วยเหลือ / help\n\n⏰ แจ้งเตือนอัตโนมัติ:\n  • ☀️ 06:30 น. – ตารางวันนี้\n  • 🌙 17:30 น. – เตรียมพรุ่งนี้\n\n🌐 จัดการข้อมูล: ผ่าน เลขาอี้ Dashboard';
}

// ── Send LINE push message ───────────────────────────────────
export async function pushMessage(token: string, userId: string, text: string): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] })
  });
  if (!res.ok) throw new Error(`LINE push failed: ${res.status}`);
}

// ── Send LINE reply message ──────────────────────────────────
export async function replyMessage(token: string, replyToken: string, text: string): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] })
  });
  if (!res.ok) throw new Error(`LINE reply failed: ${res.status}`);
}
