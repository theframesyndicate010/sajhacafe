import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The legacy Vite application remains in `src/`. Restrict page discovery to
  // the Next.js TypeScript routes in `app/` so its JSX screens cannot shadow
  // or interfere with the cafe routes.
  pageExtensions: ["ts", "tsx"],
  async rewrites() {
    const api = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NEXT_PUBLIC_API_URL;
    return api ? [{ source: "/api/:path*", destination: `${api}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
