import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { PublicSiteChrome } from "@/components/layout/PublicSiteChrome";
import { MotionSystem } from "@/components/motion/MotionSystem";
import { SiteAccessHandoffScript } from "@/components/layout/SiteAccessHandoffScript";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { siteConfig } from "@/lib/seo";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-technical",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.defaultTitle,
    template: `%s | ${siteConfig.titleSuffix}`,
  },
  description: siteConfig.defaultDescription,
  applicationName: siteConfig.applicationName,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  robots: {
    index: siteConfig.indexingEnabled,
    follow: siteConfig.indexingEnabled,
    noarchive: !siteConfig.indexingEnabled,
    googleBot: {
      index: siteConfig.indexingEnabled,
      follow: siteConfig.indexingEnabled,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: siteConfig.url,
    images: [
      {
        url: siteConfig.defaultOgImage,
        width: 1672,
        height: 941,
        alt: "Carsystem i R-M profesionalni refinish program",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.defaultTitle,
    description: siteConfig.defaultDescription,
    images: [siteConfig.defaultOgImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sr-Latn"
      data-scroll-behavior="smooth"
      data-route-transition="booting"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <SiteAccessHandoffScript />
      </head>
      <body
        aria-busy="true"
        className="min-h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        <MotionSystem>
          <PublicSiteChrome>{children}</PublicSiteChrome>
        </MotionSystem>
      </body>
    </html>
  );
}
