import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAdminAnalytics, fetchAdminOrder, fetchAdminOrders } from '../../adminApi';
import { useAuth } from '../../auth/AuthContext';
import { colors, serif } from '../../theme';
import type { AdminAnalytics, AdminOrder, AdminOrderSummary, AdminView } from '../../types';
import AdminAnalyticsView from './AdminAnalyticsView';
import AdminBusinessesView from './AdminBusinessesView';
import AdminOrdersView from './AdminOrdersView';
import AdminProductsView from './AdminProductsView';
import AdminUsersView from './AdminUsersView';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const tabs: Array<{ value: AdminView; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'orders', label: 'Orders' },
  { value: 'products', label: 'Products' },
  { value: 'users', label: 'Users' },
  { value: 'businesses', label: 'Businesses' },
];

export default function AdminScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [view, setView] = useState<AdminView>('dashboard');
  const [dashboard, setDashboard] = useState<AdminAnalytics | null>(null);
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setSelectedOrder(null);
    try {
      if (view === 'dashboard') setDashboard(await fetchAdminAnalytics());
      else if (view === 'orders') setOrders(await fetchAdminOrders());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  async function openOrder(orderNo: string) {
    setLoading(true);
    setError('');
    try {
      setSelectedOrder(await fetchAdminOrder(orderNo));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load this order.');
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<AdminView, string> = { dashboard: 'Dashboard', orders: 'Orders', products: 'Products', users: 'Users', businesses: 'Businesses' };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top ? 0 : 12 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>VAULT ADMIN</Text>
            <Text style={styles.title}>{selectedOrder ? selectedOrder.order_no : titles[view]}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close admin" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map(tab => (
            <Pressable
              key={tab.value}
              onPress={() => setView(tab.value)}
              style={[styles.tab, view === tab.value && styles.tabActive]}
            >
              <Text style={[styles.tabText, view === tab.value && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          {loading && <ActivityIndicator color={colors.darkGreen} style={styles.spacer} />}
          {!loading && !!error && (
            <View style={styles.errorState}>
              <Text style={styles.errorTitle}>Unable to load admin data.</Text>
              <Text style={styles.errorBody}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => void load()}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )}
          {!loading && !error && view === 'dashboard' && dashboard && (
            <AdminAnalyticsView data={dashboard} onOpenOrder={orderNo => void openOrder(orderNo)} />
          )}
          {!loading && !error && view === 'orders' && (
            <AdminOrdersView
              orders={orders}
              selected={selectedOrder}
              onOpen={orderNo => void openOrder(orderNo)}
              onBack={() => setSelectedOrder(null)}
              onUpdated={order => {
                setSelectedOrder(order);
                setOrders(current => current.map(item => (item.order_no === order.order_no ? { ...item, status: order.status } : item)));
              }}
            />
          )}
          {!loading && !error && view === 'products' && <AdminProductsView />}
          {!loading && !error && view === 'users' && <AdminUsersView />}
          {!loading && !error && view === 'businesses' && <AdminBusinessesView />}
        </ScrollView>

        {!!user && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
            <Text style={styles.footerText}>{user.name} · Administrator</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  title: { fontFamily: serif, fontSize: 22, color: colors.text, marginTop: 4 },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  tabRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#eeece4' },
  tabActive: { backgroundColor: colors.darkGreen },
  tabText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { padding: 20 },
  spacer: { marginTop: 60 },
  errorState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  errorTitle: { fontFamily: serif, fontSize: 18, color: colors.text },
  errorBody: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  retryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  retryButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  footer: { borderTopWidth: 1, borderTopColor: colors.headerBorder, paddingHorizontal: 20, paddingTop: 10 },
  footerText: { fontSize: 11, color: colors.muted },
});
