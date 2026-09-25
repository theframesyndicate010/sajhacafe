import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The legacy Vite application remains in `src/`. Restrict page discovery to
  // the Next.js TypeScript routes in `app/` so its JSX screens cannot shadow
  // or interfere with the cafe routes.
  pageExtensions: ["ts", "tsx"],
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined);
    return api ? [{ source: "/api/:path*", destination: `${api}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
