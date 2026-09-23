import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchAdminClaim, fetchAdminClaims, updateAdminClaimStatus } from '../../adminApi';
import { evidenceImageHeaders, evidenceImageUrl } from '../../claimApi';
import {
  claimReasonLabel, claimStatusLabel, claimTransitions, claimTotal, claimUnitCount, isTerminalClaimStatus,
} from '../../claimStatus';
import { formatTHB } from '../../format';
import { colors, serif } from '../../theme';
import type { AdminClaim, AdminClaimSummary, ClaimNoteVisibility, ClaimStatus } from '../../types';

const statuses: ClaimStatus[] = ['submitted', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled'];

function claimStatusColor(status: ClaimStatus): string {
  if (status === 'rejected' || status === 'cancelled') return colors.outOfStock;
  if (status === 'submitted') return colors.lowStock;
  if (status === 'under_review' || status === 'processing') return colors.darkGreen;
  return colors.inStock;
}

function claimMetrics(claims: AdminClaimSummary[]) {
  return {
    total: claims.length,
    open: claims.filter(claim => ['submitted', 'under_review'].includes(claim.status)).length,
    active: claims.filter(claim => ['approved', 'processing'].includes(claim.status)).length,
    completed: claims.filter(claim => claim.status === 'completed').length,
    closed: claims.filter(claim => ['rejected', 'cancelled'].includes(claim.status)).length,
  };
}

export default function AdminClaimsView() {
  const [claims, setClaims] = useState<AdminClaimSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ClaimStatus | 'all'>('all');
  const [selected, setSelected] = useState<AdminClaim | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setClaims(await fetchAdminClaims());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load claims.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => claims.filter(claim => {
    const query = search.trim().toLowerCase();
    return (!query || `${claim.claim_number} ${claim.order_no} ${claim.customer_name} ${claim.customer_email}`.toLowerCase().includes(query))
      && (status === 'all' || claim.status === status);
  }), [claims, search, status]);

  async function open(claimNumber: string) {
    setError('');
    try {
      setSelected(await fetchAdminClaim(claimNumber));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load this claim.');
    }
  }

  if (loading) return <ActivityIndicator color={colors.darkGreen} style={styles.spacer} />;

  if (selected) {
    return (
      <AdminClaimDetail
        claim={selected}
        onBack={() => { setSelected(null); void load(); }}
        onUpdated={claim => {
          setSelected(claim);
          setClaims(current => current.map(item => (item.claim_number === claim.claim_number ? { ...item, status: claim.status } : item)));
        }}
      />
    );
  }

  const metrics = claimMetrics(claims);

  return (
    <View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Claims shown</Text><Text style={styles.metricValue}>{metrics.total}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Awaiting review</Text><Text style={styles.metricValue}>{metrics.open}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>In progress</Text><Text style={styles.metricValue}>{metrics.active}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Completed</Text><Text style={styles.metricValue}>{metrics.completed}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Rejected / cancelled</Text><Text style={styles.metricValue}>{metrics.closed}</Text></View>
      </View>

      <Text style={styles.eyebrow}>CLAIM MANAGEMENT</Text>
      <Text style={styles.title}>Product claims</Text>
      <Text style={styles.subtitle}>{filtered.length} of {claims.length} claims</Text>

      <TextInput
        style={styles.search}
        placeholder="Search claim, order, customer or email"
        placeholderTextColor="#a3ab9c"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.statusRow}>
        <Pressable onPress={() => setStatus('all')} style={[styles.statusChip, status === 'all' && styles.statusChipActive]}>
          <Text style={[styles.statusChipText, status === 'all' && styles.statusChipTextActive]}>All</Text>
        </Pressable>
        {statuses.map(value => (
          <Pressable key={value} onPress={() => setStatus(value)} style={[styles.statusChip, status === value && styles.statusChipActive]}>
            <Text style={[styles.statusChipText, status === value && styles.statusChipTextActive]}>{claimStatusLabel(value)}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No claims match these filters.</Text>
      ) : (
        filtered.map(claim => (
          <Pressable key={claim.claim_number} style={styles.claimRow} onPress={() => void open(claim.claim_number)}>
            <View style={styles.claimRowPrimary}>
              <Text style={styles.orderRowStrong}>{claim.claim_number}</Text>
              <Text style={styles.orderRowSmall}>{claim.customer_name} · {claim.customer_email}</Text>
              <Text style={styles.orderRowSmall}>
                Order {claim.order_no} · {claim.product_name}{claim.item_count > 1 ? ` +${claim.item_count - 1} more` : ''}
              </Text>
            </View>
            <View style={styles.claimRowFacts}>
              <Text style={styles.orderRowSmall}>{claimReasonLabel(claim.reason)}</Text>
              <Text style={[styles.statusBadge, { color: claimStatusColor(claim.status) }]}>{claimStatusLabel(claim.status)}</Text>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

function AdminClaimDetail({ claim, onBack, onUpdated }: {
  claim: AdminClaim; onBack: () => void; onUpdated: (claim: AdminClaim) => void;
}) {
  const allowed = claimTransitions[claim.status];
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<ClaimNoteVisibility>('customer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [evidenceHeaders, setEvidenceHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => { setStatus(''); setNote(''); setVisibility('customer'); setError(''); }, [claim.claim_number]);
  useEffect(() => {
    if (claim.evidence.length) void evidenceImageHeaders().then(setEvidenceHeaders).catch(() => setEvidenceHeaders(null));
  }, [claim]);

  async function save() {
    if (!status) return;
    setSaving(true);
    setError('');
    try {
      onUpdated(await updateAdminClaimStatus(claim.claim_number, { status, note: note.trim() || undefined, note_visibility: visibility }));
      setStatus('');
      setNote('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update the claim status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Pressable onPress={onBack} hitSlop={8}><Text style={styles.backLink}>← All claims</Text></Pressable>
      <Text style={styles.eyebrow}>CLAIM {claim.claim_number}</Text>
      <Text style={styles.title}>{claimReasonLabel(claim.reason)}</Text>
      <Text style={[styles.statusBadge, { color: claimStatusColor(claim.status) }]}>{claimStatusLabel(claim.status)}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Claimed products</Text>
        {claim.items.map(item => (
          <View key={item.order_item_id} style={styles.itemRow}>
            <View style={styles.reviewBody}>
              <Text style={styles.orderRowSmall}>{item.business_name}</Text>
              <Text style={styles.orderRowStrong}>{item.product_name}</Text>
            </View>
            <View style={styles.claimRowFacts}>
              <Text style={styles.orderRowSmall}>Qty {item.quantity}</Text>
              <Text style={styles.orderRowStrong}>{formatTHB(item.line_total)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reported problem</Text>
        <Text style={styles.orderRowSmall}>{claim.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Evidence ({claim.evidence.length})</Text>
        {claim.evidence.length === 0 ? (
          <Text style={styles.orderRowSmall}>No photos were attached.</Text>
        ) : (
          <View style={styles.photoGrid}>
            {claim.evidence.map((file, index) => (
              <View key={file.id} style={styles.photoItem}>
                {evidenceHeaders ? (
                  <Image
                    source={{ uri: evidenceImageUrl(claim.claim_number, file.id), headers: evidenceHeaders }}
                    style={styles.photoImage}
                    accessibilityLabel={`Evidence ${index + 1}`}
                  />
                ) : (
                  <View style={[styles.photoImage, styles.photoLoading]}><ActivityIndicator color={colors.darkGreen} /></View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Claim history</Text>
        {claim.history.map((entry, index) => (
          <View key={`${entry.created_at}-${index}`} style={styles.historyRow}>
            <Text style={styles.orderRowStrong}>
              {entry.previous_status ? `${claimStatusLabel(entry.previous_status)} → ` : ''}{claimStatusLabel(entry.new_status)}
            </Text>
            <Text style={styles.orderRowSmall}>{entry.changed_by_name ?? 'Removed account'} · {entry.changed_by_role}</Text>
            {!!entry.note && <Text style={styles.orderRowSmall}>{entry.note}</Text>}
            {entry.visibility === 'internal' && <Text style={styles.internalNote}>Internal note — not shown to the customer</Text>}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer</Text>
        <Text style={styles.orderRowStrong}>{claim.customer_name}</Text>
        <Text style={styles.orderRowSmall}>{claim.customer_email}</Text>
        <Text style={styles.orderRowSmall}>{claim.contact_phone || claim.customer_phone}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order</Text>
        <Text style={styles.orderRowStrong}>{claim.order_no}</Text>
        <Text style={styles.orderRowSmall}>{formatTHB(claim.order_total)} · {claim.order_status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Update status</Text>
        {allowed.length === 0 ? (
          <Text style={styles.terminalNote}>{claimStatusLabel(claim.status)} is a final status and cannot be changed.</Text>
        ) : (
          <>
            <View style={styles.statusRow}>
              {allowed.map(value => (
                <Pressable key={value} onPress={() => setStatus(value)} style={[styles.statusChip, status === value && styles.statusChipActive]}>
                  <Text style={[styles.statusChipText, status === value && styles.statusChipTextActive]}>{claimStatusLabel(value)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={note}
              multiline
              numberOfLines={3}
              maxLength={1000}
              placeholder="Evidence verified. Replacement approved."
              placeholderTextColor="#a3ab9c"
              onChangeText={setNote}
            />
            <View style={styles.visibilityRow}>
              <Pressable style={styles.visibilityOption} onPress={() => setVisibility('customer')}>
                <View style={[styles.radio, visibility === 'customer' && styles.radioActive]} />
                <Text style={styles.orderRowSmall}>Customer can read it</Text>
              </Pressable>
              <Pressable style={styles.visibilityOption} onPress={() => setVisibility('internal')}>
                <View style={[styles.radio, visibility === 'internal' && styles.radioActive]} />
                <Text style={styles.orderRowSmall}>Internal only</Text>
              </Pressable>
            </View>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              style={[styles.primaryButton, (saving || !status) && styles.primaryButtonDisabled]}
              disabled={saving || !status}
              onPress={() => void save()}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Update claim</Text>}
            </Pressable>
          </>
        )}
      </View>

      {!!claim.admin_note && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Note the customer sees</Text>
          <Text style={styles.orderRowSmall}>{claim.admin_note}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Totals</Text>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Units claimed</Text><Text style={styles.orderRowSmall}>{claimUnitCount(claim)}</Text></View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Claimed value</Text>
          <Text style={styles.grandTotalValue}>{formatTHB(claimTotal(claim))}</Text>
        </View>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Final</Text><Text style={styles.orderRowSmall}>{isTerminalClaimStatus(claim.status) ? 'Yes' : 'No'}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: { marginTop: 60 },
  errorText: { fontSize: 12, color: '#8c3f38', marginBottom: 12 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  metricCard: { flexGrow: 1, minWidth: '30%', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12 },
  metricLabel: { fontSize: 9, color: colors.muted, marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  title: { fontFamily: serif, fontSize: 20, color: colors.text, marginTop: 6, marginBottom: 4 },
  subtitle: { fontSize: 11, color: colors.muted, marginBottom: 14 },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.text, marginBottom: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#eeece4' },
  statusChipActive: { backgroundColor: colors.darkGreen },
  statusChipText: { fontSize: 10, color: colors.text },
  statusChipTextActive: { color: '#fff' },
  emptyText: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 30 },
  claimRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
  claimRowPrimary: { flexShrink: 1, gap: 2 },
  claimRowFacts: { alignItems: 'flex-end', gap: 4 },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  statusBadge: { fontSize: 11, fontWeight: '600', marginBottom: 10 },
  backLink: { fontSize: 12, color: colors.text, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontFamily: serif, fontSize: 16, color: colors.text, marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  reviewBody: { flex: 1, gap: 2 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.imageBackground },
  photoImage: { width: '100%', height: '100%' },
  photoLoading: { alignItems: 'center', justifyContent: 'center' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.headerBorder, gap: 2 },
  internalNote: { fontSize: 10, color: '#8f6846', fontStyle: 'italic' },
  input: { backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text, marginBottom: 12, minHeight: 70, textAlignVertical: 'top' },
  visibilityRow: { gap: 10, marginBottom: 12 },
  visibilityOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.cardBorder },
  radioActive: { backgroundColor: colors.darkGreen, borderColor: colors.darkGreen },
  terminalNote: { fontSize: 11, color: colors.muted },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  grandTotalRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  grandTotalLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  grandTotalValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
