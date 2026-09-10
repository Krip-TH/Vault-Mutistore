# Moodeng MultiStore API Contract

Each business may keep its current API paths and response structure. The Moodeng MultiStore backend will place an adapter in `backend/src/adapters/<business>` between each external API and the application. The adapter maps business-specific responses to this shared format. Real API requests are not implemented yet.

## Normalized product

```json
{
  "id": "string",
  "name": "string",
  "category": "string",
  "price": 0,
  "stock": 0,
  "unit": "pcs",
  "image_url": "string",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Identifier from the source API |
| `name` | string | Product display name |
| `category` | string | Normalized category |
| `price` | number | Non-negative price in the agreed currency |
| `stock` | number | Available quantity |
| `unit` | string | Stock unit, such as `pcs` |
| `image_url` | string | Absolute image URL, or an empty string |
| `updated_at` | string | ISO-8601 source update timestamp |

Each adapter will fetch its assigned API, handle its authentication and errors, convert source data to this format, and return only normalized products to the service layer. API URLs and credentials belong in environment variables, never source control.
