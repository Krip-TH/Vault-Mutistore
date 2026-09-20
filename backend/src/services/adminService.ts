import { ApiError } from '../errors/apiError.js';
import { adminRepository } from '../repositories/adminRepository.js';
import type { AdminRepository } from '../repositories/adminRepository.js';
import type { AdminDashboard, AdminOrder, AdminOrderSummary } from '../types/admin.js';
import type { OrderStatus } from '../types/order.js';

export const orderStatuses = [
  'pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled',
] as const satisfies readonly OrderStatus[];

export interface AdminService {
  getDashboard(): Promise<AdminDashboard>;
  listOrders(): Promise<AdminOrderSummary[]>;
  getOrder(orderNo: string): Promise<AdminOrder>;
  updateOrderStatus(orderNo: string, payload: unknown): Promise<AdminOrder>;
}

function validOrderNumber(orderNo: string) {
  if (!/^MDG-\d{8}-[A-Z0-9]{6}$/.test(orderNo)) {
    throw new ApiError(400, 'INVALID_ORDER_NUMBER', 'Invalid order number.');
  }
  return orderNo;
}

function statusFromPayload(payload: unknown): OrderStatus {
  const status = typeof payload === 'object' && payload !== null && 'status' in payload
    ? (payload as { status?: unknown }).status
    : undefined;
  if (typeof status !== 'string' || !orderStatuses.includes(status as OrderStatus)) {
    throw new ApiError(400, 'INVALID_ORDER_STATUS', 'Select a valid order status.');
  }
  return status as OrderStatus;
}

export function createAdminService(repository: AdminRepository = adminRepository): AdminService {
  async function getOrder(orderNo: string) {
    const order = await repository.findOrderByNumber(validOrderNumber(orderNo));
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    return order;
  }

  return {
    getDashboard: () => repository.getDashboard(),
    listOrders: () => repository.listOrders(),
    getOrder,
    async updateOrderStatus(orderNo, payload) {
      const validNumber = validOrderNumber(orderNo);
      const status = statusFromPayload(payload);
      if (!await repository.updateOrderStatus(validNumber, status)) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
      }
      return getOrder(validNumber);
    },
  };
}

export const adminService = createAdminService();
