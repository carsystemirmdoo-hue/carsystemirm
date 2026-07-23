import type { Metadata } from "next";
import { RefinishSystemsExportStage } from "@/components/social-exports/refinish-systems/RefinishSystemsExportStage";
import {
  refinishExportFormats,
  type RefinishExportFormat,
} from "@/components/social-exports/refinish-systems/refinishSystemsPrograms";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Refinish sistemi | Interni video eksport",
  robots: { index: false, follow: false },
};

/*
 * Interna ruta za snimanje video sadržaja za društvene mreže. Nije linkovana
 * u javnoj navigaciji, nije u sitemapu i nosi noindex. Formati:
 *   ?format=story  -> 9:16, 1080x1920
 *   ?format=feed   -> 4:5,  1080x1350
 *   ?format=square -> 1:1,  1080x1080
 * Opcioni ?program= prima id programske celine (npr. boje-i-lakovi) ili brend
 * (npr. carsystem) za izvoz pojedinačnog videa; bez njega ide ceo sequence.
 * ?render=1 uključuje deterministički režim za MP4 render (scena čeka start
 * signal render skripte); ?render=1&time=MS statički prikazuje tačan trenutak.
 */
export default async function RefinishSystemsExportPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; program?: string; render?: string; time?: string }>;
}) {
  const { format, program, render, time } = await searchParams;
  const renderMode = render === "1" || render === "true";
  const parsedTime = time === undefined ? Number.NaN : Number(time);
  const renderTimeMs = renderMode && Number.isFinite(parsedTime) ? Math.max(0, parsedTime) : null;
  const resolvedFormat: RefinishExportFormat =
    format && format in refinishExportFormats ? (format as RefinishExportFormat) : "story";

  const siteHost = (() => {
    try {
      const hostname = new URL(siteConfig.url).hostname;
      return hostname === "localhost" ? null : hostname;
    } catch {
      return null;
    }
  })();

  return (
    <RefinishSystemsExportStage
      format={resolvedFormat}
      program={program?.trim() ? program.trim() : null}
      siteHost={siteHost}
      renderMode={renderMode}
      renderTimeMs={renderTimeMs}
    />
  );
}
