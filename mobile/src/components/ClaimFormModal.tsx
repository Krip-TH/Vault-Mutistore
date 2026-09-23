import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { fetchClaimableItems, submitClaim } from '../claimApi';
import { claimReasonOptions } from '../claimStatus';
import { formatTHB } from '../format';
import { colors, serif } from '../theme';
import type { Claim, ClaimableItem, ClaimableItemsResponse, ClaimReason } from '../types';
import ProductImage from './ProductImage';

const maxEvidencePhotos = 5;

interface Props {
  visible: boolean;
  orderNo: string | null;
  onClose: () => void;
  onDismiss?: () => void;
  onSubmitted: (claim: Claim) => void;
}

export default function ClaimFormModal({ visible, orderNo, onClose, onDismiss, onSubmitted }: Props) {
  const [source, setSource] = useState<ClaimableItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [reason, setReason] = useState<ClaimReason | ''>('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState<Claim | null>(null);

  const load = useCallback(async () => {
    if (!orderNo) return;
    setLoading(true);
    setLoadError('');
    try {
      setSource(await fetchClaimableItems(orderNo));
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Unable to load the products you can claim.');
    } finally {
      setLoading(false);
    }
  }, [orderNo]);

  useEffect(() => {
    if (visible && orderNo) {
      setSelection({});
      setReason('');
      setDescription('');
      setContactPhone('');
      setPhotos([]);
      setPhotoError('');
      setErrors({});
      setSubmitError('');
      setSubmitted(null);
      void load();
    }
  }, [visible, orderNo, load]);

  const items = source?.items ?? [];

  function toggle(item: ClaimableItem) {
    setSelection(current => {
      const next = { ...current };
      if (next[item.order_item_id]) delete next[item.order_item_id];
      else next[item.order_item_id] = 1;
      return next;
    });
  }

  function setQuantity(item: ClaimableItem, value: number) {
    const quantity = Math.min(item.claimable_quantity, Math.max(1, Math.round(value) || 1));
    setSelection(current => ({ ...current, [item.order_item_id]: quantity }));
  }

  async function addPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setPhotoError('Photo library access is needed to attach evidence.'); return; }
    const remaining = maxEvidencePhotos - photos.length;
    if (remaining <= 0) { setPhotoError(`Attach up to ${maxEvidencePhotos} photos.`); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: remaining,
    });
    if (result.canceled) return;
    const accepted: ImagePicker.ImagePickerAsset[] = [];
    let error = '';
    for (const asset of result.assets) {
      if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) { error = 'Photos must be JPEG, PNG, or WEBP.'; continue; }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) { error = 'Each photo must be 5 MB or smaller.'; continue; }
      if (photos.length + accepted.length >= maxEvidencePhotos) { error = `Attach up to ${maxEvidencePhotos} photos.`; continue; }
      accepted.push(asset);
    }
    setPhotoError(error);
    if (accepted.length) setPhotos(current => [...current, ...accepted]);
  }

  function removePhoto(index: number) {
    setPhotos(current => current.filter((_, position) => position !== index));
  }

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    const chosen = Object.entries(selection).filter(([, quantity]) => quantity > 0);
    if (!chosen.length) found.items = 'Select at least one product to claim.';
    for (const [id, quantity] of chosen) {
      const item = items.find(value => value.order_item_id === Number(id));
      if (item && quantity > item.claimable_quantity) {
        found.items = `${item.product_name}: you can claim at most ${item.claimable_quantity} unit${item.claimable_quantity === 1 ? '' : 's'}.`;
      }
    }
    if (!reason) found.reason = 'Choose what went wrong.';
    if (!description.trim()) found.description = 'Describe the problem so the team can review it.';
    else if (description.trim().length > 2000) found.description = 'Keep the description to 2000 characters or fewer.';
    if (contactPhone.trim() && !/^[+\d][\d\s().-]{5,38}$/.test(contactPhone.trim())) found.contactPhone = 'Enter a valid phone number.';
    if (!photos.length) found.evidence = 'Attach at least one photo of the problem.';
    return found;
  }

  async function submit() {
    if (!orderNo) return;
    const found = validate();
    setErrors(found);
    setSubmitError('');
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      const claim = await submitClaim({
        orderNo,
        reason: reason as ClaimReason,
        description: description.trim(),
        contactPhone,
        items: Object.entries(selection).filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => ({ order_item_id: Number(id), quantity })),
        photos,
      });
      setSubmitted(claim);
      onSubmitted(claim);
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : 'Unable to submit the claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={styles.sheet}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>SUBMIT A CLAIM</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close claim form" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.state}>
            <ActivityIndicator color={colors.darkGreen} />
            <Text style={styles.stateTitle}>Preparing the claim form…</Text>
          </View>
        )}

        {!loading && !!loadError && (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>We couldn&rsquo;t open the claim form.</Text>
            <Text style={styles.stateBody}>{loadError}</Text>
            <Pressable style={styles.primaryButton} onPress={() => void load()}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !loadError && submitted && (
          <View style={styles.state}>
            <Text style={styles.emptyMark}>V.</Text>
            <Text style={styles.stateTitle}>Claim {submitted.claim_number} submitted.</Text>
            <Text style={styles.stateBody}>
              We have received {submitted.items.length} product{submitted.items.length === 1 ? '' : 's'} from order {submitted.order_no}.
              You can follow every update under My Claims.
            </Text>
            <Pressable style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        )}

        {!loading && !loadError && !submitted && (!source?.eligible || !items.length) && (
          <View style={styles.state}>
            <Text style={styles.emptyMark}>V.</Text>
            <Text style={styles.stateTitle}>This order cannot be claimed.</Text>
            <Text style={styles.stateBody}>{source?.ineligible_reason ?? 'There are no products left to claim on this order.'}</Text>
            <Pressable style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Back to order</Text>
            </Pressable>
          </View>
        )}

        {!loading && !loadError && !submitted && !!source?.eligible && !!items.length && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Tell us what went wrong.</Text>
            <Text style={styles.subtitle}>
              Order {orderNo}. Select the affected products, describe the problem, and attach photos as evidence.
            </Text>

            <Text style={styles.sectionTitle}>1. Which products are affected?</Text>
            {!!errors.items && <Text style={styles.errorText}>{errors.items}</Text>}
            {items.map(item => {
              const selected = selection[item.order_item_id] ?? 0;
              return (
                <View
                  key={item.order_item_id}
                  style={[styles.itemRow, selected > 0 && styles.itemRowSelected]}
                >
                  <Pressable style={styles.itemSelectArea} onPress={() => toggle(item)}>
                    <View style={styles.itemThumb}>
                      <ProductImage product={{ image_url: item.image_url, name: item.product_name, business_name: item.business_name, category: item.category }} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.orderRowSmall}>{item.business_name}</Text>
                      <Text style={styles.orderRowStrong}>{item.product_name}</Text>
                      <Text style={styles.orderRowSmall}>
                        {formatTHB(item.unit_price)} · {item.claimable_quantity} of {item.purchased_quantity} still claimable
                      </Text>
                    </View>
                    <View style={[styles.checkbox, selected > 0 && styles.checkboxChecked]}>
                      {selected > 0 && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                  </Pressable>
                  {selected > 0 && (
                    <View style={styles.quantityControl}>
                      <Pressable onPress={() => setQuantity(item, selected - 1)} disabled={selected <= 1} hitSlop={8}>
                        <Text style={styles.quantityButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.quantityValue}>{selected}</Text>
                      <Pressable onPress={() => setQuantity(item, selected + 1)} disabled={selected >= item.claimable_quantity} hitSlop={8}>
                        <Text style={styles.quantityButtonText}>+</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>2. What went wrong?</Text>
            <Text style={styles.fieldLabel}>Reason</Text>
            <View style={styles.chipRow}>
              {claimReasonOptions.map(option => (
                <Pressable
                  key={option.value}
                  onPress={() => setReason(option.value)}
                  style={[styles.chip, reason === option.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, reason === option.value && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {!!errors.reason && <Text style={styles.errorText}>{errors.reason}</Text>}

            <Text style={styles.fieldLabel}>Contact phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={contactPhone}
              placeholder="+66 81 234 5678"
              placeholderTextColor="#a3ab9c"
              keyboardType="phone-pad"
              onChangeText={setContactPhone}
            />
            {!!errors.contactPhone && <Text style={styles.errorText}>{errors.contactPhone}</Text>}

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              maxLength={2000}
              multiline
              numberOfLines={5}
              placeholder="Describe what is wrong, when you noticed it, and what you would like us to do."
              placeholderTextColor="#a3ab9c"
              onChangeText={setDescription}
            />
            <Text style={styles.hint}>{errors.description ?? `${description.trim().length} of 2000 characters`}</Text>

            <Text style={styles.sectionTitle}>3. Evidence photos</Text>
            <Text style={styles.hint}>Attach up to {maxEvidencePhotos} photos (JPEG, PNG, or WEBP, 5 MB each). At least one is required.</Text>
            <Pressable style={[styles.secondaryButton, styles.spacingTop]} onPress={() => void addPhotos()}>
              <Text style={styles.secondaryButtonText}>{photos.length ? 'Add more photos' : 'Choose photos'}</Text>
            </Pressable>
            <Text style={styles.hint}>{photos.length} of {maxEvidencePhotos} attached</Text>
            {(!!photoError || !!errors.evidence) && <Text style={styles.errorText}>{photoError || errors.evidence}</Text>}
            {photos.length > 0 && (
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={photo.uri} style={styles.photoItem}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <Pressable style={styles.photoRemove} onPress={() => removePhoto(index)} hitSlop={8}>
                      <Text style={styles.photoRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}
            <Pressable style={[styles.primaryButton, styles.spacingTop, submitting && styles.primaryButtonDisabled]} disabled={submitting} onPress={() => void submit()}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit claim</Text>}
            </Pressable>
          </ScrollView>
        )}
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
  title: { fontFamily: serif, fontSize: 24, color: colors.text, marginTop: 4, marginBottom: 6, lineHeight: 30 },
  subtitle: { fontSize: 12, color: colors.muted, marginBottom: 18, lineHeight: 18 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  stateTitle: { fontFamily: serif, fontSize: 20, color: colors.text, textAlign: 'center' },
  stateBody: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  emptyMark: { fontFamily: serif, fontSize: 32, color: colors.placeholderMark },
  sectionTitle: { fontFamily: serif, fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 10 },
  errorText: { fontSize: 11, color: '#8c3f38', marginBottom: 8 },
  itemRow: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  itemRowSelected: { borderColor: colors.darkGreen },
  itemSelectArea: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemThumb: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.imageBackground },
  itemInfo: { flex: 1, gap: 2 },
  orderRowSmall: { fontSize: 10, color: colors.muted },
  orderRowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10, marginLeft: 64, alignSelf: 'flex-start' },
  quantityButtonText: { fontSize: 16, color: colors.text, width: 16, textAlign: 'center' },
  quantityValue: { fontSize: 13, color: colors.text, minWidth: 16, textAlign: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.darkGreen, borderColor: colors.darkGreen },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#eeece4' },
  chipActive: { backgroundColor: colors.darkGreen },
  chipText: { fontSize: 11, color: colors.text },
  chipTextActive: { color: '#fff' },
  input: { backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text, marginBottom: 4 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: colors.muted, marginBottom: 8 },
  secondaryButton: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  secondaryButtonText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  spacingTop: { marginTop: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  photoItem: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 13, lineHeight: 15 },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
