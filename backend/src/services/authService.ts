import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError } from '../errors/apiError.js';
import { userRepository } from '../repositories/userRepository.js';
import type { UserRepository } from '../repositories/userRepository.js';
import type { PublicUser, User, UserRole } from '../types/user.js';

const SALT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const AUTH_COOKIE_NAME = 'moodeng_session';
export const AUTH_COOKIE_MAX_AGE_MS = TOKEN_TTL_SECONDS * 1000;

export interface AuthTokenPayload {
  sub: number;
  role: UserRole;
}

export interface AuthServiceDependencies {
  repository: Pick<UserRepository, 'create' | 'findByEmail' | 'findById'>;
  hashPassword: (password: string) => Promise<string>;
  comparePassword: (password: string, hash: string) => Promise<boolean>;
  signToken: (payload: AuthTokenPayload) => string;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return secret;
}

function defaultSignToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, jwtSecret()) as unknown as AuthTokenPayload;
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const defaultDependencies: AuthServiceDependencies = {
  repository: userRepository,
  hashPassword: password => bcrypt.hash(password, SALT_ROUNDS),
  comparePassword: (password, hash) => bcrypt.compare(password, hash),
  signToken: defaultSignToken,
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function normalizeName(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 160) throw new ApiError(400, 'INVALID_NAME', 'Enter your full name.');
  return text;
}

function normalizeEmail(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!text || text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  }
  return text;
}

function normalizeNewPassword(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  if (text.length < 8 || text.length > 72) {
    throw new ApiError(400, 'INVALID_PASSWORD', 'Password must be between 8 and 72 characters.');
  }
  return text;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export async function registerCustomer(
  payload: unknown,
  overrides: Partial<AuthServiceDependencies> = {},
): Promise<AuthResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const body = record(payload);
  const name = normalizeName(body.name);
  const email = normalizeEmail(body.email);
  const password = normalizeNewPassword(body.password);

  const existing = await dependencies.repository.findByEmail(email);
  if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');

  const password_hash = await dependencies.hashPassword(password);
  const user = await dependencies.repository.create({ name, email, password_hash, role: 'customer' });
  const token = dependencies.signToken({ sub: user.id, role: user.role });
  return { user: toPublicUser(user), token };
}

export async function login(
  payload: unknown,
  overrides: Partial<AuthServiceDependencies> = {},
): Promise<AuthResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const body = record(payload);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) throw new ApiError(400, 'INVALID_PASSWORD', 'Enter your password.');

  const user = await dependencies.repository.findByEmail(email);
  const validPassword = user ? await dependencies.comparePassword(password, user.password_hash) : false;
  if (!user || !validPassword) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');

  const token = dependencies.signToken({ sub: user.id, role: user.role });
  return { user: toPublicUser(user), token };
}

export async function getCurrentUser(
  userId: number,
  repository: Pick<UserRepository, 'findById'> = userRepository,
): Promise<PublicUser> {
  const user = await repository.findById(userId);
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Your session is no longer valid.');
  return toPublicUser(user);
}
