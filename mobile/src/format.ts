/**
 * The web storefront uses Intl.NumberFormat('th-TH', { currency: 'THB' }).
 * Intl support varies by JS engine build on device, so this reproduces the same
 * "฿20,000.00" output directly instead of depending on it.
 */
export function formatTHB(value: number): string {
  if (!Number.isFinite(value)) return '';
  const [whole, fraction] = Math.abs(value).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}฿${grouped}.${fraction}`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
