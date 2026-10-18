import { defineConfig } from "vitest/config";

// The API is the only backend. In development, Vite forwards API calls to it, so the
// browser sees one address, exactly as in production (where Caddy does the same).
const API = process.env.SCRIBBLESCAN_API ?? "http://127.0.0.1:8000";

export default defineConfig({
  server: {
    proxy: { "/v1": API, "/docs": API, "/openapi.json": API },
  },
  preview: {
    proxy: { "/v1": API },
  },
  build: {
    target: "es2023",
    rolldownOptions: {
      // Two pages: the app, and the page a paired phone opens after scanning the QR code.
      input: { main: "index.html", scan: "scan.html" },
    },
  },
  test: {
    environment: "happy-dom",
  },
});
