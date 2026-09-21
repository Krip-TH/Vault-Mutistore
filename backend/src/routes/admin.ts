import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import type { AdminService } from '../services/adminService.js';
import { adminService } from '../services/adminService.js';
import { createAdminProductController, sendUploadError } from '../controllers/adminProductController.js';
import { productImageUpload } from '../middleware/productImageUpload.js';
import { adminProductService } from '../services/adminProductService.js';
import type { AdminProductService } from '../services/adminProductService.js';
import {createManagementController} from '../controllers/managementController.js';
import {createAnalyticsController} from '../controllers/analyticsController.js';
import {analyticsService} from '../services/analyticsService.js';
import type {AnalyticsService} from '../controllers/analyticsController.js';

export function createAdminRouter(service: AdminService = adminService, products: AdminProductService = adminProductService, analytics: AnalyticsService = analyticsService) {
  const router = Router();
  const controller = createAdminController(service);
  const productController = createAdminProductController(products);
  const management=createManagementController();
  const analyticsController=createAnalyticsController(analytics);
  router.use(requireAdmin);
  router.get('/dashboard', controller.getDashboard);
  router.get('/analytics', analyticsController.overview);
  router.get('/orders', controller.getOrders);
  router.get('/orders/:orderNo', controller.getOrder);
  router.patch('/orders/:orderNo/status', controller.patchOrderStatus);
  router.post('/products/upload-image', (request, response) => {
    productImageUpload.single('image')(request, response, error => {
      if (error) { sendUploadError(response, error); return; }
      productController.uploadImage(request, response);
    });
  });
  router.get('/product-options', productController.options);
  router.get('/products', productController.list);
  router.get('/products/:business/:id', productController.get);
  router.post('/products', productController.create);
  router.put('/products/:business/:id', productController.update);
  router.delete('/products/:business/:id', productController.remove);
  router.get('/users',management.listUsers);router.post('/users',management.createUser);router.put('/users/:id',management.updateUser);router.delete('/users/:id',management.deleteUser);
  router.get('/businesses',management.listBusinesses);router.put('/businesses/:id',management.updateBusiness);
  return router;
}
