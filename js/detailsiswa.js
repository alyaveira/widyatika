import { supabase } from './supabase-config.js';
import { initGuruPage, showToast } from './guru.js';

const session = initGuruPage('manajemen');
const guruId = session.guru.id_guru;

const urlParams = new URLSearchParams(window.location.search);
const siswaId = urlParams.get('siswa');

const el = {
  loading: document.getElementById('detailLoading'),
  content: document.getElementById('detailContent'),
  avatar: document.getElementById('profileAvatar'),
  nama: document.getElementById('profileNama'),
  kelas: document.getElementById('profileKelas'),
  kategori: document.getElementById('profileKategori'),
  stats: document.getElementById('profileStats'),
  tbodySesi: document.getElementById('tbodySesi'),
  tbodyStrategi: document.getElementById('tbodyStrategi'),
  btnBackKelas: document.getElementById('btnBackKelas'),
};

let siswaData = null;

async function loadDetail() {
  if (!siswaId) {
    showToast('Siswa tidak ditemukan.', 'error');
    window.location.href = 'manajemen-kelas.html';
    return;
  }

  try {
    // 1. Data siswa
    const { data: siswaRows, error: siswaErr } = await supabase
      .from('siswa')
      .select('id_siswa, nama_lengkap, nama_panggilan, username, total_skor, id_kelas')
      .eq('id_siswa', siswaId)
      .limit(1);
    if (siswaErr) throw siswaErr;
    if (!siswaRows || siswaRows.length === 0) {
      showToast('Data siswa tidak ditemukan.', 'error');
      window.location.href = 'manajemen-kelas.html';
      return;
    }
    siswaData = siswaRows[0];

    // Pastikan siswa ini milik guru yang sedang login (lewat kelasnya)
    const { data: kelasRows, error: kelasErr } = await supabase
      .from('kelas')
      .select('id_kelas, nama_kelas, tingkat, id_guru')
      .eq('id_kelas', siswaData.id_kelas)
      .limit(1);
    if (kelasErr) throw kelasErr;
    const kelasData = (kelasRows && kelasRows[0]) || null;

    if (!kelasData || kelasData.id_guru !== guruId) {
      showToast('Anda tidak memiliki akses ke data siswa ini.', 'error');
      window.location.href = 'manajemen-kelas.html';
      return;
    }

    // 2. Sesi game milik siswa ini
    const { data: sesiRows, error: sesiErr } = await supabase
      .from('sesi_game')
      .select('id_sesi, level_ke, target_angka, status_selesai')
      .eq('id_siswa', siswaId)
      .order('level_ke', { ascending: true });
    if (sesiErr) throw sesiErr;
    const sesiList = sesiRows || [];

    // 3. Strategi yang ditemukan dari sesi-sesi tersebut
    let strategiList = [];
    const sesiIds = sesiList.map(s => s.id_sesi);
    if (sesiIds.length > 0) {
      const { data: stratRows, error: stratErr } = await supabase
        .from('detail_strategi')
        .select('id_strategi, id_sesi, ekspresi_matematika, poin_didapat')
        .in('id_sesi', sesiIds);
      if (stratErr) throw stratErr;
      strategiList = stratRows || [];
    }

    renderDetail(kelasData, sesiList, strategiList);

  } catch (err) {
    console.error('[DetailSiswa] Error:', err);
    showToast('Gagal memuat detail siswa.', 'error');
  }
}

function renderDetail(kelasData, sesiList, strategiList) {
  const nama = siswaData.nama_panggilan || siswaData.nama_lengkap || 'Siswa';
  const totalSkor = siswaData.total_skor || 0;
  const jumlahMain = sesiList.length;
  const jumlahStrategi = strategiList.length;
  const rataPoin = jumlahStrategi > 0
    ? Math.round(strategiList.reduce((sum, s) => sum + (s.poin_didapat || 0), 0) / jumlahStrategi)
    : 0;

  const kategori = totalSkor >= 80 ? 'Tinggi' : totalSkor >= 50 ? 'Sedang' : 'Rendah';
  const badgeClass = kategori === 'Tinggi' ? 'badge-kategori--tinggi' :
                     kategori === 'Sedang' ? 'badge-kategori--sedang' : 'badge-kategori--rendah';

  // Profil
  el.avatar.textContent = nama.charAt(0).toUpperCase();
  el.nama.textContent = nama;
  el.kelas.textContent = `${kelasData.nama_kelas}${kelasData.tingkat ? ' · ' + kelasData.tingkat : ''}`;
  el.kategori.textContent = kategori;
  el.kategori.className = `badge-kategori ${badgeClass}`;

  // Stat cards
  el.stats.innerHTML = `
    <div class="stat-card stat-card--blue">
      <div class="stat-card__header">
        <span class="stat-card__label">Total Skor</span>
        <span class="stat-card__icon">🏆</span>
      </div>
      <span class="stat-card__value">${totalSkor}</span>
    </div>
    <div class="stat-card stat-card--green">
      <div class="stat-card__header">
        <span class="stat-card__label">Jumlah Main</span>
        <span class="stat-card__icon">🎮</span>
      </div>
      <span class="stat-card__value">${jumlahMain}</span>
    </div>
    <div class="stat-card stat-card--orange">
      <div class="stat-card__header">
        <span class="stat-card__label">Strategi Ditemukan</span>
        <span class="stat-card__icon">🧩</span>
      </div>
      <span class="stat-card__value">${jumlahStrategi}</span>
    </div>
    <div class="stat-card stat-card--purple">
      <div class="stat-card__header">
        <span class="stat-card__label">Rata-rata Poin/Strategi</span>
        <span class="stat-card__icon">📈</span>
      </div>
      <span class="stat-card__value">${rataPoin}</span>
    </div>
  `;

  // Riwayat sesi
  if (sesiList.length === 0) {
    el.tbodySesi.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#64748B;">Siswa ini belum pernah main.</td></tr>`;
  } else {
    el.tbodySesi.innerHTML = sesiList.map(sesi => {
      const jmlStrategiSesi = strategiList.filter(s => s.id_sesi === sesi.id_sesi).length;
      const statusClass = sesi.status_selesai ? 'status-pill--selesai' : 'status-pill--berjalan';
      const statusText = sesi.status_selesai ? '✓ Selesai' : '⏳ Berjalan';
      return `
        <tr>
          <td>Level ${sesi.level_ke}</td>
          <td>${sesi.target_angka}</td>
          <td><span class="status-pill ${statusClass}">${statusText}</span></td>
          <td>${jmlStrategiSesi}</td>
        </tr>
      `;
    }).join('');
  }

  // Daftar strategi
  if (strategiList.length === 0) {
    el.tbodyStrategi.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:#64748B;">Belum ada strategi yang ditemukan.</td></tr>`;
  } else {
    const sesiMap = Object.fromEntries(sesiList.map(s => [s.id_sesi, s.level_ke]));
    el.tbodyStrategi.innerHTML = [...strategiList]
      .sort((a, b) => (b.poin_didapat || 0) - (a.poin_didapat || 0))
      .map(strat => `
        <tr>
          <td>Level ${sesiMap[strat.id_sesi] || '—'}</td>
          <td>${escHtml(strat.ekspresi_matematika || '—')}</td>
          <td><strong>${strat.poin_didapat || 0}</strong></td>
        </tr>
      `).join('');
  }

  el.loading.style.display = 'none';
  el.content.style.display = 'block';
}

function escHtml(str) {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
  return String(str).replace(/[&<>"']/g, c => m[c]);
}

// ========== EVENT LISTENERS ==========
el.btnBackKelas.addEventListener('click', () => {
  const idKelas = siswaData?.id_kelas;
  window.location.href = idKelas ? `manajemen-kelas.html?kelas=${idKelas}` : 'manajemen-kelas.html';
});

document.getElementById('btnRefreshData')?.addEventListener('click', () => {
  el.loading.style.display = 'flex';
  el.content.style.display = 'none';
  loadDetail();
});

// ========== INIT ==========
document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
loadDetail();