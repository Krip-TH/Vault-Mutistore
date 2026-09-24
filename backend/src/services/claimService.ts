import { ApiError } from '../errors/apiError.js';
import { claimRepository } from '../repositories/claimRepository.js';
import type { ClaimRepository, ClaimableOrder } from '../repositories/claimRepository.js';
import {
  claimReasons, claimableOrderStatuses, customerCancellableStatuses, canTransition,
} from '../types/claim.js';
import type {
  Claim, ClaimReason, ClaimStatus, ClaimSummary, ClaimWarrantyDocument, ClaimableItem,
  CreateClaimRequest, NewClaimEvidence, StoredEvidenceFile,
} from '../types/claim.js';
import { claimStatuses } from '../types/claim.js';

export const claimNumberPattern = /^CLM-\d{8}-\d{6}$/;
export const orderNumberPattern = /^MDG-\d{8}-[A-Z0-9]{6}$/;

export const maxClaimDescriptionLength = 2000;
export const maxClaimItemsPerClaim = 20;

/** Days a customer may still raise a claim. 0 disables the window entirely. */
export function claimWindowDays(): number {
  const raw = Number(process.env.CLAIM_WINDOW_DAYS ?? 90);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 90;
}

export interface ClaimServiceDependencies {
  repository: ClaimRepository;
  now: () => Date;
}

const defaultDependencies: ClaimServiceDependencies = {
  repository: claimRepository,
  now: () => new Date(),
};

export interface ClaimListQuery {
  status: ClaimStatus | null;
  page: number;
  pageSize: number;
}

export interface ClaimService {
  getWarrantyDocument(userId: number, orderNo: string): Promise<ClaimWarrantyDocument>;
  getClaimableItems(userId: number, orderNo: string): Promise<{ order_no: string; eligible: boolean; ineligible_reason: string | null; items: ClaimableItem[] }>;
  createClaim(userId: number, payload: unknown, evidence: NewClaimEvidence[]): Promise<Claim>;
  listClaims(userId: number, query: unknown): Promise<{ claims: ClaimSummary[]; total: number; page: number; page_size: number }>;
  getClaim(userId: number, claimNumber: string): Promise<Claim>;
  cancelClaim(userId: number, claimNumber: string, payload: unknown): Promise<Claim>;
  getEvidenceFile(userId: number, claimNumber: string, evidenceId: unknown, asAdmin: boolean): Promise<StoredEvidenceFile>;
}

function authenticatedUserId(userId: number) {
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return userId;
}

function validOrderNumber(orderNo: string) {
  if (!orderNumberPattern.test(orderNo)) throw new ApiError(400, 'INVALID_ORDER_NUMBER', 'Invalid order number.');
  return orderNo;
}

function validClaimNumber(claimNumber: string) {
  if (!claimNumberPattern.test(claimNumber)) throw new ApiError(400, 'INVALID_CLAIM_NUMBER', 'Invalid claim number.');
  return claimNumber;
}

// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/g;

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(controlCharacters, ' ').replace(/[ \t]+/g, ' ').trim() : '';
}

/** The window starts when the order completed, or when it shipped for orders still in transit. */
function windowExpiry(order: ClaimableOrder, days: number): Date | null {
  if (days <= 0) return null;
  const start = new Date(order.completed_at ?? order.created_at);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

interface Eligibility { eligible: boolean; reason: string | null; expiresAt: Date | null }

function evaluateEligibility(order: ClaimableOrder, now: Date, days: number): Eligibility {
  const expiresAt = windowExpiry(order, days);
  if (!claimableOrderStatuses.includes(order.status)) {
    return { eligible: false, expiresAt, reason: 'A claim can only be raised once the order has shipped.' };
  }
  if (expiresAt && now.getTime() > expiresAt.getTime()) {
    return { eligible: false, expiresAt, reason: `The ${days}-day claim window for this order has closed.` };
  }
  if (!order.items.some(item => item.claimable_quantity > 0)) {
    return { eligible: false, expiresAt, reason: 'Every item in this order has already been claimed.' };
  }
  return { eligible: true, expiresAt, reason: null };
}

export function parseCreateClaimRequest(payload: unknown): CreateClaimRequest {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Send the claim details as form fields.');
  }
  const body = payload as Record<string, unknown>;
  const orderNo = validOrderNumber(cleanText(body.order_no).toUpperCase());

  const reason = cleanText(body.reason).toLowerCase() as ClaimReason;
  if (!claimReasons.includes(reason)) throw new ApiError(400, 'INVALID_CLAIM_REASON', 'Select a valid claim reason.');

  const description = cleanText(body.description);
  if (!description) throw new ApiError(400, 'INVALID_DESCRIPTION', 'Describe the problem with the product.');
  if (description.length > maxClaimDescriptionLength) {
    throw new ApiError(400, 'INVALID_DESCRIPTION', `The description must be ${maxClaimDescriptionLength} characters or fewer.`);
  }

  const phone = cleanText(body.contact_phone);
  if (phone && !/^[+\d][\d\s().-]{5,38}$/.test(phone)) {
    throw new ApiError(400, 'INVALID_PHONE', 'Enter a valid contact phone number.');
  }

  // Multipart sends repeated fields as arrays and a single field as a string.
  const rawItems = parseItems(body.items);
  if (rawItems.length < 1 || rawItems.length > maxClaimItemsPerClaim) {
    throw new ApiError(400, 'INVALID_CLAIM_ITEMS', `Select between 1 and ${maxClaimItemsPerClaim} products to claim.`);
  }
  const seen = new Set<number>();
  const items = rawItems.map((value, index) => {
    const item = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const orderItemId = Number(item.order_item_id);
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(orderItemId) || orderItemId < 1) {
      throw new ApiError(400, 'INVALID_CLAIM_ITEMS', `Item ${index + 1} refers to an invalid product.`);
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) {
      throw new ApiError(400, 'INVALID_CLAIM_QUANTITY', `Item ${index + 1} has an invalid claim quantity.`);
    }
    if (seen.has(orderItemId)) {
      throw new ApiError(400, 'DUPLICATE_CLAIM_ITEM', 'Each product can only be listed once on a claim.');
    }
    seen.add(orderItemId);
    return { order_item_id: orderItemId, quantity };
  });

  return { order_no: orderNo, reason, description, contact_phone: phone || null, items };
}

/** Accepts a JSON array, a JSON string (multipart), or repeated `items` form fields. */
function parseItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.map(entry => typeof entry === 'string' ? safeJson(entry) : entry);
  }
  if (typeof value === 'string') {
    const parsed = safeJson(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  throw new ApiError(400, 'INVALID_CLAIM_ITEMS', 'Select at least one product to claim.');
}

function safeJson(value: string): unknown {
  try { return JSON.parse(value); }
  catch { throw new ApiError(400, 'INVALID_CLAIM_ITEMS', 'The selected products could not be read.'); }
}

export function parseClaimListQuery(payload: unknown): ClaimListQuery {
  const query = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
  const rawStatus = cleanText(query.status).toLowerCase();
  if (rawStatus && rawStatus !== 'all' && !claimStatuses.includes(rawStatus as ClaimStatus)) {
    throw new ApiError(400, 'INVALID_CLAIM_STATUS', 'Select a valid claim status.');
  }
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(query.page_size ?? 20)) || 20));
  return { status: rawStatus && rawStatus !== 'all' ? rawStatus as ClaimStatus : null, page, pageSize };
}

export function createClaimService(overrides: Partial<ClaimServiceDependencies> = {}): ClaimService {
  const { repository, now } = { ...defaultDependencies, ...overrides };

  async function requireOrder(userId: number, orderNo: string) {
    // A claim on another customer's order is reported as missing, never as forbidden.
    const order = await repository.findClaimableOrder(validOrderNumber(orderNo), userId);
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    return order;
  }

  async function requireClaim(userId: number, claimNumber: string) {
    const claim = await repository.findForUser(validClaimNumber(claimNumber), userId);
    if (!claim) throw new ApiError(404, 'CLAIM_NOT_FOUND', 'Claim not found.');
    return claim;
  }

  return {
    async getWarrantyDocument(userId, orderNo) {
      const ownerId = authenticatedUserId(userId);
      const order = await requireOrder(ownerId, orderNo);
      const days = claimWindowDays();
      const eligibility = evaluateEligibility(order, now(), days);
      return {
        order_no: order.order_no,
        order_status: order.status,
        order_created_at: order.created_at,
        order_completed_at: order.completed_at,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        items: order.items,
        order_total: order.total,
        claim_window_days: days,
        claim_window_expires_at: eligibility.expiresAt?.toISOString() ?? null,
        eligible: eligibility.eligible,
        ineligible_reason: eligibility.reason,
        existing_claims: await repository.listForOrder(order.id, ownerId),
      };
    },

    async getClaimableItems(userId, orderNo) {
      const order = await requireOrder(authenticatedUserId(userId), orderNo);
      const eligibility = evaluateEligibility(order, now(), claimWindowDays());
      return {
        order_no: order.order_no,
        eligible: eligibility.eligible,
        ineligible_reason: eligibility.reason,
        items: order.items.filter(item => item.claimable_quantity > 0),
      };
    },

    async createClaim(userId, payload, evidence) {
      const ownerId = authenticatedUserId(userId);
      if (!evidence.length) throw new ApiError(400, 'EVIDENCE_REQUIRED', 'Attach at least one photo of the problem.');
      const request = parseCreateClaimRequest(payload);
      const order = await requireOrder(ownerId, request.order_no);
      const eligibility = evaluateEligibility(order, now(), claimWindowDays());
      if (!eligibility.eligible) throw new ApiError(409, 'ORDER_NOT_CLAIMABLE', eligibility.reason ?? 'This order cannot be claimed.');

      const items = request.items.map(requested => {
        const line = order.items.find(item => item.order_item_id === requested.order_item_id);
        if (!line) throw new ApiError(404, 'ORDER_ITEM_NOT_FOUND', 'A selected product is not part of this order.');
        if (requested.quantity > line.claimable_quantity) {
          throw new ApiError(409, 'CLAIM_QUANTITY_EXCEEDED',
            `${line.product_name}: you can claim at most ${line.claimable_quantity} of ${line.purchased_quantity} purchased.`);
        }
        return {
          order_item_id: line.order_item_id,
          quantity: requested.quantity,
          product_id: line.product_id,
          product_name: line.product_name,
          business: line.business,
          business_name: line.business_name,
          unit_price: line.unit_price,
          line_total: Math.round(line.unit_price * requested.quantity * 100) / 100,
        };
      });

      const claimNumber = await repository.create({
        order_id: order.id,
        user_id: ownerId,
        reason: request.reason,
        description: request.description,
        contact_phone: request.contact_phone,
        items,
        evidence,
      });
      return requireClaim(ownerId, claimNumber);
    },

    async listClaims(userId, query) {
      const ownerId = authenticatedUserId(userId);
      const { status, page, pageSize } = parseClaimListQuery(query);
      const result = await repository.listForUser(ownerId, status, pageSize, (page - 1) * pageSize);
      return { claims: result.claims, total: result.total, page, page_size: pageSize };
    },

    async getClaim(userId, claimNumber) {
      return requireClaim(authenticatedUserId(userId), claimNumber);
    },

    async cancelClaim(userId, claimNumber, payload) {
      const ownerId = authenticatedUserId(userId);
      const claim = await requireClaim(ownerId, claimNumber);
      if (!customerCancellableStatuses.includes(claim.status)) {
        throw new ApiError(409, 'CLAIM_NOT_CANCELLABLE', 'This claim can no longer be cancelled.');
      }
      // Belt and braces: the shared state machine must also allow the move.
      if (!canTransition(claim.status, 'cancelled')) {
        throw new ApiError(409, 'INVALID_CLAIM_TRANSITION', 'This claim can no longer be cancelled.');
      }
      const body = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
      const note = cleanText(body.note).slice(0, 500);
      if (!await repository.updateStatus(claim.claim_number, {
        status: 'cancelled',
        note: note || 'Cancelled by the customer.',
        visibility: 'customer',
      }, ownerId, 'customer')) {
        throw new ApiError(404, 'CLAIM_NOT_FOUND', 'Claim not found.');
      }
      return requireClaim(ownerId, claim.claim_number);
    },

    async getEvidenceFile(userId, claimNumber, evidenceId, asAdmin) {
      const ownerId = authenticatedUserId(userId);
      const id = Number(evidenceId);
      if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
      const file = await repository.findEvidenceFile(validClaimNumber(claimNumber), id, asAdmin ? null : ownerId);
      if (!file) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
      return file;
    },
  };
}

export const claimService = createClaimService();
