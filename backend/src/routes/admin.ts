import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import type { AdminService } from '../services/adminService.js';
import { adminService } from '../services/adminService.js';

export function createAdminRouter(service: AdminService = adminService) {
  const router = Router();
  const controller = createAdminController(service);
  router.use(requireAdmin);
  router.get('/dashboard', controller.getDashboard);
  router.get('/orders', controller.getOrders);
  router.get('/orders/:orderNo', controller.getOrder);
  router.patch('/orders/:orderNo/status', controller.patchOrderStatus);
  return router;
}
