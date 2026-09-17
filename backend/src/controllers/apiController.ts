import type { Request, Response } from 'express';
import { businessService } from '../services/businessService.js';
import { productService } from '../services/productService.js';

export function getHealth(_request: Request, response: Response): void {
  response.json({ status: 'ok', service: 'Moodeng MultiStore API' });
}
export async function getProducts(_request: Request, response: Response): Promise<void> {
  const products = await productService.getProductsFromAdapters();
  response.json({ data: products, source: 'adapters' });
}
export function getBusinesses(_request: Request, response: Response): void {
  response.json({ data: businessService.getBusinesses(), source: 'mock' });
}
export function getStockSummary(_request: Request, response: Response): void {
  response.json({ data: productService.getStockSummary(), source: 'mock' });
}
