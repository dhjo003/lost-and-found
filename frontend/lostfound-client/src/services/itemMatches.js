const API = '/api/item-matches';

function authHeaders() {
  const token = localStorage.getItem('app_jwt');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export async function createItemMatch({ lostItemId, foundItemId, score }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ lostItemId, foundItemId, score })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function softDeleteItemMatch(id) {
  const res = await fetch(`${API}/${id}/soft-delete`, {
    method: 'POST',
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function listMatches() {
  const res = await fetch(API, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMatch(id) {
  const res = await fetch(`${API}/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default { createItemMatch, softDeleteItemMatch, listMatches, getMatch };
