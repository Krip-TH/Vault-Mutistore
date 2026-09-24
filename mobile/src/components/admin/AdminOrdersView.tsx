import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { updateAdminOrderStatus } from '../../adminApi';
import { formatTHB } from '../../format';
import { colors, serif } from '../../theme';
import type { AdminOrder, AdminOrderSummary, OrderStatus } from '../../types';

const statuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];
const statusLabel = (status: OrderStatus) => (status === 'completed' ? 'Delivered' : status[0].toUpperCase() + status.slice(1));

export function filterAdminOrders(orders: AdminOrderSummary[], query: string, status: 'all' | OrderStatus) {
  const needle = query.trim().toLocaleLowerCase();
  return orders.filter(order => (status === 'all' || order.status === status) && (!needle ||
    order.order_no.toLocaleLowerCase().includes(needle) ||
    order.customer_name.toLocaleLowerCase().includes(needle) ||
    order.customer_email.toLocaleLowerCase().includes(needle)));
}

function orderMetrics(orders: AdminOrderSummary[]) {
  return {
    total: orders.length,
    pending: orders.filter(order => order.status === 'pending').length,
    active: orders.filter(order => ['confirmed', 'processing', 'shipped'].includes(order.status)).length,
    completed: orders.filter(order => order.status === 'completed').length,
    cancelled: orders.filter(order => order.status === 'cancelled').length,
  };
}

interface Props {
  orders: AdminOrderSummary[];
  selected: AdminOrder | null;
  onOpen: (orderNo: string) => void;
  onBack: () => void;
  onUpdated: (order: AdminOrder) => void;
}

export default function AdminOrdersView({ orders, selected, onOpen, onBack, onUpdated }: Props) {
  if (selected) return <AdminOrderDetail order={selected} onBack={onBack} onUpdated={onUpdated} />;
  return <AdminOrderList orders={orders} onOpen={onOpen} />;
}

function AdminOrderList({ orders, onOpen }: { orders: AdminOrderSummary[]; onOpen: (orderNo: string) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const filtered = useMemo(() => filterAdminOrders(orders, query, status), [orders, query, status]);
  const metrics = orderMetrics(orders);

  const metricCards: Array<[string, number]> = [
    ['Total orders', metrics.total], ['Pending', metrics.pending], ['Active', metrics.active],
    ['Delivered', metrics.completed], ['Cancelled', metrics.cancelled],
  ];

  return (
    <View>
      <View style={styles.metricsRow}>
        {metricCards.map(([label, value]) => (
          <View key={label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.eyebrow}>ORDER MANAGEMENT</Text>
      <Text style={styles.title}>All customer orders</Text>
      <Text style={styles.subtitle}>{filtered.length} of {orders.length} orders</Text>

      <TextInput
        style={styles.search}
        placeholder="Search order, customer or email"
        placeholderTextColor="#a3ab9c"
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.statusRow}>
        <Pressable onPress={() => setStatus('all')} style={[styles.statusChip, status === 'all' && styles.statusChipActive]}>
          <Text style={[styles.statusChipText, status === 'all' && styles.statusChipTextActive]}>All</Text>
        </Pressable>
        {statuses.map(value => (
          <Pressable key={value} onPress={() => setStatus(value)} style={[styles.statusChip, status === value && styles.statusChipActive]}>
            <Text style={[styles.statusChipText, status === value && styles.statusChipTextActive]}>{statusLabel(value)}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No orders match these filters.</Text>
      ) : (
        filtered.map(order => (
          <Pressable key={order.order_no} style={styles.orderRow} onPress={() => onOpen(order.order_no)}>
            <View style={styles.orderRowPrimary}>
              <Text style={styles.orderRowStrong}>{order.order_no}</Text>
              <Text style={styles.orderRowSmall}>{order.customer_name}</Text>
              <Text style={styles.orderRowSmall}>{order.customer_email}</Text>
            </View>
            <View style={styles.orderRowFacts}>
              <Text style={styles.orderRowSmall}>{order.item_count} items</Text>
              <Text style={styles.orderRowStrong}>{formatTHB(order.total)}</Text>
              <Text style={[styles.statusBadge, { color: statusColor(order.status) }]}>{statusLabel(order.status)}</Text>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

function AdminOrderDetail({ order, onBack, onUpdated }: { order: AdminOrder; onBack: () => void; onUpdated: (order: AdminOrder) => void }) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const terminal = order.status === 'completed' || order.status === 'cancelled';
  const address = [order.shipping.address_line1, order.shipping.address_line2, order.shipping.district,
    order.shipping.province, order.shipping.postal_code, order.shipping.country].filter(Boolean);

  async function save() {
    setSaving(true);
    setError('');
    try {
      onUpdated(await updateAdminOrderStatus(order.order_no, status));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update the status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Pressable onPress={onBack} hitSlop={8}><Text style={styles.backLink}>← All orders</Text></Pressable>
      <Text style={styles.eyebrow}>ORDER DETAILS</Text>
      <Text style={styles.title}>{order.order_no}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items ordered</Text>
        {order.items.map(item => (
          <View key={`${item.business}-${item.product_id}`} style={styles.itemRow}>
            <View style={styles.reviewBody}>
              <Text style={styles.orderRowSmall}>{item.business_name}</Text>
              <Text style={styles.orderRowStrong}>{item.product_name}</Text>
              <Text style={styles.orderRowSmall}>{item.category}</Text>
            </View>
            <View style={styles.orderRowFacts}>
              <Text style={styles.orderRowSmall}>Qty {item.quantity}</Text>
              <Text style={styles.orderRowStrong}>{formatTHB(item.line_total)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Customer</Text>
        <Text style={styles.orderRowStrong}>{order.customer.name}</Text>
        <Text style={styles.orderRowSmall}>{order.customer.email}</Text>
        <Text style={styles.orderRowSmall}>{order.customer.phone}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shipping address</Text>
        {address.map((part, index) => <Text key={index} style={styles.orderRowSmall}>{part}</Text>)}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <View style={styles.statusRow}>
          {statuses.map(value => (
            <Pressable
              key={value}
              disabled={terminal}
              onPress={() => setStatus(value)}
              style={[styles.statusChip, status === value && styles.statusChipActive, terminal && styles.statusChipDisabled]}
            >
              <Text style={[styles.statusChipText, status === value && styles.statusChipTextActive]}>{statusLabel(value)}</Text>
            </Pressable>
          ))}
        </View>
        {terminal && <Text style={styles.terminalNote}>This is a terminal status and cannot be changed.</Text>}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        <Pressable
          style={[styles.primaryButton, (saving || status === order.status || terminal) && styles.primaryButtonDisabled]}
          disabled={saving || status === order.status || terminal}
          onPress={() => void save()}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Update status</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Totals</Text>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Subtotal</Text><Text style={styles.orderRowSmall}>{formatTHB(order.subtotal)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Shipping</Text><Text style={styles.orderRowSmall}>{formatTHB(order.shipping_fee)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.orderRowSmall}>Discount</Text><Text style={styles.orderRowSmall}>−{formatTHB(order.discount)}</Text></View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>{formatTHB(order.total)}</Text>
        </View>
      </View>
    </View>
  );
}

function statusColor(status: OrderStatus): string {
  if (status === 'cancelled') return colors.outOfStock;
  if (status === 'completed') return colors.inStock;
  if (status === 'pending') return colors.lowStock;
  return colors.darkGreen;
}

const styles = StyleSheet.create({
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
  statusChipDisabled: { opacity: 0.5 },
  statusChipText: { fontSize: 10, color: colors.text },
  statusChipTextActive: { color: '#fff' },
  emptyText: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 30 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
  orderRowPrimary: { flexShrink: 1, gap: 2 },
  orderRowFacts: { alignItems: 'flex-end', gap: 2 },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  statusBadge: { fontSize: 10, fontWeight: '600' },
  backLink: { fontSize: 12, color: colors.text, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { fontFamily: serif, fontSize: 16, color: colors.text, marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  reviewBody: { flex: 1, gap: 2 },
  terminalNote: { fontSize: 11, color: colors.muted, marginBottom: 10 },
  errorText: { fontSize: 12, color: '#8c3f38', marginBottom: 10 },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  grandTotalRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  grandTotalLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  grandTotalValue: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
