import React, { useEffect, useState, useRef } from 'react';
import { getItemImages, uploadItemImages, deleteItemImage, setItemPrimary } from '../services/itemImage';

export default function ItemImagesManager({ itemId, initialImages = [], onChange, canManage = true }) {
  const [images, setImages] = useState(initialImages || []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    // If itemId provided and no initialImages, load them
    if (itemId && (!initialImages || initialImages.length === 0)) {
      load();
    }
    // eslint-disable-next-line
  }, [itemId]);

  async function load() {
    try {
      const imgs = await getItemImages(itemId);
      setImages(imgs);
      onChange?.(imgs);
    } catch (err) {
      console.error('Failed to load images', err);
    }
  }

  async function handleFilesPicked(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const created = await uploadItemImages(itemId, files);
      // server returns created images with ids and urls
      // optimistic: if none primary existed before, backend marked first new as primary
      const merged = [...images, ...created];
      setImages(merged);
      onChange?.(merged);
    } catch (err) {
      console.error('Upload failed', err);
      window.alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = null;
    }
  }

  async function handleDelete(img) {
    if (!confirm('Delete this image?')) return;
    try {
      await deleteItemImage(itemId, img.id);
      const next = images.filter(x => x.id !== img.id);
      setImages(next);
      onChange?.(next);
    } catch (err) {
      console.error('Delete failed', err);
      window.alert('Failed to delete');
    }
  }

  async function handleSetPrimary(img) {
    try {
      await setItemPrimary(itemId, img.id);
      // update local state: mark img as primary, unset others
      const next = images.map(x => ({ ...x, isPrimary: x.id === img.id }));
      setImages(next);
      onChange?.(next);
    } catch (err) {
      console.error('Set primary failed', err);
      window.alert('Failed to set primary');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {images.map(img => (
          <div key={img.id || img.fileName} style={{ width: 96, textAlign: 'center', position: 'relative' }}>
            <div style={{ width: 96, height: 96, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
              <img src={img.url || img.Url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {img.isPrimary && <div style={{ position: 'absolute', left: 6, top: 6, background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>Primary</div>}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
              {img.isPrimary ? (
                <div style={{ padding: '4px 8px', background: 'var(--accent)', color: '#fff', borderRadius: 6 }}>Primary</div>
              ) : (
                canManage ? <button className="btn small" onClick={() => handleSetPrimary(img)}>Make primary</button> : null
              )}
              {canManage ? <button className="btn small danger" onClick={() => handleDelete(img)}>Delete</button> : null}
            </div>
          </div>
        ))}
        {/* upload box */}
        {canManage ? (
          <div style={{ width: 96, height: 96, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px dashed #ddd' }}>
            <label style={{ cursor: 'pointer', display: 'block', textAlign: 'center' }}>
              <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFilesPicked} style={{ display: 'none' }} />
              <div style={{ fontSize: 12 }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </div>
              <div style={{ fontSize: 10, color: '#666' }}>PNG, JPG</div>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}