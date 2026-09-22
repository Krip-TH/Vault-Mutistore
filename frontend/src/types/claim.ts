import type { BusinessType } from './product';
import type { OrderStatus } from './order';

export type ClaimStatus =
  | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';

export type ClaimReason = 'damaged' | 'defective' | 'wrong_item' | 'missing_parts' | 'other';

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
  changed_by_role: 'customer' | 'admin';
  note: string | null;
  created_at: string;
}

export interface AdminClaimHistoryEntry extends ClaimHistoryEntry {
  changed_by: number | null;
  changed_by_name: string | null;
  visibility: 'customer' | 'internal';
}

export interface Claim {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: ClaimReason;
  description: string;
  contact_phone: string | null;
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
  claim_window_days: number;
  claim_window_expires_at: string | null;
  eligible: boolean;
  ineligible_reason: string | null;
  existing_claims: ClaimSummary[];
}

export interface ClaimableItemsResponse {
  order_no: string;
  eligible: boolean;
  ineligible_reason: string | null;
  items: ClaimableItem[];
}

export interface ClaimListPage {
  claims: ClaimSummary[];
  total: number;
  page: number;
  page_size: number;
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

export interface AdminClaimFilterInput {
  status: ClaimStatus | 'all';
  business: string;
  search: string;
  from: string;
  to: string;
}
