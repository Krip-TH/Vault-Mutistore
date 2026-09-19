# Powerbank Stock Product API

A standalone Stock Product API for the Powerbank business, built to the same conventions as the
central `backend` app (Node.js, Express, TypeScript, ESM). It is the "external" API that the
`powerbank` adapter in the main Moodeng MultiStore backend (`backend/src/adapters/powerbank/index.ts`)
integrates with, per the [Member API Integration Guide](../docs/MEMBER_API_GUIDE.md).

## Local development

```bash
cd powerbank-api
npm install
cp .env.example .env
npm run dev
```

The server listens on `http://localhost:4000` by default (override with `PORT`).

To connect the main backend to this service, set in the root `.env`:

```text
POWERBANK_API_URL=http://localhost:4000/api/powerbank
```

## Product fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Server-generated, e.g. `PB-001`. |
| `name` | string | Required. |
| `brand` | string | Optional. |
| `price` | number | Required, must be a positive number. |
| `stock` | number | Required, must be a non-negative integer. |
| `description` | string | Optional. |
| `image` | string | Optional image path. |
| `category` | string | Always `"Powerbank"`, set by the server. |
| `createdAt` / `updatedAt` | string | ISO 8601 timestamps managed by the server. |

## Endpoints

### GET /api/health

Health check.

```json
{ "status": "ok", "service": "Powerbank Stock Product API" }
```

### GET /api/powerbank

Returns all Powerbank products.

```json
{
  "data": [
    {
      "id": "PB-001",
      "name": "Anker PowerCore 10000",
      "brand": "Anker",
      "price": 990,
      "stock": 25,
      "description": "Compact 10,000mAh power bank with PowerIQ fast charging.",
      "image": "/images/powerbank/anker-powercore-10000.jpg",
      "category": "Powerbank",
      "createdAt": "2026-09-10T12:00:00.000Z",
      "updatedAt": "2026-09-10T12:00:00.000Z"
    }
  ],
  "source": "mock"
}
```

### GET /api/powerbank/:id

Returns one product.

- `200` with `{ "data": { ...product } }`
- `404` with `{ "error": "Powerbank product not found" }` when the id does not exist.

### POST /api/powerbank

Creates a product.

Request body:

```json
{
  "name": "Anker PowerCore 10000",
  "brand": "Anker",
  "price": 990,
  "stock": 25,
  "description": "Compact 10,000mAh power bank with PowerIQ fast charging.",
  "image": "/images/powerbank/anker-powercore-10000.jpg"
}
```

- `201` with `{ "data": { ...product } }`
- `400` with `{ "error": "<message>" }` when `name`, `price`, or `stock` is missing or invalid.

### PUT /api/powerbank/:id

Updates one or more fields of an existing product (`name`, `brand`, `price`, `stock`,
`description`, `image`). `id` and `category` cannot be changed.

- `200` with `{ "data": { ...product } }`
- `400` with `{ "error": "<message>" }` for an invalid field value.
- `404` with `{ "error": "Powerbank product not found" }` when the id does not exist.

### DELETE /api/powerbank/:id

Deletes a product.

- `200` with `{ "data": { ...deletedProduct } }`
- `404` with `{ "error": "Powerbank product not found" }` when the id does not exist.

## Error handling

- Invalid input returns `400` with a short `error` message; the field name and requirement are
  included (e.g. `"price must be a positive number"`).
- Unknown ids return `404` with `{ "error": "Powerbank product not found" }`.
- Unexpected failures return `500` with `{ "error": "Internal server error" }`; internal details
  are logged server-side only, never returned to the client.
- Unmatched routes return `404` with `{ "error": "Route not found" }`.

Data is stored in memory and resets whenever the service restarts, matching the mock-data
approach already used by the central backend (`backend/src/services/productService.ts`).
