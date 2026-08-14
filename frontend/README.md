# Wallet Sentinel frontend

Next.js UI for the Wallet Sentinel API.

The browser only calls same-origin `/api/wallet/...`. Route Handlers forward to Axum with a server-only `API_KEY`. The key and Axum URL never appear in client JS or DevTools.

## Local setup

```bash
cp .env.example .env.local
# set API_KEY to the same value as backend/.env
npm install
npm run dev
```

Open `http://localhost:3000`. The Axum API must be running on `http://localhost:8080` (see `../backend`).

## Environment

| Variable | Required | Notes |
|---|---|---|
| `BACKEND_URL` | yes | Server-only. Axum origin, e.g. `http://localhost:8080` |
| `API_KEY` | yes | Server-only. Must match backend `API_KEY`. Never `NEXT_PUBLIC_` |

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
