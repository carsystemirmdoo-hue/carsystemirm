import type { Metadata } from "next";
import { SataProgramPreview } from "@/components/brand/sata/SataProgramPreview";

/**
 * SATA — predlog nove brend stranice (2026-10-20), interni pregled.
 *
 * Pod `/interaction-demo`: na Vercel Production i Preview vraća 404
 * (lib/internal-demo-routes.mjs), lokalno je dostupna i `noindex`. Kandidat-
 * fotografije sa sata.com (bez potvrđenih prava) prikazuju se samo kad je
 * lokalno postavljeno `SATA_PREVIEW_MEDIA=1`; fajlovi su u gitignored
 * `public/_lokalno/`. Strana se renderuje po zahtevu, pa promenljiva važi bez
 * novog builda.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SATA — predlog stranice (interno)",
  robots: { index: false, follow: false, noarchive: true },
};

export default function SataPredlogPage() {
  return <SataProgramPreview showMedia={process.env.SATA_PREVIEW_MEDIA === "1"} />;
}
