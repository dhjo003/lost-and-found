import React, { useEffect, useState } from 'react';

export default function ItemTypesList() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const token = localStorage.getItem('app_jwt');
  const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/item-types', { headers });
      if (!res.ok) throw new Error(await res.text());
      setTypes(await res.json());
    } catch (e) {
      alert('Failed to load item types');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function getUsage(id) {
    const res = await fetch(`/api/item-types/${id}/usage`, { headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.itemCount || 0;
  }

  async function handleDelete(id) {
    const usage = await getUsage(id);
    if (usage > 0) {
      alert(`Cannot delete: ${usage} items use this type. Merge into another type first.`);
      return;
    }
    if (!confirm('Delete this type?')) return;
    try {
      const res = await fetch(`/api/item-types/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Name is required'); return; }
    try {
      const url = editing ? `/api/item-types/${editing}` : '/api/item-types';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      setForm({ name: '', description: '' });
      setEditing(null);
      await load();
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
  }

  async function handleMerge(sourceId, targetId) {
    if (!targetId) { alert('Select a target type'); return; }
    if (!confirm('Merge all items from this type into the target?')) return;
    try {
      const res = await fetch(`/api/item-types/${sourceId}/merge-into/${targetId}`, { method: 'POST', headers });
      if (!res.ok) throw new Error(await res.text());
      await load();
      alert('Merge successful');
    } catch (e) {
      alert('Merge failed: ' + e.message);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="card">
        {/* Header */}
        <div style={{ marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid #eef3f7' }}>
          <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Item Types Management</h2>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem', marginBottom: 0 }}>
            Manage item types (Lost/Found). This determines whether an item was lost or found.
          </p>
        </div>

        {/* Create/Edit Form */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: editing ? '#fff7ed' : '#f0f9ff', borderRadius: '10px', border: `2px solid ${editing ? 'var(--warning)' : 'var(--accent)'}` }}>
          <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editing ? '✏️ Edit Item Type' : '➕ Create New Item Type'}
          </h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label className="field">
              <span>Type Name <span style={{ color: 'var(--danger)' }}>*</span></span>
              <input 
                placeholder="e.g., Lost, Found" 
                value={form.name} 
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} 
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input 
                placeholder="Brief description of this type" 
                value={form.description} 
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} 
              />
            </label>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              {editing && (
                <button className="btn ghost" onClick={() => { setEditing(null); setForm({ name: '', description: '' }); }}>
                  Cancel
                </button>
              )}
              <button className="btn" onClick={handleSave} style={{ minWidth: 120 }}>
                {editing ? 'Save Changes' : 'Create Type'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>All Item Types</h3>
            <span className="badge">{types.length} total</span>
          </div>
          
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th style={{ width: '200px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">Loading types...</td></tr>}
                {!loading && types.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">
                      No types found. Create one above to get started.
                    </td>
                  </tr>
                )}
                {types.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--muted)' }}>#{t.id}</td>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.description || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No description</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          className="btn small ghost" 
                          onClick={() => { setEditing(t.id); setForm({ name: t.name, description: t.description || '' }); }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn small ghost danger" 
                          onClick={async () => {
                            const usage = await getUsage(t.id);
                            if (usage > 0) {
                              const target = prompt(`⚠️ This type has ${usage} item(s).\n\nEnter target type ID to merge into:`);
                              if (target) await handleMerge(t.id, parseInt(target));
                            } else {
                              await handleDelete(t.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
