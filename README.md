# ScribbleScan web

The frontend for ScribbleScan, a Bangladesh-first budget and receipt tracker. It uses Next.js App Router, React, TypeScript, and Tailwind CSS.

## Run the frontend

Use Node.js 24 or newer:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Visitors without a stored sign-in session are sent to the login page. The login page itself works without the API; signing in requires the API to be available. For an existing signed-in session, the app can fall back to labeled sample data if the API is unavailable. Sample edits last until the page is reloaded, and selected files are not uploaded in sample mode.

To use account data, start the API separately, then open <http://localhost:3000/connect> and sign in. Next.js forwards `/v1`, `/docs`, and `/openapi.json` to `SCRIBBLESCAN_API`, which defaults to `http://127.0.0.1:8000`. If the API is unavailable, the app falls back to sample data.

## Screens

- Spending dashboard with monthly totals, category budgets, recent receipts, and CSV/Excel exports.
- Receipt search and filtering, with a schema-driven review form for connected accounts.
- Receipt photo and PDF uploads, plus phone pairing through the `/scan` page.
- Monthly budgets and separate personal or business spaces.
- Sample data mode for exploring the frontend before connecting an account.

## Production build

```bash
npm run build
npm start
```

The standalone container listens on port `3000`. The existing VPS Caddy configuration serves the old static frontend, so deployment will need a later Caddy change to proxy to this Next.js server.

## API types

The generated contract is in `src/api/generated`. After the API contract changes, refresh it with:

```bash
curl -s http://127.0.0.1:8000/openapi.json > openapi.json
npm run api:types
```
