import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelClaim, evidenceImageHeaders, evidenceImageUrl, fetchClaim, fetchClaims } from '../claimApi';
import {
  buildClaimTimeline, canCancelClaim, claimReasonLabel, claimStatusColor, claimStatusFilters,
  claimStatusLabel, claimTotal, claimUnitCount,
} from '../claimStatus';
import { formatTHB } from '../format';
import { colors, serif } from '../theme';
import type { Claim, ClaimStatus, ClaimSummary } from '../types';

interface Props {
  visible: boolean;
  initialClaimNumber?: string | null;
  onClose: () => void;
}

const dateTimeFormat = (value: string) =>
  new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function MyClaimsModal({ visible, initialClaimNumber, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<ClaimStatus | 'all'>('all');
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadClaims = useCallback(async (value: ClaimStatus | 'all') => {
    setLoading(true);
    setError('');
    try {
      setClaims((await fetchClaims(value)).claims);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load your claims.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openClaim = useCallback(async (claimNumber: string) => {
    setSelectedNumber(claimNumber);
    setClaim(null);
    setDetailLoading(true);
    setDetailError('');
    try {
      setClaim(await fetchClaim(claimNumber));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load this claim.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadClaims(status);
    if (initialClaimNumber) void openClaim(initialClaimNumber);
    else setSelectedNumber(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialClaimNumber]);

  useEffect(() => {
    if (visible) void loadClaims(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function backToList() {
    setSelectedNumber(null);
    setClaim(null);
    setDetailError('');
    void loadClaims(status);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top ? 0 : 12 }]}>
        <View style={styles.topBar}>
          {selectedNumber ? (
            <Pressable onPress={backToList} hitSlop={8}>
              <Text style={styles.backText}>← All claims</Text>
            </Pressable>
          ) : (
            <Text style={styles.eyebrow}>MY CLAIMS</Text>
          )}
          <Pressable onPress={onClose} accessibilityLabel="Close claims" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        {selectedNumber ? (
          <ClaimDetail
            claimNumber={selectedNumber}
            claim={claim}
            loading={detailLoading}
            error={detailError}
            onRetry={() => void openClaim(selectedNumber)}
            onChanged={setClaim}
            insetBottom={insets.bottom}
          />
        ) : (
          <ClaimList
            claims={claims}
            loading={loading}
            error={error}
            status={status}
            onStatusChange={setStatus}
            onRetry={() => void loadClaims(status)}
            onOpen={claimNumber => void openClaim(claimNumber)}
            insetBottom={insets.bottom}
          />
        )}
      </View>
    </Modal>
  );
}

function ClaimList({ claims, loading, error, status, onStatusChange, onRetry, onOpen, insetBottom }: {
  claims: ClaimSummary[]; loading: boolean; error: string; status: ClaimStatus | 'all';
  onStatusChange: (status: ClaimStatus | 'all') => void; onRetry: () => void; onOpen: (claimNumber: string) => void;
  insetBottom: number;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetBottom + 32 }]}>
      <Text style={styles.eyebrowSmall}>AFTER-SALES</Text>
      <Text style={styles.title}>My claims.</Text>
      <Text style={styles.subtitle}>Every claim you have raised, with its current status and full progress history.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {claimStatusFilters.map(filter => (
          <Pressable key={filter.value} onPress={() => onStatusChange(filter.value)} style={[styles.chip, status === filter.value && styles.chipActive]}>
            <Text style={[styles.chipText, status === filter.value && styles.chipTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && (
        <View style={styles.state}>
          <ActivityIndicator color={colors.darkGreen} />
          <Text style={styles.stateTitle}>Gathering your claims…</Text>
        </View>
      )}
      {!loading && !!error && (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>We couldn&rsquo;t load your claims.</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      )}
      {!loading && !error && claims.length === 0 && (
        <View style={styles.state}>
          <Text style={styles.emptyMark}>V.</Text>
          <Text style={styles.stateTitle}>{status === 'all' ? 'No claims yet.' : 'No claims with this status.'}</Text>
          <Text style={styles.stateBody}>
            {status === 'all'
              ? 'Open a delivered order under Orders and choose Submit a claim if something is wrong.'
              : 'Try a different status filter to see your other claims.'}
          </Text>
        </View>
      )}
      {!loading && !error && claims.map(summary => (
        <Pressable key={summary.claim_number} style={styles.claimRow} onPress={() => onOpen(summary.claim_number)}>
          <View style={styles.orderRowPrimary}>
            <Text style={styles.orderRowSmall}>Claim number</Text>
            <Text style={styles.orderRowStrong}>{summary.claim_number}</Text>
            <Text style={styles.orderRowSmall}>{dateTimeFormat(summary.created_at)}</Text>
          </View>
          <View>
            <Text style={styles.orderRowSmall}>Order</Text>
            <Text style={styles.orderRowStrong}>{summary.order_no}</Text>
          </View>
          <View style={styles.claimProductCell}>
            <Text style={styles.orderRowSmall}>Product</Text>
            <Text style={styles.orderRowStrong} numberOfLines={1}>
              {summary.product_name}{summary.item_count > 1 ? ` +${summary.item_count - 1} more` : ''}
            </Text>
          </View>
          <View style={styles.orderStatusBadge}>
            <Text style={[styles.orderStatusText, { color: claimStatusColor(summary.status, colors) }]}>
              {claimStatusLabel(summary.status)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ClaimDetail({ claimNumber, claim, loading, error, onRetry, onChanged, insetBottom }: {
  claimNumber: string; claim: Claim | null; loading: boolean; error: string;
  onRetry: () => void; onChanged: (claim: Claim) => void; insetBottom: number;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [evidenceHeaders, setEvidenceHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (claim?.evidence.length) void evidenceImageHeaders().then(setEvidenceHeaders).catch(() => setEvidenceHeaders(null));
  }, [claim]);

  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.darkGreen} />
        <Text style={styles.stateTitle}>Loading {claimNumber}…</Text>
      </View>
    );
  }
  if (error || !claim) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>We couldn&rsquo;t load this claim.</Text>
        <Text style={styles.stateBody}>{error || 'The claim was unavailable.'}</Text>
        <Pressable style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  async function cancel() {
    if (!claim) return;
    setCancelling(true);
    setCancelError('');
    try {
      onChanged(await cancelClaim(claim.claim_number));
      setConfirming(false);
    } catch (requestError) {
      setCancelError(requestError instanceof Error ? requestError.message : 'Unable to cancel this claim.');
    } finally {
      setCancelling(false);
    }
  }

  const timeline = buildClaimTimeline(claim.status, claim.history);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetBottom + 32 }]}>
      <Text style={styles.eyebrowSmall}>CLAIM DETAILS</Text>
      <Text style={styles.title}>{claim.claim_number}</Text>
      <View style={styles.detailHeadingRow}>
        <Text style={styles.subtitle}>{dateTimeFormat(claim.created_at)}</Text>
        <View style={styles.orderStatusBadge}>
          <Text style={[styles.orderStatusText, { color: claimStatusColor(claim.status, colors) }]}>{claimStatusLabel(claim.status)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Claimed products</Text>
      {claim.items.map(item => (
        <View key={item.order_item_id} style={styles.productRow}>
          <View style={styles.reviewBody}>
            <Text style={styles.orderRowSmall}>{item.business_name}</Text>
            <Text style={styles.orderRowStrong}>{item.product_name}</Text>
          </View>
          <View style={styles.productFacts}>
            <Text style={styles.orderRowSmall}>Qty {item.quantity}</Text>
            <Text style={styles.orderRowStrong}>{formatTHB(item.line_total)}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Reported problem</Text>
      <View style={styles.factRow}><Text style={styles.orderRowSmall}>Reason</Text><Text style={styles.orderRowStrong}>{claimReasonLabel(claim.reason)}</Text></View>
      <Text style={[styles.orderRowSmall, styles.descriptionText]}>{claim.description}</Text>
      {!!claim.contact_phone && (
        <View style={styles.factRow}><Text style={styles.orderRowSmall}>Contact phone</Text><Text style={styles.orderRowStrong}>{claim.contact_phone}</Text></View>
      )}

      <Text style={styles.sectionTitle}>Evidence</Text>
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

      {!!claim.admin_note && (
        <View style={styles.noteCard}>
          <Text style={styles.eyebrowSmall}>NOTE FROM VAULT</Text>
          <Text style={styles.orderRowSmall}>{claim.admin_note}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Progress</Text>
      {timeline.map((step, index) => (
        <View key={`${step.status}-${index}`} style={styles.timelineRow}>
          <View style={[styles.timelineDot, step.state === 'upcoming' && styles.timelineDotUpcoming]} />
          <View style={styles.reviewBody}>
            <Text style={[styles.orderRowStrong, step.state === 'upcoming' && styles.timelineUpcomingText]}>{step.label}</Text>
            <Text style={styles.orderRowSmall}>{step.at ? dateTimeFormat(step.at) : 'Not yet reached'}</Text>
            {!!step.note && <Text style={styles.orderRowSmall}>{step.note}</Text>}
          </View>
        </View>
      ))}

      <View style={styles.totals}>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Order</Text><Text style={styles.orderRowSmall}>{claim.order_no}</Text></View>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Units claimed</Text><Text style={styles.orderRowSmall}>{claimUnitCount(claim)}</Text></View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Claimed value</Text>
          <Text style={styles.grandTotalValue}>{formatTHB(claimTotal(claim))}</Text>
        </View>
      </View>

      {canCancelClaim(claim.status) && !confirming && (
        <Pressable style={styles.textButton} onPress={() => setConfirming(true)}>
          <Text style={styles.textButtonText}>Cancel this claim</Text>
        </Pressable>
      )}
      {confirming && (
        <View style={styles.confirmBox}>
          <Text style={styles.orderRowSmall}>Cancelling is permanent and releases the claimed units back to the order.</Text>
          <View style={styles.confirmActions}>
            <Pressable style={styles.primaryButton} disabled={cancelling} onPress={() => void cancel()}>
              {cancelling ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Yes, cancel claim</Text>}
            </Pressable>
            <Pressable style={styles.textButton} disabled={cancelling} onPress={() => setConfirming(false)}>
              <Text style={styles.textButtonText}>Keep claim</Text>
            </Pressable>
          </View>
        </View>
      )}
      {!!cancelError && <Text style={styles.errorText}>{cancelError}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  backText: { fontSize: 12, color: colors.text },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  eyebrowSmall: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  title: { fontFamily: serif, fontSize: 26, color: colors.text, marginTop: 8, marginBottom: 6, lineHeight: 32 },
  subtitle: { fontSize: 12, color: colors.muted, marginBottom: 14 },
  filterRow: { gap: 8, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#eeece4' },
  chipActive: { backgroundColor: colors.darkGreen },
  chipText: { fontSize: 11, color: colors.text },
  chipTextActive: { color: '#fff' },
  state: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  stateTitle: { fontFamily: serif, fontSize: 20, color: colors.text, textAlign: 'center' },
  stateBody: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  emptyMark: { fontFamily: serif, fontSize: 32, color: colors.placeholderMark },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 26, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  claimRow: {
    borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 16, marginBottom: 12,
    flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center',
  },
  orderRowPrimary: { flexShrink: 1, gap: 2 },
  claimProductCell: { flexShrink: 1, gap: 2, maxWidth: '40%' },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#eeece4' },
  orderStatusText: { fontSize: 11, fontWeight: '600' },
  detailHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontFamily: serif, fontSize: 18, color: colors.text, marginTop: 22, marginBottom: 12 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  reviewBody: { flex: 1, gap: 2 },
  productFacts: { alignItems: 'flex-end', gap: 2 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  descriptionText: { marginTop: 8, lineHeight: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.imageBackground },
  photoImage: { width: '100%', height: '100%' },
  photoLoading: { alignItems: 'center', justifyContent: 'center' },
  noteCard: { backgroundColor: '#faf3e6', borderRadius: 10, padding: 12, marginTop: 16, gap: 6 },
  timelineRow: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.darkGreen, marginTop: 4 },
  timelineDotUpcoming: { backgroundColor: colors.cardBorder },
  timelineUpcomingText: { color: colors.muted },
  totals: { marginTop: 20, marginBottom: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder, paddingTop: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  grandTotalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  grandTotalLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  grandTotalValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  textButton: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  textButtonText: { fontSize: 12, color: '#8c3f38', textDecorationLine: 'underline' },
  confirmBox: { backgroundColor: '#faf3e6', borderRadius: 10, padding: 14, marginTop: 8, gap: 10 },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { fontSize: 11, color: '#8c3f38', marginTop: 8, textAlign: 'center' },
});
