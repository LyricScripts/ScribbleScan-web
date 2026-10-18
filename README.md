# ScribbleScan web

The web app for [ScribbleScan](https://github.com/LyricScripts/ScribbleScan): snap a receipt, see where your money goes each month, keep budgets, and use your phone as the camera. Built for Bangladesh first: Bangla digits, the taka sign, lakh grouping (৳1,25,000) and day-first dates.

It talks to the ScribbleScan API only through `/v1`, the same API the future mobile app will use.

## How it's built

- **TypeScript 7 + Vite 8**, no UI framework. Views are plain DOM built with a small `h()` helper (`src/dom.ts`), so the whole app ships as about 27 KB of JavaScript.
- **Types come from the API's contract.** Every API response is described in its OpenAPI spec. `npm run api:types` turns `openapi.json` into `src/api/generated`, so a field renamed in the API breaks the build here, not in a user's browser.
- **Sign-in** is OIDC Authorization Code + PKCE (`src/oidc.ts`) against Zitadel, so the browser holds no client secret. Access tokens renew silently with a refresh token.
- **Uploads survive bad connections.** Each upload retries for about 30 seconds with the same `Idempotency-Key`, so a dropped mobile connection never loses a photo or stores it twice (`src/api/client.ts`).
- **Two pages**: the app (`index.html`), and `scan.html`, which a phone opens after scanning a pairing QR code. It then becomes an upload-only camera for one space ([pairkit](https://github.com/LyricScripts/pairkit)).
- **Self-hosted font** (Hind Siliguri, for Bangla and Latin). No requests to third-party servers, and a strict Content-Security-Policy in production.

```
src/
  main.ts            router and start-up
  views/             home (spending), receipts, review, add (upload + pairing), budgets, spaces, sign-in
  api/client.ts      requests, token renewal, upload retries
  api/generated/     types generated from the API's OpenAPI spec (don't edit)
  oidc.ts            sign-in
  format.ts          money, dates, amounts as people type them
  scan.ts            the phone camera page
test/                Vitest unit tests
```

## Run it locally

You need Node 24 and the API running (see the ScribbleScan repo: `uv run scribblescan serve`).

```bash
npm install
npm run dev            # http://localhost:5173; /v1 is forwarded to the API at 127.0.0.1:8000
```

To try the phone camera on your Wi-Fi, run `npm run dev -- --host`. Then start the API with `SCRIBBLESCAN_PUBLIC_URL=http://<your-PC's-IP>:5173`, so the QR code points at this dev server.

## Checks

```bash
npm run check          # Biome: lint + format
npm run typecheck      # TypeScript 7
npm test               # Vitest
npm run build          # production files in dist/
```

CI runs all of these, builds the container image, and checks that it serves both pages.

## Deploying

`Containerfile` builds a small Caddy image with the built files in `/srv/web`. The ScribbleScan repo's `deploy/install.sh` clones this repo next to it, builds the image, and runs it as the HTTPS front door. That Caddy serves these files and forwards `/v1` to the API on the same address, so no CORS is needed.

## Updating the API types

```bash
curl -s http://127.0.0.1:8000/openapi.json > openapi.json   # with the API running
npm run api:types
```

The generator needs TypeScript's JavaScript API, which TypeScript 7 doesn't ship yet. So `api:types` runs it in its own `npx` environment with TypeScript 6, and the project keeps TypeScript 7 for type-checking.
