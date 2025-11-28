import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getUnreadMessageCount, fetchConversationSummaries, fetchNotifications, markNotificationRead } from '../services/messageApi';
import { on as onSignal } from '../services/signalr';

export default function AccountMenu({ user: propUser, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const auth = useAuth();

  // prefer propUser then AuthContext then localStorage fallback
  const [user, setUser] = useState(() => {
    if (propUser) return propUser;
    if (auth?.user) return auth.user;
    try { return JSON.parse(localStorage.getItem('lf_user') || 'null'); } catch { return null; }
  });

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(() => {
    try { return localStorage.getItem('lf_hasNewMessages') === '1'; } catch { return false; }
  });
  const [convOpen, setConvOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  async function loadConversations() {
    setConvLoading(true);
    try {
      const list = await fetchConversationSummaries();
      const normalized = (list || []).map(c => ({
        otherUserId: c.OtherUserId ?? c.otherUserId ?? c.other_user_id,
        otherUserName: c.OtherUserName ?? c.otherUserName ?? c.other_user_name ?? c.OtherUser ?? c.otherUser ?? c.name,
        lastMessage: c.LastMessage ?? c.lastMessage ?? c.last_message,
        lastMessageAt: c.LastMessageAt ?? c.lastMessageAt ?? c.last_message_at,
        unreadCount: c.UnreadCount ?? c.unreadCount ?? c.unread_count ?? 0,
      }));
      setConversations(Array.isArray(normalized) ? normalized : []);
    } catch (err) {
      console.error('Failed to load conversations', err);
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  }

  useEffect(() => {
    async function loadNotifCount() {
      try {
        const list = await fetchNotifications(1, 50);
        // include ONLY item-match related notifications in bell count
        function isItemMatchNotification(n) {
          try {
            const metaRaw = n.MetaJson ?? n.metaJson ?? n.meta_json ?? n.Meta ?? null;
            const meta = metaRaw ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) : null;
            const t = (meta?.type ?? meta?.Type ?? null) || null;
            if (t === 'itemmatch' || t === 'itemmatch_deleted') return true;
            if (meta?.itemMatchId || meta?.item_match_id || meta?.itemmatchid) return true;
            return false;
          } catch (e) {
            return false;
          }
        }

        const cnt = Array.isArray(list) ? list.filter(n => isItemMatchNotification(n) && !(n.isRead ?? n.is_read)).length : 0;
        setUnreadNotifications(cnt);
      } catch (e) {
        console.error('Failed to load notifications', e);
      }
    }
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setConvOpen(false);
        setNotifOpen(false);
      }
    }
    loadNotifCount();
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (propUser) setUser(propUser);
    else if (auth?.user) setUser(auth.user);
  }, [propUser]);

  useEffect(() => {
    if (auth?.user) setUser(auth.user);
  }, [auth?.user]);

  // reload conversations/notifications when their dropdowns open
  useEffect(() => {
    if (convOpen) loadConversations();
    if (notifOpen) loadNotifications();
  }, [convOpen, notifOpen]);

  async function loadNotifications() {
    setNotifLoading(true);
    try {
      const list = await fetchNotifications(1, 50);
      // normalize keys to camelCase style
      const normalized = Array.isArray(list) ? list : [];
      // include ONLY item-match related notifications in the bell dropdown
      function isItemMatchNotification(n) {
        try {
          const metaRaw = n.MetaJson ?? n.metaJson ?? n.meta_json ?? n.Meta ?? null;
          const meta = metaRaw ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) : null;
          const t = (meta?.type ?? meta?.Type ?? null) || null;
          if (t === 'itemmatch' || t === 'itemmatch_deleted') return true;
          if (meta?.itemMatchId || meta?.item_match_id || meta?.itemmatchid) return true;
          return false;
        } catch (e) {
          return false;
        }
      }

      const dropdownList = normalized.filter(n => isItemMatchNotification(n));
      setNotifications(dropdownList);

      // unread count shown on bell includes only item-match notifications
      const unreadList = dropdownList.filter(n => !(n.isRead ?? n.is_read));
      const unreadCount = unreadList.length;
      setUnreadNotifications(unreadCount || 0);

      // If the notifications dropdown is already open, mark unread (item-match) notifications as read
      if (notifOpen && unreadList.length > 0) {
        try {
          await Promise.all(unreadList.map(n => markNotificationRead(n.id)));
        } catch (err) {
          console.error('Failed to mark notifications read', err);
        }
        setUnreadNotifications(0);
      }
    } catch (e) {
      console.error('Failed to load notifications', e);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }

  useEffect(() => {
    let unsubReceive = null;
    let unsubRead = null;
    async function loadCount() {
      try {
        const res = await getUnreadMessageCount();
        console.debug('[AccountMenu] getUnreadMessageCount response:', res);
        // normalize different API shapes ({ Unread }, { unread }, number)
        const count = res?.Unread ?? res?.unread ?? res?.UnreadCount ?? res?.unreadCount ?? (typeof res === 'number' ? res : 0);
        setUnreadMessages(Number(count) || 0);
      } catch (err) {
        console.error('Failed to fetch unread count', err);
      }
    }

    loadCount();

    // subscribe to SignalR events to refresh count
    unsubReceive = onSignal('ReceiveMessage', (payload) => {
      console.debug('[AccountMenu] ReceiveMessage payload:', payload);
      // when a message arrives for current user, mark that there are new messages
      try {
        const isForMe = payload?.receiverId === auth?.user?.id || payload?.receiverId === auth?.user?.id;
        if (isForMe) {
          localStorage.setItem('lf_hasNewMessages', '1');
          setHasNewMessages(true);
          // notify other components in the same window
          try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: true })); } catch { }
          // optimistic update for the icon badge (number of users with unread messages)
          setUnreadMessages(prev => (Number(prev) || 0) + 1);
        }
      } catch (e) {
        // ignore
      }

      // refresh counts/list as before
      loadCount();
      try { loadConversations(); } catch { };
    });

    // notifications via SignalR - only item-match notifications should affect the bell
    const unsubNotif = onSignal('ReceiveNotification', (payload) => {
      try {
        if (payload && payload.suppressAlert) return;

        function payloadIsItemMatch(p) {
          try {
            if (!p) return false;
            if (p.type === 'itemmatch' || p.type === 'itemmatch_deleted') return true;
            if (p.itemMatchId || p.item_match_id || p.itemmatchid) return true;
            const metaRaw = p.MetaJson ?? p.metaJson ?? p.meta_json ?? p.meta ?? null;
            const meta = metaRaw ? (typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw) : null;
            const t = meta?.type ?? meta?.Type ?? null;
            if (t === 'itemmatch' || t === 'itemmatch_deleted') return true;
            if (meta?.itemMatchId || meta?.item_match_id || meta?.itemmatchid) return true;
          } catch (e) { }
          return false;
        }

        if (!payloadIsItemMatch(payload)) return;

        // optimistic increment for item-match notifications
        setUnreadNotifications(prev => (Number(prev) || 0) + 1);
        try { window.dispatchEvent(new CustomEvent('lf:hasNewNotifications', { detail: true })); } catch { }
      } catch { }
    });

    unsubRead = onSignal('MessageRead', () => {
      loadCount();
    });

    return () => {
      if (unsubReceive) unsubReceive();
      if (unsubRead) unsubRead();
      if (unsubNotif) unsubNotif();
    };
  }, [auth?.user]);

  const avatarSrc = user?.avatarUrl || (user?.id ? `/api/users/${user.id}/avatar` : null) || null;

  function handleSignOut() {
    localStorage.removeItem('app_jwt');
    localStorage.removeItem('lf_user');
    setOpen(false);
    if (onSignOut) onSignOut();
    navigate('/login');
  }

  return (
    <div className="account-menu" ref={ref}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button title="Notifications" onClick={() => setNotifOpen(v => !v)} aria-expanded={notifOpen} className="account-notifications-button" style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, marginRight: 4 }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              {unreadNotifications > 0 && (
                <span style={{ position: 'absolute', right: -6, top: -8, background: 'var(--accent)', color: '#fff', borderRadius: 12, padding: '2px 6px', fontSize: 12, fontWeight: 700, zIndex: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{unreadNotifications}</span>
              )}
            </button>
            {notifOpen && (
              <div className="notifications-dropdown card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 360, zIndex: 60 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>Notifications</div>
                  <button className="btn small ghost" onClick={() => { setNotifOpen(false); navigate('/notifications'); }}>View all</button>
                </div>
                <div style={{ marginTop: 8, maxHeight: 300, overflow: 'auto' }}>
                  {notifLoading && <div className="text-muted">Loading...</div>}
                  {!notifLoading && notifications.length === 0 && <div className="text-muted">No notifications</div>}
                  {!notifLoading && notifications.map(n => (
                    <div key={n.id} className="notif-item" style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 700 }}>{n.title}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{n.body}</div>
                      <div style={{ fontSize: 11, color: '#9aa6b2', marginTop: 6 }}>{new Date(n.createdAt || n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button title="Messages" onClick={() => setConvOpen(v => !v)} aria-expanded={convOpen} className="account-messages-button" style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}>
              <span style={{ fontSize: 18 }}>✉️</span>
            {/* Numeric badge for number of users with unread messages */}
            {unreadMessages > 0 && (
              <span
                aria-label={`${unreadMessages} users have unread messages`}
                style={{
                  position: 'absolute',
                  right: -6,
                  top: -8,
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '2px 6px',
                  fontSize: 12,
                  fontWeight: 700,
                  zIndex: 999,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
                }}
              >
                {unreadMessages}
              </span>
            )}
            {/* fallback small dot when only flag set */}
            {hasNewMessages && unreadMessages === 0 && (
              <span style={{ position: 'absolute', right: -6, top: -6, background: 'var(--accent)', color: 'transparent', borderRadius: 8, width: 12, height: 12, display: 'inline-block', zIndex: 999, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            )}
          </button>

          {convOpen && (
            <div className="conversations-dropdown card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, zIndex: 60 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>Conversations</div>
                <button className="btn small ghost" onClick={() => {
                  // clear new-message indicator when navigating to conversations
                  try { localStorage.removeItem('lf_hasNewMessages'); } catch { }
                  try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: false })); } catch { }
                  setHasNewMessages(false);
                  setUnreadMessages(0);
                  setConvOpen(false); navigate('/conversations');
                }}>View all</button>
              </div>
              <div style={{ marginTop: 8, maxHeight: 300, overflow: 'auto' }}>
                {convLoading && <div className="text-muted">Loading...</div>}
                {!convLoading && conversations.length === 0 && <div className="text-muted">No conversations</div>}
                {!convLoading && conversations.map(c => (
                  <div key={c.otherUserId} className="conv-item" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 6px', cursor: 'pointer' }} onClick={() => {
                    // clear indicator when user opens a conversation
                    try { localStorage.removeItem('lf_hasNewMessages'); } catch { }
                    try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: false })); } catch { }
                    setHasNewMessages(false);
                    // decrement optimistic unreadUsersCount (one user cleared)
                    setUnreadMessages(prev => Math.max(0, (Number(prev) || 0) - 1));
                    setConvOpen(false); setOpen(false); navigate(`/chat/${c.otherUserId}`);
                  }}>
                    {/*<div 
                      style={{ width: 40, height: 40, borderRadius: 8, background: '#eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {<img
                        src={c.otherUser?.avatarUrl || (c.otherUser?.id ? `/api/users/${c.otherUser?.id}/avatar` : null)}
                        alt="avatar"
                      />}
                    </div>*/}
                    <div 
                      style={{ width: 40, height: 40, borderRadius: 8, background: '#eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {<img
                        src={`/api/users/${c.otherUserId}/avatar`}
                        alt={c.otherUserName ? `${c.otherUserName} avatar` : 'avatar'}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/favicon.ico'; }}
                      />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.otherUserName || 'User'}</div>
                        <div style={{ fontSize: 11, color: '#8b9aa6' }}>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString() : ''}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage}</div>
                    </div>
                    {c.unreadCount > 0 && <div style={{ background: 'red', color: '#fff', borderRadius: 999, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>{c.unreadCount}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button className="account-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ position: 'relative' }}>
          <img src={avatarSrc || '/favicon.ico'} alt="avatar" />
          <span className="account-name">{user?.firstName ?? user?.email}</span>
          <span className="caret">▾</span>
        </button>
      </div>

      {open && (
        <div className="account-dropdown card">
          <div className="account-summary">
            <img src={avatarSrc || '/favicon.ico'} alt="avatar" />
            <div>
              <div style={{ fontWeight: 700 }}>{user?.firstName ?? user?.email}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{user?.email}</div>
            </div>
          </div>

          <nav className="account-nav">
            <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
            <Link to="/profile" onClick={() => setOpen(false)}>Profile</Link>
            {user?.roleName === 'Admin' && (
              <>
                <Link to="/users" onClick={() => setOpen(false)}>Users</Link>
                <Link to="/users/deleted" onClick={() => setOpen(false)}>Deleted Users</Link>
              </>
            )}
          </nav>

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
