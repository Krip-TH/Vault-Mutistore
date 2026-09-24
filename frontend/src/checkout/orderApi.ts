import type { CreateOrderRequest, Order, OrderErrorResponse, OrderResponse, OrdersResponse } from '../types/order';

type Fetcher = typeof fetch;

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as OrderErrorResponse;
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function placeOrder(request: CreateOrderRequest, fetcher: Fetcher = fetch): Promise<Order> {
  const response = await fetcher('/api/orders', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to place the order. Please try again.'));
  const payload = await response.json() as Partial<OrderResponse>;
  if (!payload.data) throw new Error('The order response was incomplete. Your cart has been kept.');
  return payload.data;
}

export async function completeCheckout(
  request: CreateOrderRequest,
  clearCart: () => void,
  fetcher: Fetcher = fetch,
) {
  const order = await placeOrder(request, fetcher);
  clearCart();
  return order;
}

export async function fetchOrder(orderNo: string, fetcher: Fetcher = fetch): Promise<Order> {
  const response = await fetcher(`/api/orders/${encodeURIComponent(orderNo)}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to retrieve the saved order.'));
  const payload = await response.json() as Partial<OrderResponse>;
  if (!payload.data) throw new Error('Unable to retrieve the saved order.');
  return payload.data;
}

export async function fetchOrders(fetcher: Fetcher = fetch) {
  const response = await fetcher('/api/orders', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to load order history. Please try again.'));
  const payload = await response.json() as Partial<OrdersResponse>;
  if (!Array.isArray(payload.data)) throw new Error('The order history response was incomplete.');
  return payload.data;
}
