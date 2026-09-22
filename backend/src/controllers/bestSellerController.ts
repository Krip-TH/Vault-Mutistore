import type { Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { bestSellerService } from '../services/bestSellerService.js';

export function createBestSellerController(service: Pick<typeof bestSellerService, 'list'> = bestSellerService) {
  return async function getBestSellers(request: Request, response: Response): Promise<void> {
    try {
      response.json({ data: await service.list(request.query), source: 'completed_orders' });
    } catch (error) {
      if (error instanceof ApiError) {
        response.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      console.error('Best sellers request failed:', error);
      response.status(500).json({ error: { code: 'BEST_SELLERS_FAILED', message: 'Unable to load best sellers right now.' } });
    }
  };
}

export const getBestSellers = createBestSellerController();
