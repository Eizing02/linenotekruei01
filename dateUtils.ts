// lib/dateUtils.ts
// Thai date helpers – mirrors Code.gs utility functions exactly

export const DAYS_TH   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
export const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

/** แปลง Date เป็น YYYY-MM-DD */
export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** แปลง Date เป็น วันที่ไทย เช่น "1 ม.ค. 2568" */
export function formatDateTh(d: Date): string {
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** รับวันที่เป็น Date object โดยตัด time ออก */
export function dateOnly(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** แปลง string/Date → timestamp (ms) */
export function parseDateToMs(val: string | Date | null | undefined): number | null {
  if (!val) return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : dateOnly(val).getTime();
  }

  const str = String(val).trim();
  if (!str || str === '-') return null;

  // YYYY-MM-DD
  const dashM = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dashM) {
    let y = parseInt(dashM[1], 10);
    if (y > 2500) y -= 543;
    return dateOnly(new Date(y, parseInt(dashM[2], 10) - 1, parseInt(dashM[3], 10))).getTime();
  }

  // DD/MM/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    let y = parseInt(parts[2], 10);
    if (y > 2500) y -= 543;
    return dateOnly(new Date(y, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))).getTime();
  }

  return null;
}

/** คำนวณวันคงเหลือจากวันนี้ (ค่าลบ = เลยกำหนด) */
export function diffDays(val: string | Date | null | undefined): number | null {
  const ms = parseDateToMs(val);
  if (ms === null) return null;
  const today = dateOnly(new Date()).getTime();
  return Math.ceil((ms - today) / 86400000);
}
