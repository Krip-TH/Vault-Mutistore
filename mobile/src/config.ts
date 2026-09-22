/**
 * A phone cannot reach "localhost" — that would point at the phone itself.
 * Use the LAN IP of the computer running the VAULT backend, and keep the phone
 * on the same Wi-Fi network.
 *
 * Find it on Windows with `ipconfig` (IPv4 Address of the Wi-Fi adapter),
 * or on macOS/Linux with `ifconfig`.
 */
export const API_BASE_URL = 'http://192.168.1.50:3000';

export const REQUEST_TIMEOUT_MS = 15_000;
