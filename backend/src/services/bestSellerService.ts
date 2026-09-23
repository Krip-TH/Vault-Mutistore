import { ApiError } from '../errors/apiError.js';
import { bestSellerRepository } from '../repositories/bestSellerRepository.js';
import type { BestSellerRepository } from '../repositories/bestSellerRepository.js';
import type { BestSeller } from '../types/bestSeller.js';
import type { BusinessType, ProductAggregation } from '../types/product.js';
import { productService } from './productService.js';

const DEFAULT_LIMIT = 10;
export const MAX_BEST_SELLERS = 20;

export interface BestSellerQuery { limit: number; business: BusinessType | null }
export interface BestSellerServiceDependencies {
  repository: BestSellerRepository;
  getProductAggregation(): Promise<ProductAggregation>;
}

const validBusinesses = new Set<BusinessType>(['vault', 'door', 'plug', 'brandname', 'clothing', 'powerbank', 'projector']);

export function parseBestSellerQuery(value: unknown): BestSellerQuery {
  const query = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const rawLimit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_BEST_SELLERS) {
    throw new ApiError(400, 'INVALID_LIMIT', `Limit must be between 1 and ${MAX_BEST_SELLERS}.`);
  }
  const rawBusiness = typeof query.business === 'string' ? query.business.trim().toLowerCase() : '';
  if (rawBusiness && !validBusinesses.has(rawBusiness as BusinessType)) {
    throw new ApiError(400, 'INVALID_BUSINESS', 'Select a valid business.');
  }
  return { limit: rawLimit, business: rawBusiness ? rawBusiness as BusinessType : null };
}

export function createBestSellerService(overrides: Partial<BestSellerServiceDependencies> = {}) {
  const dependencies: BestSellerServiceDependencies = {
    repository: bestSellerRepository,
    getProductAggregation: () => productService.getProductAggregation(),
    ...overrides,
  };
  return {
    async list(queryValue: unknown): Promise<BestSeller[]> {
      const query = parseBestSellerQuery(queryValue);
      // Fetch extra rows before hydrating because a historical product may no longer exist in live inventory.
      const [sales, aggregation] = await Promise.all([
        dependencies.repository.listCompletedSales(MAX_BEST_SELLERS, query.business),
        dependencies.getProductAggregation(),
      ]);
      const current = new Map(aggregation.products.map(product => [`${product.business}\u0000${product.id}`, product]));
      const ranked = sales
        .map(row => ({ row, product: current.get(`${row.business}\u0000${row.product_id}`) }))
        .filter((item): item is typeof item & { product: NonNullable<typeof item.product> } => !!item.product)
        .slice(0, query.limit);
      return ranked.map((item, index) => ({ rank: index + 1, units_sold: item.row.units_sold, product: item.product }));
    },
  };
}

export const bestSellerService = createBestSellerService();
