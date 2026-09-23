import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchOrder, fetchOrders } from '../api';
import { formatTHB } from '../format';
import { orderStatusLabel } from '../orderStatus';
import { colors, serif } from '../theme';
import type { Order, OrderSummary } from '../types';
import ProductImage from './ProductImage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onSubmitClaim: (orderNo: string) => void;
}

/** A claim needs goods the customer has received. Mirrors backend/src/types/claim.ts's claimableOrderStatuses. */
const claimableOrderStatuses = ['shipped', 'completed'];

const statusColor: Record<string, string> = {
  pending: colors.lowStock,
  confirmed: colors.inStock,
  processing: colors.lowStock,
  shipped: colors.darkGreen,
  completed: colors.inStock,
  cancelled: colors.outOfStock,
};

const dateTimeFormat = (value: string) =>
  new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function OrdersModal({ visible, onClose, onDismiss, onSubmitClaim }: Props) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNo, setSelectedNo] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await fetchOrders());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load order history.');
    } finally {
      setLoading(false);
    }
  }, []);

  const openOrder = useCallback(async (orderNo: string) => {
    setSelectedNo(orderNo);
    setOrder(null);
    setDetailLoading(true);
    setDetailError('');
    try {
      setOrder(await fetchOrder(orderNo));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load this order.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadOrders();
  }, [visible, loadOrders]);

  function backToHistory() {
    setSelectedNo(null);
    setOrder(null);
    setDetailError('');
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={[styles.sheet, { paddingTop: insets.top ? 0 : 12 }]}>
        <View style={styles.topBar}>
          {selectedNo ? (
            <Pressable onPress={backToHistory} hitSlop={8}>
              <Text style={styles.backText}>← All orders</Text>
            </Pressable>
          ) : (
            <Text style={styles.eyebrow}>ORDER HISTORY</Text>
          )}
          <Pressable onPress={onClose} accessibilityLabel="Close orders" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        {selectedNo ? (
          <OrderDetail
            orderNo={selectedNo}
            order={order}
            loading={detailLoading}
            error={detailError}
            onRetry={() => void openOrder(selectedNo)}
            onSubmitClaim={() => onSubmitClaim(selectedNo)}
            insetBottom={insets.bottom}
          />
        ) : (
          <OrderList
            orders={orders}
            loading={loading}
            error={error}
            onRetry={() => void loadOrders()}
            onOpen={orderNo => void openOrder(orderNo)}
            insetBottom={insets.bottom}
          />
        )}
      </View>
    </Modal>
  );
}

function OrderList({ orders, loading, error, onRetry, onOpen, insetBottom }: {
  orders: OrderSummary[]; loading: boolean; error: string; onRetry: () => void;
  onOpen: (orderNo: string) => void; insetBottom: number;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetBottom + 32 }]}>
      <Text style={styles.eyebrowSmall}>YOUR ORDERS</Text>
      <Text style={styles.title}>Order history.</Text>
      <Text style={styles.subtitle}>Review saved orders and open any purchase for its complete details.</Text>

      {loading && (
        <View style={styles.state}>
          <ActivityIndicator color={colors.darkGreen} />
          <Text style={styles.stateTitle}>Gathering your orders…</Text>
        </View>
      )}
      {!loading && !!error && (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>We couldn't load your orders.</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      )}
      {!loading && !error && orders.length === 0 && (
        <View style={styles.state}>
          <Text style={styles.emptyMark}>V.</Text>
          <Text style={styles.stateTitle}>No orders yet.</Text>
          <Text style={styles.stateBody}>Your confirmed purchases will appear here.</Text>
        </View>
      )}
      {!loading && !error && orders.map(summary => (
        <Pressable key={summary.order_no} style={styles.orderRow} onPress={() => onOpen(summary.order_no)}>
          <View style={styles.orderRowPrimary}>
            <Text style={styles.orderRowSmall}>Order number</Text>
            <Text style={styles.orderRowStrong}>{summary.order_no}</Text>
            <Text style={styles.orderRowSmall}>{dateTimeFormat(summary.created_at)}</Text>
          </View>
          <View>
            <Text style={styles.orderRowSmall}>Total</Text>
            <Text style={styles.orderRowStrong}>{formatTHB(summary.total)}</Text>
          </View>
          <View>
            <Text style={styles.orderRowSmall}>Items</Text>
            <Text style={styles.orderRowStrong}>{summary.item_count}</Text>
          </View>
          <View style={styles.orderStatusBadge}>
            <Text style={[styles.orderStatusText, { color: statusColor[summary.status] ?? colors.text }]}>
              {orderStatusLabel(summary.status)}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function OrderDetail({ orderNo, order, loading, error, onRetry, onSubmitClaim, insetBottom }: {
  orderNo: string; order: Order | null; loading: boolean; error: string; onRetry: () => void;
  onSubmitClaim: () => void; insetBottom: number;
}) {
  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.darkGreen} />
        <Text style={styles.stateTitle}>Loading {orderNo}…</Text>
      </View>
    );
  }
  if (error || !order) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>We couldn't load this order.</Text>
        <Text style={styles.stateBody}>{error || 'The saved order was unavailable.'}</Text>
        <Pressable style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const address = [order.shipping.address_line1, order.shipping.address_line2, order.shipping.district,
    order.shipping.province, order.shipping.postal_code, order.shipping.country].filter(Boolean);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insetBottom + 32 }]}>
      <Text style={styles.eyebrowSmall}>ORDER DETAILS</Text>
      <Text style={styles.title}>{order.order_no}</Text>
      <View style={styles.detailHeadingRow}>
        <Text style={styles.subtitle}>{dateTimeFormat(order.created_at)}</Text>
        <View style={styles.orderStatusBadge}>
          <Text style={[styles.orderStatusText, { color: statusColor[order.status] ?? colors.text }]}>
            {orderStatusLabel(order.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Products</Text>
      {order.items.map(item => (
        <View key={`${item.business}-${item.product_id}`} style={styles.productRow}>
          <View style={styles.productImage}><ProductImage product={{ image_url: item.image_url, name: item.product_name, business_name: item.business_name, category: item.category }} /></View>
          <View style={styles.reviewBody}>
            <Text style={styles.orderRowSmall}>{item.business_name}</Text>
            <Text style={styles.orderRowStrong}>{item.product_name}</Text>
            <Text style={styles.stateBody}>{item.category}</Text>
          </View>
          <View style={styles.productFacts}>
            <Text style={styles.orderRowSmall}>Qty {item.quantity}</Text>
            <Text style={styles.orderRowStrong}>{formatTHB(item.line_total)}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Customer</Text>
      <Text style={styles.orderRowStrong}>{order.customer.name}</Text>
      <Text style={styles.stateBody}>{order.customer.email}</Text>
      <Text style={styles.stateBody}>{order.customer.phone}</Text>

      <Text style={styles.sectionTitle}>Shipping address</Text>
      {address.map((part, index) => <Text key={index} style={styles.stateBody}>{part}</Text>)}

      <View style={styles.totals}>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Subtotal</Text><Text style={styles.orderRowSmall}>{formatTHB(order.subtotal)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Shipping</Text><Text style={styles.orderRowSmall}>{formatTHB(order.shipping_fee)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Discount</Text><Text style={styles.orderRowSmall}>−{formatTHB(order.discount)}</Text></View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Grand total</Text>
          <Text style={styles.grandTotalValue}>{formatTHB(order.total)}</Text>
        </View>
      </View>

      {claimableOrderStatuses.includes(order.status) && (
        <View style={styles.claimPanel}>
          <Text style={styles.eyebrowSmall}>CLAIM / WARRANTY</Text>
          <Text style={styles.stateBody}>
            Something arrived wrong? Submit a claim for any product on this order.
          </Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              console.log('[Claim] Submit claim pressed', order.order_no);
              onSubmitClaim();
            }}
          >
            <Text style={styles.secondaryButtonText}>Submit a claim</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  backText: { fontSize: 12, color: colors.text },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  content: { paddingHorizontal: 22 },
  eyebrowSmall: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  title: { fontFamily: serif, fontSize: 26, color: colors.text, marginTop: 8, marginBottom: 6, lineHeight: 32 },
  subtitle: { fontSize: 12, color: colors.muted, marginBottom: 20 },
  state: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  stateTitle: { fontFamily: serif, fontSize: 20, color: colors.text, textAlign: 'center' },
  stateBody: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  emptyMark: { fontFamily: serif, fontSize: 32, color: colors.placeholderMark },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 30, paddingVertical: 14, paddingHorizontal: 26, marginTop: 8 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  orderRow: {
    borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 16, marginBottom: 12,
    flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', alignItems: 'center',
  },
  orderRowPrimary: { flexShrink: 1, gap: 2 },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#eeece4' },
  orderStatusText: { fontSize: 11, fontWeight: '600' },
  detailHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontFamily: serif, fontSize: 18, color: colors.text, marginTop: 22, marginBottom: 12 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  productImage: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.imageBackground },
  reviewBody: { flex: 1, gap: 2 },
  productFacts: { alignItems: 'flex-end', gap: 2 },
  totals: { marginTop: 20, marginBottom: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder, paddingTop: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  grandTotalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  grandTotalLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  grandTotalValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
  claimPanel: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.headerBorder, gap: 10 },
  secondaryButton: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { fontSize: 12, color: colors.text, fontWeight: '500' },
});
