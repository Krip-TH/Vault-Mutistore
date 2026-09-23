import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../../adminApi';
import { useAuth } from '../../auth/AuthContext';
import { colors, serif } from '../../theme';
import type { ManagedUser, ManagedUserInput, UserRole } from '../../types';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function AdminUsersView() {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null);

  function load() {
    setLoading(true);
    setError('');
    fetchAdminUsers()
      .then(setRows)
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Unable to load users.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function confirmDelete(target: ManagedUser) {
    // Native equivalent of the web's window.confirm — deleting an account is destructive
    // and, unlike most mobile actions here, cannot be undone from within the app.
    Alert.alert(
      'Delete user',
      `Delete ${target.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            deleteAdminUser(target.id).then(load).catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Unable to delete user.'));
          },
        },
      ],
    );
  }

  const totals = { total: rows.length, customers: rows.filter(row => row.role === 'customer').length, admins: rows.filter(row => row.role === 'admin').length };

  if (loading) return <ActivityIndicator color={colors.darkGreen} style={styles.spacer} />;

  return (
    <View>
      <View style={styles.toolbar}>
        <Text style={styles.eyebrow}>DATABASE MANAGEMENT</Text>
        <Text style={styles.title}>Users</Text>
        <Pressable style={styles.primaryButton} onPress={() => setEditing('new')}>
          <Text style={styles.primaryButtonText}>Add User</Text>
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Total Users</Text><Text style={styles.metricValue}>{totals.total}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Customers</Text><Text style={styles.metricValue}>{totals.customers}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Administrators</Text><Text style={styles.metricValue}>{totals.admins}</Text></View>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {rows.map(row => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowStrong}>{row.name}</Text>
            <Text style={styles.rowSmall}>{row.email}</Text>
            <Text style={styles.rowSmall}>{row.role} · Created {formatDate(row.created_at)}</Text>
          </View>
          <View style={styles.rowActions}>
            <Pressable onPress={() => setEditing(row)}><Text style={styles.actionLink}>Edit</Text></Pressable>
            <Pressable disabled={row.id === currentUser?.id} onPress={() => confirmDelete(row)}>
              <Text style={[styles.actionLinkDanger, row.id === currentUser?.id && styles.actionDisabled]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        {editing && (
          <UserForm
            value={editing}
            onClose={() => setEditing(null)}
            onSave={async input => {
              if (editing === 'new') await createAdminUser(input);
              else await updateAdminUser(editing.id, input);
              setEditing(null);
              load();
            }}
          />
        )}
      </Modal>
    </View>
  );
}

function UserForm({ value, onClose, onSave }: {
  value: ManagedUser | 'new';
  onClose: () => void;
  onSave: (input: ManagedUserInput) => Promise<void>;
}) {
  const isNew = value === 'new';
  const [form, setForm] = useState<ManagedUserInput>(
    isNew ? { name: '', email: '', role: 'customer', password: '' } : { name: value.name, email: value.email, role: value.role, password: '' },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || (isNew && !form.password)) {
      setError('Fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save this user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.formContent}>
      <View style={styles.formHeader}>
        <Text style={styles.title}>{isNew ? 'Add user' : 'Edit user'}</Text>
        <Pressable onPress={onClose} hitSlop={8}><Text style={styles.close}>×</Text></Pressable>
      </View>

      <FormField label="Name">
        <TextInput style={styles.input} value={form.name} onChangeText={text => setForm(current => ({ ...current, name: text }))} />
      </FormField>
      <FormField label="Email">
        <TextInput
          style={styles.input}
          value={form.email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={text => setForm(current => ({ ...current, email: text }))}
        />
      </FormField>
      <FormField label="Role">
        <View style={styles.roleRow}>
          {(['customer', 'admin'] as UserRole[]).map(role => (
            <Pressable
              key={role}
              onPress={() => setForm(current => ({ ...current, role }))}
              style={[styles.chip, form.role === role && styles.chipActive]}
            >
              <Text style={[styles.chipText, form.role === role && styles.chipTextActive]}>{role === 'admin' ? 'Administrator' : 'Customer'}</Text>
            </Pressable>
          ))}
        </View>
      </FormField>
      <FormField label={isNew ? 'Password' : 'New password (optional)'}>
        <TextInput
          style={styles.input}
          value={form.password}
          secureTextEntry
          placeholder={isNew ? undefined : 'Leave blank to keep the current password'}
          placeholderTextColor="#a3ab9c"
          onChangeText={text => setForm(current => ({ ...current, password: text }))}
        />
      </FormField>

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
  toolbar: { marginBottom: 16 },
  eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 1.5, color: colors.muted },
  title: { fontFamily: serif, fontSize: 20, color: colors.text, marginTop: 6, marginBottom: 10 },
  primaryButton: { backgroundColor: colors.darkGreen, borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 12 },
  metricLabel: { fontSize: 9, color: colors.muted, marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  errorText: { fontSize: 12, color: '#8c3f38', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
  rowInfo: { flex: 1, gap: 2 },
  rowStrong: { fontSize: 13, color: colors.text, fontWeight: '500' },
  rowSmall: { fontSize: 10, color: colors.muted },
  rowActions: { gap: 10, alignItems: 'flex-end' },
  actionLink: { fontSize: 11, color: colors.darkGreen, fontWeight: '600' },
  actionLinkDanger: { fontSize: 11, color: '#8c3f38', fontWeight: '600' },
  actionDisabled: { opacity: 0.4 },
  formContent: { padding: 20, paddingBottom: 60 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  input: { backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text },
  roleRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#eeece4' },
  chipActive: { backgroundColor: colors.darkGreen },
  chipText: { fontSize: 11, color: colors.text },
  chipTextActive: { color: '#fff' },
});
