import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../db/pool.js';
import { withTransaction } from './orderRepository.js';
import { quantityReservingStatuses } from '../types/claim.js';
import type {
  AdminClaim, AdminClaimFilters, AdminClaimHistoryEntry, AdminClaimSummary, Claim, ClaimEvidence,
  ClaimHistoryEntry, ClaimItem, ClaimStats, ClaimStatus, ClaimStatusChange, ClaimSummary,
  ClaimableItem, NewClaim, StoredEvidenceFile,
} from '../types/claim.js';
import type { BusinessType } from '../types/product.js';
import type { OrderStatus } from '../types/order.js';
import type { UserRole } from '../types/user.js';

/** An order the signed-in customer owns, with the units still available to claim. */
export interface ClaimableOrder {
  id: number;
  order_no: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  completed_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: ClaimableItem[];
}

export interface ClaimListPage<T> {
  claims: T[];
  total: number;
}

export interface ClaimRepository {
  findClaimableOrder(orderNo: string, userId: number): Promise<ClaimableOrder | null>;
  create(claim: NewClaim): Promise<string>;
  listForUser(userId: number, status: ClaimStatus | null, limit: number, offset: number): Promise<ClaimListPage<ClaimSummary>>;
  listForOrder(orderId: number, userId: number): Promise<ClaimSummary[]>;
  findForUser(claimNumber: string, userId: number): Promise<Claim | null>;
  findForAdmin(claimNumber: string): Promise<AdminClaim | null>;
  listForAdmin(filters: AdminClaimFilters): Promise<AdminClaimSummary[]>;
  updateStatus(claimNumber: string, change: ClaimStatusChange, changedBy: number, role: UserRole): Promise<boolean>;
  findEvidenceFile(claimNumber: string, evidenceId: number, userId: number | null): Promise<StoredEvidenceFile | null>;
  getStats(): Promise<ClaimStats>;
}

const reserving = quantityReservingStatuses.map(() => '?').join(', ');
const reservingValues = [...quantityReservingStatuses];

interface ClaimableOrderRow extends RowDataPacket {
  id: number;
  order_no: string;
  status: OrderStatus;
  total: number;
  created_at: Date;
  completed_at: Date | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

interface ClaimableItemRow extends RowDataPacket {
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
}

interface ClaimRow extends RowDataPacket {
  id: number;
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: Claim['reason'];
  description: string;
  contact_phone: string | null;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_status: OrderStatus;
  order_total: number;
  order_created_at: Date;
}

interface SummaryRow extends RowDataPacket {
  claim_number: string;
  order_no: string;
  status: ClaimStatus;
  reason: Claim['reason'];
  product_name: string | null;
  business: BusinessType | null;
  business_name: string | null;
  item_count: number;
  created_at: Date;
  updated_at: Date;
  customer_name: string;
  customer_email: string;
}

interface ItemRow extends RowDataPacket {
  order_item_id: number;
  quantity: number;
  product_id: string;
  product_name: string;
  business: BusinessType;
  business_name: string;
  unit_price: number;
}

interface EvidenceRow extends RowDataPacket {
  id: number;
  claim_number: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: Date;
}

interface HistoryRow extends RowDataPacket {
  previous_status: ClaimStatus | null;
  new_status: ClaimStatus;
  changed_by: number | null;
  changed_by_name: string | null;
  changed_by_role: UserRole;
  note: string | null;
  visibility: 'customer' | 'internal';
  created_at: Date;
}

interface StatsRow extends RowDataPacket {
  total_claims: number;
  submitted_claims: number;
  under_review_claims: number;
  approved_claims: number;
  processing_claims: number;
  completed_claims: number;
  rejected_claims: number;
  cancelled_claims: number;
}

interface SequenceRow extends RowDataPacket { value: number; day: string }

const iso = (value: Date) => new Date(value).toISOString();
const isoOrNull = (value: Date | null) => value ? new Date(value).toISOString() : null;

/** Base projection shared by the customer and admin detail queries. */
const claimSelect = `SELECT c.id, c.claim_number, c.status, c.reason, c.description, c.contact_phone,
  c.admin_note, c.created_at, c.updated_at, c.resolved_at,
  o.order_no, o.status AS order_status, o.total AS order_total, o.created_at AS order_created_at,
  o.customer_name, o.customer_email, o.customer_phone
  FROM claims c JOIN orders o ON o.id = c.order_id`;

const summarySelect = `SELECT c.claim_number, o.order_no, c.status, c.reason, c.created_at, c.updated_at,
  o.customer_name, o.customer_email,
  first_item.product_name, first_item.business, first_item.business_name,
  (SELECT COUNT(*) FROM claim_items ci WHERE ci.claim_id = c.id) AS item_count
  FROM claims c
  JOIN orders o ON o.id = c.order_id
  LEFT JOIN claim_items first_item ON first_item.id = (
    SELECT MIN(inner_item.id) FROM claim_items inner_item WHERE inner_item.claim_id = c.id)`;

function mapSummary(row: SummaryRow): ClaimSummary {
  return {
    claim_number: row.claim_number,
    order_no: row.order_no,
    status: row.status,
    reason: row.reason,
    product_name: row.product_name ?? '',
    business: (row.business ?? 'vault') as BusinessType,
    business_name: row.business_name ?? '',
    item_count: Number(row.item_count),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function mapItem(row: ItemRow): ClaimItem {
  const quantity = Number(row.quantity);
  const unitPrice = Number(row.unit_price);
  return {
    order_item_id: Number(row.order_item_id),
    quantity,
    product_id: row.product_id,
    product_name: row.product_name,
    business: row.business,
    business_name: row.business_name,
    unit_price: unitPrice,
    line_total: Math.round(unitPrice * quantity * 100) / 100,
  };
}

function mapEvidence(row: EvidenceRow): ClaimEvidence {
  return {
    id: Number(row.id),
    // Served through the authorised endpoint, never as a static file.
    image_url: `/api/claims/${row.claim_number}/evidence/${row.id}`,
    mime_type: row.mime_type,
    file_size: Number(row.file_size),
    created_at: iso(row.created_at),
  };
}

function mapHistory(row: HistoryRow): AdminClaimHistoryEntry {
  return {
    previous_status: row.previous_status,
    new_status: row.new_status,
    changed_by: row.changed_by === null ? null : Number(row.changed_by),
    changed_by_name: row.changed_by_name,
    changed_by_role: row.changed_by_role,
    note: row.note,
    visibility: row.visibility,
    created_at: iso(row.created_at),
  };
}

/** Drops the fields a customer must not see, including internal-only notes. */
function toCustomerHistory(entries: AdminClaimHistoryEntry[]): ClaimHistoryEntry[] {
  return entries.filter(entry => entry.visibility === 'customer').map(entry => ({
    previous_status: entry.previous_status,
    new_status: entry.new_status,
    changed_by_role: entry.changed_by_role,
    note: entry.note,
    created_at: entry.created_at,
  }));
}

async function loadParts(claimId: number, claimNumber: string) {
  const [items] = await pool.execute<ItemRow[]>(`SELECT order_item_id, quantity, product_id, product_name,
    business, business_name, unit_price FROM claim_items WHERE claim_id = ? ORDER BY id`, [claimId]);
  const [evidence] = await pool.execute<EvidenceRow[]>(`SELECT id, ? AS claim_number, file_name, mime_type,
    file_size, created_at FROM claim_evidence WHERE claim_id = ? ORDER BY id`, [claimNumber, claimId]);
  const [history] = await pool.execute<HistoryRow[]>(`SELECT h.previous_status, h.new_status, h.changed_by,
    u.name AS changed_by_name, h.changed_by_role, h.note, h.visibility, h.created_at
    FROM claim_status_history h LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.claim_id = ? ORDER BY h.created_at, h.id`, [claimId]);
  return {
    items: items.map(mapItem),
    evidence: evidence.map(mapEvidence),
    history: history.map(mapHistory),
  };
}

/**
 * Reserves the next claim number for today. The row lock taken by the upsert plus the
 * connection-scoped LAST_INSERT_ID() make this safe for concurrent submissions.
 */
async function allocateClaimNumber(connection: PoolConnection): Promise<string> {
  await connection.execute(`INSERT INTO claim_number_sequences (sequence_date, last_number)
    VALUES (UTC_DATE(), LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`);
  const [rows] = await connection.query<SequenceRow[]>(
    "SELECT LAST_INSERT_ID() AS value, DATE_FORMAT(UTC_DATE(), '%Y%m%d') AS day",
  );
  const row = rows[0];
  if (!row) throw new Error('Unable to allocate a claim number');
  return `CLM-${row.day}-${String(Number(row.value)).padStart(6, '0')}`;
}

export const claimRepository: ClaimRepository = {
  async findClaimableOrder(orderNo, userId) {
    const [rows] = await pool.execute<ClaimableOrderRow[]>(`SELECT id, order_no, status, total, created_at,
      completed_at, customer_name, customer_email, customer_phone
      FROM orders WHERE order_no = ? AND user_id = ? LIMIT 1`, [orderNo, userId]);
    const row = rows[0];
    if (!row) return null;
    const [items] = await pool.execute<ClaimableItemRow[]>(`SELECT oi.id AS order_item_id, oi.product_id,
      oi.product_name, oi.business, oi.business_name, COALESCE(oi.category, '') AS category,
      COALESCE(oi.image_url, '') AS image_url, oi.unit_price, oi.quantity AS purchased_quantity,
      COALESCE((SELECT SUM(ci.quantity) FROM claim_items ci JOIN claims c ON c.id = ci.claim_id
        WHERE ci.order_item_id = oi.id AND c.status IN (${reserving})), 0) AS claimed_quantity
      FROM order_items oi WHERE oi.order_id = ? ORDER BY oi.id`, [...reservingValues, row.id]);
    return {
      id: Number(row.id),
      order_no: row.order_no,
      status: row.status,
      total: Number(row.total),
      created_at: iso(row.created_at),
      completed_at: isoOrNull(row.completed_at),
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone,
      items: items.map(item => {
        const purchased = Number(item.purchased_quantity);
        const claimed = Number(item.claimed_quantity);
        return {
          order_item_id: Number(item.order_item_id),
          product_id: item.product_id,
          product_name: item.product_name,
          business: item.business,
          business_name: item.business_name,
          category: item.category,
          image_url: item.image_url,
          unit_price: Number(item.unit_price),
          purchased_quantity: purchased,
          claimed_quantity: claimed,
          claimable_quantity: Math.max(0, purchased - claimed),
        };
      }),
    };
  },

  async create(claim) {
    const connection = await pool.getConnection();
    return withTransaction(connection, async () => {
      const claimNumber = await allocateClaimNumber(connection);
      const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO claims (
        claim_number, order_id, user_id, status, reason, description, contact_phone
      ) VALUES (?, ?, ?, 'submitted', ?, ?, ?)`, [
        claimNumber, claim.order_id, claim.user_id, claim.reason, claim.description, claim.contact_phone,
      ]);
      const claimId = result.insertId;
      for (const item of claim.items) {
        await connection.execute(`INSERT INTO claim_items (
          claim_id, order_item_id, quantity, product_id, product_name, business, business_name, unit_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          claimId, item.order_item_id, item.quantity, item.product_id, item.product_name,
          item.business, item.business_name, item.unit_price,
        ]);
      }
      for (const file of claim.evidence) {
        await connection.execute(`INSERT INTO claim_evidence (
          claim_id, file_name, image_url, mime_type, file_size
        ) VALUES (?, ?, ?, ?, ?)`, [
          claimId, file.file_name, file.image_url, file.mime_type, file.file_size,
        ]);
      }
      await connection.execute(`INSERT INTO claim_status_history (
        claim_id, previous_status, new_status, changed_by, changed_by_role, note, visibility
      ) VALUES (?, NULL, 'submitted', ?, 'customer', 'Claim submitted.', 'customer')`, [claimId, claim.user_id]);
      return claimNumber;
    });
  },

  async listForUser(userId, status, limit, offset) {
    const filters = status ? 'WHERE c.user_id = ? AND c.status = ?' : 'WHERE c.user_id = ?';
    const values = status ? [userId, status] : [userId];
    const [rows] = await pool.query<SummaryRow[]>(
      `${summarySelect} ${filters} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );
    const [counts] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM claims c ${filters}`, values);
    return { claims: rows.map(mapSummary), total: Number(counts[0]?.total ?? 0) };
  },

  async listForOrder(orderId, userId) {
    const [rows] = await pool.execute<SummaryRow[]>(
      `${summarySelect} WHERE c.order_id = ? AND c.user_id = ? ORDER BY c.created_at DESC, c.id DESC`,
      [orderId, userId],
    );
    return rows.map(mapSummary);
  },

  async findForUser(claimNumber, userId) {
    const [rows] = await pool.execute<ClaimRow[]>(
      `${claimSelect} WHERE c.claim_number = ? AND c.user_id = ? LIMIT 1`,
      [claimNumber, userId],
    );
    const row = rows[0];
    if (!row) return null;
    const parts = await loadParts(Number(row.id), row.claim_number);
    return {
      claim_number: row.claim_number,
      order_no: row.order_no,
      status: row.status,
      reason: row.reason,
      description: row.description,
      contact_phone: row.contact_phone,
      admin_note: row.admin_note,
      items: parts.items,
      evidence: parts.evidence,
      history: toCustomerHistory(parts.history),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
      resolved_at: isoOrNull(row.resolved_at),
    };
  },

  async findForAdmin(claimNumber) {
    const [rows] = await pool.execute<ClaimRow[]>(`${claimSelect} WHERE c.claim_number = ? LIMIT 1`, [claimNumber]);
    const row = rows[0];
    if (!row) return null;
    const parts = await loadParts(Number(row.id), row.claim_number);
    return {
      claim_number: row.claim_number,
      order_no: row.order_no,
      status: row.status,
      reason: row.reason,
      description: row.description,
      contact_phone: row.contact_phone,
      admin_note: row.admin_note,
      items: parts.items,
      evidence: parts.evidence,
      history: parts.history,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone,
      order_status: row.order_status,
      order_total: Number(row.order_total),
      order_created_at: iso(row.order_created_at),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
      resolved_at: isoOrNull(row.resolved_at),
    };
  },

  async listForAdmin(filters) {
    const conditions: string[] = [];
    const values: Array<string | number> = [];
    if (filters.status) { conditions.push('c.status = ?'); values.push(filters.status); }
    if (filters.business) {
      conditions.push('EXISTS (SELECT 1 FROM claim_items ci WHERE ci.claim_id = c.id AND ci.business = ?)');
      values.push(filters.business);
    }
    if (filters.from) { conditions.push('c.created_at >= ?'); values.push(filters.from); }
    if (filters.to) { conditions.push('c.created_at < ?'); values.push(filters.to); }
    if (filters.search) {
      conditions.push(`(c.claim_number LIKE ? OR o.order_no LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)`);
      const needle = `%${filters.search}%`;
      values.push(needle, needle, needle, needle);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query<SummaryRow[]>(
      `${summarySelect} ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT 500`,
      values,
    );
    return rows.map(row => ({
      ...mapSummary(row),
      customer_name: row.customer_name,
      customer_email: row.customer_email,
    }));
  },

  async updateStatus(claimNumber, change, changedBy, role) {
    const connection = await pool.getConnection();
    return withTransaction(connection, async () => {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, status FROM claims WHERE claim_number = ? FOR UPDATE',
        [claimNumber],
      );
      const current = rows[0];
      if (!current) return false;
      const resolved = change.status === 'completed' || change.status === 'rejected' || change.status === 'cancelled';
      const assignments = ['status = ?', `resolved_at = ${resolved ? 'CURRENT_TIMESTAMP' : 'NULL'}`];
      const values: Array<string | number | null> = [change.status];
      if (change.admin_note !== undefined) { assignments.push('admin_note = ?'); values.push(change.admin_note); }
      await connection.execute(
        `UPDATE claims SET ${assignments.join(', ')} WHERE id = ?`,
        [...values, current.id],
      );
      await connection.execute(`INSERT INTO claim_status_history (
        claim_id, previous_status, new_status, changed_by, changed_by_role, note, visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        current.id, current.status, change.status, changedBy, role, change.note, change.visibility,
      ]);
      return true;
    });
  },

  async findEvidenceFile(claimNumber, evidenceId, userId) {
    const ownership = userId === null ? '' : 'AND c.user_id = ?';
    const values: Array<string | number> = [claimNumber, evidenceId];
    if (userId !== null) values.push(userId);
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT e.file_name, e.mime_type
      FROM claim_evidence e JOIN claims c ON c.id = e.claim_id
      WHERE c.claim_number = ? AND e.id = ? ${ownership} LIMIT 1`, values);
    const row = rows[0];
    return row ? { file_name: row.file_name, mime_type: row.mime_type } : null;
  },

  async getStats() {
    const [rows] = await pool.query<StatsRow[]>(`SELECT COUNT(*) AS total_claims,
      SUM(status = 'submitted') AS submitted_claims,
      SUM(status = 'under_review') AS under_review_claims,
      SUM(status = 'approved') AS approved_claims,
      SUM(status = 'processing') AS processing_claims,
      SUM(status = 'completed') AS completed_claims,
      SUM(status = 'rejected') AS rejected_claims,
      SUM(status = 'cancelled') AS cancelled_claims
      FROM claims`);
    const row = rows[0];
    const stats = {
      total_claims: Number(row?.total_claims ?? 0),
      submitted_claims: Number(row?.submitted_claims ?? 0),
      under_review_claims: Number(row?.under_review_claims ?? 0),
      approved_claims: Number(row?.approved_claims ?? 0),
      processing_claims: Number(row?.processing_claims ?? 0),
      completed_claims: Number(row?.completed_claims ?? 0),
      rejected_claims: Number(row?.rejected_claims ?? 0),
      cancelled_claims: Number(row?.cancelled_claims ?? 0),
    };
    return {
      ...stats,
      open_claims: stats.submitted_claims + stats.under_review_claims + stats.approved_claims + stats.processing_claims,
    };
  },
};
