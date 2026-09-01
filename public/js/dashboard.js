// Shared behavior for the Agency / Client / Candidate dashboard shell:
// the top-bar "My Account" menu, and its Change Password modal.
// Loaded on every portal page alongside /js/api.js.

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openModal(id) { document.getElementById(id).classList.add('show'); }

function toggleAccountMenu() {
  document.getElementById('accountDropdown').classList.toggle('show');
}

// close the account dropdown when clicking anywhere outside it
document.addEventListener('click', (e) => {
  const menu = document.getElementById('accountMenu');
  const dropdown = document.getElementById('accountDropdown');
  if (!menu || !dropdown) return;
  if (!menu.contains(e.target)) dropdown.classList.remove('show');
});

function initAccountMenu(user) {
  const nameEl = document.getElementById('topUserName');
  const avatarEl = document.getElementById('topAvatar');
  if (!user) return;
  const displayName = user.company || user.name || 'Account';
  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) {
    const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    avatarEl.textContent = initials || '?';
  }
}

function openChangePasswordModal() {
  document.getElementById('accountDropdown').classList.remove('show');
  document.getElementById('cp_current').value = '';
  document.getElementById('cp_new').value = '';
  document.getElementById('cp_confirm').value = '';
  const msg = document.getElementById('cp_msg');
  msg.style.color = '';
  msg.textContent = '';
  document.getElementById('changePasswordModal').classList.add('show');
}

async function submitChangePassword() {
  const current = document.getElementById('cp_current').value;
  const next = document.getElementById('cp_new').value;
  const confirm = document.getElementById('cp_confirm').value;
  const msg = document.getElementById('cp_msg');
  msg.style.color = '';
  if (!current || !next) { msg.textContent = 'Please fill in both password fields.'; return; }
  if (next !== confirm) { msg.textContent = 'New password and confirmation don’t match.'; return; }
  try {
    await api('/api/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
    msg.style.color = 'var(--success)';
    msg.textContent = 'Password updated.';
    setTimeout(() => { document.getElementById('changePasswordModal').classList.remove('show'); }, 900);
  } catch (err) {
    msg.textContent = err.message;
  }
}
