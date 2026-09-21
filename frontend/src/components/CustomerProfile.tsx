import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function CustomerProfile({ onLogout }: { onLogout: () => Promise<void> }) {
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setLoggingOut(true); setError('');
    try { await onLogout(); } catch { setError('Unable to sign out. Please try again.'); setLoggingOut(false); }
  }
  return <main className="customer-profile" aria-labelledby="profile-title">
    <section>
      <p className="eyebrow">YOUR VAULT ACCOUNT</p>
      <h1 id="profile-title">Profile</h1>
      <p>Review the account information connected to your current session.</p>
      <dl><div><dt>Name</dt><dd>{user?.name}</dd></div><div><dt>Email</dt><dd>{user?.email}</dd></div><div><dt>Account type</dt><dd>{user?.role}</dd></div></dl>
      <button className="primary-button" disabled={loggingOut} onClick={() => void logout()}>{loggingOut ? 'Signing out…' : 'Log out'}</button>
      {error && <p className="checkout-error" role="alert">{error}</p>}
    </section>
  </main>;
}
