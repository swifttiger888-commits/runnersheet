import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppConsentRoot } from "@/components/app-consent-root";
import { JsonLdWebApp } from "@/components/seo/json-ld";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-ui",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-ui",
  display: "swap",
});

const siteUrl = getSiteUrl();
const defaultDescription =
  "Fewer lost journeys, clearer handovers: RunnerSheet is the digital runner sheet for drivers and managers on phone, tablet, and desktop.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RunnerSheet",
    template: "%s | RunnerSheet",
  },
  description: defaultDescription,
  applicationName: "RunnerSheet",
  keywords: [
    "RunnerSheet",
    "runner sheet",
    "fleet",
    "journeys",
    "drivers",
    "Arnold Clark",
    "branch reports",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteUrl,
    siteName: "RunnerSheet",
    title: "RunnerSheet",
    description: defaultDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "RunnerSheet — journeys and reports for drivers and managers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RunnerSheet",
    description: defaultDescription,
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "RunnerSheet",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d0d0f" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${sans.variable} ${mono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-dvh font-sans">
        <AppConsentRoot>
          <JsonLdWebApp />
          <div className="app-backdrop min-h-dvh">{children}</div>
        </AppConsentRoot>
      </body>
    </html>
  );
}
