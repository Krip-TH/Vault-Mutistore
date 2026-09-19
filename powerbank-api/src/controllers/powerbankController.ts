import type { Request, Response } from 'express';
import { powerbankService, ValidationError } from '../services/powerbankService.js';

export function getHealth(_request: Request, response: Response): void {
  response.json({ status: 'ok', service: 'Powerbank Stock Product API' });
}

export function getPowerbanks(_request: Request, response: Response): void {
  response.json({ data: powerbankService.getAll(), source: 'mock' });
}

export function getPowerbankById(request: Request, response: Response): void {
  const product = powerbankService.getById(String(request.params.id));
  if (!product) {
    response.status(404).json({ error: 'Powerbank product not found' });
    return;
  }

  response.json({ data: product });
}

export function createPowerbank(request: Request, response: Response): void {
  try {
    const product = powerbankService.create(request.body);
    response.status(201).json({ data: product });
  } catch (error) {
    if (error instanceof ValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error('[powerbank] Failed to create product:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
}

export function updatePowerbank(request: Request, response: Response): void {
  try {
    const product = powerbankService.update(String(request.params.id), request.body);
    if (!product) {
      response.status(404).json({ error: 'Powerbank product not found' });
      return;
    }

    response.json({ data: product });
  } catch (error) {
    if (error instanceof ValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error('[powerbank] Failed to update product:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
}

export function deletePowerbank(request: Request, response: Response): void {
  const product = powerbankService.remove(String(request.params.id));
  if (!product) {
    response.status(404).json({ error: 'Powerbank product not found' });
    return;
  }

  response.json({ data: product });
}
