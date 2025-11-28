import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnreadMessageCount, fetchNotifications } from '../services/messageApi';

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [hasNewMessages, setHasNewMessages] = useState(() => {
    try { return localStorage.getItem('lf_hasNewMessages') === '1'; } catch { return false; }
  });
  const [unreadUsersCount, setUnreadUsersCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    function isItemMatchNotification(n) {
      try {
        const metaRaw = n.MetaJson ?? n.metaJson ?? n.meta_json ?? n.Meta ?? null;
        const meta = metaRaw ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) : null;
        const t = (meta?.type ?? meta?.Type ?? null) || null;
        if (t === 'itemmatch' || t === 'itemmatch_deleted') return true;
        if (meta?.itemMatchId || meta?.item_match_id || meta?.itemmatchid) return true;
        return false;
      } catch (e) { return false; }
    }

    async function loadNotifCount() {
      try {
        const list = await fetchNotifications(1, 50);
        const cnt = Array.isArray(list) ? list.filter(n => isItemMatchNotification(n) && !(n.isRead ?? n.is_read)).length : 0;
        setNotifCount(cnt);
      } catch (err) {
        // ignore
      }
    }
    function onEvent(e) {
      try { setHasNewMessages(Boolean(e?.detail)); } catch { setHasNewMessages(false); }
    }
    // also listen for custom events dispatched in the same window
    window.addEventListener('lf:hasNewMessages', onEvent);
    // listen for storage events from other tabs/windows
    async function loadCount() {
      try {
        const res = await getUnreadMessageCount();
        // API may return { Unread: <number> } or a simple number; normalize
        const count = res?.Unread ?? res?.unread ?? (typeof res === 'number' ? res : 0);
        setUnreadUsersCount(Number(count) || 0);
      } catch (err) {
        // ignore — keep previous
      }
    }

    // load initial count
    loadCount();
    // load notification count (item-match only)
    loadNotifCount();

    // refresh notification count when an item-match notification arrives elsewhere in the app
    function onHasNewNotifications(e) {
      try { loadNotifCount(); } catch { }
    }
    window.addEventListener('lf:hasNewNotifications', onHasNewNotifications);

    function onStorage(e) {
      if (e.key === 'lf_hasNewMessages') {
        setHasNewMessages(e.newValue === '1');
        // refresh count when flag changes in other tabs
        loadCount();
      }
    }
    window.addEventListener('storage', onStorage);

    // listen to the same-window custom event and refresh the count when signalled
    function onHasNew(e) { try { setHasNewMessages(Boolean(e?.detail)); } catch { setHasNewMessages(false); } loadCount(); }
    window.addEventListener('lf:hasNewMessages', onHasNew);

    return () => { window.removeEventListener('lf:hasNewMessages', onEvent); window.removeEventListener('storage', onStorage); window.removeEventListener('lf:hasNewMessages', onHasNew); window.removeEventListener('lf:hasNewNotifications', onHasNewNotifications); };
  }, []);
  return (
    <div style={{ width: '100%' }}>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Welcome back, {user?.firstName ?? user?.email}!</h2>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>Here's what's happening with your lost and found items.</p>
          </div>
        </div>
      </div>

      <div className="grid" style={{ width: '100%' }}>
        <div className="col-4">
          <div
            className="card"
            style={{ textAlign: 'center', cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onClick={() => { navigate('/notifications'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/notifications'); } }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--accent)' }}>{notifCount}</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>Notifications</p>
          </div>
        </div>
        <div className="col-4">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👁️</div>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--accent)' }}>12</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>Active Watchers</p>
          </div>
        </div>
        <div className="col-4">
          <div
            className="card"
            style={{ textAlign: 'center', cursor: 'pointer', position: 'relative' }}
            role="button"
            tabIndex={0}
            onClick={() => { try { localStorage.removeItem('lf_hasNewMessages'); } catch {} try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: false })); } catch {} setHasNewMessages(false); navigate('/conversations'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); try { localStorage.removeItem('lf_hasNewMessages'); } catch {} try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: false })); } catch {} setHasNewMessages(false); navigate('/conversations'); } }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--accent)' }}>{unreadUsersCount}</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>Messages</p>
            {hasNewMessages && (
              <span style={{ position: 'absolute', right: 16, top: 8, width: 12, height: 12, borderRadius: 8, background: 'var(--accent)' }} />
            )}
          </div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: '1.5rem', width: '100%' }}>
        <div className="col-8">
          <div className="card">
            <h3 style={{ margin: 0, marginBottom: '1rem' }}>Recent Activity</h3>
            <p className="text-muted">No recent activity to display.</p>
          </div>
        </div>
      </div>
    </div>
  );
}