import type {
  Claim, ClaimListPage, ClaimStatus, ClaimWarrantyDocument, ClaimableItemsResponse,
} from '../types/claim';

type Fetcher = typeof fetch;
type ErrorResponse = { error?: { message?: string } };

const options = { credentials: 'same-origin' as const, headers: { Accept: 'application/json' } };

async function readData<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let message = fallback;
    try {
      const payload = await response.json() as ErrorResponse;
      message = payload.error?.message || fallback;
    } catch { /* Use the safe fallback for non-JSON error responses. */ }
    throw new Error(message);
  }
  const payload = await response.json() as { data?: T };
  if (payload.data === undefined) throw new Error('The claim response was incomplete.');
  return payload.data;
}

export async function fetchClaims(
  query: { status?: ClaimStatus | 'all'; page?: number } = {},
  fetcher: Fetcher = fetch,
): Promise<ClaimListPage> {
  const search = new URLSearchParams();
  if (query.status && query.status !== 'all') search.set('status', query.status);
  if (query.page && query.page > 1) search.set('page', String(query.page));
  const suffix = search.size ? `?${search}` : '';
  return readData<ClaimListPage>(await fetcher(`/api/claims${suffix}`, options), 'Unable to load your claims.');
}

export async function fetchClaim(claimNumber: string, fetcher: Fetcher = fetch): Promise<Claim> {
  return readData<Claim>(
    await fetcher(`/api/claims/${encodeURIComponent(claimNumber)}`, options),
    'Unable to load this claim.',
  );
}

export async function cancelClaim(claimNumber: string, fetcher: Fetcher = fetch): Promise<Claim> {
  return readData<Claim>(await fetcher(`/api/claims/${encodeURIComponent(claimNumber)}/cancel`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: '{}',
  }), 'Unable to cancel this claim.');
}

/** The body is multipart because it carries the evidence photos alongside the form fields. */
export async function submitClaim(body: FormData, fetcher: Fetcher = fetch): Promise<Claim> {
  return readData<Claim>(await fetcher('/api/claims', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    body,
  }), 'Unable to submit the claim. Please try again.');
}

export async function fetchWarrantyDocument(orderNo: string, fetcher: Fetcher = fetch): Promise<ClaimWarrantyDocument> {
  return readData<ClaimWarrantyDocument>(
    await fetcher(`/api/orders/${encodeURIComponent(orderNo)}/warranty-document`, options),
    'Unable to load the claim and warranty document.',
  );
}

export async function fetchClaimableItems(orderNo: string, fetcher: Fetcher = fetch): Promise<ClaimableItemsResponse> {
  return readData<ClaimableItemsResponse>(
    await fetcher(`/api/orders/${encodeURIComponent(orderNo)}/claimable-items`, options),
    'Unable to load the products you can claim.',
  );
}

/** Builds the multipart body the claim endpoint expects, including one entry per photo. */
export function buildClaimFormData(input: {
  orderNo: string;
  reason: string;
  description: string;
  contactPhone: string;
  items: Array<{ order_item_id: number; quantity: number }>;
  files: File[];
}): FormData {
  const body = new FormData();
  body.set('order_no', input.orderNo);
  body.set('reason', input.reason);
  body.set('description', input.description);
  if (input.contactPhone.trim()) body.set('contact_phone', input.contactPhone.trim());
  body.set('items', JSON.stringify(input.items));
  for (const file of input.files) body.append('evidence', file);
  return body;
}
