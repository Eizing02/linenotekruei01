// lib/supabase.ts
// ── Supabase Client Setup ────────────────────────────────────
// Client-side: uses anon key (safe to expose)
// Server-side: uses service role key (full access, never expose to browser)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Client for browser use ───────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnon);

// ── Admin client for API Routes (server-only) ────────────────
export function getAdminClient() {
  if (!supabaseService) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(supabaseUrl, supabaseService, {
    auth: { persistSession: false }
  });
}
