import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchRecommendations } from '../aiApi';
import { colors, serif } from '../theme';
import type { Product, RecommendedProduct } from '../types';
import ProductCard from './ProductCard';

interface Props {
  product: Product;
  onSelectProduct: (product: Product) => void;
}

export default function AiRelatedProducts({ product, onSelectProduct }: Props) {
  const [items, setItems] = useState<RecommendedProduct[] | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    setItems(null);
    setAvailable(true);
    fetchRecommendations(product.id, product.business)
      .then(response => { if (active) setItems(response.data); })
      .catch(error => {
        console.warn('[VAULT AI] Related products are unavailable.', error);
        if (active) setAvailable(false);
      });
    return () => { active = false; };
  }, [product.business, product.id]);

  if (!available || (items && items.length === 0)) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>04 / YOU MIGHT ALSO LIKE</Text>
      <Text style={styles.title}>Related picks</Text>
      {!items ? (
        <View style={styles.grid}>
          {Array.from({ length: 2 }, (_, index) => <View key={index} style={styles.skeleton} />)}
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map(item => (
            <View key={`${item.product.business}:${item.product.id}`} style={styles.gridItem}>
              <ProductCard product={item.product} onPress={onSelectProduct} />
              <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#cfd4c6', paddingTop: 24 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  title: { fontFamily: serif, fontSize: 22, color: colors.text, marginTop: 10, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem: { width: '47%' },
  skeleton: { width: '47%', aspectRatio: 0.8, borderRadius: 17, backgroundColor: colors.skeleton },
  reason: { fontSize: 10, color: colors.muted, marginTop: 6, lineHeight: 14 },
});
