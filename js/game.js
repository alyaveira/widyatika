/**
 * game.js — Widyatika | Arena Numerasi Siswa
 * =============================================================================
 * Dengan:
 *   - Riwayat semua percobaan (benar/salah)
 *   - Confetti saat jawaban benar
 *   - Ramuan interaktif
 *   - Badge, insight, koleksi rumus (strategi)
 * =============================================================================
 */
import { supabase } from './supabase-config.js';
import { requireSiswaSession, patchSession, logout, generateTargetAngka } from './auth.js';

// ============================================================================
// KONFIGURASI
// ============================================================================
const STRATEGI_TARGET_MIN = 5;
const POIN_DASAR = 10;
const POIN_BONUS_OPERATOR = 2;
const POIN_BONUS_KURUNG = 5;
const MAX_TOKEN = 20;

// ============================================================================
// DOM REFS
// ============================================================================
const el = {
  loadingScreen: document.getElementById('loadingScreen'),
  displayStudentName: document.getElementById('displayStudentName'),
  displayLevel: document.getElementById('displayLevel'),
  displayScore: document.getElementById('displayScore'),
  displayTargetNumber: document.getElementById('displayTargetNumber'),
  targetHint: document.getElementById('targetHint'),
  formulaDisplay: document.getElementById('formulaDisplay'),
  resultValue: document.getElementById('resultValue'),
  resultStatusMsg: document.getElementById('resultStatusMsg'),
  btnSubmit: document.getElementById('btnSubmit'),
  potionLiquid: document.getElementById('potionLiquid'),
  potionCountCurrent: document.getElementById('potionCountCurrent'),
  potionCountMax: document.getElementById('potionCountMax'),
  potionStars: document.getElementById('potionStars'),
  strategyList: document.getElementById('strategyList'),
  strategyEmptyMsg: document.getElementById('strategyEmptyMsg'),
  stratBadge: document.getElementById('stratBadge'),
  historyAllList: document.getElementById('historyAllList'),
  modalDuplicate: document.getElementById('modalDuplicate'),
  modalSuccess: document.getElementById('modalSuccess'),
  modalInvalid: document.getElementById('modalInvalid'),
  modalFinish: document.getElementById('modalFinish'),
  modalSuccessFormula: document.getElementById('modalSuccessFormula'),
  modalSuccessPoints: document.getElementById('modalSuccessPoints'),
  modalFinishScore: document.getElementById('modalFinishScore'),
  modalFinishStars: document.getElementById('modalFinishStars'),
  btnCloseDuplicate: document.getElementById('btnCloseDuplicate'),
  btnCloseSuccess: document.getElementById('btnCloseSuccess'),
  btnCloseInvalid: document.getElementById('btnCloseInvalid'),
  btnFinishNext: document.getElementById('btnFinishNext'),
  btnFinishMore: document.getElementById('btnFinishMore'),
  toastContainer: document.getElementById('toastContainer'),
  confettiLayer: document.getElementById('confettiLayer'),
  // Result overlay
  resultOverlay: document.getElementById('result-overlay'),
  resPoin: document.getElementById('res-poin'),
  resStrat: document.getElementById('res-strat'),
  resAcc: document.getElementById('res-acc'),
  resEmoji: document.getElementById('res-emoji'),
  resTitle: document.getElementById('res-title'),
  resSub: document.getElementById('res-sub'),
  rbtnAgain: document.getElementById('rbtn-again'),
  rbtnDash: document.getElementById('rbtn-dash'),
  roAdd: document.getElementById('ro-add'),
  roMul: document.getElementById('ro-mul'),
  roSub: document.getElementById('ro-sub'),
  roDiv: document.getElementById('ro-div'),
  rbAdd: document.getElementById('rb-add'),
  rbMul: document.getElementById('rb-mul'),
  rbSub: document.getElementById('rb-sub'),
  rbDiv: document.getElementById('rb-div'),
};

// ============================================================================
// STATE
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
  opCount: { add: 0, sub: 0, mul: 0, div: 0 },
  allHistory: [],
};

// ============================================================================
// MATH PARSER (tidak diubah, tetap sama)
// ============================================================================
function tokenizeExpr(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
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
    this._pos = 0;
  }
  _peek() { return this._tokens[this._pos] ?? null; }
  _consume() { return this._tokens[this._pos++]; }
  _expect(val) {
    const t = this._consume();
    if (!t || t.value !== val) throw new SyntaxError(`Diharapkan '${val}'`);
  }
  parse() {
    const result = this._parseExpr();
    if (this._pos < this._tokens.length) throw new SyntaxError('Token tak terduga.');
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
    const value = parser.parse();
    if (!isFinite(value)) return { ok: false, value: null, error: 'Hasil tidak terbatas' };
    return { ok: true, value: Math.round(value * 1e9) / 1e9, error: null };
  } catch (e) {
    return { ok: false, value: null, error: e.message };
  }
}

// ============================================================================
// TOKEN MANAGEMENT & RENDER
// ============================================================================
function tokensToExprString() { return state.tokens.map(t => t.value).join(' '); }

function normalizeExpr(expr) {
  return expr.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
}

function pushToken(token) {
  if (state.tokens.length >= MAX_TOKEN) {
    showToast('Formula terlalu panjang!', 'warn');
    return false;
  }
  const last = state.tokens[state.tokens.length - 1] ?? null;
  const isLastNum = last?.type === 'digit';
  const isLastOp = last?.type === 'operator';
  const isLastParenOpen = last?.type === 'paren_open';
  const isLastParenClose = last?.type === 'paren_close';
  switch (token.type) {
    case 'digit':
      if (isLastParenClose) return false;
      break;
    case 'operator':
      if (!last || isLastOp || isLastParenOpen) return false;
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
  if (removed.type === 'paren_open') state.openParens = Math.max(0, state.openParens - 1);
  if (removed.type === 'paren_close') state.openParens++;
}

function clearTokens() {
  state.tokens = [];
  state.openParens = 0;
}

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
      case 'digit': span.className = 'formula-token formula-token--number'; break;
      case 'operator': span.className = 'formula-token formula-token--operator'; break;
      case 'paren_open':
      case 'paren_close': span.className = 'formula-token formula-token--paren'; break;
    }
    fragment.appendChild(span);
  });
  const cursor = document.createElement('span');
  cursor.className = 'formula-token formula-token--cursor';
  fragment.appendChild(cursor);
  display.innerHTML = '';
  display.appendChild(fragment);

  const exprStr = tokensToExprString();
  const result = evaluateExpr(exprStr);
  updateResultPreview(result);
  const hasNumber = state.tokens.some(t => t.type === 'digit');
  const lastToken = state.tokens[state.tokens.length - 1];
  const endsValid = lastToken?.type === 'digit' || lastToken?.type === 'paren_close';
  const parensOk = state.openParens === 0;
  el.btnSubmit.disabled = !(hasNumber && endsValid && parensOk && result.ok);
}

function updateResultPreview(result) {
  const valEl = el.resultValue;
  const msgEl = el.resultStatusMsg;
  if (!result || !result.ok) {
    valEl.textContent = '?';
    valEl.className = 'result-preview__value';
    msgEl.textContent = '';
    return;
  }
  const displayed = Number.isInteger(result.value) ? result.value.toString() : result.value.toFixed(2);
  valEl.textContent = displayed;
  if (result.value === state.targetAngka) {
    valEl.className = 'result-preview__value state--match';
    msgEl.textContent = '✅ Cocok!';
    msgEl.style.color = '#10b981';
  } else {
    valEl.className = 'result-preview__value state--mismatch';
    msgEl.textContent = `🎯 Target: ${state.targetAngka}`;
    msgEl.style.color = '#6b7280';
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================
function setFeedback(msg, className) {
  const fb = document.getElementById('feedback');
  if (!fb) return;
  fb.className = 'fb-bar ' + className;
  fb.innerHTML = msg;
}

function setMascot(stateClass, msg) {
  const speech = document.getElementById('speech');
  if (!speech) return;
  speech.className = 'speech';
  speech.innerHTML = msg;
}

function flashFormula(stateClass) {
  el.formulaDisplay.classList.remove('state--error', 'state--correct');
  void el.formulaDisplay.offsetWidth;
  el.formulaDisplay.classList.add(`state--${stateClass}`);
  setTimeout(() => el.formulaDisplay.classList.remove(`state--${stateClass}`), 500);
}

function spawnScorePopup(poin) {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = `+${poin}`;
  popup.style.left = `${Math.random() * 40 + 30}%`;
  popup.style.top = '80px';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 900);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ============================================================================
// CONFETTI
// ============================================================================
function shootConfetti() {
  const layer = el.confettiLayer;
  const colors = ['#6c3ef4', '#10b981', '#f97316', '#ec4899', '#fbbf24', '#3b82f6', '#ef4444'];
  for (let i = 0; i < 48; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const size = 6 + Math.random() * 10;
    p.style.cssText = `
      left:${Math.random() * 100}vw; top:-20px;
      background:${colors[i % colors.length]};
      border-radius:${Math.random() > .5 ? '50%' : '3px'};
      width:${size}px; height:${size * (0.6 + Math.random() * 0.8)}px;
      animation-duration:${1.2 + Math.random() * 1.8}s;
      animation-delay:${Math.random() * .6}s;
      transform: rotate(${Math.random() * 360}deg);
    `;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3500);
  }
}

// ============================================================================
// POTION & HISTORY
// ============================================================================
function updatePotionUI() {
  const count = state.strategiCount;
  const max = STRATEGI_TARGET_MIN;
  const pct = Math.min((count / max) * 100, 100);
  el.potionCountCurrent.textContent = count;
  el.potionCountMax.textContent = max;
  el.potionLiquid.style.height = `${pct}%`;

  const stars = Math.min(Math.floor(count / (max / 3)), 3);
  const starEl = el.potionStars;
  starEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    if (i < stars) {
      s.textContent = '⭐';
      s.style.filter = 'none';
      s.style.transform = 'scale(1.2)';
      s.style.display = 'inline-block';
      s.style.animation = `bounceIn 0.4s ${i * 0.1}s ease both`;
    } else {
      s.textContent = '⭐';
      s.style.filter = 'grayscale(1) opacity(0.35)';
    }
    starEl.appendChild(s);
  }
}

function addStrategyToHistory(formula, poin, index) {
  if (el.strategyEmptyMsg) el.strategyEmptyMsg.remove();
  const li = document.createElement('li');
  li.className = 'strategy-item';
  li.innerHTML = `
    <span class="si-expr">${escapeHtml(formula)} = ${state.targetAngka}</span>
    <span class="si-points">+${poin}</span>
  `;
  el.strategyList.appendChild(li);
  el.strategyList.scrollTop = el.strategyList.scrollHeight;
}

function renderAllHistory() {
  const list = el.historyAllList;
  if (!state.allHistory.length) {
    list.innerHTML = '<div class="empty-msg">Belum ada jawaban.<br>Ayo mulai! 💪</div>';
    return;
  }
  list.innerHTML = state.allHistory.slice(0, 12).map(h => {
    const icon = h.ok ? '✅' : '❌';
    const val = h.ok ? `= ${h.val}` : `= ${h.val} (×)`;
    const cls = h.ok ? 'ha-ok' : 'ha-bad';
    return `<div class="hist-all-item"><span class="ha-expr">${escapeHtml(h.expr)}</span><span class="${cls}">${icon} ${escapeHtml(val)}</span></div>`;
  }).join('');
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

// ============================================================================
// INSIGHT & BADGE
// ============================================================================
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

// ============================================================================
// SUBMIT
// ============================================================================
function hitungPoin() {
  const operatorCount = state.tokens.filter(t => t.type === 'operator').length;
  const hasParen = state.tokens.some(t => t.type === 'paren_open');
  return POIN_DASAR + (operatorCount * POIN_BONUS_OPERATOR) + (hasParen ? POIN_BONUS_KURUNG : 0);
}

function countOpsInExpr(s) {
  return {
    add: (s.match(/\+/g) || []).length,
    sub: (s.match(/\-/g) || []).length,
    mul: (s.match(/×/g) || []).length,
    div: (s.match(/÷/g) || []).length,
  };
}

async function handleSubmit() {
  if (state.isSubmitting) return;
  if (state.tokens.length === 0) return;

  const exprStr = tokensToExprString();
  const result = evaluateExpr(exprStr);

  if (!result.ok) {
    flashFormula('error');
    showToast('Formula belum lengkap!', 'error');
    return;
  }

  const ok = Math.abs(result.value - state.targetAngka) < 0.0001;
  state.allHistory.unshift({ expr: exprStr, ok, val: result.value });
  renderAllHistory();

  if (!ok) {
    flashFormula('error');
    setFeedback(`😬 <strong>${exprStr} = ${result.value}</strong>, bukan ${state.targetAngka}. Coba lagi!`, 'fb-bad');
    setMascot('wrong', 'Belum tepat, coba lagi! 💪');
    clearTokens();
    renderFormula();
    return;
  }

  const normalized = normalizeExpr(exprStr);
  if (state.submittedExpressions.has(normalized)) {
    flashFormula('error');
    openModal(el.modalDuplicate);
    clearTokens();
    renderFormula();
    return;
  }

  state.isSubmitting = true;
  el.btnSubmit.disabled = true;
  el.btnSubmit.textContent = '⏳ Menyimpan...';
  const poin = hitungPoin();

  try {
// 🔥 PAKAI FETCH MANUAL
const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';

// Insert detail_strategi
const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/detail_strategi`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    id_sesi: state.idSesi,
    ekspresi_matematika: exprStr,
    poin_didapat: poin,
  }),
});
if (!insertResponse.ok) {
  const errData = await insertResponse.json();
  throw new Error(errData.message || 'Insert detail_strategi gagal');
}

// Update total_skor siswa
const newTotalSkor = state.session.siswa.total_skor + poin;
const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/siswa?id_siswa=eq.${state.session.siswa.id_siswa}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ total_skor: newTotalSkor }),
});
if (!updateResponse.ok) {
  const errData = await updateResponse.json();
  throw new Error(errData.message || 'Update siswa gagal');
}

    state.submittedExpressions.add(normalized);
    state.strategiCount++;
    el.stratBadge.textContent = `🔎 ${state.strategiCount} cara ditemukan`;
    state.sessionScore += poin;
    state.session.siswa.total_skor = newTotalSkor;
    patchSession({ siswa: state.session.siswa });

    const oc = countOpsInExpr(exprStr);
    state.opCount.add += oc.add;
    state.opCount.sub += oc.sub;
    state.opCount.mul += oc.mul;
    state.opCount.div += oc.div;

    el.displayScore.textContent = newTotalSkor;
    spawnScorePopup(poin);
    addStrategyToHistory(exprStr, poin, state.strategiCount);
    updatePotionUI();
    updateInsight();
    updateBadges();
    clearTokens();
    renderFormula();
    flashFormula('correct');
    shootConfetti();

    setFeedback(`🎉 <strong>${exprStr} = ${state.targetAngka}</strong>! +${poin} Poin!`, 'fb-ok');
    setMascot('correct', 'Keren! 🚀');

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

// ============================================================================
// MODALS
// ============================================================================
function openModal(modalEl) {
  if (modalEl.classList.contains('is-open')) return;
  modalEl.classList.add('is-open');
  const firstBtn = modalEl.querySelector('button');
  if (firstBtn) setTimeout(() => firstBtn.focus(), 250);
}

function closeModal(modalEl) {
  modalEl.classList.remove('is-open');
}

function initModalListeners() {
  el.btnFinishNext.addEventListener('click', async () => {
  closeModal(el.modalFinish);
  const newLevel = (state.session.sesi_game.level_ke || 1) + 1;
  const newTarget = generateTargetAngka(newLevel);
  const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sesi_game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id_siswa: state.session.siswa.id_siswa,
        level_ke: newLevel,
        target_angka: newTarget,
        status_selesai: false,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const newSesi = data[0]; // karena return=representation mengembalikan array
    patchSession({ sesi_game: { id_sesi: newSesi.id_sesi, level_ke: newSesi.level_ke, target_angka: newSesi.target_angka, status_selesai: newSesi.status_selesai } });
    window.location.reload();
  } catch (err) {
    console.error('[Level Next] Error:', err);
    showToast('Gagal membuat level berikutnya.', 'error');
  }
});
  [el.modalDuplicate, el.modalSuccess, el.modalInvalid, el.modalFinish].forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    [el.modalDuplicate, el.modalSuccess, el.modalInvalid, el.modalFinish].forEach(m => {
      if (m.classList.contains('is-open')) closeModal(m);
    });
  });
}

// ============================================================================
// KEYPAD
// ============================================================================
function initKeypadListeners() {
  document.getElementById('virtualKeypad').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const type = btn.dataset.type;
    const value = btn.dataset.value;
    const action = btn.dataset.action;
    if (action === 'delete') { popToken(); renderFormula(); return; }
    if (action === 'reset') { clearTokens(); renderFormula(); return; }
    if (action === 'submit') { handleSubmit(); return; }
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
      const needClose = state.openParens > 0 && (last?.type === 'digit' || last?.type === 'paren_close');
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
// LOAD EXISTING STRATEGIES
// ============================================================================
async function loadExistingStrategies() {
  const SUPABASE_URL = 'https://cezzczjzwvnncvygmbog.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable__s-RNakT53QIIph7_KN1RA_-RBxMM6e';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/detail_strategi?select=id_strategi,ekspresi_matematika,poin_didapat&id_sesi=eq.${state.idSesi}&order=id_strategi.asc`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      }
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    if (!data || data.length === 0) return;
    data.forEach((row, idx) => {
      const normalized = normalizeExpr(row.ekspresi_matematika);
      state.submittedExpressions.add(normalized);
      state.strategiCount++;
      el.stratBadge.textContent = `🔎 ${state.strategiCount} cara ditemukan`;
      state.sessionScore += row.poin_didapat;
      addStrategyToHistory(row.ekspresi_matematika, row.poin_didapat, idx + 1);
    });
    updatePotionUI();
    updateBadges();
    updateInsight();
  } catch (error) {
    console.warn('[Game] Gagal memuat strategi sebelumnya:', error.message);
  }
}

// ============================================================================
// RESULT OVERLAY
// ============================================================================
function showResult() {
  if (state.finishModalShown) return;
  const acc = state.strategiCount > 0 ? 100 : 0;
  el.resPoin.textContent = state.sessionScore;
  el.resStrat.textContent = state.strategiCount;
  el.resAcc.textContent = acc + '%';
  const studentName = state.session?.siswa?.nama_panggilan || 'Siswa';
  el.resSub.textContent = `${studentName} menemukan ${state.strategiCount} cara! Total poin: ${state.sessionScore}`;
  const emoji = state.strategiCount >= 5 ? '🏆' : state.strategiCount >= 3 ? '🎉' : '⭐';
  el.resEmoji.textContent = emoji;
  el.resTitle.textContent = state.strategiCount >= 5 ? 'Luar Biasa!' : state.strategiCount >= 3 ? 'Kerja Bagus!' : 'Tetap Semangat!';
  const total = state.opCount.add + state.opCount.sub + state.opCount.mul + state.opCount.div || 1;
  const pctOf = k => Math.round(state.opCount[k] / total * 100);
  ['add', 'mul', 'sub', 'div'].forEach(k => {
    const p = pctOf(k);
    if (k === 'add') { el.roAdd.textContent = p + '%'; setTimeout(() => el.rbAdd.style.width = p + '%', 300); }
    if (k === 'mul') { el.roMul.textContent = p + '%'; setTimeout(() => el.rbMul.style.width = p + '%', 300); }
    if (k === 'sub') { el.roSub.textContent = p + '%'; setTimeout(() => el.rbSub.style.width = p + '%', 300); }
    if (k === 'div') { el.roDiv.textContent = p + '%'; setTimeout(() => el.rbDiv.style.width = p + '%', 300); }
  });
  el.resultOverlay.classList.add('open');
}

function endGame() {
  if (window._timerInterval) {
    clearInterval(window._timerInterval);
    window._timerInterval = null;
  }
  showResult();
}

function restartGame() {
  el.resultOverlay.classList.remove('open');
  state.tokens = [];
  state.openParens = 0;
  state.submittedExpressions = new Set();
  state.strategiCount = 0;
  state.sessionScore = 0;
  state.finishModalShown = false;
  state.isSubmitting = false;
  state.opCount = { add: 0, sub: 0, mul: 0, div: 0 };
  state.allHistory = [];
  el.displayScore.textContent = state.session.siswa.total_skor;
  el.strategyList.innerHTML = `<div class="empty-msg" id="strategyEmptyMsg">Belum ada rumus.<br>Ayo mulai! 💪</div>`;
  renderAllHistory();
  updatePotionUI();
  renderFormula();
  updateInsight();
  updateBadges();
  setFeedback('✏️ Buat ekspresi matematika yang hasilnya target!', 'fb-idle');
  setMascot('idle', 'Yuk cari semua cara membuat target! 🤖');
  if (window._resetTimer) window._resetTimer();
  const newTarget = generateTargetAngka(state.session.sesi_game.level_ke || 1);
  state.targetAngka = newTarget;
  document.getElementById('displayTargetNumber').textContent = newTarget;
  document.getElementById('stratBadge').textContent = '🔎 0 cara ditemukan';
  document.getElementById('targetHint').textContent = 'Cari cara membuat ' + newTarget;
}

function goToDashboard() { window.location.href = 'dashboard.html'; }

// ============================================================================
// INIT
// ============================================================================
async function init() {
  try {
    const session = requireSiswaSession();
    state.session = session;
    state.idSesi = session.sesi_game.id_sesi;
    state.targetAngka = session.sesi_game.target_angka;

    el.displayStudentName.textContent = session.siswa.nama_panggilan;
    el.displayLevel.textContent = session.sesi_game.level_ke;
    el.displayScore.textContent = session.siswa.total_skor;
    el.displayTargetNumber.textContent = state.targetAngka;
    el.displayTargetNumber.classList.remove('animate-in');
    void el.displayTargetNumber.offsetWidth;
    el.displayTargetNumber.classList.add('animate-in');
    el.potionCountMax.textContent = STRATEGI_TARGET_MIN;

    await loadExistingStrategies();
    initKeypadListeners();
    initModalListeners();
    renderFormula();
    renderAllHistory();

    el.loadingScreen.classList.add('is-hidden');

    // Result buttons
    el.rbtnAgain.addEventListener('click', restartGame);
    el.rbtnDash.addEventListener('click', goToDashboard);

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
// BOOTSTRAP
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}