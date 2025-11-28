import React, { createContext, useContext, useEffect, useState } from 'react';
import authService from './services/auth';
import signalRService from './services/signalr';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lf_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('app_jwt') || null);

  async function signInWithIdToken(idToken) {
    const res = await authService.signInWithGoogle(idToken);
    if (res?.token) {
      localStorage.setItem('app_jwt', res.token);
      localStorage.setItem('lf_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);

      // start SignalR connection after successful sign in
      try {
        // signalRService.start accepts a token (this matches the service.start(jwt) style)
        await signalRService.start(res.token);
      } catch (err) {
        // connection failures shouldn't block sign in
        console.error('SignalR start failed:', err);
      }
      // In development, reload the page once to avoid any lingering initialization races.
      // This is a pragmatic workaround — prefer removing after auditing storage reads.
      try {
        if (import.meta.env.DEV) {
          // small timeout to allow React state to settle before reload
          setTimeout(() => window.location.reload(), 50);
        }
      } catch (err) {
        console.error('Dev reload failed:', err);
      }
    }
    return res;
  }

  function signOut() {
    localStorage.removeItem('app_jwt');
    localStorage.removeItem('lf_user');
    setToken(null);
    setUser(null);

    // stop SignalR connection on sign out
    try {
      signalRService.stop();
    } catch (err) {
      console.error('SignalR stop failed:', err);
    }
  }

  // If a token exists on mount (page refresh), ensure SignalR connection starts.
  useEffect(() => {
    let mounted = true;
    if (token) {
      signalRService.start(token).catch(err => {
        if (mounted) console.error('SignalR start failed:', err);
      });
    }
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, signInWithIdToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}