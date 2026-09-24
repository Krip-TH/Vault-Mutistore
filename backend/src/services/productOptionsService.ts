import { businessCatalog } from '../adapters/index.js';
import { productRepository } from '../repositories/productRepository.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import { aggregateProducts } from './productService.js';
import type { ExternalBusinessType, ProductOptions } from '../types/product.js';

export interface ProductOptionsService { getOptions(): Promise<ProductOptions> }

function identity(value: string) { return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, ''); }

export function createProductOptionsService(
  repository: Pick<ProductRepository, 'listCategorySources'> = productRepository,
  loadExternal = aggregateProducts,
): ProductOptionsService {
  return {
    async getOptions() {
      const [externalResult, storedResult] = await Promise.allSettled([loadExternal(), repository.listCategorySources()]);
      const categories = new Map<ExternalBusinessType, Map<string, string>>(
        businessCatalog.map(item => [item.id, new Map()]),
      );
      const add = (business: ExternalBusinessType, category: string) => {
        const clean = category.trim().replace(/\s+/g, ' ');
        const values = categories.get(business);
        if (clean && values && !values.has(clean.toLocaleLowerCase())) values.set(clean.toLocaleLowerCase(), clean);
      };
      if (externalResult.status === 'fulfilled') {
        for (const product of externalResult.value.products) {
          if (product.business !== 'vault') add(product.business, product.category);
        }
      }
      if (storedResult.status === 'fulfilled') {
        for (const row of storedResult.value) {
          const key = identity(row.business_key); const name = identity(row.business_name);
          const match = businessCatalog.find(item => identity(item.id) === key || identity(item.name) === key
            || identity(item.id) === name || identity(item.name) === name);
          if (match) add(match.id, row.category);
        }
      }
      return { businesses: businessCatalog.map(item => ({
        id: item.id, name: item.name,
        categories: [...(categories.get(item.id)?.values() || [])].sort((a, b) => a.localeCompare(b)),
      })) };
    },
  };
}

export const productOptionsService = createProductOptionsService();
