import React, { useEffect, useState } from 'react';

export default function StatusesList() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const token = localStorage.getItem('app_jwt');
  const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/statuses', { headers });
      if (!res.ok) throw new Error(await res.text());
      setStatuses(await res.json());
    } catch (e) {
      alert('Failed to load statuses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function getUsage(id) {
    const res = await fetch(`/api/statuses/${id}/usage`, { headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.itemCount || 0;
  }

  async function handleDelete(id) {
    const usage = await getUsage(id);
    if (usage > 0) {
      alert(`Cannot delete: ${usage} items use this status.`);
      return;
    }
    if (!confirm('Delete this status?')) return;
    try {
      const res = await fetch(`/api/statuses/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Name is required'); return; }
    try {
      const url = editing ? `/api/statuses/${editing}` : '/api/statuses';
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

  return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="card">
          {/* Header */}
          <div style={{ marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid #eef3f7' }}>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Status Management</h2>
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem', marginBottom: 0 }}>
              Manage item statuses (Pending, Active, Claimed, Closed). Status tracks the current state of each item.
            </p>
          </div>

          {/* Create/Edit Form */}
          <div style={{ marginBottom: '2rem', padding: '1.5rem', background: editing ? '#fff7ed' : '#f0f9ff', borderRadius: '10px', border: `2px solid ${editing ? 'var(--warning)' : 'var(--accent)'}` }}>
            <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editing ? '✏️ Edit Status' : '➕ Create New Status'}
            </h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <label className="field">
                <span>Status Name <span style={{ color: 'var(--danger)' }}>*</span></span>
                <input 
                  placeholder="e.g., Pending, Active, Claimed, Closed" 
                  value={form.name} 
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} 
                />
              </label>
              <label className="field">
                <span>Description</span>
                <input 
                  placeholder="Brief description of this status" 
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
                  {editing ? 'Save Changes' : 'Create Status'}
                </button>
              </div>
          </div>
        </div>

          {/* Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>All Statuses</h3>
              <span className="badge">{statuses.length} total</span>
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
                  {loading && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">Loading statuses...</td></tr>}
                  {!loading && statuses.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">
                        No statuses found. Create one above to get started.
                      </td>
                    </tr>
                  )}
                  {statuses.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--muted)' }}>#{s.id}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>{s.description || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No description</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button 
                            className="btn small ghost" 
                            onClick={() => { setEditing(s.id); setForm({ name: s.name, description: s.description || '' }); }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn small ghost danger" 
                            onClick={() => handleDelete(s.id)}
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
