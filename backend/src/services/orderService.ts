import { randomBytes } from 'node:crypto';
import { adapters } from '../adapters/index.js';
import { ApiError } from '../errors/apiError.js';
import { orderRepository } from '../repositories/orderRepository.js';
import type { OrderRepository } from '../repositories/orderRepository.js';
import type { BusinessType, NormalizedProduct } from '../types/product.js';
import type { CreateOrderItemRequest, CreateOrderRequest, NewOrder, Order, OrderSummary } from '../types/order.js';

type ProductLoader = (business: BusinessType) => Promise<NormalizedProduct[]>;

export interface OrderServiceDependencies {
  loadProducts: ProductLoader;
  repository: OrderRepository;
  now: () => Date;
  randomSuffix: () => string;
}

const businessTypes = new Set<BusinessType>(Object.keys(adapters) as BusinessType[]);

export async function createOrder(
  userId: number,
  payload: unknown,
  overrides: Partial<OrderServiceDependencies> = {},
): Promise<Order> {
  const ownerId = authenticatedUserId(userId);
  const request = parseCreateOrderRequest(payload);
  const dependencies: OrderServiceDependencies = {
    loadProducts: loadBusinessProducts,
    repository: orderRepository,
    now: () => new Date(),
    randomSuffix: () => randomBytes(5).toString('hex').slice(0, 6).toUpperCase(),
    ...overrides,
  };
  const productsByBusiness = await loadRequiredBusinesses(request.items, dependencies.loadProducts);
  const items = request.items.map(item => validateItem(item, productsByBusiness.get(item.business) ?? []));
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(item.line_total * 100), 0);
  const subtotal = subtotalCents / 100;
  const base: Omit<NewOrder, 'order_no'> = {
    user_id: ownerId,
    customer: request.customer,
    shipping: request.shipping,
    items,
    subtotal,
    shipping_fee: 0,
    discount: 0,
    total: subtotal,
    status: 'confirmed',
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const order: NewOrder = { ...base, order_no: createOrderNo(dependencies.now(), dependencies.randomSuffix()) };
    try {
      return await dependencies.repository.create(order);
    } catch (error) {
      if (isDuplicateEntry(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Unable to allocate order number');
}

export async function getOrder(userId: number, orderNo: string, repository: OrderRepository = orderRepository): Promise<Order> {
  const ownerId = authenticatedUserId(userId);
  if (!/^MDG-\d{8}-[A-Z0-9]{6}$/.test(orderNo)) throw new ApiError(400, 'INVALID_ORDER_NUMBER', 'Invalid order number.');
  const order = await repository.findByOrderNoForUser(orderNo, ownerId);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  return order;
}

export async function listOrders(userId: number, repository: OrderRepository = orderRepository): Promise<OrderSummary[]> {
  return repository.listNewestForUser(authenticatedUserId(userId));
}

export function parseCreateOrderRequest(payload: unknown): CreateOrderRequest {
  const body = record(payload, 'Request body');
  const customer = record(body.customer, 'Customer information');
  const shipping = record(body.shipping, 'Shipping information');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw new ApiError(400, 'INVALID_ITEMS', 'The order must contain between 1 and 100 items.');
  }
  const seen = new Set<string>();
  const items = body.items.map((value, index) => {
    const item = record(value, `Item ${index + 1}`);
    const business = requiredText(item.business, `Item ${index + 1} business`, 50) as BusinessType;
    const product_id = requiredText(item.product_id, `Item ${index + 1} product`, 255);
    if (!businessTypes.has(business)) throw new ApiError(400, 'INVALID_BUSINESS', `Item ${index + 1} has an invalid business.`);
    if (!Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 10000) {
      throw new ApiError(400, 'INVALID_QUANTITY', `Item ${index + 1} has an invalid quantity.`);
    }
    const key = JSON.stringify([business, product_id]);
    if (seen.has(key)) throw new ApiError(400, 'DUPLICATE_ITEM', 'Duplicate products must be combined into one cart item.');
    seen.add(key);
    return { business, product_id, quantity: Number(item.quantity) };
  });
  const email = requiredText(customer.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  const phone = requiredText(customer.phone, 'Phone number', 40);
  if (!/^[+\d][\d\s().-]{5,38}$/.test(phone)) throw new ApiError(400, 'INVALID_PHONE', 'Enter a valid phone number.');
  return {
    customer: { name: requiredText(customer.name, 'Full name', 160), email, phone },
    shipping: {
      address_line1: requiredText(shipping.address_line1, 'Address line 1', 255),
      address_line2: optionalText(shipping.address_line2, 255),
      district: requiredText(shipping.district, 'District or area', 120),
      province: requiredText(shipping.province, 'Province', 120),
      postal_code: requiredText(shipping.postal_code, 'Postal code', 20),
      country: requiredText(shipping.country, 'Country', 120),
    },
    items,
  };
}

async function loadRequiredBusinesses(items: CreateOrderItemRequest[], loader: ProductLoader) {
  const required = [...new Set(items.map(item => item.business))];
  const results = await Promise.all(required.map(async business => {
    try {
      const products = await loader(business);
      if (!products.length) throw new Error('empty inventory response');
      return [business, products] as const;
    } catch (error) {
      const label = business[0].toUpperCase() + business.slice(1);
      throw new ApiError(502, 'INVENTORY_UNAVAILABLE', `${label} inventory is temporarily unavailable. Please try again.`, { cause: error });
    }
  }));
  return new Map(results);
}

function validateItem(item: CreateOrderItemRequest, products: NormalizedProduct[]) {
  const product = products.find(value => String(value.id) === item.product_id);
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', `A product in your ${item.business} cart is no longer available.`);
  if (!Number.isFinite(product.price) || product.price < 0) throw new ApiError(502, 'INVALID_INVENTORY', `${product.name} has invalid pricing data.`);
  if (!Number.isFinite(product.stock) || product.stock < 1 || product.status === 'Out of Stock') {
    throw new ApiError(409, 'OUT_OF_STOCK', `${product.name} is out of stock.`);
  }
  if (item.quantity > Math.floor(product.stock)) {
    throw new ApiError(409, 'INSUFFICIENT_STOCK', `${product.name} only has ${Math.floor(product.stock)} items available.`);
  }
  const unitPrice = Math.round(product.price * 100) / 100;
  return {
    product_id: product.id, business: product.business, business_name: product.business_name,
    product_name: product.name, category: product.category, image_url: product.image_url,
    unit_price: unitPrice, quantity: item.quantity,
    line_total: Math.round(unitPrice * item.quantity * 100) / 100,
  };
}

async function loadBusinessProducts(business: BusinessType) {
  return adapters[business].getProducts();
}

function createOrderNo(date: Date, suffix: string) {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `MDG-${day}-${suffix.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(6, '0').slice(0, 6)}`;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ApiError(400, 'INVALID_REQUEST', `${label} is required.`);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new ApiError(400, 'INVALID_FIELD', `${label} is required and must be ${maxLength} characters or fewer.`);
  return text;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) throw new ApiError(400, 'INVALID_FIELD', `Optional address must be ${maxLength} characters or fewer.`);
  return text;
}

function isDuplicateEntry(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

function authenticatedUserId(userId: number) {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return userId;
}
