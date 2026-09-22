import { ApiError } from '../errors/apiError.js';
import { claimRepository } from '../repositories/claimRepository.js';
import type { ClaimRepository } from '../repositories/claimRepository.js';
import { claimNumberPattern } from './claimService.js';
import { canTransition, claimStatuses, claimTransitions } from '../types/claim.js';
import type {
  AdminClaim, AdminClaimFilters, AdminClaimSummary, ClaimNoteVisibility, ClaimStats, ClaimStatus,
} from '../types/claim.js';

export const maxAdminNoteLength = 1000;

export interface AdminClaimService {
  listClaims(query: unknown): Promise<AdminClaimSummary[]>;
  getClaim(claimNumber: string): Promise<AdminClaim>;
  updateStatus(claimNumber: string, payload: unknown, adminId: number): Promise<AdminClaim>;
  getStats(): Promise<ClaimStats>;
}

// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/g;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(controlCharacters, ' ').replace(/[ \t]+/g, ' ').trim() : '';
}

function validClaimNumber(claimNumber: string) {
  if (!claimNumberPattern.test(claimNumber)) throw new ApiError(400, 'INVALID_CLAIM_NUMBER', 'Invalid claim number.');
  return claimNumber;
}

/** Accepts YYYY-MM-DD and returns an ISO instant, so both filter ends are unambiguous. */
function boundary(value: string, label: string, endOfDay: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, 'INVALID_DATE', `Enter ${label} as YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'INVALID_DATE', `Enter ${label} as YYYY-MM-DD.`);
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function parseAdminClaimFilters(payload: unknown): AdminClaimFilters {
  const query = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
  const status = cleanText(query.status).toLowerCase();
  if (status && status !== 'all' && !claimStatuses.includes(status as ClaimStatus)) {
    throw new ApiError(400, 'INVALID_CLAIM_STATUS', 'Select a valid claim status.');
  }
  const business = cleanText(query.business).toLowerCase();
  if (business && business !== 'all' && !/^[a-z][a-z0-9_-]{0,49}$/.test(business)) {
    throw new ApiError(400, 'INVALID_BUSINESS', 'Select a valid business.');
  }
  const from = cleanText(query.from);
  const to = cleanText(query.to);
  const search = cleanText(query.search).slice(0, 120);
  return {
    status: status && status !== 'all' ? status as ClaimStatus : null,
    business: business && business !== 'all' ? business : null,
    search: search || null,
    from: from ? boundary(from, 'the start date', false) : null,
    to: to ? boundary(to, 'the end date', true) : null,
  };
}

export interface AdminStatusUpdate {
  status: ClaimStatus;
  note: string | null;
  visibility: ClaimNoteVisibility;
  admin_note?: string | null;
}

export function parseStatusUpdate(payload: unknown): AdminStatusUpdate {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Send the status update as a JSON object.');
  }
  const body = payload as Record<string, unknown>;
  const status = cleanText(body.status).toLowerCase() as ClaimStatus;
  if (!claimStatuses.includes(status)) throw new ApiError(400, 'INVALID_CLAIM_STATUS', 'Select a valid claim status.');

  const visibility = cleanText(body.note_visibility).toLowerCase() || 'customer';
  if (visibility !== 'customer' && visibility !== 'internal') {
    throw new ApiError(400, 'INVALID_NOTE_VISIBILITY', 'A note must be either customer-visible or internal.');
  }
  const note = cleanText(body.note);
  if (note.length > maxAdminNoteLength) {
    throw new ApiError(400, 'INVALID_NOTE', `The note must be ${maxAdminNoteLength} characters or fewer.`);
  }
  const update: AdminStatusUpdate = { status, note: note || null, visibility };

  if (body.admin_note !== undefined) {
    const adminNote = cleanText(body.admin_note);
    if (adminNote.length > maxAdminNoteLength) {
      throw new ApiError(400, 'INVALID_NOTE', `The customer note must be ${maxAdminNoteLength} characters or fewer.`);
    }
    update.admin_note = adminNote || null;
  } else if (visibility === 'customer' && note) {
    // A customer-visible note doubles as the note shown on the customer's claim page.
    update.admin_note = note;
  }
  return update;
}

export function createAdminClaimService(repository: ClaimRepository = claimRepository): AdminClaimService {
  async function getClaim(claimNumber: string) {
    const claim = await repository.findForAdmin(validClaimNumber(claimNumber));
    if (!claim) throw new ApiError(404, 'CLAIM_NOT_FOUND', 'Claim not found.');
    return claim;
  }

  return {
    listClaims: query => repository.listForAdmin(parseAdminClaimFilters(query)),
    getClaim,
    getStats: () => repository.getStats(),

    async updateStatus(claimNumber, payload, adminId) {
      const validNumber = validClaimNumber(claimNumber);
      const update = parseStatusUpdate(payload);
      const current = await getClaim(validNumber);
      if (update.status === current.status) {
        throw new ApiError(409, 'CLAIM_STATUS_UNCHANGED', 'The claim is already in that status.');
      }
      // The state machine is enforced here, not by whichever button the browser rendered.
      if (!canTransition(current.status, update.status)) {
        const allowed = claimTransitions[current.status];
        throw new ApiError(409, 'INVALID_CLAIM_TRANSITION', allowed.length
          ? `A ${current.status} claim can only move to: ${allowed.join(', ')}.`
          : `A ${current.status} claim is final and cannot change status.`);
      }
      if (!await repository.updateStatus(validNumber, update, adminId, 'admin')) {
        throw new ApiError(404, 'CLAIM_NOT_FOUND', 'Claim not found.');
      }
      return getClaim(validNumber);
    },
  };
}

export const adminClaimService = createAdminClaimService();
