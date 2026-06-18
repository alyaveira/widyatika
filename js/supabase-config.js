/**
 * supabase-config.js — Widyatika
 * =============================================================================
 * Inisialisasi tunggal Supabase JS Client.
 * File ini adalah satu-satunya tempat kredensial Supabase disimpan.
 * Semua modul lain (auth.js, dashboard.js, game.js) mengimpor `supabase`
 * dari sini — JANGAN membuat instance baru di file lain.
 *
 * SETUP:
 *   1. Buka https://supabase.com → pilih proyek kamu → Settings → API
 *   2. Ganti SUPABASE_URL dengan nilai "Project URL"
 *   3. Ganti SUPABASE_ANON_KEY dengan nilai "anon public" key
 * =============================================================================
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ---------------------------------------------------------------------------
// KREDENSIAL PROYEK — Ganti dengan nilai dari dashboard Supabase kamu
// Jika kamu menggunakan .env lokal, jalankan `node scripts/generate-env-config.mjs`
// lalu file `js/env-config.js` akan di-load secara otomatis.
// ---------------------------------------------------------------------------
const FALLBACK_SUPABASE_URL      = 'https://cezzczjzwvnncvygmbog.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';


async function loadSupabaseEnv() {
  if (typeof window === 'undefined') return {};
  try {
    const envModule = await import('./env-config.js');
    return envModule.default ?? envModule.SUPABASE_ENV ?? {};
  } catch {
    return {};
  }
}

const envConfig = await loadSupabaseEnv();
const SUPABASE_URL = envConfig.SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY = envConfig.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Validasi awal — mencegah runtime error yang membingungkan
// ---------------------------------------------------------------------------
if (
  SUPABASE_URL.includes('YOUR_PROJECT_ID') ||
  SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_PUBLIC_KEY')
) {
  console.error(
    '[Widyatika] ⚠️ Supabase belum dikonfigurasi!\n' +
    'Buka js/supabase-config.js dan isi SUPABASE_URL serta SUPABASE_ANON_KEY.'
  );
}

// ---------------------------------------------------------------------------
// Buat & ekspor instance client (singleton)
// ---------------------------------------------------------------------------
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Siswa & guru di Widyatika tidak menggunakan Supabase Auth bawaan.
    // Session dikelola manual via sessionStorage. Matikan auto-refresh
    // agar tidak ada konflik token.
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Ekspor URL untuk keperluan diagnostik (opsional)
export const SUPABASE_PROJECT_URL = SUPABASE_URL;
