export type BusinessType =
  | 'door'
  | 'plug'
  | 'brandname'
  | 'clothing'
  | 'powerbank'
  | 'projector';

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface NormalizedProduct {
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

export type BusinessAvailabilityStatus = 'online' | 'unavailable';

export interface BusinessAvailability {
  business: BusinessType;
  business_name: string;
  status: BusinessAvailabilityStatus;
  product_count: number;
}

export interface ProductAggregation {
  products: NormalizedProduct[];
  businesses: BusinessAvailability[];
}
