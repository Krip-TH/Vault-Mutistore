import { getStoredToken } from './auth/AuthContext';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type { ApiErrorResponse, BusinessAvailability, CreateOrderRequest, Order, OrderSummary, Product, ProductsResponse } from './types';

export interface ProductsResult {
  products: Product[];
  businesses: BusinessAvailability[];
}

export async function fetchProducts(): Promise<ProductsResult> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`The products API returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ProductsResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error('The products API returned an unexpected response.');
  }

  return {
    products: payload.data,
    businesses: Array.isArray(payload.businesses) ? payload.businesses : [],
  };
}

export async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

/** Every authenticated request (orders, profile) uses the same Bearer token as /api/auth/me. */
export async function authorizedHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getStoredToken();
  if (!token) throw new Error('Sign in to continue.');
  return { Accept: 'application/json', Authorization: `Bearer ${token}`, ...extra };
}

export async function placeOrder(request: CreateOrderRequest): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: await authorizedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to place the order. Please try again.'));
  const payload = (await response.json()) as { data?: Order };
  if (!payload.data) throw new Error('The order response was incomplete. Your cart has been kept.');
  return payload.data;
}

export async function completeCheckout(request: CreateOrderRequest, clearCart: () => void): Promise<Order> {
  const order = await placeOrder(request);
  clearCart();
  return order;
}

export async function fetchOrders(): Promise<OrderSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    headers: await authorizedHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to load order history. Please try again.'));
  const payload = (await response.json()) as { data?: OrderSummary[] };
  if (!Array.isArray(payload.data)) throw new Error('The order history response was incomplete.');
  return payload.data;
}

export async function fetchOrder(orderNo: string): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderNo)}`, {
    headers: await authorizedHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to retrieve the saved order.'));
  const payload = (await response.json()) as { data?: Order };
  if (!payload.data) throw new Error('Unable to retrieve the saved order.');
  return payload.data;
}
