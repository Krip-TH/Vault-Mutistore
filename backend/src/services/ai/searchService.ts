import { ApiError } from '../../errors/apiError.js';
import type { BusinessType, NormalizedProduct } from '../../types/product.js';
import type { SearchFilters, SearchResult, SearchSortOption } from '../../types/ai.js';
import { generateJson, Type } from './geminiClient.js';
import type { Schema } from './geminiClient.js';
import { getCachedProducts } from './productsCache.js';

const ALLOWED_BUSINESSES: BusinessType[] = ['door', 'plug', 'brandname', 'clothing', 'powerbank', 'projector'];
const ALLOWED_SORTS: SearchSortOption[] = ['relevance', 'price_asc', 'price_desc', 'newest'];
const DEFAULT_EXPLANATION = 'Showing results that match your search.';

const filterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Important product name or category keywords extracted from the shopper\'s request.',
    },
    minPrice: {
      type: Type.NUMBER,
      nullable: true,
      description: 'Minimum price in Thai baht mentioned by the shopper, or null if none was mentioned.',
    },
    maxPrice: {
      type: Type.NUMBER,
      nullable: true,
      description: 'Maximum price in Thai baht mentioned by the shopper, or null if none was mentioned.',
    },
    business: {
      type: Type.STRING,
      nullable: true,
      enum: ALLOWED_BUSINESSES,
      description: 'One of the allowed business identifiers if the shopper asked for a specific store, otherwise null.',
    },
    sortBy: {
      type: Type.STRING,
      enum: ALLOWED_SORTS,
      description: 'How the shopper wants the results ordered.',
    },
    explanation: {
      type: Type.STRING,
      description: 'One short sentence, in the same language as the shopper\'s request, describing what was searched for.',
    },
  },
  required: ['keywords', 'sortBy', 'explanation'],
};

function systemInstruction(): string {
  return [
    'You are a search-query interpreter for an online marketplace called VAULT.',
    'Convert the shopper\'s natural-language request into a structured filter object.',
    'You do not have access to the real product catalog and must never invent product names, prices, or availability.',
    'Only extract search filters; the actual product list is looked up separately after you respond.',
  ].join(' ');
}

export interface SearchServiceDependencies {
  generateFilters: (query: string) => Promise<unknown>;
  getProducts: () => Promise<NormalizedProduct[]>;
}

const defaultDependencies: SearchServiceDependencies = {
  generateFilters: query => generateJson({
    prompt: `Shopper request: ${query}`,
    responseSchema: filterSchema,
    systemInstruction: systemInstruction(),
  }),
  getProducts: getCachedProducts,
};

function normalizeQuery(payload: unknown): string {
  const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) throw new ApiError(400, 'INVALID_QUERY', 'Enter a search query.');
  if (query.length > 300) throw new ApiError(400, 'INVALID_QUERY', 'Search query is too long.');
  return query;
}

/** The model's output is untrusted: every field is type-checked and coerced to a safe default rather than trusted as-is. */
function toFilters(raw: unknown): { filters: SearchFilters; explanation: string } {
  const record = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};

  const keywords = Array.isArray(record.keywords)
    ? record.keywords
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map(item => item.trim())
      .slice(0, 10)
    : [];

  const minPrice = typeof record.minPrice === 'number' && Number.isFinite(record.minPrice) && record.minPrice >= 0
    ? record.minPrice
    : null;
  const maxPriceCandidate = typeof record.maxPrice === 'number' && Number.isFinite(record.maxPrice) && record.maxPrice >= 0
    ? record.maxPrice
    : null;
  const maxPrice = maxPriceCandidate !== null && minPrice !== null && maxPriceCandidate < minPrice ? null : maxPriceCandidate;

  const business = typeof record.business === 'string' && (ALLOWED_BUSINESSES as string[]).includes(record.business)
    ? record.business as BusinessType
    : null;

  const sortBy = typeof record.sortBy === 'string' && (ALLOWED_SORTS as string[]).includes(record.sortBy)
    ? record.sortBy as SearchSortOption
    : 'relevance';

  const explanation = typeof record.explanation === 'string' && record.explanation.trim()
    ? record.explanation.trim().slice(0, 300)
    : DEFAULT_EXPLANATION;

  return { filters: { keywords, minPrice, maxPrice, business, sortBy }, explanation };
}

/**
 * The model sometimes returns a multi-word keyword (e.g. "power plug") that would never
 * appear verbatim in a product name like "Universal plug" or a category like "Adapters".
 * Splitting each keyword into individual words and matching on any of them is far more
 * forgiving while still being driven entirely by what the model actually extracted.
 */
function keywordWords(keywords: string[]): string[] {
  return [...new Set(
    keywords
      .flatMap(keyword => keyword.toLocaleLowerCase().split(/\s+/))
      .filter(word => word.length > 1),
  )];
}

function applyFilters(products: NormalizedProduct[], filters: SearchFilters): NormalizedProduct[] {
  const words = keywordWords(filters.keywords);
  const matched = products.filter(product => {
    const haystack = `${product.name} ${product.category} ${product.business_name}`.toLocaleLowerCase();
    const matchesKeywords = words.length === 0 || words.some(word => haystack.includes(word));
    const matchesMin = filters.minPrice === null || product.price >= filters.minPrice;
    const matchesMax = filters.maxPrice === null || product.price <= filters.maxPrice;
    const matchesBusiness = filters.business === null || product.business === filters.business;
    return matchesKeywords && matchesMin && matchesMax && matchesBusiness;
  });

  switch (filters.sortBy) {
    case 'price_asc':
      return [...matched].sort((a, b) => a.price - b.price);
    case 'price_desc':
      return [...matched].sort((a, b) => b.price - a.price);
    case 'newest':
      return [...matched].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    default:
      return matched;
  }
}

export async function searchProducts(
  payload: unknown,
  overrides: Partial<SearchServiceDependencies> = {},
): Promise<SearchResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const query = normalizeQuery(payload);

  const [rawFilters, products] = await Promise.all([
    dependencies.generateFilters(query),
    dependencies.getProducts(),
  ]);

  const { filters, explanation } = toFilters(rawFilters);
  const data = applyFilters(products, filters);
  return { filters, data, explanation };
}
