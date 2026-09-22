import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, serif } from '../theme';
import { formatCount, formatTHB } from '../format';
import { useCart } from '../cart/CartContext';
import { purchaseState } from '../purchase';
import type { Product } from '../types';
import ProductImage from './ProductImage';
import StockBadge from './StockBadge';

interface Props {
  product: Product | null;
  onClose: () => void;
  onOpenCart: () => void;
}

/**
 * The web uses a native <dialog> with showModal() and a CSS keyframe entrance.
 * React Native has no dialog element, so this is the closest equivalent: a
 * <Modal> with the platform's own slide transition.
 */
export default function ProductDetailModal({ product, onClose, onOpenCart }: Props) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const cartQuantity = product ? cart.quantityFor(product) : 0;
  const purchase = product ? purchaseState(product, cartQuantity, quantity) : null;

  useEffect(() => {
    setQuantity(purchase?.quantity ?? 1);
    setAdded(false);
    // Only reset when the product identity itself changes, not every recompute of purchase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.business, product?.id]);

  if (!product || !purchase) return null;

  const hasPrice = Number.isFinite(product.price);
  const hasStock = Number.isFinite(product.stock);
  const updated = new Date(product.updated_at);
  const validDate = product.updated_at && !Number.isNaN(updated.getTime());

  function addToCart() {
    if (!product || !purchase?.canAdd) return;
    const addedQuantity = cart.addProduct(product, purchase.quantity);
    if (!addedQuantity) return;
    setAdded(true);
    setQuantity(1);
  }

  const buttonLabel = !hasStock
    ? 'Availability unavailable'
    : purchase.stock === 0 || product.status === 'Out of Stock'
      ? 'Out of stock'
      : !hasPrice
        ? 'Price unavailable'
        : purchase.remaining === 0
          ? 'All available stock in cart'
          : 'Add to cart';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top ? 0 : 12 }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.backText}>← Back to collection</Text>
          </Pressable>
          <Pressable onPress={onClose} accessibilityLabel="Close product details" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.imageWrap}>
            <ProductImage product={product} />
          </View>

          <Text style={styles.eyebrow}>
            {[product.business_name, product.category].filter(Boolean).join(' / ')}
          </Text>
          <Text style={styles.name}>{product.name}</Text>
          {hasPrice && (
            <Text style={styles.price}>
              {formatTHB(product.price)} <Text style={styles.currency}>THB</Text>
            </Text>
          )}

          <View style={styles.stockRow}>
            <StockBadge status={product.status} />
            {hasStock && (
              <Text style={styles.stockText}>
                {formatCount(product.stock)} {product.unit} available
              </Text>
            )}
          </View>

          <View style={styles.purchasePanel}>
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.quantityControl}>
                <Pressable
                  onPress={() => setQuantity(value => Math.max(1, value - 1))}
                  disabled={!purchase.canAdd || quantity <= 1}
                  style={styles.quantityButton}
                  hitSlop={8}
                >
                  <Text style={styles.quantityButtonText}>−</Text>
                </Pressable>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <Pressable
                  onPress={() => setQuantity(value => Math.min(purchase.remaining, value + 1))}
                  disabled={!purchase.canAdd || quantity >= purchase.remaining}
                  style={styles.quantityButton}
                  hitSlop={8}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
                (!purchase.canAdd || added) && styles.addButtonDisabled,
              ]}
              onPress={addToCart}
              disabled={!purchase.canAdd || added}
            >
              <Text style={styles.addButtonText}>{added ? 'Added to cart ✓' : buttonLabel}</Text>
            </Pressable>
            {cartQuantity > 0 && (
              <Pressable onPress={onOpenCart} style={styles.inCartRow} hitSlop={8}>
                <Text style={styles.inCartText}>
                  In your cart: {cartQuantity}{hasPrice ? ` · ${formatTHB(product.price * cartQuantity)}` : ''}
                </Text>
                <Text style={styles.inCartLink}>View cart</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>01 / THE PRODUCT</Text>
            <Text style={styles.sectionTitle}>Details</Text>
            {!!product.category && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Category</Text>
                <Text style={styles.factValue}>{product.category}</Text>
              </View>
            )}
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Business</Text>
              <Text style={styles.factValue}>{product.business_name}</Text>
            </View>
            {validDate && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Updated</Text>
                <Text style={styles.factValue}>{updated.toDateString()}</Text>
              </View>
            )}
            <Text style={styles.reference}>Product reference · {product.id}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  backText: { fontSize: 12, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  content: { paddingHorizontal: 22 },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    padding: 24,
    backgroundColor: colors.imageBackground,
    overflow: 'hidden',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.muted,
    marginTop: 24,
  },
  name: { fontFamily: serif, fontSize: 28, lineHeight: 34, color: colors.text, marginTop: 12 },
  price: { fontSize: 22, fontWeight: '500', color: colors.text, marginTop: 14 },
  currency: { fontSize: 12, color: colors.muted },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  stockText: { fontSize: 12, color: colors.muted, marginTop: 10 },
  purchasePanel: { marginTop: 26 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  quantityLabel: { fontSize: 13, color: colors.text },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  quantityButton: { width: 22, alignItems: 'center' },
  quantityButtonText: { fontSize: 18, color: colors.text },
  quantityValue: { fontSize: 14, color: colors.text, minWidth: 20, textAlign: 'center' },
  addButton: {
    backgroundColor: colors.darkGreen,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonPressed: { backgroundColor: '#3a5745' },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  inCartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  inCartText: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  inCartLink: { fontSize: 12, color: colors.darkGreen, fontWeight: '600', textDecorationLine: 'underline' },
  section: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#cfd4c6', paddingTop: 24 },
  sectionEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  sectionTitle: { fontFamily: serif, fontSize: 24, color: colors.text, marginTop: 10, marginBottom: 16 },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.headerBorder,
  },
  factLabel: { fontSize: 12, color: colors.muted },
  factValue: { fontSize: 12, color: colors.text, flexShrink: 1, textAlign: 'right' },
  reference: { fontSize: 9, letterSpacing: 0.8, color: '#899084', marginTop: 18 },
});
