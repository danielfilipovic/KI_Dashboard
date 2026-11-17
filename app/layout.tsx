import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Business Cockpit", description: "Steuerzentrale für Content-Agentur und eigene Marke" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
