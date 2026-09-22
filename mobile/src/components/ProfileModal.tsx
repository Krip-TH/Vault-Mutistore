import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { formatMemberSince, profileInitial, profileToForm, validateProfileForm, validateProfileImage } from '../profile';
import type { ProfileErrors } from '../profile';
import { fetchProfile, removeProfileImage, resolveImageUrl, updateProfile, uploadProfileImage } from '../profileApi';
import { colors, serif } from '../theme';
import type { Profile, ProfileForm } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const emptyForm: ProfileForm = { name: '', phone: '', address: '', city: '', province: '', postal_code: '', country: '' };

const fields: Array<{ name: keyof ProfileForm; label: string; optional?: boolean }> = [
  { name: 'name', label: 'Full name' },
  { name: 'phone', label: 'Phone', optional: true },
  { name: 'address', label: 'Address', optional: true },
  { name: 'city', label: 'City', optional: true },
  { name: 'province', label: 'Province / State', optional: true },
  { name: 'postal_code', label: 'Postal code', optional: true },
  { name: 'country', label: 'Country', optional: true },
];

export default function ProfileModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetchProfile()
      .then(result => { setProfile(result); setForm(profileToForm(result)); })
      .catch(requestError => setLoadError(requestError instanceof Error ? requestError.message : 'Unable to load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  function startEdit() {
    if (!profile) return;
    setForm(profileToForm(profile));
    setErrors({});
    setPendingAsset(null);
    setRemoveImageFlag(false);
    setError('');
    setNotice('');
    setEditing(true);
  }

  function cancelEdit() {
    if (profile) setForm(profileToForm(profile));
    setErrors({});
    setPendingAsset(null);
    setRemoveImageFlag(false);
    setError('');
    setEditing(false);
  }

  function update(field: keyof ProfileForm, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to choose a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const problem = validateProfileImage(asset);
    if (problem) { setError(problem); return; }
    setPendingAsset(asset);
    setRemoveImageFlag(false);
    setError('');
  }

  async function save() {
    if (saving) return;
    const nextErrors = validateProfileForm(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      let result = await updateProfile(form);
      if (pendingAsset) {
        try {
          result = await uploadProfileImage(pendingAsset);
        } catch (photoError) {
          setProfile(result);
          setForm(profileToForm(result));
          setError(`Your details were saved, but your photo could not be updated. ${photoError instanceof Error ? photoError.message : 'Please try again.'}`);
          setEditing(false);
          return;
        }
      } else if (removeImageFlag) {
        try {
          result = await removeProfileImage();
        } catch (photoError) {
          setProfile(result);
          setForm(profileToForm(result));
          setError(`Your details were saved, but your photo could not be removed. ${photoError instanceof Error ? photoError.message : 'Please try again.'}`);
          setEditing(false);
          return;
        }
      }
      setProfile(result);
      setForm(profileToForm(result));
      setNotice('Your profile has been updated.');
      setEditing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  const displayName = editing ? form.name : profile?.name ?? '';
  const displayImageUrl = editing
    ? (removeImageFlag ? undefined : pendingAsset?.uri ?? resolveImageUrl(profile?.profile_image_url ?? null))
    : resolveImageUrl(profile?.profile_image_url ?? null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.topBar}>
          <Text style={styles.eyebrow}>YOUR VAULT ACCOUNT</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close profile" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <View style={styles.heading}>
          <View style={styles.avatar}>
            {displayImageUrl ? (
              <Image source={{ uri: displayImageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallback}>{profileInitial(displayName)}</Text>
            )}
          </View>
          <View style={styles.headingText}>
            <Text style={styles.title}>Profile</Text>
            {!!profile && (
              <>
                <Text style={styles.identityName}>{profile.name}</Text>
                <Text style={styles.identityEmail}>{profile.email}</Text>
              </>
            )}
          </View>
        </View>

        {loading && <ActivityIndicator color={colors.darkGreen} style={styles.spacingTop} />}
        {!!loadError && (
          <View style={styles.spacingTop}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable style={styles.secondaryButton} onPress={load}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}
        {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
        {!!error && <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>}

        {!!profile && !editing && (
          <>
            <ProfileFacts profile={profile} />
            <Pressable style={styles.primaryButton} onPress={startEdit}>
              <Text style={styles.primaryButtonText}>Edit Profile</Text>
            </Pressable>
          </>
        )}

        {!!profile && editing && (
          <>
            <View style={styles.photoButtons}>
              <Pressable style={styles.secondaryButton} onPress={pickImage} disabled={saving}>
                <Text style={styles.secondaryButtonText}>{displayImageUrl ? 'Change photo' : 'Upload photo'}</Text>
              </Pressable>
              {!!displayImageUrl && (
                <Pressable
                  style={styles.secondaryButton}
                  disabled={saving}
                  onPress={() => { setPendingAsset(null); setRemoveImageFlag(true); }}
                >
                  <Text style={styles.secondaryButtonText}>Remove photo</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.photoHint}>JPEG, PNG, or WEBP · maximum 5 MB</Text>

            {fields.map(field => (
              <View key={field.name} style={styles.field}>
                <Text style={styles.fieldLabel}>{field.label}{field.optional && <Text style={styles.optional}>  Optional</Text>}</Text>
                <TextInput
                  style={[styles.input, errors[field.name] && styles.inputError]}
                  value={form[field.name]}
                  onChangeText={value => update(field.name, value)}
                  editable={!saving}
                />
                {!!errors[field.name] && <Text style={styles.fieldError}>{errors[field.name]}</Text>}
              </View>
            ))}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email  <Text style={styles.optional}>Read only</Text></Text>
              <TextInput style={[styles.input, styles.readOnlyInput]} value={profile.email} editable={false} />
            </View>

            <View style={styles.actions}>
              <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={cancelEdit} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.logoutRow}>
          <Pressable style={styles.secondaryButton} onPress={() => void handleLogout()} disabled={loggingOut}>
            <Text style={styles.secondaryButtonText}>{loggingOut ? 'Signing out…' : 'Log out'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

function ProfileFacts({ profile }: { profile: Profile }) {
  const fact = (label: string, value: string | null) => (
    <View style={styles.factRow} key={label}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, !value && styles.factEmpty]}>{value || 'Not provided'}</Text>
    </View>
  );
  return (
    <>
      {fact('Full name', profile.name)}
      {fact('Email', profile.email)}
      {fact('Phone', profile.phone)}
      <Text style={styles.sectionTitle}>Address</Text>
      {fact('Address', profile.address)}
      {fact('City', profile.city)}
      {fact('Province / State', profile.province)}
      {fact('Postal code', profile.postal_code)}
      {fact('Country', profile.country)}
      <Text style={styles.sectionTitle}>Account</Text>
      {fact('Role', profile.role)}
      {fact('Member since', formatMemberSince(profile.created_at))}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.chipBackground, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { fontFamily: serif, fontSize: 26, color: colors.darkGreen },
  headingText: { flexShrink: 1 },
  title: { fontFamily: serif, fontSize: 24, color: colors.text },
  identityName: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4 },
  identityEmail: { fontSize: 12, color: colors.muted },
  spacingTop: { marginTop: 16 },
  noticeText: { fontSize: 12, color: colors.inStock, marginBottom: 12 },
  errorText: { fontSize: 12, color: '#8c3f38', marginBottom: 12 },
  sectionTitle: { fontFamily: serif, fontSize: 18, color: colors.text, marginTop: 20, marginBottom: 10 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.headerBorder },
  factLabel: { fontSize: 12, color: colors.muted },
  factValue: { fontSize: 12, color: colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  factEmpty: { color: '#a3ab9c', fontWeight: '400' },
  photoButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  photoHint: { fontSize: 10, color: colors.muted, marginTop: 8, marginBottom: 18 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  optional: { fontSize: 9, color: '#a3ab9c' },
  input: { backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text },
  readOnlyInput: { color: colors.muted },
  inputError: { borderColor: '#8c3f38' },
  fieldError: { fontSize: 10, color: '#8c3f38', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 20 },
  disabled: { opacity: 0.7 },
  primaryButton: { flex: 1, backgroundColor: colors.darkGreen, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 30, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  logoutRow: { marginTop: 30, marginBottom: 10 },
});
