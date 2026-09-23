import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchProducts } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import AiSearchBar from '../components/AiSearchBar';
import AdminScreen from '../components/admin/AdminScreen';
import CartModal from '../components/CartModal';
import CheckoutModal from '../components/CheckoutModal';
import OrdersModal from '../components/OrdersModal';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import ProfileModal from '../components/ProfileModal';
import { colors, serif } from '../theme';
import type { BusinessAvailability, BusinessType, Product } from '../types';

const businessOptions: Array<{ value: BusinessType | 'all'; label: string }> = [
  { value: 'all', label: 'All Businesses' },
  { value: 'door', label: 'Door' },
  { value: 'plug', label: 'Plug' },
  { value: 'brandname', label: 'Brandname' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'powerbank', label: 'Powerbank' },
  { value: 'projector', label: 'Projector' },
];

const productKey = (product: Product) => `${product.business}:${product.id}`;

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [availability, setAvailability] = useState<BusinessAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [business, setBusiness] = useState<BusinessType | 'all'>('all');
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchProducts();
      setProducts(result.products);
      setAvailability(result.businesses);
    } catch (requestError) {
      setProducts([]);
      setAvailability([]);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load products.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  // Keeps cart snapshots (price/stock/status) current with the latest fetch, exactly
  // like the web app's `cart.syncProducts(products)` effect.
  useEffect(() => {
    if (!loading && !error) cart.syncProducts(products);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.syncProducts, error, loading, products]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const filtered = useMemo(
    () => (business === 'all' ? products : products.filter(item => item.business === business)),
    [business, products],
  );

  const unavailable = availability.filter(item => item.status === 'unavailable');

  const header = (
    <View>
      <Text style={styles.eyebrow}>EXPLORE VAULT</Text>
      <Text style={styles.title}>Find your next everyday.</Text>
      <Text style={styles.subtitle}>Distinct businesses. Endless possibilities.</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {businessOptions.map(option => {
          const active = business === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setBusiness(option.value)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <AiSearchBar onSelectProduct={setSelected} />

      <Text style={styles.resultsLine}>
        {loading
          ? 'Gathering the collection…'
          : error
            ? 'Collection unavailable'
            : `${filtered.length} of ${products.length} products`}
      </Text>

      {!loading && !error && unavailable.length > 0 && (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Temporarily unavailable: {unavailable.map(item => item.business_name).join(', ')}.
            Available businesses remain browsable.
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.darkGreen} />
        <Text style={styles.loadingText}>Gathering the collection…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>V.</Text>
          </View>
          <Text style={styles.brandName}>VAULT</Text>
        </View>
        <View style={styles.accountGroup}>
          {user?.role === 'admin' && (
            <Pressable onPress={() => setAdminOpen(true)} hitSlop={8}>
              <Text style={styles.adminLinkText}>Admin</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setOrdersOpen(true)} hitSlop={8}>
            <Text style={styles.linkText}>Orders</Text>
          </Pressable>
          <Pressable
            onPress={() => setCartOpen(true)}
            hitSlop={8}
            accessibilityLabel={`Open cart with ${cart.itemCount} items`}
          >
            <Text style={styles.cartText}>Cart · {cart.itemCount}</Text>
          </Pressable>
          <Pressable onPress={() => setProfileOpen(true)} hitSlop={8} accessibilityLabel={user ? `Open profile for ${user.name}` : 'Open profile'}>
            <View style={styles.profileDot}>
              <Text style={styles.profileDotText}>{(user?.name || '?').trim().charAt(0).toUpperCase()}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={productKey}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.darkGreen} />
        }
        renderItem={({ item }) => <ProductCard product={item} onPress={setSelected} />}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEyebrow}>LET'S TRY THAT AGAIN</Text>
              <Text style={styles.emptyTitle}>The collection is taking a moment.</Text>
              <Text style={styles.emptyBody}>{error}</Text>
              <Pressable style={styles.primaryButton} onPress={onRefresh}>
                <Text style={styles.primaryButtonText}>Try again</Text>
                <Text style={styles.primaryButtonText}>↗</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Room for a different discovery.</Text>
              <Text style={styles.emptyBody}>No products match this business filter.</Text>
            </View>
          )
        }
      />

      <ProductDetailModal
        product={selected}
        onClose={() => setSelected(null)}
        onOpenCart={() => { setSelected(null); setCartOpen(true); }}
        onSelectProduct={setSelected}
      />
      <CartModal
        visible={cartOpen}
        onClose={() => setCartOpen(false)}
        onExplore={() => setCartOpen(false)}
        onCheckout={() => setCheckoutOpen(true)}
      />
      <CheckoutModal
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onContinueShopping={() => setCheckoutOpen(false)}
      />
      <OrdersModal visible={ordersOpen} onClose={() => setOrdersOpen(false)} />
      <ProfileModal visible={profileOpen} onClose={() => setProfileOpen(false)} />
      {user?.role === 'admin' && <AdminScreen visible={adminOpen} onClose={() => setAdminOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 12, color: colors.muted },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.headerBorder,
  },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  linkText: { fontSize: 11, color: colors.text, fontWeight: '600' },
  adminLinkText: { fontSize: 11, color: '#8f6846', fontWeight: '700' },
  cartText: { fontSize: 11, color: colors.text, fontWeight: '600' },
  profileDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  profileDotText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { fontFamily: serif, fontSize: 21, color: '#fff' },
  brandName: { fontFamily: serif, fontSize: 21, color: colors.text },
  listContent: { paddingHorizontal: 22, paddingTop: 24 },
  column: { gap: 14, marginBottom: 14 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  title: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1,
    color: colors.text,
    marginTop: 10,
  },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 8 },
  chipRow: { gap: 8, paddingVertical: 18, paddingRight: 22 },
  chip: {
    backgroundColor: colors.chipBackground,
    borderRadius: 25,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: colors.darkGreen },
  chipText: { fontSize: 11, color: colors.chipText },
  chipTextActive: { color: '#fff' },
  resultsLine: { fontSize: 10, color: colors.muted, paddingBottom: 14 },
  note: {
    backgroundColor: '#edece3',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  noteText: { fontSize: 11, lineHeight: 17, color: '#686c5e' },
  emptyState: {
    padding: 40,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    borderRadius: 18,
    alignItems: 'center',
  },
  emptyEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  emptyTitle: {
    fontFamily: serif,
    fontSize: 24,
    color: colors.text,
    marginVertical: 12,
    textAlign: 'center',
  },
  emptyBody: { fontSize: 12, color: '#777c70', textAlign: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: colors.darkGreen,
    paddingHorizontal: 23,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 22,
  },
  primaryButtonText: { color: '#fff', fontSize: 13 },
});
