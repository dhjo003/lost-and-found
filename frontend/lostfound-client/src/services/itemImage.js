async function getAuthHeaders() {
  const token = localStorage.getItem('app_jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getItemImages(itemId) {
  const res = await fetch(`/api/items/${itemId}/images`, {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch images');
  return res.json();
}

export async function uploadItemImages(itemId, files, onProgress) {
  // files: FileList or array
  const form = new FormData();
  for (const f of files) form.append('files', f);

  const token = localStorage.getItem('app_jwt');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Using fetch; progress needs xhr for per-file progress (optional).
  const res = await fetch(`/api/items/${itemId}/images`, {
    method: 'POST',
    headers,
    body: form
  });
  if (!res.ok) {
    let msg = 'Upload failed';
    try {
      const body = await res.json();
      if (body && body.error) msg = body.error;
      else if (body && body.message) msg = body.message;
    } catch (e) {
      try { msg = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(msg || 'Upload failed');
  }
  return res.json(); // returns array of created images
}

export async function deleteItemImage(itemId, imageId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(`/api/items/${itemId}/images/${imageId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Delete failed');
  return true;
}

export async function setItemPrimary(itemId, imageId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(`/api/items/${itemId}/images/${imageId}/set-primary`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Set primary failed');
  return res.json();
}

// --- Temp upload helpers (upload files before the item exists) ---
export async function uploadTempImages(files) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const token = localStorage.getItem('app_jwt');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`/api/items/temp-images`, {
    method: 'POST',
    headers,
    body: form
  });
  if (!res.ok) {
    let msg = 'Temp upload failed';
    try { msg = (await res.json())?.message || msg; } catch { try { msg = await res.text(); } catch {} }
    throw new Error(msg);
  }
  return res.json(); // { tempId, files: [{ fileName, url }] }
}

export async function attachTempToItem(itemId, tempId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(`/api/items/${itemId}/images/attach-temp/${encodeURIComponent(tempId)}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    let msg = 'Attach temp images failed';
    try { msg = (await res.json())?.message || msg; } catch { try { msg = await res.text(); } catch {} }
    throw new Error(msg);
  }
  return res.json(); // created images
}

export async function deleteTempUploads(tempId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(`/api/items/temp-images/${encodeURIComponent(tempId)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Failed to delete temp uploads');
  return true;
}