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
    const { data: kelas, error: kelasErr } = await supabase
      .from('kelas')
      .select('id_kelas, nama_kelas')
      .eq('id_guru', guruId);
    if (kelasErr) throw kelasErr;
    kelasList = kelas || [];

    const kelasIds = kelasList.map(k => k.id_kelas);
    const { data: siswa, error: siswaErr } = await supabase
      .from('siswa')
      .select('id_siswa, nama_panggilan, total_skor, id_kelas')
      .in('id_kelas', kelasIds);
    if (siswaErr) throw siswaErr;
    siswaList = siswa || [];

    const siswaIds = siswaList.map(s => s.id_siswa);
    const { data: sesi, error: sesiErr } = await supabase
      .from('sesi_game')
      .select('id_sesi, id_siswa, level_ke, status_selesai, created_at')
      .in('id_siswa', siswaIds);
    if (sesiErr) throw sesiErr;
    sesiList = sesi || [];

    const sesiIds = sesiList.map(s => s.id_sesi);
    let strategi = [];
    if (sesiIds.length > 0) {
      const { data: strat, error: stratErr } = await supabase
        .from('detail_strategi')
        .select('id_strategi, id_sesi, poin_didapat, created_at')
        .in('id_sesi', sesiIds);
      if (stratErr) throw stratErr;
      strategi = strat || [];
    }
    strategiList = strategi;

    renderFilter();
    renderData('all');
  } catch (err) {
    console.error('[Laporan] Error:', err);
    showToast('Gagal memuat laporan.', 'error');
  }
}

function renderFilter() {
  const container = elements.filterKelas;
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
  let filteredSiswa = siswaList;
  if (filterId !== 'all') {
    filteredSiswa = siswaList.filter(s => s.id_kelas === filterId);
  }

  const filteredSiswaIds = filteredSiswa.map(s => s.id_siswa);
  const filteredSesi = sesiList.filter(s => filteredSiswaIds.includes(s.id_siswa));
  const filteredSesiIds = filteredSesi.map(s => s.id_sesi);
  const filteredStrategi = strategiList.filter(s => filteredSesiIds.includes(s.id_sesi));

  const totalSesi = filteredSesi.length;
  const totalSiswa = filteredSiswa.length;
  const totalStrategi = filteredStrategi.length;
  const rataSkor = totalSiswa > 0
    ? Math.round(filteredSiswa.reduce((sum, s) => sum + (s.total_skor || 0), 0) / totalSiswa)
    : 0;
  const siswaAktif = new Set(filteredSesi.map(s => s.id_siswa)).size;

  // elements.totalSesi.textContent = totalSesi;
  // elements.rataSkor.textContent = `${rataSkor}%`;
  // elements.siswaAktif.textContent = siswaAktif;
  // elements.totalStrategi.textContent = totalStrategi;

  renderChartMingguan(filteredSesi);
  renderChartPerkelas(filteredSiswa, filterId);
  renderChartKompleksitas(filteredStrategi);
  renderLeaderboard(filteredSiswa);
}

function renderChartMingguan(sesi) {
  const container = elements.chartMingguan;
  if (sesi.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data mingguan.</div>';
    return;
  }
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

// ============================================================
// KOMPLEKSITAS STRATEGI – per hari dalam 7 hari terakhir
// ============================================================
function renderChartKompleksitas(strategi) {
  const container = elements.chartKompleksitas;
  if (!strategi || strategi.length === 0) {
    container.innerHTML = '<div class="chart-empty">Belum ada data strategi dalam 7 hari terakhir.</div>';
    return;
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentStrategi = strategi.filter(s => {
    if (!s.created_at) return false;
    const created = new Date(s.created_at);
    return created >= sevenDaysAgo && created <= now;
  });

  if (recentStrategi.length === 0) {
    container.innerHTML = '<div class="chart-empty">Tidak ada strategi dalam 7 hari terakhir.</div>';
    return;
  }

  const dailyCount = {};
  recentStrategi.forEach(s => {
    const date = new Date(s.created_at).toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
    dailyCount[date] = (dailyCount[date] || 0) + 1;
  });

  const sortedDates = Object.keys(dailyCount).sort((a, b) => {
    const da = new Date(a.split(' ').reverse().join(' '));
    const db = new Date(b.split(' ').reverse().join(' '));
    return da - db;
  });

  const maxCount = Math.max(...Object.values(dailyCount), 1);
  container.innerHTML = sortedDates.map(date => {
    const count = dailyCount[date];
    const pct = Math.round((count / maxCount) * 100);
    return `
      <div class="chart-bar-wrap">
        <span class="chart-bar-label">${date}</span>
        <div class="chart-bar-track">
          <div class="chart-bar-fill chart-bar-fill--orange" style="width:${pct}%"></div>
        </div>
        <span class="chart-bar-value">${count}</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// LEADERBOARD dengan tombol Detail ke detailsiswa.html
// ============================================================
function renderLeaderboard(siswa) {
  const tbody = elements.leaderboardBody;
  if (!siswa || siswa.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748B;">Belum ada data siswa.</td></tr>';
    return;
  }

  const kelasMap = Object.fromEntries(kelasList.map(k => [k.id_kelas, k.nama_kelas]));

  const top5 = [...siswa]
    .sort((a, b) => (b.total_skor || 0) - (a.total_skor || 0))
    .slice(0, 5);

  tbody.innerHTML = top5.map((siswa, index) => {
    const rank = index + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const kelas = kelasMap[siswa.id_kelas] || '—';

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
        <td>
          <a href="detailsiswa.html?siswa=${siswa.id_siswa}" 
             class="btn btn--primary btn--sm" 
             style="font-size:0.7rem; padding:4px 12px; text-decoration:none;">
            📋 Detail
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

function escHtml(str) {
  const m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
  return String(str).replace(/[&<>"']/g, c => m[c]);
}

loadLaporan();
document.getElementById('btnRefreshData')?.addEventListener('click', loadLaporan);