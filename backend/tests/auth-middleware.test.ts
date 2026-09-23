import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { attachUser } from '../src/middleware/auth.js';
import { AUTH_COOKIE_NAME } from '../src/services/authService.js';

process.env.JWT_SECRET = 'test-secret-for-auth-middleware';

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    headers: {},
    ...overrides,
  } as Request;
}

function signToken(payload: { sub: number; role: 'customer' | 'admin' }): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: 60 });
}

function runAttachUser(request: Request): Promise<void> {
  return new Promise(resolve => {
    attachUser(request, {} as Response, () => resolve());
  });
}

test('attachUser reads identity from the session cookie (web)', async () => {
  const token = signToken({ sub: 7, role: 'customer' });
  const request = fakeRequest({ cookies: { [AUTH_COOKIE_NAME]: token } });

  await runAttachUser(request);

  assert.deepEqual(request.auth, { userId: 7, role: 'customer' });
});

test('attachUser reads identity from an Authorization: Bearer header (mobile, no cookie jar)', async () => {
  const token = signToken({ sub: 9, role: 'admin' });
  const request = fakeRequest({ headers: { authorization: `Bearer ${token}` } });

  await runAttachUser(request);

  assert.deepEqual(request.auth, { userId: 9, role: 'admin' });
});

test('attachUser prefers the cookie when both a cookie and a bearer token are present', async () => {
  const cookieToken = signToken({ sub: 1, role: 'customer' });
  const bearerToken = signToken({ sub: 2, role: 'admin' });
  const request = fakeRequest({
    cookies: { [AUTH_COOKIE_NAME]: cookieToken },
    headers: { authorization: `Bearer ${bearerToken}` },
  });

  await runAttachUser(request);

  assert.deepEqual(request.auth, { userId: 1, role: 'customer' });
});

test('attachUser leaves the request unauthenticated when no credential is present', async () => {
  const request = fakeRequest();

  await runAttachUser(request);

  assert.equal(request.auth, undefined);
});

test('attachUser ignores an invalid or expired bearer token instead of throwing', async () => {
  const request = fakeRequest({ headers: { authorization: 'Bearer not-a-real-token' } });

  await runAttachUser(request);

  assert.equal(request.auth, undefined);
});

test('attachUser ignores a malformed Authorization header that is not a Bearer scheme', async () => {
  const token = signToken({ sub: 5, role: 'customer' });
  const request = fakeRequest({ headers: { authorization: `Basic ${token}` } });

  await runAttachUser(request);

  assert.equal(request.auth, undefined);
});
