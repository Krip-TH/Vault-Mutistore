import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, serif } from '../theme';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function switchMode(next: boolean) {
    setIsRegister(next);
    setError('');
    setPassword('');
  }

  async function submit() {
    setError('');
    if (isRegister && !name.trim()) { setError('Enter your full name.'); return; }
    if (!emailPattern.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ name: name.trim(), email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>VAULT</Text>
        <Text style={styles.title}>{isRegister ? 'Create your account.' : 'Welcome back.'}</Text>
        <Text style={styles.subtitle}>
          {isRegister
            ? 'Join VAULT to place orders and follow your purchase history.'
            : 'Sign in to continue.'}
        </Text>

        {isRegister && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              editable={!submitting}
              autoComplete="name"
              placeholder="Wanwisa Seethapthim"
              placeholderTextColor="#a3ab9c"
            />
          </View>
        )}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="you@example.com"
            placeholderTextColor="#a3ab9c"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
            secureTextEntry
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            placeholderTextColor="#a3ab9c"
          />
        </View>

        {!!error && (
          <Text style={styles.error} accessibilityRole="alert">{error}</Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, submitting && styles.submitDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{isRegister ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>{isRegister ? 'Already have an account?' : 'New to VAULT?'}</Text>
          <Pressable onPress={() => switchMode(!isRegister)} disabled={submitting}>
            <Text style={styles.switchLink}>{isRegister ? 'Sign in' : 'Create an account'}</Text>
          </Pressable>
        </View>

        {isRegister && (
          <Text style={styles.roleNote}>
            New accounts are created as customer accounts. Administrator access is assigned privately.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 28 },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2, color: colors.text },
  title: { fontFamily: serif, fontSize: 30, color: colors.text, marginTop: 10, lineHeight: 36 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 10, marginBottom: 28, lineHeight: 19 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: '#efede6',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: colors.text,
  },
  error: { color: '#8c3f38', fontSize: 12, marginBottom: 14 },
  submit: {
    backgroundColor: colors.darkGreen,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  submitPressed: { backgroundColor: '#3a5745' },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22 },
  switchText: { fontSize: 12, color: colors.muted },
  switchLink: { fontSize: 12, color: colors.darkGreen, fontWeight: '600', textDecorationLine: 'underline' },
  roleNote: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
