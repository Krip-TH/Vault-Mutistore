import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const { authView, openLogin, openRegister, login, register } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => { setError(''); }, [authView]);

  function switchView(view: 'login' | 'register') {
    setPassword('');
    setError('');
    if (view === 'login') openLogin(); else openRegister();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (authView === 'register' && !name.trim()) { setError('Enter your full name.'); return; }
    if (!emailPattern.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setSubmitting(true);
    try {
      if (authView === 'register') {
        await register({ name: name.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to process the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isRegister = authView === 'register';

  return <dialog ref={dialogRef} className="checkout-dialog auth-dialog" aria-labelledby="auth-title"
    onCancel={event => { if (submitting) event.preventDefault(); else onClose(); }}>
    <form className="checkout-shell auth-shell" onSubmit={submit} noValidate>
      <header className="checkout-header">
        <span className="eyebrow">{isRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}</span>
        <button type="button" className="checkout-close" onClick={onClose} disabled={submitting} aria-label="Close">×</button>
      </header>
      <div className="auth-body">
        <p className="eyebrow">MOODENG MULTISTORE</p>
        <h2 id="auth-title">{isRegister ? 'Create your account.' : 'Welcome back.'}</h2>
        <p className="auth-subtitle">{isRegister ? 'Sign up to place orders and track your purchase history.' : 'Sign in to continue to your account.'}</p>

        {isRegister && <label className="checkout-field">
          <span>Full name</span>
          <input name="name" type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} />
        </label>}
        <label className="checkout-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label className="checkout-field">
          <span>Password</span>
          <input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password} onChange={event => setPassword(event.target.value)} />
        </label>

        {error && <p className="checkout-error" role="alert">{error}</p>}

        <button className="primary-button auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <span aria-hidden="true">↗</span>
        </button>

        <p className="auth-switch">
          {isRegister ? 'Already have an account? ' : 'New to Moodeng MultiStore? '}
          <button type="button" className="text-button" onClick={() => switchView(isRegister ? 'login' : 'register')} disabled={submitting}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </form>
  </dialog>;
}
