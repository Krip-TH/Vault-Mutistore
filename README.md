# Moodeng MultiStore

Moodeng MultiStore is a central stock-management web application for a university Internet Programming group project. It will collect product stock data from six independently developed business APIs, normalize that data, and present it through one shared application.

This repository currently provides the shared infrastructure only. Real external API integrations are intentionally left for each team member's feature work.

## Architecture

```text
Browser -> React frontend -> Express REST API -> MySQL
                              |
                              +-> future business API adapters
```

The backend owns the normalized product model. Each future adapter can consume its business's existing API format and map it to the common contract documented in [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

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
Moodeng-MultiStore/
|-- frontend/            React application
|-- backend/             Express REST API and future adapters
|-- database/init.sql    MySQL schema and seed data
|-- docs/API_CONTRACT.md Shared normalized product contract
|-- docker-compose.yml   Local multi-service environment
|-- .env.example         Safe environment-variable template
`-- README.md
```

## Prerequisites

- Docker Desktop (with Docker Compose)
- Git

For development without Docker, install Node.js 20 or newer and npm. MySQL 8 is also required if database access is added locally.

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

## Local development

Run `npm install` and `npm run dev` separately in `frontend` and `backend`. Copy `.env.example` to `.env` before connecting to the Compose database. During local development, the frontend proxies `/api` requests to `http://localhost:3000`.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| GET | `/api/products` | Normalized products (mock data for now) |
| GET | `/api/businesses` | Supported businesses (mock data for now) |
| GET | `/api/stock/summary` | Stock overview (mock data for now) |

## Team development workflow

```text
main
|-- feature/door-api
|-- feature/plug-api
|-- feature/brand-api
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
