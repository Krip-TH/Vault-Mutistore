import { Router } from 'express';
import { getBusinesses, getHealth, getProducts, getStockSummary } from '../controllers/apiController.js';

const router = Router();
router.get('/health', getHealth);
router.get('/products', getProducts);
router.get('/businesses', getBusinesses);
router.get('/stock/summary', getStockSummary);
export default router;
