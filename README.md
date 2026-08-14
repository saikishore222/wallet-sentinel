# Wallet Sentinel

Solana wallet inspector: balances, SPL/Token-2022 holdings, and heuristic risk flags.

```
wallet-sentinel/
├── backend/    Rust Axum API (port 8080)
└── frontend/   Next.js UI (port 3000)
```

The browser talks only to Next.js `/api/wallet/...`. Next attaches `x-api-key` when calling Axum. `/health` on Axum stays public; wallet routes require the key.

## Local end-to-end

Terminal 1:

```bash
cd backend
cp .env.example .env   # set API_KEY, HELIUS_API_KEY, and SWAGGER_PASSWORD
cargo run
```

Terminal 2:

```bash
cd frontend
cp .env.example .env.local   # set API_KEY to the same value as backend/.env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Secrets

Never commit `.env` or `.env.local`. Templates: `backend/.env.example`, `frontend/.env.example`.

Do not use `NEXT_PUBLIC_API_KEY` or `NEXT_PUBLIC_API_URL` — those would leak into the browser.
