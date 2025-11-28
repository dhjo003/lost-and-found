import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import itemMatches from '../services/itemMatches';
import { getItem } from '../services/items';
import { getItemImages } from '../services/itemImage';

export default function MatchesList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await itemMatches.listMatches();

        // enrich matches with item names, primary images and creator name
        const enriched = await Promise.all((data || []).map(async (m) => {
          const [lost, found, lostImgs, foundImgs, creator] = await Promise.all([
            getItem(m.lostItemId).catch(() => null),
            getItem(m.foundItemId).catch(() => null),
            getItemImages(m.lostItemId).catch(() => []),
            getItemImages(m.foundItemId).catch(() => []),
            m.creatorUserId ? fetch(`/api/users/${m.creatorUserId}`).then(r => r.ok ? r.json() : null).catch(() => null) : null
          ]);

          const pick = imgs => (imgs && imgs.length ? (imgs.find(i => i.isPrimary || i.IsPrimary) || imgs[0]).url || imgs[0].Url || null : null);

          return {
            ...m,
            lostItem: lost,
            foundItem: found,
            lostImageUrl: pick(lostImgs),
            foundImageUrl: pick(foundImgs),
            creatorUser: creator
          };
        }));

        setMatches(enriched);
      } catch (err) {
        console.error(err);
        alert('Failed to load matches');
      } finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="card">Loading matches…</div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Item Matches</h3>
        <div>
          <Link className="btn" to="/matches/new">Create Match</Link>
          <Link className="btn ghost" to="/dashboard">Back</Link>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {matches.length === 0 && <div className="text-muted">No matches found.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {matches.map(m => (
            <li key={m.id} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 56, textAlign: 'center', fontWeight: 700, color: '#6b7280' }}>#{m.id}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Link to={`/items/${m.lostItemId}`} style={{ width: 64, height: 48, display: 'block', borderRadius: 6, overflow: 'hidden' }}>
                    {m.lostImageUrl ? <img src={m.lostImageUrl} alt="lost" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: 64, height: 48, background: '#f3f4f6' }} />}
                  </Link>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Link to={`/items/${m.lostItemId}`} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{m.lostItem?.name ?? `#${m.lostItemId}`}</Link>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Lost {m.lostItem ? (
                      <>· Created by: <Link to={`/users/${m.lostItem.userId ?? m.lostItem.UserId ?? ''}`} style={{ color: '#111827', textDecoration: 'underline' }}>{m.lostItem.userName ?? m.lostItem.UserName ?? 'User'}</Link></>
                    ) : null}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Link to={`/items/${m.foundItemId}`} style={{ width: 64, height: 48, display: 'block', borderRadius: 6, overflow: 'hidden' }}>
                    {m.foundImageUrl ? <img src={m.foundImageUrl} alt="found" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: 64, height: 48, background: '#f3f4f6' }} />}
                  </Link>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Link to={`/items/${m.foundItemId}`} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{m.foundItem?.name ?? `#${m.foundItemId}`}</Link>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>Found {m.foundItem ? (
                      <>· Created by: <Link to={`/users/${m.foundItem.userId ?? m.foundItem.UserId ?? ''}`} style={{ color: '#111827', textDecoration: 'underline' }}>{m.foundItem.userName ?? m.foundItem.UserName ?? 'User'}</Link></>
                    ) : null}</div>
                  </div>
                </div>

                <div style={{ marginLeft: 6 }}>
                  <div style={{ fontWeight: 700 }}>Score: {m.score}</div>
                  <div style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <div style={{ color: '#9CA3AF', fontSize: 12 }}>Created by</div>
                    {m.creatorUser ? (
                      <Link to={`/users/${m.creatorUser.id ?? m.creatorUser.Id ?? m.creatorUser.userId ?? m.creatorUser.UserId}`} style={{ fontWeight: 700, color: '#111827', fontSize: 14, textDecoration: 'underline' }}>
                        {((m.creatorUser.firstName || '') + ' ' + (m.creatorUser.lastName || '')).trim() || m.creatorUser.email}
                      </Link>
                    ) : <div style={{ color: '#6b7280' }}>Unknown</div>}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 13 }}>{m.createdAt || m.CreatedAt ? new Date(m.createdAt || m.CreatedAt).toLocaleString() : ''}</div>
                </div>
              {/* action buttons intentionally removed; use links on images/names and creator name */}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
