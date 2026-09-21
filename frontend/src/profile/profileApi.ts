import type { Profile, ProfileErrorResponse, ProfileForm, ProfileResponse } from '../types/profile';

type Fetcher = typeof fetch;

async function readProfile(response: Response, fallback: string): Promise<Profile> {
  if (!response.ok) {
    let message = fallback;
    try {
      message = (await response.json() as ProfileErrorResponse).error?.message || fallback;
    } catch { /* Use the safe fallback for non-JSON error responses. */ }
    throw new Error(message);
  }
  const payload = await response.json() as Partial<ProfileResponse>;
  if (!payload.data) throw new Error('The response was incomplete. Please try again.');
  return payload.data;
}

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' };

export async function fetchProfile(fetcher: Fetcher = fetch): Promise<Profile> {
  return readProfile(await fetcher('/api/profile', { credentials: 'same-origin', headers: { Accept: 'application/json' } }), 'Unable to load your profile.');
}

/** The server identifies the user from the session cookie; no user id is ever sent. */
export async function updateProfile(form: ProfileForm, fetcher: Fetcher = fetch): Promise<Profile> {
  return readProfile(await fetcher('/api/profile', {
    method: 'PUT', credentials: 'same-origin', headers: jsonHeaders, body: JSON.stringify(form),
  }), 'Unable to save your profile. Please try again.');
}

export async function uploadProfileImage(file: File, fetcher: Fetcher = fetch): Promise<Profile> {
  const body = new FormData();
  body.append('image', file);
  return readProfile(await fetcher('/api/profile/image', {
    method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body,
  }), 'Unable to upload your photo. Please try again.');
}

export async function removeProfileImage(fetcher: Fetcher = fetch): Promise<Profile> {
  return readProfile(await fetcher('/api/profile/image', {
    method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' },
  }), 'Unable to remove your photo. Please try again.');
}
