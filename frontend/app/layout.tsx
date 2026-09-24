import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/cafe/providers";

export const metadata: Metadata = { title: "Sajha Cafe", description: "Cafe management system" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
