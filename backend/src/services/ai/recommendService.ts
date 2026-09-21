import { ApiError } from '../../errors/apiError.js';
import type { NormalizedProduct } from '../../types/product.js';
import type { RecommendResult } from '../../types/ai.js';
import { generateJson, Type } from './geminiClient.js';
import type { Schema } from './geminiClient.js';
import { TtlCache } from './cache.js';
import { getCachedProducts } from './productsCache.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RECOMMENDATION_COUNT = 4;
const MAX_CANDIDATES_IN_PROMPT = 200;

interface RecommendationPick {
  ref: string;
  reason: string;
}

const recommendationCache = new TtlCache<RecommendationPick[]>(CACHE_TTL_MS);

const recommendSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
      description: `Exactly ${RECOMMENDATION_COUNT} related products chosen from the candidate list.`,
      items: {
        type: Type.OBJECT,
        properties: {
          ref: { type: Type.STRING, description: 'The exact "ref" field of a product from the candidate list. Never invent a ref.' },
          reason: { type: Type.STRING, description: 'One short sentence explaining why this pairs well with the selected product.' },
        },
        required: ['ref', 'reason'],
      },
    },
  },
  required: ['recommendations'],
};

function systemInstruction(): string {
  return [
    'You recommend related products for an online marketplace called VAULT.',
    'You are given one selected product and a list of other real candidate products, both as JSON.',
    `Pick exactly ${RECOMMENDATION_COUNT} candidates that best complement or relate to the selected product.`,
    'You must only reference the "ref" values that appear in the candidate list — never invent a ref, name, price, or product that is not listed.',
  ].join(' ');
}

/** Product ids are only unique within one business (e.g. "31" exists in both "plug" and "powerbank"), so every
 *  product exposed to the model carries a business-qualified "ref" and the model must echo that ref back — never
 *  the bare id, which would be ambiguous across the pooled candidate list. */
function productRef(product: NormalizedProduct): string {
  return `${product.business}:${product.id}`;
}

function toPromptProduct(product: NormalizedProduct) {
  return {
    ref: productRef(product), business: product.business, name: product.name, category: product.category, price: product.price,
  };
}

export interface RecommendServiceDependencies {
  generateRecommendations: (target: NormalizedProduct, candidates: NormalizedProduct[]) => Promise<unknown>;
  getProducts: () => Promise<NormalizedProduct[]>;
  cache: Pick<TtlCache<RecommendationPick[]>, 'get' | 'set'>;
}

const defaultDependencies: RecommendServiceDependencies = {
  generateRecommendations: (target, candidates) => generateJson({
    prompt: [
      `Selected product (JSON): ${JSON.stringify(toPromptProduct(target))}`,
      `Candidate products (JSON): ${JSON.stringify(candidates.slice(0, MAX_CANDIDATES_IN_PROMPT).map(toPromptProduct))}`,
    ].join('\n'),
    responseSchema: recommendSchema,
    systemInstruction: systemInstruction(),
  }),
  getProducts: getCachedProducts,
  cache: recommendationCache,
};

function findProduct(products: NormalizedProduct[], productId: string, business?: string): NormalizedProduct | undefined {
  return products.find(product => product.id === productId && (!business || product.business === business));
}

/** Never trusts the model's picks directly: only refs that exist among the real candidates survive. */
function toRecommendationPicks(raw: unknown, candidateRefs: Set<string>): RecommendationPick[] {
  const record = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  const list = Array.isArray(record.recommendations) ? record.recommendations : [];
  const seen = new Set<string>();
  const picks: RecommendationPick[] = [];

  for (const item of list) {
    if (picks.length >= RECOMMENDATION_COUNT) break;
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    const ref = typeof entry.ref === 'string' ? entry.ref : null;
    if (!ref || seen.has(ref) || !candidateRefs.has(ref)) continue;
    const reason = typeof entry.reason === 'string' && entry.reason.trim()
      ? entry.reason.trim().slice(0, 200)
      : 'You might also like this.';
    seen.add(ref);
    picks.push({ ref, reason });
  }

  return picks;
}

export async function recommendProducts(
  productId: string,
  business: string | undefined,
  overrides: Partial<RecommendServiceDependencies> = {},
): Promise<RecommendResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const cleanId = typeof productId === 'string' ? productId.trim() : '';
  if (!cleanId) throw new ApiError(400, 'INVALID_PRODUCT_ID', 'Provide a product id.');

  const products = await dependencies.getProducts();
  const target = findProduct(products, cleanId, business);
  if (!target) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const candidates = products.filter(product => !(product.id === target.id && product.business === target.business));
  const cacheKey = business ? `${business}:${cleanId}` : cleanId;

  let picks = dependencies.cache.get(cacheKey);
  if (!picks) {
    if (candidates.length === 0) {
      picks = [];
    } else {
      const raw = await dependencies.generateRecommendations(target, candidates);
      picks = toRecommendationPicks(raw, new Set(candidates.map(productRef)));
    }
    dependencies.cache.set(cacheKey, picks);
  }

  const byRef = new Map(candidates.map(product => [productRef(product), product]));
  const data = picks
    .map(pick => {
      const product = byRef.get(pick.ref);
      return product ? { product, reason: pick.reason } : null;
    })
    .filter((entry): entry is { product: NormalizedProduct; reason: string } => entry !== null);

  return { data };
}
