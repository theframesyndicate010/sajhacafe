import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/cafe/providers";

export const metadata: Metadata = {
  applicationName: "Sajha Cafe",
  title: "Sajha Cafe",
  description: "Cafe point of sale, orders, bills, and business management.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sajha Cafe", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1a3a8f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
