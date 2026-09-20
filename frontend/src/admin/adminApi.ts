import type { AdminDashboardData, AdminOrder, AdminOrderSummary } from '../types/admin';
import type { OrderStatus } from '../types/order';

type ErrorResponse = { error?: { message?: string } };

async function readData<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let message = fallback;
    try {
      const payload = await response.json() as ErrorResponse;
      message = payload.error?.message || fallback;
    } catch { /* Use the safe fallback for non-JSON error responses. */ }
    throw new Error(message);
  }
  const payload = await response.json() as { data?: T };
  if (payload.data === undefined) throw new Error('The admin response was incomplete.');
  return payload.data;
}

const options = { credentials: 'same-origin' as const, headers: { Accept: 'application/json' } };

export async function fetchAdminDashboard(fetcher: typeof fetch = fetch) {
  return readData<AdminDashboardData>(await fetcher('/api/admin/dashboard', options), 'Unable to load the dashboard.');
}

export async function fetchAdminOrders(fetcher: typeof fetch = fetch) {
  return readData<AdminOrderSummary[]>(await fetcher('/api/admin/orders', options), 'Unable to load orders.');
}

export async function fetchAdminOrder(orderNo: string, fetcher: typeof fetch = fetch) {
  return readData<AdminOrder>(await fetcher(`/api/admin/orders/${encodeURIComponent(orderNo)}`, options), 'Unable to load this order.');
}

export async function updateAdminOrderStatus(orderNo: string, status: OrderStatus, fetcher: typeof fetch = fetch) {
  return readData<AdminOrder>(await fetcher(`/api/admin/orders/${encodeURIComponent(orderNo)}/status`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }), 'Unable to update the order status.');
}
