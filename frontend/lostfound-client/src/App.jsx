import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UsersList from './pages/UsersList';
import DeletedUsersList from './pages/DeletedUsersList';
import ProtectedRoute from './components/ProtectedRoute';
import authService from './services/auth';
import GoogleButton from './components/GoogleButton';
import Layout from './components/Layout';
import AccountMenu from './components/AccountMenu';
import Profile from './pages/Profile';
import ItemsList from './pages/ItemsList';
import ItemDetails from './pages/ItemDetails';
import ItemForm from './pages/ItemForm';
import ItemMatchesList from './pages/ItemMatchesList';
import ItemMatchCreate from './pages/ItemMatchCreate';
import MatchesList from './pages/MatchesList';
import MatchCreate from './pages/MatchCreate';
import CategoriesList from './pages/CategoriesList';
import ItemTypesList from './pages/ItemTypesList';
import StatusesList from './pages/StatusesList';
import { ToastContainer } from 'react-toastify';
import UserDetails from './pages/UserDetails';
import UserItems from './pages/UserItems';
import ChatWindow from './pages/ChatWindow';
import Conversations from './pages/Conversations';
import Notifications from './pages/Notifications';

function AppRoutes({ jwt, setJwt, user, setUser, signOut }) {
  return (
    <Routes>
      <Route path="/" element={jwt ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          jwt ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage
              onSignIn={async (idToken) => {
                const res = await authService.signInWithGoogle(idToken);
                if (res?.token) {
                  localStorage.setItem('app_jwt', res.token);
                  localStorage.setItem('lf_user', JSON.stringify(res.user));
                  setJwt(res.token);
                  setUser(res.user);
                }
              }}
            />
          )
        }
      />
      <Route path="/dashboard" element={jwt ? <Dashboard user={user} onSignOut={signOut} /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={jwt ? <ProtectedRoute><Profile user={user} onSignOut={signOut} /></ProtectedRoute> : <Navigate to="/login" replace />} />
      <Route path="/users" element={<ProtectedRoute roles={['Admin']}><UsersList /></ProtectedRoute>} />
      <Route path="/users/deleted" element={<ProtectedRoute roles={['Admin']}><DeletedUsersList /></ProtectedRoute>} />
      <Route path="/users/:id" element={jwt ? <ProtectedRoute><UserDetails /></ProtectedRoute> : <Navigate to="/login" replace />} />
  <Route path="/users/:id/items" element={jwt ? <ProtectedRoute><UserItems /></ProtectedRoute> : <Navigate to="/login" replace />} />
      <Route path="/chat/:otherUserId" element={jwt ? <ProtectedRoute><ChatWindow /></ProtectedRoute> : <Navigate to="/login" replace />} />
  <Route path="/conversations" element={jwt ? <ProtectedRoute><Conversations /></ProtectedRoute> : <Navigate to="/login" replace />} />
      {/* Admin lookup routes */}
      <Route path="/admin/categories" element={<ProtectedRoute roles={['Admin']}><CategoriesList /></ProtectedRoute>} />
      <Route path="/admin/item-types" element={<ProtectedRoute roles={['Admin']}><ItemTypesList /></ProtectedRoute>} />
      <Route path="/admin/statuses" element={<ProtectedRoute roles={['Admin']}><StatusesList /></ProtectedRoute>} />
      {/* Items routes */}
      <Route path="/items" element={<ProtectedRoute><ItemsList /></ProtectedRoute>} />
      <Route path="/items/new" element={<ProtectedRoute><ItemForm /></ProtectedRoute>} />
      <Route path="/items/:id" element={<ProtectedRoute><ItemDetails /></ProtectedRoute>} />
      <Route path="/items/:id/matches" element={<ProtectedRoute><ItemMatchesList /></ProtectedRoute>} />
      <Route path="/items/:id/matches/new" element={<ProtectedRoute><ItemMatchCreate /></ProtectedRoute>} />
      <Route path="/matches" element={<ProtectedRoute><MatchesList /></ProtectedRoute>} />
      <Route path="/matches/new" element={<ProtectedRoute><MatchCreate /></ProtectedRoute>} />
      <Route path="/notifications" element={jwt ? <ProtectedRoute><Notifications /></ProtectedRoute> : <Navigate to="/login" replace />} />
      {/* Match detail page removed; details are shown in the lists */}
      <Route path="/items/:id/edit" element={<ProtectedRoute><ItemForm /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lf_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [jwt, setJwt] = useState(() => localStorage.getItem('app_jwt') || null);

  function signOut() {
    localStorage.removeItem('app_jwt');
    localStorage.removeItem('lf_user');
    setJwt(null);
    setUser(null);
    // signalR connection is stopped by AuthContext.signOut
  }

  // sign-in handler used by header GoogleButton and LoginPage
  async function handleSignIn(idToken) {
    const res = await authService.signInWithGoogle(idToken);
    if (res?.token) {
      localStorage.setItem('app_jwt', res.token);
      localStorage.setItem('lf_user', JSON.stringify(res.user));
      setJwt(res.token);
      setUser(res.user);
      // Dev-only reload to mitigate init races across the SPA. Remove after audit.
      try {
        if (import.meta.env.DEV) {
          setTimeout(() => window.location.reload(), 50);
        }
      } catch (err) {
        console.error('Dev reload failed:', err);
      }
    }
  }

  // compute avatar source
  const fallback = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<rect width="40" height="40" rx="8" fill="#e6eef3" />' +
    '<text x="50%" y="60%" font-size="12" text-anchor="middle" fill="#6b7280" font-family="Inter,Arial">👤</text>' +
    '</svg>'
  );

  const avatarSrc = user?.avatarUrl || (user?.id ? `/api/users/${user.id}/avatar` : null) || fallback;

  const headerRight = jwt ? (
    // use AccountMenu to present a single compact account area with dropdown
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <AccountMenu user={user} onSignOut={signOut} />
    </div>
  ) : (
    <GoogleButton onSuccess={handleSignIn} />
  );

  return (
    <BrowserRouter>
      <Layout headerRight={headerRight}>
        <AppRoutes jwt={jwt} setJwt={setJwt} user={user} setUser={setUser} signOut={signOut} />
        <ToastContainer position="top-right" autoClose={5000} />
      </Layout>
    </BrowserRouter>
  );
}