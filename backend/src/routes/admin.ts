import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import type { AdminService } from '../services/adminService.js';
import { adminService } from '../services/adminService.js';
import { createAdminProductController, sendUploadError } from '../controllers/adminProductController.js';
import { productImageUpload } from '../middleware/productImageUpload.js';
import { adminProductService } from '../services/adminProductService.js';
import type { AdminProductService } from '../services/adminProductService.js';

export function createAdminRouter(service: AdminService = adminService, products: AdminProductService = adminProductService) {
  const router = Router();
  const controller = createAdminController(service);
  const productController = createAdminProductController(products);
  router.use(requireAdmin);
  router.get('/dashboard', controller.getDashboard);
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
  return router;
}
