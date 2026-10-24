import type { NextConfig } from "next";

const api = process.env.SCRIBBLESCAN_API ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/v1/:path*", destination: `${api}/v1/:path*` },
      { source: "/docs", destination: `${api}/docs` },
      { source: "/openapi.json", destination: `${api}/openapi.json` },
    ];
  },
};

export default nextConfig;
