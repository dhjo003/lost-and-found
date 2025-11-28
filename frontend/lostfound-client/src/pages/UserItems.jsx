import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listUserItems } from '../services/items';
import { fetchUser } from '../services/messageApi';

export default function UserItems() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  async function loadUser() {
    try {
      const u = await fetchUser(id);
      setUser(u);
    } catch (err) {
      console.error('Failed to fetch user', err);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await listUserItems(id, { page, pageSize });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load user items', err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUser(); }, [id]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, id]);

  function totalPages() { return Math.max(1, Math.ceil(total / pageSize)); }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{user ? (user.firstName || user.displayName || user.name) + (user.lastName ? ' ' + user.lastName : '') : 'User'}'s items</h2>
          <div className="text-muted">Total: {total}</div>
        </div>
        <div>
          <Link to={`/users/${id}`} className="btn">Back to profile</Link>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="6" className="text-muted">{loading ? 'Loading...' : 'No items found.'}</td></tr>
            )}
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td><Link to={`/items/${it.id}`}>{it.name}</Link></td>
                <td>{it.categoryName || '-'}</td>
                <td>{it.typeName || '-'}</td>
                <td>{it.statusName || '-'}</td>
                <td>{new Date(it.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
        <div className="text-muted">Total: {total}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <span className="text-muted">Page {page} / {totalPages()}</span>
          <button className="btn ghost" disabled={page >= totalPages()} onClick={() => setPage(p => p + 1)}>Next</button>
          <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value) || 10); setPage(1); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}
