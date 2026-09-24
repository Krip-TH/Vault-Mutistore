import type { ImagePickerAsset } from 'expo-image-picker';
import { authorizedHeaders, errorMessage } from './api';
import { API_BASE_URL } from './config';
import { apiFetch } from './http';
import type {
  Claim, ClaimableItemsResponse, ClaimListPage, ClaimReason, ClaimStatus,
} from './types';

async function readData<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await errorMessage(response, fallback));
  const payload = (await response.json()) as { data?: T };
  if (payload.data === undefined) throw new Error('The claim response was incomplete.');
  return payload.data;
}

export async function fetchClaims(status: ClaimStatus | 'all' = 'all'): Promise<ClaimListPage> {
  const search = status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
  const response = await apiFetch(`${API_BASE_URL}/api/claims${search}`, {
    headers: await authorizedHeaders(),
  });
  return readData<ClaimListPage>(response, 'Unable to load your claims.');
}

export async function fetchClaim(claimNumber: string): Promise<Claim> {
  const response = await apiFetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(claimNumber)}`, {
    headers: await authorizedHeaders(),
  });
  return readData<Claim>(response, 'Unable to load this claim.');
}

export async function cancelClaim(claimNumber: string): Promise<Claim> {
  const response = await apiFetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(claimNumber)}/cancel`, {
    method: 'POST',
    headers: await authorizedHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  return readData<Claim>(response, 'Unable to cancel this claim.');
}

export async function fetchClaimableItems(orderNo: string): Promise<ClaimableItemsResponse> {
  const response = await apiFetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderNo)}/claimable-items`, {
    headers: await authorizedHeaders(),
  });
  return readData<ClaimableItemsResponse>(response, 'Unable to load the products you can claim.');
}

export interface SubmitClaimInput {
  orderNo: string;
  reason: ClaimReason;
  description: string;
  contactPhone: string;
  items: Array<{ order_item_id: number; quantity: number }>;
  photos: ImagePickerAsset[];
}

export async function submitClaim(input: SubmitClaimInput): Promise<Claim> {
  const body = new FormData();
  body.append('order_no', input.orderNo);
  body.append('reason', input.reason);
  body.append('description', input.description);
  if (input.contactPhone.trim()) body.append('contact_phone', input.contactPhone.trim());
  body.append('items', JSON.stringify(input.items));
  input.photos.forEach((photo, index) => {
    // React Native's FormData accepts this {uri, name, type} shape in place of a Blob.
    body.append('evidence', {
      uri: photo.uri,
      name: photo.fileName || `evidence-${index + 1}.jpg`,
      type: photo.mimeType || 'image/jpeg',
    } as unknown as Blob);
  });

  const response = await apiFetch(`${API_BASE_URL}/api/claims`, {
    method: 'POST',
    headers: await authorizedHeaders(),
    body,
  });
  return readData<Claim>(response, 'Unable to submit the claim. Please try again.');
}

/** Evidence photos are private, so they load through an authenticated request instead of a plain URL. */
export function evidenceImageUrl(claimNumber: string, evidenceId: number): string {
  return `${API_BASE_URL}/api/claims/${encodeURIComponent(claimNumber)}/evidence/${evidenceId}`;
}

export const evidenceImageHeaders = () => authorizedHeaders();
