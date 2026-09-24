import { Platform } from 'react-native';

/**
 * Design tokens copied verbatim from the web storefront (frontend/src/index.css)
 * so the pilot can be compared against it fairly.
 */
export const colors = {
  background: '#f8f6f0',
  text: '#263a30',
  darkGreen: '#294638',
  cardBackground: '#fbfaf6',
  cardBorder: '#e3e1d6',
  imageBackground: '#eeece4',
  headerBorder: '#deded3',
  muted: '#73796e',
  categoryText: '#72796b',
  unitText: '#75796f',
  chipBackground: '#eeece4',
  chipText: '#60675d',
  pill: 'rgba(250, 249, 243, 0.93)',
  inStock: '#46684a',
  lowStock: '#926124',
  outOfStock: '#965b51',
  placeholderText: '#697667',
  placeholderBorder: '#c9cec1',
  placeholderMark: '#385443',
  skeleton: '#e9e6dc',
} as const;

/**
 * The web uses Georgia for headings. iOS ships Georgia; Android does not, so it
 * falls back to its generic serif — one of the small fidelity gaps that comes
 * with leaving the browser behind.
 */
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });

export const sans = Platform.select({ ios: 'System', default: 'sans-serif' });
