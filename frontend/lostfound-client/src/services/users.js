const API = '/api/users';

function getAuthHeaders() {
  const token = localStorage.getItem('app_jwt');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function listUsers({ page = 1, pageSize = 20, q = '' } = {}) {
  const qs = new URLSearchParams({ page, pageSize, q }).toString();
  const res = await fetch(`${API}?${qs}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { total, page, pageSize, items }
}

export async function listDeletedUsers({ page = 1, pageSize = 20, q = '' } = {}) {
  const qs = new URLSearchParams({ page, pageSize, q }).toString();
  const res = await fetch(`${API}/deleted?${qs}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function softDeleteUser(id) {
  const res = await fetch(`${API}/${id}/soft-delete`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function restoreUser(id) {
  const res = await fetch(`${API}/${id}/restore`, { method: 'POST', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function updateUserRole(id, roleName) {
  const res = await fetch(`${API}/${id}/role`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ roleName })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, roleName }
}