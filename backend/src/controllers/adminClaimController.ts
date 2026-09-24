import type { Request, Response } from 'express';
import { ApiError } from '../errors/apiError.js';
import { adminClaimService } from '../services/adminClaimService.js';
import type { AdminClaimService } from '../services/adminClaimService.js';

function sendError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Admin claim request failed:', error);
  response.status(500).json({ error: { code: 'ADMIN_CLAIM_FAILED', message: 'Unable to process the claim request.' } });
}

export function createAdminClaimController(service: AdminClaimService = adminClaimService) {
  return {
    async list(request: Request, response: Response) {
      try { response.json({ data: await service.listClaims(request.query) }); }
      catch (error) { sendError(response, error); }
    },
    async stats(_request: Request, response: Response) {
      try { response.json({ data: await service.getStats() }); }
      catch (error) { sendError(response, error); }
    },
    async get(request: Request, response: Response) {
      try { response.json({ data: await service.getClaim(String(request.params.claimNo || '')) }); }
      catch (error) { sendError(response, error); }
    },
    async patchStatus(request: Request, response: Response) {
      try {
        if (!request.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
        response.json({ data: await service.updateStatus(String(request.params.claimNo || ''), request.body, request.auth.userId) });
      } catch (error) { sendError(response, error); }
    },
  };
}
