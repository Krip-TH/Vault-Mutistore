import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, serif } from '../theme';
import type { Product } from '../types';

export default function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);

  if (!product.image_url || failed) {
    return (
      <View style={styles.fallback}>
        <View style={styles.mark}>
          <Text style={styles.markText}>V.</Text>
        </View>
        <Text style={styles.business} numberOfLines={1}>{product.business_name}</Text>
        <Text style={styles.category} numberOfLines={1}>
          {product.category || 'Product collection'}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: product.image_url }}
      style={styles.image}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityLabel={product.name}
    />
  );
}

const styles = StyleSheet.create({
  // The web adds `mix-blend-mode: multiply` here so white product photos melt
  // into the beige tile. React Native has no blend modes, so images with a solid
  // white background will show that white box instead.
  image: { width: '100%', height: '100%' },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 16,
    backgroundColor: '#eeeadf',
  },
  mark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.placeholderBorder,
    borderRadius: 26,
  },
  markText: { fontFamily: serif, fontSize: 29, color: colors.placeholderMark },
  business: { fontFamily: serif, fontSize: 16, color: colors.placeholderText },
  category: {
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#7a8375',
  },
});
