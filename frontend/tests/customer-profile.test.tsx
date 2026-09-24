import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider } from '../src/auth/AuthContext';
import CustomerProfile, { ProfileAvatar, ProfileEditForm, ProfileView } from '../src/components/CustomerProfile';
import { initialCheckoutForm } from '../src/checkout/checkout';
import { fetchProfile, removeProfileImage, updateProfile, uploadProfileImage } from '../src/profile/profileApi';
import {
  applyProfileToCheckout, initialProfileState, profileReducer, profileToForm, saveProfileChanges, validateProfileForm, validateProfileImage,
} from '../src/profile/profile';
import type { ProfileApi, ProfileState } from '../src/profile/profile';
import type { CheckoutForm } from '../src/types/order';
import type { Profile } from '../src/types/profile';

const profile: Profile = {
  id: 7, name: 'Narin Chai', email: 'narin@example.test', role: 'customer', phone: '+66 81 234 5678',
  address: '88 Sukhumvit Road', city: 'Watthana', province: 'Bangkok', postal_code: '10110', country: 'Thailand',
  profile_image_url: '/uploads/profiles/0b5d0d37-7a55-4a3c-8d0b-0f3f6d2a9e11.png', created_at: '2026-01-15T08:00:00.000Z',
};
const bare: Profile = { ...profile, phone: null, address: null, city: null, province: null, postal_code: null, country: null, profile_image_url: null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const reduce = (state: ProfileState, ...actions: Parameters<typeof profileReducer>[1][]) => actions.reduce(profileReducer, state);
const loaded = () => reduce(initialProfileState, { type: 'loaded', profile });
const pngFile = () => new File(['x'], 'me.png', { type: 'image/png' });

// ---------------------------------------------------------------- rendering

test('the profile view shows every personal and account field', () => {
  const html = renderToStaticMarkup(<ProfileView profile={profile} />);
  for (const text of ['Narin Chai', 'narin@example.test', '+66 81 234 5678', '88 Sukhumvit Road', 'Watthana', 'Bangkok', '10110', 'Thailand', 'customer']) {
    assert.ok(html.includes(text), text);
  }
  for (const label of ['Full name', 'Email', 'Phone', 'Address', 'City', 'Province / State', 'Postal code', 'Country', 'Role', 'Member since']) {
    assert.ok(html.includes(`>${label}<`), label);
  }
  assert.match(html, /15 January 2026/);
  assert.doesNotMatch(html, /password|hash/i);
});

test('missing optional fields render a placeholder instead of empty or "null" text', () => {
  const html = renderToStaticMarkup(<ProfileView profile={bare} />);
  assert.doesNotMatch(html, /null|undefined/);
  assert.equal((html.match(/Not provided/g) ?? []).length, 6);
});

test('the avatar shows the uploaded photo or falls back to an initial', () => {
  assert.match(renderToStaticMarkup(<ProfileAvatar name="Narin Chai" src={profile.profile_image_url} large />), /<img[^>]+src="\/uploads\/profiles\/0b5d/);
  const fallback = renderToStaticMarkup(<ProfileAvatar name="narin chai" src={null} />);
  assert.doesNotMatch(fallback, /<img/);
  assert.match(fallback, />N</);
  assert.match(fallback, /aria-label="Default profile avatar"/);
});

test('the edit form offers Save Changes and Cancel, prefilled values, and a read-only email', () => {
  const html = renderToStaticMarkup(<ProfileEditForm form={profileToForm(profile)} errors={{ phone: 'Enter a valid phone number.' }} email={profile.email}
    saving={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />);
  assert.match(html, />Save Changes</);
  assert.match(html, />Cancel</);
  assert.match(html, /value="Narin Chai"/);
  assert.match(html, /value="88 Sukhumvit Road"/);
  assert.match(html, /<input[^>]*value="narin@example.test"[^>]*readonly=""|<input[^>]*readonly=""[^>]*value="narin@example.test"/);
  assert.match(html, /Enter a valid phone number\./);
  assert.match(html, /aria-invalid="true"/);
  assert.doesNotMatch(html, /name="(role|email|password|id)"/);
});

test('the edit form disables its controls while saving', () => {
  const html = renderToStaticMarkup(<ProfileEditForm form={profileToForm(profile)} errors={{}} email={profile.email} saving
    onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />);
  assert.match(html, />Saving…</);
  assert.equal((html.match(/disabled=""/g) ?? []).length >= 8, true);
});

test('the profile page renders its loading state and keeps the logout action', () => {
  const html = renderToStaticMarkup(<AuthProvider><CustomerProfile onLogout={async () => {}} /></AuthProvider>);
  assert.match(html, /Loading your profile/);
  assert.match(html, />Log out</);
  assert.doesNotMatch(html, /Edit Profile/);
});

// ------------------------------------------------------- edit / save / cancel

test('profile starts read-only and Edit Profile switches to an editable copy of the saved values', () => {
  const state = loaded();
  assert.equal(state.mode, 'view');
  const editing = reduce(state, { type: 'edit' });
  assert.equal(editing.mode, 'edit');
  assert.deepEqual(editing.form, profileToForm(profile));
});

test('Cancel discards every unsaved change, including a pending photo', () => {
  const state = reduce(loaded(), { type: 'edit' }, { type: 'change', field: 'name', value: 'Someone Else' },
    { type: 'change', field: 'city', value: 'Phuket' }, { type: 'chooseImage', file: pngFile() }, { type: 'failed', message: 'boom' }, { type: 'cancel' });
  assert.equal(state.mode, 'view');
  assert.equal(state.profile?.name, 'Narin Chai');
  assert.deepEqual(state.form, profileToForm(profile));
  assert.equal(state.imageFile, null);
  assert.equal(state.error, '');
  assert.equal(reduce(state, { type: 'edit' }).form.city, 'Watthana');
});

test('a successful save leaves edit mode, shows the new values and a success notice', () => {
  const updated = { ...profile, name: 'Narin C.', city: 'Phuket' };
  const state = reduce(loaded(), { type: 'edit' }, { type: 'change', field: 'name', value: 'Narin C.' }, { type: 'saving' }, { type: 'saved', result: { profile: updated } });
  assert.equal(state.mode, 'view');
  assert.equal(state.saving, false);
  assert.equal(state.profile?.name, 'Narin C.');
  assert.equal(state.notice, 'Your profile has been updated.');
  const html = renderToStaticMarkup(<ProfileView profile={state.profile!} />);
  assert.match(html, /Narin C\./);
  assert.match(html, /Phuket/);
});

test('a failed save stays in edit mode, keeps the typed values and shows the error', () => {
  const state = reduce(loaded(), { type: 'edit' }, { type: 'change', field: 'phone', value: '12345678' }, { type: 'saving' }, { type: 'failed', message: 'Enter a valid phone number.' });
  assert.equal(state.mode, 'edit');
  assert.equal(state.saving, false);
  assert.equal(state.form.phone, '12345678');
  assert.equal(state.error, 'Enter a valid phone number.');
  assert.equal(state.profile?.phone, '+66 81 234 5678');
});

test('editing a field clears only that field validation error', () => {
  const state = reduce(loaded(), { type: 'edit' }, { type: 'invalid', errors: { name: 'Enter your full name.', phone: 'Enter a valid phone number.' } }, { type: 'change', field: 'name', value: 'N' });
  assert.equal(state.errors.name, undefined);
  assert.equal(state.errors.phone, 'Enter a valid phone number.');
});

test('a partial photo failure is surfaced as a warning without losing the saved details', async () => {
  const saved = { ...profile, name: 'Saved Name' };
  const api: ProfileApi = {
    update: async () => saved,
    upload: async () => { throw new Error('Profile photos must be 5 MB or smaller.'); },
    remove: async () => bare,
  };
  const result = await saveProfileChanges({ form: profileToForm(saved), imageFile: pngFile(), removeImage: false }, api);
  assert.equal(result.profile.name, 'Saved Name');
  assert.match(result.warning ?? '', /details were saved.*5 MB/);
  const state = reduce(loaded(), { type: 'edit' }, { type: 'saved', result });
  assert.equal(state.mode, 'view');
  assert.equal(state.profile?.name, 'Saved Name');
  assert.match(state.error, /photo could not be updated/);
  assert.equal(state.notice, '');
});

test('saveProfileChanges saves fields first, then applies exactly one photo change', async () => {
  const calls: string[] = [];
  const api: ProfileApi = {
    update: async () => { calls.push('update'); return profile; },
    upload: async () => { calls.push('upload'); return profile; },
    remove: async () => { calls.push('remove'); return bare; },
  };
  await saveProfileChanges({ form: profileToForm(profile), imageFile: null, removeImage: false }, api);
  await saveProfileChanges({ form: profileToForm(profile), imageFile: pngFile(), removeImage: false }, api);
  const removed = await saveProfileChanges({ form: profileToForm(profile), imageFile: null, removeImage: true }, api);
  assert.deepEqual(calls, ['update', 'update', 'upload', 'update', 'remove']);
  assert.equal(removed.profile.profile_image_url, null);
  const failing: ProfileApi = { ...api, update: async () => { throw new Error('nope'); } };
  await assert.rejects(saveProfileChanges({ form: profileToForm(profile), imageFile: pngFile(), removeImage: false }, failing), /nope/);
});

// ---------------------------------------------------------------- validation

test('profile form validation matches the server rules', () => {
  const ok = profileToForm(profile);
  assert.deepEqual(validateProfileForm(ok), {});
  assert.deepEqual(validateProfileForm(profileToForm(bare)), {});
  assert.equal(validateProfileForm({ ...ok, name: '   ' }).name, 'Enter your full name.');
  assert.match(validateProfileForm({ ...ok, phone: 'abc' }).phone ?? '', /valid phone/);
  assert.match(validateProfileForm({ ...ok, postal_code: '!!' }).postal_code ?? '', /valid postal code/);
  assert.match(validateProfileForm({ ...ok, address: 'a'.repeat(256) }).address ?? '', /255 characters/);
  assert.match(validateProfileForm({ ...ok, name: '<b>x</b>' }).name ?? '', /not allowed/);
});

test('profile photo validation accepts JPEG, PNG and WEBP up to 5 MB only', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validateProfileImage(new File(['x'], 'a', { type })), null);
  assert.match(validateProfileImage(new File(['x'], 'a.svg', { type: 'image/svg+xml' })) ?? '', /JPEG, PNG, or WEBP/);
  assert.match(validateProfileImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' })) ?? '', /5 MB/);
});

// ----------------------------------------------------------------- API client

test('profile requests use the session cookie and never send an id, role or password', async () => {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => { seen.push({ url: String(input), init }); return json({ data: profile }); };
  await fetchProfile(fetcher);
  await updateProfile(profileToForm(profile), fetcher);
  await uploadProfileImage(pngFile(), fetcher);
  await removeProfileImage(fetcher);

  assert.deepEqual(seen.map(call => [call.init?.method ?? 'GET', call.url]), [['GET', '/api/profile'], ['PUT', '/api/profile'], ['POST', '/api/profile/image'], ['DELETE', '/api/profile/image']]);
  for (const call of seen) assert.equal(call.init?.credentials, 'same-origin');
  const body = JSON.parse(String(seen[1].init?.body));
  assert.deepEqual(Object.keys(body).sort(), ['address', 'city', 'country', 'name', 'phone', 'postal_code', 'province']);
  assert.ok(seen[2].init?.body instanceof FormData);
  assert.equal((seen[2].init?.body as FormData).get('image') instanceof File, true);
});

test('profile API errors surface the server message, with safe fallbacks', async () => {
  const rejecting = (body: unknown, status: number): typeof fetch => async () => json(body, status);
  await assert.rejects(updateProfile(profileToForm(profile), rejecting({ error: { code: 'INVALID_PROFILE', message: 'Enter a valid phone number.' } }, 400)), /Enter a valid phone number\./);
  await assert.rejects(fetchProfile(async () => new Response('<html>', { status: 502 })), /Unable to load your profile/);
  await assert.rejects(fetchProfile(rejecting({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } }, 401)), /Sign in/);
  await assert.rejects(fetchProfile(async () => json({})), /incomplete/);
});

// ------------------------------------------------------------------ checkout

test('checkout is prefilled from the saved profile', () => {
  const form = applyProfileToCheckout(initialCheckoutForm, profile, new Set());
  assert.deepEqual(form, {
    name: 'Narin Chai', email: 'narin@example.test', phone: '+66 81 234 5678', address_line1: '88 Sukhumvit Road', address_line2: '',
    district: 'Watthana', province: 'Bangkok', postal_code: '10110', country: 'Thailand',
  });
});

test('checkout prefill never overwrites what the customer typed and keeps defaults for missing profile data', () => {
  const typed: CheckoutForm = { ...initialCheckoutForm, address_line1: '1 Gift Street', province: 'Chiang Mai' };
  const form = applyProfileToCheckout(typed, profile, new Set<keyof CheckoutForm>(['address_line1', 'province']));
  assert.equal(form.address_line1, '1 Gift Street');
  assert.equal(form.province, 'Chiang Mai');
  assert.equal(form.name, 'Narin Chai');
  assert.equal(applyProfileToCheckout(initialCheckoutForm, bare, new Set()).country, 'Thailand');
  assert.equal(applyProfileToCheckout(initialCheckoutForm, bare, new Set()).phone, '');
  assert.equal(profile.address, '88 Sukhumvit Road', 'the profile object itself is not mutated');
});
