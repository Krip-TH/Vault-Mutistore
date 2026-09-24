import type { CheckoutForm } from '../types/order';
import type { Profile, ProfileForm } from '../types/profile';
import { removeProfileImage, updateProfile, uploadProfileImage } from './profileApi';

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

export function validateProfileImage(file: File): string | null {
  if (!profileImageTypes.includes(file.type)) return 'Choose a JPEG, PNG, or WEBP image.';
  if (file.size > maxProfileImageBytes) return 'Profile photos must be 5 MB or smaller.';
  return null;
}

export function profileInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function formatMemberSince(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date);
}

/** Result of saving: the profile as stored, plus a warning when only part of the change could be applied. */
export interface SaveResult { profile: Profile; warning?: string }

export interface SaveRequest {
  form: ProfileForm;
  imageFile: File | null;
  removeImage: boolean;
}

export interface ProfileApi {
  update: typeof updateProfile;
  upload: typeof uploadProfileImage;
  remove: typeof removeProfileImage;
}

export const defaultProfileApi: ProfileApi = { update: updateProfile, upload: uploadProfileImage, remove: removeProfileImage };

/**
 * Saves the text fields first (the likeliest step to fail validation), then applies any photo change.
 * A photo failure after the fields were saved is reported as a warning rather than discarding the saved data.
 */
export async function saveProfileChanges(request: SaveRequest, api: ProfileApi = defaultProfileApi): Promise<SaveResult> {
  let profile = await api.update(request.form);
  if (!request.imageFile && !request.removeImage) return { profile };
  try {
    profile = request.imageFile ? await api.upload(request.imageFile) : await api.remove();
    return { profile };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Please try again.';
    return { profile, warning: `Your details were saved, but your photo could not be updated. ${reason}` };
  }
}

export interface ProfileState {
  profile: Profile | null;
  mode: 'view' | 'edit';
  form: ProfileForm;
  errors: ProfileErrors;
  imageFile: File | null;
  removeImage: boolean;
  saving: boolean;
  error: string;
  notice: string;
}

export type ProfileAction =
  | { type: 'loaded'; profile: Profile }
  | { type: 'edit' }
  | { type: 'change'; field: keyof ProfileForm; value: string }
  | { type: 'chooseImage'; file: File | null }
  | { type: 'removeImage' }
  | { type: 'imageError'; message: string }
  | { type: 'cancel' }
  | { type: 'invalid'; errors: ProfileErrors }
  | { type: 'saving' }
  | { type: 'saved'; result: SaveResult }
  | { type: 'failed'; message: string };

const emptyForm: ProfileForm = { name: '', phone: '', address: '', city: '', province: '', postal_code: '', country: '' };

export const initialProfileState: ProfileState = {
  profile: null, mode: 'view', form: emptyForm, errors: {}, imageFile: null, removeImage: false, saving: false, error: '', notice: '',
};

export function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case 'loaded':
      return { ...initialProfileState, profile: action.profile, form: profileToForm(action.profile) };
    case 'edit':
      if (!state.profile) return state;
      return { ...state, mode: 'edit', form: profileToForm(state.profile), errors: {}, imageFile: null, removeImage: false, error: '', notice: '' };
    case 'change':
      return { ...state, form: { ...state.form, [action.field]: action.value }, errors: { ...state.errors, [action.field]: undefined } };
    case 'chooseImage':
      return { ...state, imageFile: action.file, removeImage: false, error: '' };
    case 'removeImage':
      return { ...state, imageFile: null, removeImage: true, error: '' };
    case 'imageError':
      return { ...state, error: action.message };
    case 'cancel':
      // Discard every unsaved edit and restore the last saved values.
      return { ...state, mode: 'view', form: state.profile ? profileToForm(state.profile) : emptyForm, errors: {}, imageFile: null, removeImage: false, saving: false, error: '', notice: '' };
    case 'invalid':
      return { ...state, errors: action.errors, error: '' };
    case 'saving':
      return { ...state, saving: true, error: '', notice: '' };
    case 'saved':
      return {
        ...initialProfileState, profile: action.result.profile, form: profileToForm(action.result.profile),
        error: action.result.warning ?? '', notice: action.result.warning ? '' : 'Your profile has been updated.',
      };
    case 'failed':
      return { ...state, saving: false, error: action.message };
  }
}

/** Only fills fields the customer has not already typed into, so checkout edits are never overwritten. */
export function applyProfileToCheckout(form: CheckoutForm, profile: Profile, touched: ReadonlySet<keyof CheckoutForm>): CheckoutForm {
  const saved: Partial<Record<keyof CheckoutForm, string | null>> = {
    name: profile.name, email: profile.email, phone: profile.phone, address_line1: profile.address, district: profile.city,
    province: profile.province, postal_code: profile.postal_code, country: profile.country,
  };
  const next = { ...form };
  for (const [field, value] of Object.entries(saved) as Array<[keyof CheckoutForm, string | null]>) {
    if (value && !touched.has(field)) next[field] = value;
  }
  return next;
}
