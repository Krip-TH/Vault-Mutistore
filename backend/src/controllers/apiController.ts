import type { Request, Response } from 'express';
import { productService } from '../services/productService.js';

export function getHealth(_request: Request, response: Response): void {
  response.json({ status: 'ok', service: 'VAULT API' });
}
export async function getProducts(_request: Request, response: Response): Promise<void> {
  const result = await productService.getProductAggregation();
  response.json({ data: result.products, businesses: result.businesses, source: 'adapters' });
}
export async function getBusinesses(_request: Request, response: Response): Promise<void> {
  const result = await productService.getProductAggregation();
  response.json({ data: result.businesses, source: 'adapters' });
}
export async function getStockSummary(_request: Request, response: Response): Promise<void> {
  const result = await productService.getProductAggregation();
  response.json({ data: {
    business_count: result.businesses.length,
    online_business_count: result.businesses.filter(business => business.status === 'online').length,
    product_count: result.products.length,
    total_stock: result.products.reduce((total, product) => total + product.stock, 0),
  }, source: 'adapters' });
}
