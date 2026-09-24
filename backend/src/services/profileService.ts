import { ApiError } from '../errors/apiError.js';
import { deleteStoredProfileImage } from '../middleware/profileImageUpload.js';
import { profileRepository } from '../repositories/profileRepository.js';
import type { ProfileRepository } from '../repositories/profileRepository.js';
import { editableProfileFields } from '../types/profile.js';
import type { EditableProfileField, ProfileUpdate, UserProfile } from '../types/profile.js';

/** Keys a customer must never be able to set through the profile API. */
const protectedFields = new Set(['id', 'user_id', 'userId', 'role', 'email', 'password', 'password_hash', 'created_at', 'updated_at', 'profile_image_url']);

interface FieldRule { label: string; max: number; required?: boolean; pattern?: RegExp; message?: string }

const rules: Record<EditableProfileField, FieldRule> = {
  name: { label: 'full name', max: 160, required: true },
  phone: { label: 'phone number', max: 40, pattern: /^[+\d][\d\s().-]{5,38}$/, message: 'Enter a valid phone number.' },
  address: { label: 'address', max: 255 },
  city: { label: 'city', max: 120 },
  province: { label: 'province or state', max: 120 },
  postal_code: { label: 'postal code', max: 20, pattern: /^[A-Za-z0-9][A-Za-z0-9 -]*$/, message: 'Enter a valid postal code.' },
  country: { label: 'country', max: 120 },
};

// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/g;

function invalid(message: string): never {
  throw new ApiError(400, 'INVALID_PROFILE', message);
}

function normalizeField(field: EditableProfileField, value: unknown): string | null {
  const rule = rules[field];
  if (value === null || value === undefined) {
    if (rule.required) invalid('Enter your full name.');
    return null;
  }
  if (typeof value !== 'string') invalid(`Enter a valid ${rule.label}.`);
  const text = value.replace(controlCharacters, ' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    if (rule.required) invalid('Enter your full name.');
    return null;
  }
  if (text.length > rule.max) invalid(`The ${rule.label} must be ${rule.max} characters or fewer.`);
  if (/[<>]/.test(text)) invalid(`The ${rule.label} contains characters that are not allowed.`);
  if (rule.pattern && !rule.pattern.test(text)) invalid(rule.message ?? `Enter a valid ${rule.label}.`);
  return text;
}

export function validateProfileUpdate(payload: unknown): ProfileUpdate {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) invalid('Send the profile fields as a JSON object.');
  const body = payload as Record<string, unknown>;
  const forbidden = Object.keys(body).find(key => protectedFields.has(key));
  if (forbidden) throw new ApiError(400, 'PROTECTED_FIELD', `The ${forbidden} field cannot be changed from the profile.`);

  const update: ProfileUpdate = {};
  for (const field of editableProfileFields) {
    if (body[field] !== undefined) (update as Record<string, string | null>)[field] = normalizeField(field, body[field]);
  }
  if (!Object.keys(update).length) invalid('Provide at least one profile field to update.');
  return update;
}

export interface ProfileServiceDependencies {
  repository: ProfileRepository;
  deleteStoredImage: (imageUrl: string | null | undefined) => Promise<void>;
}

const defaultDependencies: ProfileServiceDependencies = {
  repository: profileRepository,
  deleteStoredImage: deleteStoredProfileImage,
};

export interface ProfileService {
  getProfile(userId: number): Promise<UserProfile>;
  updateProfile(userId: number, payload: unknown): Promise<UserProfile>;
  replaceImage(userId: number, imageUrl: string): Promise<UserProfile>;
  removeImage(userId: number): Promise<UserProfile>;
}

function requireProfile(profile: UserProfile | null): UserProfile {
  if (!profile) throw new ApiError(401, 'UNAUTHENTICATED', 'Your session is no longer valid.');
  return profile;
}

/** Every method takes the user id from the authenticated session; callers must never pass a client-supplied id. */
export function createProfileService(overrides: Partial<ProfileServiceDependencies> = {}): ProfileService {
  const { repository, deleteStoredImage } = { ...defaultDependencies, ...overrides };
  return {
    async getProfile(userId) {
      return requireProfile(await repository.findById(userId));
    },
    async updateProfile(userId, payload) {
      return requireProfile(await repository.update(userId, validateProfileUpdate(payload)));
    },
    async replaceImage(userId, imageUrl) {
      const previous = requireProfile(await repository.findById(userId)).profile_image_url;
      const updated = await repository.setImage(userId, imageUrl);
      if (!updated) {
        await deleteStoredImage(imageUrl);
        return requireProfile(null);
      }
      if (previous && previous !== imageUrl) await deleteStoredImage(previous);
      return updated;
    },
    async removeImage(userId) {
      const previous = requireProfile(await repository.findById(userId)).profile_image_url;
      const updated = requireProfile(await repository.setImage(userId, null));
      await deleteStoredImage(previous);
      return updated;
    },
  };
}

export const profileService = createProfileService();
