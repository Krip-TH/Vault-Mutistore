import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { User } from '../types/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage({ view, mode, onViewChange, onAdminLogin, onCustomerLogin, onAuthenticated }: {
  view: 'login' | 'register';
  mode: 'customer' | 'admin';
  onViewChange: (view: 'login' | 'register') => void;
  onAdminLogin: () => void;
  onCustomerLogin: () => void;
  onAuthenticated: (user: User) => void;
}) {
  const { login, loginAdmin, register } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isAdmin = mode === 'admin';
  const isRegister = !isAdmin && view === 'register';

  useEffect(() => { setError(''); setPassword(''); }, [mode, view]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (isRegister && !name.trim()) { setError('Enter your full name.'); return; }
    if (!emailPattern.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setSubmitting(true);
    try {
      const user = isRegister
        ? await register({ name: name.trim(), email: email.trim(), password })
        : await (isAdmin ? loginAdmin : login)({ email: email.trim(), password });
      onAuthenticated(user);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? 'Unable to reach VAULT. Check your connection and try again.'
        : requestError instanceof Error ? requestError.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={`auth-page${isAdmin ? ' is-admin' : ''}`}>
    <section className="auth-visual" aria-label="VAULT introduction">
      <a className="auth-brand" href={isAdmin ? '#/admin/login' : '#/login'}><span>V.</span><strong>{isAdmin ? 'VAULT ADMIN' : 'VAULT'}</strong></a>
      <div className="auth-visual-copy">
        <p className="eyebrow">{isAdmin ? 'RESTRICTED OPERATIONS' : 'SIX BUSINESSES. ONE DESTINATION.'}</p>
        <h1>{isAdmin ? <>Manage the marketplace.<br /><em>With clarity.</em></> : <>Find the exceptional.<br /><em>Keep it close.</em></>}</h1>
        <p>{isAdmin
          ? 'Secure access for authorized VAULT administrators managing orders and marketplace operations.'
          : 'A considered marketplace for independent collections, live inventory, and every order that follows.'}</p>
      </div>
      <p className="auth-edition">VAULT / MULTI-STORE MARKETPLACE</p>
    </section>
    <section className="auth-panel" aria-labelledby="auth-title">
      <form className="auth-form" onSubmit={submit} noValidate>
        <p className="eyebrow">{isAdmin ? 'VAULT ADMIN' : 'VAULT'}</p>
        <h2 id="auth-title">{isAdmin ? 'Administrator access.' : isRegister ? 'Create your account.' : 'Welcome back.'}</h2>
        <p className="auth-subtitle">{isRegister
          ? 'Join VAULT to place orders and follow your purchase history.'
          : isAdmin ? 'Sign in with an authorized administrator account.' : 'Sign in to continue.'}</p>

        {isRegister && <label className="auth-field">
          <span>Full name</span>
          <input name="name" type="text" autoComplete="name" value={name}
            disabled={submitting} onChange={event => setName(event.target.value)} />
        </label>}
        <label className="auth-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" value={email}
            disabled={submitting} onChange={event => setEmail(event.target.value)} />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password} disabled={submitting} onChange={event => setPassword(event.target.value)} />
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={submitting}>
          <span>{submitting ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : isAdmin ? 'Sign in to Admin' : 'Sign in'}</span>
          <span aria-hidden="true">↗</span>
        </button>
        {isAdmin ? <p className="auth-switch"><button type="button" onClick={onCustomerLogin} disabled={submitting}>← Customer sign in</button></p>
          : <><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to VAULT?'}{' '}
            <button type="button" onClick={() => onViewChange(isRegister ? 'login' : 'register')} disabled={submitting}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          {!isRegister && <p className="admin-auth-entry">Administrator? <button type="button" onClick={onAdminLogin} disabled={submitting}>Admin sign in →</button></p>}</>}
        {isRegister && <p className="auth-role-note">New accounts are created as customer accounts. Administrator access is assigned privately.</p>}
      </form>
    </section>
  </main>;
}
