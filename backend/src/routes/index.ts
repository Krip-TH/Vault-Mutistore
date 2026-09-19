import { Router } from 'express';
import { getBusinesses, getHealth, getProducts, getStockSummary } from '../controllers/apiController.js';
import { getOrderByNumber, getOrders, postOrder } from '../controllers/orderController.js';

const router = Router();
router.get('/health', getHealth);
router.get('/products', getProducts);
router.get('/businesses', getBusinesses);
router.get('/stock/summary', getStockSummary);
router.post('/orders', postOrder);
router.get('/orders', getOrders);
router.get('/orders/:orderNo', getOrderByNumber);
export default router;
