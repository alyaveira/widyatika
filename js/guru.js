import { logout, requireGuruSession } from './auth.js';

/**
 * Inisialisasi halaman Guru: pastikan user login, set sidebar active state,
 * dan isi informasi profil jika tersedia.
 * @param {'dashboard'|'manajemen'|'laporan'} activePage
 * @returns {object} session object
 */
export function initGuruPage(activePage) {
  const session = requireGuruSession();
  const guru = session.guru;

  const avatarEl = document.getElementById('sidebarAvatar');
  const nameEl   = document.getElementById('sidebarName');
  if (avatarEl) avatarEl.textContent = guru.nama_lengkap.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = guru.nama_lengkap;

  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Yakin ingin keluar dari akun?')) logout();
    });
  }

  highlightSidebarItem(activePage);
  return session;
}

export function highlightSidebarItem(activePage) {
  const targetHref = {
    dashboard: 'dashboard.html',
    manajemen: 'manajemen-kelas.html',
    laporan: 'laporan.html',
  }[activePage] || activePage;

  document.querySelectorAll('.sidebar__nav-item').forEach(link => {
    const isActive = link.getAttribute('href') === targetHref;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function showToast(message, type = 'info') {
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = `toast-notif toast-notif--${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toast.style.cssText = `
    background:#1E293B;color:#fff;padding:10px 16px;border-radius:10px;
    font-size:0.85rem;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.2);
    animation:slideInRight 0.3s ease;pointer-events:auto; margin-top:8px;
  `;

  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
