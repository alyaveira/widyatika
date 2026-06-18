import { supabase } from './supabase-config.js';
import { initGuruPage, showToast } from './guru.js';

const session = initGuruPage('manajemen');
const guruId = session.guru.id_guru;

const elements = {
  selectFilterKelas: document.getElementById('selectKelas'),
  selectTambahKelas: document.getElementById('selectTambahKelas'),
  btnTambahSiswa: document.getElementById('btnTambahSiswa'),
  formPanel: document.getElementById('studentFormPanel'),
  studentForm: document.getElementById('studentForm'),
  inputNamaLengkap: document.getElementById('inputNamaLengkap'),
  inputNamaPanggilan: document.getElementById('inputNamaPanggilan'),
  inputUsername: document.getElementById('inputUsername'),
  inputPassword: document.getElementById('inputPassword'),
  tbodyStudents: document.getElementById('tbodyStudents'),
  tableWrapper: document.querySelector('.table-wrapper'),
};

let kelasList = [];

async function initClassPage() {
  bindEvents();
  await loadKelas();
}

function bindEvents() {
  if (elements.btnTambahSiswa) {
    elements.btnTambahSiswa.addEventListener('click', openForm);
  }
  if (elements.selectFilterKelas) {
    elements.selectFilterKelas.addEventListener('change', loadStudents);
  }
  if (elements.studentForm) {
    elements.studentForm.addEventListener('submit', handleSubmitStudent);
  }
  document.getElementById('btnCancelTambah')?.addEventListener('click', event => {
    event.preventDefault();
    closeForm();
  });
}

async function loadKelas() {
  try {
    const { data, error } = await supabase
      .from('kelas')
      .select('id_kelas, nama_kelas')
      .eq('id_guru', guruId)
      .order('nama_kelas', { ascending: true });
    if (error) throw error;

    kelasList = data || [];
    renderClassOptions();
    await loadStudents();
  } catch (err) {
    console.error('[Kelas] Load kelas error:', err);
    showToast('Gagal memuat daftar kelas.', 'error');
    if (elements.tbodyStudents) {
      elements.tbodyStudents.innerHTML = '<tr><td colspan="6">Tidak dapat memuat data kelas.</td></tr>';
    }
  }
}

function renderClassOptions() {
  if (!elements.selectFilterKelas || !elements.selectTambahKelas) return;
  const options = kelasList.map(kelas => `
    <option value="${kelas.id_kelas}">${kelas.nama_kelas}</option>
  `).join('');

  elements.selectFilterKelas.innerHTML = options;
  elements.selectTambahKelas.innerHTML = options;
}

async function loadStudents() {
  if (!elements.selectFilterKelas) return;
  const selectedClassId = elements.selectFilterKelas.value;
  if (!selectedClassId) return;
  try {
    const { data, error } = await supabase
      .from('siswa')
      .select('id_siswa, nama_lengkap, nama_panggilan, username, password_plain, total_skor')
      .eq('id_kelas', selectedClassId)
      .order('nama_lengkap', { ascending: true });
    if (error) throw error;
    renderStudentRows(data || []);
  } catch (err) {
    console.error('[Kelas] Load siswa error:', err);
    showToast('Gagal memuat data siswa.', 'error');
    if (elements.tbodyStudents) {
      elements.tbodyStudents.innerHTML = '<tr><td colspan="6">Terjadi kesalahan saat memuat siswa.</td></tr>';
    }
  }
}

function renderStudentRows(students) {
  if (!elements.tbodyStudents) return;
  if (!students || students.length === 0) {
    elements.tbodyStudents.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:24px;color:#64748B;">
        Belum ada siswa di kelas ini. Tambahkan siswa baru untuk mulai melacak.
      </td></tr>`;
    return;
  }

  elements.tbodyStudents.innerHTML = students.map((siswa, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escHtml(siswa.nama_lengkap)}</td>
      <td>${escHtml(siswa.nama_panggilan)}</td>
      <td><span class="data-pill">${escHtml(siswa.username)}</span></td>
      <td><span class="badge-token">${escHtml(siswa.password_plain)}</span></td>
      <td>
        <div class="action-buttons">
          <button class="action-btn" type="button" data-siswa-id="${siswa.id_siswa}" data-action="edit">Edit</button>
          <button class="action-btn action-btn--danger" type="button" data-siswa-id="${siswa.id_siswa}" data-action="delete">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');

  elements.tbodyStudents.querySelectorAll('button[data-action="delete"]').forEach(button => {
    button.addEventListener('click', () => {
      const siswaId = button.dataset.siswaId;
      deleteStudent(siswaId);
    });
  });
}

async function handleSubmitStudent(event) {
  event.preventDefault();
  const namaLengkap = elements.inputNamaLengkap?.value.trim();
  const namaPanggilan = elements.inputNamaPanggilan?.value.trim();
  const username = elements.inputUsername?.value.trim().toLowerCase();
  const password = elements.inputPassword?.value.trim();
  const idKelas = elements.selectTambahKelas?.value;

  if (!namaLengkap || !namaPanggilan || !username || !password || !idKelas) {
    showToast('Lengkapi semua data siswa sebelum menyimpan.', 'warning');
    return;
  }

  try {
    const { error } = await supabase
      .from('siswa')
      .insert([{ 
        id_kelas: idKelas,
        nama_lengkap: namaLengkap,
        nama_panggilan: namaPanggilan,
        username: username,
        password_plain: password,
        total_skor: 0,
      }]);

    if (error) throw error;
    showToast('Siswa baru berhasil ditambahkan.', 'success');
    closeForm();
    if (elements.selectFilterKelas?.value === idKelas) {
      await loadStudents();
    }
  } catch (err) {
    console.error('[Kelas] Tambah siswa error:', err);
    showToast('Gagal menambahkan siswa. Periksa koneksi.', 'error');
  }
}

async function deleteStudent(idSiswa) {
  if (!idSiswa || !confirm('Hapus siswa ini dari kelas? Tindakan ini tidak dapat dibatalkan.')) return;
  try {
    const { error } = await supabase
      .from('siswa')
      .delete()
      .eq('id_siswa', idSiswa);
    if (error) throw error;
    showToast('Siswa berhasil dihapus.', 'success');
    await loadStudents();
  } catch (err) {
    console.error('[Kelas] Hapus siswa error:', err);
    showToast('Gagal menghapus siswa. Periksa koneksi atau data terkait.', 'error');
  }
}

function openForm() {
  if (!elements.formPanel) return;
  elements.formPanel.style.display = 'block';
  if (elements.selectFilterKelas && elements.selectTambahKelas) {
    elements.selectTambahKelas.value = elements.selectFilterKelas.value;
  }
}

function closeForm() {
  if (!elements.formPanel) return;
  elements.formPanel.style.display = 'none';
  elements.studentForm?.reset();
}

function escHtml(value) {
  return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

initClassPage();
