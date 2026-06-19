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
 *   8. Timer & Result Overlay — saat waktu habis / quit
 *   9. Badge & Insight — update real-time
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

  // Result overlay (dari game.html)
  resultOverlay: document.getElementById('result-overlay'),
  resPoin: document.getElementById('res-poin'),
  resStrat: document.getElementById('res-strat'),
  resAcc: document.getElementById('res-acc'),
  resSub: document.getElementById('res-sub'),
  resEmoji: document.getElementById('res-emoji'),
  resTitle: document.getElementById('res-title'),
  resBtns: document.getElementById('res-btns'),
};

// ============================================================================
// §3. STATE APLIKASI
// ============================================================================

const state = {
  session: null,
  tokens: [],
  openParens: 0,
  targetAngka: null,
  idSesi: null,
  submittedExpressions: new Set(),
  sessionScore: 0,
  strategiCount: 0,
  finishModalShown: false,
  isSubmitting: false,
  // Untuk insight / cara berpikir
  opCount: { add: 0, sub: 0, mul: 0, div: 0 },
  totalAttempts: 0, // total percobaan (untuk akurasi)
};

// ============================================================================
// §4. MATH PARSER — Recursive Descent (tanpa eval())
// ============================================================================

function tokenizeExpr(expr) {
  const tokens = [];
  let i = 0;
  const s = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');

  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') { i++; continue; }
    if (/\d/.test(ch)) {
      let num = '';
      while (i < s.length && /[\d.]/.test(s[i])) num += s[i++];
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new SyntaxError(`Karakter tidak dikenal: '${ch}'`);
  }
  return tokens;
}

class MathParser {
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
    if (t.type === 'op' && t.value === '-') {
      this._consume();
      return -this._parseFactor();
    }
    if (t.type === 'op' && t.value === '(') {
      this._consume();
      const val = this._parseExpr();
      this._expect(')');
      return val;
    }
    if (t.type === 'num') {
      this._consume();
      return t.value;
    }
    throw new SyntaxError(`Token tak terduga: '${t.value}'`);
  }
}

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

function tokensToExprString() {
  return state.tokens.map(t => t.value).join(' ');
}

function normalizeExpr(expr) {
  return expr
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-');
}

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
      if (isLastParenClose) return false;
      break;
    case 'operator':
      if (!lastToken || isLastOp || isLastParenOpen) return false;
      break;
    case 'paren_open':
      if (isLastNum || isLastParenClose) return false;
      state.openParens++;
      break;
    case 'paren_close':
      if (state.openParens <= 0) return false;
      if (isLastOp || isLastParenOpen) return false;
      state.openParens--;
      break;
  }
  state.tokens.push(token);
  return true;
}

function popToken() {
  if (state.tokens.length === 0) return;
  const removed = state.tokens.pop();
  if (removed.type === 'paren_open')  state.openParens = Math.max(0, state.openParens - 1);
  if (removed.type === 'paren_close') state.openParens++;
}

function clearTokens() {
  state.tokens     = [];
  state.openParens = 0;
}

// ============================================================================
// §6. RENDER UI — Formula Display & Result Preview
// ============================================================================

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
  const cursor = document.createElement('span');
  cursor.className = 'formula-token formula-token--cursor';
  fragment.appendChild(cursor);
  display.innerHTML = '';
  display.appendChild(fragment);

  const exprStr = tokensToExprString();
  const result  = evaluateExpr(exprStr);
  updateResultPreview(result);

  const hasNumber   = state.tokens.some(t => t.type === 'digit');
  const lastToken   = state.tokens[state.tokens.length - 1];
  const endsValid   = lastToken?.type === 'digit' || lastToken?.type === 'paren_close';
  const parensOk    = state.openParens === 0;
  el.btnSubmit.disabled = !(hasNumber && endsValid && parensOk && result.ok);
}

function updateResultPreview(result) {
  const valEl  = el.resultValue;
  const msgEl  = el.resultStatusMsg;
  if (!result || !result.ok) {
    valEl.textContent  = '?';
    valEl.className    = 'result-preview__value';
    msgEl.textContent  = '';
    return;
  }
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

function updatePotionUI() {
  const count    = state.strategiCount;
  const max      = STRATEGI_TARGET_MIN;
  const pct      = Math.min((count / max) * 100, 100);
  el.potionCountCurrent.textContent = count;
  el.potionCountMax.textContent     = max;
  el.potionLiquid.style.height = `${pct}%`;

  const stars  = Math.min(Math.floor(count / (max / 3)), 3);
  const starEl = el.potionStars;
  starEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    if (i < stars) {
      s.textContent     = '⭐';
      s.style.filter    = 'none';
      s.style.transform = 'scale(1.2)';
      s.style.display   = 'inline-block';
      s.style.animation = `bounceIn 0.4s ${i * 0.1}s ease both`;
    } else {
      s.textContent   = '⭐';
      s.style.filter  = 'grayscale(1) opacity(0.35)';
    }
    starEl.appendChild(s);
  }
}

// ============================================================================
// §8. STRATEGY HISTORY LIST
// ============================================================================

function addStrategyToHistory(formula, poin, index) {
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
  el.strategyList.scrollTop = el.strategyList.scrollHeight;
}

// ============================================================================
// §9. POIN CALCULATION
// ============================================================================

function hitungPoin() {
  const operatorCount = state.tokens.filter(t => t.type === 'operator').length;
  const hasParen      = state.tokens.some(t => t.type === 'paren_open');
  return POIN_DASAR
    + (operatorCount * POIN_BONUS_OPERATOR)
    + (hasParen ? POIN_BONUS_KURUNG : 0);
}

// ============================================================================
// §10. SUBMIT FORMULA (tanpa modal sukses)
// ============================================================================

async function handleSubmit() {
  if (state.isSubmitting) return;
  if (state.tokens.length === 0) return;

  const exprStr = tokensToExprString();
  const result  = evaluateExpr(exprStr);
  state.totalAttempts++; // untuk akurasi

  // Validasi
  if (!result.ok) {
    flashFormula('error');
    showToast('Formula belum lengkap!', 'error');
    return;
  }
  if (result.value !== state.targetAngka) {
    flashFormula('error');
    openModal(el.modalInvalid);
    return;
  }
  const normalized = normalizeExpr(exprStr);
  if (state.submittedExpressions.has(normalized)) {
    flashFormula('error');
    openModal(el.modalDuplicate);
    return;
  }

  // Commit ke Supabase
  state.isSubmitting = true;
  el.btnSubmit.disabled = true;
  el.btnSubmit.textContent = '⏳ Menyimpan...';

  const poin = hitungPoin();

  try {
    const { error: insertError } = await supabase
      .from('detail_strategi')
      .insert({
        id_sesi: state.idSesi,
        ekspresi_matematika: exprStr,
        poin_didapat: poin,
      });
    if (insertError) throw insertError;

    const newTotalSkor = state.session.siswa.total_skor + poin;
    const { error: updateError } = await supabase
      .from('siswa')
      .update({ total_skor: newTotalSkor })
      .eq('id_siswa', state.session.siswa.id_siswa);
    if (updateError) throw updateError;

    // Update state
    state.submittedExpressions.add(normalized);
    state.strategiCount++;
    state.sessionScore += poin;
    state.session.siswa.total_skor = newTotalSkor;
    patchSession({ siswa: state.session.siswa });

    // Akumulasi operator untuk insight
    const oc = countOpsInExpr(exprStr);
    state.opCount.add += oc.add;
    state.opCount.sub += oc.sub;
    state.opCount.mul += oc.mul;
    state.opCount.div += oc.div;

    // Update UI
    el.displayScore.textContent = newTotalSkor;
    spawnScorePopup(poin);
    addStrategyToHistory(exprStr, poin, state.strategiCount);
    updatePotionUI();
    updateBadges();
    updateInsight();
    clearTokens();
    renderFormula();
    flashFormula('correct');

    // Feedback langsung (tanpa modal)
    setFeedback(`🎉 <strong>${exprStr} = ${state.targetAngka}</strong>! +${poin} Poin!`, 'fb-ok');
    setMascot('correct', 'Keren! 🚀');

    // Cek finish (5 strategi)
    if (state.strategiCount >= STRATEGI_TARGET_MIN && !state.finishModalShown) {
      state.finishModalShown = true;
      el.modalFinishScore.textContent = `${state.sessionScore} Poin! 🏆`;
      const stars = Math.min(Math.floor(state.strategiCount / (STRATEGI_TARGET_MIN / 3)), 3);
      el.modalFinishStars.innerHTML = '⭐'.repeat(stars) + '🌟'.repeat(3 - stars);
      setTimeout(() => openModal(el.modalFinish), 400);
    }

  } catch (err) {
    console.error('[Game] Submit error:', err);
    showToast('Gagal menyimpan. Periksa koneksi!', 'error');
  } finally {
    state.isSubmitting = false;
    el.btnSubmit.textContent = '✅ Kirim Rumus!';
  }
}

// Helper untuk menghitung operator dalam ekspresi
function countOpsInExpr(s) {
  return {
    add: (s.match(/\+/g) || []).length,
    sub: (s.match(/\-/g) || []).length,
    mul: (s.match(/×/g) || []).length,
    div: (s.match(/÷/g) || []).length,
  };
}

// ============================================================================
// §11. MODAL MANAGEMENT
// ============================================================================

function openModal(modalEl) {
  modalEl.classList.add('is-open');
  const firstBtn = modalEl.querySelector('button');
  if (firstBtn) setTimeout(() => firstBtn.focus(), 250);
}

function closeModal(modalEl) {
  modalEl.classList.remove('is-open');
  // finish modal handling
  if (modalEl === el.modalFinish) {
    // tidak ada aksi khusus
  }
}

function initModalListeners() {
  el.btnCloseDuplicate.addEventListener('click', () => closeModal(el.modalDuplicate));
  el.btnCloseSuccess.addEventListener('click',   () => closeModal(el.modalSuccess));
  el.btnCloseInvalid.addEventListener('click',   () => closeModal(el.modalInvalid));
  el.btnFinishMore.addEventListener('click', () => closeModal(el.modalFinish));
  el.btnFinishNext.addEventListener('click', () => {
    closeModal(el.modalFinish);
    showToast('Fitur level berikutnya segera hadir! 🚀', 'warn');
  });
  [el.modalDuplicate, el.modalSuccess, el.modalInvalid].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal);
    });
  });
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

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  el.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ============================================================================
// §13. VISUAL FX
// ============================================================================

function flashFormula(stateClass) {
  el.formulaDisplay.classList.remove('state--error', 'state--correct');
  void el.formulaDisplay.offsetWidth;
  el.formulaDisplay.classList.add(`state--${stateClass}`);
  setTimeout(() => el.formulaDisplay.classList.remove(`state--${stateClass}`), 500);
}

function spawnScorePopup(poin) {
  const popup = document.createElement('div');
  popup.className   = 'score-popup';
  popup.textContent = `+${poin}`;
  popup.style.left  = `${Math.random() * 40 + 30}%`;
  popup.style.top   = '80px';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 900);
}

// ============================================================================
// §14. FEEDBACK & MASCOT (tanpa modal)
// ============================================================================

function setFeedback(msg, className) {
  const fb = document.getElementById('feedback');
  if (!fb) return;
  fb.className = 'fb-bar ' + className;
  fb.innerHTML = msg;
}

function setMascot(stateType, msg) {
  const speech = document.getElementById('speech');
  if (!speech) return;
  speech.className = 'speech';
  speech.innerHTML = msg;
  // (opsional) tambahkan animasi mascot jika mau
}

// ============================================================================
// §15. VIRTUAL KEYPAD — Event Listeners
// ============================================================================

function initKeypadListeners() {
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
    if (type === 'digit') {
      const last = state.tokens[state.tokens.length - 1];
      if (last?.type === 'digit') {
        last.value = last.value + value;
        renderFormula();
        return;
      }
      const ok = pushToken({ type: 'digit', value });
      if (ok) renderFormula();
      return;
    }
    if (type === 'operator') {
      const ok = pushToken({ type: 'operator', value });
      if (!ok) showToast('Tidak bisa menempatkan operator di sini.', 'warn');
      else renderFormula();
      return;
    }
    if (type === 'paren') {
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

  // Keyboard fisik
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
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
    if (['+', '−', '×', '÷'].includes(mapped)) {
      const ok = pushToken({ type: 'operator', value: mapped });
      if (ok) renderFormula();
      return;
    }
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
// §16. SUPABASE — Muat Strategi yang Sudah Ada
// ============================================================================

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
    state.sessionScore += row.poin_didapat;
    addStrategyToHistory(row.ekspresi_matematika, row.poin_didapat, idx + 1);
    // Akumulasi opCount dari history (jika perlu)
  });
  updatePotionUI();
  updateBadges();
  updateInsight();
}

// ============================================================================
// §17. BADGE & INSIGHT
// ============================================================================

function updateBadges() {
  const badges = {
    explorer: document.getElementById('badgeExplorer'),
    thinker: document.getElementById('badgeThinker'),
    star: document.getElementById('badgeStar'),
    master: document.getElementById('badgeMaster'),
  };
  Object.values(badges).forEach(el => el?.classList.remove('earned'));
  if (state.strategiCount >= 1) badges.explorer?.classList.add('earned');
  if (state.strategiCount >= 3) badges.thinker?.classList.add('earned');
  if (state.sessionScore >= 50) badges.star?.classList.add('earned');
  if (state.strategiCount >= 5) badges.master?.classList.add('earned');
}

function updateInsight() {
  const total = state.opCount.add + state.opCount.sub + state.opCount.mul + state.opCount.div || 1;
  const pct = k => Math.round(state.opCount[k] / total * 100);
  document.getElementById('pctAdd').textContent = pct('add') + '%';
  document.getElementById('barAdd').style.width = pct('add') + '%';
  document.getElementById('pctMul').textContent = pct('mul') + '%';
  document.getElementById('barMul').style.width = pct('mul') + '%';
  document.getElementById('pctSub').textContent = pct('sub') + '%';
  document.getElementById('barSub').style.width = pct('sub') + '%';
  document.getElementById('pctDiv').textContent = pct('div') + '%';
  document.getElementById('barDiv').style.width = pct('div') + '%';

  const tipEl = document.getElementById('insightTip');
  if (tipEl) {
    const tips = [
      `Coba gunakan <b>perkalian</b> lebih sering!`,
      `Hebat! Kamu sudah coba banyak cara. 🌟`,
      `<b>Pembagian</b> bisa menghasilkan ${state.targetAngka} juga lho!`,
      `Coba kombinasikan <b>+ dan ×</b>!`,
      `Kamu makin kreatif berpikir matematika! 🧠`,
    ];
    tipEl.innerHTML = tips[Math.floor(Math.random() * tips.length)];
  }
}

// ============================================================================
// §18. TIMER & RESULT OVERLAY
// ============================================================================

function endGame() {
  if (window._timerInterval) {
    clearInterval(window._timerInterval);
    window._timerInterval = null;
  }
  showResult();
}

function showResult() {
  const correct = state.strategiCount;
  const acc = state.totalAttempts > 0 ? Math.round((correct / state.totalAttempts) * 100) : 0;
  const total = state.opCount.add + state.opCount.sub + state.opCount.mul + state.opCount.div || 1;
  const pctOf = k => Math.round(state.opCount[k] / total * 100);

  el.resPoin.textContent = state.sessionScore;
  el.resStrat.textContent = state.strategiCount;
  el.resAcc.textContent = acc + '%';

  const studentName = state.session?.siswa?.nama_panggilan || 'Siswa';
  el.resSub.textContent = `${studentName} menemukan ${state.strategiCount} cara! Total poin: ${state.sessionScore}`;

  const emoji = state.strategiCount >= 5 ? '🏆' : state.strategiCount >= 3 ? '🎉' : '⭐';
  const title = state.strategiCount >= 5 ? 'Luar Biasa!' : state.strategiCount >= 3 ? 'Kerja Bagus!' : 'Tetap Semangat!';
  el.resEmoji.textContent = emoji;
  el.resTitle.textContent = title;

  // Update op bars di result
  ['add', 'mul', 'sub', 'div'].forEach(k => {
    const p = pctOf(k);
    document.getElementById('ro-' + k).textContent = p + '%';
    setTimeout(() => document.getElementById('rb-' + k).style.width = p + '%', 300);
  });

  updateBadges();
  el.resultOverlay.classList.add('open');
}

function restartGame() {
  el.resultOverlay.classList.remove('open');
  // Reset state
  state.tokens = [];
  state.openParens = 0;
  state.submittedExpressions = new Set();
  state.strategiCount = 0;
  state.sessionScore = 0;
  state.finishModalShown = false;
  state.isSubmitting = false;
  state.opCount = { add: 0, sub: 0, mul: 0, div: 0 };
  state.totalAttempts = 0;

  // Reset UI
  el.displayScore.textContent = state.session.siswa.total_skor;
  el.strategyList.innerHTML = `<li class="strategy-history__empty" id="strategyEmptyMsg">Belum ada rumus. Yuk, mulai temukan!</li>`;
  updatePotionUI();
  renderFormula();
  if (window._resetTimer) window._resetTimer();
  const fb = document.getElementById('feedback');
  if (fb) {
    fb.className = 'fb-bar fb-idle';
    fb.innerHTML = '✏️ Buat ekspresi matematika yang hasilnya target!';
  }
  updateBadges();
  updateInsight();
}

function goToDashboard() {
  window.location.href = 'dashboard.html';
}

// ============================================================================
// §19. INISIALISASI UTAMA
// ============================================================================

async function init() {
  try {
    const session = requireSiswaSession();
    state.session    = session;
    state.idSesi     = session.sesi_game.id_sesi;
    state.targetAngka = session.sesi_game.target_angka;

    el.displayStudentName.textContent = session.siswa.nama_panggilan;
    el.displayLevel.textContent       = session.sesi_game.level_ke;
    el.displayScore.textContent       = session.siswa.total_skor;

    el.displayTargetNumber.textContent = state.targetAngka;
    el.displayTargetNumber.classList.remove('animate-in');
    void el.displayTargetNumber.offsetWidth;
    el.displayTargetNumber.classList.add('animate-in');

    el.potionCountMax.textContent = STRATEGI_TARGET_MIN;

    await loadExistingStrategies();

    initKeypadListeners();
    initModalListeners();
    renderFormula();
    el.loadingScreen.classList.add('is-hidden');

    // Inisialisasi result listeners (tombol Main Lagi & Ke Dashboard)
    const btnAgain = document.querySelector('.rbtn-again');
    const btnDash = document.querySelector('.rbtn-dash');
    if (btnAgain) btnAgain.addEventListener('click', restartGame);
    if (btnDash) btnDash.addEventListener('click', goToDashboard);

    // Ekspos fungsi ke window untuk timer
    window.endGame = endGame;
    window.restartGame = restartGame;
    window.goToDashboard = goToDashboard;

  } catch (err) {
    if (el.loadingScreen) {
      el.loadingScreen.querySelector('.loading-screen__text').textContent =
        'Terjadi kesalahan. Mengembalikan ke halaman login...';
      setTimeout(() => logout(), 2000);
    }
    console.error('[Game] Init error:', err);
  }
}

// ============================================================================
// §20. UTILITY HELPERS
// ============================================================================

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// §21. BOOTSTRAP
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}