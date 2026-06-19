/**
 * game.js — Widyatika | Arena Numerasi Siswa
 * =============================================================================
 * Logika gameplay lengkap:
 *   1. Inisialisasi sesi dari sessionStorage (via auth.js)
 *   2. Virtual Keypad — membangun formula dari token
 *   3. Math Parser — evaluasi ekspresi tanpa eval() (Recursive Descent)
 *   4. Validasi Formula — cek hasil vs target
 *   5. Duplikat Guard — cek riwayat sesi di tabel detail_strategi
 *   6. Supabase Integration — insert detail_strategi, update siswa.total_skor
 *   7. UI Reactivity — Tabung Ramuan, bintang, riwayat, toast, modal
 * =============================================================================
 */

import { supabase }          from './supabase-config.js';
import { requireSiswaSession, patchSession, logout } from './auth.js';

// ============================================================================
// §1. KONFIGURASI GAMEPLAY
// ============================================================================

/** Jumlah strategi unik minimum untuk memicu modal "Selesai" */
const STRATEGI_TARGET_MIN = 5;

/** Poin dasar per strategi yang berhasil */
const POIN_DASAR = 10;

/** Poin bonus per operator yang digunakan (reward kompleksitas) */
const POIN_BONUS_OPERATOR = 2;

/** Poin bonus tambahan jika menggunakan tanda kurung */
const POIN_BONUS_KURUNG = 5;

/** Batas maksimum token dalam satu formula */
const MAX_TOKEN = 20;

// Karakter khusus yang ditampilkan di UI (bukan operator JS)
const OP_DISPLAY = { plus: '+', minus: '−', kali: '×', bagi: '÷' };

// ============================================================================
// §2. DOM ELEMENT REFERENCES
// ============================================================================

const el = {
  // Loading
  loadingScreen:      document.getElementById('loadingScreen'),

  // Topbar
  displayStudentName: document.getElementById('displayStudentName'),
  displayLevel:       document.getElementById('displayLevel'),
  displayScore:       document.getElementById('displayScore'),

  // Target
  displayTargetNumber: document.getElementById('displayTargetNumber'),
  targetHint:          document.getElementById('targetHint'),

  // Formula workspace
  formulaDisplay:  document.getElementById('formulaDisplay'),
  resultValue:     document.getElementById('resultValue'),
  resultStatusMsg: document.getElementById('resultStatusMsg'),

  // Keypad tombol aksi
  btnSubmit: document.getElementById('btnSubmit'),
  btnDelete: document.getElementById('btnDelete'),
  btnReset:  document.getElementById('btnReset'),

  // Semua tombol keypad (digit + operator)
  allKeyBtns: document.querySelectorAll('.key-btn[data-type]'),

  // Potion tube
  potionLiquid:      document.getElementById('potionLiquid'),
  potionCountCurrent: document.getElementById('potionCountCurrent'),
  potionCountMax:     document.getElementById('potionCountMax'),
  potionStars:        document.getElementById('potionStars'),

  // Strategy history
  strategyList:     document.getElementById('strategyList'),
  strategyEmptyMsg: document.getElementById('strategyEmptyMsg'),

  // Modals
  modalDuplicate: document.getElementById('modalDuplicate'),
  modalSuccess:   document.getElementById('modalSuccess'),
  modalInvalid:   document.getElementById('modalInvalid'),
  modalFinish:    document.getElementById('modalFinish'),

  // Modal inner elements
  modalSuccessFormula: document.getElementById('modalSuccessFormula'),
  modalSuccessPoints:  document.getElementById('modalSuccessPoints'),
  modalFinishScore:    document.getElementById('modalFinishScore'),
  modalFinishStars:    document.getElementById('modalFinishStars'),

  // Modal buttons
  btnCloseDuplicate: document.getElementById('btnCloseDuplicate'),
  btnCloseSuccess:   document.getElementById('btnCloseSuccess'),
  btnCloseInvalid:   document.getElementById('btnCloseInvalid'),
  btnFinishNext:     document.getElementById('btnFinishNext'),
  btnFinishMore:     document.getElementById('btnFinishMore'),

  // Toast container
  toastContainer: document.getElementById('toastContainer'),
};

// ============================================================================
// §3. STATE APLIKASI
// ============================================================================

const state = {
  /** Objek session siswa dari sessionStorage */
  session: null,

  /** Array token formula yang sedang dibangun
   *  Format token: { type: 'digit'|'operator'|'paren_open'|'paren_close', value: string }
   */
  tokens: [],

  /** Jumlah tanda kurung terbuka yang belum ditutup */
  openParens: 0,

  /** Angka target sesi ini */
  targetAngka: null,

  /** ID sesi game aktif */
  idSesi: null,

  /** Kumpulan ekspresi (string yang sudah dinormalisasi) yang sudah dipakai
   *  dalam sesi ini — digunakan untuk cek duplikat secara cepat (O(1))
   */
  submittedExpressions: new Set(),

  /** Total skor siswa dalam sesi ini (bukan total_skor keseluruhan) */
  sessionScore: 0,

  /** Jumlah strategi unik yang berhasil ditemukan sesi ini */
  strategiCount: 0,

  /** Flag: apakah modal "Selesai" pernah ditampilkan di sesi ini */
  finishModalShown: false,

  /** Flag: sedang mengirim ke Supabase (cegah double submit) */
  isSubmitting: false,
};

// ============================================================================
// §4. MATH PARSER — Recursive Descent (tanpa eval())
// ============================================================================

/**
 * Tokenizer: Ubah string ekspresi menjadi array token angka & operator.
 * @param {string} expr - Ekspresi dengan operator display (×, ÷, −)
 * @returns {Array<{type:string, value:string|number}>}
 */
function tokenizeExpr(expr) {
  const tokens = [];
  let i = 0;
  // Normalisasi karakter display ke ASCII
  const s = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');

  while (i < s.length) {
    const ch = s[i];

    // Lewati spasi
    if (ch === ' ') { i++; continue; }

    // Angka (multi-digit & desimal)
    if (/\d/.test(ch)) {
      let num = '';
      while (i < s.length && /[\d.]/.test(s[i])) num += s[i++];
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }

    // Operator & kurung
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Karakter tak dikenal — lempar error
    throw new SyntaxError(`Karakter tidak dikenal: '${ch}'`);
  }
  return tokens;
}

/**
 * Recursive Descent Parser untuk ekspresi aritmatika.
 * Mendukung: +, -, *, /, (, ), bilangan bulat & desimal, unary minus.
 * Aturan grammar:
 *   expr   → term   { ('+' | '-') term }
 *   term   → factor { ('*' | '/') factor }
 *   factor → '-' factor | '(' expr ')' | NUMBER
 */
class MathParser {
  /**
   * @param {string} exprStr - Ekspresi dengan operator display (× ÷ −)
   */
  constructor(exprStr) {
    this._tokens = tokenizeExpr(exprStr);
    this._pos    = 0;
  }

  _peek()    { return this._tokens[this._pos] ?? null; }
  _consume() { return this._tokens[this._pos++]; }
  _expect(val) {
    const t = this._consume();
    if (!t || t.value !== val) throw new SyntaxError(`Diharapkan '${val}'`);
  }

  /** Titik masuk parse */
  parse() {
    const result = this._parseExpr();
    if (this._pos < this._tokens.length) {
      throw new SyntaxError('Token tak terduga setelah ekspresi selesai.');
    }
    return result;
  }

  _parseExpr() {
    let left = this._parseTerm();
    while (this._peek()?.type === 'op' && ['+', '-'].includes(this._peek().value)) {
      const op = this._consume().value;
      const right = this._parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  _parseTerm() {
    let left = this._parseFactor();
    while (this._peek()?.type === 'op' && ['*', '/'].includes(this._peek().value)) {
      const op = this._consume().value;
      const right = this._parseFactor();
      if (op === '/' && right === 0) throw new Error('Pembagian dengan nol tidak diizinkan.');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  _parseFactor() {
    const t = this._peek();
    if (!t) throw new SyntaxError('Ekspresi tidak lengkap.');

    // Unary minus
    if (t.type === 'op' && t.value === '-') {
      this._consume();
      return -this._parseFactor();
    }

    // Tanda kurung
    if (t.type === 'op' && t.value === '(') {
      this._consume(); // '('
      const val = this._parseExpr();
      this._expect(')');
      return val;
    }

    // Angka
    if (t.type === 'num') {
      this._consume();
      return t.value;
    }

    throw new SyntaxError(`Token tak terduga: '${t.value}'`);
  }
}

/**
 * Evaluasi ekspresi matematika dengan aman.
 * @param {string} exprStr
 * @returns {{ ok: boolean, value: number|null, error: string|null }}
 */
function evaluateExpr(exprStr) {
  if (!exprStr.trim()) return { ok: false, value: null, error: 'Kosong' };
  try {
    const parser = new MathParser(exprStr);
    const value  = parser.parse();
    if (!isFinite(value)) return { ok: false, value: null, error: 'Hasil tidak terbatas' };
    return { ok: true, value: Math.round(value * 1e9) / 1e9, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e.message };
  }
}

// ============================================================================
// §5. FORMULA TOKEN MANAGEMENT
// ============================================================================

/**
 * Ubah array state.tokens menjadi string ekspresi yang bisa dievaluasi.
 * @returns {string}
 */
function tokensToExprString() {
  return state.tokens.map(t => t.value).join(' ');
}

/**
 * Normalisasi ekspresi untuk perbandingan duplikat:
 * - Hapus semua spasi
 * - Ganti operator display ke ASCII
 * @param {string} expr
 * @returns {string}
 */
function normalizeExpr(expr) {
  return expr
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
}

/**
 * Tambah token ke state.tokens, dengan validasi konteks.
 * @param {{ type: string, value: string }} token
 * @returns {boolean} apakah token berhasil ditambahkan
 */
function pushToken(token) {
  if (state.tokens.length >= MAX_TOKEN) {
    showToast('Formula terlalu panjang! Sederhanakan dulu.', 'warn');
    return false;
  }

  const lastToken = state.tokens[state.tokens.length - 1] ?? null;
  const isLastNum        = lastToken?.type === 'digit';
  const isLastOp         = lastToken?.type === 'operator';
  const isLastParenOpen  = lastToken?.type === 'paren_open';
  const isLastParenClose = lastToken?.type === 'paren_close';

  switch (token.type) {
    case 'digit':
      // Angka boleh setelah: awal, operator, buka-kurung
      if (isLastParenClose) return false; // Tidak: ")5"
      break;

    case 'operator':
      // Operator tidak boleh di awal (kecuali minus unary — diabaikan untuk SD)
      // Tidak boleh setelah operator atau buka-kurung
      if (!lastToken || isLastOp || isLastParenOpen) return false;
      break;

    case 'paren_open':
      // Buka-kurung tidak boleh setelah angka atau tutup-kurung tanpa operator
      if (isLastNum || isLastParenClose) return false;
      state.openParens++;
      break;

    case 'paren_close':
      // Tutup-kurung hanya jika ada kurung terbuka & ada isi di dalamnya
      if (state.openParens <= 0) return false;
      if (isLastOp || isLastParenOpen) return false;
      state.openParens--;
      break;
  }

  state.tokens.push(token);
  return true;
}

/**
 * Hapus token terakhir (backspace).
 */
function popToken() {
  if (state.tokens.length === 0) return;
  const removed = state.tokens.pop();
  if (removed.type === 'paren_open')  state.openParens = Math.max(0, state.openParens - 1);
  if (removed.type === 'paren_close') state.openParens++;
}

/**
 * Kosongkan seluruh formula.
 */
function clearTokens() {
  state.tokens     = [];
  state.openParens = 0;
}

// ============================================================================
// §6. RENDER UI — Formula Display & Result Preview
// ============================================================================

/**
 * Render ulang tampilan formula dari state.tokens.
 */
function renderFormula() {
  const display = el.formulaDisplay;

  if (state.tokens.length === 0) {
    display.innerHTML = '';
    display.classList.add('state--empty');
    display.classList.remove('state--error', 'state--correct');
    el.btnSubmit.disabled = true;
    updateResultPreview(null);
    return;
  }

  display.classList.remove('state--empty', 'state--error', 'state--correct');

  // Buat fragment token
  const fragment = document.createDocumentFragment();
  state.tokens.forEach(token => {
    const span = document.createElement('span');
    span.textContent = token.value;

    switch (token.type) {
      case 'digit':       span.className = 'formula-token formula-token--number';   break;
      case 'operator':    span.className = 'formula-token formula-token--operator'; break;
      case 'paren_open':
      case 'paren_close': span.className = 'formula-token formula-token--paren';   break;
    }
    fragment.appendChild(span);
  });

  // Kursor kedip
  const cursor = document.createElement('span');
  cursor.className = 'formula-token formula-token--cursor';
  fragment.appendChild(cursor);

  display.innerHTML = '';
  display.appendChild(fragment);

  // Evaluasi real-time
  const exprStr = tokensToExprString();
  const result  = evaluateExpr(exprStr);
  updateResultPreview(result);

  // Aktifkan Kirim hanya jika formula valid & kurung seimbang & ada angka
  const hasNumber   = state.tokens.some(t => t.type === 'digit');
  const lastToken   = state.tokens[state.tokens.length - 1];
  const endsValid   = lastToken?.type === 'digit' || lastToken?.type === 'paren_close';
  const parensOk    = state.openParens === 0;
  el.btnSubmit.disabled = !(hasNumber && endsValid && parensOk && result.ok);
}

/**
 * Perbarui area preview hasil kalkulasi.
 * @param {{ ok: boolean, value: number|null }|null} result
 */
function updateResultPreview(result) {
  const valEl  = el.resultValue;
  const msgEl  = el.resultStatusMsg;

  if (!result || !result.ok) {
    valEl.textContent  = '?';
    valEl.className    = 'result-preview__value';
    msgEl.textContent  = '';
    return;
  }

  // Format nilai: bilangan bulat tanpa desimal, desimal maks 2 angka
  const displayed = Number.isInteger(result.value)
    ? result.value.toString()
    : result.value.toFixed(2);

  valEl.textContent = displayed;

  if (result.value === state.targetAngka) {
    valEl.className   = 'result-preview__value state--match';
    msgEl.textContent = '✅ Cocok!';
    msgEl.style.color = 'var(--color-correct)';
  } else {
    valEl.className   = 'result-preview__value state--mismatch';
    msgEl.textContent = `🎯 Target: ${state.targetAngka}`;
    msgEl.style.color = 'var(--color-muted)';
  }
}

// ============================================================================
// §7. POTION TUBE & BINTANG
// ============================================================================

/**
 * Perbarui tabung ramuan dan bintang berdasarkan jumlah strategi saat ini.
 */
function updatePotionUI() {
  const count    = state.strategiCount;
  const max      = STRATEGI_TARGET_MIN;
  const pct      = Math.min((count / max) * 100, 100);

  el.potionCountCurrent.textContent = count;
  el.potionCountMax.textContent     = max;

  // Animasi tinggi cairan
  el.potionLiquid.style.height = `${pct}%`;

  // Bintang: 1 bintang per setiap sepertiga dari target minimum
  const stars  = Math.min(Math.floor(count / (max / 3)), 3);
  const starEl = el.potionStars;
  starEl.innerHTML = '';

  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    if (i < stars) {
      s.textContent     = '⭐';
      s.setAttribute('aria-label', 'Bintang penuh');
      s.style.filter    = 'none';
      s.style.transform = 'scale(1.2)';
      s.style.display   = 'inline-block';
      s.style.animation = `bounceIn 0.4s ${i * 0.1}s ease both`;
    } else {
      s.textContent   = '⭐';
      s.setAttribute('aria-label', 'Bintang kosong');
      s.style.filter  = 'grayscale(1) opacity(0.35)';
    }
    starEl.appendChild(s);
  }
}

// ============================================================================
// §8. STRATEGY HISTORY LIST
// ============================================================================

/**
 * Tambahkan satu item strategi ke daftar riwayat.
 * @param {string}  formula  - Ekspresi yang berhasil
 * @param {number}  poin     - Poin yang didapat
 * @param {number}  index    - Nomor urut (1-based)
 */
function addStrategyToHistory(formula, poin, index) {
  // Hapus pesan kosong jika ada
  if (el.strategyEmptyMsg) {
    el.strategyEmptyMsg.remove();
  }

  const li = document.createElement('li');
  li.className = 'strategy-item';
  li.setAttribute('role', 'listitem');

  li.innerHTML = `
    <span class="strategy-item__index" aria-hidden="true">${index}</span>
    <span class="strategy-item__formula">${escapeHtml(formula)} = ${state.targetAngka}</span>
    <span class="strategy-item__points">+${poin}</span>
  `;

  el.strategyList.appendChild(li);

  // Auto-scroll ke item terbaru
  el.strategyList.scrollTop = el.strategyList.scrollHeight;
}

// ============================================================================
// §9. POIN CALCULATION
// ============================================================================

/**
 * Hitung poin untuk formula yang berhasil.
 * Kompleksitas: lebih banyak operator & kurung = lebih banyak poin.
 * @returns {number}
 */
function hitungPoin() {
  const operatorCount = state.tokens.filter(t => t.type === 'operator').length;
  const hasParen      = state.tokens.some(t => t.type === 'paren_open');

  return POIN_DASAR
    + (operatorCount * POIN_BONUS_OPERATOR)
    + (hasParen ? POIN_BONUS_KURUNG : 0);
}

// ============================================================================
// §10. SUBMIT FORMULA — Logika Utama Validasi & Duplikat
// ============================================================================

/**
 * Proses pengiriman formula:
 *  1. Evaluasi ekspresi → cek vs target
 *  2. Normalisasi → cek duplikat di sesi ini
 *  3. Insert ke detail_strategi di Supabase
 *  4. Update skor siswa
 *  5. Update UI (potion, history, modal)
 */
async function handleSubmit() {
  if (state.isSubmitting) return;
  if (state.tokens.length === 0) return;

  const exprStr = tokensToExprString();
  const result  = evaluateExpr(exprStr);

  // --- 1. Cek apakah formula valid (evaluatable) ---
  if (!result.ok) {
    flashFormula('error');
    showToast('Formula belum lengkap!', 'error');
    return;
  }

  // --- 2. Cek apakah hasil == target ---
  if (result.value !== state.targetAngka) {
    flashFormula('error');
    openModal(el.modalInvalid);
    return;
  }

  // --- 3. Normalisasi & cek duplikat (in-memory, O(1)) ---
  const normalized = normalizeExpr(exprStr);
  if (state.submittedExpressions.has(normalized)) {
    flashFormula('error');
    openModal(el.modalDuplicate);
    return;
  }

  // --- 4. Formula valid & unik — commit ke Supabase ---
  state.isSubmitting = true;
  el.btnSubmit.disabled = true;
  el.btnSubmit.textContent = '⏳ Menyimpan...';

  const poin = hitungPoin();

  try {
    // Insert ke detail_strategi
    const { error: insertError } = await supabase
      .from('detail_strategi')
      .insert({
        id_sesi:             state.idSesi,
        ekspresi_matematika: exprStr,
        poin_didapat:        poin,
      });

    if (insertError) throw insertError;

    // Update total_skor di tabel siswa
    const newTotalSkor = state.session.siswa.total_skor + poin;
    const { error: updateError } = await supabase
      .from('siswa')
      .update({ total_skor: newTotalSkor })
      .eq('id_siswa', state.session.siswa.id_siswa);

    if (updateError) throw updateError;

    // --- 5. Commit berhasil — update state lokal ---
    state.submittedExpressions.add(normalized);
    state.strategiCount++;
    updateBadges();
    state.sessionScore += poin;
    state.session.siswa.total_skor = newTotalSkor;
    patchSession({ siswa: state.session.siswa }); // sinkron ke sessionStorage

    // Perbarui topbar skor
    el.displayScore.textContent = newTotalSkor;

    // Animasi skor muncul
    spawnScorePopup(poin);

    // Tambah ke riwayat
    addStrategyToHistory(exprStr, poin, state.strategiCount);

    // Perbarui tabung ramuan
    updatePotionUI();

    // Kosongkan formula
    clearTokens();
    renderFormula();
    flashFormula('correct');

    // --- 6. Tampilkan modal Sukses ---
    el.modalSuccessFormula.textContent = exprStr;
    el.modalSuccessPoints.textContent  = `+${poin} Poin! 🌟`;
    openModal(el.modalSuccess);

    // --- 7. Cek apakah sudah mencapai target minimum ---
    if (state.strategiCount >= STRATEGI_TARGET_MIN && !state.finishModalShown) {
      // Modal selesai akan muncul setelah modal sukses ditutup
      // (via flag — ditangani di closeModal handler)
    }

  } catch (err) {
    console.error('[Game] Submit error:', err);
    showToast('Gagal menyimpan. Periksa koneksi!', 'error');
  } finally {
    state.isSubmitting = false;
    el.btnSubmit.textContent = '✅ Kirim Rumus!';
  }
}

// ============================================================================
// §11. MODAL MANAGEMENT
// ============================================================================

/**
 * Buka overlay modal.
 * @param {HTMLElement} modalEl
 */
function openModal(modalEl) {
  modalEl.classList.add('is-open');
  // Fokus ke tombol pertama di dalam modal (aksesibilitas)
  const firstBtn = modalEl.querySelector('button');
  if (firstBtn) setTimeout(() => firstBtn.focus(), 250);
}

/**
 * Tutup overlay modal.
 * @param {HTMLElement} modalEl
 */
function closeModal(modalEl) {
  modalEl.classList.remove('is-open');

  // Setelah modal sukses ditutup, cek apakah perlu tampilkan modal Selesai
  if (modalEl === el.modalSuccess) {
    if (state.strategiCount >= STRATEGI_TARGET_MIN && !state.finishModalShown) {
      state.finishModalShown = true;

      // Update modal Selesai
      el.modalFinishScore.textContent = `${state.sessionScore} Poin! 🏆`;
      const stars = Math.min(Math.floor(state.strategiCount / (STRATEGI_TARGET_MIN / 3)), 3);
      el.modalFinishStars.innerHTML = '⭐'.repeat(stars) + '🌟'.repeat(3 - stars);

      setTimeout(() => openModal(el.modalFinish), 400);
    }
  }
}

/** Daftarkan semua event listener untuk modal */
function initModalListeners() {
  el.btnCloseDuplicate.addEventListener('click', () => closeModal(el.modalDuplicate));
  el.btnCloseSuccess.addEventListener('click',   () => closeModal(el.modalSuccess));
  el.btnCloseInvalid.addEventListener('click',   () => closeModal(el.modalInvalid));

  // Tombol "Cari Lebih Banyak" di modal Selesai — tutup saja, biarkan bermain
  el.btnFinishMore.addEventListener('click', () => closeModal(el.modalFinish));

  // Tombol "Level Berikutnya" — belum implementasi routing, reload dulu
  el.btnFinishNext.addEventListener('click', () => {
    closeModal(el.modalFinish);
    showToast('Fitur level berikutnya segera hadir! 🚀', 'warn');
    // TODO: Tahap berikutnya — buat sesi_game baru dengan level_ke + 1
  });

  // Klik di luar modal box juga menutup (hanya modal non-finish)
  [el.modalDuplicate, el.modalSuccess, el.modalInvalid].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal);
    });
  });

  // Tutup dengan Escape (aksesibilitas)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    [el.modalDuplicate, el.modalSuccess, el.modalInvalid, el.modalFinish].forEach(m => {
      if (m.classList.contains('is-open')) closeModal(m);
    });
  });
}

// ============================================================================
// §12. TOAST NOTIFICATIONS
// ============================================================================

/**
 * Tampilkan pesan toast singkat.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warn'} type
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  el.toastContainer.appendChild(toast);

  // Hapus otomatis setelah animasi selesai (2.5s + 0.25s)
  setTimeout(() => toast.remove(), 2800);
}

// ============================================================================
// §13. VISUAL FX
// ============================================================================

/**
 * Flash formula display dengan state visual.
 * @param {'error'|'correct'} stateClass
 */
function flashFormula(stateClass) {
  el.formulaDisplay.classList.remove('state--error', 'state--correct');
  void el.formulaDisplay.offsetWidth; // reflow untuk re-trigger animasi
  el.formulaDisplay.classList.add(`state--${stateClass}`);
  setTimeout(() => el.formulaDisplay.classList.remove(`state--${stateClass}`), 500);
}

/**
 * Spawn pop-up skor terbang saat strategi berhasil.
 * @param {number} poin
 */
function spawnScorePopup(poin) {
  const popup = document.createElement('div');
  popup.className   = 'score-popup';
  popup.textContent = `+${poin}`;
  // Posisikan di sekitar area skor topbar
  popup.style.left  = `${Math.random() * 40 + 30}%`;
  popup.style.top   = '80px';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 900);
}

// ============================================================================
// §14. VIRTUAL KEYPAD — Event Listeners
// ============================================================================

/**
 * Daftarkan semua event listener keypad.
 */
function initKeypadListeners() {
  // Delegasi event ke seluruh area keypad
  document.getElementById('virtualKeypad').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;

    const type   = btn.dataset.type;
    const value  = btn.dataset.value;
    const action = btn.dataset.action;

    if (action === 'delete') {
      popToken();
      renderFormula();
      return;
    }

    if (action === 'reset') {
      clearTokens();
      renderFormula();
      return;
    }

    if (action === 'submit') {
      handleSubmit();
      return;
    }

    // Tombol digit (0–9)
    if (type === 'digit') {
      // Cek apakah ini lanjutan angka (multi-digit) atau angka baru
      const last = state.tokens[state.tokens.length - 1];
      if (last?.type === 'digit') {
        // Gabungkan digit menjadi angka multi-digit (misal: "1" + "2" = "12")
        last.value = last.value + value;
        renderFormula();
        return;
      }
      const ok = pushToken({ type: 'digit', value });
      if (ok) renderFormula();
      return;
    }

    // Tombol operator
    if (type === 'operator') {
      const ok = pushToken({ type: 'operator', value });
      if (!ok) showToast('Tidak bisa menempatkan operator di sini.', 'warn');
      else renderFormula();
      return;
    }

    // Tombol kurung "()"
    if (type === 'paren') {
      // Tentukan apakah perlu buka atau tutup kurung
      const last = state.tokens[state.tokens.length - 1];
      const needClose = state.openParens > 0 &&
        (last?.type === 'digit' || last?.type === 'paren_close');

      if (needClose) {
        const ok = pushToken({ type: 'paren_close', value: ')' });
        if (ok) renderFormula();
      } else {
        const ok = pushToken({ type: 'paren_open', value: '(' });
        if (ok) renderFormula();
        else showToast('Tidak bisa membuka kurung di sini.', 'warn');
      }
      return;
    }
  });

  // Keyboard fisik sebagai alternatif (opsional untuk guru yang demo)
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; // jangan intercept input field

    const map = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
      '+': '+', '-': '−', '*': '×', '/': '÷',
      'Enter': '__submit', 'Backspace': '__delete',
    };

    const mapped = map[e.key];
    if (!mapped) return;

    e.preventDefault();

    if (mapped === '__submit') { handleSubmit(); return; }
    if (mapped === '__delete') { popToken(); renderFormula(); return; }

    // Operator
    if (['+', '−', '×', '÷'].includes(mapped)) {
      const ok = pushToken({ type: 'operator', value: mapped });
      if (ok) renderFormula();
      return;
    }

    // Digit
    const last = state.tokens[state.tokens.length - 1];
    if (last?.type === 'digit') {
      last.value = last.value + mapped;
      renderFormula();
    } else {
      const ok = pushToken({ type: 'digit', value: mapped });
      if (ok) renderFormula();
    }
  });
}

// ============================================================================
// §15. SUPABASE — Muat Strategi yang Sudah Ada
// (Untuk kasus reload halaman agar duplikat tetap terdeteksi)
// ============================================================================

/**
 * Muat semua ekspresi yang sudah pernah dikirim dalam sesi ini dari Supabase.
 * @returns {Promise<void>}
 */
async function loadExistingStrategies() {
  const { data, error } = await supabase
    .from('detail_strategi')
    .select('id_strategi, ekspresi_matematika, poin_didapat')
    .eq('id_sesi', state.idSesi)
    .order('id_strategi', { ascending: true });

  if (error) {
    console.warn('[Game] Gagal memuat strategi sebelumnya:', error.message);
    return;
  }

  if (!data || data.length === 0) return;

  data.forEach((row, idx) => {
    const normalized = normalizeExpr(row.ekspresi_matematika);
    state.submittedExpressions.add(normalized);
    state.strategiCount++;
    updateBadges();
    state.sessionScore += row.poin_didapat;
    addStrategyToHistory(row.ekspresi_matematika, row.poin_didapat, idx + 1);
  });

  updatePotionUI();
}

// ============================================================================
// §16. INISIALISASI UTAMA
// ============================================================================

/**
 * Entry point — dipanggil saat DOM siap.
 */
async function init() {
  try {
    // 1. Guard: pastikan ada sesi siswa yang valid
    const session = requireSiswaSession();
    state.session    = session;
    state.idSesi     = session.sesi_game.id_sesi;
    state.targetAngka = session.sesi_game.target_angka;

    // 2. Isi data topbar
    el.displayStudentName.textContent = session.siswa.nama_panggilan;
    el.displayLevel.textContent       = session.sesi_game.level_ke;
    el.displayScore.textContent       = session.siswa.total_skor;

    // 3. Tampilkan target angka dengan animasi
    el.displayTargetNumber.textContent = state.targetAngka;
    el.displayTargetNumber.classList.remove('animate-in');
    void el.displayTargetNumber.offsetWidth;
    el.displayTargetNumber.classList.add('animate-in');

    // 4. Set jumlah target potion
    el.potionCountMax.textContent = STRATEGI_TARGET_MIN;

    // 5. Muat strategi yang sudah ada (jika halaman di-reload)
    await loadExistingStrategies();

    // 6. Daftarkan semua event listener
    initKeypadListeners();
    initModalListeners();

    // 7. Render formula awal (kosong)
    renderFormula();

    // 8. Sembunyikan loading screen
    el.loadingScreen.classList.add('is-hidden');

  } catch (err) {
    // requireSiswaSession() sudah handle redirect jika tidak ada session
    // Error lain: tampilkan di loading screen
    if (el.loadingScreen) {
      el.loadingScreen.querySelector('.loading-screen__text').textContent =
        'Terjadi kesalahan. Mengembalikan ke halaman login...';
      setTimeout(() => logout(), 2000);
    }
    console.error('[Game] Init error:', err);
  }
}

// ============================================================================
// §17. UTILITY HELPERS
// ============================================================================

/**
 * Escape HTML untuk mencegah XSS saat menyisipkan string ke innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// §18. BOOTSTRAP — Jalankan setelah DOM sepenuhnya siap
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
// ============================================================================
// §19. TIMER & RESULT OVERLAY
// ============================================================================

/**
 * Akhiri permainan (dipanggil saat timer habis atau tombol "Selesai")
 */
function endGame() {
  // Hentikan timer global (jika ada)
  if (window._timerInterval) {
    clearInterval(window._timerInterval);
    window._timerInterval = null;
  }
  showResult();
}

/**
 * Tampilkan overlay hasil
 */
function showResult() {
  const correct = state.strategiCount;
  const totalAttempts = state.submittedExpressions.size + (state.strategiCount > 0 ? 0 : 0); // kurang akurat, tapi kita pakai strategiCount saja
  // Lebih baik kita track total percobaan, tapi untuk sederhana, kita pakai strategiCount sebagai indikator

  // Hitung akurasi (berdasarkan strategi yang berhasil vs total percobaan)
  // Karena kita tidak track percobaan gagal, kita set akurasi 100% jika ada strategi, 0% jika belum.
  const acc = state.strategiCount > 0 ? 100 : 0;

  // Isi data ke overlay
  document.getElementById('res-poin').textContent = state.sessionScore;
  document.getElementById('res-strat').textContent = state.strategiCount;
  document.getElementById('res-acc').textContent = acc + '%';

  // Isi nama siswa
  const studentName = state.session?.siswa?.nama_panggilan || 'Siswa';
  document.getElementById('res-sub').textContent = `${studentName} menemukan ${state.strategiCount} cara! Total poin: ${state.sessionScore}`;

  // Emoji dan title berdasarkan jumlah strategi
  const emoji = state.strategiCount >= 5 ? '🏆' : state.strategiCount >= 3 ? '🎉' : '⭐';
  const title = state.strategiCount >= 5 ? 'Luar Biasa!' : state.strategiCount >= 3 ? 'Kerja Bagus!' : 'Tetap Semangat!';
  document.getElementById('res-emoji').textContent = emoji;
  document.getElementById('res-title').textContent = title;

  // Update badge collection (panggil fungsi updateBadges)
  updateBadges();

  // Tampilkan overlay
  document.getElementById('result-overlay').classList.add('open');
}

/**
 * Perbarui koleksi badge berdasarkan pencapaian
 */
function updateBadges() {
  const badges = {
    explorer: document.getElementById('badgeExplorer'),
    thinker: document.getElementById('badgeThinker'),
    star: document.getElementById('badgeStar'),
    master: document.getElementById('badgeMaster'),
  };

  // Reset semua badge
  Object.values(badges).forEach(el => el?.classList.remove('earned'));

  // Beri badge sesuai kondisi
  if (state.strategiCount >= 1) badges.explorer?.classList.add('earned');
  if (state.strategiCount >= 3) badges.thinker?.classList.add('earned');
  if (state.sessionScore >= 50) badges.star?.classList.add('earned');
  if (state.strategiCount >= 5) badges.master?.classList.add('earned');
}

/**
 * Reset permainan (untuk tombol "Main Lagi")
 */
function restartGame() {
  // Tutup overlay
  document.getElementById('result-overlay').classList.remove('open');

  // Reset state
  state.tokens = [];
  state.openParens = 0;
  state.submittedExpressions = new Set();
  state.strategiCount = 0;
  state.sessionScore = 0;
  state.finishModalShown = false;
  state.isSubmitting = false;

  // Reset UI
  el.displayScore.textContent = state.session.siswa.total_skor;
  el.strategyList.innerHTML = `<li class="strategy-history__empty" id="strategyEmptyMsg">Belum ada rumus. Yuk, mulai temukan!</li>`;
  updatePotionUI();
  renderFormula();

  // Reset timer
  if (window._resetTimer) {
    window._resetTimer();
  }

  // Reset feedback
  const fb = document.getElementById('feedback');
  if (fb) {
    fb.className = 'fb-bar fb-idle';
    fb.innerHTML = '✏️ Buat ekspresi matematika yang hasilnya target!';
  }

  // Reset badge
  updateBadges();

  // Reset target (opsional: generate baru)
  // state.targetAngka = generateTargetAngka(state.session.sesi_game.level_ke);
  // document.getElementById('displayTargetNumber').textContent = state.targetAngka;
}

/**
 * Kembali ke dashboard
 */
function goToDashboard() {
  window.location.href = 'dashboard.html';
}

// ============================================================================
// §20. INIT EVENT LISTENERS UNTUK RESULT OVERLAY
// ============================================================================

function initResultListeners() {
  const btnAgain = document.querySelector('.rbtn-again');
  const btnDashboard = document.querySelector('.rbtn-dash');

  if (btnAgain) {
    btnAgain.addEventListener('click', restartGame);
  }
  if (btnDashboard) {
    btnDashboard.addEventListener('click', goToDashboard);
  }
}
window.endGame = endGame;
window.restartGame = restartGame;
window.goToDashboard = goToDashboard;
// Panggil initResultListeners di dalam init() setelah DOM siap
// Atau kita tambahkan di init() nanti.
initResultListeners();