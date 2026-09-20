import type { Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { adminService } from '../services/adminService.js';
import type { AdminService } from '../services/adminService.js';

function sendAdminError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Admin request failed:', error);
  response.status(500).json({ error: { code: 'ADMIN_FAILED', message: 'Unable to process the admin request.' } });
}

export function createAdminController(service: AdminService = adminService) {
  return {
    async getDashboard(_request: Request, response: Response) {
      try { response.json({ data: await service.getDashboard() }); }
      catch (error) { sendAdminError(response, error); }
    },
    async getOrders(_request: Request, response: Response) {
      try { response.json({ data: await service.listOrders() }); }
      catch (error) { sendAdminError(response, error); }
    },
    async getOrder(request: Request, response: Response) {
      try { response.json({ data: await service.getOrder(String(request.params.orderNo || '')) }); }
      catch (error) { sendAdminError(response, error); }
    },
    async patchOrderStatus(request: Request, response: Response) {
      try {
        response.json({ data: await service.updateOrderStatus(String(request.params.orderNo || ''), request.body) });
      } catch (error) { sendAdminError(response, error); }
    },
  };
}
