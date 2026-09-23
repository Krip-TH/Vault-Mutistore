import type { CartItem, CheckoutForm, CreateOrderRequest } from './types';

/** Ported from frontend/src/checkout/checkout.ts — identical validation rules and copy. */

export const initialCheckoutForm: CheckoutForm = {
  name: '', email: '', phone: '', address_line1: '', address_line2: '',
  district: '', province: '', postal_code: '', country: 'Thailand',
};

export type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>;

export function validateCheckout(form: CheckoutForm): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (!form.name.trim()) errors.name = 'Enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!/^[+\d][\d\s().-]{5,38}$/.test(form.phone.trim())) errors.phone = 'Enter a valid phone number.';
  if (!form.address_line1.trim()) errors.address_line1 = 'Enter your street address.';
  if (!form.district.trim()) errors.district = 'Enter your district or area.';
  if (!form.province.trim()) errors.province = 'Enter your province.';
  if (!form.postal_code.trim()) errors.postal_code = 'Enter your postal code.';
  if (!form.country.trim()) errors.country = 'Enter your country.';
  return errors;
}

export function createOrderRequest(form: CheckoutForm, items: CartItem[]): CreateOrderRequest {
  return {
    customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
    shipping: {
      address_line1: form.address_line1.trim(), address_line2: form.address_line2.trim(),
      district: form.district.trim(), province: form.province.trim(),
      postal_code: form.postal_code.trim(), country: form.country.trim(),
    },
    items: items.map(item => ({ product_id: item.product.id, business: item.product.business, quantity: item.quantity })),
  };
}
