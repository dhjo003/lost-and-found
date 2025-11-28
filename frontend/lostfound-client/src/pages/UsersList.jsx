// frontend/lostfound-client/src/pages/UsersList.jsx
import React, { useEffect, useState } from 'react';
import { listUsers, softDeleteUser, updateUserRole } from '../services/users';

// Optional: if you have an AuthContext with useAuth, import it to get current user/role
// import { useAuth } from '../AuthContext';

export default function UsersList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);

  // Fallback: try to read the stored user or use AuthContext if available.
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('lf_user') || 'null');
  } catch (e) {
    currentUser = null;
  }

  // If you have an AuthContext hook, you can use it instead:
  // const { user: currentUser } = useAuth();

  const isAdmin = currentUser?.roleName === 'Admin';

  async function load() {
    setLoading(true);
    try {
      const data = await listUsers({ page, pageSize, q });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      alert('Failed to load users: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function onSearch(e) {
    e?.preventDefault();
    setPage(1);
    await load();
  }

  async function onDelete(user) {
    if (!isAdmin) return alert('Admin only');
    if (!confirm(`Soft-delete ${user.firstName || user.email}?`)) return;
    try {
      await softDeleteUser(user.id);
      // optimistic update
      setItems(prev => prev.filter(i => i.id !== user.id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
      alert('Delete failed: ' + (err.message || err));
    }
  }

  async function onRoleChange(user, newRole) {
    if (!isAdmin) return alert('Admin only');
    try {
      await updateUserRole(user.id, newRole);
      // optimistic update
      setItems(prev => prev.map(u => u.id === user.id ? { ...u, roleName: newRole } : u));
      setEditingRoleId(null);
    } catch (err) {
      console.error(err);
      alert('Update role failed: ' + (err.message || err));
    }
  }

  return (
    <div className="users-page" style={{ width: '100%' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Users Management</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '0 1 auto' }}>
            <input className="input" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: '250px' }} />
            <button className="btn" onClick={onSearch}>Search</button>
          </div>
        </div>

        {loading ? <p>Loading...</p> : (
          <>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>Total users: {total}</p>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{(u.firstName || '') + ' ' + (u.lastName || '')}</td>
                      <td>{u.email}</td>
                      <td>
                        {editingRoleId === u.id && isAdmin && currentUser?.id !== u.id ? (
                          <select
                            value={u.roleName}
                            onChange={(e) => onRoleChange(u, e.target.value)}
                            onBlur={() => setEditingRoleId(null)}
                            autoFocus
                            style={{ padding: 4, borderRadius: 4 }}
                          >
                            <option value="User">User</option>
                            <option value="Admin">Admin</option>
                            <option value="Moderator">Moderator</option>
                          </select>
                        ) : (
                          <span 
                            onClick={() => isAdmin && currentUser?.id !== u.id && setEditingRoleId(u.id)} 
                            style={{ 
                              cursor: isAdmin && currentUser?.id !== u.id ? 'pointer' : 'default', 
                              textDecoration: isAdmin && currentUser?.id !== u.id ? 'underline' : 'none',
                              opacity: currentUser?.id === u.id ? 0.6 : 1
                            }}
                            title={currentUser?.id === u.id ? "You cannot edit your own role" : ""}
                          >
                            {u.roleName}
                          </span>
                        )}
                      </td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : ''}</td>
                      <td>
                        {isAdmin && (
                          <button
                            className="btn ghost"
                            onClick={() => onDelete(u)}
                            disabled={currentUser?.id === u.id}
                            title={currentUser?.id === u.id ? "You can't delete yourself" : 'Soft delete'}
                          >
                            Delete
                          </button>
                        )}
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