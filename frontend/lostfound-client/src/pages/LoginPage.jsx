export default function LoginPage() {
  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--accent)' }}>🔎 FindIt</h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--muted)', marginTop: '0.5rem' }}>Lost & Found Platform</p>
      </div>

      <div className="grid" style={{ width: '100%' }}>
        <div className="col-6">
          <div className="card" style={{ height: '100%' }}>
            <h2 style={{ margin: 0, marginBottom: '1rem' }}>Welcome Back</h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              Sign in with your Google account to access all Lost & Found features.
            </p>
            <div style={{ padding: '1rem 0' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                By signing in, you'll be able to report lost items, browse found items, and connect with others in your community.
              </p>
            </div>
          </div>
        </div>

        <div className="col-6">
          <div className="card" style={{ height: '100%' }}>
            <h3 style={{ margin: 0, marginBottom: '1rem' }}>How it works</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>1️⃣</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Sign in with Google</p>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Quick and secure authentication</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>2️⃣</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Report items</p>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Post lost or found items with details</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>3️⃣</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Get real-time updates</p>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Receive notifications when matches are found</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}