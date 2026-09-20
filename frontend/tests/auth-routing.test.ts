import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCurrentUser, loginAccount, loginAdminAccount, logoutAccount, registerAccount } from '../src/auth/authApi';
import { parseRoute, resolveProtectedRoute, routeAfterAuthentication, routeAfterLogout, routeHash } from '../src/auth/routes';
import { adminNavigation, customerNavigation } from '../src/navigation';
import type { User } from '../src/types/auth';

const customer: User = { id: 2, name: 'Customer One', email: 'customer@example.test', role: 'customer' };
const admin: User = { id: 1, name: 'VAULT Admin', email: 'admin@example.test', role: 'admin' };

function userFetcher(user: User): typeof fetch {
  return async (_input, init) => {
    assert.equal(init?.credentials, 'same-origin');
    return new Response(JSON.stringify({ data: user }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
}

test('unauthenticated protected routes resolve to the dedicated login page', () => {
  for (const route of ['home', 'orders'] as const) {
    assert.equal(resolveProtectedRoute(route, null), 'login');
  }
  for (const route of ['admin-login', 'admin', 'admin-orders'] as const) {
    assert.equal(resolveProtectedRoute(route, null), 'admin-login');
  }
  assert.equal(resolveProtectedRoute('register', null), 'register');
});

test('successful customer login routes to Home and cannot enter admin routes', async () => {
  const user = await loginAccount({ email: customer.email, password: 'Password123' }, userFetcher(customer));
  assert.equal(routeAfterAuthentication(user), 'home');
  assert.equal(resolveProtectedRoute('home', user), 'home');
  assert.equal(resolveProtectedRoute('orders', user), 'orders');
  assert.equal(resolveProtectedRoute('admin', user), 'home');
  assert.equal(resolveProtectedRoute('admin-orders', user), 'home');
  assert.equal(resolveProtectedRoute('admin-login', user), 'home');
  assert.equal(resolveProtectedRoute('login', user), 'home');
});

test('successful admin login routes to and preserves the Admin Dashboard', async () => {
  const user = await loginAdminAccount({ email: admin.email, password: 'Password123' }, userFetcher(admin));
  assert.equal(routeAfterAuthentication(user), 'admin');
  assert.equal(resolveProtectedRoute('admin', user), 'admin');
  assert.equal(resolveProtectedRoute('admin-orders', user), 'admin-orders');
  assert.equal(resolveProtectedRoute('login', user), 'admin');
});

test('customer credentials are rejected by the admin login and the session is cleared', async () => {
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url === '/api/auth/login') return new Response(JSON.stringify({ data: customer }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
    return new Response(null, { status: 204 });
  };
  await assert.rejects(
    loginAdminAccount({ email: customer.email, password: 'Password123' }, fetcher),
    /does not have administrator access/,
  );
  assert.deepEqual(requests, ['/api/auth/login', '/api/auth/logout']);
});

test('public registration sends no role and remains customer-only', async () => {
  let body = '';
  const registered = await registerAccount({ name: 'New Customer', email: 'new@example.test', password: 'Password123' }, async (_input, init) => {
    body = String(init?.body);
    return new Response(JSON.stringify({ data: customer }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  });
  assert.equal(registered.role, 'customer');
  assert.deepEqual(JSON.parse(body), { name: 'New Customer', email: 'new@example.test', password: 'Password123' });
});

test('invalid login preserves the backend error message', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
  }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(
    loginAccount({ email: 'wrong@example.test', password: 'WrongPassword' }, fetcher),
    /Incorrect email or password/,
  );
});

test('logout uses the existing session endpoint and rejects failed clears', async () => {
  let request: { url: string; method?: string; credentials?: RequestCredentials } | undefined;
  await logoutAccount(async (input, init) => {
    request = { url: String(input), method: init?.method, credentials: init?.credentials };
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(request, { url: '/api/auth/logout', method: 'POST', credentials: 'same-origin' });
  await assert.rejects(logoutAccount(async () => new Response(null, { status: 500 })), /Unable to sign out/);
  assert.equal(routeAfterLogout(customer), 'login');
  assert.equal(routeAfterLogout(admin), 'admin-login');
});

test('session restoration preserves the backend-authenticated role after refresh', async () => {
  assert.deepEqual(await fetchCurrentUser(userFetcher(customer)), customer);
  assert.deepEqual(await fetchCurrentUser(userFetcher(admin)), admin);
  assert.equal(await fetchCurrentUser(async () => new Response(null, { status: 401 })), null);
});

test('hash routes support direct navigation without ambiguous admin paths', () => {
  assert.equal(parseRoute('#/home'), 'home');
  assert.equal(parseRoute('#/orders'), 'orders');
  assert.equal(parseRoute('#/admin/login'), 'admin-login');
  assert.equal(parseRoute('#/admin'), 'admin');
  assert.equal(parseRoute('#/admin/orders'), 'admin-orders');
  assert.equal(parseRoute('#admin/orders'), 'admin-orders');
  assert.equal(routeHash('login'), '#/login');
  assert.equal(routeHash('admin-login'), '#/admin/login');
  assert.equal(routeHash('admin-orders'), '#/admin/orders');
});

test('customer and admin navigation remain role-separated', () => {
  assert.deepEqual(customerNavigation.map(item => item.label), ['Home', 'Explore', 'Businesses']);
  assert.equal(customerNavigation.some(item => item.label.toLowerCase().includes('admin')), false);
  assert.deepEqual(adminNavigation.map(item => item.label), ['Dashboard', 'Orders']);
});
