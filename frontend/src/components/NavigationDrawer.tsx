import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function HamburgerButton({ expanded, onClick, label = 'Open navigation' }: { expanded: boolean; onClick: () => void; label?: string }) {
  return <button type="button" className="nav-hamburger" aria-label={label} aria-expanded={expanded} onClick={onClick}><span aria-hidden="true">☰</span></button>;
}

export function NavigationDrawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeRef.current?.focus());
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previousFocus.current?.focus();
    };
  }, [onClose, open]);
  if (!open) return null;
  return <div className="nav-drawer-layer">
    <button type="button" className="nav-drawer-backdrop" aria-label="Close navigation" onClick={onClose} />
    <aside className="nav-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <header><strong><span>V.</span>{title}</strong><button ref={closeRef} type="button" aria-label="Close navigation" onClick={onClose}>×</button></header>
      {children}
    </aside>
  </div>;
}
