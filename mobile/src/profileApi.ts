import type { ImagePickerAsset } from 'expo-image-picker';
import { authorizedHeaders, errorMessage } from './api';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type { Profile, ProfileForm } from './types';

async function readProfile(response: Response, fallback: string): Promise<Profile> {
  if (!response.ok) throw new Error(await errorMessage(response, fallback));
  const payload = (await response.json()) as { data?: Profile };
  if (!payload.data) throw new Error('The response was incomplete. Please try again.');
  return payload.data;
}

export async function fetchProfile(): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    headers: await authorizedHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readProfile(response, 'Unable to load your profile.');
}

/** The server identifies the user from the Bearer token; no user id is ever sent. */
export async function updateProfile(form: ProfileForm): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: await authorizedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(form),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readProfile(response, 'Unable to save your profile. Please try again.');
}

export async function uploadProfileImage(asset: ImagePickerAsset): Promise<Profile> {
  const body = new FormData();
  // React Native's FormData accepts this {uri, name, type} shape in place of a Blob;
  // the DOM FormData types don't know about it, hence the cast.
  body.append('image', {
    uri: asset.uri,
    name: asset.fileName || 'profile-photo.jpg',
    type: asset.mimeType || 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/api/profile/image`, {
    method: 'POST',
    headers: await authorizedHeaders(),
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readProfile(response, 'Unable to upload your photo. Please try again.');
}

export async function removeProfileImage(): Promise<Profile> {
  const response = await fetch(`${API_BASE_URL}/api/profile/image`, {
    method: 'DELETE',
    headers: await authorizedHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readProfile(response, 'Unable to remove your photo. Please try again.');
}

/** profile_image_url from the API is a relative path (e.g. /uploads/profiles/x.jpg) — a browser
 *  resolves that against its own origin, but React Native has no such origin and needs the full URL. */
export function resolveImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}
