import type { Request, Response } from 'express';
import multer from 'multer';
import { ApiError } from '../errors/apiError.js';
import {
  discardUploadedFiles, hasImageSignature, maxClaimEvidenceFiles, resolveEvidencePath,
} from '../middleware/claimEvidenceUpload.js';
import { claimService } from '../services/claimService.js';
import type { ClaimService } from '../services/claimService.js';
import type { NewClaimEvidence } from '../types/claim.js';

/** The customer is always taken from the session, never from the body or the URL. */
function currentUserId(request: Request): number {
  if (!request.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return request.auth.userId;
}

function sendError(response: Response, error: unknown) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  console.error('Claim request failed:', error);
  response.status(500).json({ error: { code: 'CLAIM_FAILED', message: 'Unable to process the claim. Please try again.' } });
}

export function sendClaimUploadError(response: Response, error: unknown) {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    const tooMany = error.code === 'LIMIT_FILE_COUNT';
    response.status(tooLarge ? 413 : 400).json({ error: {
      code: tooLarge ? 'EVIDENCE_TOO_LARGE' : tooMany ? 'TOO_MANY_EVIDENCE_FILES' : 'INVALID_EVIDENCE',
      message: tooLarge ? 'Each photo must be 5 MB or smaller.'
        : tooMany ? `Attach up to ${maxClaimEvidenceFiles} photos.`
          : 'Attach JPEG, PNG, or WEBP photos only.',
    } });
    return;
  }
  sendError(response, error);
}

function uploadedFiles(request: Request): Express.Multer.File[] {
  return Array.isArray(request.files) ? request.files : [];
}

export function createClaimController(service: ClaimService = claimService) {
  return {
    async create(request: Request, response: Response) {
      const files = uploadedFiles(request);
      try {
        const userId = currentUserId(request);
        const evidence: NewClaimEvidence[] = [];
        for (const file of files) {
          // The declared MIME type is client-controlled, so check the bytes too.
          if (!await hasImageSignature(file.path, file.mimetype)) {
            throw new ApiError(400, 'INVALID_EVIDENCE', 'One of the files is not a valid JPEG, PNG, or WEBP image.');
          }
          evidence.push({
            file_name: file.filename,
            image_url: `/uploads/claims/${file.filename}`,
            mime_type: file.mimetype,
            file_size: file.size,
          });
        }
        response.status(201).json({ data: await service.createClaim(userId, request.body, evidence) });
      } catch (error) {
        await discardUploadedFiles(files);
        sendError(response, error);
      }
    },

    async list(request: Request, response: Response) {
      try { response.json({ data: await service.listClaims(currentUserId(request), request.query) }); }
      catch (error) { sendError(response, error); }
    },

    async get(request: Request, response: Response) {
      try { response.json({ data: await service.getClaim(currentUserId(request), String(request.params.claimNo || '')) }); }
      catch (error) { sendError(response, error); }
    },

    async cancel(request: Request, response: Response) {
      try {
        response.json({ data: await service.cancelClaim(currentUserId(request), String(request.params.claimNo || ''), request.body) });
      } catch (error) { sendError(response, error); }
    },

    async warrantyDocument(request: Request, response: Response) {
      try {
        response.json({ data: await service.getWarrantyDocument(currentUserId(request), String(request.params.orderNo || '')) });
      } catch (error) { sendError(response, error); }
    },

    async claimableItems(request: Request, response: Response) {
      try {
        response.json({ data: await service.getClaimableItems(currentUserId(request), String(request.params.orderNo || '')) });
      } catch (error) { sendError(response, error); }
    },

    /** Evidence is private, so it is streamed here after an ownership check instead of served statically. */
    async evidence(request: Request, response: Response) {
      try {
        const userId = currentUserId(request);
        const file = await service.getEvidenceFile(
          userId,
          String(request.params.claimNo || ''),
          request.params.evidenceId,
          request.auth?.role === 'admin',
        );
        const absolutePath = resolveEvidencePath(file.file_name);
        if (!absolutePath) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
        response.type(file.mime_type);
        response.setHeader('Cache-Control', 'private, max-age=300');
        response.setHeader('Content-Disposition', 'inline');
        response.sendFile(absolutePath, error => {
          if (error && !response.headersSent) sendError(response, error);
        });
      } catch (error) { sendError(response, error); }
    },
  };
}
