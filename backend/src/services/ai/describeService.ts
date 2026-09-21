import { ApiError } from '../../errors/apiError.js';
import type { NormalizedProduct } from '../../types/product.js';
import { generateText } from './geminiClient.js';
import { TtlCache } from './cache.js';
import { getCachedProducts } from './productsCache.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_DESCRIPTION_LENGTH = 600;

const descriptionCache = new TtlCache<string>(CACHE_TTL_MS);

export interface DescribeResult {
  description: string;
}

export interface DescribeServiceDependencies {
  generateDescription: (product: NormalizedProduct) => Promise<string>;
  getProducts: () => Promise<NormalizedProduct[]>;
  cache: Pick<TtlCache<string>, 'get' | 'set'>;
}

function systemInstruction(): string {
  return [
    'You write short product descriptions in Thai for an online marketplace called VAULT.',
    'Write exactly 2 to 3 short sentences in Thai describing the given real product, using only the facts provided.',
    'Never invent specifications, materials, or features that are not implied by the given name, category, and business.',
    'Do not mention price or stock level. Do not use markdown or headings — plain sentences only.',
  ].join(' ');
}

function toPromptProduct(product: NormalizedProduct) {
  return { name: product.name, category: product.category, business_name: product.business_name };
}

const defaultDependencies: DescribeServiceDependencies = {
  generateDescription: product => generateText({
    prompt: `Product (JSON): ${JSON.stringify(toPromptProduct(product))}`,
    systemInstruction: systemInstruction(),
  }),
  getProducts: getCachedProducts,
  cache: descriptionCache,
};

function findProduct(products: NormalizedProduct[], productId: string, business?: string): NormalizedProduct | undefined {
  return products.find(product => product.id === productId && (!business || product.business === business));
}

export async function describeProduct(
  productId: string,
  business: string | undefined,
  overrides: Partial<DescribeServiceDependencies> = {},
): Promise<DescribeResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const cleanId = typeof productId === 'string' ? productId.trim() : '';
  if (!cleanId) throw new ApiError(400, 'INVALID_PRODUCT_ID', 'Provide a product id.');

  const cacheKey = business ? `${business}:${cleanId}` : cleanId;
  const cached = dependencies.cache.get(cacheKey);
  if (cached) return { description: cached };

  const products = await dependencies.getProducts();
  const product = findProduct(products, cleanId, business);
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const raw = await dependencies.generateDescription(product);
  const description = raw.trim().slice(0, MAX_DESCRIPTION_LENGTH);
  if (!description) throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'The AI assistant returned an empty response.');

  dependencies.cache.set(cacheKey, description);
  return { description };
}
