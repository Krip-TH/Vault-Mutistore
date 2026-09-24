import type { BusinessType, Product } from './product';

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
