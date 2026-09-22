import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, serif } from '../theme';
import { formatCount, formatTHB } from '../format';
import type { Product } from '../types';
import ProductImage from './ProductImage';
import StockBadge from './StockBadge';

interface Props {
  product: Product | null;
  onClose: () => void;
}

/**
 * The web uses a native <dialog> with showModal() and a CSS keyframe entrance.
 * React Native has no dialog element, so this is the closest equivalent: a
 * <Modal> with the platform's own slide transition.
 */
export default function ProductDetailModal({ product, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!product) return null;

  const hasPrice = Number.isFinite(product.price);
  const hasStock = Number.isFinite(product.stock);
  const updated = new Date(product.updated_at);
  const validDate = product.updated_at && !Number.isNaN(updated.getTime());

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
