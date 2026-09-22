export type BusinessType =
  | 'door'
  | 'plug'
  | 'brandname'
  | 'clothing'
  | 'powerbank'
  | 'projector';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface Product {
  id: string;
  business: BusinessType;
  business_name: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  status: StockStatus;
  image_url: string;
  updated_at: string;
}

export interface BusinessAvailability {
  business: BusinessType;
  business_name: string;
  status: 'online' | 'unavailable';
  product_count: number;
}

export interface ProductsResponse {
  data: Product[];
  source: string;
  businesses?: BusinessAvailability[];
}

export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  data: User;
  token: string;
}

export interface ApiErrorResponse {
  error?: { code?: string; message?: string };
}
