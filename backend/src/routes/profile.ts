import { Router } from 'express';
import { createProfileController, sendProfileUploadError } from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';
import { profileImageUpload } from '../middleware/profileImageUpload.js';
import { profileService } from '../services/profileService.js';
import type { ProfileService } from '../services/profileService.js';

/** Every route acts on the signed-in user only; there is deliberately no :id parameter. */
export function createProfileRouter(service: ProfileService = profileService) {
  const router = Router();
  const controller = createProfileController(service);
  router.use(requireAuth);
  router.get('/', controller.get);
  router.put('/', controller.update);
  router.post('/image', (request, response) => {
    profileImageUpload.single('image')(request, response, error => {
      if (error) { sendProfileUploadError(response, error); return; }
      void controller.uploadImage(request, response);
    });
  });
  router.delete('/image', controller.removeImage);
  return router;
}
