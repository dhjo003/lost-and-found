import React, { useEffect, useRef, useState } from 'react';

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      return resolve();
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load gsi script')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load gsi script'));
    document.head.appendChild(s);
  });
}

/*
Props:
- onSuccess(resp)  -> receives the full GSI response object (resp.credential contains the ID token)
- onError(err)     -> optional
*/
export default function GoogleButton({ onSuccess, onError }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    console.log('GSI client id:', clientId, 'location.origin:', location.origin);

    if (!clientId) {
      const msg = 'VITE_GOOGLE_CLIENT_ID is not set. Check .env.development and restart dev server.';
      setErr(msg);
      if (onError) onError(new Error(msg));
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (!mounted) return;
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
          const msg = 'Google Identity library loaded but window.google.accounts.id is not available.';
          setErr(msg);
          if (onError) onError(new Error(msg));
          return;
        }

        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
              console.log('GSI callback response:', resp);
              if (resp && resp.credential) {
                if (onSuccess) onSuccess(resp.credential);
              } else {
                const msg = 'No credential received from Google.';
                console.warn(msg, resp);
                if (onError) onError(new Error(msg));
              }
            },
          });

          // render the button (don't pass width: '100%'; control sizing with CSS)
          window.google.accounts.id.renderButton(
            containerRef.current,
            { theme: 'outline', size: 'large' }
          );

          setReady(true);
        } catch (ex) {
          setErr(ex.message || String(ex));
          if (onError) onError(ex);
        }
      })
      .catch((ex) => {
        if (!mounted) return;
        setErr(ex.message || String(ex));
        if (onError) onError(ex);
      });

    return () => {
      mounted = false;
    };
  }, [onSuccess, onError]);

  if (err) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <div style={{ color: 'crimson', fontWeight: 600, marginBottom: 8 }}>Google sign-in unavailable</div>
        <div style={{ color: '#111', marginBottom: 8 }}>{err}</div>
        <div style={{ fontSize: 13, color: '#444' }}>
          Common fixes: ensure <code>VITE_GOOGLE_CLIENT_ID</code> is set, and the client has <strong>http://localhost:5173</strong>
          under Authorized JavaScript origins in Google Cloud Console.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <div ref={containerRef} />
      {!ready && <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>Loading sign-in…</div>}
    </div>
  );
}