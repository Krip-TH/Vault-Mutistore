import type { FunctionCall, FunctionDeclaration } from '@google/genai';
import { ApiError } from '../../errors/apiError.js';
import { orderRepository } from '../../repositories/orderRepository.js';
import type { NormalizedProduct } from '../../types/product.js';
import { claimService } from '../claimService.js';
import { profileService } from '../profileService.js';
import { createBestSellerService } from '../bestSellerService.js';
import { getCachedProducts } from './productsCache.js';
import type { ExecutedToolResult } from './geminiClient.js';

const DEFAULT_LIMIT = 10;
const MAX_RESULTS = 20;
const businesses = ['vault', 'door', 'plug', 'brandname', 'clothing', 'powerbank', 'projector'] as const;
const validBusinesses = new Set<string>(businesses);
type Json = Record<string, unknown>;

const aiBestSellerService = createBestSellerService({
  getProductAggregation: async () => ({ products: await getCachedProducts(), businesses: [] }),
});

export interface DatabaseToolDependencies {
  getProducts(): Promise<NormalizedProduct[]>;
  getProfile(userId: number): Promise<unknown>;
  getOrders(userId: number): ReturnType<typeof orderRepository.listNewestForUser>;
  getOrder(orderNo: string, userId: number): ReturnType<typeof orderRepository.findByOrderNoForUser>;
  getClaims(userId: number, query: unknown): ReturnType<typeof claimService.listClaims>;
  getClaim(userId: number, claimNumber: string): ReturnType<typeof claimService.getClaim>;
  getWarranty(userId: number, orderNo: string): ReturnType<typeof claimService.getWarrantyDocument>;
  getBestSellers(query: unknown): ReturnType<typeof aiBestSellerService.list>;
}

const defaults: DatabaseToolDependencies = {
  getProducts: getCachedProducts,
  getProfile: userId => profileService.getProfile(userId),
  getOrders: userId => orderRepository.listNewestForUser(userId),
  getOrder: (orderNo, userId) => orderRepository.findByOrderNoForUser(orderNo, userId),
  getClaims: (userId, query) => claimService.listClaims(userId, query),
  getClaim: (userId, claimNumber) => claimService.getClaim(userId, claimNumber),
  getWarranty: (userId, orderNo) => claimService.getWarrantyDocument(userId, orderNo),
  getBestSellers: query => aiBestSellerService.list(query),
};

const schema = (properties: Json, required: string[] = []) => ({
  type: 'object', properties, required, additionalProperties: false,
});

export const databaseToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_products',
    description: 'One complete, answer-ready lookup for product search, recommendations, price, stock, category, store, status, and availability. Each result already includes all those current fields; do not call get_product_details afterward.',
    parametersJsonSchema: schema({
      query: { type: 'string', description: 'Product name or keywords.' },
      category: { type: 'string' }, business: { type: 'string', enum: businesses },
      min_price: { type: 'number', minimum: 0 }, max_price: { type: 'number', minimum: 0 },
      in_stock_only: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS },
    }),
  },
  {
    name: 'get_product_details', description: 'Get one exact current product only when both its product id and business are already known. Do not use after search_products because search results are already complete.',
    parametersJsonSchema: schema({ product_id: { type: 'string' }, business: { type: 'string', enum: businesses } }, ['product_id', 'business']),
  },
  {
    name: 'get_best_sellers', description: 'One complete, answer-ready lookup for products ranked by real completed-order sales, including current price and stock. Do not follow with another product tool.',
    parametersJsonSchema: schema({
      business: { type: 'string', enum: businesses }, limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS },
    }),
  },
  { name: 'get_my_profile', description: 'One complete, answer-ready lookup for the signed-in customer safe profile and shipping contact fields. No follow-up tool is needed.', parametersJsonSchema: schema({}) },
  {
    name: 'get_my_orders', description: 'One complete, answer-ready lookup for order lists, latest order, status, total, item count, and date. Orders are newest first; use limit 1 for the latest. Do not call get_my_order_details unless the shopper explicitly asks for line items or shipping details.',
    parametersJsonSchema: schema({ limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS } }),
  },
  {
    name: 'get_my_order_details', description: 'One complete, answer-ready lookup for status, line items, totals, and shipping address. Provide order_no when the shopper gives one; omit it to retrieve the latest owned order directly.',
    parametersJsonSchema: schema({ order_no: { type: 'string', description: 'Owned order number. Omit for the latest order.' } }),
  },
  {
    name: 'get_my_claims', description: 'One complete, answer-ready lookup for claim lists, latest claim, status, reason, product, store, and dates. Claims are newest first; use limit 1 for the latest.',
    parametersJsonSchema: schema({ status: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS } }),
  },
  {
    name: 'get_my_claim_status', description: 'One complete, answer-ready lookup for claim details and status history. Provide claim_number when the shopper gives one; omit it to retrieve the latest claim directly.',
    parametersJsonSchema: schema({ claim_number: { type: 'string', description: 'Owned claim number. Omit for the latest claim.' } }),
  },
  {
    name: 'get_warranty_information', description: 'One complete, answer-ready lookup for warranty/claim eligibility, expiry, claimable items, and existing claims. Provide order_no when given; omit it to check the latest owned order directly.',
    parametersJsonSchema: schema({ order_no: { type: 'string', description: 'Owned order number. Omit for the latest order.' } }),
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

function rows(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function money(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('th-TH')} บาท` : 'ไม่ระบุราคา';
}

function productSummary(product: Json): string {
  const name = typeof product.name === 'string' ? product.name : 'สินค้า';
  const business = typeof product.business_name === 'string' ? ` จาก ${product.business_name}` : '';
  const stock = Number(product.stock);
  const stockText = Number.isFinite(stock) ? `คงเหลือ ${stock.toLocaleString('th-TH')} ชิ้น` : String(product.status ?? 'ไม่ทราบสต็อก');
  return `${name}${business} ราคา ${money(product.price)} (${stockText})`;
}

function renderOneToolResult({ call, result }: ExecutedToolResult): string {
  if ('error' in result) return 'ขออภัยค่ะ ไม่สามารถตรวจสอบข้อมูลล่าสุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ';
  switch (call.name) {
    case 'search_products': {
      const products = rows(result.products);
      return products.length
        ? `พบสินค้าที่ตรงกับคำถามค่ะ\n${products.slice(0, 5).map(product => `• ${productSummary(product)}`).join('\n')}`
        : 'ไม่พบสินค้าที่ตรงกับเงื่อนไขในข้อมูลล่าสุดค่ะ';
    }
    case 'get_product_details': {
      return result.found === true ? productSummary(record(result.product)) : 'ไม่พบสินค้านี้ในข้อมูลล่าสุดค่ะ';
    }
    case 'get_best_sellers': {
      const sellers = rows(result.best_sellers);
      return sellers.length
        ? `สินค้าขายดีล่าสุดค่ะ\n${sellers.slice(0, 5).map(item => `• อันดับ ${item.rank}: ${productSummary(record(item.product))}`).join('\n')}`
        : 'ยังไม่มีข้อมูลสินค้าขายดีที่ตรวจสอบได้ค่ะ';
    }
    case 'get_my_orders': {
      const orders = rows(result.orders);
      return orders.length
        ? orders.slice(0, 5).map(order => `คำสั่งซื้อ ${String(order.order_no)} สถานะ ${String(order.status)} ยอดรวม ${money(order.total)}`).join('\n')
        : 'ยังไม่พบคำสั่งซื้อในบัญชีนี้ค่ะ';
    }
    case 'get_my_order_details': {
      if (result.found !== true) return 'ไม่พบคำสั่งซื้อในบัญชีนี้ค่ะ';
      const order = record(result.order);
      const items = rows(order.items).map(item => `${String(item.product_name)} × ${String(item.quantity)}`).join(', ');
      return `คำสั่งซื้อ ${String(order.order_no)} สถานะ ${String(order.status)} ยอดรวม ${money(order.total)}${items ? ` รายการ: ${items}` : ''}`;
    }
    case 'get_my_claims': {
      const claims = rows(result.claims);
      return claims.length
        ? claims.slice(0, 5).map(claim => `เคลม ${String(claim.claim_number)} สถานะ ${String(claim.status)} สินค้า ${String(claim.product_name)}`).join('\n')
        : 'ยังไม่พบรายการเคลมในบัญชีนี้ค่ะ';
    }
    case 'get_my_claim_status': {
      if (result.found !== true) return 'ไม่พบรายการเคลมในบัญชีนี้ค่ะ';
      const claim = record(result.claim);
      return `เคลม ${String(claim.claim_number)} สถานะ ${String(claim.status)} สำหรับคำสั่งซื้อ ${String(claim.order_no)} ค่ะ`;
    }
    case 'get_warranty_information': {
      if (result.found !== true) return 'ไม่พบคำสั่งซื้อสำหรับตรวจสอบการรับประกันค่ะ';
      const warranty = record(result.warranty);
      return warranty.eligible === true
        ? `คำสั่งซื้อ ${String(warranty.order_no)} ยังมีสิทธิ์เคลม${warranty.claim_window_expires_at ? `ถึง ${String(warranty.claim_window_expires_at)}` : ''} ค่ะ`
        : `คำสั่งซื้อ ${String(warranty.order_no)} ไม่สามารถเคลมได้${warranty.ineligible_reason ? `: ${String(warranty.ineligible_reason)}` : ''} ค่ะ`;
    }
    case 'get_my_profile': {
      const profile = record(result.profile);
      const name = typeof profile.name === 'string' ? profile.name : 'ไม่ระบุชื่อ';
      const email = typeof profile.email === 'string' ? ` อีเมล ${profile.email}` : '';
      const phone = typeof profile.phone === 'string' && profile.phone ? ` โทร ${profile.phone}` : '';
      return `ข้อมูลโปรไฟล์: ${name}${email}${phone} ค่ะ`;
    }
    default: return 'ตรวจสอบข้อมูลล่าสุดเรียบร้อยแล้วค่ะ กรุณาลองถามอีกครั้งโดยระบุสิ่งที่ต้องการทราบค่ะ';
  }
}

/** Grounded last-resort response when Gemini fails to turn successful tool data into text. */
export function renderDatabaseToolFallback(results: ExecutedToolResult[]): string {
  return results.length
    ? results.map(renderOneToolResult).join('\n\n')
    : 'ขออภัยค่ะ ไม่สามารถตรวจสอบข้อมูลล่าสุดได้ในขณะนี้ กรุณาลองใหม่อีกครั้งค่ะ';
}

async function newestOrderNo(dependencies: DatabaseToolDependencies, userId: number): Promise<string | null> {
  return (await dependencies.getOrders(userId))[0]?.order_no ?? null;
}

async function newestClaimNumber(dependencies: DatabaseToolDependencies, userId: number): Promise<string | null> {
  const result = await dependencies.getClaims(userId, { status: 'all', page: 1, page_size: 1 });
  return result.claims[0]?.claim_number ?? null;
}

function productView(product: NormalizedProduct) {
  return {
    id: product.id, business: product.business, business_name: product.business_name,
    name: product.name, category: product.category, price: product.price, stock: product.stock,
    status: product.status,
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
      case 'get_best_sellers': {
        const limit = limitArg(args);
        const business = typeof args.business === 'string' ? args.business.trim().toLowerCase() : '';
        if (business && !validBusinesses.has(business)) throw new ApiError(400, 'INVALID_TOOL_ARGUMENTS', 'Invalid business.');
        const sellers = await dependencies.getBestSellers({ limit, business: business || undefined });
        return { returned: sellers.length, best_sellers: sellers.map(item => ({
          rank: item.rank, units_sold: item.units_sold, product: productView(item.product),
        })) };
      }
      case 'get_my_profile': return { profile: await dependencies.getProfile(requireUser(userId)) };
      case 'get_my_orders': {
        const orders = await dependencies.getOrders(requireUser(userId));
        const limit = limitArg(args);
        return { total: orders.length, returned: Math.min(orders.length, limit), orders: orders.slice(0, limit) };
      }
      case 'get_my_order_details': {
        const ownerId = requireUser(userId);
        const suppliedOrderNo = typeof args.order_no === 'string' && args.order_no.trim()
          ? textArg(args, 'order_no', /^MDG-\d{8}-[A-Z0-9]{6}$/i).toUpperCase()
          : null;
        const orderNo = suppliedOrderNo ?? await newestOrderNo(dependencies, ownerId);
        if (!orderNo) return { found: false, reason: 'NO_ORDERS' };
        const order = await dependencies.getOrder(orderNo, ownerId);
        return order ? { found: true, order } : { found: false };
      }
      case 'get_my_claims': {
        const limit = limitArg(args);
        const status = typeof args.status === 'string' ? args.status.trim().toLowerCase() : 'all';
        const result = await dependencies.getClaims(requireUser(userId), { status, page: 1, page_size: limit });
        return { total: result.total, returned: result.claims.length, claims: result.claims };
      }
      case 'get_my_claim_status': {
        const ownerId = requireUser(userId);
        const suppliedNumber = typeof args.claim_number === 'string' && args.claim_number.trim()
          ? textArg(args, 'claim_number', /^CLM-\d{8}-\d{6}$/i).toUpperCase()
          : null;
        const number = suppliedNumber ?? await newestClaimNumber(dependencies, ownerId);
        if (!number) return { found: false, reason: 'NO_CLAIMS' };
        try { return { found: true, claim: await dependencies.getClaim(ownerId, number) }; }
        catch (error) { if (error instanceof ApiError && error.status === 404) return { found: false }; throw error; }
      }
      case 'get_warranty_information': {
        const ownerId = requireUser(userId);
        const suppliedOrderNo = typeof args.order_no === 'string' && args.order_no.trim()
          ? textArg(args, 'order_no', /^MDG-\d{8}-[A-Z0-9]{6}$/i).toUpperCase()
          : null;
        const orderNo = suppliedOrderNo ?? await newestOrderNo(dependencies, ownerId);
        if (!orderNo) return { found: false, reason: 'NO_ORDERS' };
        try { return { found: true, warranty: await dependencies.getWarranty(ownerId, orderNo) }; }
        catch (error) { if (error instanceof ApiError && error.status === 404) return { found: false }; throw error; }
      }
      default: throw new ApiError(400, 'UNKNOWN_AI_TOOL', 'The requested assistant operation is not allowed.');
    }
  };
}
