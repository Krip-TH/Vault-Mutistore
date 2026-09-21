import { adapters, businessCatalog } from '../adapters/index.js';
import type { ProductAdapter } from '../adapters/types.js';
import type {
  BusinessAvailability, ExternalBusinessType, NormalizedProduct, ProductAggregation,
} from '../types/product.js';
import { productRepository } from '../repositories/productRepository.js';

function getConfiguredUrl(business: string): string {
  return process.env[`${business.toUpperCase()}_API_URL`] || '(adapter default)';
}

type AdapterMap = Record<ExternalBusinessType, ProductAdapter>;
type ProductLogger = Pick<Console, 'info' | 'warn' | 'error'>;

const businessNames = Object.fromEntries(businessCatalog.map(item => [item.id, item.name])) as Record<ExternalBusinessType, string>;

function isUsableProduct(product: NormalizedProduct, business: ExternalBusinessType): boolean {
  return product.business === business
    && typeof product.id === 'string' && product.id.trim() !== ''
    && typeof product.name === 'string' && product.name.trim() !== ''
    && Number.isFinite(product.price) && product.price >= 0
    && Number.isFinite(product.stock) && product.stock >= 0;
}

export async function aggregateProducts(
  adapterMap: AdapterMap = adapters,
  logger: ProductLogger = console,
): Promise<ProductAggregation> {
  const adapterEntries = Object.entries(adapterMap) as Array<[ExternalBusinessType, ProductAdapter]>;
  const results = await Promise.allSettled(adapterEntries.map(async ([business, adapter]) => {
    const url = getConfiguredUrl(business);
    logger.info(`[${business}] Requesting products from ${url}`);
    const received = await adapter.getProducts();
    const seen = new Set<string>();
    const products = received.filter(product => {
      const usable = isUsableProduct(product, business) && !seen.has(product.id);
      if (usable) seen.add(product.id);
      return usable;
    });
    const dropped = received.length - products.length;
    if (dropped) logger.warn(`[${business}] Ignored ${dropped} invalid or duplicate product(s)`);
    logger.info(`[${business}] Product request completed: ${products.length} products`);
    return products;
  }));

  const products: NormalizedProduct[] = [];
  const businesses: BusinessAvailability[] = [];
  results.forEach((result, index) => {
    const [business] = adapterEntries[index];
    if (result.status === 'fulfilled') {
      products.push(...result.value);
      businesses.push({
        business, business_name: businessNames[business], status: 'online', product_count: result.value.length,
      });
      return;
    }
    logger.error(`[${business}] Product request failed (${getConfiguredUrl(business)}):`, result.reason);
    businesses.push({ business, business_name: businessNames[business], status: 'unavailable', product_count: 0 });
  });
  return { products, businesses };
}

export const productService = {
  async getProductAggregation() {
    const [external, local] = await Promise.all([aggregateProducts(), productRepository.list()]);
    return {
      products: [...local, ...external.products],
      businesses: [
        { business: 'vault' as const, business_name: 'VAULT', status: 'online' as const, product_count: local.length },
        ...external.businesses,
      ],
    };
  },
};
