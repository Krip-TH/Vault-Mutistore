import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, serif } from '../theme';

export type NavigationTarget = 'bestSellers' | 'orders' | 'claims' | 'profile' | 'admin';

interface Props {
  visible: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onNavigate: (target: NavigationTarget) => void;
}

const links: Array<{ target: NavigationTarget; label: string; adminOnly?: boolean }> = [
  { target: 'bestSellers', label: 'Best Sellers' },
  { target: 'orders', label: 'My Orders' },
  { target: 'claims', label: 'My Claims' },
  { target: 'profile', label: 'Profile' },
  { target: 'admin', label: 'Admin', adminOnly: true },
];

/** Ported from the web's NavigationDrawer.tsx: a hamburger-triggered drawer of customer navigation. */
export default function NavigationDrawer({ visible, isAdmin, onClose, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  function select(target: NavigationTarget) {
    onClose();
    onNavigate(target);
  }

  async function signOut() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      onClose();
    } catch {
      setLogoutError('Unable to sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top ? 0 : 12 }]}>
        <View style={styles.header}>
          <View style={styles.brandGroup}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>V.</Text></View>
            <Text style={styles.brandName}>VAULT</Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close navigation" hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <View style={styles.links}>
          {links.filter(link => !link.adminOnly || isAdmin).map(link => (
            <Pressable key={link.target} style={styles.linkRow} onPress={() => select(link.target)}>
              <Text style={[styles.linkText, link.target === 'admin' && styles.adminLinkText]}>{link.label}</Text>
              <Text style={styles.linkArrow}>→</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.footerName}>{user?.name}</Text>
          <Text style={styles.footerEmail}>{user?.email}</Text>
          <Pressable style={styles.logoutButton} onPress={() => void signOut()} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color={colors.text} /> : <Text style={styles.logoutText}>Log out</Text>}
          </Pressable>
          {!!logoutError && <Text style={styles.errorText}>{logoutError}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontFamily: serif, fontSize: 18, color: '#fff' },
  brandName: { fontFamily: serif, fontSize: 18, color: colors.text },
  close: { fontSize: 24, color: colors.text, lineHeight: 26 },
  links: { paddingHorizontal: 22, paddingTop: 10 },
  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.headerBorder,
  },
  linkText: { fontFamily: serif, fontSize: 20, color: colors.text },
  adminLinkText: { color: '#8f6846' },
  linkArrow: { fontSize: 16, color: colors.muted },
  footer: {
    marginTop: 'auto', paddingHorizontal: 22, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.headerBorder, gap: 4,
  },
  footerName: { fontSize: 13, color: colors.text, fontWeight: '600' },
  footerEmail: { fontSize: 11, color: colors.muted, marginBottom: 12 },
  logoutButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  logoutText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  errorText: { fontSize: 11, color: '#8c3f38', marginTop: 8 },
});
