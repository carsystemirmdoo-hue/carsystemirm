import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { PublicSiteChrome } from "@/components/layout/PublicSiteChrome";
import { CompanionPanel } from "@/components/ordering/CompanionPanel";
import { publicSiteOpen } from "@/lib/site-mode";
import { MotionSystem } from "@/components/motion/MotionSystem";
import { SiteAccessHandoffScript } from "@/components/layout/SiteAccessHandoffScript";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { siteConfig } from "@/lib/seo";
import "./globals.css";

/*
 * `latin-ext` nosi č, ć, š, ž i đ. Bez njega u preload-u ova slova na sporoj mreži
 * stižu ~1 s posle prvog prikaza (izmereno: /katalog, spori 4G, FCP 2,46 s, latin-ext
 * 3,35–3,47 s), pa reči kratko mešaju dva fonta. Fajlovi se ionako preuzimaju na
 * svakoj stranici na srpskom; preload ih samo ranije zakazuje.
 */
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-technical",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Geist je samo rezervni font iza Plex/Archivo; preload bi ga preuzimao pre prvog
// prikaza i na sporoj mreži usporavao CSS (izmereno: FCP /katalog, spori 4G).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
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
      /* Sistem A (docs/design/SISTEM_A.md): zajednička pravila važe na celom sajtu. */
      data-ds="a"
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
          <PublicSiteChrome publicSiteOpen={publicSiteOpen()}>{children}</PublicSiteChrome>
          <CompanionPanel />
        </MotionSystem>
      </body>
    </html>
  );
}
