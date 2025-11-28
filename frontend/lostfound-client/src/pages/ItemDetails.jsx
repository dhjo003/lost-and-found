import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getItem } from '../services/items';
import { getItemImages, deleteItemImage, setItemPrimary, uploadItemImages } from '../services/itemImage';

export default function ItemDetails() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [images, setImages] = useState([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getItem(id);
        setItem(res);
        // try to get images from item payload or fetch
        const imgs = res?.images ?? res?.Images ?? null;
        if (imgs && Array.isArray(imgs)) {
          setImages(imgs);
        } else {
          try {
            const fetched = await getItemImages(id);
            setImages(fetched);
          } catch (e) {
            // ignore - images may not exist yet
          }
        }
      } catch (e) {
        console.error(e);
        alert('Failed to load item');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="card">Loading…</div>;
  if (!item) return <div className="card">Not found</div>;

  // determine primary image url from images or item property
  const primaryUrl = images.find(i => i.isPrimary)?.url ?? images.find(i => i.isPrimary)?.Url ?? item.primaryImageUrl ?? item.primaryImage?.url ?? item.primaryImage?.Url ?? (images[0] && (images[0].url || images[0].Url)) ?? null;

  const auth = useAuth();
  const currentUser = auth?.user ?? null;
  const canManage = currentUser?.roleName === 'Admin' || currentUser?.id === item.userId;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Item #{item.id}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage && <Link className="btn ghost" to={`/items/${item.id}/edit`}>Edit</Link>}
          {/* Item action dropdown: create/list matches */}
          <div className="nav-item nav-dropdown">
            <button className="nav-dropdown-button btn ghost" aria-haspopup="true" aria-expanded={false}>Actions ▾</button>
            <div className="nav-dropdown-menu" role="menu">
              <Link to={`/items/${item.id}/matches/new`} role="menuitem" className="nav-dropdown-item">Create Match</Link>
              <Link to={`/items/${item.id}/matches`} role="menuitem" className="nav-dropdown-item">View Matches</Link>
            </div>
          </div>
          <Link className="btn" to="/items">Back</Link>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 320 }}>
            <div style={{ width: '100%', paddingBottom: '75%', position: 'relative', background: '#f3f4f6', borderRadius: 8, overflow: 'hidden', cursor: images.length ? 'pointer' : 'default' }} onClick={images.length ? () => setGalleryOpen(true) : undefined}>
              {primaryUrl ? (
                <img src={primaryUrl} alt="primary" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No image</div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#60708a' }}>Click the image to view all uploads for this item. From there you can change primary or delete images.</div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}><strong>Name:</strong> {item.name}</div>
            <div style={{ marginBottom: 8 }}><strong>Description:</strong> {item.description || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Location:</strong> {item.location || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Date:</strong> {item.dateLostFound ? new Date(item.dateLostFound).toLocaleString() : '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Category:</strong> {item.categoryName || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Type:</strong> {item.typeName || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Status:</strong> {item.statusName || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>User:</strong> {item.userName || '-'}</div>
            <div style={{ marginBottom: 8 }}><strong>Created:</strong> {new Date(item.createdAt).toLocaleString()}</div>
            {item.updatedAt && <div style={{ marginBottom: 8 }}><strong>Updated:</strong> {new Date(item.updatedAt).toLocaleString()}</div>}
          </div>
        </div>
      </div>

      {/* Gallery modal */}
      {galleryOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setGalleryOpen(false)}>
          <div className="card" style={{ width: '80%', maxWidth: 1000, maxHeight: '80%', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Images for Item #{item.id}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {canManage && (
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Upload
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      try {
                        await uploadItemImages(item.id, files);
                        const refreshed = await getItemImages(item.id);
                        setImages(refreshed);
                      } catch (err) {
                        console.error('Upload failed', err);
                        alert('Upload failed');
                      }
                    }} />
                  </label>
                )}
                <button className="btn ghost" onClick={() => setGalleryOpen(false)}>Close</button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {images.length === 0 && <div className="text-muted">No images uploaded for this item.</div>}
              {images.map(img => (
                <div key={img.id || img.FileName || img.fileName} style={{ width: 160, textAlign: 'center' }}>
                  <div style={{ width: 160, height: 120, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
                    <img src={img.url || img.Url} alt="img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, justifyContent: 'center' }}>
                    {img.isPrimary ? (
                      <div style={{ padding: '4px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontSize: 12 }}>Primary</div>
                    ) : (
                      canManage ? (
                        <button className="btn small" onClick={async () => {
                          try {
                            await setItemPrimary(item.id, img.id);
                            const refreshed = await getItemImages(item.id);
                            setImages(refreshed);
                          } catch (err) { console.error(err); alert('Failed to set primary'); }
                        }}>Make primary</button>
                      ) : null
                    )}
                    {canManage ? (
                      <button className="btn small danger" onClick={async () => {
                        if (!confirm('Delete this image?')) return;
                        try {
                          await deleteItemImage(item.id, img.id);
                          const refreshed = await getItemImages(item.id);
                          setImages(refreshed);
                        } catch (err) { console.error(err); alert('Failed to delete'); }
                      }}>Delete</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
