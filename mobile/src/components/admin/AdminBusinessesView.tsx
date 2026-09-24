import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchAdminBusinesses, updateAdminBusiness } from '../../adminApi';
import { colors, serif } from '../../theme';
import type { ManagedBusiness } from '../../types';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const statuses: ManagedBusiness['status'][] = ['active', 'inactive', 'unavailable'];

export default function AdminBusinessesView() {
  const [rows, setRows] = useState<ManagedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ManagedBusiness | null>(null);

  function load() {
    setLoading(true);
    setError('');
    fetchAdminBusinesses()
      .then(setRows)
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Unable to load businesses.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const totals = { total: rows.length, active: rows.filter(row => row.status === 'active').length, inactive: rows.filter(row => row.status !== 'active').length };

  if (loading) return <ActivityIndicator color={colors.darkGreen} style={styles.spacer} />;

  return (
    <View>
      <Text style={styles.eyebrow}>DATABASE MANAGEMENT</Text>
      <Text style={styles.title}>Businesses</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Total Businesses</Text><Text style={styles.metricValue}>{totals.total}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Active</Text><Text style={styles.metricValue}>{totals.active}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Inactive</Text><Text style={styles.metricValue}>{totals.inactive}</Text></View>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {rows.map(row => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowStrong}>{row.name}</Text>
            <Text style={styles.rowSmall}>{row.business_type} · {row.status}</Text>
            <Text style={styles.rowSmall} numberOfLines={1}>{row.api_url || 'Not stored'}</Text>
            <Text style={styles.rowSmall}>Last checked: {formatDate(row.last_checked_at)}</Text>
          </View>
          <Pressable onPress={() => setEditing(row)}><Text style={styles.actionLink}>Edit</Text></Pressable>
        </View>
      ))}

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        {editing && (
          <BusinessForm
            value={editing}
            onClose={() => setEditing(null)}
            onSave={async input => { await updateAdminBusiness(editing.id, input); setEditing(null); load(); }}
          />
        )}
      </Modal>
    </View>
  );
}

function BusinessForm({ value, onClose, onSave }: {
  value: ManagedBusiness;
  onClose: () => void;
  onSave: (input: Pick<ManagedBusiness, 'name' | 'api_url' | 'status'>) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: value.name, api_url: value.api_url, status: value.status });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save business.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.formContent}>
      <View style={styles.formHeader}>
        <Text style={styles.title}>Edit business metadata</Text>
        <Pressable onPress={onClose} hitSlop={8}><Text style={styles.close}>×</Text></Pressable>
      </View>

      <FormField label="Name">
        <TextInput style={styles.input} value={form.name} onChangeText={text => setForm(current => ({ ...current, name: text }))} />
      </FormField>
      <FormField label="API URL">
        <TextInput
          style={styles.input}
          value={form.api_url}
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={text => setForm(current => ({ ...current, api_url: text }))}
        />
      </FormField>
      <FormField label="Status">
        <View style={styles.roleRow}>
          {statuses.map(status => (
            <Pressable key={status} onPress={() => setForm(current => ({ ...current, status }))} style={[styles.chip, form.status === status && styles.chipActive]}>
              <Text style={[styles.chipText, form.status === status && styles.chipTextActive]}>{status}</Text>
            </Pressable>
          ))}
        </View>
      </FormField>
      <Text style={styles.hint}>Database metadata only. Adapter runtime URLs continue to come from environment variables.</Text>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} disabled={saving} onPress={() => void submit()}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: { marginTop: 60 },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  title: { fontFamily: serif, fontSize: 20, color: colors.text, marginTop: 6, marginBottom: 14 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12 },
  metricLabel: { fontSize: 9, color: colors.muted, marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  errorText: { fontSize: 12, color: '#8c3f38', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
  rowInfo: { flex: 1, gap: 2 },
  rowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  rowSmall: { fontSize: 10, color: colors.muted },
  actionLink: { fontSize: 11, color: colors.darkGreen, fontWeight: '600' },
  formContent: { padding: 20, paddingBottom: 60 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  input: { backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text },
  roleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#eeece4' },
  chipActive: { backgroundColor: colors.darkGreen },
  chipText: { fontSize: 11, color: colors.text },
  chipTextActive: { color: '#fff' },
  hint: { fontSize: 11, color: colors.muted, marginBottom: 16, fontStyle: 'italic' },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
