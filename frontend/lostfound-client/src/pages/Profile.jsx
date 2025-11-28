import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Profile({ user: propUser, onSignOut }) {
  const navigate = useNavigate();

  const user = propUser || (() => {
    try { return JSON.parse(localStorage.getItem('lf_user') || 'null'); } catch { return null; }
  })();

  const avatarSrc = user?.avatarUrl || (user?.id ? `/api/users/${user.id}/avatar` : null) || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="#e6eef3" /><text x="50%" y="55%" font-size="20" text-anchor="middle" fill="#6b7280">👤</text></svg>');

  function handleSignOut() {
    localStorage.removeItem('app_jwt');
    localStorage.removeItem('lf_user');
    if (onSignOut) onSignOut();
    navigate('/login');
  }

  if (!user) return (
    <div className="card">
      <h2>Profile</h2>
      <p>No user is signed in.</p>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div className="card">
        <h2 style={{ margin: 0, marginBottom: '1.5rem', fontSize: '1.5rem' }}>My Profile</h2>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <img src={avatarSrc} alt="avatar" style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email}</h3>
            <div className="text-muted" style={{ marginTop: 8, fontSize: '0.95rem' }}>{user.email}</div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#6b7280' }}>Role:</span>{' '}
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{user.roleName || user.role || 'User'}</span>
              </div>
              {user.createdAt && (
                <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 600 }}>Member since:</span> {new Date(user.createdAt).toLocaleDateString()}
                </div>
              )}
              {user.lastLogin && (
                <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 600 }}>Last login:</span> {new Date(user.lastLogin).toLocaleString()}
                </div>
              )}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn ghost" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
              <button className="btn" onClick={handleSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
