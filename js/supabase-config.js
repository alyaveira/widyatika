import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ============================================================
//  KREDENSIAL SUPABASE — Ambil dari dashboard Supabase Anda
// ============================================================
const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';  // ← HAPUS /rest/v1
const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';

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