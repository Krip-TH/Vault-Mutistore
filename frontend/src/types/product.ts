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
  images?: string[];
  images_360?: string[];
  view_360?: string[];
  description?: string;
  updated_at: string;
}

export interface ProductsResponse {
  data: Product[];
  source: string;
}
