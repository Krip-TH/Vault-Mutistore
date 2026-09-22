import { Router } from 'express';
import { createClaimController, sendClaimUploadError } from '../controllers/claimController.js';
import { requireAuth } from '../middleware/auth.js';
import { claimEvidenceUpload, maxClaimEvidenceFiles } from '../middleware/claimEvidenceUpload.js';
import { claimService } from '../services/claimService.js';
import type { ClaimService } from '../services/claimService.js';

/** Every route is scoped to the signed-in customer; claims are never addressed by user id. */
export function createClaimRouter(service: ClaimService = claimService) {
  const router = Router();
  const controller = createClaimController(service);
  router.use(requireAuth);
  router.post('/', (request, response) => {
    claimEvidenceUpload.array('evidence', maxClaimEvidenceFiles)(request, response, error => {
      if (error) { sendClaimUploadError(response, error); return; }
      void controller.create(request, response);
    });
  });
  router.get('/', controller.list);
  router.get('/:claimNo', controller.get);
  router.post('/:claimNo/cancel', controller.cancel);
  router.get('/:claimNo/evidence/:evidenceId', controller.evidence);
  return router;
}

/** Order-scoped claim lookups, mounted alongside the existing order routes. */
export function createOrderClaimRoutes(service: ClaimService = claimService) {
  const router = Router();
  const controller = createClaimController(service);
  router.use(requireAuth);
  router.get('/:orderNo/warranty-document', controller.warrantyDocument);
  router.get('/:orderNo/claimable-items', controller.claimableItems);
  return router;
}
