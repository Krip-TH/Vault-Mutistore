import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, unlink } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test, { after } from 'node:test';
import express from 'express';
import { pool } from '../src/db/pool.js';
import { profileUploadDirectory } from '../src/middleware/profileImageUpload.js';
import { profileRepository } from '../src/repositories/profileRepository.js';
import type { ProfileRepository } from '../src/repositories/profileRepository.js';
import { createProfileRouter } from '../src/routes/profile.js';
import { createProfileService, validateProfileUpdate } from '../src/services/profileService.js';
import type { UserProfile } from '../src/types/profile.js';
import type { UserRole } from '../src/types/user.js';

const created = '2026-09-01T08:00:00.000Z';
const emptyProfile = (id: number, name: string, role: UserRole = 'customer'): UserProfile => ({
  id, name, email: `user${id}@example.test`, role, phone: null, address: null, city: null, province: null,
  postal_code: null, country: null, profile_image_url: null, created_at: created,
});

/** In-memory stand-in for the users table that records every id the service asked it to touch. */
function fakeRepository() {
  const users = new Map<number, UserProfile>([
    [7, { ...emptyProfile(7, 'Narin Chai'), phone: '+66 81 234 5678', city: 'Bangkok' }],
    [8, emptyProfile(8, 'Other Customer')],
    [1, emptyProfile(1, 'Admin', 'admin')],
  ]);
  const touched: number[] = [];
  const repository: ProfileRepository = {
    async findById(id) { return users.get(id) ?? null; },
    async update(id, fields) {
      touched.push(id);
      const current = users.get(id);
      if (!current) return null;
      const next = { ...current, ...fields } as UserProfile;
      users.set(id, next);
      return next;
    },
    async setImage(id, imageUrl) {
      touched.push(id);
      const current = users.get(id);
      if (!current) return null;
      const next = { ...current, profile_image_url: imageUrl };
      users.set(id, next);
      return next;
    },
  };
  return { users, touched, repository };
}

async function call(userId: number | undefined, route: string, init?: RequestInit, repository?: ProfileRepository, role: UserRole = 'customer') {
  const app = express();
  app.use(express.json());
  if (userId !== undefined) app.use((request, _response, next) => { request.auth = { userId, role }; next(); });
  app.use('/api/profile', createProfileRouter(createProfileService({ repository: repository ?? fakeRepository().repository })));
  app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError) { response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } }); return; }
    response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/profile${route}`, init); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

const put = (body: unknown) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const pngBytes = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
function imageForm(bytes: Buffer, type: string, filename = 'me.png') {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(bytes)], { type }), filename);
  return { method: 'POST', body: form };
}

const uploadedThisRun = new Set<string>();
async function trackUploads(before: string[]) {
  const now = await readdir(profileUploadDirectory);
  for (const file of now) if (!before.includes(file) && file !== '.gitkeep') uploadedThisRun.add(file);
}
after(async () => { for (const file of uploadedThisRun) await unlink(path.join(profileUploadDirectory, file)).catch(() => undefined); });

test('every profile endpoint rejects unauthenticated requests', async () => {
  for (const [route, init] of [['', undefined], ['', put({ name: 'X' })], ['/image', { method: 'POST' }], ['/image', { method: 'DELETE' }]] as const) {
    const response = await call(undefined, route, init);
    assert.equal(response.status, 401, `${init?.method ?? 'GET'} ${route}`);
    assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
  }
});

test('an authenticated customer reads their own profile without any password data', async () => {
  const { repository } = fakeRepository();
  const response = await call(7, '', undefined, repository);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.id, 7);
  assert.equal(data.name, 'Narin Chai');
  assert.equal(data.phone, '+66 81 234 5678');
  assert.equal(data.role, 'customer');
  assert.equal(data.created_at, created);
  assert.deepEqual(Object.keys(data).sort(), ['address', 'city', 'country', 'created_at', 'email', 'id', 'name', 'phone', 'postal_code', 'profile_image_url', 'province', 'role']);
  assert.equal(JSON.stringify(data).includes('password'), false);
});

test('a customer updates their own profile; values are trimmed and blank optional fields become null', async () => {
  const { repository, users, touched } = fakeRepository();
  const response = await call(7, '', put({
    name: '  Narin   Chai-Sook ', phone: '+66 81 999 0000', address: '88 Sukhumvit Road', city: 'Watthana',
    province: 'Bangkok', postal_code: '10110', country: 'Thailand',
  }), repository);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.name, 'Narin Chai-Sook');
  assert.equal(data.province, 'Bangkok');
  assert.equal(users.get(7)?.postal_code, '10110');
  assert.deepEqual(touched, [7]);

  const cleared = await call(7, '', put({ phone: '   ', city: null }), repository);
  assert.equal(cleared.status, 200);
  const after = (await cleared.json()).data;
  assert.equal(after.phone, null);
  assert.equal(after.city, null);
  assert.equal(after.name, 'Narin Chai-Sook', 'omitted fields are left unchanged');
});

test('a partial update leaves the other users untouched and the id always comes from the session', async () => {
  const { repository, users, touched } = fakeRepository();
  await call(7, '', put({ name: 'Renamed' }), repository);
  assert.deepEqual(touched, [7]);
  assert.equal(users.get(8)?.name, 'Other Customer');
  assert.equal(users.get(1)?.name, 'Admin');
});

test('a customer cannot update another user by sending an id or by addressing another user in the URL', async () => {
  const { repository, users, touched } = fakeRepository();
  for (const key of ['id', 'user_id', 'userId']) {
    const response = await call(7, '', put({ [key]: 8, name: 'Hijacked' }), repository);
    assert.equal(response.status, 400, key);
    assert.equal((await response.json()).error.code, 'PROTECTED_FIELD');
  }
  assert.equal((await call(7, '/8', put({ name: 'Hijacked' }), repository)).status, 404);
  assert.equal((await call(7, '/8/image', { method: 'DELETE' }, repository)).status, 404);
  assert.deepEqual(touched, []);
  assert.equal(users.get(8)?.name, 'Other Customer');
  assert.equal(users.get(7)?.name, 'Narin Chai');
});

test('role, email, password and other protected fields cannot be changed through the profile endpoint', async () => {
  const { repository, users, touched } = fakeRepository();
  for (const body of [{ role: 'admin' }, { name: 'Narin', role: 'admin' }, { email: 'new@example.test' }, { password: 'Newpassword1' },
    { password_hash: 'x' }, { profile_image_url: 'https://evil.example/x.png' }, { created_at: '2000-01-01' }]) {
    const response = await call(7, '', put(body), repository);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).error.code, 'PROTECTED_FIELD');
  }
  assert.deepEqual(touched, []);
  assert.equal(users.get(7)?.role, 'customer');
  assert.equal(users.get(7)?.email, 'user7@example.test');
});

test('invalid profile data is rejected with a 400 and nothing is saved', async () => {
  const { repository, touched } = fakeRepository();
  const bodies: unknown[] = [
    {}, { unknown: 'x' }, [],
    { name: '' }, { name: '   ' }, { name: null }, { name: 'x'.repeat(161) }, { name: 42 },
    { name: '<script>alert(1)</script>' },
    { phone: 'abc' }, { phone: '1'.repeat(41) },
    { postal_code: '!!!!' }, { postal_code: '1'.repeat(21) },
    { address: 'a'.repeat(256) }, { city: 'c'.repeat(121) }, { province: {} }, { country: ['Thailand'] },
  ];
  for (const body of bodies) {
    const response = await call(7, '', put(body), repository);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).error.code, 'INVALID_PROFILE', JSON.stringify(body));
  }
  assert.deepEqual(touched, []);
});

test('malformed JSON and non-object payloads are rejected', async () => {
  const response = await call(7, '', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_JSON');
  for (const payload of ['text', null, 42, undefined]) assert.throws(() => validateProfileUpdate(payload), { code: 'INVALID_PROFILE' });
});

test('a session whose user no longer exists is treated as unauthenticated', async () => {
  const response = await call(999, '');
  assert.equal(response.status, 401);
});

test('profile photo upload stores a randomly named file, replaces and deletes the previous one', async () => {
  const before = await readdir(profileUploadDirectory);
  const { repository, users } = fakeRepository();

  const first = await call(7, '/image', imageForm(pngBytes(), 'image/png', '../../evil.png'), repository);
  assert.equal(first.status, 200);
  const firstUrl = (await first.json()).data.profile_image_url as string;
  await trackUploads(before);
  assert.match(firstUrl, /^\/uploads\/profiles\/[a-f0-9-]{36}\.png$/);
  assert.equal(firstUrl.includes('evil'), false);
  const firstFile = path.join(profileUploadDirectory, path.basename(firstUrl));
  assert.ok(existsSync(firstFile));

  const second = await call(7, '/image', imageForm(pngBytes(), 'image/png'), repository);
  assert.equal(second.status, 200);
  const secondUrl = (await second.json()).data.profile_image_url as string;
  await trackUploads(before);
  assert.notEqual(secondUrl, firstUrl);
  assert.equal(existsSync(firstFile), false, 'the replaced photo is removed');
  assert.ok(existsSync(path.join(profileUploadDirectory, path.basename(secondUrl))));
  assert.equal(users.get(8)?.profile_image_url, null);

  const removed = await call(7, '/image', { method: 'DELETE' }, repository);
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).data.profile_image_url, null);
  assert.equal(existsSync(path.join(profileUploadDirectory, path.basename(secondUrl))), false);
});

test('profile photo upload rejects wrong types, spoofed content, missing files and oversized files', async () => {
  const before = await readdir(profileUploadDirectory);
  const { repository, users } = fakeRepository();

  const text = await call(7, '/image', imageForm(Buffer.from('not an image at all'), 'text/plain', 'a.txt'), repository);
  assert.equal(text.status, 400);
  assert.equal((await text.json()).error.code, 'INVALID_IMAGE');

  const svg = await call(7, '/image', imageForm(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml', 'a.svg'), repository);
  assert.equal(svg.status, 400);

  const spoofed = await call(7, '/image', imageForm(Buffer.from('<?php echo 1; ?> padding padding padding'), 'image/png', 'shell.png'), repository);
  assert.equal(spoofed.status, 400);
  assert.equal((await spoofed.json()).error.code, 'INVALID_IMAGE');

  const missing = await call(7, '/image', { method: 'POST', body: new FormData() }, repository);
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.code, 'IMAGE_REQUIRED');

  const huge = await call(7, '/image', imageForm(Buffer.concat([pngBytes(), Buffer.alloc(5 * 1024 * 1024)]), 'image/png'), repository);
  assert.equal(huge.status, 413);
  assert.equal((await huge.json()).error.code, 'IMAGE_TOO_LARGE');

  await trackUploads(before);
  const leftovers = (await readdir(profileUploadDirectory)).filter(file => !before.includes(file));
  assert.deepEqual(leftovers, [], 'rejected uploads leave no files behind');
  assert.equal(users.get(7)?.profile_image_url, null);
});

test('the repository uses parameterized SQL, never selects password_hash, and only writes allow-listed columns', async () => {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const original = pool.execute;
  (pool as unknown as { execute: unknown }).execute = async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params });
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }, undefined];
    return [[{ id: 7, name: 'Narin', email: 'n@example.test', role: 'customer' }], undefined];
  };
  try {
    const hostile = "x'; DROP TABLE users; --";
    await profileRepository.update(7, { name: hostile, phone: null, role: 'admin', password_hash: 'x' } as never);
    await profileRepository.setImage(7, '/uploads/profiles/a.png');
    await profileRepository.findById(7);
  } finally {
    (pool as unknown as { execute: unknown }).execute = original;
  }
  const update = statements.find(statement => statement.sql.startsWith('UPDATE users SET name = ?, phone = ?'));
  assert.ok(update, 'update binds only name and phone');
  assert.equal(update.sql, 'UPDATE users SET name = ?, phone = ? WHERE id = ?');
  assert.deepEqual(update.params, ["x'; DROP TABLE users; --", null, 7]);
  for (const { sql, params } of statements) {
    assert.equal(sql.includes('DROP'), false, 'values are never interpolated into SQL');
    assert.equal(sql.includes('password_hash'), false);
    assert.equal(sql.includes('role ='), false);
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
  }
});
