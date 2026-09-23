import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../cart/CartContext';
import { formatTHB } from '../format';
import { colors, serif } from '../theme';
import type { CartItem } from '../types';
import ProductImage from './ProductImage';
import StockBadge from './StockBadge';

interface Props {
  visible: boolean;
  onClose: () => void;
  onExplore: () => void;
  onCheckout: () => void;
}

export default function CartModal({ visible, onClose, onExplore, onCheckout }: Props) {
  const insets = useSafeAreaInsets();
  const cart = useCart();

  const groups = useMemo(() => {
    const grouped = new Map<string, CartItem[]>();
    for (const item of cart.items) {
      const label = item.product.business_name || item.product.business;
      grouped.set(label, [...(grouped.get(label) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [cart.items]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top ? 0 : 12 }]}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>YOUR SELECTION</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close cart" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Cart <Text style={styles.titleCount}>/ {cart.itemCount}</Text></Text>

        {cart.items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>V.</Text></View>
            <Text style={styles.emptyTitle}>Your cart is empty.</Text>
            <Text style={styles.emptyBody}>Explore the collection and find something for your everyday.</Text>
            <Pressable style={styles.primaryButton} onPress={() => { onClose(); onExplore(); }}>
              <Text style={styles.primaryButtonText}>Explore the collection</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.groups}>
              {groups.map(([business, items]) => (
                <View key={business} style={styles.businessGroup}>
                  <View style={styles.businessHeader}>
                    <Text style={styles.businessName}>{business}</Text>
                    <Text style={styles.businessCount}>{items.reduce((sum, item) => sum + item.quantity, 0)}</Text>
                  </View>
                  {items.map(item => <CartLine key={item.key} item={item} />)}
                </View>
              ))}
            </ScrollView>
            <View style={[styles.summary, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total items</Text>
                <Text style={styles.summaryValue}>{cart.itemCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelBold}>Subtotal</Text>
                <Text style={styles.summaryValueBold}>{formatTHB(cart.subtotal)}</Text>
              </View>
              <Text style={styles.summaryNote}>Shipping, discounts and tax are calculated at checkout.</Text>
              {cart.hasUnavailableItems && (
                <Text style={styles.warning}>Remove unavailable products before checkout.</Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  cart.hasUnavailableItems && styles.primaryButtonDisabled,
                ]}
                onPress={() => { onClose(); onCheckout(); }}
                disabled={cart.hasUnavailableItems}
              >
                <Text style={styles.primaryButtonText}>Proceed to checkout</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const cart = useCart();
  const atMaximum = item.quantity >= item.product.stock;
  const unavailable = item.product.stock < 1 || item.product.status === 'Out of Stock';

  return (
    <View style={[styles.line, unavailable && styles.lineUnavailable]}>
      <View style={styles.lineImage}><ProductImage product={item.product} /></View>
      <View style={styles.lineBody}>
        {!!item.product.category && <Text style={styles.lineCategory}>{item.product.category}</Text>}
        <Text style={styles.lineName} numberOfLines={2}>{item.product.name || 'Product'}</Text>
        <Text style={styles.lineUnitPrice}>{formatTHB(item.product.price)} each</Text>
        <StockBadge status={item.product.status} />
        <View style={styles.lineActions}>
          <View style={styles.quantityControl}>
            <Pressable
              onPress={() => cart.setQuantity(item.key, item.quantity - 1)}
              disabled={unavailable || item.quantity <= 1}
              hitSlop={8}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </Pressable>
            <Text style={styles.quantityValue}>{item.quantity}</Text>
            <Pressable
              onPress={() => cart.setQuantity(item.key, item.quantity + 1)}
              disabled={unavailable || atMaximum}
              hitSlop={8}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => cart.removeItem(item.key)} hitSlop={8}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
        {atMaximum && !unavailable && (
          <Text style={styles.lineNote}>Maximum available: {item.product.stock.toLocaleString()} {item.product.unit}</Text>
        )}
        {unavailable && <Text style={styles.lineNote}>Currently unavailable</Text>}
      </View>
      <Text style={styles.lineTotal}>{formatTHB(item.product.price * item.quantity)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  title: { fontFamily: serif, fontSize: 26, color: colors.text, paddingHorizontal: 22, marginTop: 8, marginBottom: 16 },
  titleCount: { fontSize: 16, color: colors.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyMark: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, borderColor: colors.placeholderBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyMarkText: { fontFamily: serif, fontSize: 30, color: colors.placeholderMark },
  emptyTitle: { fontFamily: serif, fontSize: 22, color: colors.text, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 24 },
  groups: { paddingHorizontal: 22, paddingBottom: 16 },
  businessGroup: { marginBottom: 24 },
  businessHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  businessName: { fontSize: 13, fontWeight: '600', color: colors.text },
  businessCount: { fontSize: 12, color: colors.muted },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  lineUnavailable: { opacity: 0.55 },
  lineImage: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.imageBackground },
  lineBody: { flex: 1, gap: 2 },
  lineCategory: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: colors.categoryText },
  lineName: { fontSize: 13, color: colors.text, fontWeight: '500' },
  lineUnitPrice: { fontSize: 11, color: colors.muted },
  lineActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  quantityButtonText: { fontSize: 16, color: colors.text, width: 16, textAlign: 'center' },
  quantityValue: { fontSize: 13, color: colors.text, minWidth: 16, textAlign: 'center' },
  remove: { fontSize: 11, color: '#965b51', textDecorationLine: 'underline' },
  lineNote: { fontSize: 10, color: colors.lowStock, marginTop: 6 },
  lineTotal: { fontSize: 13, fontWeight: '500', color: colors.text },
  summary: { paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 12, color: colors.muted },
  summaryValue: { fontSize: 12, color: colors.text },
  summaryLabelBold: { fontSize: 14, color: colors.text, fontWeight: '600' },
  summaryValueBold: { fontSize: 16, color: colors.text, fontWeight: '600' },
  summaryNote: { fontSize: 11, color: colors.muted, marginTop: 6, marginBottom: 14 },
  warning: { fontSize: 11, color: '#8c3f38', marginBottom: 12 },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 30, paddingVertical: 16, alignItems: 'center' },
  primaryButtonPressed: { backgroundColor: '#3a5745' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
