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

The container runs the standalone Next.js server on port 3000. Caddy is the front door on the ScribbleScan VPS: it sends `/v1` to the API and everything else to this server, and it adds the Content-Security-Policy header.

Two things about that arrangement, both easy to break:

- The Next.js rewrites in `next.config.ts` only matter in development, where they send `/v1` to `http://127.0.0.1:8000`. Next.js bakes rewrites into the image at build time, so a runtime `SCRIBBLESCAN_API` does nothing; in production Caddy does the routing.
- The web app's scripts are signed with a nonce that Caddy makes up per request. Next.js only signs a page when it renders it, so `app/layout.tsx` sets `dynamic = "force-dynamic"`: a page served from the build cache would come back unsigned and the browser would refuse to run it. Keep the check in `.github/workflows/ci.yml` (every page's scripts carry the nonce) when changing the routes.

The server must listen on every interface: Podman sets `HOSTNAME` to the container id, and the standalone server would try to bind that name, which fails on hosts without IPv6. The Containerfile and the Quadlet unit both set `HOSTNAME=0.0.0.0`.
