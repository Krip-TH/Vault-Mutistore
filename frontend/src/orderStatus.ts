import type { OrderStatus } from './types/order';

export const orderStatuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];

export function orderStatusLabel(status: OrderStatus) {
  return status === 'completed' ? 'Delivered' : status[0].toUpperCase() + status.slice(1);
}
