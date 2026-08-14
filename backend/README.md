# Wallet Sentinel API

Rust Axum service for Solana wallet balances, SPL/Token-2022 holdings, and heuristic risk flags.

## Run locally

```bash
cp .env.example .env
# set API_KEY, HELIUS_API_KEY, and SWAGGER_PASSWORD
cargo run
```

The process exits at startup if `API_KEY` is missing or empty.

Listens on `http://0.0.0.0:8080`.

- `GET /health` — public (no API key)
- `GET /wallet/{address}/summary` — requires `x-api-key`
- `GET /wallet/{address}/tokens` — requires `x-api-key`
- `GET /wallet/{address}/risks` — requires `x-api-key`
- Swagger UI: `http://localhost:8080/swagger-ui/` (HTTP Basic Auth)

Send the key as header `x-api-key`. Missing or wrong key returns `401 { "error": "unauthorized" }`.

The Next.js UI must not call this server from the browser. Use the frontend `/api` proxy instead.

## Environment

| Variable | Required | Default |
|---|---|---|
| `API_KEY` | yes | |
| `HELIUS_API_KEY` | yes | |
| `SWAGGER_PASSWORD` | yes | |
| `SWAGGER_USERNAME` | no | `admin` |
| `PORT` | no | `8080` |
| `JUPITER_API_KEY` | no | sent as `x-api-key` when set |
| `CORS_ORIGIN` | no | empty (no CORS). Set only for rare local debugging |

## Tests

```bash
cargo test
```
