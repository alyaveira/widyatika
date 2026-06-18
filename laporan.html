import { supabase } from './supabase-config.js';
import { initGuruPage, showToast } from './guru.js';

const session = initGuruPage('laporan');
const guruId = session.guru.id_guru;

let currentFilter = 'all';
let kelasList = [];
let siswaList = [];
let sesiList = [];
let strategiList = [];

const elements = {
  totalSesi: document.getElementById('laporanTotalSesi'),
  rataSkor: document.getElementById('laporanRataSkor'),
  siswaAktif: document.getElementById('laporanSiswaAktif'),
  totalStrategi: document.getElementById('laporanTotalStrategi'),
  leaderboardBody: document.getElementById('laporanTbody'),
  filterKelas: document.getElementById('filterKelas'),
  chartMingguan: document.getElementById('chartMingguan'),
  chartPerkelas: document.getElementById('chartPerkelas'),
  chartKompleksitas: document.getElementById('chartKompleksitas'),
};

async function loadLaporan() {
  try {
    // 1. Ambil semua kelas guru
    const { data: kelas, error: kelasErr } = await supabase
      .from('kelas')
      .select('id_kelas, nama_kelas')
      .eq('id_guru', guruId);
    if (kelasErr) throw kelasErr;
    kelasList = kelas || [];

    // 2. Ambil semua siswa
    const kelasIds = kelasList.map(k => k.id_kelas);
    const { data: siswa, error: siswaErr } = await supabase
      .from('siswa')
      .select('id_siswa, nama_panggilan, total_skor, id_kelas')
      .in('id_kelas', kelasIds);
    if (siswaErr) throw siswaErr;
    siswaList = siswa || [];

    // 3. Ambil semua sesi
    const siswaIds = siswaList.map(s => s.id_siswa);
    const { data: sesi, error: sesiErr } = await supabase
      .from('sesi_game')
      .select('id_sesi, id_siswa, level_ke, status_selesai')
      .in('id_siswa', siswaIds);
    if (sesiErr) throw sesiErr;
    sesiList = sesi || [];

    // 4. Ambil semua strategi
    const sesiIds = sesiList.map(s => s.id_sesi);
    let strategi = [];
    if (sesiIds.length > 0) {
      const { data: strat, error: stratErr } = await supabase
        .from('detail_strategi')
        .select('id_strategi, id_sesi, poin_didapat')
        .in('id_sesi', sesiIds);
      if (stratErr) throw stratErr;
      strategi = strat || [];
    }
    strategiList = strategi;

    // Render filter
    renderFilter();

    // Render data
    renderData('all');

  } catch (err) {
    console.error('[Laporan] Error:', err);
    showToast('Gagal memuat laporan.', 'error');
  }
}

function renderFilter() {
  const container = elements.filterKelas;
  // Hapus semua kecuali tombol "Semua Kelas"
  const allBtn = container.querySelector('[data-id="all"]');
  container.innerHTML = '';
  container.appendChild(allBtn);

  kelasList.forEach(kelas => {
    const btn = document.createElement('button');
    btn.className = 'filter-kelas__btn';
    btn.dataset.id = kelas.id_kelas;
    btn.textContent = kelas.nama_kelas;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-kelas__btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = kelas.id_kelas;
      renderData(kelas.id_kelas);
    });
    container.appendChild(btn);
  });

  allBtn.addEventListener('click', () => {
    container.querySelectorAll('.filter-kelas__btn').forEach(b => b.classList.remove('is-active'));
    allBtn.classList.add('is-active');
    currentFilter = 'all';
    renderData('all');
  });
}

function renderData(filterId) {
  // Filter siswa berdasarkan kelas
  let filteredSiswa = siswaList;
  if (filterId !== 'all') {
    filteredSiswa = siswaList.filter(s => s.id_kelas === filterId);
  }

  const filteredSiswaIds = filteredSiswa.map(s => s.id_siswa);
  const filteredSesi = sesiList.filter(s => filteredSiswaIds.includes(s.id_siswa));
  const filteredSesiIds = filteredSesi.map(s => s.id_sesi);
  const filteredStrategi = strategiList.filter(s => filteredSesiIds.includes(s.id_sesi));

  // Summary
  const totalSesi = filteredSesi.length;
  const totalSiswa = filteredSiswa.length;
  const totalStrategi = filteredStrategi.length;
  const rataSkor = totalSiswa > 0
    ? Math.round(filteredSiswa.reduce((sum, s) => sum + (s.total_skor || 0), 0) / totalSiswa)
    : 0;
  const siswaAktif = new Set(filteredSesi.map(s => s.id_siswa)).size;

  elements.totalSesi.textContent = totalSesi;
  elements.rataSkor.textContent = `${rataSkor}%`;
  elements.siswaAktif.textContent = siswaAktif;
  elements.totalStrategi.textContent = totalStrategi;

  // Render grafik
  renderChartMingguan(filteredSesi);
  renderChartPerkelas(filteredSiswa, filterId);
  renderChartKompleksitas(filteredStrategi, filteredSesi);

  // Render Leaderboard Top 5
  renderLeaderboard(filteredSiswa);
}

function renderChartMingguan(sesi) {
  const container = elements.chartMingguan;
  if (sesi.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data mingguan.</div>';
    return;
  }

  // Kelompokkan berdasarkan minggu (pakai level sebagai proxy sederhana)
  const levels = {};
  sesi.forEach(s => {
    const lv = s.level_ke || 1;
    levels[lv] = (levels[lv] || 0) + 1;
  });

  const sorted = Object.keys(levels).sort((a, b) => a - b);
  const maxVal = Math.max(...Object.values(levels), 1);

  container.innerHTML = sorted.map(lv => {
    const count = levels[lv];
    const pct = Math.round((count / maxVal) * 100);
    return `
      <div class="chart-bar-wrap">
        <span class="chart-bar-label">Level ${lv}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill chart-bar-fill--blue" style="width:${pct}%"></div>
        </div>
        <span class="chart-bar-value">${count}</span>
      </div>
    `;
  }).join('');
}

function renderChartPerkelas(siswa, filterId) {
  const container = elements.chartPerkelas;
  if (siswa.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data perkelas.</div>';
    return;
  }

  // Kelompokkan berdasarkan kelas
  const kelasMap = Object.fromEntries(kelasList.map(k => [k.id_kelas, k.nama_kelas]));
  const classStats = {};
  siswa.forEach(s => {
    if (!classStats[s.id_kelas]) classStats[s.id_kelas] = { total: 0, count: 0 };
    classStats[s.id_kelas].total += (s.total_skor || 0);
    classStats[s.id_kelas].count += 1;
  });

  const entries = Object.entries(classStats);
  if (entries.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data perkelas.</div>';
    return;
  }

  const maxAvg = Math.max(...entries.map(([_, v]) => v.count > 0 ? v.total / v.count : 0), 1);

  container.innerHTML = entries.map(([id, stats]) => {
    const avg = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
    const pct = Math.round((avg / maxAvg) * 100);
    const name = kelasMap[id] || id;
    return `
      <div class="chart-bar-wrap">
        <span class="chart-bar-label">${name}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill chart-bar-fill--green" style="width:${pct}%"></div>
        </div>
        <span class="chart-bar-value">${avg}</span>
      </div>
    `;
  }).join('');
}

function renderChartKompleksitas(strategi, sesi) {
  const container = elements.chartKompleksitas;
  if (strategi.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data strategi.</div>';
    return;
  }

  // Hitung rata-rata poin per sesi (semakin tinggi = semakin kompleks)
  const sesiPoin = {};
  strategi.forEach(s => {
    sesiPoin[s.id_sesi] = (sesiPoin[s.id_sesi] || 0) + (s.poin_didapat || 0);
  });

  const entries = Object.entries(sesiPoin);
  const maxPoin = Math.max(...entries.map(([_, v]) => v), 1);

  // Ambil 5 teratas untuk ditampilkan
  const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data kompleksitas.</div>';
    return;
  }

  container.innerHTML = sorted.map(([idSesi, poin]) => {
    const pct = Math.round((poin / maxPoin) * 100);
    const sesiData = sesi.find(s => s.id_sesi === idSesi);
    const label = sesiData ? `Sesi ${idSesi.slice(0, 6)}` : 'Sesi';
    return `
      <div class="chart-bar-wrap">
        <span class="chart-bar-label">${label}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill chart-bar-fill--orange" style="width:${pct}%"></div>
        </div>
        <span class="chart-bar-value">${poin}</span>
      </div>
    `;
  }).join('');
}

function renderLeaderboard(siswa) {
  const tbody = elements.leaderboardBody;
  if (!siswa || siswa.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#64748B;">Belum ada data siswa.</td></tr>';
    return;
  }

  const kelasMap = Object.fromEntries(kelasList.map(k => [k.id_kelas, k.nama_kelas]));

  // Ambil 5 siswa dengan skor tertinggi
  const top5 = [...siswa]
    .sort((a, b) => (b.total_skor || 0) - (a.total_skor || 0))
    .slice(0, 5);

  tbody.innerHTML = top5.map((siswa, index) => {
    const rank = index + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const kelas = kelasMap[siswa.id_kelas] || '—';

    // Detail: jumlah strategi yang ditemukan
    const siswaSesi = sesiList.filter(s => s.id_siswa === siswa.id_siswa);
    const siswaSesiIds = siswaSesi.map(s => s.id_sesi);
    const jmlStrategi = strategiList.filter(s => siswaSesiIds.includes(s.id_sesi)).length;

    return `
      <tr>
        <td class="rank ${rankClass}">${medal}</td>
        <td><span class="student-name">${escHtml(siswa.nama_panggilan || '—')}</span></td>
        <td><span class="student-class">${escHtml(kelas)}</span></td>
        <td class="score">${siswa.total_skor || 0}</td>
        <td><span class="detail-badge">${jmlStrategi} strategi</span></td>
      </tr>
    `;
  }).join('');
}

function escHtml(str) {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
  return String(str).replace(/[&<>"']/g, c => m[c]);
}

// ========== INIT ==========
loadLaporan();

// Refresh
document.getElementById('btnRefreshData')?.addEventListener('click', () => {
  loadLaporan();
});