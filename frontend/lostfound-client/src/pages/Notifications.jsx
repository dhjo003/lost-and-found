import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead } from '../services/messageApi';

function getMeta(n) {
  try {
    const raw = n.MetaJson ?? n.metaJson ?? n.meta_json ?? n.Meta ?? null;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
}

function getLinkForNotification(n) {
  const meta = getMeta(n);
  if (!meta) return '/notifications';
  // message notifications
  const msgId = meta.MessageId ?? meta.messageId ?? meta.message_id;
  const from = meta.FromUserId ?? meta.fromUserId ?? meta.from_user_id;
  if (msgId && from) return `/chat/${from}`;

  // item match notifications
  if (meta.type === 'itemmatch' || meta.type === 'itemmatch_deleted' || meta.itemMatchId || meta.item_match_id) return '/matches';

  // item-related
  const itemId = meta.ItemId ?? meta.itemId ?? meta.item_id;
  if (itemId) return `/items/${itemId}`;

  return '/notifications';
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const list = await fetchNotifications(1, 200);
        if (!mounted) return;
        const all = Array.isArray(list) ? list : [];
        // filter to item-match related notifications only
        function isItemMatch(n) {
          try {
            const metaRaw = n.MetaJson ?? n.metaJson ?? n.meta_json ?? n.Meta ?? null;
            const meta = metaRaw ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) : null;
            const t = (meta?.type ?? meta?.Type ?? null) || null;
            if (t === 'itemmatch' || t === 'itemmatch_deleted') return true;
            if (meta?.itemMatchId || meta?.item_match_id || meta?.itemmatchid) return true;
            return false;
          } catch (e) { return false; }
        }

        const filtered = all.filter(isItemMatch);
        setNotifications(filtered);

        // mark only visible (item-match) notifications as read (avoid affecting message notifications)
        try {
          const unread = filtered.filter(n => !(n.isRead ?? n.is_read));
          if (unread.length > 0) await Promise.all(unread.map(n => markNotificationRead(n.id)));
        } catch (err) {
          console.error('Failed to mark item-match notifications read', err);
        }
      } catch (err) {
        console.error('Failed to load notifications', err);
        if (mounted) setNotifications([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2>Notifications</h2>
      {loading && <div className="text-muted">Loading...</div>}
      {!loading && notifications.length === 0 && <div className="text-muted">No notifications</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.map(n => {
          const link = getLinkForNotification(n);
          return (
            <div key={n.id} className="card" style={{ padding: 12, cursor: link ? 'pointer' : 'default' }} onClick={async () => {
              // navigate to related page but do not delete the notification
              try { if (!(n.isRead ?? n.is_read)) await markNotificationRead(n.id); } catch (err) { }
              if (link) navigate(link);
            }}>
              <div style={{ fontWeight: 700 }}>{n.title}</div>
              <div style={{ color: '#6b7280' }}>{n.body}</div>
              <div style={{ fontSize: 12, color: '#9aa6b2' }}>{new Date(n.createdAt ?? n.created_at).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
