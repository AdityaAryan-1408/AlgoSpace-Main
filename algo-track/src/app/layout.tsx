import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "AlgoTrack",
  description: "Spaced repetition dashboard for interview prep",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/icon-192.png", sizes: "192x192" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
