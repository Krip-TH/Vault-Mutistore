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

The Door API may return:

```json
{
  "ProductID": 12,
  "ProductName": "Modern Walnut Entrance Door",
  "CategoryName": "Door",
  "Price": "24500.00",
  "StockQuantity": 5,
  "ImageURL": "/images/door12.jpg"
}
```

The Door adapter maps fields and converts values as follows:

| Source field | Normalized field | Conversion |
| --- | --- | --- |
| `ProductID` | `id` | Convert to string |
| `ProductName` | `name` | Use as text |
| `CategoryName` | `category` | Use as text |
| `Price` | `price` | Convert to number |
| `StockQuantity` | `stock` | Convert to number |
| `ImageURL` | `image_url` | Use as text |

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

The Powerbank Stock Product API (see [powerbank-api/README.md](../powerbank-api/README.md)) returns:

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
