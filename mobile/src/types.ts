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

export type CartProduct = Pick<Product,
  'id' | 'business' | 'business_name' | 'name' | 'category' | 'image_url' |
  'price' | 'stock' | 'unit' | 'status'>;

export interface CartItem {
  key: string;
  product: CartProduct;
  quantity: number;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  hasUnavailableItems: boolean;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled';

export interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
}

export interface CreateOrderRequest {
  customer: { name: string; email: string; phone: string };
  shipping: Omit<CheckoutForm, 'name' | 'email' | 'phone'>;
  items: Array<{ product_id: string; business: BusinessType; quantity: number }>;
}

export interface OrderItem {
  product_id: string;
  business: BusinessType;
  business_name: string;
  product_name: string;
  category: string;
  image_url: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  order_no: string;
  customer: { name: string; email: string; phone: string };
  shipping: Omit<CheckoutForm, 'name' | 'email' | 'phone'>;
  items: OrderItem[];
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}
