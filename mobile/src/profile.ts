import type { ImagePickerAsset } from 'expo-image-picker';
import type { Profile, ProfileForm } from './types';

/** Ported from frontend/src/profile/profile.ts — identical limits and validation copy. */

export const maxProfileImageBytes = 5 * 1024 * 1024;
export const profileImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

export function profileToForm(profile: Profile): ProfileForm {
  return {
    name: profile.name, phone: profile.phone ?? '', address: profile.address ?? '', city: profile.city ?? '',
    province: profile.province ?? '', postal_code: profile.postal_code ?? '', country: profile.country ?? '',
  };
}

export function validateProfileForm(form: ProfileForm): ProfileErrors {
  const errors: ProfileErrors = {};
  const limits: Array<[keyof ProfileForm, number, string]> = [
    ['name', 160, 'full name'], ['phone', 40, 'phone number'], ['address', 255, 'address'], ['city', 120, 'city'],
    ['province', 120, 'province or state'], ['postal_code', 20, 'postal code'], ['country', 120, 'country'],
  ];
  for (const [field, max, label] of limits) {
    if (form[field].trim().length > max) errors[field] = `The ${label} must be ${max} characters or fewer.`;
    else if (/[<>]/.test(form[field])) errors[field] = `The ${label} contains characters that are not allowed.`;
  }
  const phone = form.phone.trim();
  const postalCode = form.postal_code.trim();
  if (!errors.phone && phone && !/^[+\d][\d\s().-]{5,38}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
  if (!errors.postal_code && postalCode && !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(postalCode)) errors.postal_code = 'Enter a valid postal code.';
  if (!form.name.trim()) errors.name = 'Enter your full name.';
  return errors;
}

/** The web checks a browser File's type/size; the picker gives mimeType/fileSize instead. */
export function validateProfileImage(asset: ImagePickerAsset): string | null {
  const type = asset.mimeType ?? '';
  if (type && !profileImageTypes.includes(type)) return 'Choose a JPEG, PNG, or WEBP image.';
  if (asset.fileSize && asset.fileSize > maxProfileImageBytes) return 'Profile photos must be 5 MB or smaller.';
  return null;
}

export function profileInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function formatMemberSince(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
