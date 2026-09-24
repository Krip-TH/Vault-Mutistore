import type { OrderStatus } from './types';

/** Ported from frontend/src/orderStatus.ts. */
export function orderStatusLabel(status: OrderStatus): string {
  return status === 'completed' ? 'Delivered' : status[0].toUpperCase() + status.slice(1);
}
