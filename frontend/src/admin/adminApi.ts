import type { AdminDashboardData, AdminOrder, AdminOrderSummary, AdminProduct, AdminProductInput, ProductOptions,ManagedUser,ManagedBusiness } from '../types/admin';
import type { OrderStatus } from '../types/order';

type ErrorResponse = { error?: { message?: string } };

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
  if (payload.data === undefined) throw new Error('The admin response was incomplete.');
  return payload.data;
}
const json=(method:string,body:unknown)=>({method,credentials:'same-origin' as const,headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
export const fetchAdminUsers=async(fetcher:typeof fetch=fetch)=>readData<ManagedUser[]>(await fetcher('/api/admin/users',options),'Unable to load users.');
export const createAdminUser=async(body:unknown,fetcher:typeof fetch=fetch)=>readData<ManagedUser>(await fetcher('/api/admin/users',json('POST',body)),'Unable to create user.');
export const updateAdminUser=async(id:number,body:unknown,fetcher:typeof fetch=fetch)=>readData<ManagedUser>(await fetcher(`/api/admin/users/${id}`,json('PUT',body)),'Unable to update user.');
export async function deleteAdminUser(id:number,fetcher:typeof fetch=fetch){const r=await fetcher(`/api/admin/users/${id}`,{method:'DELETE',credentials:'same-origin'});if(!r.ok)await readData(r,'Unable to delete user.')}
export const fetchAdminBusinesses=async(fetcher:typeof fetch=fetch)=>readData<ManagedBusiness[]>(await fetcher('/api/admin/businesses',options),'Unable to load businesses.');
export const updateAdminBusiness=async(id:number,body:unknown,fetcher:typeof fetch=fetch)=>readData<ManagedBusiness>(await fetcher(`/api/admin/businesses/${id}`,json('PUT',body)),'Unable to update business.');

const options = { credentials: 'same-origin' as const, headers: { Accept: 'application/json' } };

export async function fetchAdminDashboard(fetcher: typeof fetch = fetch) {
  return readData<AdminDashboardData>(await fetcher('/api/admin/dashboard', options), 'Unable to load the dashboard.');
}

export async function fetchAdminOrders(fetcher: typeof fetch = fetch) {
  return readData<AdminOrderSummary[]>(await fetcher('/api/admin/orders', options), 'Unable to load orders.');
}

export async function fetchAdminOrder(orderNo: string, fetcher: typeof fetch = fetch) {
  return readData<AdminOrder>(await fetcher(`/api/admin/orders/${encodeURIComponent(orderNo)}`, options), 'Unable to load this order.');
}

export async function updateAdminOrderStatus(orderNo: string, status: OrderStatus, fetcher: typeof fetch = fetch) {
  return readData<AdminOrder>(await fetcher(`/api/admin/orders/${encodeURIComponent(orderNo)}/status`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }), 'Unable to update the order status.');
}

export async function fetchAdminProducts(fetcher: typeof fetch = fetch) {
  return readData<AdminProduct[]>(await fetcher('/api/admin/products', options), 'Unable to load products.');
}

export async function fetchAdminProductOptions(fetcher: typeof fetch = fetch) {
  return readData<ProductOptions>(await fetcher('/api/admin/product-options', options), 'Unable to load product businesses and categories.');
}

export async function fetchAdminProduct(business: string, id: string, fetcher: typeof fetch = fetch) {
  return readData<AdminProduct>(await fetcher(`/api/admin/products/${encodeURIComponent(business)}/${encodeURIComponent(id)}`, options), 'Unable to load this product.');
}

export async function createAdminProduct(input: AdminProductInput, fetcher: typeof fetch = fetch) {
  return readData<AdminProduct>(await fetcher('/api/admin/products', {
    method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }), 'Unable to create the product.');
}

export async function updateAdminProduct(product: AdminProduct, input: AdminProductInput, fetcher: typeof fetch = fetch) {
  return readData<AdminProduct>(await fetcher(`/api/admin/products/${encodeURIComponent(product.business)}/${encodeURIComponent(product.id)}`, {
    method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }), 'Unable to update the product.');
}

export async function deleteAdminProduct(product: AdminProduct, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`/api/admin/products/${encodeURIComponent(product.business)}/${encodeURIComponent(product.id)}`, {
    method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' },
  });
  if (!response.ok) await readData<never>(response, 'Unable to delete the product.');
}

export async function uploadAdminProductImage(file: File, fetcher: typeof fetch = fetch) {
  const body = new FormData();
  body.append('image', file);
  const data = await readData<{ image_url: string }>(await fetcher('/api/admin/products/upload-image', {
    method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' }, body,
  }), 'Unable to upload the image.');
  if (!data.image_url) throw new Error('The image upload response was incomplete.');
  return data.image_url;
}
