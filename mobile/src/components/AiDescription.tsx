import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchAiDescription } from '../aiApi';
import type { Product } from '../types';

interface Props {
  product: Product;
}

/**
 * The backend's NormalizedProduct carries no `description` field at all (no adapter
 * populates one), so — same as the web — this always fetches an AI description rather
 * than gating on a length check against a field that never exists.
 */
export default function AiDescription({ product }: Props) {
  const [description, setDescription] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    setDescription(null);
    setAvailable(true);
    fetchAiDescription(product.id, product.business)
      .then(response => { if (active) setDescription(response.description); })
      .catch(error => {
        console.warn('[VAULT AI] Product description is unavailable.', error);
        if (active) setAvailable(false);
      });
    return () => { active = false; };
  }, [product.business, product.id]);

  if (!available || !description) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>✦ AI-generated description</Text>
      <Text style={styles.body}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20, padding: 14, backgroundColor: '#eef3ec', borderWidth: 1, borderColor: '#d8e2da', borderRadius: 12 },
  label: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#3b5541', marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 20, color: '#435049' },
});
