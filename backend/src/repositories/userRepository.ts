import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import type { NewUser, User } from '../types/user.js';

type UserRow = RowDataPacket & User;

export interface UserRepository {
  create(user: NewUser): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
}

export const userRepository: UserRepository = {
  async create(user) {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
      [user.name, user.email, user.password_hash, user.role ?? 'customer'],
    );
    const created = await userRepository.findById(result.insertId);
    if (!created) throw new Error('Failed to load the newly created user.');
    return created;
  },

  async findByEmail(email) {
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findById(id) {
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  },
};
