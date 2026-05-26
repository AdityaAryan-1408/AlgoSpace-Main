import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "AlgoTrack",
  description: "Spaced repetition dashboard for interview prep",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/BLACKLOGO.png", media: "(prefers-color-scheme: dark)" },
    { rel: "icon", url: "/WHITELOGO.png", media: "(prefers-color-scheme: light)" },
    { rel: "apple-touch-icon", url: "/BLACKLOGO.png", media: "(prefers-color-scheme: dark)" },
    { rel: "apple-touch-icon", url: "/WHITELOGO.png", media: "(prefers-color-scheme: light)" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
