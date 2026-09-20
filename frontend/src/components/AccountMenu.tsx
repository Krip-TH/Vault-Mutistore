import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function AccountMenu({ onOrders, onAdmin, onLogout }: { onOrders: () => void; onAdmin: () => void; onLogout: () => void }) {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  if (loading || !user) return null;

  const initial = user.name.trim().charAt(0) || '?';

  return <div className="header-account" ref={containerRef}>
    <button className="account-button" onClick={() => setMenuOpen(current => !current)} aria-expanded={menuOpen} aria-haspopup="true">
      <span className="account-avatar" aria-hidden="true">{initial}</span>
      {user.name.split(' ')[0]}
    </button>
    {menuOpen && <div className="account-menu" role="menu">
      <p><strong>{user.name}</strong><span>{user.email}</span>
        {user.role === 'admin' && <span className="account-role">Admin</span>}
      </p>
      {user.role === 'customer' && <button role="menuitem" onClick={() => { setMenuOpen(false); onOrders(); }}>My orders</button>}
      {user.role === 'admin' && <button role="menuitem" onClick={() => { setMenuOpen(false); onAdmin(); }}>Admin dashboard</button>}
      <button role="menuitem" onClick={() => {
        setLogoutError('');
        void logout().then(() => { setMenuOpen(false); onLogout(); })
          .catch(() => setLogoutError('Unable to sign out. Please try again.'));
      }}>Log out</button>
      {logoutError && <span className="account-error" role="alert">{logoutError}</span>}
    </div>}
  </div>;
}
