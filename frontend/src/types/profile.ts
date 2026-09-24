import type { UserRole } from './auth';

export interface Profile {
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

/** Fields the customer can edit. Email, role and account dates are read-only. */
export interface ProfileForm {
  name: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
}

export interface ProfileResponse { data: Profile }
export interface ProfileErrorResponse { error?: { code?: string; message?: string } }
