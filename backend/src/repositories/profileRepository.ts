import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import { editableProfileFields } from '../types/profile.js';
import type { ProfileUpdate, UserProfile } from '../types/profile.js';

type ProfileRow = RowDataPacket & UserProfile;

// Explicit column list: password_hash is never selected by the profile API.
const profileSelect = `SELECT id, name, email, role, phone, address, city, province, postal_code, country,
  profile_image_url, created_at FROM users`;

export interface ProfileRepository {
  findById(id: number): Promise<UserProfile | null>;
  update(id: number, fields: ProfileUpdate): Promise<UserProfile | null>;
  setImage(id: number, imageUrl: string | null): Promise<UserProfile | null>;
}

export const profileRepository: ProfileRepository = {
  async findById(id) {
    const [rows] = await pool.execute<ProfileRow[]>(`${profileSelect} WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ?? null;
  },

  async update(id, fields) {
    // Column names come from the fixed allow-list, never from request keys; values are bound parameters.
    const columns = editableProfileFields.filter(field => fields[field] !== undefined);
    if (columns.length) {
      const assignments = columns.map(column => `${column} = ?`).join(', ');
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE users SET ${assignments} WHERE id = ?`,
        [...columns.map(column => fields[column] as string | null), id],
      );
      if (!result.affectedRows) return null;
    }
    return profileRepository.findById(id);
  },

  async setImage(id, imageUrl) {
    const [result] = await pool.execute<ResultSetHeader>('UPDATE users SET profile_image_url = ? WHERE id = ?', [imageUrl, id]);
    if (!result.affectedRows) return null;
    return profileRepository.findById(id);
  },
};
