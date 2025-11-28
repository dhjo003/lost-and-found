import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchConversationSummaries, deleteConversation } from '../services/messageApi';

// Conversations page — shows conversation summaries and navigates to per-user chat
export default function Conversations() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchConversationSummaries();
        if (!mounted) return;
        // normalize backend DTO (support PascalCase, camelCase, snake_case)
        const normalized = (data || []).map(c => ({
          otherUserId: c.OtherUserId ?? c.otherUserId ?? c.other_user_id,
          otherUserName: c.OtherUserName ?? c.otherUserName ?? c.other_user_name ?? c.OtherUser ?? c.otherUser ?? c.name,
          lastMessage: c.LastMessage ?? c.lastMessage ?? c.last_message,
          lastMessageAt: c.LastMessageAt ?? c.lastMessageAt ?? c.last_message_at,
          unreadCount: c.UnreadCount ?? c.unreadCount ?? c.unread_count ?? 0,
        }));
        setItems(normalized);
      } catch (err) {
        console.error('Failed to load conversations', err);
        if (mounted) setError('Failed to load conversations');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <div className="card">
        <h2 style={{ margin: 0, marginBottom: 12 }}>Conversations</h2>

        {loading && <div className="text-muted">Loading...</div>}
        {error && <div className="text-muted">{error}</div>}

        {!loading && items.length === 0 && <div className="text-muted">No conversations yet.</div>}

        {items.map(c => (
          <div
            key={c.otherUserId}
            className="conv-item"
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 6px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            onClick={() => {
              // clear the simple 'has new messages' indicator when opening a conversation
              try { localStorage.removeItem('lf_hasNewMessages'); } catch {}
              try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: false })); } catch {}
              window.requestAnimationFrame(() => navigate(`/chat/${c.otherUserId}`));
            }}
          >
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
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
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
            <button
              aria-label="Delete conversation"
              title="Delete conversation"
              onClick={async (e) => {
                e.stopPropagation();
                const ok = window.confirm(`Delete conversation with ${c.otherUserName || 'this user'}? This cannot be undone.`);
                if (!ok) return;
                try {
                  await deleteConversation(c.otherUserId);
                  setItems(prev => prev.filter(x => x.otherUserId !== c.otherUserId));
                  // clear indicator for this conversation
                  try { localStorage.removeItem('lf_hasNewMessages'); } catch {}
                  try { window.dispatchEvent(new CustomEvent('lf:hasNewMessages', { detail: false })); } catch {}
                } catch (err) {
                  console.error('Failed to delete conversation', err);
                  window.alert('Failed to delete conversation');
                }
              }}
              style={{ marginLeft: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 16 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                <polyline points="3 6 5 6 21 6" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="11" x2="10" y2="17" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="11" x2="14" y2="17" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
