import type { BusinessType, NormalizedProduct } from './product.js';

export type SearchSortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export interface SearchFilters {
  keywords: string[];
  minPrice: number | null;
  maxPrice: number | null;
  business: BusinessType | null;
  sortBy: SearchSortOption;
}

export interface SearchResult {
  filters: SearchFilters;
  data: NormalizedProduct[];
  explanation: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatResult {
  reply: string;
}

export interface RecommendedProduct {
  product: NormalizedProduct;
  reason: string;
}

export interface RecommendResult {
  data: RecommendedProduct[];
}
