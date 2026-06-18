import { supabase } from './supabase-config.js';
import { initGuruPage, showToast } from './guru.js';

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

// DOM refs
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

    renderDaftar();
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
        // Buka game untuk siswa ini (bisa redirect ke game.html dengan parameter)
        showToast('Fitur Play Game akan segera hadir.', 'info');
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
    // Set warna
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

async function submitKelas() {
  const nama = inputNamaKelas.value.trim();
  const tingkat = inputTingkat.value;
  const warna = document.querySelector('input[name="warna"]:checked')?.value || '#3B82F6';
  const id = editKelasId.value;

  if (!nama) {
    showToast('Nama kelas wajib diisi.', 'warning');
    return;
  }

  try {
    if (id) {
      // Edit
      const { error } = await supabase
        .from('kelas')
        .update({ nama_kelas: nama, tingkat, warna })
        .eq('id_kelas', id);
      if (error) throw error;
      showToast('Kelas berhasil diperbarui.', 'success');
    } else {
      // Tambah
      const { error } = await supabase
        .from('kelas')
        .insert([{ id_guru: guruId, nama_kelas: nama, tingkat, warna }]);
      if (error) throw error;
      showToast('Kelas berhasil ditambahkan.', 'success');
    }
    closeModalKelas();
    await loadAllData();
  } catch (err) {
    console.error('[Kelas] Submit error:', err);
    showToast('Gagal menyimpan kelas.', 'error');
  }
}

// ========== TAMBAH / EDIT SISWA ==========
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

async function submitSiswa() {
  const nisn = inputNISN.value.trim();
  const nama = inputNamaSiswa.value.trim();
  const panggilan = inputPanggilan.value.trim() || nama;
  const pin = inputPinSiswa.value.trim();
  const idKelas = siswaKelasId.value;
  const id = editSiswaId.value;

  if (!nisn || !nama || !pin || !idKelas) {
    showToast('NISN, Nama, dan PIN wajib diisi.', 'warning');
    return;
  }

  try {
    if (id) {
      // Edit
      const { error } = await supabase
        .from('siswa')
        .update({
          username: nisn,
          nama_lengkap: nama,
          nama_panggilan: panggilan,
          password_plain: pin
        })
        .eq('id_siswa', id);
      if (error) throw error;
      showToast('Siswa berhasil diperbarui.', 'success');
    } else {
      // Tambah
      const { error } = await supabase
        .from('siswa')
        .insert([{
          id_kelas: idKelas,
          username: nisn,
          nama_lengkap: nama,
          nama_panggilan: panggilan,
          password_plain: pin,
          total_skor: 0
        }]);
      if (error) throw error;
      showToast('Siswa berhasil ditambahkan.', 'success');
    }
    closeModalSiswa();
    await loadAllData();
    // Buka ulang detail jika masih di detail
    if (selectedClassId) openDetail(selectedClassId);
  } catch (err) {
    console.error('[Siswa] Submit error:', err);
    showToast('Gagal menyimpan siswa.', 'error');
  }
}

function openEditSiswa(siswaId) {
  const siswa = siswaList.find(s => s.id_siswa === siswaId);
  if (siswa) openModalSiswa(siswa);
}

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

// ========== EVENT LISTENERS ==========
btnTambahKelas.addEventListener('click', () => openModalKelas());
btnCancelModalKelas.addEventListener('click', closeModalKelas);
btnCloseModalKelas.addEventListener('click', closeModalKelas);
btnSubmitKelas.addEventListener('click', submitKelas);

btnTambahSiswa.addEventListener('click', () => openModalSiswa());
btnCancelModalSiswa.addEventListener('click', closeModalSiswa);
btnCloseModalSiswa.addEventListener('click', closeModalSiswa);
btnSubmitSiswa.addEventListener('click', submitSiswa);

btnBackDaftar.addEventListener('click', () => {
  selectedClassId = null;
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

// Refresh
document.getElementById('btnRefreshData').addEventListener('click', loadAllData);

// ========== UTILITY ==========
function escHtml(str) {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
  return String(str).replace(/[&<>"']/g, c => m[c]);
}

// ========== INIT ==========
loadAllData();