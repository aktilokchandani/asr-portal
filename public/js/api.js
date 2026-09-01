async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function requireRole(role) {
  const { user } = await api('/api/me');
  if (!user || user.role !== role) {
    window.location.href = '/';
    throw new Error('redirecting');
  }
  return user;
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('en-US');
}

async function doLogout() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/';
}
