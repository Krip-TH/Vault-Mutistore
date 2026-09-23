import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  createAdminProduct, deleteAdminProduct, fetchAdminProduct, fetchAdminProductOptions,
  fetchAdminProducts, updateAdminProduct, uploadAdminProductImage,
} from '../../adminApi';
import { resolveApiUrl } from '../../config';
import { formatTHB } from '../../format';
import { colors, serif } from '../../theme';
import type { AdminProduct, AdminProductInput, ProductOptions } from '../../types';
import ProductImage from '../ProductImage';

const emptyInput: AdminProductInput = { business: '', name: '', category: '', price: 0, stock: 0, unit: 'pcs', image_url: '' };
const stockFilters = ['all', 'In Stock', 'Low Stock', 'Out of Stock'] as const;

function productBusinessName(product: AdminProduct): string {
  return product.management === 'vault' ? product.catalog_business_name || 'Unassigned' : product.business_name;
}

export default function AdminProductsView() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [options, setOptions] = useState<ProductOptions>({ businesses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [business, setBusiness] = useState('all');
  const [stock, setStock] = useState<(typeof stockFilters)[number]>('all');
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [nextProducts, nextOptions] = await Promise.all([fetchAdminProducts(), fetchAdminProductOptions()]);
      setProducts(nextProducts);
      setOptions(nextOptions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => products.filter(product => {
    const query = search.trim().toLowerCase();
    return (!query || `${product.name} ${product.category}`.toLowerCase().includes(query))
      && (business === 'all' || (product.management === 'vault' ? product.catalog_business : product.business) === business)
      && (stock === 'all' || product.status === stock);
  }), [business, products, search, stock]);

  async function open(product: AdminProduct) {
    setError('');
    try {
      setSelected(await fetchAdminProduct(product.business, product.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load this product.');
    }
  }

  async function remove(product: AdminProduct) {
    if (!product.can_delete) return;
    try {
      await deleteAdminProduct(product);
      setProducts(current => current.filter(item => !(item.business === product.business && item.id === product.id)));
      setSelected(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete the product.');
    }
  }

  function confirmRemove(product: AdminProduct) {
    if (!product.can_delete) return;
    Alert.alert(
      'Delete product?',
      `${product.name} will be permanently removed from the VAULT catalog.`,
      [
        { text: 'Keep product', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { void remove(product); } },
      ],
    );
  }

  if (loading) return <ActivityIndicator color={colors.darkGreen} style={styles.spacer} />;

  return (
    <View>
      {!!error && <Text style={styles.errorText}>{error} </Text>}

      {selected ? (
        <ProductDetailView
          product={selected}
          onBack={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => confirmRemove(selected)}
        />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Text style={styles.eyebrow}>CATALOG MANAGEMENT</Text>
            <Text style={styles.title}>All products</Text>
            <Pressable style={styles.primaryButton} onPress={() => setEditing('new')}>
              <Text style={styles.primaryButtonText}>Add Product</Text>
            </Pressable>
          </View>

          <TextInput style={styles.search} placeholder="Search name or category" placeholderTextColor="#a3ab9c" value={search} onChangeText={setSearch} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable onPress={() => setBusiness('all')} style={[styles.chip, business === 'all' && styles.chipActive]}>
              <Text style={[styles.chipText, business === 'all' && styles.chipTextActive]}>All businesses</Text>
            </Pressable>
            {options.businesses.map(item => (
              <Pressable key={item.id} onPress={() => setBusiness(item.id)} style={[styles.chip, business === item.id && styles.chipActive]}>
                <Text style={[styles.chipText, business === item.id && styles.chipTextActive]}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {stockFilters.map(value => (
              <Pressable key={value} onPress={() => setStock(value)} style={[styles.chip, stock === value && styles.chipActive]}>
                <Text style={[styles.chipText, stock === value && styles.chipTextActive]}>{value === 'all' ? 'All stock' : value}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.resultsLine}>{filtered.length} products</Text>

          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>No matching products.</Text>
          ) : (
            filtered.map(product => (
              <View key={`${product.business}-${product.id}`} style={styles.productRow}>
                <View style={styles.thumb}><ProductImage product={product} /></View>
                <View style={styles.productInfo}>
                  <Text style={styles.orderRowStrong} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.orderRowSmall}>{productBusinessName(product)} · {product.management === 'external' ? 'External' : 'VAULT'}</Text>
                  <Text style={styles.orderRowSmall}>{formatTHB(product.price)} · {product.stock} {product.unit}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable onPress={() => void open(product)}><Text style={styles.actionLink}>Open</Text></Pressable>
                  {product.can_edit && <Pressable onPress={() => setEditing(product)}><Text style={styles.actionLink}>Edit</Text></Pressable>}
                  {product.can_delete && <Pressable onPress={() => confirmRemove(product)}><Text style={styles.actionLinkDanger}>Delete</Text></Pressable>}
                </View>
              </View>
            ))
          )}
        </>
      )}

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        {editing && (
          <ProductForm
            product={editing === 'new' ? null : editing}
            options={options}
            onClose={() => setEditing(null)}
            onSaved={product => {
              setProducts(current => editing === 'new'
                ? [product, ...current]
                : current.map(item => (item.business === product.business && item.id === product.id ? product : item)));
              setSelected(product);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function ProductDetailView({ product, onBack, onEdit, onDelete }: {
  product: AdminProduct; onBack: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <View>
      <Pressable onPress={onBack} hitSlop={8}><Text style={styles.backLink}>← All products</Text></Pressable>
      <View style={styles.card}>
        <View style={styles.detailThumb}><ProductImage product={product} /></View>
        <Text style={styles.eyebrow}>{productBusinessName(product)} · {product.management === 'external' ? 'EXTERNALLY MANAGED' : 'VAULT MANAGED'}</Text>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.orderRowSmall}>{product.category}</Text>
        <View style={styles.factRow}><Text style={styles.orderRowSmall}>Price</Text><Text style={styles.orderRowStrong}>{formatTHB(product.price)}</Text></View>
        <View style={styles.factRow}><Text style={styles.orderRowSmall}>Stock</Text><Text style={styles.orderRowStrong}>{product.stock} {product.unit}</Text></View>
        <View style={styles.factRow}><Text style={styles.orderRowSmall}>Status</Text><Text style={styles.orderRowStrong}>{product.status}</Text></View>
        {product.management === 'external' && (
          <Text style={styles.readonlyNote}>This product is read-only in VAULT. Update it in {product.business_name}'s source system.</Text>
        )}
        <View style={styles.rowActions}>
          {product.can_edit && <Pressable style={styles.secondaryButton} onPress={onEdit}><Text style={styles.secondaryButtonText}>Edit</Text></Pressable>}
          {product.can_delete && <Pressable style={styles.secondaryButton} onPress={onDelete}><Text style={styles.secondaryButtonText}>Delete</Text></Pressable>}
        </View>
      </View>
    </View>
  );
}

function ProductForm({ product, options, onClose, onSaved }: {
  product: AdminProduct | null; options: ProductOptions; onClose: () => void; onSaved: (product: AdminProduct) => void;
}) {
  const [value, setValue] = useState<AdminProductInput>(
    product
      ? { business: product.catalog_business || '', name: product.name, category: product.category, price: product.price, stock: product.stock, unit: product.unit, image_url: product.image_url }
      : emptyInput,
  );
  const [imageMode, setImageMode] = useState<'url' | 'upload'>(product?.image_url.startsWith('/uploads/products/') ? 'upload' : 'url');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = options.businesses.find(item => item.id === value.business)?.categories || [];

  function field<K extends keyof AdminProductInput>(key: K, next: AdminProductInput[K]) {
    setValue(current => ({ ...current, [key]: next }));
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library access is needed to choose an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const picked = result.assets[0];
    if (picked.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(picked.mimeType)) { setError('Choose a JPEG, PNG, or WEBP image.'); return; }
    if (picked.fileSize && picked.fileSize > 5 * 1024 * 1024) { setError('Image files must be 5 MB or smaller.'); return; }
    setAsset(picked);
    setError('');
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      if (imageMode === 'url' && value.image_url && !/^https?:\/\//i.test(value.image_url)) throw new Error('Enter a valid HTTP or HTTPS image URL.');
      if (!value.business) throw new Error('Select a business.');
      if (!value.category) throw new Error('Select a category.');
      const image_url = imageMode === 'upload' && asset ? await uploadAdminProductImage(asset) : value.image_url;
      const input = { ...value, image_url };
      onSaved(product ? await updateAdminProduct(product, input) : await createAdminProduct(input));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the product.');
    } finally {
      setSaving(false);
    }
  }

  const preview = asset?.uri || (value.image_url ? resolveApiUrl(value.image_url) : '');

  return (
    <ScrollView contentContainerStyle={styles.formContent}>
      <View style={styles.formHeader}>
        <Text style={styles.eyebrow}>VAULT MANAGED</Text>
        <Pressable onPress={onClose} hitSlop={8}><Text style={styles.close}>×</Text></Pressable>
      </View>
      <Text style={styles.title}>{product ? 'Edit product' : 'Add product'}</Text>

      <FormField label="Name">
        <TextInput style={styles.input} value={value.name} maxLength={255} onChangeText={text => field('name', text)} />
      </FormField>

      <FormField label="Business">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {options.businesses.map(item => (
            <Pressable
              key={item.id}
              onPress={() => setValue(current => ({ ...current, business: item.id, category: '' }))}
              style={[styles.chip, value.business === item.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, value.business === item.id && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </FormField>

      <FormField label="Category">
        {!value.business ? (
          <Text style={styles.hint}>Select a business first.</Text>
        ) : categoryOptions.length === 0 ? (
          <Text style={styles.hint}>No category data is currently available for this business.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {categoryOptions.map(category => (
              <Pressable key={category} onPress={() => field('category', category)} style={[styles.chip, value.category === category && styles.chipActive]}>
                <Text style={[styles.chipText, value.category === category && styles.chipTextActive]}>{category}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </FormField>

      <View style={styles.row}>
        <FormField label="Price" style={styles.half}>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={String(value.price)} onChangeText={text => field('price', Number(text) || 0)} />
        </FormField>
        <FormField label="Stock" style={styles.half}>
          <TextInput style={styles.input} keyboardType="number-pad" value={String(value.stock)} onChangeText={text => field('stock', Number(text) || 0)} />
        </FormField>
      </View>

      <FormField label="Unit">
        <TextInput style={styles.input} value={value.unit} maxLength={50} onChangeText={text => field('unit', text)} />
      </FormField>

      <FormField label="Product image">
        <View style={styles.filterRow}>
          <Pressable onPress={() => setImageMode('url')} style={[styles.chip, imageMode === 'url' && styles.chipActive]}>
            <Text style={[styles.chipText, imageMode === 'url' && styles.chipTextActive]}>Image URL</Text>
          </Pressable>
          <Pressable onPress={() => setImageMode('upload')} style={[styles.chip, imageMode === 'upload' && styles.chipActive]}>
            <Text style={[styles.chipText, imageMode === 'upload' && styles.chipTextActive]}>Upload from device</Text>
          </Pressable>
        </View>
        {imageMode === 'url' ? (
          <TextInput
            style={[styles.input, styles.spacingTop]}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor="#a3ab9c"
            value={value.image_url.startsWith('/uploads/') ? '' : value.image_url}
            onChangeText={text => field('image_url', text)}
          />
        ) : (
          <Pressable style={[styles.secondaryButton, styles.spacingTop]} onPress={() => void pickImage()}>
            <Text style={styles.secondaryButtonText}>{asset ? 'Change image' : 'Choose image'}</Text>
          </Pressable>
        )}
        {preview ? <Image source={{ uri: preview }} style={styles.imagePreview} /> : (
          <View style={[styles.imagePreview, styles.imagePreviewFallback]}><Text style={styles.brandMarkText}>V.</Text></View>
        )}
      </FormField>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} disabled={saving} onPress={() => void submit()}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{product ? 'Save changes' : 'Create product'}</Text>}
      </Pressable>
    </ScrollView>
  );
}

function FormField({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: { marginTop: 60 },
  errorText: { fontSize: 12, color: '#8c3f38', marginBottom: 12 },
  toolbar: { marginBottom: 14 },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  title: { fontFamily: serif, fontSize: 20, color: colors.text, marginTop: 6, marginBottom: 10 },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.text, marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#eeece4' },
  chipActive: { backgroundColor: colors.darkGreen },
  chipText: { fontSize: 10, color: colors.text },
  chipTextActive: { color: '#fff' },
  resultsLine: { fontSize: 11, color: colors.muted, marginVertical: 12 },
  emptyText: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 30 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12, marginBottom: 10 },
  thumb: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.imageBackground },
  productInfo: { flex: 1, gap: 2 },
  rowActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionLink: { fontSize: 11, color: colors.darkGreen, fontWeight: '600' },
  actionLinkDanger: { fontSize: 11, color: '#8c3f38', fontWeight: '600' },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  backLink: { fontSize: 12, color: colors.text, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 14, padding: 16, marginBottom: 14 },
  detailThumb: { width: '100%', aspectRatio: 1.4, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.imageBackground, marginBottom: 14 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  readonlyNote: { fontSize: 11, color: colors.muted, marginTop: 10, fontStyle: 'italic' },
  secondaryButton: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  secondaryButtonText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  formContent: { padding: 20, paddingBottom: 60 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  hint: { fontSize: 11, color: colors.muted },
  input: { backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  spacingTop: { marginTop: 4 },
  imagePreview: { width: '100%', aspectRatio: 1.6, borderRadius: 10, marginTop: 12, backgroundColor: colors.imageBackground },
  imagePreviewFallback: { alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: serif, fontSize: 28, color: colors.placeholderMark },
});
