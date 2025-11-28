import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef();
  const menuRef = useRef();
  const rootRef = useRef();

  function toggle(e) {
    setOpen(v => !v);
  }

  function close() {
    setOpen(false);
    btnRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // focus first item
      const first = menuRef.current?.querySelector('a');
      first?.focus();
    }
  }

  const { user } = useAuth();

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      // if click target is outside the nav root, close the menu
      if (open && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('click', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  return (
  <nav className="main-nav" aria-label="Main navigation" ref={rootRef}>
      <div className="nav-item nav-dropdown" onKeyDown={onKeyDown}>
        <button
          ref={btnRef}
          className="nav-dropdown-button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls="items-menu"
          onClick={toggle}
          onBlur={(e) => {
            // close when focus leaves both button and menu
            const btn = e.currentTarget;
            requestAnimationFrame(() => {
              const root = btn?.closest('.nav-dropdown');
              if (root && !root.contains(document.activeElement)) setOpen(false);
            });
          }}
        >
          Items ▾
        </button>

        <div
          id="items-menu"
          ref={menuRef}
          className="nav-dropdown-menu"
          role="menu"
          aria-hidden={!open}
          style={{ display: open ? 'block' : 'none' }}
        >
          <Link to="/items/new" role="menuitem" tabIndex={open ? 0 : -1} className="nav-dropdown-item" onClick={() => setOpen(false)}>+ Create Item</Link>
          <Link to="/items" role="menuitem" tabIndex={open ? 0 : -1} className="nav-dropdown-item" onClick={() => setOpen(false)}>View Items</Link>
        </div>
      </div>

      {user?.roleName === 'Admin' && (
        <>
          <Link to="/admin/categories" className="nav-item nav-link">Categories</Link>
          <Link to="/admin/item-types" className="nav-item nav-link">Item Types</Link>
          <Link to="/admin/statuses" className="nav-item nav-link">Status</Link>
        </>
      )}
      {user && (
        <Link to="/matches" className="nav-item nav-link">Matches</Link>
      )}
    </nav>
  );
}
