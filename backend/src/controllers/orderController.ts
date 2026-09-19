import type { Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { createOrder, getOrder, listOrders } from '../services/orderService.js';

export async function postOrder(request: Request, response: Response): Promise<void> {
  try {
    const order = await createOrder(request.body);
    response.status(201).json({ data: order });
  } catch (error) {
    sendOrderError(response, error);
  }
}

export async function getOrderByNumber(request: Request, response: Response): Promise<void> {
  try {
    const order = await getOrder(String(request.params.orderNo || ''));
    response.json({ data: order });
  } catch (error) {
    sendOrderError(response, error);
  }
}

export async function getOrders(_request: Request, response: Response): Promise<void> {
  try {
    response.json({ data: await listOrders() });
  } catch (error) {
    sendOrderError(response, error);
  }
}

function sendOrderError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Order request failed:', error);
  response.status(500).json({ error: { code: 'ORDER_FAILED', message: 'Unable to process the order. Please try again.' } });
}
