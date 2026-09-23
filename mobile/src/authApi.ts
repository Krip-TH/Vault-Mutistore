import { API_BASE_URL } from './config';
import { apiFetch } from './http';
import type { ApiErrorResponse, AuthResponse, User } from './types';

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

async function readAuth(response: Response, fallback: string): Promise<{ user: User; token: string }> {
  if (!response.ok) throw new Error(await errorMessage(response, fallback));
  const payload = (await response.json()) as Partial<AuthResponse>;
  if (!payload.data || !payload.token) throw new Error('The response was incomplete. Please try again.');
  return { user: payload.data, token: payload.token };
}

export async function registerAccount(form: RegisterForm): Promise<{ user: User; token: string }> {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(form),
  });
  return readAuth(response, 'Unable to create your account. Please try again.');
}

export async function loginAccount(form: LoginForm): Promise<{ user: User; token: string }> {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(form),
  });
  return readAuth(response, 'Incorrect email or password.');
}

/** Validates a stored token against the server and returns the current user, or null if it's no longer valid. */
export async function fetchCurrentUser(token: string): Promise<User | null> {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: User };
    return payload.data ?? null;
  } catch (error) {
    console.error('[VAULT auth] Unable to validate the saved session.', error);
    throw error;
  }
}
