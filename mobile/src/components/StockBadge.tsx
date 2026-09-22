import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { StockStatus } from '../types';

const statusColor: Record<StockStatus, string> = {
  'In Stock': colors.inStock,
  'Low Stock': colors.lowStock,
  'Out of Stock': colors.outOfStock,
};

export default function StockBadge({ status }: { status: StockStatus }) {
  const color = statusColor[status];
  if (!color) return null;

  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  label: { fontSize: 10 },
});
