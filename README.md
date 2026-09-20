# VAULT — Multi-Store Marketplace Application

VAULT is a multi-business marketplace for a university Internet Programming group project. It aggregates stock from six independently developed product APIs, normalizes their responses, and provides authenticated customer ordering and administrator order management.

## Architecture

```text
Browser -> React frontend -> Express REST API -> MySQL
                              |
                              +-> six business adapters -> external product APIs
```

The backend owns the normalized product contract. Each adapter maps its business API into that contract before data reaches the frontend or checkout service. Adapter failures are isolated: one unavailable upstream does not prevent products from healthy businesses being returned, and VAULT never invents replacement inventory.

## Technology stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: MySQL 8
- Database administration: phpMyAdmin
- Infrastructure: Docker Compose

## Supported businesses

1. Door / ImperialWood
2. Electrical Plug
3. Brandname
4. Clothing
5. Powerbank
6. Projector

See [the API contract](docs/API_CONTRACT.md) for normalized fields and [the member guide](docs/MEMBER_API_GUIDE.md) for adapter integration guidance.

## Project structure

```text
VAULT/
|-- frontend/            React storefront, customer flows, and admin dashboard
|-- backend/             Express API, authentication, orders, admin, and adapters
|-- database/init.sql    Complete fresh-install MySQL schema
|-- database/migrations/ Historical and forward database migrations
|-- docs/                API contract and integration guide
|-- docker-compose.yml   Local multi-service environment
`-- .env.example         Safe environment-variable template
```

## Quick start with Docker

Prerequisites are Docker Desktop with Docker Compose and Git.

1. Clone the repository and enter its directory.
2. Copy `.env.example` to `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

   On macOS or Linux, use `cp .env.example .env`.

3. Replace the example passwords and JWT secret in the local `.env`. Never commit that file.
4. Ensure the team’s compatibility volume exists. This is idempotent and does not replace existing data:

   ```bash
   docker volume create moodengmultistore_mysql_data
   ```

5. Start the environment:

   ```bash
   docker compose up -d --build
   ```

Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/api/health
- phpMyAdmin: http://localhost:8080

Sign in to phpMyAdmin with `MYSQL_USER` and `MYSQL_PASSWORD` from the local `.env`. Run `docker compose down` to stop services without deleting data. Never use `docker compose down -v` when the development data must be preserved.

## Database compatibility

The active application database and user are `vault_multistore` and `vault_user`, configured through `MYSQL_DATABASE` and `MYSQL_USER`. The external Docker volume intentionally retains its historical name, `moodengmultistore_mysql_data`, so existing team data remains attached. The volume name does not determine which database the backend uses and must not be renamed or deleted during normal setup.

`database/init.sql` runs only when MySQL initializes a new empty volume and creates the complete current schema. `database/migrations/002_order_ownership.sql` is a one-time forward migration for an existing VAULT database that predates order ownership. `database/migrations/001_orders.sql` is retained as history for the former database and must not initialize a new VAULT database.

Changing `MYSQL_DATABASE` alone does not create or copy data in an existing volume. The non-destructive `database/migrate-to-vault.sh` utility copies an absent or empty target, verifies a populated target without overwriting it, preserves the legacy source database as rollback, and refreshes the application-user grant. Review its output before switching runtime configuration.

The seeded local administrator is documented in `database/init.sql`. Change its password before using the project outside an isolated development environment.

## Local development

For development without Docker, install Node.js 20 or newer, npm, and MySQL 8. Copy `.env.example` to `.env`, then run `npm install` and `npm run dev` separately in `backend` and `frontend`. Vite proxies `/api` to `http://localhost:3000` by default.

External URLs are configured with `DOOR_API_URL`, `PLUG_API_URL`, `BRANDNAME_API_URL`, `CLOTHING_API_URL`, `POWERBANK_API_URL`, and `PROJECTOR_API_URL`.

## Authentication and workflows

- Customers can register, sign in, restore an HTTP-only cookie session, add live products to a persisted cart, check out, and view only their own orders.
- The backend derives `user_id` from the signed session. The frontend cannot choose order ownership.
- Administrators can view dashboard metrics, list all orders, inspect order details, and update an order to a validated status.
- Backend middleware enforces authentication and administrator roles. Frontend route guards are only a usability layer.
- Historical orders with `NULL` ownership remain visible to administrators but are intentionally hidden from customer endpoints.

Order numbers retain the historical `MDG-` prefix for compatibility with existing records. The session cookie and browser-storage keys also retain legacy names so upgrades do not invalidate sessions, carts, or favorites.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| GET | `/api/products` | Normalized products and per-business availability |
| GET | `/api/businesses` | Per-business upstream availability |
| GET | `/api/stock/summary` | Aggregate live stock overview |
| POST | `/api/auth/register` | Register a customer and start a session |
| POST | `/api/auth/login` | Authenticate and start a session |
| POST | `/api/auth/logout` | Clear the session |
| GET | `/api/auth/me` | Restore the current public user profile |
| POST | `/api/orders` | Authenticated checkout with live inventory validation |
| GET | `/api/orders` | List the signed-in customer’s newest orders |
| GET | `/api/orders/:orderNo` | Retrieve an order owned by the signed-in customer |
| GET | `/api/admin/dashboard` | Admin-only order and customer statistics |
| GET | `/api/admin/orders` | Admin-only list of all orders |
| GET | `/api/admin/orders/:orderNo` | Admin-only order details |
| PATCH | `/api/admin/orders/:orderNo/status` | Admin-only validated status update |

All order endpoints require authentication. Customer order reads are scoped by authenticated user ID. Every `/api/admin/*` endpoint additionally requires the signed `admin` role.

`GET /api/products` includes one `businesses` availability entry per adapter. `online` with zero products means the upstream answered successfully with no usable inventory; `unavailable` means the request failed or could not be parsed. Products from successful adapters remain in `data`.

## Build and test

Run each package independently:

```bash
cd backend
npm ci
npm run build
npm test

cd ../frontend
npm ci
npm run build
npm test
```

The frontend live-proxy product test is optional because teammates’ APIs may be offline. Set `VAULT_TEST_API_URL` to a running URL such as `http://localhost:5173/api/products` to enable it. Unit tests validate adapter normalization and partial failure isolation without external services.

GitHub Actions runs the backend and frontend builds and tests for pushes and pull requests targeting `dev` or `main`.

## External-service limitation

Inventory depends on six independently hosted services. An upstream may be unavailable because it is offline, times out, returns an HTTP error, or sends an invalid response. This does not stop VAULT or healthy adapters, but checkout cannot validate an item while that item’s source inventory is unavailable.

## Team workflow

1. Pull the latest `dev`.
2. Create a focused feature or fix branch.
3. Keep normalization in the matching adapter and never commit `.env`, secrets, `node_modules`, or build output.
4. Run the relevant builds and tests.
5. Push the feature branch and open a pull request into `dev`.
6. Promote integrated `dev` to `main` only after final review and successful CI.
