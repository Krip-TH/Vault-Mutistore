import { errorMessage } from './api';
import { getStoredToken } from './auth/AuthContext';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type { ChatMessage, ChatResponse, DescribeResponse, RecommendResponse, SearchResponse } from './types';

/**
 * Chat should answer order questions when signed in but must also work for guests, so the
 * token is attached only if one exists — unlike orders/profile, which require it outright.
 */
async function optionalAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function searchProductsWithAi(query: string): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'AI search is unavailable right now.'));
  return response.json() as Promise<SearchResponse>;
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(await optionalAuthHeaders()) },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'The chat assistant is unavailable right now.'));
  return response.json() as Promise<ChatResponse>;
}

export async function fetchAiDescription(productId: string, business: string): Promise<DescribeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ productId, business }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'AI description is unavailable right now.'));
  return response.json() as Promise<DescribeResponse>;
}

export async function fetchRecommendations(productId: string, business: string): Promise<RecommendResponse> {
  const url = `${API_BASE_URL}/api/ai/recommend/${encodeURIComponent(productId)}?business=${encodeURIComponent(business)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await errorMessage(response, 'Recommendations are unavailable right now.'));
  return response.json() as Promise<RecommendResponse>;
}
