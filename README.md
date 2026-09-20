# VAULT — Multi-Store Marketplace Application

VAULT — Multi-Store Marketplace Application is a central stock-management web application for a university Internet Programming group project. It will collect product stock data from six independently developed business APIs, normalize that data, and present it through one shared application.

This repository currently provides the shared infrastructure only. Real external API integrations are intentionally left for each team member's feature work.

## Architecture

```text
Browser -> React frontend -> Express REST API -> MySQL
                              |
                              +-> future business API adapters
```

The backend owns the normalized product model. Each future adapter can consume its business's existing API format and map it to the common contract documented in [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

## API Integration Workflow

```text
6 External APIs
       ↓
6 Business Adapters
       ↓
Normalized Product Format
       ↓
Backend API
       ↓
Frontend Dashboard
```

Each business keeps its original API response structure. Its adapter maps that structure to the shared product type, including a consistent stock status, before data reaches the service layer. The existing mock product remains active until real integrations are ready.

External API base URLs are configured in `.env` using `DOOR_API_URL`, `PLUG_API_URL`, `BRANDNAME_API_URL`, `CLOTHING_API_URL`, `POWERBANK_API_URL`, and `PROJECTOR_API_URL`. Start by copying `.env.example`; never commit the resulting `.env` file or API secrets.

See the [API contract](docs/API_CONTRACT.md) for the normalized fields and mapping examples. Group members should follow the [Member API Integration Guide](docs/MEMBER_API_GUIDE.md) when connecting their assigned API.

## Technology stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: MySQL 8
- Database administration: phpMyAdmin
- Infrastructure: Docker and Docker Compose

## Supported businesses

1. Door
2. Electrical Plug
3. Brandname (bags, shoes, watches, and similar products)
4. Clothing
5. Powerbank
6. Projector

## Project structure

```text
VAULT/
|-- frontend/            React application
|-- backend/             Express REST API and future adapters
|-- database/init.sql    MySQL schema and seed data
|-- docs/                API contract and member integration guide
|-- docker-compose.yml   Local multi-service environment
|-- .env.example         Safe environment-variable template
`-- README.md
```

## Prerequisites

- Docker Desktop (with Docker Compose)
- Git

For development without Docker, install Node.js 20 or newer, npm, and MySQL 8.

## Quick start with Docker

1. Clone the repository and enter its directory.
2. Copy the environment template with `Copy-Item .env.example .env` on Windows, or `cp .env.example .env` on macOS/Linux.
3. Change the placeholder passwords in `.env` if the environment is shared.
4. Run:

   ```bash
   docker compose up -d --build
   ```

Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/api/health
- phpMyAdmin: http://localhost:8080

Run `docker compose down` to stop the services. The named MySQL volume preserves data between restarts.

`database/init.sql` runs automatically only when MySQL initializes a new empty volume. For an existing development volume, apply `database/migrations/001_orders.sql` once through MySQL or phpMyAdmin before using checkout.

## Local development

Run `npm install` and `npm run dev` separately in `frontend` and `backend`. Copy `.env.example` to `.env` before connecting to the Compose database. During local development, the frontend proxies `/api` requests to `http://localhost:3000`.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| GET | `/api/products` | Live normalized products from configured business adapters |
| GET | `/api/businesses` | Supported businesses (mock data for now) |
| GET | `/api/stock/summary` | Stock overview (mock data for now) |
| POST | `/api/orders` | Validate live inventory and create an order |
| GET | `/api/orders` | List the 100 newest saved orders |
| GET | `/api/orders/:orderNo` | Retrieve a saved order by public order number |

## Team development workflow

```text
main
|-- feature/door-api
|-- feature/plug-api
|-- feature/brandname-api
|-- feature/clothing-api
|-- feature/powerbank-api
`-- feature/projector-api
```

1. Pull the latest `main`.
2. Create or switch to the appropriate feature branch.
3. Make focused changes for that business adapter.
4. Commit with a clear message.
5. Push the feature branch.
6. Open a Pull Request into `main`.
7. Ask another member to review it.
8. Merge only after review and successful checks.

Do not commit `.env`, generated build output, or `node_modules`. Each member may keep their existing API response structure; normalization belongs in the matching backend adapter.
