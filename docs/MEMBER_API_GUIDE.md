# Member API Integration Guide

Use this guide to connect one business Stock Product API without changing the central architecture.

## Business branches

Use the branch assigned to your business:

| Business | Branch |
| --- | --- |
| Door | `feature/door-api` |
| Electrical Plug | `feature/plug-api` |
| Brandname | `feature/brandname-api` |
| Clothing | `feature/clothing-api` |
| Powerbank | `feature/powerbank-api` |
| Projector | `feature/projector-api` |

## Integration steps

1. Clone the repository if you do not already have it.
2. Switch to `dev` and pull the latest changes.
3. Create your assigned feature branch.
4. Copy `.env.example` to `.env`.
5. Add your business API URL to the matching variable in `.env`.
6. Edit only your business adapter where possible.
7. Test that your adapter returns the normalized format in [API_CONTRACT.md](API_CONTRACT.md).
8. Commit your changes with a clear message.
9. Push your feature branch.
10. Open a Pull Request into `dev`.
11. Wait for review from `@Krip-TH`.
12. Do not push directly to `dev` or `main`.

Example for the Clothing member:

```bash
git clone <repository-url>
cd VAULT
git checkout dev
git pull origin dev
git checkout -b feature/clothing-api
cp .env.example .env

# Edit CLOTHING_API_URL in .env and implement backend/src/adapters/clothing/index.ts

git add .
git commit -m "Integrate clothing stock API"
git push -u origin feature/clothing-api
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
```

## Adapter checklist

- Read the API URL from the matching environment variable.
- Request the real products endpoint.
- Handle whether the response is an array or contains a `data` array.
- Map the source fields in your adapter's `normalizeProduct` function.
- Convert `id` to a string and `price` and `stock` to numbers.
- Use the shared `getStockStatus` helper.
- Return `NormalizedProduct[]` from `getProducts`.
- Do not commit `.env`, credentials, tokens, or database passwords.
- Avoid editing another member's adapter.

## Important

**DO NOT run:**

```bash
git push origin dev
```

Push only your feature branch and let `@Krip-TH` review the Pull Request before it is merged into `dev`. Promote integrated `dev` to `main` only after final validation.
