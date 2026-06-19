import { supabase } from './supabase-config.js';
import { initGuruPage, showToast } from './guru.js';

// ========== LEVEL PERMAINAN (dipilih guru sebelum siswa mulai main) ==========
// Level 1: 0–20 | Level 2: 21–100 | Level 3: 101–500 | Level 4: 501–1000
const LEVEL_TARGET_RANGES = {
  1: [0, 20],
  2: [21, 100],
  3: [101, 500],
  4: [501, 1000],
};

function generateTargetByLevel(level) {
  const [min, max] = LEVEL_TARGET_RANGES[level] || LEVEL_TARGET_RANGES[1];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


const session = initGuruPage('manajemen');
const guruId = session.guru.id_guru;

// State
let kelasList = [];
let siswaList = [];
let sesiList = [];
let strategiList = [];
let selectedClassId = null;
let editingKelasId = null;
let editingSiswaId = null;

// DOM refs (menyesuaikan dengan struktur terbaru manajemen-kelas.html)
const modeDaftar = document.getElementById('modeDaftar');
const modeDetail = document.getElementById('modeDetail');
const kelasGrid = document.getElementById('kelasGrid');
const tbodyStudents = document.getElementById('tbodyStudents');
const detailNamaKelas = document.getElementById('detailNamaKelas');
const detailMetaKelas = document.getElementById('detailMetaKelas');
const btnBackDaftar = document.getElementById('btnBackDaftar');
const btnTambahKelas = document.getElementById('btnTambahKelas');
const btnTambahSiswa = document.getElementById('btnTambahSiswa');
const btnEditKelas = document.getElementById('btnEditKelas');

// Modal Kelas
const modalKelas = document.getElementById('modalKelas');
const modalKelasTitle = document.getElementById('modalKelasTitle');
const inputNamaKelas = document.getElementById('inputNamaKelas');
const inputTingkat = document.getElementById('inputTingkat');
const inputWarna = document.querySelectorAll('input[name="warna"]');
const editKelasId = document.getElementById('editKelasId');
const btnSubmitKelas = document.getElementById('btnSubmitKelas');
const btnCancelModalKelas = document.getElementById('btnCancelModalKelas');
const btnCloseModalKelas = document.getElementById('btnCloseModalKelas');

// Modal Siswa
const modalSiswa = document.getElementById('modalSiswa');
const modalSiswaTitle = document.getElementById('modalSiswaTitle');
const inputNISN = document.getElementById('inputNISN');
const inputNamaSiswa = document.getElementById('inputNamaSiswa');
const inputPanggilan = document.getElementById('inputPanggilan');
const inputPinSiswa = document.getElementById('inputPinSiswa');
const editSiswaId = document.getElementById('editSiswaId');
const siswaKelasId = document.getElementById('siswaKelasId');
const btnSubmitSiswa = document.getElementById('btnSubmitSiswa');
const btnCancelModalSiswa = document.getElementById('btnCancelModalSiswa');
const btnCloseModalSiswa = document.getElementById('btnCloseModalSiswa');

// Modal Pilih Level
const modalLevel = document.getElementById('modalLevel');
const btnCancelModalLevel = document.getElementById('btnCancelModalLevel');
const btnCloseModalLevel = document.getElementById('btnCloseModalLevel');
let pendingPlaySiswaId = null;

// ========== LOAD DATA ==========
async function loadAllData() {
  try {
    // Kelas
    const { data: kelas, error: kelasErr } = await supabase
      .from('kelas')
      .select('*')
      .eq('id_guru', guruId);
    if (kelasErr) throw kelasErr;
    kelasList = kelas || [];

    // Siswa
    const kelasIds = kelasList.map(k => k.id_kelas);
    let siswa = [];
    if (kelasIds.length > 0) {
      const { data: s, error: sErr } = await supabase
        .from('siswa')
        .select('*')
        .in('id_kelas', kelasIds);
      if (sErr) throw sErr;
      siswa = s || [];
    }
    siswaList = siswa;

    // Sesi
    const siswaIds = siswaList.map(s => s.id_siswa);
    let sesi = [];
    if (siswaIds.length > 0) {
      const { data: se, error: seErr } = await supabase
        .from('sesi_game')
        .select('*')
        .in('id_siswa', siswaIds);
      if (seErr) throw seErr;
      sesi = se || [];
    }
    sesiList = sesi;

    // Strategi
    const sesiIds = sesiList.map(s => s.id_sesi);
    let strategi = [];
    if (sesiIds.length > 0) {
      const { data: st, error: stErr } = await supabase
        .from('detail_strategi')
        .select('*')
        .in('id_sesi', sesiIds);
      if (stErr) throw stErr;
      strategi = st || [];
    }
    strategiList = strategi;

    // Jika datang dari card "Kelas Saya" di dashboard (?kelas=ID), langsung
    // tampilkan halaman detail kelas tersebut tanpa menampilkan daftar kelas.
    const urlParams = new URLSearchParams(window.location.search);
    const kelasIdParam = urlParams.get('kelas');
    if (kelasIdParam && kelasList.find(k => k.id_kelas === kelasIdParam)) {
      openDetail(kelasIdParam);
    } else {
      renderDaftar();
    }
  } catch (err) {
    console.error('[Kelas] Load data error:', err);
    showToast('Gagal memuat data.', 'error');
  }
}

// ========== RENDER DAFTAR KELAS ==========
function renderDaftar() {
  modeDaftar.style.display = 'block';
  modeDetail.style.display = 'none';
  document.getElementById('topbarTitle').textContent = 'Kelas';

  if (!kelasList || kelasList.length === 0) {
    kelasGrid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:40px 0; color:var(--clr-text-muted);">
        <p style="font-weight:600;">Belum ada kelas.</p>
        <p style="font-size:0.9rem;">Klik "Tambah Kelas" untuk memulai.</p>
      </div>
    `;
    return;
  }

  // Hitung statistik per kelas
  const kelasStats = {};
  siswaList.forEach(s => {
    if (!kelasStats[s.id_kelas]) {
      kelasStats[s.id_kelas] = { total: 0, count: 0 };
    }
    kelasStats[s.id_kelas].total += (s.total_skor || 0);
    kelasStats[s.id_kelas].count += 1;
  });

  kelasGrid.innerHTML = kelasList.map(kelas => {
    const stats = kelasStats[kelas.id_kelas] || { total: 0, count: 0 };
    const avg = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
    const warna = kelas.warna || '#3B82F6';
    const tingkat = kelas.tingkat || 'Kelas 4';
    return `
      <div class="kelas-card" style="--kelas-color: ${warna};" data-id="${kelas.id_kelas}">
        <div class="kelas-card__name">${escHtml(kelas.nama_kelas)}</div>
        <div class="kelas-card__meta">${escHtml(tingkat)} · rata-rata <span>${avg}%</span></div>
        <div class="kelas-card__bar">
          <div class="kelas-card__bar-inner" style="width:${Math.min(avg, 100)}%;"></div>
        </div>
        <div class="kelas-card__jumlah">${stats.count} siswa</div>
      </div>
    `;
  }).join('');

  // Event klik card -> buka detail
  document.querySelectorAll('.kelas-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      openDetail(id);
    });
  });
}
// Di akhir loadAllData(), setelah renderDaftar();

const urlParams = new URLSearchParams(window.location.search);
const kelasId = urlParams.get('kelas');
const siswaId = urlParams.get('siswa');

if (kelasId) {
  const found = kelasList.find(k => k.id_kelas === kelasId);
  if (found) {
    setTimeout(() => {
      openDetail(kelasId);
      if (siswaId) {
        setTimeout(() => {
          const row = document.querySelector(`#tbodyStudents tr[data-siswa-id="${siswaId}"]`);
          if (row) {
            row.style.backgroundColor = '#DBEAFE';
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }, 100);
  }
}

// ========== OPEN DETAIL KELAS ==========
async function openDetail(kelasId) {
  selectedClassId = kelasId;
  const kelas = kelasList.find(k => k.id_kelas === kelasId);
  if (!kelas) return;

  modeDaftar.style.display = 'none';
  modeDetail.style.display = 'block';
  document.getElementById('topbarTitle').textContent = kelas.nama_kelas;

  // Header
  detailNamaKelas.textContent = kelas.nama_kelas;
  const siswaDiKelas = siswaList.filter(s => s.id_kelas === kelasId);
  const totalSiswa = siswaDiKelas.length;
  const avg = totalSiswa > 0
    ? Math.round(siswaDiKelas.reduce((sum, s) => sum + (s.total_skor || 0), 0) / totalSiswa)
    : 0;
  detailMetaKelas.textContent = `${kelas.tingkat || 'Kelas 4'} · ${totalSiswa} siswa · rata-rata ${avg}%`;

  // Render siswa
  renderSiswa(kelasId);
}

function renderSiswa(kelasId) {
  const siswaDiKelas = siswaList.filter(s => s.id_kelas === kelasId);
  if (siswaDiKelas.length === 0) {
    tbodyStudents.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:24px;color:#64748B;">
        Belum ada siswa. Klik "Tambah Siswa" untuk menambahkan.
      </td></tr>
    `;
    return;
  }

  // Kumpulkan data sesi & strategi per siswa
  const siswaData = siswaDiKelas.map(siswa => {
    const sesiSiswa = sesiList.filter(se => se.id_siswa === siswa.id_siswa);
    const sesiIds = sesiSiswa.map(se => se.id_sesi);
    const strategiSiswa = strategiList.filter(st => sesiIds.includes(st.id_sesi));
    const totalSkor = siswa.total_skor || 0;
    const kategori = totalSkor >= 80 ? 'Tinggi' : totalSkor >= 50 ? 'Sedang' : 'Rendah';
    const badgeClass = kategori === 'Tinggi' ? 'badge-kategori--tinggi' :
                       kategori === 'Sedang' ? 'badge-kategori--sedang' : 'badge-kategori--rendah';
    return {
      ...siswa,
      jumlahStrategi: strategiSiswa.length,
      jumlahMain: sesiSiswa.length,
      kategori,
      badgeClass
    };
  });

  tbodyStudents.innerHTML = siswaData.map(s => `
    <tr>
      <td><span class="student-name">${escHtml(s.nama_panggilan || s.nama_lengkap)}</span></td>
      <td><span class="badge-kategori ${s.badgeClass}">${s.kategori}</span></td>
      <td>${s.jumlahStrategi}</td>
      <td>${s.jumlahMain}</td>
      <td>
        <button class="action-btn-sm action-btn-sm--success" data-id="${s.id_siswa}" data-action="play">▶ Main</button>
        <button class="action-btn-sm" data-id="${s.id_siswa}" data-action="detail">📊 Detail</button>
        <button class="action-btn-sm" data-id="${s.id_siswa}" data-action="edit">✎ Edit</button>
        <button class="action-btn-sm action-btn-sm--danger" data-id="${s.id_siswa}" data-action="delete">✕ Hapus</button>
      </td>
    </tr>
  `).join('');

  // Event listener untuk tombol aksi
  tbodyStudents.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'play') {
        openModalLevel(id);
      } else if (action === 'detail') {
        window.location.href = `detail-siswa.html?siswa=${id}`;
      } else if (action === 'edit') {
        openEditSiswa(id);
      } else if (action === 'delete') {
        deleteSiswa(id);
      }
    });
  });
}

// ========== TAMBAH / EDIT KELAS ==========
function openModalKelas(editData = null) {
  modalKelas.classList.add('is-open');
  if (editData) {
    modalKelasTitle.textContent = 'Edit Kelas';
    inputNamaKelas.value = editData.nama_kelas;
    inputTingkat.value = editData.tingkat || 'Kelas 4';
    editKelasId.value = editData.id_kelas;
    document.querySelectorAll('input[name="warna"]').forEach(el => {
      el.checked = (el.value === editData.warna);
    });
  } else {
    modalKelasTitle.textContent = 'Tambah Kelas Baru';
    inputNamaKelas.value = '';
    inputTingkat.value = 'Kelas 4';
    editKelasId.value = '';
    document.querySelector('input[name="warna"][value="#3B82F6"]').checked = true;
  }
}

function closeModalKelas() {
  modalKelas.classList.remove('is-open');
}

// js/kelas.js - GANTI fungsi submitKelas dengan ini

async function submitKelas() {
  const nama = inputNamaKelas.value.trim();
  const tingkat = inputTingkat.value;
  const warna = document.querySelector('input[name="warna"]:checked')?.value || '#3B82F6';
  const id = editKelasId.value;

  if (!nama) {
    showToast('Nama kelas wajib diisi.', 'warning');
    return;
  }

  const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';

  // 🔥 TAMBAHKAN TAHUN AJARAN
  const tahunAjaran = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

  try {
    let url = `${SUPABASE_URL}/rest/v1/kelas`;
    let method = 'POST';
    let body = {
      id_guru: guruId,
      nama_kelas: nama,
      tingkat: tingkat,
      warna: warna,
      tahun_ajaran: tahunAjaran // <-- INI DITAMBAHKAN
    };

    if (id) {
      url = `${url}?id_kelas=eq.${id}`;
      method = 'PATCH';
      // Untuk PATCH, kita tidak perlu kirim tahun_ajaran lagi (kecuali mau diubah)
      // Tapi lebih aman kirim saja semua field
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Submit Kelas] Error Response:', result);
      throw new Error(result.message || result.details || 'Gagal menyimpan');
    }

    showToast(id ? 'Kelas berhasil diperbarui.' : 'Kelas berhasil ditambahkan.', 'success');
    closeModalKelas();
    await loadAllData();

  } catch (err) {
    console.error('[Kelas] Submit error:', err);
    showToast('Gagal menyimpan kelas: ' + err.message, 'error');
  }
}
// js/kelas.js — Ganti fungsi submitSiswa dengan ini

async function submitSiswa() {
  const namaLengkap = inputNamaSiswa.value.trim();
  const namaPanggilan = inputPanggilan.value.trim() || namaLengkap;
  const username = inputNISN.value.trim().toLowerCase();
  const password = inputPinSiswa.value.trim();
  const idKelas = siswaKelasId.value;
  const id = editSiswaId.value;

  if (!namaLengkap || !username || !password || !idKelas) {
    showToast('NISN, Nama, dan PIN wajib diisi.', 'warning');
    return;
  }

  // 🔥 PAKAI FETCH MANUAL
  const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';

  try {
    let url = `${SUPABASE_URL}/rest/v1/siswa`;
    let method = 'POST';
    let body = {
      id_kelas: idKelas,
      nama_lengkap: namaLengkap,
      nama_panggilan: namaPanggilan,
      username: username,
      password_plain: password,
      total_skor: 0,
    };

    if (id) {
      url = `${url}?id_siswa=eq.${id}`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Submit Siswa] Error Response:', result);
      throw new Error(result.message || result.details || 'Gagal menyimpan');
    }

    showToast(id ? 'Siswa berhasil diperbarui.' : 'Siswa berhasil ditambahkan.', 'success');
    closeModalSiswa();
    await loadAllData();
    if (selectedClassId) openDetail(selectedClassId);

  } catch (err) {
    console.error('[Siswa] Submit error:', err);
    showToast('Gagal menyimpan siswa: ' + err.message, 'error');
  }
}
// ========== TAMBAH / EDIT SISWA (DIPERBAIKI) ==========
function openModalSiswa(editData = null) {
  modalSiswa.classList.add('is-open');
  if (editData) {
    modalSiswaTitle.textContent = 'Edit Siswa';
    inputNISN.value = editData.username || '';
    inputNamaSiswa.value = editData.nama_lengkap || '';
    inputPanggilan.value = editData.nama_panggilan || '';
    inputPinSiswa.value = editData.password_plain || '';
    editSiswaId.value = editData.id_siswa;
    siswaKelasId.value = editData.id_kelas;
  } else {
    modalSiswaTitle.textContent = 'Tambah Siswa';
    inputNISN.value = '';
    inputNamaSiswa.value = '';
    inputPanggilan.value = '';
    inputPinSiswa.value = '';
    editSiswaId.value = '';
    siswaKelasId.value = selectedClassId || '';
  }
}

function closeModalSiswa() {
  modalSiswa.classList.remove('is-open');
}

// ========== FUNGSI handleSubmitStudent YANG DIPERBAIKI ==========
async function handleSubmitStudent(event) {
  event.preventDefault();
  const namaLengkap = inputNamaSiswa.value.trim();
  const namaPanggilan = inputPanggilan.value.trim() || namaLengkap;
  const username = inputNISN.value.trim().toLowerCase();
  const password = inputPinSiswa.value.trim();
  const idKelas = siswaKelasId.value;
  const id = editSiswaId.value;

  if (!namaLengkap || !username || !password || !idKelas) {
    showToast('NISN, Nama, dan PIN wajib diisi.', 'warning');
    return;
  }

  try {
    if (id) {
      // Edit
      const { error } = await supabase
        .from('siswa')
        .update({
          username: username,
          nama_lengkap: namaLengkap,
          nama_panggilan: namaPanggilan,
          password_plain: password,
        })
        .eq('id_siswa', id);
      if (error) throw error;
      showToast('Siswa berhasil diperbarui.', 'success');
    } else {
      // Tambah
      const { data, error } = await supabase
        .from('siswa')
        .insert([{
          id_kelas: idKelas,
          nama_lengkap: namaLengkap,
          nama_panggilan: namaPanggilan,
          username: username,
          password_plain: password,
          total_skor: 0,
        }])
        .select();

      if (error) {
        console.error('[Tambah Siswa] Supabase error:', error);
        showToast(`Gagal: ${error.message || 'Unknown error'}`, 'error');
        return;
      }
      showToast('Siswa berhasil ditambahkan.', 'success');
    }
    closeModalSiswa();
    await loadAllData();
    if (selectedClassId) openDetail(selectedClassId);
  } catch (err) {
    console.error('[Siswa] Submit error:', err);
    showToast('Gagal menyimpan siswa.', 'error');
  }
}

// ========== HAPUS SISWA ==========
async function deleteSiswa(siswaId) {
  if (!confirm('Yakin ingin menghapus siswa ini?')) return;
  try {
    const { error } = await supabase
      .from('siswa')
      .delete()
      .eq('id_siswa', siswaId);
    if (error) throw error;
    showToast('Siswa berhasil dihapus.', 'success');
    await loadAllData();
    if (selectedClassId) openDetail(selectedClassId);
  } catch (err) {
    console.error('[Siswa] Delete error:', err);
    showToast('Gagal menghapus siswa.', 'error');
  }
}

// ========== PILIH LEVEL SEBELUM MAIN ==========
function openModalLevel(siswaId) {
  pendingPlaySiswaId = siswaId;
  modalLevel.classList.add('is-open');
}

function closeModalLevel() {
  modalLevel.classList.remove('is-open');
  pendingPlaySiswaId = null;
}

async function startGameForSiswa(siswaId, levelKe = 1) {
  try {
    const siswa = siswaList.find(s => s.id_siswa === siswaId);
    if (!siswa) {
      showToast('Data siswa tidak ditemukan.', 'error');
      return;
    }

    const targetAngka = generateTargetByLevel(levelKe);

    const { data: sesi, error: insertError } = await supabase
      .from('sesi_game')
      .insert({
        id_siswa: siswaId,
        level_ke: levelKe,
        target_angka: targetAngka,
        status_selesai: false,
      })
      .select('id_sesi, level_ke, target_angka, status_selesai')
      .single();

    if (insertError) throw insertError;

    const sessionData = {
      role: 'siswa',
      siswa: {
        id_siswa: siswa.id_siswa,
        nama_panggilan: siswa.nama_panggilan || siswa.nama_lengkap,
        total_skor: siswa.total_skor || 0,
        id_kelas: siswa.id_kelas,
      },
      sesi_game: {
        id_sesi: sesi.id_sesi,
        level_ke: sesi.level_ke,
        target_angka: sesi.target_angka,
        status_selesai: sesi.status_selesai,
      },
    };
    sessionStorage.setItem('widyatika_session', JSON.stringify(sessionData));
    window.location.href = 'game.html';

  } catch (err) {
    console.error('[Start Game] Error:', err);
    showToast('Gagal memulai game: ' + err.message, 'error');
  }
}

function openEditSiswa(siswaId) {
  const siswa = siswaList.find(s => s.id_siswa === siswaId);
  if (siswa) openModalSiswa(siswa);
}

// ========== EVENT LISTENERS ==========
btnTambahKelas.addEventListener('click', () => openModalKelas());
btnCancelModalKelas.addEventListener('click', closeModalKelas);
btnCloseModalKelas.addEventListener('click', closeModalKelas);
btnSubmitKelas.addEventListener('click', submitKelas);

btnTambahSiswa.addEventListener('click', () => openModalSiswa());
btnCancelModalSiswa.addEventListener('click', closeModalSiswa);
btnCloseModalSiswa.addEventListener('click', closeModalSiswa);
btnSubmitSiswa.addEventListener('click', handleSubmitStudent); // <- DISINI TERPAKAI

// Modal Pilih Level
btnCancelModalLevel.addEventListener('click', closeModalLevel);
btnCloseModalLevel.addEventListener('click', closeModalLevel);
modalLevel.querySelectorAll('.level-option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const level = parseInt(btn.dataset.level, 10) || 1;
    if (pendingPlaySiswaId) startGameForSiswa(pendingPlaySiswaId, level);
    closeModalLevel();
  });
});

btnBackDaftar.addEventListener('click', () => {
  selectedClassId = null;
  // Bersihkan query string ?kelas=... agar refresh data tidak membuka detail lagi
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);
  renderDaftar();
});

btnEditKelas.addEventListener('click', () => {
  const kelas = kelasList.find(k => k.id_kelas === selectedClassId);
  if (kelas) openModalKelas(kelas);
});

// Tutup modal jika klik backdrop
modalKelas.addEventListener('click', (e) => {
  if (e.target === modalKelas) closeModalKelas();
});
modalSiswa.addEventListener('click', (e) => {
  if (e.target === modalSiswa) closeModalSiswa();
});
modalLevel.addEventListener('click', (e) => {
  if (e.target === modalLevel) closeModalLevel();
});

// Refresh
document.getElementById('btnRefreshData').addEventListener('click', loadAllData);

// ========== UTILITY ==========
function escHtml(str) {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
  return String(str).replace(/[&<>"']/g, c => m[c]);
}

// ========== INIT ==========
loadAllData();