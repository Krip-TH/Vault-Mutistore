/**
 * A phone cannot reach "localhost" — that would point at the phone itself.
 * Set EXPO_PUBLIC_API_BASE_URL to the LAN address of the computer running the
 * VAULT backend, and keep the phone on the same Wi-Fi network.
 *
 * Find it on Windows with `ipconfig` (IPv4 Address of the Wi-Fi adapter),
 * or on macOS/Linux with `ifconfig`. The localhost fallback is for simulators
 * and web development only; a physical device must use the environment value.
 */
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || 'http://localhost:3000').replace(/\/+$/, '');
export const API_BASE_URL_IS_CONFIGURED = Boolean(configuredBaseUrl);

export const REQUEST_TIMEOUT_MS = 15_000;

export function resolveApiUrl(path: string): string {
  if (!path) return path;
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
