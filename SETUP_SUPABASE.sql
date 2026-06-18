-- ============================================================================
-- WIDYATIKA — SQL Insert Script untuk Supabase
-- ============================================================================
-- Jalankan script ini di Supabase SQL Editor untuk membuat sample data
-- ============================================================================

-- 1. INSERT DATA GURU
INSERT INTO guru (nama_lengkap, email, password_hash) VALUES
('Pujianti', 'pujianti@sekolah.id', '123456');

-- 2. INSERT DATA KELAS (Sesuaikan id_guru dengan UUID guru yang dibuat)
-- Ganti 'UUID_GURU_PUJIANTI' dengan UUID nyata dari tabel guru setelah insert
-- Cara: SELECT id_guru FROM guru WHERE email = 'pujianti@sekolah.id';
INSERT INTO kelas (id_guru, nama_kelas, tahun_ajaran) VALUES
-- Ganti dengan UUID guru Pujianti yang sebenarnya:
-- Contoh: ('550e8400-e29b-41d4-a716-446655440001', 'Kelas 4-A', '2024/2025');
-- Untuk sekarang, gunakan placeholder dan update manual setelah dapat UUID
('00000000-0000-0000-0000-000000000001', 'Kelas 4-A', '2024/2025'),
('00000000-0000-0000-0000-000000000001', 'Kelas 4-B', '2024/2025');

-- 3. INSERT DATA SISWA (Ganti id_kelas dengan UUID kelas yang sebenarnya)
INSERT INTO siswa (id_kelas, username, password_plain, nama_panggilan, total_skor) VALUES
-- Format: ('UUID_KELAS', 'username', 'password', 'nama_panggilan', skor)
-- Contoh:
('00000000-0000-0000-0000-000000000010', 'alya.001', '1234', 'Alya', 125),
('00000000-0000-0000-0000-000000000010', 'daffa.002', '5678', 'Daffa', 98),
('00000000-0000-0000-0000-000000000010', 'maya.003', '9012', 'Maya', 142),
('00000000-0000-0000-0000-000000000011', 'rafi.004', '3456', 'Rafi', 87),
('00000000-0000-0000-0000-000000000011', 'salsa.005', '7890', 'Salsa', 156);

-- 4. INSERT DATA SESI_GAME (Ganti id_siswa dengan UUID siswa yang sebenarnya)
INSERT INTO sesi_game (id_siswa, level_ke, target_angka, status_selesai) VALUES
-- Format: ('UUID_SISWA', level, target_angka, status)
-- Contoh:
('00000000-0000-0000-0000-000000000020', 1, 15, true),
('00000000-0000-0000-0000-000000000020', 2, 28, false),
('00000000-0000-0000-0000-000000000021', 1, 20, true),
('00000000-0000-0000-0000-000000000022', 1, 12, true);

-- ============================================================================
-- INSTRUKSI PENGGUNAAN:
-- ============================================================================
-- 1. STEP 1: Insert guru terlebih dahulu (baris di atas sudah siap)
--    Jalankan bagian "INSERT DATA GURU" saja dulu
--
-- 2. STEP 2: Setelah guru berhasil diinput, ambil UUID-nya:
--    SELECT id_guru FROM guru WHERE email = 'pujianti@sekolah.id';
--    Copy UUID tersebut (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
--
-- 3. STEP 3: Ganti placeholder UUID di bagian INSERT KELAS:
--    Ganti '00000000-0000-0000-0000-000000000001' dengan UUID guru Pujianti
--    Jalankan bagian "INSERT DATA KELAS"
--
-- 4. STEP 4: Ambil UUID kelas yang baru dibuat:
--    SELECT id_kelas FROM kelas WHERE nama_kelas IN ('Kelas 4-A', 'Kelas 4-B');
--    Copy UUID kelas 4-A dan 4-B
--
-- 5. STEP 5: Ganti placeholder UUID di bagian INSERT SISWA:
--    '00000000-0000-0000-0000-000000000010' = UUID Kelas 4-A
--    '00000000-0000-0000-0000-000000000011' = UUID Kelas 4-B
--    Jalankan bagian "INSERT DATA SISWA"
--
-- 6. STEP 6: Ambil UUID siswa yang baru dibuat:
--    SELECT id_siswa FROM siswa ORDER BY created_at DESC LIMIT 5;
--
-- 7. STEP 7: Ganti placeholder UUID di bagian INSERT SESI_GAME:
--    '00000000-0000-0000-0000-000000000020' = UUID Alya
--    '00000000-0000-0000-0000-000000000021' = UUID Daffa
--    '00000000-0000-0000-0000-000000000022' = UUID Maya
--    Jalankan bagian "INSERT DATA SESI_GAME"
--
-- ATAU, bisa manual: Tambahkan kelas/siswa langsung dari aplikasi di
-- halaman "Manajemen Kelas" setelah login sebagai guru Pujianti!
-- ============================================================================
