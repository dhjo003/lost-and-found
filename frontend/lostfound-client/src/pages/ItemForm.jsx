import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getItem, createItem, updateItem } from '../services/items';
import { uploadItemImages, uploadTempImages, attachTempToItem, deleteTempUploads } from '../services/itemImage';
import ItemImagesManager from '../components/ItemImagesManager';
import { useAuth } from '../AuthContext';
import { listCategories, listItemTypes, listStatuses } from '../services/lookups';

export default function ItemForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', description: '', location: '', dateLostFound: '', categoryId: '', typeId: '', statusId: ''
  });
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedItem, setLoadedItem] = useState(null);
  const [tempUpload, setTempUpload] = useState({ tempId: null, files: [] });
  const auth = useAuth();
  const currentUser = auth?.user ?? null;

  useEffect(() => {
    async function loadLookups() {
      try {
        const [c, t, s] = await Promise.all([
          listCategories(), listItemTypes(), listStatuses()
        ]);
        setCategories(c);
        setTypes(t);
        setStatuses(s);
      } catch (e) {
        console.error(e);
        alert('Failed to load lookups');
      }
    }
    async function loadItem() {
      if (!isEdit) return;
      try {
        const it = await getItem(id);
        setLoadedItem(it);
        setForm({
          name: it.name || '',
          description: it.description || '',
          location: it.location || '',
          dateLostFound: it.dateLostFound ? it.dateLostFound.substring(0, 16) : '', // for datetime-local
          categoryId: it.categoryId || '',
          typeId: it.typeId || '',
          statusId: it.statusId || ''
        });
      } catch (e) {
        console.error(e);
        alert('Failed to load item');
      }
    }
    (async () => {
      setLoading(true);
      await loadLookups();
      await loadItem();
      setLoading(false);
    })();
  }, [id, isEdit]);

  async function onSubmit(e) {
    e.preventDefault();
      if (!form.typeId) {
        alert('Please select whether this is a Lost or Found item');
        return;
      }
    const payload = {
      name: form.name?.trim(),
      description: form.description || null,
      location: form.location || null,
      dateLostFound: form.dateLostFound ? new Date(form.dateLostFound).toISOString() : null,
      categoryId: form.categoryId || null,
      typeId: form.typeId || null,
      statusId: form.statusId || null,
    };
    try {
      if (isEdit) {
        await updateItem(id, payload);
        // attach any staged temp uploads for edit
        if (tempUpload?.tempId) {
          try {
            await attachTempToItem(id, tempUpload.tempId);
          } catch (attachErr) {
            console.error('Failed to attach staged images', attachErr);
            alert('Item updated but attaching images failed. You can add images from the item page.');
          }
        }
        navigate(`/items/${id}`);
      } else {
        const res = await createItem(payload);
        // attach any staged temp uploads
        if (tempUpload?.tempId) {
          try {
            await attachTempToItem(res.id, tempUpload.tempId);
          } catch (attachErr) {
            console.error('Failed to attach staged images', attachErr);
            alert('Item created but attaching images failed. You can add images from the item page.');
          }
        }
        navigate(`/items/${res.id}`);
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Save failed');
    }
  }

  if (loading) return <div className="card">Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="card">
  {/* Image uploader at top */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Item images (upload multiple)</label>
          {(!isEdit) && (
            <div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  try {
                    // upload to temp area so images are staged until Save is clicked
                    const res = await uploadTempImages(files);
                    // res: { tempId, files: [{ fileName, url }] }
                    setTempUpload({ tempId: res.tempId, files: res.files || [] });
                  } catch (err) {
                    console.error('Temp image upload failed', err);
                    alert(err?.message || 'Image upload failed. Please try again.');
                  }
                }}
              />

              {/* staged previews */}
              {tempUpload.files?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {tempUpload.files.map((f, idx) => (
                    <div key={idx} style={{ width: 120, textAlign: 'center' }}>
                      <img src={f.url} alt={f.fileName} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                      <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isEdit && (
            // only allow upload when editing if current user is owner or admin
            ((currentUser?.roleName === 'Admin') || (loadedItem && currentUser?.id === loadedItem.userId)) ? (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    try {
                      // stage edits to temp area; attach will happen on Save
                      const res = await uploadTempImages(files);
                      setTempUpload({ tempId: res.tempId, files: res.files || [] });
                    } catch (err) {
                      console.error('Temp image upload failed', err);
                      alert(err?.message || 'Image upload failed. Please try again.');
                    }
                  }}
                />

                {/* staged previews for edit */}
                {tempUpload.files?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {tempUpload.files.map((f, idx) => (
                      <div key={idx} style={{ width: 120, textAlign: 'center' }}>
                        <img src={f.url} alt={f.fileName} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted">Only the item owner or an administrator can upload or change images.</div>
            )
          )}
          <div className="text-muted" style={{ marginTop: 6 }}>First uploaded image will be marked primary by default. You can change or delete images from the item details page.</div>
        </div>
        {/* If editing, show the full manager (thumbnails, set primary, delete) but only to owner/admin */}
        {isEdit && ((currentUser?.roleName === 'Admin') || (loadedItem && currentUser?.id === loadedItem.userId)) && (
          <div style={{ marginBottom: '1rem' }}>
            <ItemImagesManager itemId={id} onChange={() => { /* noop for now */ }} />
          </div>
        )}
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #eef3f7' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{isEdit ? 'Edit Item' : 'Create New Item'}</h2>
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem', marginBottom: 0 }}>
              {isEdit ? 'Update the details of this item' : 'Add a new lost or found item to the system'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isEdit && <Link className="btn ghost" to={`/items/${id}`}>View</Link>}
            <Link className="btn ghost" to="/items">Back to List</Link>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Type Section - Prominent */}
          <div style={{ padding: '1.25rem', background: '#f9fafb', borderRadius: '10px', border: '2px solid var(--accent)' }}>
            <label className="field">
              <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Item Type <span style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>*</span>
              </span>
              <select 
                required 
                value={form.typeId} 
                onChange={(e) => setForm(f => ({ ...f, typeId: e.target.value ? parseInt(e.target.value) : '' }))}
                style={{ fontSize: '1rem', fontWeight: 600 }}
              >
                <option value="">-- Select Lost or Found --</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="hint">Choose whether this is a lost or found item</span>
            </label>
          </div>

          {/* Basic Information */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#0f172a' }}>Basic Information</h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <label className="field">
                <span>Item Name <span style={{ color: 'var(--danger)' }}>*</span></span>
                <input 
                  required 
                  value={form.name} 
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Black wallet, iPhone 13, Blue backpack"
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea 
                  value={form.description} 
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Provide additional details about the item..."
                  rows="4"
                />
              </label>
            </div>
          </div>

          {/* Location & Date */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#0f172a' }}>Location & Date</h3>
            <div className="grid">
              <div className="col-6 field">
                <span>Location</span>
                <input 
                  value={form.location} 
                  onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Building, room, or area"
                />
              </div>
              <div className="col-6 field">
                <span>Date & Time</span>
                <input 
                  type="datetime-local" 
                  value={form.dateLostFound} 
                  onChange={(e) => setForm(f => ({ ...f, dateLostFound: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#0f172a' }}>Classification</h3>
            <div className="grid">
              <div className="col-6 field">
                <span>Category</span>
                <select 
                  value={form.categoryId} 
                  onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value ? parseInt(e.target.value) : '' }))}
                >
                  <option value="">- Select Category -</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-6 field">
                <span>Status</span>
                <select 
                  value={form.statusId} 
                  onChange={(e) => setForm(f => ({ ...f, statusId: e.target.value ? parseInt(e.target.value) : '' }))}
                >
                  <option value="">- Select Status -</option>
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #eef3f7' }}>
            <button type="button" className="btn ghost" onClick={async () => {
              // clean up temp uploads when cancelling creation
              if (tempUpload?.tempId) {
                try {
                  await deleteTempUploads(tempUpload.tempId);
                } catch (err) {
                  console.warn('Failed to delete temp uploads', err);
                }
              }
              navigate('/items');
            }}>Cancel</button>
            <button type="submit" className="btn" style={{ minWidth: 140 }}>
              {isEdit ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
