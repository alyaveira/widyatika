import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ============================================================
//  KREDENSIAL SUPABASE — Ambil dari dashboard Supabase Anda
// ============================================================
const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
const SUPABASE_ANON_KEY = 'https://cezzczjzwvnncvygmbog.supabase.co/rest/v1/';

// ============================================================
//  CLIENT SUPABASE (SINGLETON)
// ============================================================
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;