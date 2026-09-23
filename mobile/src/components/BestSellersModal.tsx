import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchBestSellers } from '../api';
import { colors, serif } from '../theme';
import type { BestSeller, Product } from '../types';
import ProductCard from './ProductCard';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export default function BestSellersModal({ visible, onClose, onSelectProduct }: Props) {
  const [items, setItems] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchBestSellers(10));
    } catch (requestError) {
      setItems([]);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load best sellers right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>CUSTOMER FAVOURITES</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close best sellers" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Best Sellers.</Text>
          <Text style={styles.subtitle}>
            Ranked by units sold from completed VAULT orders, paired with today&rsquo;s live product details.
          </Text>

          {loading && (
            <View style={styles.state}>
              <ActivityIndicator color={colors.darkGreen} />
              <Text style={styles.stateTitle}>Gathering the favourites…</Text>
            </View>
          )}
          {!loading && !!error && (
            <View style={styles.state}>
              <Text style={styles.stateTitle}>Best Sellers are taking a moment.</Text>
              <Text style={styles.stateBody}>{error}</Text>
              <Pressable style={styles.primaryButton} onPress={() => void load()}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )}
          {!loading && !error && items.length === 0 && (
            <View style={styles.state}>
              <Text style={styles.emptyMark}>V.</Text>
              <Text style={styles.stateTitle}>No completed sales yet.</Text>
              <Text style={styles.stateBody}>Best Sellers will appear after customer orders are completed.</Text>
            </View>
          )}
          {!loading && !error && items.length > 0 && (
            <View style={styles.grid}>
              {items.map(item => (
                <View style={styles.gridItem} key={`${item.product.business}:${item.product.id}`}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{item.rank}</Text>
                    <Text style={styles.soldText}>{item.units_sold.toLocaleString()} sold</Text>
                  </View>
                  <ProductCard product={item.product} onPress={onSelectProduct} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  title: { fontFamily: serif, fontSize: 26, color: colors.text, marginTop: 4, marginBottom: 6, lineHeight: 32 },
  subtitle: { fontSize: 12, color: colors.muted, marginBottom: 20, lineHeight: 18 },
  state: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  stateTitle: { fontFamily: serif, fontSize: 20, color: colors.text, textAlign: 'center' },
  stateBody: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  emptyMark: { fontFamily: serif, fontSize: 32, color: colors.placeholderMark },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 30, paddingVertical: 14, paddingHorizontal: 26, marginTop: 8 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem: { width: '47%' },
  rankBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  rankText: { fontFamily: serif, fontSize: 16, color: colors.darkGreen },
  soldText: { fontSize: 9, color: colors.muted },
});
