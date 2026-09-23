import type { Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { chatWithDatabaseAssistant } from '../services/ai/databaseChatService.js';
import { describeProduct } from '../services/ai/describeService.js';
import { recommendProducts } from '../services/ai/recommendService.js';
import { searchProducts } from '../services/ai/searchService.js';

export async function postSearch(request: Request, response: Response): Promise<void> {
  try {
    const result = await searchProducts(request.body);
    response.json(result);
  } catch (error) {
    sendAiError(response, error);
  }
}

export async function postChat(request: Request, response: Response): Promise<void> {
  try {
    // The signed-in user id comes only from the verified session cookie — never from the request body.
    const userId = request.auth ? request.auth.userId : null;
    const result = await chatWithDatabaseAssistant(request.body, userId);
    response.json(result);
  } catch (error) {
    sendAiError(response, error);
  }
}

export async function getRecommendations(request: Request, response: Response): Promise<void> {
  try {
    const business = typeof request.query.business === 'string' ? request.query.business : undefined;
    const result = await recommendProducts(String(request.params.productId || ''), business);
    response.json(result);
  } catch (error) {
    sendAiError(response, error);
  }
}

export async function postDescribe(request: Request, response: Response): Promise<void> {
  try {
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const business = typeof body.business === 'string' ? body.business : undefined;
    const result = await describeProduct(productId, business);
    response.json(result);
  } catch (error) {
    sendAiError(response, error);
  }
}

function sendAiError(response: Response, error: unknown): void {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('AI request failed:', error);
  response.status(500).json({ error: { code: 'AI_FAILED', message: 'Unable to process the request. Please try again.' } });
}
