/**
 * auth.js — Widyatika
 * =============================================================================
 * Modul Autentikasi & Session Guard.
 *
 * ARSITEKTUR SESSION:
 *   Widyatika TIDAK menggunakan Supabase Auth bawaan untuk siswa/guru karena:
 *   - Siswa menyimpan password_plain (bukan hash Auth Supabase)
 *   - Perangkat sekolah dipakai bergantian (isolasi sesi per-siswa)
 *
 *   Session disimpan di sessionStorage (otomatis terhapus saat tab ditutup)
 *   dengan kunci: 'widyatika_session'
 *
 * FORMAT OBJEK SESSION (ditulis oleh index.html setelah login berhasil):
 * {
 *   role: 'siswa' | 'guru',
 *   siswa: {                     // hanya ada jika role === 'siswa'
 *     id_siswa:       string,    // UUID dari tabel siswa
 *     nama_panggilan: string,
 *     total_skor:     number,
 *     id_kelas:       string,
 *   },
 *   guru: {                      // hanya ada jika role === 'guru'
 *     id_guru:       string,
 *     nama_lengkap:  string,
 *     email:         string,
 *   },
 *   sesi_game: {                 // hanya ada jika role === 'siswa'
 *     id_sesi:       string,     // UUID dari tabel sesi_game
 *     level_ke:      number,
 *     target_angka:  number,
 *     status_selesai: boolean,
 *   }
 * }
 * =============================================================================
 */

import { supabase } from './supabase-config.js';

// ---------------------------------------------------------------------------
// KONSTANTA
// ---------------------------------------------------------------------------
const SESSION_KEY          = 'widyatika_session';
const REDIRECT_LOGIN       = './index.html';
const REDIRECT_GAME        = './game.html';
const REDIRECT_DASHBOARD   = './dashboard.html';

// ---------------------------------------------------------------------------
// UTILITAS SESSION
// ---------------------------------------------------------------------------

/**
 * Ambil seluruh objek session yang tersimpan di sessionStorage.
 * @returns {object|null}
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Tulis objek session ke sessionStorage.
 * @param {object} sessionData
 */
export function setSession(sessionData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

/**
 * Hapus session (logout).
 */
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Perbarui sebagian data session (merge partial update).
 * @param {Partial<object>} partial
 */
export function patchSession(partial) {
  const current = getSession();
  if (current) setSession({ ...current, ...partial });
}

// ---------------------------------------------------------------------------
// GUARD FUNCTIONS
// (Dipanggil di awal setiap halaman yang membutuhkan autentikasi)
// ---------------------------------------------------------------------------

/**
 * Pastikan user adalah SISWA yang sudah login & memiliki sesi_game aktif.
 * Jika tidak, redirect ke halaman login.
 * @returns {object} Objek session yang valid
 */
export function requireSiswaSession() {
  const session = getSession();
  if (!session || session.role !== 'siswa' || !session.siswa || !session.sesi_game) {
    clearSession();
    window.location.replace(REDIRECT_LOGIN);
    throw new Error('[Auth] Sesi siswa tidak ditemukan. Redirect ke login.');
  }
  return session;
}

/**
 * Pastikan user adalah GURU yang sudah login.
 * @returns {object} Objek session yang valid
 */
export function requireGuruSession() {
  const session = getSession();
  if (!session || session.role !== 'guru' || !session.guru) {
    clearSession();
    window.location.replace(REDIRECT_LOGIN);
    throw new Error('[Auth] Sesi guru tidak ditemukan. Redirect ke login.');
  }
  return session;
}

/**
 * Jika sudah login, redirect dari halaman login ke halaman yang sesuai.
 * Dipanggil di index.html agar tidak bisa kembali ke login saat sudah masuk.
 */
export function redirectIfLoggedIn() {
  const session = getSession();
  if (!session) return;
  if (session.role === 'siswa') window.location.replace(REDIRECT_GAME);
  if (session.role === 'guru')  window.location.replace(REDIRECT_DASHBOARD);
}

// ---------------------------------------------------------------------------
// FUNGSI LOGIN SISWA
// ---------------------------------------------------------------------------

/**
 * Login siswa menggunakan username & password_plain.
 * Mencari data siswa di tabel `siswa`, lalu membuat sesi_game baru.
 *
 * @param {string} username
 * @param {string} passwordPlain
 * @param {number} [levelKe=1] - Level yang ingin dimainkan
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function loginSiswa(username, passwordPlain, levelKe = 1) {
  try {
    // 1. Cari siswa berdasarkan username
    const { data: siswaRows, error: fetchError } = await supabase
      .from('siswa')
      .select('id_siswa, nama_panggilan, password_plain, total_skor, id_kelas')
      .eq('username', username.trim().toLowerCase())
      .limit(1);

    if (fetchError) throw fetchError;
    if (!siswaRows || siswaRows.length === 0) {
      return { success: false, error: 'Username tidak ditemukan.' };
    }

    const siswa = siswaRows[0];

    // 2. Verifikasi password (plain text sesuai skema SKPL)
    if (siswa.password_plain !== passwordPlain) {
      return { success: false, error: 'Password salah. Coba lagi ya!' };
    }

    // 3. Tentukan target angka untuk level ini
    const targetAngka = generateTargetAngka(levelKe);

    // 4. Buat sesi_game baru (isolasi murni per siswa)
    const { data: sesiRows, error: sesiError } = await supabase
      .from('sesi_game')
      .insert({
        id_siswa:       siswa.id_siswa,
        level_ke:       levelKe,
        target_angka:   targetAngka,
        status_selesai: false,
      })
      .select('id_sesi, level_ke, target_angka, status_selesai')
      .single();

    if (sesiError) throw sesiError;

    // 5. Simpan session
    setSession({
      role: 'siswa',
      siswa: {
        id_siswa:       siswa.id_siswa,
        nama_panggilan: siswa.nama_panggilan,
        total_skor:     siswa.total_skor,
        id_kelas:       siswa.id_kelas,
      },
      sesi_game: {
        id_sesi:        sesiRows.id_sesi,
        level_ke:       sesiRows.level_ke,
        target_angka:   sesiRows.target_angka,
        status_selesai: sesiRows.status_selesai,
      },
    });

    return { success: true };

  } catch (err) {
    console.error('[Auth] loginSiswa error:', err);
    return { success: false, error: 'Gagal terhubung ke server. Periksa koneksi internet.' };
  }
}

// ---------------------------------------------------------------------------
// FUNGSI LOGIN GURU
// ---------------------------------------------------------------------------

/**
 * Login guru menggunakan email & password.
 * Cocokkan dengan kolom `password_hash` (untuk MVP bisa dibandingkan plain,
 * namun komentar menunjukkan tempat untuk upgrade ke bcrypt/server-side).
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function loginGuru(email, password) {
  try {
    const { data: guruRows, error } = await supabase
      .from('guru')
      .select('id_guru, nama_lengkap, email, password_hash')
      .eq('email', email.trim().toLowerCase())
      .limit(1);

    if (error) throw error;
    if (!guruRows || guruRows.length === 0) {
      return { success: false, error: 'Email guru tidak ditemukan.' };
    }

    const guru = guruRows[0];

    // CATATAN KEAMANAN: Di production, bandingkan hash menggunakan
    // Edge Function Supabase + bcrypt. Untuk MVP ini, simpan sebagai plain.
    if (guru.password_hash !== password) {
      return { success: false, error: 'Password salah.' };
    }

    setSession({
      role: 'guru',
      guru: {
        id_guru:      guru.id_guru,
        nama_lengkap: guru.nama_lengkap,
        email:        guru.email,
      },
    });

    return { success: true };

  } catch (err) {
    console.error('[Auth] loginGuru error:', err);
    return { success: false, error: 'Gagal terhubung ke server.' };
  }
}

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

/**
 * Logout universal — hapus session dan kembali ke login.
 */
export function logout() {
  clearSession();
  window.location.replace(REDIRECT_LOGIN);
}

// ---------------------------------------------------------------------------
// HELPER: Generate Target Angka per Level
// ---------------------------------------------------------------------------

/**
 * Hasilkan angka target berdasarkan level.
 * Level 1-3: mudah (10–30), Level 4-6: sedang (30–60), Level 7+: sulit (60–100).
 * @param {number} level
 * @returns {number}
 */
export function generateTargetAngka(level) {
  if (level <= 3)  return randomInt(10, 30);
  if (level <= 6)  return randomInt(30, 60);
  return randomInt(60, 100);
}

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
