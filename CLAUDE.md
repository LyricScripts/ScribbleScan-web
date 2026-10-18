# ScribbleScan web: notes for Claude

The web app for ScribbleScan (receipts, monthly spending, budgets, phone-as-camera). Split out of the ScribbleScan repo (`src/scribblescan/server/web/`); the backend, deployment and product context live there: https://github.com/LyricScripts/ScribbleScan (read its CLAUDE.md for decisions and the owner's preferences).

The owner is a Principal Software Engineer in Bangladesh building this as a portfolio project. Explain simply and give one step at a time when they need to do something themselves.

## Rules

- **Talk only to `/v1`.** Same address as the API in production (Caddy routes `/v1` to it) and in development (Vite proxy). No CORS, no other backends.
- **Types come from the API's OpenAPI spec** (`npm run api:types` -> `src/api/generated`, never edit by hand). When the API changes, refresh `openapi.json` and regenerate. pairkit's `/v1/pair/*` routes have no response models yet; their types are hand-written in `src/api/types.ts`.
- **No UI framework**, by choice: plain DOM via `h()`/`render()` in `src/dom.ts`. They flatten nested arrays and drop null/false, so views can write `cond ? h(...) : null`.
- **Only use things with a future** (the owner's rule): nothing deprecated, unmaintained or near end of life. Node 24 LTS, TypeScript 7, Vite 8, Vitest, Biome. Check maintenance before adding a dependency, and prefer none.
- Dates are DD/MM/YYYY text fields converted to ISO (native date inputs show US order in many browsers). Money uses lakh grouping (`en-IN`). The current month comes from the local clock, not UTC.
- Uploads must keep retrying with one `Idempotency-Key` per file (`uploadFile`, and the same rule in `scan.ts`).
- The pairing secret only ever lives in the URL fragment of the scan link; `scan.ts` removes it from history at once. QR SVGs come from `POST /v1/qr`, never from a URL containing the secret.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173 (API at 127.0.0.1:8000; override with SCRIBBLESCAN_API)
npm run check      # Biome lint + format;  npm run format to fix
npm run typecheck  # tsc (TypeScript 7)
npm test           # Vitest (happy-dom)
npm run build
npm run api:types  # after refreshing openapi.json from a running API
```

## Gotchas

- TypeScript 7 has no JavaScript API yet, so code generators that need one (`@hey-api/openapi-ts`, `openapi-typescript`) can't run against it; `api:types` runs the generator under TypeScript 6 via `npm exec`.
- The production Caddyfile (in the ScribbleScan repo, `deploy/Caddyfile`) sets a strict CSP: only same-origin scripts and styles, and `connect-src` limited to this site and the sign-in domain. No inline scripts, and nothing loaded from other hosts.
