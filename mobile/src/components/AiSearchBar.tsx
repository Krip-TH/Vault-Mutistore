import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchProductsWithAi } from '../aiApi';
import { colors, serif } from '../theme';
import type { Product } from '../types';
import ProductCard from './ProductCard';

interface Props {
  onSelectProduct: (product: Product) => void;
}

interface AiResult {
  data: Product[];
  explanation: string;
}

export default function AiSearchBar({ onSelectProduct }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [available, setAvailable] = useState(true);

  if (!available) return null;

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const response = await searchProductsWithAi(trimmed);
      setResult({ data: response.data, explanation: response.explanation });
    } catch {
      // AI features must never break the app: fail silently and hide the widget.
      setResult(null);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery('');
    setResult(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.icon}>✦</Text>
          <TextInput
            style={styles.input}
            placeholder="Try “find a power plug under 500 baht”…"
            placeholderTextColor="#a3ab9c"
            value={query}
            editable={!loading}
            onChangeText={setQuery}
            onSubmitEditing={() => void runSearch()}
            returnKeyType="search"
          />
        </View>
        <Pressable
          style={[styles.submit, (loading || !query.trim()) && styles.submitDisabled]}
          onPress={() => void runSearch()}
          disabled={loading || !query.trim()}
        >
          <Text style={styles.submitText}>{loading ? 'Searching…' : 'Ask AI ✦'}</Text>
        </Pressable>
        {!!result && (
          <Pressable onPress={clear} hitSlop={8}>
            <Text style={styles.clearText}>Clear AI search</Text>
          </Pressable>
        )}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.darkGreen} />
        </View>
      )}

      {!loading && result && (
        <View style={styles.results}>
          <Text style={styles.explanation}>✦ {result.explanation}</Text>
          {result.data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No matches for that search.</Text>
              <Text style={styles.emptyBody}>Try describing the product, price, or business differently.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {result.data.map(product => (
                <View style={styles.gridItem} key={`${product.business}:${product.id}`}>
                  <ProductCard product={product} onPress={onSelectProduct} />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#eef3ec', borderWidth: 1, borderColor: '#d8e2da', borderRadius: 16, padding: 14, marginBottom: 18 },
  form: { gap: 10 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder },
  icon: { fontSize: 16, color: colors.darkGreen, marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 13, color: colors.text },
  submit: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  clearText: { fontSize: 11, color: colors.darkGreen, textDecorationLine: 'underline', textAlign: 'center' },
  loadingRow: { paddingVertical: 20, alignItems: 'center' },
  results: { marginTop: 16 },
  explanation: { fontSize: 12, color: '#3b5541', marginBottom: 12 },
  emptyState: { paddingVertical: 20, alignItems: 'center' },
  emptyTitle: { fontFamily: serif, fontSize: 16, color: colors.text, marginBottom: 6, textAlign: 'center' },
  emptyBody: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47%' },
});
