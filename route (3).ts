// app/api/cron/evening/route.ts
// Scheduled: 17:30 Thai time (10:30 UTC) – "เตรียมพรุ่งนี้"
// Vercel Cron: "30 10 * * *"

import { NextRequest, NextResponse } from 'next/server';
import { getDailyData, formatMessage, pushMessage } from '@/lib/lineBot';
import type { AppData } from '@/types';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (process.env.CRON_SECRET && secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const res = await fetch(`${base}/api/data`, { cache: 'no-store' });
    const appData: AppData = await res.json();

    const lineToken  = getSettingValue(appData.settings, 'LINE_TOKEN');
    const lineUserId = getSettingValue(appData.settings, 'LINE_USER_ID');

    if (!lineToken || lineToken === '(ใส่ Token ที่นี่)' || !lineUserId || lineUserId === '(ใส่ User ID ที่นี่)') {
      return NextResponse.json({ ok: false, msg: 'LINE not configured' });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const data = getDailyData(tomorrow, appData);
    const msg  = formatMessage('🌙 เตรียมพร้อมสำหรับพรุ่งนี้', data);

    await pushMessage(lineToken, lineUserId, msg);
    return NextResponse.json({ ok: true, msg: '✅ Evening alert sent!' });

  } catch (err) {
    console.error('Evening cron error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

function getSettingValue(settings: (string | number | null)[][], key: string): string {
  const row = settings.slice(1).find(r => String(r[0]).trim() === key);
  return row ? String(row[1] ?? '').trim() : '';
}
