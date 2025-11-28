// src/pages/ChatWindow.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchConversationHistory, sendMessage, markMessageRead, deleteConversation, fetchUser } from '../services/messageApi';
import signalR from '../services/signalr';

export default function ChatWindow() {
  const { otherUserId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const scrollRef = useRef();

  useEffect(() => {
    let mounted = true;

    async function init() {
      // ensure SignalR connection started; App.jsx or AuthContext may already start it
      try {
        await signalR.start(localStorage.getItem('app_jwt'));
      } catch (err) {
        console.warn('SignalR start error:', err);
      }

      // load history
      try {
        const history = await fetchConversationHistory(otherUserId);
        if (mounted) setMessages(history || []);
        // load other user info for header
        try {
          const u = await fetchUser(otherUserId);
          if (mounted) setOtherUser(u);
        } catch (e) {
          // ignore; user may have been deleted
          console.warn('Failed to load other user', e);
        }
        // mark unread messages as read (optional)
        history.filter(m => !m.isRead && m.receiverId === currentUser?.id)
               .forEach(m => markMessageRead(m.id).catch(() => {}));
      } catch (err) {
        console.error('Failed to load history', err);
      }
    }

    init();

  const unsubReceive = signalR.on('ReceiveMessage', (msg) => {
      // add only messages that belong to this conversation
      const isForThisConversation =
        (msg.senderId === Number(otherUserId) && msg.receiverId === currentUser?.id) ||
        (msg.senderId === currentUser?.id && msg.receiverId === Number(otherUserId));
      if (isForThisConversation) setMessages(prev => [...prev, msg]);
    });

  const unsubSent = signalR.on('MessageSent', (msg) => {
      // server-side ack for messages sent by this client
      if (msg.senderId === currentUser?.id && msg.receiverId === Number(otherUserId)) {
        setMessages(prev => [...prev, msg]);
      }
    });

    return () => {
      mounted = false;
      unsubReceive();
      unsubSent();
    };
  }, [otherUserId, currentUser]);

  useEffect(() => {
    // If other party deleted conversation, clear messages and update UI
    const unsubConv = signalR.on('ConversationDeleted', (payload) => {
      const otherIdNum = Number(otherUserId);
      if (payload?.OtherUserId && Number(payload.OtherUserId) === otherIdNum) {
        setMessages([]);
      }
    });
    return () => unsubConv && unsubConv();
  }, [otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function handleSend() {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    try {
      // Persist via API; server will notify via SignalR
      await sendMessage(Number(otherUserId), content);
    } catch (err) {
      console.error('Send failed, trying hub fallback', err);
      try {
        await signalR.sendViaHub(Number(otherUserId), content);
      } catch (err2) {
        console.error('Hub fallback failed', err2);
      }
    }
  }

  return (
    <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '760px', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 900, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #eef2f7', background: '#f7fbff' }}>
          <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>◀</button>
          <img src={otherUser?.avatarUrl || (otherUser?.id ? `/api/users/${otherUser?.id}/avatar` : null)} alt="avatar" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#f0f3f7' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}><Link to={`/users/${otherUser?.id}`}>{otherUser?.firstName || otherUser?.name || otherUser?.username || 'Conversation'}</Link></div>
            <div style={{ fontSize: 12, color: '#667085' }}>{/* optional status or subtitle */}</div>
          </div>
        </div>

        {/* Messages pane */}
        <div style={{ flex: 1, minHeight: 260, maxHeight: 520, overflow: 'auto', padding: 16, background: '#f6f8fb' }}>
        {messages.map(m => (
          <div key={m.id ?? `${m.createdAt}-${m.senderId}`} style={{ display: 'flex', flexDirection: 'column', alignItems: m.senderId === currentUser?.id ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
            <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: 14, background: m.senderId === currentUser?.id ? '#d6f0ff' : '#ffffff', boxShadow: m.senderId === currentUser?.id ? 'none' : '0 1px 2px rgba(16,24,40,0.04)', color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.content}
            </div>
            <div style={{ fontSize: 11, color: '#8b9aa6', marginTop: 6 }}>{new Date(m.createdAt).toLocaleString()}</div>
          </div>
        ))}
        <div ref={scrollRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: 12, borderTop: '1px solid #eef2f7', display: 'flex', gap: 8, alignItems: 'center', background: '#fff' }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={`Message ${otherUser?.firstName || otherUser?.name || 'user'}...`} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e6eef3', outline: 'none', fontSize: 14 }} />
          <button onClick={handleSend} style={{ padding: '8px 12px', borderRadius: 8, background: '#0b76ef', color: '#fff', border: 'none', cursor: 'pointer' }}>Send</button>
          <button className="btn ghost" onClick={async () => {
            if (!window.confirm('Delete this conversation for you? This will remove messages from your view.')) return;
            try {
              await deleteConversation(Number(otherUserId));
              setMessages([]);
              // optionally navigate away
              navigate('/dashboard');
            } catch (err) {
              console.error('Failed to delete conversation', err);
              window.alert('Failed to delete conversation: ' + (err.message || err));
            }
          }} style={{ marginLeft: 8, padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e6eef3', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}