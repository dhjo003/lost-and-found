const API = '/api/items';

function getAuthHeaders() {
  const token = localStorage.getItem('app_jwt');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function listItems({ page = 1, pageSize = 20, q = '', statusId, categoryId, typeId, hasPrimaryImage } = {}) {
  const params = { page, pageSize };
  if (q) params.q = q;
  if (statusId) params.statusId = statusId;
  if (categoryId) params.categoryId = categoryId;
  if (typeId) params.typeId = typeId;
  if (typeof hasPrimaryImage !== 'undefined') params.hasPrimaryImage = hasPrimaryImage;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}?${qs}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { total, page, pageSize, items }
}

export async function getItem(id) {
  const res = await fetch(`${API}/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createItem(data) {
  const res = await fetch(`${API}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id }
}

export async function updateItem(id, data) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function deleteItem(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

// List items created by a specific user (uses backend endpoint added at GET /api/users/{id}/items)
export async function listUserItems(userId, { page = 1, pageSize = 20, q = '', statusId, categoryId, typeId } = {}) {
  const params = { page, pageSize };
  if (q) params.q = q;
  if (statusId) params.statusId = statusId;
  if (categoryId) params.categoryId = categoryId;
  if (typeId) params.typeId = typeId;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/users/${encodeURIComponent(userId)}/items?${qs}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { total, page, pageSize, items }
}
