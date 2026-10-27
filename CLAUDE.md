# ScribbleScan web: notes for Claude

The web frontend is a Bangladesh-first budget and receipt tracking prototype. The owner is a Principal Software Engineer in Bangladesh building it as a portfolio project. Explain simply and give one step at a time when they need to do something themselves.

## Current direction

- Next.js App Router, React, TypeScript, Tailwind CSS, Node 24.
- Frontend work comes first. Visitors without a stored sign-in session land on the login page. For an existing signed-in session, the app can fall back to explicitly labeled sample data if the API is unavailable; sample edits stay in memory. Do not add new backend endpoints or schemas until the frontend feature set is settled.
- Preserve the product language: Hind Siliguri, taka sign, lakh grouping, and day-first dates. The current visual direction uses near-black surfaces, subtle card borders, compact metrics, and vivid category colors with semicircular budget arcs.
- Keep the login page accessible without any backend process. Do not show fallback data before sign-in. Clearly identify sample values and local-only changes; connected account data must only appear after sign-in.
- Keep accessible names, keyboard focus, reduced motion, and responsive layouts.
- Only use things with a future: Node 24 LTS and actively maintained dependencies.

## API contract

Connected mode uses the existing ScribbleScan API only through `/v1`. Response types are generated from `openapi.json` into `src/api/generated`; never edit generated files by hand. The Next.js rewrites in `next.config.ts` target `http://127.0.0.1:8000` by default and can be overridden with `SCRIBBLESCAN_API`.

Sign-in (`app/connect/page.tsx`) is passwordless: **Continue with email** (a code, or the link in the email), **Google** and **Apple**, through `/v1/auth/*`. The page makes the PKCE verifier (`oidc.begin()`, kept in localStorage so the emailed link works in a new tab), the API runs the sign-in with Zitadel, and the browser lands on `/?code=...`, which the app shell hands to `/connect` for `oidc.finish()`. `GET /v1/config`'s `login_methods` says which choices work; empty with `auth: "oidc"` means Zitadel's hosted pages, and dev mode signs in from the email step without a code.

The phone pairing secret belongs only in the scan URL fragment. QR SVGs must come from `POST /v1/qr`, never from a URL containing the secret.

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm test
npm run build
npm start
```

Refresh generated API types after changing `openapi.json` with `npm run api:types`. TypeScript 7 does not provide the JavaScript API used by the OpenAPI generator, so the script runs the generator with TypeScript 6 in its own npm environment.

## Deployment note

The container now runs the standalone Next.js server on port `3000`. The ScribbleScan VPS Caddy route still expects static files and needs a separate update before deploying this image.
