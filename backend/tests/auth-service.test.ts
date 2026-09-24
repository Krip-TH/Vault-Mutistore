import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors/apiError.js';
import { getCurrentUser, login, registerCustomer } from '../src/services/authService.js';
import type { AuthServiceDependencies } from '../src/services/authService.js';
import type { UserRepository } from '../src/repositories/userRepository.js';
import type { NewUser, User } from '../src/types/user.js';

const now = '2026-09-19T08:30:00.000Z';
const storedUser: User = {
  id: 1, name: 'Narin Chai', email: 'narin@example.com',
  password_hash: 'hashed:Secret123', role: 'customer', created_at: now, updated_at: now,
};

function mockRepository(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    async create(user: NewUser): Promise<User> {
      return { id: 2, name: user.name, email: user.email, password_hash: user.password_hash, role: user.role ?? 'customer', created_at: now, updated_at: now };
    },
    async findByEmail() { return null; },
    async findById() { return null; },
    ...overrides,
  };
}

function fakeDependencies(overrides: Partial<AuthServiceDependencies> = {}): Partial<AuthServiceDependencies> {
  return {
    repository: mockRepository(),
    hashPassword: async password => `hashed:${password}`,
    comparePassword: async (password, hash) => hash === `hashed:${password}`,
    signToken: payload => `token-for-${payload.sub}-${payload.role}`,
    ...overrides,
  };
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test('registers a new customer with a hashed password and issues a token', async () => {
  let created: NewUser | undefined;
  const repository = mockRepository({
    async findByEmail() { return null; },
    async create(user) { created = user; return { id: 42, name: user.name, email: user.email, password_hash: user.password_hash, role: 'customer', created_at: now, updated_at: now }; },
  });
  const result = await registerCustomer(
    { name: '  Narin Chai  ', email: 'Narin@Example.com', password: 'Secret123' },
    fakeDependencies({ repository }),
  );

  assert.equal(created?.name, 'Narin Chai');
  assert.equal(created?.email, 'narin@example.com');
  assert.equal(created?.password_hash, 'hashed:Secret123');
  assert.equal(created?.role, 'customer');
  assert.deepEqual(result.user, { id: 42, name: 'Narin Chai', email: 'narin@example.com', role: 'customer' });
  assert.equal(result.token, 'token-for-42-customer');
});

test('rejects registration when the email is already taken', async () => {
  const repository = mockRepository({ async findByEmail() { return storedUser; } });
  await expectApiError(
    registerCustomer({ name: 'Narin Chai', email: 'narin@example.com', password: 'Secret123' }, fakeDependencies({ repository })),
    409, 'EMAIL_TAKEN',
  );
});

test('rejects registration with an invalid email or short password', async () => {
  await expectApiError(
    registerCustomer({ name: 'Narin Chai', email: 'not-an-email', password: 'Secret123' }, fakeDependencies()),
    400, 'INVALID_EMAIL',
  );
  await expectApiError(
    registerCustomer({ name: 'Narin Chai', email: 'narin@example.com', password: 'short' }, fakeDependencies()),
    400, 'INVALID_PASSWORD',
  );
});

test('logs in with correct credentials and issues a token', async () => {
  const repository = mockRepository({ async findByEmail() { return storedUser; } });
  const result = await login({ email: 'Narin@Example.com', password: 'Secret123' }, fakeDependencies({ repository }));

  assert.deepEqual(result.user, { id: 1, name: 'Narin Chai', email: 'narin@example.com', role: 'customer' });
  assert.equal(result.token, 'token-for-1-customer');
});

test('rejects login with an incorrect password without revealing which field was wrong', async () => {
  const repository = mockRepository({ async findByEmail() { return storedUser; } });
  await expectApiError(
    login({ email: 'narin@example.com', password: 'WrongPassword' }, fakeDependencies({ repository })),
    401, 'INVALID_CREDENTIALS',
  );
});

test('rejects login for an unknown email with the same error as a wrong password', async () => {
  const repository = mockRepository({ async findByEmail() { return null; } });
  await expectApiError(
    login({ email: 'nobody@example.com', password: 'Secret123' }, fakeDependencies({ repository })),
    401, 'INVALID_CREDENTIALS',
  );
});

test('returns the public profile for a known user id', async () => {
  const repository = mockRepository({ async findById(id) { assert.equal(id, 1); return storedUser; } });
  assert.deepEqual(await getCurrentUser(1, repository), { id: 1, name: 'Narin Chai', email: 'narin@example.com', role: 'customer' });
});

test('rejects a session whose user no longer exists', async () => {
  const repository = mockRepository({ async findById() { return null; } });
  await expectApiError(getCurrentUser(99, repository), 401, 'UNAUTHENTICATED');
});
