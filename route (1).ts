// app/api/webhook/line/route.ts
// LINE Bot webhook – mirrors Code.gs doPost() exactly
// Handles: verify (empty events), dummy replyToken (0000...), and real messages

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import { handleCommand, replyMessage } from '@/lib/lineBot';
import type { AppData } from '@/types';

// Quick 200 OK helper (same as GAS _jsonOk)
const ok200 = () => NextResponse.json({ status: 'ok' }, { status: 200 });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── FIX 1: Intercept LINE verify (empty events array) ────
    if (!body.events || body.events.length === 0) return ok200();

    const event = body.events[0];

    // ── Only process text messages ────────────────────────────
    if (!event || event.type !== 'message' || !event.message || event.message.type !== 'text') {
      return ok200();
    }

    // ── FIX 2: Intercept dummy replyToken (starts with 00000) ─
    const token = String(event.replyToken ?? '');
    if (!token || token.startsWith('00000')) return ok200();

    const text = String(event.message.text ?? '').trim();
    if (!text) return ok200();

    // ── Fetch data from Supabase ──────────────────────────────
    const appData = await fetchAllData();

    // ── Get LINE token from settings ──────────────────────────
    const lineToken = getSettingValue(appData.settings, 'LINE_TOKEN');
    if (!lineToken || lineToken === '(ใส่ Token ที่นี่)') {
      console.warn('LINE_TOKEN not configured');
      return ok200();
    }

    // ── Handle command and reply ──────────────────────────────
    const msg = handleCommand(text, appData);
    await replyMessage(lineToken, token, msg);

  } catch (err) {
    console.error('LINE webhook error:', err);
  }

  return ok200();
}

// ── Fetch all data from Supabase ─────────────────────────────
async function fetchAllData(): Promise<AppData> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const res = await fetch(`${base}/api/data`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json() as Promise<AppData>;
}

function getSettingValue(settings: (string | number | null)[][], key: string): string {
  const row = settings.slice(1).find(r => String(r[0]).trim() === key);
  return row ? String(row[1] ?? '').trim() : '';
}
