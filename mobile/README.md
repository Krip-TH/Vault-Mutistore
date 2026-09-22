# VAULT Mobile — React Native pilot

A React Native (Expo) proof of concept that reproduces the web storefront's sign-in and
product collection screens. It exists to answer one question before the team commits to a
mobile app: **how closely can React Native match the existing web UI, and what does it cost?**

This is a pilot, not a port. It reuses the existing Express backend — extended, not
replaced, see "Auth" below — and re-implements only sign-in/register and the product
listing and detail views. Cart, checkout, orders, AI features and admin are not built yet.

## Auth

The web session uses an httpOnly cookie, which a bare `fetch` on React Native cannot
store or send automatically the way a browser does. So login and register now also return
the same JWT in the JSON response body (`{ data: user, token }`) alongside the cookie —
**the web app's cookie flow is unchanged**; this is additive only. The backend accepts
either the cookie or an `Authorization: Bearer <token>` header
(`backend/src/middleware/auth.ts`), and the app stores the token with `expo-secure-store`
(the mobile equivalent of an httpOnly cookie: encrypted, not readable by other apps) and
sends it as a Bearer header on every request that needs it.

## Running it on a phone

1. Start the VAULT backend as usual (`docker compose up -d` in the repository root).
2. Point the app at the computer running that backend. A phone cannot reach `localhost`,
   so edit `src/config.ts` and set `API_BASE_URL` to that computer's LAN IP:

   ```ts
   export const API_BASE_URL = 'http://192.168.1.50:3000';
   ```

   Find the IP with `ipconfig` on Windows (IPv4 Address of the Wi-Fi adapter).

3. Install dependencies and start the dev server:

   ```bash
   cd mobile
   npm install
   npx expo start
   ```

4. Install **Expo Go** on the phone, make sure the phone is on the same Wi-Fi as the
   computer, and scan the QR code shown in the terminal.

If products do not load, the phone almost always cannot reach the backend: confirm both
devices are on the same Wi-Fi and that Windows Firewall allows inbound TCP on port 3000.

Since SDK 57, **Expo Go on iOS requires signing in**, on both the computer (`npx expo
login`) and the Expo Go app itself, with the same account — this is an Expo policy change,
unrelated to this project. See the [Expo changelog](https://expo.dev/changelog/expo-go-57-login).

## What this pilot covers

- Sign in and create an account, matching the web's validation (name required to
  register, a valid email, an 8+ character password) and error copy. The session
  persists across app restarts.
- Product collection screen: brand header, section heading, business filter chips,
  two-column product grid, results count, and the partial-inventory notice.
- Product card: image with fallback tile, business pill, category, name, THB price,
  stock quantity, and stock badge.
- Product detail: opened by tapping a card, with image, price, availability, and details.
- Pull to refresh, loading state, error state with retry, and empty state.

## What matched the web, and what could not

Everything below was reproduced faithfully: the colour palette, copy, information
hierarchy, card layout, spacing, chips, badges, and the THB price format.

These are the gaps, and they are the point of the pilot:

| Web | React Native | Effect |
| --- | --- | --- |
| `mix-blend-mode: multiply` on product images | No blend modes exist | Product photos with a white background show a white box instead of melting into the beige tile |
| `Georgia` serif headings | Georgia only ships on iOS | Android falls back to its generic serif, so headings look slightly different |
| CSS Grid (`grid-template-columns`) | Flexbox only | Grid is rebuilt with a two-column `FlatList`; close, but a different mechanism |
| `:hover` lift and shadow on cards | Touch screens have no hover | Replaced with a pressed state |
| `<dialog>` + `showModal()` + CSS keyframes | `<Modal>` with platform transitions | The detail view slides in with the OS animation rather than the web's custom one |
| `backdrop-filter: blur()` | Limited support | Not used in this pilot |
| `Intl.NumberFormat` | Varies by device JS engine | Prices are formatted manually to guarantee identical output |

## Effort estimate for a full port

This screen alone — two views out of roughly thirty components in the web app — required
rewriting every element and every style from scratch, because React Native shares no
markup or CSS with the web. Porting the whole storefront would also require replacing:

- the hash-based router (`window.location.hash`) with React Navigation,
- `sessionStorage` cart and favourites with `AsyncStorage`,
- and, most significantly, the httpOnly **cookie** session with token-based auth, which
  means changing `backend/src/controllers/authController.ts` and
  `backend/src/middleware/auth.ts` as well.

Treat a full mobile app as building a second frontend against the same backend, not as
converting the existing one.
