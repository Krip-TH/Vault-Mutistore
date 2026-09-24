# VAULT Mobile — React Native pilot

A React Native (Expo) proof of concept that reproduces the web storefront's sign-in and
product collection screens. It exists to answer one question before the team commits to a
mobile app: **how closely can React Native match the existing web UI, and what does it cost?**

This is a pilot, not a port. It reuses the existing Express backend — extended, not
replaced, see "Auth" below — and re-implements sign-in/register, product browsing and
detail, cart, checkout, order history, the customer profile, the four AI features
(search, chat, recommendations, descriptions), the admin dashboard (analytics, orders,
claims, product CRUD, user and business management), Best Sellers, and the full
product-claims/warranty system (customer and admin).

The `dev` branch's database-aware AI assistant
(`backend/src/services/ai/databaseChatService.ts`) needed no mobile changes at all: it
replaced `POST /api/ai/chat`'s implementation in place, behind the exact same request and
response shape (`{ messages } → { reply }`), so the existing chat widget picked it up for
free the moment `dev` was merged into this branch. It can now also answer from the
customer's live orders, profile, and claims — the same Bearer-token identity the chat
widget already sends is all the backend's tools need.

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
   so copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to that computer's LAN IP:

   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000
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

If the profile screen or checkout fails with a 500 mentioning an unknown column
(`phone`, `vault_products`, etc.), an existing local database predates a migration.
Apply any pending file in `database/migrations/` — see the root `README.md`'s
"Database compatibility" section for the exact command.

Since SDK 57, **Expo Go on iOS requires signing in**, on both the computer (`npx expo
login`) and the Expo Go app itself, with the same account — this is an Expo policy change,
unrelated to this project. See the [Expo changelog](https://expo.dev/changelog/expo-go-57-login).

## What this pilot covers

- Sign in and create an account, matching the web's validation (name required to
  register, a valid email, an 8+ character password) and error copy. The session
  persists across app restarts. Sign-in also has a distinct Admin entry point ("Administrator?
  Admin sign in →"), ported from the web's `AuthPage.tsx`: the same `/api/auth/login`
  request, but `AuthContext.loginAdmin` only keeps the session if the account's role is
  `admin`, otherwise it fails with "This account does not have administrator access."
  and nothing is persisted.
- A hamburger navigation drawer (`src/components/NavigationDrawer.tsx`), ported from the
  web's `NavigationDrawer.tsx`: a "☰" button next to the brand mark opens a sheet listing
  Best Sellers, My Orders, My Claims, Profile, and Admin (only for `user.role === 'admin'`),
  with the signed-in customer's name, email, and a log out button in the footer. Cart and
  Profile stay as quick-access icons in the header itself, since they're the two most
  frequent actions — the same split the web uses between its drawer and its account menu.
- Product collection screen: brand header, section heading, business filter chips,
  two-column product grid, results count, and the partial-inventory notice.
- Product card: image with fallback tile, business pill, category, name, THB price,
  stock quantity, and stock badge.
- Product detail: image, price, availability, details, a quantity stepper, and Add to
  cart — with the web's exact stock-clamping rules (`src/purchase.ts`).
- Cart: grouped by business, quantity controls, remove, subtotal, and an unavailable-item
  warning that blocks checkout — ported line-for-line from the web's cart logic
  (`src/cart/cartState.ts`) so behavior matches exactly; only the storage layer differs
  (`AsyncStorage` instead of `localStorage`).
- Checkout: the web's exact shipping-form validation and copy (`src/checkout.ts`), an
  order review with live totals, and a confirmation screen after a real order is placed.
- Order history: a list of past orders and a detail view per order, both authenticated
  with the Bearer token from Phase 1.
- Customer profile: view and edit contact/address details, and upload or remove a profile
  photo via the device's photo library (`expo-image-picker`), matching the web's
  validation limits and field-by-field error copy (`src/profile.ts`).
- AI natural-language search above the product grid, a floating shopping-assistant chat
  widget (database-aware since the `dev` merge: answers from the customer's live orders,
  profile, and claims when signed in, since the Bearer token is attached when present),
  AI-picked related products on the detail screen, and an AI-generated description when a
  product has none. All four fail silently and hide themselves if `/api/ai/*` is ever
  unavailable — same rule as the web, no backend changes needed since the Phase 1
  Bearer-token support already covers these routes.
- Pull to refresh, loading state, error state with retry, and empty state.
- Admin dashboard, gated behind an "Admin" link shown only to signed-in admins
  (`user.role === 'admin'`): a KPI dashboard with revenue, order, customer and inventory
  charts (`react-native-chart-kit`) and the K-means product-segmentation summary; order
  management with status updates; claims management (filter, open a claim, move it
  through its status transitions with a customer-visible or internal note, view its
  evidence and history); product CRUD, including image upload from the device's photo
  library or an external URL, and read-only handling for externally managed products; and
  user and business management, matching the web dashboard's rules (e.g. an admin cannot
  delete their own account).
- Best Sellers, behind a "Best Sellers" header link: products ranked by units sold from
  completed orders, paired with each product's live price and stock (`/api/products/best-sellers`),
  reusing `ProductCard` and opening straight into the same product detail view as the
  main collection.
- Product claims/warranty, customer side: a "Submit a claim" button on any shipped or
  delivered order and a "Claims" header link. The form picks the affected products and
  quantities, a reason, a description, and up to 5 evidence photos (`expo-image-picker`,
  uploaded as multipart form data); My Claims lists every claim with a status filter, and
  its detail view shows the claimed products, a progress timeline built from the claim's
  history, the evidence gallery (loaded through an authenticated request, since evidence
  is private — see `src/claimApi.ts`), and a cancel action while the claim is still early
  enough to cancel. Ported from `frontend/src/components/ClaimForm.tsx` and `MyClaims.tsx`.

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
| Web dashboard's price-vs-stock scatter plot (K-means) | `react-native-chart-kit` has no scatter chart | Replaced with the same cluster data as summary cards instead of a scatter plot |

## Effort estimate for a full port

Every screen here — about a third of the web app's roughly thirty components — required
rewriting every element and every style from scratch, because React Native shares no
markup or CSS with the web. What's still missing to cover the rest of the web app:

- the hash-based router (`window.location.hash`) is not used here — every screen is
  reached through modals and local state instead of React Navigation, which is what a
  full app with more than a handful of screens would need,
- favourites (the web's "save for later") are not built,
- the printable claim/warranty document (`frontend/src/components/ClaimDocument.tsx`,
  the web's `WarrantyDocument` and `ClaimPrintDocument`) was skipped — printing to PDF
  is not a mobile pattern, and the mobile claim form already shows eligibility and the
  claimable items directly, so nothing is lost for the customer, only the standalone
  printable view.

Already done, for reference: auth works with a Bearer token instead of the cookie
(`backend/src/middleware/auth.ts` accepts either), the cart uses `AsyncStorage` in place
of `localStorage`, all four AI features work unmodified on the backend side — the
Phase 1 auth change was enough for `/api/ai/chat` to recognize a signed-in user too —
and the admin dashboard (Phase 5) reuses the same `/api/admin` routes as the web
dashboard, gated by the same `requireAdmin` middleware and a Bearer token instead of
the session cookie.

Treat a full mobile app as building a second frontend against the same backend, not as
converting the existing one.
