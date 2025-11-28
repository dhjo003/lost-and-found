// src/pages/ConversationsList.jsx
import React, { useEffect, useState } from 'react';
import { fetchConversations } from '../services/messageApi';

export default function ConversationsList({ onSelectConversation }) {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const items = await fetchConversations();
      setConversations(items);
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }

  return (
    <div className="conversations-list">
      {conversations.map(c => (
        <div key={c.otherUserId} className="conversation-row" onClick={() => onSelectConversation(c.otherUserId)}>
          <div className="conv-left">
            <div className="conv-name">{c.otherUserName}</div>
            <div className="conv-last">{c.lastMessage}</div>
          </div>
          <div className="conv-right">
            <div className="conv-time">{new Date(c.lastMessageAt).toLocaleTimeString()}</div>
            {c.unreadCount > 0 && <div className="conv-unread">{c.unreadCount}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}