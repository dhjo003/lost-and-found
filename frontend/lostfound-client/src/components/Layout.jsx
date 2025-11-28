import { Link } from 'react-router-dom';
import HeaderNav from './HeaderNav';

export default function Layout({ children, headerRight }) {
  return (
    <div className="app-root">
      <header className="site-header">
        <div className="container header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div className="logo">
              <Link to="/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
                🔎 FindIt – Lost & Found Platform
              </Link>
            </div>

            <HeaderNav />
          </div>

          {/* right-hand header area: account menu / auth button */}
          <div className="header-actions">{headerRight}</div>
        </div>
      </header>

      <main className="container main-content">{children}</main>

      <footer className="site-footer">
        <div className="container">© {new Date().getFullYear()} FindIt – Lost & Found Platform</div>
      </footer>
    </div>
  );
}