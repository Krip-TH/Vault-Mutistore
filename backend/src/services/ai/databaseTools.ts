import type { FunctionCall, FunctionDeclaration } from '@google/genai';
import { ApiError } from '../../errors/apiError.js';
import { orderRepository } from '../../repositories/orderRepository.js';
import type { NormalizedProduct } from '../../types/product.js';
import { claimService } from '../claimService.js';
import { profileService } from '../profileService.js';
import { getCachedProducts } from './productsCache.js';

const DEFAULT_LIMIT = 10;
const MAX_RESULTS = 20;
const businesses = ['vault', 'door', 'plug', 'brandname', 'clothing', 'powerbank', 'projector'] as const;
const validBusinesses = new Set<string>(businesses);
type Json = Record<string, unknown>;

export interface DatabaseToolDependencies {
  getProducts(): Promise<NormalizedProduct[]>;
  getProfile(userId: number): Promise<unknown>;
  getOrders(userId: number): ReturnType<typeof orderRepository.listNewestForUser>;
  getOrder(orderNo: string, userId: number): ReturnType<typeof orderRepository.findByOrderNoForUser>;
  getClaims(userId: number, query: unknown): ReturnType<typeof claimService.listClaims>;
  getClaim(userId: number, claimNumber: string): ReturnType<typeof claimService.getClaim>;
  getWarranty(userId: number, orderNo: string): ReturnType<typeof claimService.getWarrantyDocument>;
}

const defaults: DatabaseToolDependencies = {
  getProducts: getCachedProducts,
  getProfile: userId => profileService.getProfile(userId),
  getOrders: userId => orderRepository.listNewestForUser(userId),
  getOrder: (orderNo, userId) => orderRepository.findByOrderNoForUser(orderNo, userId),
  getClaims: (userId, query) => claimService.listClaims(userId, query),
  getClaim: (userId, claimNumber) => claimService.getClaim(userId, claimNumber),
  getWarranty: (userId, orderNo) => claimService.getWarrantyDocument(userId, orderNo),
};

const schema = (properties: Json, required: string[] = []) => ({
  type: 'object', properties, required, additionalProperties: false,
});

export const databaseToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description: 'Search the current real VAULT catalog. Use for products, prices, stock, categories, businesses, and availability.',
    parametersJsonSchema: schema({
      query: { type: 'string', description: 'Product name or keywords.' },
      category: { type: 'string' }, business: { type: 'string', enum: businesses },
      min_price: { type: 'number', minimum: 0 }, max_price: { type: 'number', minimum: 0 },
      in_stock_only: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS },
    }),
  },
  {
    name: 'get_product_details', description: 'Get one current product by product id and business.',
    parametersJsonSchema: schema({ product_id: { type: 'string' }, business: { type: 'string', enum: businesses } }, ['product_id', 'business']),
  },
  { name: 'get_my_profile', description: 'Get the signed-in customer safe profile and shipping contact fields.', parametersJsonSchema: schema({}) },
  {
    name: 'get_my_orders', description: 'List the signed-in customer orders newest first. Use limit 1 for the latest order.',
    parametersJsonSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS } }),
  },
  {
    name: 'get_my_order_details', description: 'Get status, items, totals, and shipping address for an order owned by the signed-in customer.',
    parametersJsonSchema: schema({ order_no: { type: 'string' } }, ['order_no']),
  },
  {
    name: 'get_my_claims', description: 'List claims belonging to the signed-in customer, newest first.',
    parametersJsonSchema: schema({ status: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS } }),
  },
  {
    name: 'get_my_claim_status', description: 'Get details and status history for one claim belonging to the signed-in customer.',
    parametersJsonSchema: schema({ claim_number: { type: 'string' } }, ['claim_number']),
  },
  {
    name: 'get_warranty_information', description: 'Check claim eligibility, claim window expiry, claimable items, and existing claims for an owned order.',
    parametersJsonSchema: schema({ order_no: { type: 'string' } }, ['order_no']),
  },
];

function record(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Json : {};
}

function textArg(args: Json, name: string, pattern?: RegExp): string {
  const value = typeof args[name] === 'string' ? args[name].trim() : '';
  if (!value || value.length > 255 || (pattern && !pattern.test(value))) {
    throw new ApiError(400, 'INVALID_TOOL_ARGUMENTS', `Invalid ${name}.`);
  }
  return value;
}

function optionalNumber(args: Json, name: string): number | null {
  if (args[name] === undefined || args[name] === null) return null;
  const value = Number(args[name]);
  if (!Number.isFinite(value) || value < 0) throw new ApiError(400, 'INVALID_TOOL_ARGUMENTS', `Invalid ${name}.`);
  return value;
}

function limitArg(args: Json): number {
  const value = Math.floor(Number(args.limit ?? DEFAULT_LIMIT));
  return Number.isFinite(value) ? Math.min(MAX_RESULTS, Math.max(1, value)) : DEFAULT_LIMIT;
}

function requireUser(userId: number | null): number {
  if (!userId) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to access customer information.');
  return userId;
}

function productView(product: NormalizedProduct) {
  return {
    id: product.id, business: product.business, business_name: product.business_name,
    name: product.name, category: product.category, price: product.price, stock: product.stock,
    unit: product.unit, status: product.status,
  };
}

export function createDatabaseToolExecutor(userId: number | null, overrides: Partial<DatabaseToolDependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };
  return async (call: FunctionCall): Promise<Json> => {
    const args = record(call.args);
    switch (call.name) {
      case 'search_products': {
        const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
        const category = typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
        const business = typeof args.business === 'string' ? args.business.trim().toLowerCase() : '';
        if (business && !validBusinesses.has(business)) throw new ApiError(400, 'INVALID_TOOL_ARGUMENTS', 'Invalid business.');
        const minPrice = optionalNumber(args, 'min_price');
        const maxPrice = optionalNumber(args, 'max_price');
        if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new ApiError(400, 'INVALID_TOOL_ARGUMENTS', 'Invalid price range.');
        const matches = (await dependencies.getProducts()).filter(product => {
          const haystack = `${product.name} ${product.category} ${product.business_name}`.toLowerCase();
          return (!query || query.split(/\s+/).every(word => haystack.includes(word)))
            && (!category || product.category.toLowerCase().includes(category))
            && (!business || product.business === business)
            && (minPrice === null || product.price >= minPrice)
            && (maxPrice === null || product.price <= maxPrice)
            && (args.in_stock_only !== true || product.stock > 0);
        });
        const limit = limitArg(args);
        return { total_matches: matches.length, returned: Math.min(matches.length, limit), products: matches.slice(0, limit).map(productView) };
      }
      case 'get_product_details': {
        const productId = textArg(args, 'product_id');
        const business = textArg(args, 'business').toLowerCase();
        if (!validBusinesses.has(business)) throw new ApiError(400, 'INVALID_TOOL_ARGUMENTS', 'Invalid business.');
        const product = (await dependencies.getProducts()).find(item => item.id === productId && item.business === business);
        return product ? { found: true, product: productView(product) } : { found: false };
      }
      case 'get_my_profile': return { profile: await dependencies.getProfile(requireUser(userId)) };
      case 'get_my_orders': {
        const orders = await dependencies.getOrders(requireUser(userId));
        const limit = limitArg(args);
        return { total: orders.length, returned: Math.min(orders.length, limit), orders: orders.slice(0, limit) };
      }
      case 'get_my_order_details': {
        const orderNo = textArg(args, 'order_no', /^MDG-\d{8}-[A-Z0-9]{6}$/i).toUpperCase();
        const order = await dependencies.getOrder(orderNo, requireUser(userId));
        return order ? { found: true, order } : { found: false };
      }
      case 'get_my_claims': {
        const limit = limitArg(args);
        const status = typeof args.status === 'string' ? args.status.trim().toLowerCase() : 'all';
        const result = await dependencies.getClaims(requireUser(userId), { status, page: 1, page_size: limit });
        return { total: result.total, returned: result.claims.length, claims: result.claims };
      }
      case 'get_my_claim_status': {
        const number = textArg(args, 'claim_number', /^CLM-\d{8}-\d{6}$/i).toUpperCase();
        try { return { found: true, claim: await dependencies.getClaim(requireUser(userId), number) }; }
        catch (error) { if (error instanceof ApiError && error.status === 404) return { found: false }; throw error; }
      }
      case 'get_warranty_information': {
        const orderNo = textArg(args, 'order_no', /^MDG-\d{8}-[A-Z0-9]{6}$/i).toUpperCase();
        try { return { found: true, warranty: await dependencies.getWarranty(requireUser(userId), orderNo) }; }
        catch (error) { if (error instanceof ApiError && error.status === 404) return { found: false }; throw error; }
      }
      default: throw new ApiError(400, 'UNKNOWN_AI_TOOL', 'The requested assistant operation is not allowed.');
    }
  };
}
