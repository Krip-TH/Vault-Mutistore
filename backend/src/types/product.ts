export type ExternalBusinessType =
  | 'door'
  | 'plug'
  | 'brandname'
  | 'clothing'
  | 'powerbank'
  | 'projector';

export type BusinessType = ExternalBusinessType | 'vault';

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
  catalog_business?: ExternalBusinessType | null;
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

export interface AdminProduct extends NormalizedProduct {
  management: 'vault' | 'external';
  can_edit: boolean;
  can_delete: boolean;
  catalog_business: ExternalBusinessType | null;
  catalog_business_name: string;
}

export interface ProductInput {
  business: ExternalBusinessType;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  image_url: string;
}

export interface ProductOptionBusiness {
  id: ExternalBusinessType;
  name: string;
  categories: string[];
}

export interface ProductOptions {
  businesses: ProductOptionBusiness[];
}
