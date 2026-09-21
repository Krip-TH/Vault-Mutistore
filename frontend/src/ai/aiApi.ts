import type { ChatMessage, ChatResponse, DescribeResponse, RecommendResponse, SearchResponse } from '../types/ai';

type Fetcher = typeof fetch;

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return payload.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function searchProductsWithAi(query: string, fetcher: Fetcher = fetch): Promise<SearchResponse> {
  const response = await fetcher('/api/ai/search', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'AI search is unavailable right now.'));
  }
  return response.json() as Promise<SearchResponse>;
}

export async function sendChatMessage(messages: ChatMessage[], fetcher: Fetcher = fetch): Promise<ChatResponse> {
  const response = await fetcher('/api/ai/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'The chat assistant is unavailable right now.'));
  }
  return response.json() as Promise<ChatResponse>;
}

export async function fetchAiDescription(
  productId: string,
  business: string,
  fetcher: Fetcher = fetch,
): Promise<DescribeResponse> {
  const response = await fetcher('/api/ai/describe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ productId, business }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'AI description is unavailable right now.'));
  }
  return response.json() as Promise<DescribeResponse>;
}

export async function fetchRecommendations(
  productId: string,
  business: string,
  fetcher: Fetcher = fetch,
): Promise<RecommendResponse> {
  const url = `/api/ai/recommend/${encodeURIComponent(productId)}?business=${encodeURIComponent(business)}`;
  const response = await fetcher(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'Recommendations are unavailable right now.'));
  }
  return response.json() as Promise<RecommendResponse>;
}
