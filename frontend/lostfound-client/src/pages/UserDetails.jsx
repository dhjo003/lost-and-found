// src/pages/UserDetails.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchUser } from '../services/messageApi';
import { useAuth } from '../AuthContext';

export default function UserDetails() {
  const { id } = useParams(); // id is string
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const u = await fetchUser(id);
        if (mounted) setUser(u);
      } catch (err) {
        console.error('Failed to fetch user', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div>Loading user...</div>;
  if (!user) return <div>User not found</div>;

  const otherId = user.id;

  return (
    <div className="user-details">
      {/* Profile picture (served via backend avatar endpoint which caches remote images) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img
          src={`/api/users/${otherId}/avatar`}
          alt={`${user.firstName || user.displayName || 'User'} avatar`}
          style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, background: '#eee' }}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-avatar.png'; }}
        />
        <div>
          <h2 style={{ margin: 0 }}>{(user.firstName || '') + (user.lastName ? ' ' + user.lastName : '') || user.displayName || user.name}</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Joined: {new Date(user.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Link to this user's items */}
        <Link to={`/users/${otherId}/items`} className="btn">View items</Link>

        {/* Message button only when viewing someone else's profile */}
        {!(currentUser && currentUser.id === otherId) && (
          <button className="btn" onClick={() => navigate(`/chat/${otherId}`)}>Message</button>
        )}
      </div>
    </div>
  );
}