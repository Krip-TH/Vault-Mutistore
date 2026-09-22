import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ProductsScreen from './src/screens/ProductsScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ProductsScreen />
    </SafeAreaProvider>
  );
}
