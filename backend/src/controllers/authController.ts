import type { CookieOptions, Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import {
  AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, getCurrentUser, login, registerCustomer,
} from '../services/authService.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function postRegister(request: Request, response: Response): Promise<void> {
  try {
    const { user, token } = await registerCustomer(request.body);
    response.cookie(AUTH_COOKIE_NAME, token, { ...cookieOptions, maxAge: AUTH_COOKIE_MAX_AGE_MS });
    // The cookie is what the web app uses. `token` is included in the body too so a
    // client with no cookie jar (the mobile app) can store it and send it back as
    // `Authorization: Bearer <token>` instead — see middleware/auth.ts.
    response.status(201).json({ data: user, token });
  } catch (error) {
    sendAuthError(response, error);
  }
}

export async function postLogin(request: Request, response: Response): Promise<void> {
  try {
    const { user, token } = await login(request.body);
    response.cookie(AUTH_COOKIE_NAME, token, { ...cookieOptions, maxAge: AUTH_COOKIE_MAX_AGE_MS });
    response.json({ data: user, token });
  } catch (error) {
    sendAuthError(response, error);
  }
}

export function postLogout(_request: Request, response: Response): void {
  response.clearCookie(AUTH_COOKIE_NAME, cookieOptions);
  response.status(204).end();
}

export async function getMe(request: Request, response: Response): Promise<void> {
  try {
    if (!request.auth) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
      return;
    }
    response.json({ data: await getCurrentUser(request.auth.userId) });
  } catch (error) {
    sendAuthError(response, error);
  }
}

function sendAuthError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Auth request failed:', error);
  response.status(500).json({ error: { code: 'AUTH_FAILED', message: 'Unable to process the request. Please try again.' } });
}
