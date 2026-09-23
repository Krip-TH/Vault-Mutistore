import { authorizedHeaders, errorMessage } from './api';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import type {
  AdminAnalytics, AdminClaim, AdminClaimStatusUpdate, AdminClaimSummary, AdminOrder, AdminOrderSummary,
  AdminProduct, AdminProductInput, ManagedBusiness, ManagedUser, ManagedUserInput, OrderStatus, ProductOptions,
} from './types';

async function readData<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await errorMessage(response, fallback));
  const payload = (await response.json()) as { data?: T };
  if (payload.data === undefined) throw new Error('The admin response was incomplete.');
  return payload.data;
}

const base = `${API_BASE_URL}/api/admin`;
const jsonHeaders = () => authorizedHeaders({ 'Content-Type': 'application/json' });

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const response = await fetch(`${base}${path}`, { headers: await authorizedHeaders(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return readData<T>(response, fallback);
}

async function sendJson<T>(path: string, method: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method, headers: await jsonHeaders(), body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readData<T>(response, fallback);
}

// Dashboard / analytics
export const fetchAdminAnalytics = () => getJson<AdminAnalytics>('/analytics', 'Unable to load analytics.');

// Orders
export const fetchAdminOrders = () => getJson<AdminOrderSummary[]>('/orders', 'Unable to load orders.');
export const fetchAdminOrder = (orderNo: string) => getJson<AdminOrder>(`/orders/${encodeURIComponent(orderNo)}`, 'Unable to load this order.');
export const updateAdminOrderStatus = (orderNo: string, status: OrderStatus) =>
  sendJson<AdminOrder>(`/orders/${encodeURIComponent(orderNo)}/status`, 'PATCH', { status }, 'Unable to update the order status.');

// Products
export const fetchAdminProducts = () => getJson<AdminProduct[]>('/products', 'Unable to load products.');
export const fetchAdminProductOptions = () => getJson<ProductOptions>('/product-options', 'Unable to load product businesses and categories.');
export const fetchAdminProduct = (business: string, id: string) =>
  getJson<AdminProduct>(`/products/${encodeURIComponent(business)}/${encodeURIComponent(id)}`, 'Unable to load this product.');
export const createAdminProduct = (input: AdminProductInput) => sendJson<AdminProduct>('/products', 'POST', input, 'Unable to create the product.');
export const updateAdminProduct = (product: AdminProduct, input: AdminProductInput) =>
  sendJson<AdminProduct>(`/products/${encodeURIComponent(product.business)}/${encodeURIComponent(product.id)}`, 'PUT', input, 'Unable to update the product.');

export async function deleteAdminProduct(product: AdminProduct): Promise<void> {
  const response = await fetch(`${base}/products/${encodeURIComponent(product.business)}/${encodeURIComponent(product.id)}`, {
    method: 'DELETE', headers: await authorizedHeaders(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) await readData<never>(response, 'Unable to delete the product.');
}

export async function uploadAdminProductImage(asset: { uri: string; fileName?: string | null; mimeType?: string }): Promise<string> {
  const body = new FormData();
  body.append('image', { uri: asset.uri, name: asset.fileName || 'product.jpg', type: asset.mimeType || 'image/jpeg' } as unknown as Blob);
  const response = await fetch(`${base}/products/upload-image`, {
    method: 'POST', headers: await authorizedHeaders(), body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await readData<{ image_url: string }>(response, 'Unable to upload the image.');
  if (!data.image_url) throw new Error('The image upload response was incomplete.');
  return data.image_url;
}

// Users
export const fetchAdminUsers = () => getJson<ManagedUser[]>('/users', 'Unable to load users.');
export const createAdminUser = (input: ManagedUserInput) => sendJson<ManagedUser>('/users', 'POST', input, 'Unable to create user.');
export const updateAdminUser = (id: number, input: Partial<ManagedUserInput>) => sendJson<ManagedUser>(`/users/${id}`, 'PUT', input, 'Unable to update user.');
export async function deleteAdminUser(id: number): Promise<void> {
  const response = await fetch(`${base}/users/${id}`, { method: 'DELETE', headers: await authorizedHeaders(), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) await readData<never>(response, 'Unable to delete user.');
}

// Businesses
export const fetchAdminBusinesses = () => getJson<ManagedBusiness[]>('/businesses', 'Unable to load businesses.');
export const updateAdminBusiness = (id: number, input: Pick<ManagedBusiness, 'name' | 'api_url' | 'status'>) =>
  sendJson<ManagedBusiness>(`/businesses/${id}`, 'PUT', input, 'Unable to update business.');

// Claims
export const fetchAdminClaims = () => getJson<AdminClaimSummary[]>('/claims', 'Unable to load claims.');
export const fetchAdminClaim = (claimNo: string) => getJson<AdminClaim>(`/claims/${encodeURIComponent(claimNo)}`, 'Unable to load this claim.');
export const updateAdminClaimStatus = (claimNo: string, update: AdminClaimStatusUpdate) =>
  sendJson<AdminClaim>(`/claims/${encodeURIComponent(claimNo)}/status`, 'PATCH', update, 'Unable to update the claim status.');
