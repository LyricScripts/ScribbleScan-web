// Types only, from the API's published contract (`npm run api:types`).
// Refresh openapi.json first from a running API:
//   curl -s http://127.0.0.1:8000/openapi.json > openapi.json
// The generator needs TypeScript's JavaScript API, which TypeScript 7 doesn't ship yet,
// so the script runs it in its own npx environment with TypeScript 6.
export default {
  input: "openapi.json",
  output: { path: "src/api/generated" },
  plugins: ["@hey-api/typescript"],
};
