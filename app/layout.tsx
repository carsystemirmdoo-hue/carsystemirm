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
    default: "Carsystem i R-M Inđija | Profesionalni refinish program",
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Profesionalni program za pripremu, farbanje, opremu i završnu obradu vozila kroz mrežu partnera u Srbiji.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Carsystem i R-M Inđija | Profesionalni refinish program",
    description:
      "Profesionalni program za pripremu, farbanje, opremu i završnu obradu vozila kroz mrežu partnera u Srbiji.",
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: siteConfig.url,
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
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <SiteAccessHandoffScript />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <MotionSystem>
          <PublicSiteChrome>{children}</PublicSiteChrome>
        </MotionSystem>
      </body>
    </html>
  );
}
