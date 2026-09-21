import type { UserRole } from './user.js';

/** Profile fields a customer may edit. `name` is the existing users.name column (full name). */
export const editableProfileFields = ['name', 'phone', 'address', 'city', 'province', 'postal_code', 'country'] as const;
export type EditableProfileField = typeof editableProfileFields[number];

export interface ProfileUpdate {
  name?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

/** Safe representation of a user's profile. Never includes password_hash. */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  profile_image_url: string | null;
  created_at: string;
}
