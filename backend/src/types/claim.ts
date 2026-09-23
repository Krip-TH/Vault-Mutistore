import type { BusinessType } from './product.js';
import type { OrderStatus } from './order.js';
import type { UserRole } from './user.js';

/** Lowercase to match the existing orders.status convention. */
export type ClaimStatus =
  | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';

export type ClaimReason = 'damaged' | 'defective' | 'wrong_item' | 'missing_parts' | 'other';

/** Internal notes are recorded in history but never returned by customer-facing endpoints. */
export type ClaimNoteVisibility = 'customer' | 'internal';

export const claimStatuses = [
  'submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled',
] as const satisfies readonly ClaimStatus[];

export const claimReasons = [
  'damaged', 'defective', 'wrong_item', 'missing_parts', 'other',
] as const satisfies readonly ClaimReason[];

/**
 * The single source of truth for claim transitions. The backend enforces this on every
 * status change; the frontend only uses it to decide which controls to show.
 */
export const claimTransitions: Record<ClaimStatus, readonly ClaimStatus[]> = {
  submitted: ['under_review', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['processing'],
  processing: ['completed'],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const terminalClaimStatuses = claimStatuses.filter(status => !claimTransitions[status].length);

/** A customer may only ever cancel, and only from a non-terminal early stage. */
export const customerCancellableStatuses: readonly ClaimStatus[] = ['submitted', 'under_review'];

/**
 * Statuses that still reserve the claimed units. Rejected and cancelled claims release
 * their quantity so the customer can claim those units again.
 */
export const quantityReservingStatuses: readonly ClaimStatus[] = [
  'submitted', 'under_review', 'approved', 'processing', 'completed',
];

/** Orders a claim may be raised against. A claim needs goods the customer has received. */
export const claimableOrderStatuses: readonly OrderStatus[] = ['shipped', 'completed'];

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return claimTransitions[from].includes(to);
}

export interface ClaimEvidence {
  id: number;
  image_url: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface ClaimItem {
  order_item_id: number;
  quantity: number;
  product_id: string;
  product_name: string;
  business: BusinessType;
  business_name: string;
  unit_price: number;
  line_total: number;
}

export interface ClaimHistoryEntry {
  previous_status: ClaimStatus | null;
  new_status: ClaimStatus;
  changed_by_role: UserRole;
  note: string | null;
  created_at: string;
}

export interface AdminClaimHistoryEntry extends ClaimHistoryEntry {
  changed_by: number | null;
  changed_by_name: string | null;
  visibility: ClaimNoteVisibility;
}

export interface Claim {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
  /** Customer-visible note only. Internal notes never reach this field. */
  admin_note: string | null;
  items: ClaimItem[];
  evidence: ClaimEvidence[];
  history: ClaimHistoryEntry[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ClaimSummary {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  product_name: string;
  business: BusinessType;
  business_name: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminClaimSummary extends ClaimSummary {
  customer_name: string;
  customer_email: string;
}

export interface AdminClaim extends Omit<Claim, 'history'> {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_status: OrderStatus;
  order_total: number;
  order_created_at: string;
  history: AdminClaimHistoryEntry[];
}

/** One purchased line with the units still available to claim. */
export interface ClaimableItem {
  order_item_id: number;
  product_id: string;
  product_name: string;
  business: BusinessType;
  business_name: string;
  category: string;
  image_url: string;
  unit_price: number;
  purchased_quantity: number;
  claimed_quantity: number;
  claimable_quantity: number;
}

/**
 * The warranty document is generated from the order snapshot, not from live catalogue
 * data, so a historical document never changes when a product is later edited.
 */
export interface ClaimWarrantyDocument {
  order_no: string;
  order_status: OrderStatus;
  order_created_at: string;
  order_completed_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: ClaimableItem[];
  order_total: number;
  /** 0 means the warranty window is disabled. */
  claim_window_days: number;
  claim_window_expires_at: string | null;
  eligible: boolean;
  /** Present only when `eligible` is false, explaining why. */
  ineligible_reason: string | null;
  existing_claims: ClaimSummary[];
}

export interface CreateClaimItemRequest {
  order_item_id: number;
  quantity: number;
}

export interface CreateClaimRequest {
  order_no: string;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
  items: CreateClaimItemRequest[];
}

export interface NewClaimEvidence {
  file_name: string;
  image_url: string;
  mime_type: string;
  file_size: number;
}

export interface NewClaim {
  order_id: number;
  user_id: number;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
  items: Array<ClaimItem & { order_item_id: number }>;
  evidence: NewClaimEvidence[];
}

export interface ClaimStatusChange {
  status: ClaimStatus;
  note: string | null;
  visibility: ClaimNoteVisibility;
  /** Replaces claims.admin_note, which the customer can read. */
  admin_note?: string | null;
}

export interface AdminClaimFilters {
  status: ClaimStatus | null;
  business: string | null;
  search: string | null;
  from: string | null;
  to: string | null;
}

export interface ClaimStats {
  total_claims: number;
  submitted_claims: number;
  under_review_claims: number;
  approved_claims: number;
  processing_claims: number;
  completed_claims: number;
  rejected_claims: number;
  cancelled_claims: number;
  open_claims: number;
}

export interface StoredEvidenceFile {
  file_name: string;
  mime_type: string;
}
