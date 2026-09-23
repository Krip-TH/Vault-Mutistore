import { API_BASE_URL, API_BASE_URL_IS_CONFIGURED, REQUEST_TIMEOUT_MS } from './config';

/** React Native-compatible request timeout; avoids relying on AbortSignal.timeout support. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    const method = init.method || 'GET';
    console.error(`[VAULT API] ${method} ${input} failed`, error);
    if (controller.signal.aborted) {
      throw new Error(`The server at ${API_BASE_URL} did not respond in time.`);
    }
    const setupHint = API_BASE_URL_IS_CONFIGURED
      ? `Check that the backend is running and that this device can reach ${API_BASE_URL}.`
      : 'Set EXPO_PUBLIC_API_BASE_URL to the development computer LAN address before testing on a phone.';
    throw new Error(`Unable to reach the VAULT server. ${setupHint}`);
  } finally {
    clearTimeout(timer);
  }
}
