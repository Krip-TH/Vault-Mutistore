import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { formatCount, formatTHB } from '../format';
import type { Product } from '../types';
import ProductImage from './ProductImage';
import StockBadge from './StockBadge';

interface Props {
  product: Product;
  onPress: (product: Product) => void;
}

export default function ProductCard({ product, onPress }: Props) {
  const hasPrice = Number.isFinite(product.price);
  const hasStock = Number.isFinite(product.stock);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(product)}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${product.name}`}
    >
      <View style={styles.imageWrap}>
        <ProductImage product={product} />
        <View style={styles.businessPill}>
          <Text style={styles.businessPillText} numberOfLines={1}>{product.business_name}</Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>↗</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.category} numberOfLines={1}>
          {product.category || 'Uncategorized'}
        </Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.meta}>
          <View style={styles.bottomRow}>
            {hasPrice && <Text style={styles.price}>{formatTHB(product.price)}</Text>}
            {hasStock && (
              <Text style={styles.unit}>
                {formatCount(product.stock)} {product.unit}
              </Text>
            )}
          </View>
          <StockBadge status={product.status} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBackground,
    overflow: 'hidden',
  },
  // The web lifts the card and adds a shadow on hover. Touch screens have no
  // hover, so the pressed state stands in for it.
  cardPressed: { borderColor: '#bcc6b4', opacity: 0.92 },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    padding: 20,
    backgroundColor: colors.imageBackground,
  },
  businessPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: '80%',
  },
  businessPillText: { fontSize: 9, color: colors.text },
  arrow: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pill,
  },
  arrowText: { fontSize: 12, color: colors.text },
  info: { padding: 14, flex: 1 },
  category: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.categoryText,
    marginBottom: 8,
  },
  name: { fontSize: 13, lineHeight: 19.5, fontWeight: '500', color: colors.text, minHeight: 39 },
  meta: { marginTop: 'auto', paddingTop: 14 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  price: { fontSize: 16, fontWeight: '500', color: colors.text },
  unit: { fontSize: 10, color: colors.unitText },
});
