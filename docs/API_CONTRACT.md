# VAULT — Multi-Store Marketplace Application API Contract

This contract defines the product format used inside VAULT — Multi-Store Marketplace Application. A member's external API does **not** need to use these field names. Each business adapter converts its source data before the backend or frontend uses it.

```text
External Member API
        ↓
Business Adapter
        ↓
Normalized Product
        ↓
VAULT — Multi-Store Marketplace Application Backend
```

## Official normalized product format

Every product returned by an adapter must contain all of these fields:

```json
{
  "id": "string",
  "business": "door",
  "business_name": "Door",
  "name": "string",
  "category": "string",
  "price": 0,
  "stock": 0,
  "unit": "pcs",
  "status": "In Stock",
  "image_url": "",
  "updated_at": "2026-09-10T12:00:00Z"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique product identifier. Convert numeric source IDs to strings. |
| `business` | string | Yes | Machine-readable business identifier from the allowed values below. |
| `business_name` | string | Yes | Human-readable business name, such as `Door`. |
| `name` | string | Yes | Product display name. |
| `category` | string | Yes | Product category supplied by or derived from the source API. |
| `price` | number | Yes | Product price as a number, not a formatted currency string. |
| `stock` | number | Yes | Current available stock quantity. |
| `unit` | string | Yes | Stock unit, normally `pcs`. |
| `status` | string | Yes | Stock label calculated from `stock` using the shared rules below. |
| `image_url` | string | Yes | Product image URL or an empty string when unavailable. |
| `updated_at` | string | Yes | ISO 8601 timestamp for the source update or adapter normalization time. |

The `business` value must be exactly one of:

- `door`
- `plug`
- `brandname`
- `clothing`
- `powerbank`
- `projector`

## Stock status rules

The backend adapter should calculate `status` with the shared `getStockStatus` helper whenever possible.

| Stock quantity | Status |
| --- | --- |
| `0` | `Out of Stock` |
| `1` through `5` | `Low Stock` |
| Greater than `5` | `In Stock` |

## Mapping example: Door

The Door API returns fields such as:

```json
{
  "product_id": 12,
  "product_name": "Modern Walnut Entrance Door",
  "category_name": "Door",
  "price": "24500.00",
  "total_stock": 5,
  "image_url": "/images/door12.jpg"
}
```

The Door adapter maps fields and converts values as follows:

| Source field | Normalized field | Conversion |
| --- | --- | --- |
| `product_id` | `id` | Convert to string |
| `product_name` | `name` | Use as text |
| `category_name` | `category` | Use as text |
| `price` | `price` | Convert to number |
| `total_stock` | `stock` | Convert to number |
| `image_url` | `image_url` | Use as text |

Normalized output:

```json
{
  "id": "12",
  "business": "door",
  "business_name": "Door",
  "name": "Modern Walnut Entrance Door",
  "category": "Door",
  "price": 24500,
  "stock": 5,
  "unit": "pcs",
  "status": "Low Stock",
  "image_url": "/images/door12.jpg",
  "updated_at": "..."
}
```

## Mapping example: Powerbank

The Powerbank Stock Product API returns:

```json
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
```

The Powerbank adapter maps `id`, `name`, `price`, and `stock` directly, and `updatedAt` to
`updated_at`. It converts `price` and `stock` to numbers and calculates the status:

```json
{
  "id": "PB-001",
  "business": "powerbank",
  "business_name": "Powerbank",
  "name": "Anker PowerCore 10000",
  "category": "Powerbank",
  "price": 990,
  "stock": 25,
  "unit": "pcs",
  "status": "In Stock",
  "image_url": "/images/powerbank/anker-powercore-10000.jpg",
  "updated_at": "2026-09-10T12:00:00.000Z"
}
```

## Expected external API behavior

The recommended source endpoint is:

```http
GET /products
```

The response may be a direct JSON array:

```json
[
  { "id": "example-1" },
  { "id": "example-2" }
]
```

or an object containing a `data` array:

```json
{
  "data": [
    { "id": "example-1" },
    { "id": "example-2" }
  ]
}
```

The adapter must handle the source API's actual response shape. Each member's API must meet these minimum requirements:

- Return product data as JSON.
- Give every product a unique identifier.
- Provide a product name.
- Provide a price that is numeric or convertible to a number.
- Provide a stock quantity that is numeric or convertible to a number.
- Be reachable by the VAULT — Multi-Store Marketplace Application backend.
- Have its API URL shared with the group.
- Keep secret passwords, tokens, and database credentials out of GitHub.

## Aggregated product response and availability

`GET /api/products` wraps normalized products in `data` and includes one availability record per adapter:

```json
{
  "data": [],
  "businesses": [
    {
      "business": "door",
      "business_name": "Door",
      "status": "online",
      "product_count": 0
    },
    {
      "business": "plug",
      "business_name": "Electrical Plug",
      "status": "unavailable",
      "product_count": 0
    }
  ],
  "source": "adapters"
}
```

`online` with `product_count: 0` means the upstream responded successfully with no usable products. `unavailable` means the request failed or its response could not be parsed. Failure of one adapter does not remove products returned by other adapters.

## Information each member must send to the integration owner

Copy and complete this template:

```text
Business:
API URL:
Products Endpoint:
Sample JSON:
Authentication Required: Yes / No
ID field:
Name field:
Category field:
Price field:
Stock field:
Image field:
Notes:
```

## Product claim API

Every endpoint below requires an authenticated session cookie. Customer endpoints resolve the
owner from the session; an order or claim belonging to someone else answers `404`, never `403`,
so the API never confirms that an unrelated record exists. The `/api/admin/claims/*` endpoints
additionally require the `admin` role.

Success bodies are `{ "data": ... }` and failures are `{ "error": { "code": ..., "message": ... } }`,
matching the rest of the API.

### Claim status values

Defined once in `backend/src/types/claim.ts` and enforced by the backend on every update.

| From | May move to |
| --- | --- |
| `submitted` | `under_review`, `cancelled` |
| `under_review` | `approved`, `rejected`, `cancelled` |
| `approved` | `processing` |
| `processing` | `completed` |
| `rejected`, `completed`, `cancelled` | terminal — no further change |

Customers may only reach `cancelled`, and only from `submitted` or `under_review`. Any other
transition returns `409 INVALID_CLAIM_TRANSITION`.

Reason values: `damaged`, `defective`, `wrong_item`, `missing_parts`, `other`.

### Customer endpoints

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/orders/:orderNo/warranty-document` | Document data built from the order snapshot |
| GET | `/api/orders/:orderNo/claimable-items` | Only lines with `claimable_quantity > 0` |
| POST | `/api/claims` | `multipart/form-data`; returns the created claim |
| GET | `/api/claims` | `?status=&page=&page_size=` (page size clamped to 50) |
| GET | `/api/claims/:claimNo` | Includes the customer-visible history only |
| POST | `/api/claims/:claimNo/cancel` | Optional `{ "note": "…" }` |
| GET | `/api/claims/:claimNo/evidence/:id` | Streams the image after an ownership check |

`POST /api/claims` fields:

| Field | Type | Rules |
| --- | --- | --- |
| `order_no` | text | Must match `MDG-YYYYMMDD-XXXXXX` and belong to the caller |
| `reason` | text | One of the reason values above |
| `description` | text | Required, 2000 characters or fewer |
| `contact_phone` | text | Optional |
| `items` | JSON text | `[{ "order_item_id": 11, "quantity": 2 }]`, 1–20 entries, no duplicates |
| `evidence` | file × 1–5 | JPEG, PNG, or WEBP, 5 MB each; at least one required |

Claim detail response:

```json
{
  "data": {
    "claim_number": "CLM-20260922-000001",
    "order_no": "MDG-20260910-AAA111",
    "status": "under_review",
    "reason": "damaged",
    "description": "The door panel arrived cracked along the top edge.",
    "contact_phone": "+66 81 234 5678",
    "admin_note": "Evidence received, a replacement is being prepared.",
    "items": [
      {
        "order_item_id": 11,
        "quantity": 2,
        "product_id": "door-1",
        "product_name": "Walnut Entry Door",
        "business": "door",
        "business_name": "Door",
        "unit_price": 2500,
        "line_total": 5000
      }
    ],
    "evidence": [
      {
        "id": 1,
        "image_url": "/api/claims/CLM-20260922-000001/evidence/1",
        "mime_type": "image/png",
        "file_size": 284913,
        "created_at": "2026-09-20T08:00:00.000Z"
      }
    ],
    "history": [
      {
        "previous_status": null,
        "new_status": "submitted",
        "changed_by_role": "customer",
        "note": "Claim submitted.",
        "created_at": "2026-09-20T08:00:00.000Z"
      },
      {
        "previous_status": "submitted",
        "new_status": "under_review",
        "changed_by_role": "admin",
        "note": "Evidence verified.",
        "created_at": "2026-09-21T09:30:00.000Z"
      }
    ],
    "created_at": "2026-09-20T08:00:00.000Z",
    "updated_at": "2026-09-21T09:30:00.000Z",
    "resolved_at": null
  }
}
```

`history` on this endpoint contains customer-visible entries only. Internal notes exist in
`claim_status_history` but are never serialized here, and the response carries no `changed_by`
user id or `visibility` field for a customer to read.

### Admin endpoints

| Method | Endpoint | Notes |
| --- | --- | --- |
| GET | `/api/admin/claims` | `?status=&business=&search=&from=&to=` |
| GET | `/api/admin/claims/stats` | Counts per status plus `open_claims` |
| GET | `/api/admin/claims/:claimNo` | Adds customer and order data and the full history |
| PATCH | `/api/admin/claims/:claimNo/status` | Enforces the transition table |

Filter notes: `status` and `business` accept `all` or omission to mean no filter. `from` and `to`
are `YYYY-MM-DD`; the range is inclusive of the final day because `to` is converted to the
following midnight. `search` matches claim number, order number, customer name, or email.

`PATCH /api/admin/claims/:claimNo/status` body:

```json
{
  "status": "approved",
  "note": "Evidence verified. Replacement approved.",
  "note_visibility": "customer",
  "admin_note": "We will ship a replacement this week."
}
```

| Field | Rules |
| --- | --- |
| `status` | Required; must be reachable from the current status |
| `note` | Optional, 1000 characters or fewer; always recorded in the history |
| `note_visibility` | `customer` (default) or `internal` |
| `admin_note` | Optional; replaces the note the customer reads. Send `""` to clear it |

When `note_visibility` is `customer` and no explicit `admin_note` is sent, the note is also
stored as the customer-visible note. An `internal` note is never promoted this way.

### Claim error codes

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_CLAIM_NUMBER` | The claim number is not `CLM-YYYYMMDD-NNNNNN` |
| 400 | `INVALID_ORDER_NUMBER` | The order number is malformed |
| 400 | `INVALID_CLAIM_REASON` | Reason is not one of the accepted values |
| 400 | `INVALID_DESCRIPTION` | Missing, or longer than 2000 characters |
| 400 | `INVALID_CLAIM_ITEMS` | No products selected, or the list could not be read |
| 400 | `INVALID_CLAIM_QUANTITY` | A quantity is not a positive whole number |
| 400 | `DUPLICATE_CLAIM_ITEM` | The same order line was listed twice |
| 400 | `EVIDENCE_REQUIRED` | No photo was attached |
| 400 | `INVALID_EVIDENCE` | Wrong file type, or the bytes are not a real image |
| 400 | `INVALID_CLAIM_STATUS` | Unknown status in a filter or update |
| 400 | `INVALID_NOTE_VISIBILITY` | Visibility is neither `customer` nor `internal` |
| 400 | `INVALID_DATE` | A date filter is not `YYYY-MM-DD` |
| 404 | `ORDER_NOT_FOUND` | No such order for this customer |
| 404 | `ORDER_ITEM_NOT_FOUND` | A selected product is not on that order |
| 404 | `CLAIM_NOT_FOUND` | No such claim for this caller |
| 404 | `EVIDENCE_NOT_FOUND` | No such evidence file on this claim |
| 409 | `ORDER_NOT_CLAIMABLE` | Not shipped or completed, outside the window, or fully claimed |
| 409 | `CLAIM_QUANTITY_EXCEEDED` | More units than remain claimable on that line |
| 409 | `CLAIM_NOT_CANCELLABLE` | The claim has moved past `under_review` |
| 409 | `INVALID_CLAIM_TRANSITION` | The status change is not in the transition table |
| 409 | `CLAIM_STATUS_UNCHANGED` | The claim is already in the requested status |
| 413 | `EVIDENCE_TOO_LARGE` | A photo is larger than 5 MB |
