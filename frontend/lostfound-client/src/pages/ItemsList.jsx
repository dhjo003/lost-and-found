import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listItems, deleteItem } from '../services/items';
import { useAuth } from '../AuthContext';

export default function ItemsList() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [debQ, setDebQ] = useState(q);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const searchRef = useRef();
  const [typeId, setTypeId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // assume `item` is the item object and contains owner id/name (adjust property names)
  const auth = useAuth();
  const currentUser = auth?.user ?? null;

  async function load() {
    setLoading(true);
    try {
      const res = await listItems({ page, pageSize, q, typeId: typeId || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
      alert('Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, typeId]);

  // simple debouncer for the search input to fetch suggestions
  useEffect(() => {
    const t = setTimeout(() => setDebQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let active = true;
    async function s() {
      if (!debQ) { setSuggestions([]); return; }
      try {
        // If searching a specific type (Lost=1 or Found=2), only show items with a primary image
        const hasPrimary = typeId === '1' || typeId === '2' ? true : undefined;
        const res = await listItems({ q: debQ, page: 1, pageSize: 5, typeId: typeId || undefined, hasPrimaryImage: hasPrimary });
        if (!active) return;
        setSuggestions(res.items || []);
        setSuggestIndex(-1);
      } catch (err) { console.error(err); }
    }
    s();
    return () => { active = false; };
  }, [debQ, typeId]);

  function onSearchKeyDown(e) {
    if (!suggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (suggestIndex >= 0 && suggestIndex < suggestions.length) {
        e.preventDefault();
        const it = suggestions[suggestIndex];
        navigate(`/items/${it.id}`);
      } else {
        // no suggestion chosen, perform a list search
        setPage(1); load();
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setSuggestIndex(-1);
    }
  }

  function totalPages() { return Math.max(1, Math.ceil(total / pageSize)); }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Items</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="1">Lost</option>
            <option value="2">Found</option>
          </select>
          <div style={{ position: 'relative' }}>
            <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); }} onKeyDown={onSearchKeyDown} placeholder="Search" />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, background: 'var(--card)', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', zIndex: 60 }}>
                {suggestions.map((it, idx) => (
                  <div key={it.id} onMouseEnter={() => setSuggestIndex(idx)} onMouseLeave={() => setSuggestIndex(-1)} style={{ padding: 8, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', background: suggestIndex === idx ? '#eef2ff' : 'transparent' }} onClick={() => navigate(`/items/${it.id}`)}>
                    {it.primaryImageUrl ? <img src={it.primaryImageUrl} alt="pri" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 48, height: 36, background: '#f3f4f6', borderRadius: 6 }} />}
                    <div>{it.id} — {it.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn" onClick={() => { setPage(1); load(); }}>Search</button>
          <Link className="btn" to="/items/new">+ Create</Link>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>Status</th>
              <th>User</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="8" className="text-muted">{loading ? 'Loading...' : 'No items found.'}</td></tr>
            )}
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.id}</td>
                <td style={{ width: 80 }}>
                  {(() => {
                    const url = it.primaryImageUrl ?? it.primaryImage?.url ?? it.primaryImage?.Url ?? (it.images && it.images.find(x => x.isPrimary)?.url) ?? (it.images && it.images.find(x => x.isPrimary)?.Url);
                    return url ? <img src={url} alt="primary" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 64, height: 48, background: '#f3f4f6', borderRadius: 6 }} />;
                  })()}
                </td>
                <td><Link to={`/items/${it.id}`}>{it.name}</Link></td>
                <td>{it.categoryName || '-'}</td>
                <td>{it.typeName || '-'}</td>
                <td>{it.statusName || '-'}</td>
                <td>
                  {it.userId ? (
                    <Link to={`/users/${it.userId}`} className="item-owner-link">{it.userName}</Link>
                  ) : '-'}
                </td>
                <td>{new Date(it.createdAt).toLocaleString()}</td>
                <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {(currentUser?.roleName === 'Admin' || currentUser?.id === it.userId) && (
                    <>
                      <button className="btn ghost" onClick={() => navigate(`/items/${it.id}/edit`)}>Edit</button>
                      <button className="btn danger" onClick={async () => {
                        if (!confirm('Delete this item?')) return;
                        try {
                          await deleteItem(it.id);
                          await load();
                        } catch (e) { alert('Delete failed'); }
                      }}>Delete</button>
                    </>
                  )}
                </td>
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
