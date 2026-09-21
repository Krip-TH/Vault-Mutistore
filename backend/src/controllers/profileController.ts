import type { Request, Response } from 'express';
import multer from 'multer';
import { ApiError } from '../errors/apiError.js';
import { discardUploadedFile, hasImageSignature } from '../middleware/profileImageUpload.js';
import type { ProfileService } from '../services/profileService.js';

/** The user is always resolved from the authenticated session (request.auth), never from the request body or URL. */
function currentUserId(request: Request): number {
  if (!request.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return request.auth.userId;
}

function sendError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Profile request failed:', error);
  response.status(500).json({ error: { code: 'PROFILE_FAILED', message: 'Unable to process the request. Please try again.' } });
}

export function sendProfileUploadError(response: Response, error: unknown) {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    response.status(tooLarge ? 413 : 400).json({ error: {
      code: tooLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE',
      message: tooLarge ? 'Profile photos must be 5 MB or smaller.' : 'Upload exactly one JPEG, PNG, or WEBP image.',
    } });
    return;
  }
  sendError(response, error);
}

export function createProfileController(service: ProfileService) {
  return {
    async get(request: Request, response: Response) {
      try {
        response.json({ data: await service.getProfile(currentUserId(request)) });
      } catch (error) { sendError(response, error); }
    },
    async update(request: Request, response: Response) {
      try {
        response.json({ data: await service.updateProfile(currentUserId(request), request.body) });
      } catch (error) { sendError(response, error); }
    },
    async uploadImage(request: Request, response: Response) {
      const file = request.file;
      try {
        const userId = currentUserId(request);
        if (!file) throw new ApiError(400, 'IMAGE_REQUIRED', 'Choose one JPEG, PNG, or WEBP image.');
        if (!await hasImageSignature(file.path, file.mimetype)) {
          throw new ApiError(400, 'INVALID_IMAGE', 'The file is not a valid JPEG, PNG, or WEBP image.');
        }
        response.json({ data: await service.replaceImage(userId, `/uploads/profiles/${file.filename}`) });
      } catch (error) {
        if (file) await discardUploadedFile(file.path);
        sendError(response, error);
      }
    },
    async removeImage(request: Request, response: Response) {
      try {
        response.json({ data: await service.removeImage(currentUserId(request)) });
      } catch (error) { sendError(response, error); }
    },
  };
}
