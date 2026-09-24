import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchProfile } from '../profile/profileApi';
import {
  defaultProfileApi, formatMemberSince, initialProfileState, profileInitial, profileReducer, saveProfileChanges,
  validateProfileForm, validateProfileImage,
} from '../profile/profile';
import type { ProfileApi, ProfileErrors } from '../profile/profile';
import type { Profile, ProfileForm } from '../types/profile';

export function ProfileAvatar({ name, src, large }: { name: string; src?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={`profile-avatar ${large ? 'is-large' : ''}`}>
    {src && !failed
      ? <img src={src} alt={`${name || 'Customer'} profile photo`} onError={() => setFailed(true)} />
      : <span className="profile-avatar-fallback" role="img" aria-label="Default profile avatar">{profileInitial(name)}</span>}
  </span>;
}

const notProvided = 'Not provided';

function Fact({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd className={value ? '' : 'is-empty'}>{value || notProvided}</dd></div>;
}

export function ProfileView({ profile }: { profile: Profile }) {
  return <>
    <dl className="profile-facts" aria-label="Contact details">
      <Fact label="Full name" value={profile.name} />
      <Fact label="Email" value={profile.email} />
      <Fact label="Phone" value={profile.phone} />
    </dl>
    <h2 className="profile-section-title">Address</h2>
    <dl className="profile-facts" aria-label="Address">
      <Fact label="Address" value={profile.address} />
      <Fact label="City" value={profile.city} />
      <Fact label="Province / State" value={profile.province} />
      <Fact label="Postal code" value={profile.postal_code} />
      <Fact label="Country" value={profile.country} />
    </dl>
    <h2 className="profile-section-title">Account</h2>
    <dl className="profile-facts" aria-label="Account">
      <div><dt>Role</dt><dd className="is-capitalized">{profile.role}</dd></div>
      <div><dt>Member since</dt><dd>{formatMemberSince(profile.created_at)}</dd></div>
    </dl>
  </>;
}

const textFields: Array<{ name: keyof ProfileForm; label: string; autoComplete: string; type?: 'text' | 'tel'; maxLength: number; required?: boolean }> = [
  { name: 'name', label: 'Full name', autoComplete: 'name', maxLength: 160, required: true },
  { name: 'phone', label: 'Phone', autoComplete: 'tel', type: 'tel', maxLength: 40 },
  { name: 'address', label: 'Address', autoComplete: 'address-line1', maxLength: 255 },
  { name: 'city', label: 'City', autoComplete: 'address-level2', maxLength: 120 },
  { name: 'province', label: 'Province / State', autoComplete: 'address-level1', maxLength: 120 },
  { name: 'postal_code', label: 'Postal code', autoComplete: 'postal-code', maxLength: 20 },
  { name: 'country', label: 'Country', autoComplete: 'country-name', maxLength: 120 },
];

export function ProfileEditForm({ form, errors, email, saving, onChange, onSubmit, onCancel }: {
  form: ProfileForm; errors: ProfileErrors; email: string; saving: boolean;
  onChange: (field: keyof ProfileForm, value: string) => void; onSubmit: (event: FormEvent) => void; onCancel: () => void;
}) {
  const field = (name: keyof ProfileForm) => {
    const spec = textFields.find(item => item.name === name)!;
    const error = errors[name];
    return <label className={`checkout-field ${error ? 'has-error' : ''}`} key={name}>
      <span>{spec.label}{!spec.required && <small>Optional</small>}</span>
      <input name={name} type={spec.type ?? 'text'} value={form[name]} autoComplete={spec.autoComplete} maxLength={spec.maxLength}
        required={spec.required} aria-invalid={!!error} aria-describedby={error ? `profile-${name}-error` : undefined}
        disabled={saving} onChange={event => onChange(name, event.target.value)} />
      {error && <small id={`profile-${name}-error`}>{error}</small>}
    </label>;
  };
  return <form className="profile-form" onSubmit={onSubmit} noValidate aria-label="Edit profile">
    {field('name')}
    <label className="checkout-field is-readonly">
      <span>Email<small>Read only</small></span>
      <input type="email" value={email} readOnly aria-readonly="true" tabIndex={-1} />
      <small>Your email is your sign-in and cannot be changed here.</small>
    </label>
    {field('phone')}
    <h2 className="profile-section-title">Address</h2>
    {field('address')}
    <div className="checkout-field-row">{field('city')}{field('province')}</div>
    <div className="checkout-field-row">{field('postal_code')}{field('country')}</div>
    <div className="profile-actions">
      <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
    </div>
  </form>;
}

export default function CustomerProfile({ onLogout, api = defaultProfileApi, load = fetchProfile }: {
  onLogout: () => Promise<void>;
  api?: ProfileApi;
  load?: () => Promise<Profile>;
}) {
  const { user, refreshUser } = useAuth();
  const [state, dispatch] = useReducer(profileReducer, initialProfileState);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const savingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    load()
      .then(profile => { if (active) dispatch({ type: 'loaded', profile }); })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your profile.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => loadProfile(), [loadProfile]);

  const preview = useMemo(() => state.imageFile ? URL.createObjectURL(state.imageFile) : null, [state.imageFile]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const { profile, mode } = state;
  const editing = mode === 'edit';

  async function save(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    const errors = validateProfileForm(state.form);
    if (Object.values(errors).some(Boolean)) { dispatch({ type: 'invalid', errors }); return; }
    savingRef.current = true;
    dispatch({ type: 'saving' });
    try {
      const result = await saveProfileChanges({ form: state.form, imageFile: state.imageFile, removeImage: state.removeImage }, api);
      dispatch({ type: 'saved', result });
      await refreshUser().catch(() => undefined);
    } catch (error) {
      dispatch({ type: 'failed', message: error instanceof Error ? error.message : 'Unable to save your profile. Please try again.' });
    } finally {
      savingRef.current = false;
    }
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    const problem = validateProfileImage(file);
    if (problem) { dispatch({ type: 'imageError', message: problem }); return; }
    dispatch({ type: 'chooseImage', file });
  }

  async function logout() {
    setLoggingOut(true); setLogoutError('');
    try { await onLogout(); } catch { setLogoutError('Unable to sign out. Please try again.'); setLoggingOut(false); }
  }

  const displayName = editing ? state.form.name : profile?.name ?? user?.name ?? '';
  const displayImage = editing ? (state.removeImage ? null : preview ?? profile?.profile_image_url) : profile?.profile_image_url;

  return <main className="customer-profile" aria-labelledby="profile-title">
    <section aria-busy={loading || state.saving}>
      <div className="profile-heading">
        <ProfileAvatar name={displayName} src={displayImage} large />
        <div>
          <p className="eyebrow">YOUR VAULT ACCOUNT</p>
          <h1 id="profile-title">Profile</h1>
          {profile && <p className="profile-identity"><strong>{profile.name}</strong><span>{profile.email}</span></p>}
        </div>
      </div>

      {loading && <p className="profile-status" role="status">Loading your profile…</p>}
      {loadError && <div className="profile-status is-error" role="alert">
        <p>{loadError}</p>
        <button className="secondary-button" onClick={() => loadProfile()}>Try again</button>
      </div>}
      {state.notice && <p className="profile-notice" role="status">{state.notice}</p>}
      {state.error && <p className="checkout-error" role="alert">{state.error}</p>}

      {profile && !editing && <>
        <ProfileView profile={profile} />
        <div className="profile-actions">
          <button className="primary-button" onClick={() => dispatch({ type: 'edit' })}>Edit Profile</button>
        </div>
      </>}

      {profile && editing && <>
        <div className="profile-photo-editor">
          <div className="profile-photo-buttons">
            <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()} disabled={state.saving}>
              {displayImage ? 'Change photo' : 'Upload photo'}
            </button>
            {displayImage && <button type="button" className="secondary-button" onClick={() => dispatch({ type: 'removeImage' })} disabled={state.saving}>Remove photo</button>}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          <small>JPEG, PNG, or WEBP · maximum 5 MB{state.imageFile ? ` · New photo: ${state.imageFile.name}` : ''}</small>
        </div>
        <ProfileEditForm form={state.form} errors={state.errors} email={profile.email} saving={state.saving}
          onChange={(field, value) => dispatch({ type: 'change', field, value })} onSubmit={event => void save(event)}
          onCancel={() => dispatch({ type: 'cancel' })} />
      </>}

      <div className="profile-logout">
        <button className="secondary-button" disabled={loggingOut} onClick={() => void logout()}>{loggingOut ? 'Signing out…' : 'Log out'}</button>
        {logoutError && <p className="checkout-error" role="alert">{logoutError}</p>}
      </div>
    </section>
  </main>;
}
