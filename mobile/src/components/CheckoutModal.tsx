import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { completeCheckout } from '../api';
import { useCart } from '../cart/CartContext';
import { createOrderRequest, initialCheckoutForm, validateCheckout } from '../checkout';
import { formatTHB } from '../format';
import { colors, serif } from '../theme';
import type { CheckoutErrors } from '../checkout';
import type { CheckoutForm, Order } from '../types';
import ProductImage from './ProductImage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onContinueShopping: () => void;
  onViewOrders: () => void;
}

type FieldName = keyof CheckoutForm;

const fields: Array<{ name: FieldName; label: string; optional?: boolean; keyboardType?: 'email-address' | 'phone-pad' }> = [
  { name: 'name', label: 'Full name' },
  { name: 'email', label: 'Email', keyboardType: 'email-address' },
  { name: 'phone', label: 'Phone number', keyboardType: 'phone-pad' },
  { name: 'address_line1', label: 'Address line 1' },
  { name: 'address_line2', label: 'Address line 2', optional: true },
  { name: 'district', label: 'District / Area' },
  { name: 'province', label: 'Province' },
  { name: 'postal_code', label: 'Postal code' },
  { name: 'country', label: 'Country' },
];

export default function CheckoutModal({ visible, onClose, onContinueShopping, onViewOrders }: Props) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [form, setForm] = useState<CheckoutForm>(initialCheckoutForm);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);

  function update(name: FieldName, value: string) {
    setForm(current => ({ ...current, [name]: value }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: undefined }));
  }

  async function submit() {
    const nextErrors = validateCheckout(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!cart.items.length) { setSubmitError('Your cart is empty. Return to the collection to add products.'); return; }

    setSubmitting(true);
    setSubmitError('');
    try {
      setOrder(await completeCheckout(createOrderRequest(form, cart.items), cart.clearCart));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to place the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setForm(initialCheckoutForm);
    setErrors({});
    setSubmitError('');
    setOrder(null);
  }

  function close() {
    if (order) reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={submitting ? () => undefined : close}>
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {order ? (
          <OrderConfirmation
            order={order}
            insetBottom={insets.bottom}
            onContinue={() => { reset(); onClose(); onContinueShopping(); }}
            onViewOrders={() => { reset(); onClose(); onViewOrders(); }}
          />
        ) : (
          <>
            <View style={styles.topBar}>
              <Pressable onPress={close} disabled={submitting} hitSlop={8}>
                <Text style={styles.backText}>← Return to cart</Text>
              </Pressable>
              <Text style={styles.eyebrow}>SECURE ORDER</Text>
              <Pressable onPress={close} disabled={submitting} hitSlop={8}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
              <Text style={styles.eyebrowSmall}>CHECKOUT</Text>
              <Text style={styles.title}>Where should we send it?</Text>

              {fields.map(field => (
                <View key={field.name} style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {field.label}{field.optional && <Text style={styles.optional}>  Optional</Text>}
                  </Text>
                  <TextInput
                    style={[styles.input, errors[field.name] && styles.inputError]}
                    value={form[field.name]}
                    onChangeText={value => update(field.name, value)}
                    editable={!submitting}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.name === 'email' ? 'none' : 'sentences'}
                  />
                  {!!errors[field.name] && <Text style={styles.fieldError}>{errors[field.name]}</Text>}
                </View>
              ))}

              <View style={styles.review}>
                <Text style={styles.eyebrowSmall}>YOUR ORDER</Text>
                <Text style={styles.reviewTitle}>Order review</Text>
                {cart.items.map(item => (
                  <View key={item.key} style={styles.reviewItem}>
                    <View style={styles.reviewImage}><ProductImage product={item.product} /></View>
                    <View style={styles.reviewBody}>
                      <Text style={styles.reviewBusiness}>{item.product.business_name || item.product.business}</Text>
                      <Text style={styles.reviewName} numberOfLines={1}>{item.product.name || 'Product'}</Text>
                      <Text style={styles.reviewQty}>{item.quantity} × {formatTHB(item.product.price)}</Text>
                    </View>
                    <Text style={styles.reviewTotal}>{formatTHB(item.product.price * item.quantity)}</Text>
                  </View>
                ))}
                <View style={styles.totals}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>{formatTHB(cart.subtotal)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Shipping</Text>
                    <Text style={styles.totalValue}>{formatTHB(0)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Discount</Text>
                    <Text style={styles.totalValue}>−{formatTHB(0)}</Text>
                  </View>
                  <View style={[styles.totalRow, styles.grandTotalRow]}>
                    <Text style={styles.grandTotalLabel}>Total</Text>
                    <Text style={styles.grandTotalValue}>{formatTHB(cart.subtotal)}</Text>
                  </View>
                </View>
                {!!submitError && <Text style={styles.submitError} accessibilityRole="alert">{submitError}</Text>}
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.submitButtonPressed,
                    (submitting || cart.hasUnavailableItems || !cart.items.length) && styles.submitButtonDisabled,
                  ]}
                  onPress={submit}
                  disabled={submitting || cart.hasUnavailableItems || !cart.items.length}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Place order</Text>}
                </Pressable>
                <Text style={styles.assurance}>Prices and stock are verified again before your order is confirmed. No payment is collected.</Text>
              </View>
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function OrderConfirmation({ order, onContinue, onViewOrders, insetBottom }: {
  order: Order; onContinue: () => void; onViewOrders: () => void; insetBottom: number;
}) {
  return (
    <ScrollView contentContainerStyle={[styles.confirmation, { paddingBottom: insetBottom + 32 }]}>
      <Text style={styles.confirmationMark}>✓</Text>
      <Text style={styles.eyebrowSmall}>ORDER CONFIRMED</Text>
      <Text style={styles.title}>Thank you, {order.customer.name}.</Text>
      <Text style={styles.confirmationBody}>Your order has been saved. Keep the order number below for future reference.</Text>

      <View style={styles.confirmationFacts}>
        <View style={styles.factRow}>
          <Text style={styles.factLabel}>Order number</Text>
          <Text style={styles.factValue}>{order.order_no}</Text>
        </View>
        <View style={styles.factRow}>
          <Text style={styles.factLabel}>Order total</Text>
          <Text style={styles.factValue}>{formatTHB(order.total)}</Text>
        </View>
        <View style={styles.factRow}>
          <Text style={styles.factLabel}>Status</Text>
          <Text style={styles.factValue}>{order.status}</Text>
        </View>
      </View>

      <View style={styles.confirmationItems}>
        <Text style={styles.reviewTitle}>Items ordered</Text>
        {order.items.map(item => (
          <View key={`${item.business}-${item.product_id}`} style={styles.confirmationItemRow}>
            <View style={styles.reviewBody}>
              <Text style={styles.reviewName}>{item.product_name}</Text>
              <Text style={styles.reviewQty}>{item.business_name} · Quantity {item.quantity} · {formatTHB(item.unit_price)} each</Text>
            </View>
            <Text style={styles.reviewTotal}>{formatTHB(item.line_total)}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.submitButton} onPress={onContinue}>
        <Text style={styles.submitText}>Continue shopping</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onViewOrders}>
        <Text style={styles.secondaryButtonText}>View my orders</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  backText: { fontSize: 12, color: colors.text },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  content: { paddingHorizontal: 22 },
  eyebrowSmall: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  title: { fontFamily: serif, fontSize: 24, color: colors.text, marginTop: 8, marginBottom: 20, lineHeight: 30 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  optional: { fontSize: 9, color: '#a3ab9c' },
  input: {
    backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text,
  },
  inputError: { borderColor: '#8c3f38' },
  fieldError: { fontSize: 10, color: '#8c3f38', marginTop: 4 },
  review: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.headerBorder, paddingTop: 20 },
  reviewTitle: { fontFamily: serif, fontSize: 20, color: colors.text, marginTop: 8, marginBottom: 14 },
  reviewItem: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
  reviewImage: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.imageBackground },
  reviewBody: { flex: 1 },
  reviewBusiness: { fontSize: 9, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  reviewName: { fontSize: 12, color: colors.text, fontWeight: '500' },
  reviewQty: { fontSize: 11, color: colors.muted },
  reviewTotal: { fontSize: 12, color: colors.text, fontWeight: '500' },
  totals: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.headerBorder, paddingTop: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 12, color: colors.text },
  grandTotalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  grandTotalLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  grandTotalValue: { fontSize: 16, color: colors.text, fontWeight: '600' },
  submitError: { fontSize: 12, color: '#8c3f38', marginTop: 14 },
  submitButton: { backgroundColor: colors.darkGreen, borderRadius: 30, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  submitButtonPressed: { backgroundColor: '#3a5745' },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  secondaryButton: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 10, width: '100%' },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  assurance: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 14, lineHeight: 15 },
  confirmation: { paddingHorizontal: 22, paddingTop: 40, alignItems: 'center' },
  confirmationMark: { fontSize: 40, color: colors.inStock, marginBottom: 14 },
  confirmationBody: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 24, lineHeight: 19 },
  confirmationFacts: { width: '100%', marginBottom: 24 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  factLabel: { fontSize: 12, color: colors.muted },
  factValue: { fontSize: 12, color: colors.text, fontWeight: '500' },
  confirmationItems: { width: '100%', marginBottom: 10 },
  confirmationItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
});
