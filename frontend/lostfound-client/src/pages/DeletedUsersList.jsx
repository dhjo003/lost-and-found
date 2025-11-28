import React, { useEffect, useState } from 'react';
import { listDeletedUsers, restoreUser } from '../services/users';


export default function DeletedUsersList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem('lf_user') || 'null'); } catch (e) { currentUser = null; }
  const isAdmin = currentUser?.roleName === 'Admin';

  async function load() {
    setLoading(true);
    try {
      const data = await listDeletedUsers({ page, pageSize, q });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      alert('Failed to load deleted users: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);

  async function onRestore(user) {
    if (!isAdmin) return alert('Admin only');
    if (!confirm(`Restore ${user.firstName || user.email}?`)) return;
    try {
      await restoreUser(user.id);
      setItems(prev => prev.filter(i => i.id !== user.id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
      alert('Restore failed: ' + (err.message || err));
    }
  }

  return (
    <div className="deleted-users-page" style={{ width: '100%' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Deleted Users</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '0 1 auto' }}>
            <input className="input" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: '250px' }} />
            <button className="btn" onClick={() => { setPage(1); load(); }}>Search</button>
          </div>
        </div>

        {loading ? <p>Loading...</p> : (
          <>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>Total deleted: {total}</p>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {items.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{(u.firstName || '') + ' ' + (u.lastName || '')}</td>
                      <td>{u.email}</td>
                      <td>{u.roleName}</td>
                      <td>
                        {isAdmin && (<button className="btn" onClick={() => onRestore(u)}>Restore</button>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              <span>Page {page}</span>
              <button className="btn ghost" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= total}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}