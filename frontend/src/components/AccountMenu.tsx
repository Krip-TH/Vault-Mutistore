import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function AccountMenu({ onAdmin }: { onAdmin: () => void }) {
  const { user, loading, openLogin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  if (loading) return null;

  if (!user) {
    return <button className="account-button" onClick={openLogin}>Sign in</button>;
  }

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
      {user.role === 'admin' && <button role="menuitem" onClick={() => { setMenuOpen(false); onAdmin(); }}>Admin dashboard</button>}
      <button role="menuitem" onClick={() => { setMenuOpen(false); void logout(); }}>Log out</button>
    </div>}
  </div>;
}
