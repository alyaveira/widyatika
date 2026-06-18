import { supabase } from './supabase-config.js';
import { initGuruPage, showToast } from './guru.js';

const session = initGuruPage('laporan');
const guruId = session.guru.id_guru;

const elements = {
  totalSesi: document.getElementById('laporanTotalSesi'),
  rataSkor: document.getElementById('laporanRataSkor'),
  siswaAktif: document.getElementById('laporanSiswaAktif'),
  levelRata: document.getElementById('laporanLevelRata'),
  leaderboardBody: document.getElementById('laporanTbody'),
  chartPlaceholder: document.getElementById('laporanChart'),
};

async function loadLaporan() {
  try {
    const { data: kelasList, error: kelasErr } = await supabase
      .from('kelas')
      .select('id_kelas, nama_kelas')
      .eq('id_guru', guruId);
    if (kelasErr) throw kelasErr;

    const kelasIds = (kelasList || []).map(k => k.id_kelas);

    const { data: siswaList, error: siswaErr } = await supabase
      .from('siswa')
      .select('id_siswa, nama_panggilan, total_skor, id_kelas')
      .in('id_kelas', kelasIds);
    if (siswaErr) throw siswaErr;

    const siswaIds = (siswaList || []).map(s => s.id_siswa);

    const { data: sesiList, error: sesiErr } = await supabase
      .from('sesi_game')
      .select('id_sesi, id_siswa, level_ke, status_selesai')
      .in('id_siswa', siswaIds);
    if (sesiErr) throw sesiErr;

    const totalSesi = sesiList?.length || 0;
    const totalSiswaAktif = new Set((sesiList || []).map(s => s.id_siswa)).size;
    const rataSkor = siswaList.length > 0
      ? Math.round((siswaList.reduce((sum, siswa) => sum + (siswa.total_skor || 0), 0) / siswaList.length) * 10) / 10
      : 0;

    const levelJikaAda = (sesiList || []).map(s => s.level_ke || 0);
    const rataLevel = levelJikaAda.length > 0
      ? Math.round((levelJikaAda.reduce((sum, val) => sum + val, 0) / levelJikaAda.length) * 10) / 10
      : 0;

    elements.totalSesi.textContent = totalSesi;
    elements.rataSkor.textContent = `${rataSkor}%`;
    elements.siswaAktif.textContent = totalSiswaAktif;
    elements.levelRata.textContent = rataLevel.toFixed(1);

    renderLeaderboard(siswaList || [], kelasList || []);
    renderChart(kelasList || [], siswaList || [], sesiList || []);

  } catch (err) {
    console.error('[Laporan] Error memuat data:', err);
    showToast('Gagal memuat laporan. Periksa koneksi Supabase.', 'error');
    if (elements.chartPlaceholder) {
      elements.chartPlaceholder.textContent = 'Gagal memuat grafik.';
    }
  }
}

function renderLeaderboard(siswaList, kelasList) {
  if (!elements.leaderboardBody) return;
  const kelasMap = Object.fromEntries((kelasList || []).map(k => [k.id_kelas, k.nama_kelas]));
  const sorted = [...siswaList].sort((a, b) => (b.total_skor || 0) - (a.total_skor || 0)).slice(0, 10);

  if (sorted.length === 0) {
    elements.leaderboardBody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:24px;color:#64748B;">Belum ada data siswa untuk laporan.</td></tr>
    `;
    return;
  }

  elements.leaderboardBody.innerHTML = sorted.map((siswa, index) => {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escHtml(siswa.nama_panggilan || '—')}</td>
        <td><span class="status-chip mode-chip">Otomatis</span></td>
        <td>${siswa.total_skor ? Math.max(1, Math.round(siswa.total_skor / 100)) : 1}</td>
        <td>${siswa.total_skor || 0}</td>
        <td><span class="status-chip">Selesai</span></td>
      </tr>
    `;
  }).join('');
}

function renderChart(kelasList, siswaList, sesiList) {
  if (!elements.chartPlaceholder) return;
  const kelasMap = Object.fromEntries((kelasList || []).map(k => [k.id_kelas, k.nama_kelas]));
  const tepat = {};
  siswaList.forEach(siswa => {
    tepat[siswa.id_kelas] = tepat[siswa.id_kelas] || { total: 0, skor: 0 };
    tepat[siswa.id_kelas].total += 1;
    tepat[siswa.id_kelas].skor += siswa.total_skor || 0;
  });

  const bars = Object.entries(tepat)
    .map(([id_kelas, nilai]) => ({ nama: kelasMap[id_kelas] || id_kelas, avg: nilai.total > 0 ? Math.round(nilai.skor / nilai.total) : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  if (bars.length === 0) {
    elements.chartPlaceholder.textContent = 'Belum ada data cukup untuk membuat grafik.';
    return;
  }

  const maxAvg = Math.max(...bars.map(item => item.avg, 1));
  elements.chartPlaceholder.innerHTML = bars.map(item => `
    <div style="margin-bottom: 14px;">
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;color:#475569;margin-bottom:6px;">
        <span>${escHtml(item.nama)}</span>
        <strong>${item.avg}</strong>
      </div>
      <div style="height:12px;background:#E2E8F0;border-radius:999px;overflow:hidden;">
        <div style="width:${Math.round((item.avg / maxAvg) * 100)}%;height:100%;background:#3B82F6;border-radius:999px;"></div>
      </div>
    </div>
  `).join('');
}

function escHtml(value) {
  return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

loadLaporan();
