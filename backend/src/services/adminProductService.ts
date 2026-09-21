import { ApiError } from '../errors/apiError.js';
import { productRepository } from '../repositories/productRepository.js';
import type { ProductRepository } from '../repositories/productRepository.js';
import { productService } from './productService.js';
import type { AdminProduct, ExternalBusinessType, NormalizedProduct, ProductInput, ProductOptions } from '../types/product.js';
import { businessCatalog } from '../adapters/index.js';
import { productOptionsService } from './productOptionsService.js';
import type { ProductOptionsService } from './productOptionsService.js';

export interface AdminProductService {
  listProducts(): Promise<AdminProduct[]>;
  getProduct(business: string, id: string): Promise<AdminProduct>;
  createProduct(payload: unknown): Promise<AdminProduct>;
  updateProduct(business: string, id: string, payload: unknown): Promise<AdminProduct>;
  deleteProduct(business: string, id: string): Promise<void>;
  getProductOptions(): Promise<ProductOptions>;
}

function adminProduct(product: NormalizedProduct): AdminProduct {
  const managed = product.business === 'vault';
  const catalogBusiness = managed ? product.catalog_business ?? null : product.business as ExternalBusinessType;
  return { ...product, management: managed ? 'vault' : 'external', can_edit: managed, can_delete: managed,
    catalog_business: catalogBusiness,
    catalog_business_name: businessCatalog.find(item => item.id === catalogBusiness)?.name || '',
  };
}

function validId(id: string) {
  if (!/^\d+$/.test(id) || Number(id) < 1) throw new ApiError(400, 'INVALID_PRODUCT_ID', 'Invalid product ID.');
  return id;
}

function input(payload: unknown): ProductInput {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError(400, 'INVALID_PRODUCT', 'Product details are required.');
  }
  const value = payload as Record<string, unknown>;
  const business = typeof value.business === 'string' ? value.business.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const category = typeof value.category === 'string' ? value.category.trim() : '';
  const unit = typeof value.unit === 'string' ? value.unit.trim() : '';
  const image_url = value.image_url === undefined ? '' : typeof value.image_url === 'string' ? value.image_url.trim() : '';
  const price = typeof value.price === 'number' ? value.price : NaN;
  const stock = typeof value.stock === 'number' ? value.stock : NaN;
  if (!businessCatalog.some(item => item.id === business) || !name || name.length > 255 || !category || category.length > 120 || !unit || unit.length > 50
    || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0
    || image_url.length > 2048 || (image_url && !(/^https?:\/\//i.test(image_url) || /^\/uploads\/products\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(image_url)))) {
    throw new ApiError(400, 'INVALID_PRODUCT', 'Provide a name, category, non-negative price and whole-number stock, unit, and an optional HTTP(S) or VAULT-uploaded image URL.');
  }
  return { business: business as ExternalBusinessType, name, category, price, stock, unit, image_url };
}

export function createAdminProductService(
  repository: ProductRepository = productRepository,
  aggregation: Pick<typeof productService, 'getProductAggregation'> = productService,
  optionsService: ProductOptionsService = productOptionsService,
): AdminProductService {
  async function requireVault(business: string) {
    if (business !== 'vault') throw new ApiError(409, 'EXTERNAL_PRODUCT_READ_ONLY', 'This product is managed by its source business and is read-only in VAULT.');
  }
  async function validatedInput(payload: unknown) {
    const parsed = input(payload);
    const options = await optionsService.getOptions();
    const available = options.businesses.find(item => item.id === parsed.business)?.categories || [];
    if (!available.some(category => category.toLocaleLowerCase() === parsed.category.toLocaleLowerCase())) {
      throw new ApiError(400, 'INVALID_PRODUCT_CATEGORY', 'Select a category available for the chosen business.');
    }
    parsed.category = available.find(category => category.toLocaleLowerCase() === parsed.category.toLocaleLowerCase())!;
    return parsed;
  }
  return {
    async listProducts() { return (await aggregation.getProductAggregation()).products.map(adminProduct); },
    async getProduct(business, id) {
      const found = (await aggregation.getProductAggregation()).products.find(product => product.business === business && product.id === id);
      if (!found) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
      return adminProduct(found);
    },
    getProductOptions: () => optionsService.getOptions(),
    async createProduct(payload) { return adminProduct(await repository.create(await validatedInput(payload))); },
    async updateProduct(business, id, payload) {
      await requireVault(business);
      const found = await repository.update(validId(id), await validatedInput(payload));
      if (!found) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
      return adminProduct(found);
    },
    async deleteProduct(business, id) {
      await requireVault(business);
      if (!await repository.delete(validId(id))) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    },
  };
}

export const adminProductService = createAdminProductService();
