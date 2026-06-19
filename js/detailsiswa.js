import { initGuruPage, showToast } from './guru.js';

const session = initGuruPage('manajemen');
const guruId = session.guru.id_guru;

const urlParams = new URLSearchParams(window.location.search);
const siswaId = urlParams.get('siswa');

const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';

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
  analisisBody: document.getElementById('analisisBody'),
  btnBackKelas: document.getElementById('btnBackKelas'),
};

let siswaData = null;

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

async function loadDetail() {
  try {
    if (!siswaId) {
      showToast('Siswa tidak ditemukan.', 'error');
      window.location.href = 'manajemen-kelas.html';
      return;
    }

    // 1. Data siswa
    const siswaRows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/siswa?select=id_siswa,nama_lengkap,nama_panggilan,username,total_skor,id_kelas&id_siswa=eq.${siswaId}`
    );
    if (!siswaRows || siswaRows.length === 0) {
      showToast('Data siswa tidak ditemukan.', 'error');
      window.location.href = 'manajemen-kelas.html';
      return;
    }
    siswaData = siswaRows[0];

    // 2. Kelas (validasi guru)
    const kelasRows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/kelas?select=id_kelas,nama_kelas,tingkat,id_guru&id_kelas=eq.${siswaData.id_kelas}`
    );
    if (!kelasRows || kelasRows.length === 0) {
      showToast('Kelas tidak ditemukan.', 'error');
      window.location.href = 'manajemen-kelas.html';
      return;
    }
    const kelasData = kelasRows[0];
    if (kelasData.id_guru !== guruId) {
      showToast('Anda tidak memiliki akses.', 'error');
      window.location.href = 'manajemen-kelas.html';
      return;
    }

    // 3. Sesi
    const sesiRows = await fetchJson(
      `${SUPABASE_URL}/rest/v1/sesi_game?select=id_sesi,level_ke,target_angka,status_selesai&id_siswa=eq.${siswaId}&order=level_ke.asc`
    );
    const sesiList = sesiRows || [];

    // 4. Strategi
    let strategiList = [];
    if (sesiList.length > 0) {
      const sesiIds = sesiList.map(s => s.id_sesi).join(',');
      const stratRows = await fetchJson(
        `${SUPABASE_URL}/rest/v1/detail_strategi?select=id_strategi,id_sesi,ekspresi_matematika,poin_didapat&id_sesi=in.(${sesiIds})`
      );
      strategiList = stratRows || [];
    }

    renderDetail(kelasData, sesiList, strategiList);

  } catch (err) {
    console.error('[DetailSiswa] Error:', err);
    showToast('Gagal memuat: ' + err.message, 'error');
    el.loading.style.display = 'none';
    el.loading.innerHTML = `<span style="color:var(--clr-danger);font-weight:600;">❌ ${err.message}</span>`;
  }
}

// ========== ANALISIS ==========
function analyzeStudent(strategiList, sesiList, totalSkor) {
  const totalStrategi = strategiList.length;
  const totalSesi = sesiList.length;

  // Hitung frekuensi operator dari setiap ekspresi
  const opCount = { '+': 0, '-': 0, '×': 0, '÷': 0 };
  strategiList.forEach(s => {
    const expr = s.ekspresi_matematika || '';
    // Hitung kemunculan operator display
    (expr.match(/[+−×÷]/g) || []).forEach(op => {
      if (opCount[op] !== undefined) opCount[op]++;
    });
  });

  // Operator paling dominan
  let dominantOp = 'Tidak ada';
  let maxCount = 0;
  for (const [op, count] of Object.entries(opCount)) {
    if (count > maxCount) { maxCount = count; dominantOp = op; }
  }
  const totalOps = Object.values(opCount).reduce((a, b) => a + b, 0);
  const pct = op => totalOps > 0 ? Math.round((opCount[op] / totalOps) * 100) : 0;

  // Rekomendasi berdasarkan dominasi operator dan skor
  let rekomendasi = '';
  let kategori = '';

  if (totalStrategi === 0) {
    rekomendasi = 'Siswa belum pernah mencoba menemukan strategi. Ajak siswa untuk bermain dan mengeksplorasi berbagai cara mencapai target angka.';
    kategori = 'Perlu Stimulasi';
  } else if (totalSkor < 50) {
    rekomendasi = 'Skor masih rendah. Sarankan siswa untuk mencoba berbagai operator (+, -, ×, ÷) dan menggunakan tanda kurung untuk variasi.';
    kategori = 'Perlu Bimbingan';
  } else if (dominantOp === '+' && pct('+') > 60) {
    rekomendasi = 'Siswa cenderung menggunakan penjumlahan. Ajak siswa bereksperimen dengan perkalian dan pengurangan untuk memperkaya strategi.';
    kategori = 'Variasi Strategi';
  } else if (dominantOp === '×' && pct('×') > 60) {
    rekomendasi = 'Siswa suka perkalian! Tantang siswa dengan pembagian dan penjumlahan untuk melatih fleksibilitas berpikir.';
    kategori = 'Variasi Strategi';
  } else if (totalStrategi >= 5 && totalSkor >= 80) {
    rekomendasi = 'Siswa sangat baik! Pertahankan dengan memberikan soal tantangan yang lebih kompleks.';
    kategori = 'Mahir';
  } else {
    rekomendasi = 'Siswa sudah menunjukkan kemampuan yang baik. Terus dorong eksplorasi dengan berbagai angka dan operator.';
    kategori = 'Berpotensi';
  }

  return {
    totalStrategi,
    totalSesi,
    opCount,
    dominantOp,
    pct: { add: pct('+'), sub: pct('-'), mul: pct('×'), div: pct('÷') },
    rekomendasi,
    kategori,
    totalOps,
  };
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
      <div class="stat-card__header"><span class="stat-card__label">Total Skor</span><span class="stat-card__icon">🏆</span></div>
      <span class="stat-card__value">${totalSkor}</span>
    </div>
    <div class="stat-card stat-card--green">
      <div class="stat-card__header"><span class="stat-card__label">Jumlah Main</span><span class="stat-card__icon">🎮</span></div>
      <span class="stat-card__value">${jumlahMain}</span>
    </div>
    <div class="stat-card stat-card--orange">
      <div class="stat-card__header"><span class="stat-card__label">Strategi Ditemukan</span><span class="stat-card__icon">🧩</span></div>
      <span class="stat-card__value">${jumlahStrategi}</span>
    </div>
    <div class="stat-card stat-card--purple">
      <div class="stat-card__header"><span class="stat-card__label">Rata-rata Poin/Strategi</span><span class="stat-card__icon">📈</span></div>
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

  // ===== ANALISIS =====
  const analysis = analyzeStudent(strategiList, sesiList, totalSkor);
  renderAnalysis(analysis);

  el.loading.style.display = 'none';
  el.content.style.display = 'block';
}

function renderAnalysis(analysis) {
  const container = el.analisisBody;
  if (!container) return;

  const { dominantOp, pct, totalStrategi, rekomendasi, kategori, totalSesi } = analysis;

  const opLabels = {
    '+': '➕ Penjumlahan',
    '-': '➖ Pengurangan',
    '×': '✖️ Perkalian',
    '÷': '➗ Pembagian',
  };
  const opColor = {
    '+': 'var(--clr-blue)',
    '-': 'var(--clr-orange)',
    '×': 'var(--clr-purple)',
    '÷': 'var(--clr-green)',
  };

  let dominanText = dominantOp !== 'Tidak ada' ? `${opLabels[dominantOp] || dominantOp} (${analysis.pct[dominantOp === '+' ? 'add' : dominantOp === '-' ? 'sub' : dominantOp === '×' ? 'mul' : 'div']}%)` : 'Belum ada data';

  container.innerHTML = `
    <div class="analisis-item">
      <div class="analisis-item__icon">🧠</div>
      <div class="analisis-item__content">
        <div class="analisis-item__label">Kategori</div>
        <div class="analisis-item__value">${kategori}</div>
      </div>
    </div>
    <div class="analisis-item">
      <div class="analisis-item__icon">🎯</div>
      <div class="analisis-item__content">
        <div class="analisis-item__label">Total Strategi</div>
        <div class="analisis-item__value">${totalStrategi} strategi dari ${totalSesi} sesi bermain</div>
      </div>
    </div>
    <div class="analisis-item">
      <div class="analisis-item__icon">🔢</div>
      <div class="analisis-item__content">
        <div class="analisis-item__label">Operator Paling Dominan</div>
        <div class="analisis-item__value" style="color:${opColor[dominantOp] || '#1e293b'};">${dominanText}</div>
      </div>
    </div>
    <div class="analisis-item analisis-item--highlight">
      <div class="analisis-item__icon">💡</div>
      <div class="analisis-item__content">
        <div class="analisis-item__label">Rekomendasi</div>
        <div class="analisis-item__value">${rekomendasi}</div>
      </div>
    </div>
    <div class="analisis-item analisis-item--success">
      <div class="analisis-item__icon">📊</div>
      <div class="analisis-item__content">
        <div class="analisis-item__label">Distribusi Operator</div>
        <div class="analisis-item__value" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:4px;">
          <span>➕ ${pct.add}%</span>
          <span>➖ ${pct.sub}%</span>
          <span>✖️ ${pct.mul}%</span>
          <span>➗ ${pct.div}%</span>
        </div>
      </div>
    </div>
  `;
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
  el.loading.innerHTML = `
    <div style="width:20px;height:20px;border:2.5px solid #CBD5E1;border-top-color:var(--clr-blue);border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>
    <span style="font-weight:600;">Memuat ulang data...</span>
  `;
  el.content.style.display = 'none';
  loadDetail();
});

// ========== INIT ==========
loadDetail();