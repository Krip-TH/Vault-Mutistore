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

export interface BestSeller {
  rank: number;
  units_sold: number;
  product: Product;
}

export interface BestSellersResponse {
  data: BestSeller[];
  source: 'completed_orders';
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

export interface OrderSummary {
  order_no: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: string;
}

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

export type SearchSortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export interface SearchFilters {
  keywords: string[];
  minPrice: number | null;
  maxPrice: number | null;
  business: BusinessType | null;
  sortBy: SearchSortOption;
}

export interface SearchResponse {
  filters: SearchFilters;
  data: Product[];
  explanation: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export interface RecommendedProduct {
  product: Product;
  reason: string;
}

export interface RecommendResponse {
  data: RecommendedProduct[];
}

export interface DescribeResponse {
  description: string;
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

// --- Admin ---

export type AdminView = 'dashboard' | 'orders' | 'products' | 'users' | 'businesses' | 'claims';

export interface AdminOrderSummary {
  order_no: string;
  customer_name: string;
  customer_email: string;
  total: number;
  status: OrderStatus;
  item_count: number;
  created_at: string;
}

export type AdminOrder = Order;

export interface AdminProduct {
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
  management: 'vault' | 'external';
  can_edit: boolean;
  can_delete: boolean;
  catalog_business: BusinessType | null;
  catalog_business_name: string;
}

export type AdminProductInput = Pick<AdminProduct, 'name' | 'category' | 'price' | 'stock' | 'unit' | 'image_url'> & { business: string };

export interface ProductOptions {
  businesses: Array<{ id: string; name: string; categories: string[] }>;
}

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ManagedUserInput {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export interface ManagedBusiness {
  id: number;
  name: string;
  business_type: string;
  api_url: string;
  status: 'active' | 'inactive' | 'unavailable';
  last_checked_at: string | null;
  updated_at: string;
}

export interface AdminAnalytics {
  kpis: {
    total_revenue: number; total_orders: number; total_customers: number; average_order_value: number;
    total_products: number; in_stock: number; low_stock: number; out_of_stock: number;
  };
  revenue_trend: Array<{ date: string; revenue: number }>;
  revenue_by_business: Array<{ business: string; revenue: number }>;
  inventory: Array<{ status: string; count: number }>;
  products_by_business: Array<{ business: string; name: string; count: number; available: boolean }>;
  order_statuses: Array<{ status: OrderStatus; count: number }>;
  top_products: Array<{ product_id: string; name: string; business: string; quantity_sold: number; revenue: number }>;
  kmeans: {
    products: Array<{ id: string; name: string; business: string; price: number; stock: number; cluster: number }>;
    clusters: Array<{ cluster: number; label: string; product_count: number; average_price: number; average_stock: number; centroid_price: number; centroid_stock: number }>;
  };
  insights: string[];
  warnings: string[];
  recent_orders: AdminOrderSummary[];
  business_availability: Array<{ business: string; business_name: string; status: 'online' | 'unavailable'; product_count: number }>;
}

// --- Claims ---

export type ClaimStatus =
  | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';

export type ClaimReason = 'damaged' | 'defective' | 'wrong_item' | 'missing_parts' | 'other';

export interface ClaimEvidence {
  id: number;
  image_url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface ClaimItem {
  order_item_id: number;
  quantity: number;
  product_id: string;
  product_name: string;
  business: BusinessType;
  business_name: string;
  unit_price: number;
  line_total: number;
}

export interface ClaimHistoryEntry {
  previous_status: ClaimStatus | null;
  new_status: ClaimStatus;
  changed_by_role: 'customer' | 'admin';
  note: string | null;
  created_at: string;
}

export interface Claim {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
  admin_note: string | null;
  items: ClaimItem[];
  evidence: ClaimEvidence[];
  history: ClaimHistoryEntry[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ClaimSummary {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  product_name: string;
  business: BusinessType;
  business_name: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClaimableItem {
  order_item_id: number;
  product_id: string;
  product_name: string;
  business: BusinessType;
  business_name: string;
  category: string;
  image_url: string;
  unit_price: number;
  purchased_quantity: number;
  claimed_quantity: number;
  claimable_quantity: number;
}

export interface ClaimableItemsResponse {
  order_no: string;
  eligible: boolean;
  ineligible_reason: string | null;
  items: ClaimableItem[];
}

export interface ClaimListPage {
  claims: ClaimSummary[];
  total: number;
  page: number;
  page_size: number;
}

export type ClaimNoteVisibility = 'customer' | 'internal';

export interface AdminClaimSummary extends ClaimSummary {
  customer_name: string;
  customer_email: string;
}

export interface AdminClaimHistoryEntry extends ClaimHistoryEntry {
  changed_by: number | null;
  changed_by_name: string | null;
  visibility: ClaimNoteVisibility;
}

export interface AdminClaim extends Omit<Claim, 'history'> {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_status: OrderStatus;
  order_total: number;
  order_created_at: string;
  history: AdminClaimHistoryEntry[];
}

export interface AdminClaimStatusUpdate {
  status: ClaimStatus;
  note?: string;
  note_visibility?: ClaimNoteVisibility;
  admin_note?: string;
}
