'use client';
// app/page.tsx
// Complete dashboard – 100% feature parity with original GAS index.html
// Uses Framer Motion for smooth tab transitions and row animations

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppData, TabId, Row, SavePayload, SaveResult } from '@/types';

// ── Constants ─────────────────────────────────────────────────
const DAYS_TH       = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const MONTHS_TH     = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const STATUS_TASK   = ['กำลังทำ','ยังไม่เริ่ม','เสร็จแล้ว','ยกเลิก'];
const STATUS_EVENT  = ['รอดำเนินการ','เสร็จแล้ว','ยกเลิก'];
const TYPE_EVENT    = ['ทำงาน','วันหยุด'];
const CAT_EVENT     = ['เวรประจำวัน','กิจกรรมพิเศษ','งานวิชาการ','การประชุม','วันหยุด','อื่นๆ'];
const CAT_TASK      = ['งานวิชาการ','โครงการ','งานส่วนตัว','อื่นๆ'];

// ── Date utilities ────────────────────────────────────────────
function parseDate(val: string | number | null | undefined): Date | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === '-') return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    let y = parseInt(iso[1]); if (y > 2500) y -= 543;
    const d = new Date(y, parseInt(iso[2])-1, parseInt(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = s.split('/');
  if (parts.length === 3) {
    let y = parseInt(parts[2]); if (y > 2500) y -= 543; if (y < 100) y += 2000;
    const d = new Date(y, parseInt(parts[1])-1, parseInt(parts[0]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDateKey(d: Date | null | undefined): string { return d ? formatDateISO(d) : ''; }
function formatDateTh(d: Date): string {
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear()+543}`;
}
function getDiffDays(val: string | number | null | undefined): number | null {
  const d = parseDate(val);
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const dt = new Date(d); dt.setHours(0,0,0,0);
  return Math.ceil((dt.getTime() - today.getTime()) / 86400000);
}
function esc(val: unknown): string {
  return String(val ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ val, type }: { val: string; type: 'task' | 'event' | 'eventtype' }) {
  const v = val.trim();
  if (type === 'task') {
    const map: Record<string,string> = { 'กำลังทำ':'s-doing','ยังไม่เริ่ม':'s-todo','เสร็จแล้ว':'s-done','ยกเลิก':'s-cancel' };
    return <span className={`status-badge ${map[v]||'s-default'}`}>{v||'–'}</span>;
  }
  if (type === 'event') {
    const map: Record<string,string> = { 'รอดำเนินการ':'s-doing','เสร็จแล้ว':'s-done','ยกเลิก':'s-cancel' };
    return <span className={`status-badge ${map[v]||'s-default'}`}>{v||'–'}</span>;
  }
  if (type === 'eventtype') {
    return v === 'วันหยุด'
      ? <span className="status-badge s-holiday">🎉 วันหยุด</span>
      : <span className="status-badge s-default">📌 {v||'ทำงาน'}</span>;
  }
  return <span className="status-badge s-default">{v}</span>;
}

// ═══════════════════════════════════════════════════════════════
//  LOADING OVERLAY
// ═══════════════════════════════════════════════════════════════
function LoadingOverlay({ hidden, error, onRetry }: { hidden: boolean; error: string | null; onRetry: () => void }) {
  return (
    <div className={`loading-overlay ${hidden ? 'hidden' : ''}`}>
      <div className="overlay-logo">📋</div>
      <div className="overlay-title">เลขาอี้</div>
      <div className="overlay-sub">กำลังเชื่อมต่อฐานข้อมูล...</div>
      <div className="overlay-bar"><div className="overlay-prog" /></div>
      {error && (
        <div className="overlay-err">
          <p>{error}</p>
          <button className="overlay-reload" onClick={onRetry}>🔄 โหลดใหม่</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ appData }: { appData: AppData }) {
  const today   = new Date();
  const tasks   = (appData.tasks ?? []).slice(1).filter(r => r[0] || r[2]);
  const events  = (appData.events ?? []).slice(1).filter(r => r[0]);
  const pending = tasks.filter(r => r[4] === 'กำลังทำ' || r[4] === 'ยังไม่เริ่ม');
  const overdue = pending.filter(r => { const d = getDiffDays(r[3] as string); return d !== null && d < 0; });
  const dueSoon = pending.filter(r => { const d = getDiffDays(r[3] as string); return d !== null && d >= 0 && d <= 5; });
  const done    = tasks.filter(r => r[4] === 'เสร็จแล้ว');

  const dayIdx   = today.getDay();
  const dayName  = DAYS_TH[dayIdx];
  const schedule = appData.schedule ?? [];
  const timeRow  = schedule[1] ?? [];
  const todayClasses: Array<{period:number;time:string;subject:string}> = [];
  for (let r = 2; r < schedule.length; r++) {
    if (String(schedule[r][0]).trim() === dayName) {
      for (let c = 1; c <= 10; c++) {
        const s = String(schedule[r][c] ?? '').trim();
        if (s) todayClasses.push({ period: c, time: String(timeRow[c] ?? ''), subject: s });
      }
      break;
    }
  }

  const todayStr    = formatDateKey(today);
  const todayEvents = events.filter(r => formatDateKey(parseDate(r[0] as string)) === todayStr && String(r[6]??'') !== 'ยกเลิก');
  const todayContent = todayClasses.length
    ? todayClasses.slice(0,3).map(c => `คาบ${c.period} ${c.subject}`).join(' · ') + (todayClasses.length > 3 ? ` +อีก ${todayClasses.length-3} คาบ` : '')
    : (dayIdx === 0 || dayIdx === 6 ? '🌿 วันหยุดสุดสัปดาห์' : 'ไม่มีคาบสอนวันนี้');

  const sortedTasks = pending
    .map(r => ({ r, diff: getDiffDays(r[3] as string) }))
    .filter(x => x.diff !== null)
    .sort((a,b) => (a.diff ?? 0) - (b.diff ?? 0))
    .slice(0, 10);

  const todayMs = new Date().setHours(0,0,0,0);
  const upcoming = events
    .map(r => ({ r, ms: (parseDate(r[0] as string)?.setHours(0,0,0,0) ?? null) }))
    .filter(x => x.ms !== null && x.ms >= todayMs && String(x.r[6]??'') !== 'ยกเลิก')
    .sort((a,b) => (a.ms??0) - (b.ms??0))
    .slice(0,5);

  return (
    <div>
      {/* Pills (shown in header – duplicated here for standalone display) */}
      <div className="today-strip" style={{background:'var(--primary-l)',border:'1px solid var(--border)',margin:'0 0 16px',backdropFilter:'none'}}>
        <h3 style={{opacity:1,color:'var(--text-m)'}}>📌 ภารกิจวันนี้</h3>
        <div className="today-content" style={{color:'var(--text)'}}>{todayContent}</div>
        <div className="today-pills" style={{marginTop:8}}>
          {todayClasses.length > 0 && <span className="pill" style={{background:'var(--primary)',color:'#fff'}}>📚 {todayClasses.length} คาบ</span>}
          {todayEvents.length > 0  && <span className="pill pill-yellow">📌 {todayEvents.length} กิจกรรม</span>}
          {overdue.length > 0      && <span className="pill pill-red">⚠️ {overdue.length} เลยกำหนด</span>}
          {dueSoon.length > 0      && <span className="pill pill-green">⏰ {dueSoon.length} ใกล้ส่ง</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { icon:'📚', val:todayClasses.length, lbl:'คาบสอนวันนี้',    color:'var(--primary)' },
          { icon:'📝', val:pending.length,      lbl:'งานค้างทั้งหมด',  color:'var(--warn)' },
          { icon:'⚠️', val:overdue.length,      lbl:'เลยกำหนดแล้ว',   color:'var(--danger)' },
          { icon:'✅', val:done.length,         lbl:'เสร็จแล้ว',       color:'var(--success)' },
        ].map((s,i) => (
          <motion.div key={i} className="stat-card" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="stat-lbl">{s.lbl}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="quick-bar">
        <h3>🚀 คำสั่งด่วน (พิมพ์ใน LINE บอท)</h3>
        <div className="quick-actions">
          {[['📅','วันนี้'],['🌙','พรุ่งนี้'],['📝','งานค้าง'],['📆','สรุปสัปดาห์'],['❓','ช่วยเหลือ']].map(([icon,cmd]) => (
            <button key={cmd} className="quick-btn" onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(() => showToastGlobal(`📋 คัดลอก "${cmd}" แล้ว!`));
              else showToastGlobal(`💬 พิมพ์ใน LINE: ${cmd}`);
            }}>{icon} {cmd}</button>
          ))}
        </div>
      </div>

      {/* Tasks near deadline */}
      <div className="section-title">⏰ งานที่ใกล้ครบกำหนด</div>
      <div className="card">
        <div className="card-body">
          {sortedTasks.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🎉</div><p>ไม่มีงานค้างครับ!</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>ชื่องาน</th><th>หมวดหมู่</th><th>สถานะ</th><th>คงเหลือ</th></tr></thead>
              <tbody>
                {sortedTasks.map(({r,diff},i) => (
                  <motion.tr key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}>
                    <td style={{padding:'10px 12px'}}>{String(r[2]??'')}</td>
                    <td style={{padding:'10px 12px'}}>{String(r[1]??'')}</td>
                    <td style={{padding:'10px 12px'}}><StatusBadge val={String(r[4]??'')} type="task" /></td>
                    <td style={{padding:'10px 12px'}}>
                      {(diff??0) < 0 ? <span className="status-badge s-cancel">เลย {Math.abs(diff??0)} วัน</span>
                       : (diff??0) === 0 ? <span className="status-badge s-doing">🔴 วันนี้!</span>
                       : (diff??0) <= 3  ? <span className="status-badge s-doing">อีก {diff} วัน</span>
                       :                   <span className="status-badge s-todo">อีก {diff} วัน</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Upcoming events */}
      <div className="section-title">📌 กิจกรรม/เวรที่กำลังจะมาถึง</div>
      <div className="card">
        <div className="card-body">
          {upcoming.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>ไม่มีกิจกรรมที่กำลังจะมาถึง</p></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>วันที่</th><th>รายละเอียด</th><th>ประเภท</th><th>สถานะ</th></tr></thead>
              <tbody>
                {upcoming.map(({r},i) => {
                  const d = parseDate(r[0] as string);
                  return (
                    <motion.tr key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}>
                      <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}>{d ? formatDateTh(d) : String(r[0]??'')}</td>
                      <td style={{padding:'10px 12px'}}>{String(r[2]??'')}</td>
                      <td style={{padding:'10px 12px'}}><StatusBadge val={String(r[4]??'')} type="eventtype" /></td>
                      <td style={{padding:'10px 12px'}}><StatusBadge val={String(r[6]??'')} type="event" /></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SCHEDULE TAB
// ═══════════════════════════════════════════════════════════════
function ScheduleTab({ appData, onSave }: { appData: AppData; onSave: (n: string, d: Row[], btn: HTMLButtonElement) => void }) {
  const [grid, setGrid] = useState<string[][]>(() =>
    (appData.schedule ?? []).map(r => Array.from({length:11}, (_,i) => String(r[i]??'')))
  );

  useEffect(() => {
    setGrid((appData.schedule ?? []).map(r => Array.from({length:11}, (_,i) => String(r[i]??''))));
  }, [appData.schedule]);

  const update = (ri: number, ci: number, v: string) => {
    setGrid(prev => prev.map((row,r) => r===ri ? row.map((c,ci2) => ci2===ci ? v : c) : row));
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📚 ตารางสอนประจำสัปดาห์</div>
        <button className="btn btn-sm btn-outline" onClick={() =>
          setGrid((appData.schedule ?? []).map(r => Array.from({length:11}, (_,i) => String(r[i]??''))))
        }>↺ รีเซ็ต</button>
      </div>
      <div className="card-body schedule-grid">
        <table className="schedule-table">
          <thead>
            <tr>
              <th>{grid[0]?.[0]??'วัน/คาบ'}</th>
              {Array.from({length:10},(_,i) => (
                <th key={i}>
                  {grid[0]?.[i+1]??String(i+1)}
                  <span className="time-header">{grid[1]?.[i+1]??''}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.slice(2).map((row, ri) => (
              <motion.tr key={ri} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:ri*0.04}}>
                <td className="day-header">{row[0]}</td>
                {Array.from({length:10},(_,ci) => (
                  <td key={ci}>
                    <input
                      className="sch-input"
                      value={row[ci+1]}
                      onChange={e => update(ri+2, ci+1, e.target.value)}
                      placeholder="-"
                    />
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={e => onSave('Master Schedule', grid, e.currentTarget as HTMLButtonElement)}>
          💾 บันทึกตารางสอน
        </button>
        <small style={{color:'var(--text-m)'}}>แก้ไขช่องได้เลย แล้วกดบันทึก</small>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  EVENTS TAB
// ═══════════════════════════════════════════════════════════════
function EventsTab({ appData, onSave }: { appData: AppData; onSave: (n: string, d: Row[], btn: HTMLButtonElement) => void }) {
  const [rows, setRows] = useState<string[][]>(() =>
    (appData.events ?? []).slice(1).filter(r => r[0]).map(r => Array.from({length:7},(_,i) => String(r[i]??'')))
  );

  useEffect(() => {
    setRows((appData.events ?? []).slice(1).filter(r => r[0]).map(r => Array.from({length:7},(_,i) => String(r[i]??''))));
  }, [appData.events]);

  const update = (ri: number, ci: number, v: string) => {
    setRows(prev => prev.map((row,r) => r===ri ? row.map((c,ci2) => ci2===ci ? v : c) : row));
  };
  const addRow = () => setRows(prev => [...prev, ['','','','','ทำงาน','3','รอดำเนินการ']]);
  const delRow = (i: number) => setRows(prev => prev.filter((_,ri) => ri !== i));

  const header: Row = ['วันที่ (ว/ด/ป)','หมวดหมู่งาน','รายละเอียดกิจกรรม / หน้าที่','เวลา','ประเภท','แจ้งเตือนล่วงหน้า (วัน)','สถานะ'];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📌 กิจกรรม / เวร / วันหยุด</div>
        <button className="btn btn-sm btn-success" onClick={addRow}>+ เพิ่มรายการ</button>
      </div>
      <div className="card-body">
        <table className="data-table">
          <thead><tr><th>วันที่</th><th>หมวดหมู่</th><th>รายละเอียด</th><th>เวลา</th><th>ประเภท</th><th>แจ้งเตือน(วัน)</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            <AnimatePresence>
              {rows.map((row, ri) => (
                <motion.tr key={ri} layout initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:.2}}>
                  <td><input className="cell-input" type="date" value={row[0]} onChange={e=>update(ri,0,e.target.value)} style={{minWidth:120}} /></td>
                  <td>
                    <select className="cell-select" value={row[1]} onChange={e=>update(ri,1,e.target.value)}>
                      <option value="">เลือก...</option>
                      {CAT_EVENT.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td><input className="cell-input" value={row[2]} onChange={e=>update(ri,2,e.target.value)} placeholder="รายละเอียด" /></td>
                  <td><input className="cell-input" value={row[3]} onChange={e=>update(ri,3,e.target.value)} placeholder="เวลา" style={{minWidth:80}} /></td>
                  <td>
                    <select className="cell-select" value={row[4]} onChange={e=>update(ri,4,e.target.value)}>
                      {TYPE_EVENT.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td><input className="cell-input" type="number" value={row[5]} onChange={e=>update(ri,5,e.target.value)} style={{minWidth:60}} /></td>
                  <td>
                    <select className="cell-select" value={row[6]} onChange={e=>update(ri,6,e.target.value)}>
                      {STATUS_EVENT.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td><button className="del-btn" onClick={()=>delRow(ri)} title="ลบ">🗑</button></td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={e => onSave('Event & Exception', [header, ...rows], e.currentTarget as HTMLButtonElement)}>💾 บันทึกกิจกรรม</button>
        <button className="btn btn-sm btn-success" onClick={addRow}>+ เพิ่มแถว</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TASKS TAB
// ═══════════════════════════════════════════════════════════════
function TasksTab({ appData, onSave }: { appData: AppData; onSave: (n: string, d: Row[], btn: HTMLButtonElement) => void }) {
  const [rows, setRows] = useState<string[][]>(() =>
    (appData.tasks ?? []).slice(1).filter(r => r[0]||r[2]).map(r => Array.from({length:6},(_,i) => String(r[i]??'')))
  );

  useEffect(() => {
    setRows((appData.tasks ?? []).slice(1).filter(r => r[0]||r[2]).map(r => Array.from({length:6},(_,i) => String(r[i]??''))));
  }, [appData.tasks]);

  const update = (ri: number, ci: number, v: string) => {
    setRows(prev => prev.map((row,r) => r===ri ? row.map((c,ci2) => ci2===ci ? v : c) : row));
  };
  const addRow = () => {
    const nextId = `T${String(rows.length + 1).padStart(3,'0')}`;
    setRows(prev => [...prev, [nextId,'','','','ยังไม่เริ่ม','']]);
  };
  const delRow = (i: number) => setRows(prev => prev.filter((_,ri) => ri !== i));

  const header: Row = ['ID งาน','หมวดหมู่','ชื่องาน / โปรเจกต์','กำหนดส่ง (Deadline)','สถานะ','หมายเหตุ','จำนวนวันคงเหลือ (Formula)'];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">⏰ Task Tracker – งานค้าง</div>
        <button className="btn btn-sm btn-success" onClick={addRow}>+ เพิ่มงาน</button>
      </div>
      <div className="card-body">
        <table className="data-table">
          <thead><tr><th>ID</th><th>หมวดหมู่</th><th>ชื่องาน / โปรเจกต์</th><th>กำหนดส่ง</th><th>สถานะ</th><th>หมายเหตุ</th><th>คงเหลือ</th><th></th></tr></thead>
          <tbody>
            <AnimatePresence>
              {rows.map((row, ri) => {
                const diff = getDiffDays(row[3]);
                const diffBadge = diff === null ? '–'
                  : diff < 0  ? <span className="status-badge s-cancel">เลย {Math.abs(diff)} วัน</span>
                  : diff === 0 ? <span className="status-badge s-doing">🔴 วันนี้</span>
                  : diff <= 3  ? <span className="status-badge s-doing">อีก {diff} วัน</span>
                  :              <span className="status-badge s-todo">อีก {diff} วัน</span>;
                return (
                  <motion.tr key={ri} layout initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:.2}}>
                    <td><input className="cell-input" value={row[0]} onChange={e=>update(ri,0,e.target.value)} style={{minWidth:70}} /></td>
                    <td>
                      <select className="cell-select" value={row[1]} onChange={e=>update(ri,1,e.target.value)}>
                        <option value="">เลือก...</option>
                        {CAT_TASK.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td><input className="cell-input" value={row[2]} onChange={e=>update(ri,2,e.target.value)} placeholder="ชื่องาน" style={{minWidth:160}} /></td>
                    <td><input className="cell-input" type="date" value={row[3]} onChange={e=>update(ri,3,e.target.value)} style={{minWidth:120}} /></td>
                    <td>
                      <select className="cell-select" value={row[4]} onChange={e=>update(ri,4,e.target.value)}>
                        {STATUS_TASK.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td><input className="cell-input" value={row[5]} onChange={e=>update(ri,5,e.target.value)} placeholder="หมายเหตุ" /></td>
                    <td style={{padding:'0 12px',whiteSpace:'nowrap'}}>{diffBadge}</td>
                    <td><button className="del-btn" onClick={()=>delRow(ri)} title="ลบ">🗑</button></td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={e => onSave('Task Tracker', [header, ...rows], e.currentTarget as HTMLButtonElement)}>💾 บันทึกงาน</button>
        <button className="btn btn-sm btn-success" onClick={addRow}>+ เพิ่มแถว</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS TAB
// ═══════════════════════════════════════════════════════════════
function SettingsTab({ appData, onSave }: { appData: AppData; onSave: (n: string, d: Row[], btn: HTMLButtonElement) => void }) {
  const rawRows = (appData.settings ?? []).slice(1);
  const [values, setValues] = useState<Record<string,string>>(() => {
    const m: Record<string,string> = {};
    rawRows.forEach(r => { m[String(r[0]??'')] = String(r[1]??''); });
    return m;
  });

  useEffect(() => {
    const m: Record<string,string> = {};
    (appData.settings ?? []).slice(1).forEach(r => { m[String(r[0]??'')] = String(r[1]??''); });
    setValues(m);
  }, [appData.settings]);

  const lineToken = values['LINE_TOKEN'] ?? '';
  const hasToken  = lineToken && lineToken !== '(ใส่ Token ที่นี่)' && lineToken.length > 10;

  const header: Row = ['รายการ','ค่าที่กำหนด','คำอธิบาย'];
  const buildData = (): Row[] => [
    header,
    ...rawRows.map(r => [String(r[0]??''), values[String(r[0]??'')] ?? String(r[1]??''), String(r[2]??'')])
  ];

  return (
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div className="card-header">
          <div className="card-title">⚙️ การตั้งค่าระบบ</div>
          <span className={`line-status ${hasToken ? 'ok' : 'warn'}`}>
            <span className={`line-dot ${hasToken ? 'ok' : 'warn'}`}></span>
            {hasToken ? 'LINE: เชื่อมต่อแล้ว' : 'LINE: ยังไม่ได้ตั้งค่า'}
          </span>
        </div>
        <div className="card-body">
          <table className="data-table">
            <thead><tr><th>รายการ</th><th>ค่าที่กำหนด</th><th>คำอธิบาย</th></tr></thead>
            <tbody>
              {rawRows.map((r,i) => (
                <tr key={i}>
                  <td style={{padding:'10px 12px',fontWeight:600,color:'var(--text)',whiteSpace:'nowrap'}}>{String(r[0]??'')}</td>
                  <td>
                    <input
                      className="cell-input"
                      value={values[String(r[0]??'')] ?? ''}
                      onChange={e => setValues(prev => ({...prev, [String(r[0]??'')]: e.target.value}))}
                      type={String(r[0]).includes('TOKEN') ? 'password' : 'text'}
                      placeholder={`(ใส่ ${r[0]} ที่นี่)`}
                    />
                  </td>
                  <td style={{padding:'10px 12px',color:'var(--text-m)',fontSize:'.8rem'}}>{String(r[2]??'')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={e => onSave('System Settings', buildData(), e.currentTarget as HTMLButtonElement)}>💾 บันทึกการตั้งค่า</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-header"><div className="card-title">🔧 เครื่องมือระบบ</div></div>
        <div style={{padding:'16px',display:'flex',gap:'10px',flexWrap:'wrap'}}>
          <a className="btn btn-outline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">🗄️ Supabase Dashboard</a>
          <a className="btn btn-outline" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">▲ Vercel Dashboard</a>
          <a className="btn btn-outline" href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">💬 LINE Console</a>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📖 คู่มือการใช้งาน</div></div>
        <div className="help-section">
          <p><strong>🚀 วิธีติดตั้งระบบ (ครั้งแรก):</strong></p>
          <ol>
            <li>สร้าง Supabase Project → รัน <code>schema.sql</code> ใน SQL Editor</li>
            <li>สร้าง Vercel Project → เชื่อม GitHub Repository</li>
            <li>ตั้งค่า Environment Variables ใน Vercel (ดูไฟล์ <code>.env.local.example</code>)</li>
            <li>Deploy → รอ Build เสร็จ → เปิดเว็บ Dashboard ✅</li>
            <li>ใส่ LINE Token ใน Settings → กด Verify ใน LINE Console</li>
          </ol>
          <p><strong>💬 คำสั่ง LINE Bot:</strong><br/>วันนี้ / พรุ่งนี้ / งานค้าง / สรุปสัปดาห์ / ช่วยเหลือ</p>
          <p style={{marginTop:12}}><strong>⏰ แจ้งเตือนอัตโนมัติ:</strong><br/>☀️ 06:30 น. – ตารางวันนี้ &nbsp;|&nbsp; 🌙 17:30 น. – เตรียมพรุ่งนี้</p>
          <p style={{marginTop:12}}><strong>📱 เพิ่มลงหน้าจอมือถือ (iPhone):</strong><br/>Safari → ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม"</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOAST (global)
// ═══════════════════════════════════════════════════════════════
let _toastFn: ((msg: string, type?: string) => void) | null = null;
function showToastGlobal(msg: string, type = 'success') { _toastFn?.(msg, type); }

function Toast() {
  const [state, setState] = useState<{msg:string;type:string;show:boolean}>({msg:'',type:'success',show:false});
  const timer = useRef<NodeJS.Timeout|null>(null);

  useEffect(() => {
    _toastFn = (msg, type='success') => {
      setState({msg,type,show:true});
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState(s => ({...s,show:false})), 3500);
    };
    return () => { _toastFn = null; };
  }, []);

  return (
    <div className={`toast ${state.show?'show':''} ${state.type}`}>{state.msg}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function Page() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [headerDate, setHeaderDate] = useState('');
  const [schoolName, setSchoolName] = useState('โรงเรียนกุงแก้ววิทยาคาร');
  const loadTimer = useRef<NodeJS.Timeout | null>(null);

  // Update header date
  useEffect(() => {
    const now = new Date();
    setHeaderDate(`วัน${DAYS_TH[now.getDay()]}\n${now.getDate()} ${MONTHS_TH[now.getMonth()]} ${now.getFullYear()+543}`);
  }, []);

  // Load data from API
  const loadData = useCallback(async () => {
    setOverlayError(null);
    setOverlayHidden(false);

    // 12-second timeout
    loadTimer.current = setTimeout(() => {
      setOverlayError('โหลดนานผิดปกติ อาจเกิดจาก Cold Start กรุณาลองใหม่');
    }, 12000);

    try {
      const res  = await fetch('/api/data', { cache: 'no-store' });
      const data = await res.json() as AppData;

      if (loadTimer.current) clearTimeout(loadTimer.current);

      if (!data || !data.schedule) throw new Error('ไม่ได้รับข้อมูลจาก Supabase');

      setAppData(data);
      setOverlayHidden(true);

      // Read school name from settings
      const schRow = (data.settings ?? []).slice(1).find(r => String(r[0]) === 'SCHOOL_NAME');
      if (schRow?.[1]) setSchoolName(String(schRow[1]));

    } catch (err) {
      if (loadTimer.current) clearTimeout(loadTimer.current);
      setOverlayError('โหลดไม่สำเร็จ: ' + String(err));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Save handler
  const handleSave = useCallback(async (sheetName: string, data: Row[], btn: HTMLButtonElement) => {
    const origText = btn.textContent ?? '';
    btn.textContent = '⏳ กำลังบันทึก...';
    btn.disabled    = true;

    try {
      const res    = await fetch('/api/data', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sheetName, data } as SavePayload),
      });
      const result = await res.json() as SaveResult;
      btn.textContent = origText;
      btn.disabled    = false;
      showToastGlobal(result.msg, result.ok ? 'success' : 'error');

      if (result.ok) {
        // Refresh data in background
        const r2 = await fetch('/api/data', { cache: 'no-store' });
        const fresh = await r2.json() as AppData;
        setAppData(fresh);
      }
    } catch (err) {
      btn.textContent = origText;
      btn.disabled    = false;
      showToastGlobal('❌ เกิดข้อผิดพลาด: ' + String(err), 'error');
    }
  }, []);

  // Pending tasks count (for badge)
  const pendingCount = appData
    ? (appData.tasks ?? []).slice(1).filter(r =>
        (r[0]||r[2]) && r[4] !== 'เสร็จแล้ว' && r[4] !== 'ยกเลิก'
      ).length
    : 0;

  const tabs: Array<{id: TabId; label: string; badge?: number}> = [
    { id: 'dashboard', label: '🏠 ภาพรวม' },
    { id: 'schedule',  label: '📚 ตารางสอน' },
    { id: 'events',    label: '📌 กิจกรรม/เวร' },
    { id: 'tasks',     label: '⏰ งานค้าง', badge: pendingCount },
    { id: 'settings',  label: '⚙️ ตั้งค่า' },
  ];

  const tabVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.22 } },
    exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
  };

  return (
    <>
      <LoadingOverlay hidden={overlayHidden} error={overlayError} onRetry={loadData} />
      <Toast />

      {/* Header */}
      <div className="header">
        <div className="header-top">
          <div className="logo">
            <div className="logo-icon">📋</div>
            <div className="logo-text">
              <h1>เลขาอี้</h1>
              <p>{schoolName}</p>
            </div>
          </div>
          <div className="header-date" style={{whiteSpace:'pre-line'}}>{headerDate}</div>
        </div>

        {appData && (() => {
          const today = new Date();
          const dayName = DAYS_TH[today.getDay()];
          const schedule = appData.schedule ?? [];
          const timeRow = schedule[1] ?? [];
          const todayClasses: string[] = [];
          for (let r = 2; r < schedule.length; r++) {
            if (String(schedule[r][0]).trim() === dayName) {
              for (let c = 1; c <= 10; c++) {
                const s = String(schedule[r][c]??'').trim();
                if (s) todayClasses.push(`คาบ${c} ${s}`);
              }
              break;
            }
          }
          const todayContent = todayClasses.length
            ? todayClasses.slice(0,3).join(' · ') + (todayClasses.length > 3 ? ` +${todayClasses.length-3} คาบ` : '')
            : (today.getDay()===0||today.getDay()===6 ? '🌿 วันหยุดสุดสัปดาห์' : 'ไม่มีคาบสอนวันนี้');

          const pending = (appData.tasks??[]).slice(1).filter(r=>(r[0]||r[2])&&r[4]!=='เสร็จแล้ว'&&r[4]!=='ยกเลิก');
          const overdue = pending.filter(r=>{ const d=getDiffDays(r[3] as string); return d!==null&&d<0; });
          const dueSoon = pending.filter(r=>{ const d=getDiffDays(r[3] as string); return d!==null&&d>=0&&d<=5; });
          const todayStr = formatDateKey(today);
          const events = (appData.events??[]).slice(1).filter(r=>r[0]);
          const todayEvents = events.filter(r=>formatDateKey(parseDate(r[0] as string))===todayStr&&String(r[6]??'')!=='ยกเลิก');

          return (
            <div className="today-strip">
              <h3>📌 ภารกิจวันนี้</h3>
              <div className="today-content">{todayContent}</div>
              <div className="today-pills">
                {todayClasses.length>0 && <span className="pill pill-blue">📚 {todayClasses.length} คาบ</span>}
                {todayEvents.length>0  && <span className="pill pill-yellow">📌 {todayEvents.length} กิจกรรม</span>}
                {overdue.length>0      && <span className="pill pill-red">⚠️ {overdue.length} เลยกำหนด</span>}
                {dueSoon.length>0      && <span className="pill pill-green">⏰ {dueSoon.length} ใกล้ส่ง</span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Nav tabs */}
      <div className="nav-wrap">
        <div className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.badge ? <span className="badge">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="main">
        <AnimatePresence mode="wait">
          {appData ? (
            <motion.div key={activeTab} variants={tabVariants} initial="initial" animate="animate" exit="exit">
              {activeTab === 'dashboard' && <DashboardTab appData={appData} />}
              {activeTab === 'schedule'  && <ScheduleTab  appData={appData} onSave={handleSave} />}
              {activeTab === 'events'    && <EventsTab    appData={appData} onSave={handleSave} />}
              {activeTab === 'tasks'     && <TasksTab     appData={appData} onSave={handleSave} />}
              {activeTab === 'settings'  && <SettingsTab  appData={appData} onSave={handleSave} />}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}} style={{textAlign:'center',padding:'40px',color:'var(--text-m)'}}>
              {overlayError ? null : <p>กำลังโหลดข้อมูล...</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
