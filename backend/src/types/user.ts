export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface NewUser {
  name: string;
  email: string;
  password_hash: string;
  role?: UserRole;
}
