import type { Claim, ClaimHistoryEntry, ClaimReason, ClaimStatus } from './types';

/** Ported from frontend/src/claims/claimStatus.ts. The backend remains the enforcing copy. */
export const claimTransitions: Record<ClaimStatus, ClaimStatus[]> = {
  submitted: ['under_review', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['processing'],
  processing: ['completed'],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const customerCancellableStatuses: ClaimStatus[] = ['submitted', 'under_review'];

const statusLabels: Record<ClaimStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const reasonLabels: Record<ClaimReason, string> = {
  damaged: 'Damaged Product',
  defective: 'Defective Product',
  wrong_item: 'Wrong Product',
  missing_parts: 'Missing Parts',
  other: 'Other',
};

export const claimReasonOptions = (Object.keys(reasonLabels) as ClaimReason[])
  .map(value => ({ value, label: reasonLabels[value] }));

export const claimStatusFilters: Array<{ value: ClaimStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const claimStatusLabel = (status: ClaimStatus) => statusLabels[status] ?? status;
export const claimReasonLabel = (reason: ClaimReason) => reasonLabels[reason] ?? reason;

export function claimStatusColor(status: ClaimStatus, colors: { inStock: string; lowStock: string; outOfStock: string; darkGreen: string; muted: string }): string {
  if (status === 'rejected' || status === 'cancelled') return colors.outOfStock;
  if (status === 'submitted') return colors.lowStock;
  if (status === 'under_review' || status === 'processing') return colors.darkGreen;
  if (status === 'completed' || status === 'approved') return colors.inStock;
  return colors.muted;
}

export const isTerminalClaimStatus = (status: ClaimStatus) => claimTransitions[status].length === 0;
export const canCancelClaim = (status: ClaimStatus) => customerCancellableStatuses.includes(status);

/** The happy path, used only to show what is still ahead of a claim. */
const mainPath: ClaimStatus[] = ['submitted', 'under_review', 'approved', 'processing', 'completed'];

export interface TimelineStep {
  status: ClaimStatus;
  label: string;
  state: 'done' | 'current' | 'upcoming';
  at: string | null;
  note: string | null;
}

/**
 * Builds the visual timeline from the recorded history, so nothing is ever drawn as
 * having happened before it did. Remaining steps are appended as upcoming only.
 */
export function buildClaimTimeline(status: ClaimStatus, history: ClaimHistoryEntry[]): TimelineStep[] {
  const recorded = history.length
    ? history.map(entry => ({ status: entry.new_status, at: entry.created_at, note: entry.note }))
    : [{ status, at: null, note: null }];
  const steps: TimelineStep[] = recorded.map((entry, index) => ({
    status: entry.status,
    label: claimStatusLabel(entry.status),
    state: index === recorded.length - 1 ? 'current' : 'done',
    at: entry.at,
    note: entry.note,
  }));
  if (isTerminalClaimStatus(status)) return steps;
  const index = mainPath.indexOf(status);
  const upcoming = index === -1 ? [] : mainPath.slice(index + 1);
  return [...steps, ...upcoming.map(value => ({
    status: value, label: claimStatusLabel(value), state: 'upcoming' as const, at: null, note: null,
  }))];
}

export const claimTotal = (claim: Pick<Claim, 'items'>) =>
  Math.round(claim.items.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100;

export const claimUnitCount = (claim: Pick<Claim, 'items'>) =>
  claim.items.reduce((sum, item) => sum + item.quantity, 0);
