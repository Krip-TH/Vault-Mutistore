import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { CartProvider } from './src/cart/CartContext';
import AuthScreen from './src/screens/AuthScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import { colors } from './src/theme';

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.darkGreen} />
      </View>
    );
  }

  return user ? <ProductsScreen /> : <AuthScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <CartProvider>
          <Root />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
