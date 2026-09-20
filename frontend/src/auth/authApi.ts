import type { AuthErrorResponse, LoginForm, RegisterForm, User, UserResponse } from '../types/auth';

type Fetcher = typeof fetch;

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as AuthErrorResponse;
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

async function readUser(response: Response, fallback: string): Promise<User> {
  if (!response.ok) throw new Error(await errorMessage(response, fallback));
  const payload = await response.json() as Partial<UserResponse>;
  if (!payload.data) throw new Error('The response was incomplete. Please try again.');
  return payload.data;
}

export async function registerAccount(form: RegisterForm, fetcher: Fetcher = fetch): Promise<User> {
  const response = await fetcher('/api/auth/register', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(form),
  });
  return readUser(response, 'Unable to create your account. Please try again.');
}

export async function loginAccount(form: LoginForm, fetcher: Fetcher = fetch): Promise<User> {
  const response = await fetcher('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(form),
  });
  return readUser(response, 'Incorrect email or password.');
}

export async function logoutAccount(fetcher: Fetcher = fetch): Promise<void> {
  const response = await fetcher('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Unable to sign out. Please try again.');
}

export async function loginAdminAccount(form: LoginForm, fetcher: Fetcher = fetch): Promise<User> {
  const user = await loginAccount(form, fetcher);
  if (user.role === 'admin') return user;

  try {
    await logoutAccount(fetcher);
  } catch {
    // Access remains denied even if the server cannot acknowledge session cleanup.
  }
  throw new Error('This account does not have administrator access.');
}

export async function fetchCurrentUser(fetcher: Fetcher = fetch): Promise<User | null> {
  const response = await fetcher('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  const payload = await response.json() as Partial<UserResponse>;
  return payload.data ?? null;
}
