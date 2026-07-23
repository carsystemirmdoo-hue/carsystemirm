import type { Metadata } from "next";
import { SprayRevealStage } from "@/components/social-exports/spray-reveal/SprayRevealStage";
import {
  resolveSprayRevealVariant,
  sprayRevealFormats,
  type SprayRevealFormat,
} from "@/components/social-exports/spray-reveal/sprayRevealVariants";

export const metadata: Metadata = {
  title: "Spray reveal | Interni video eksport",
  robots: { index: false, follow: false },
};

/*
 * Interna scena za promo video: proizvod + spray artwork reveal, bez web UI
 * elemenata. Nije linkovana u navigaciji, nije u sitemapu, nosi noindex.
 *   ?format=story|feed|square|wide  (1080x1920 / 1080x1350 / 1080x1080 / 1920x1080)
 *   ?product=cosmos-spray|basecoat|filler-kit (ili slug proizvoda varijante)
 *   ?render=1        deterministički režim za MP4 render
 *   ?render=1&time=MS statički prikaz tačnog trenutka
 */
export default async function SprayRevealExportPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; product?: string; render?: string; time?: string }>;
}) {
  const { format, product, render, time } = await searchParams;
  const resolvedFormat: SprayRevealFormat =
    format && format in sprayRevealFormats ? (format as SprayRevealFormat) : "story";
  const variant = resolveSprayRevealVariant(product ?? null);
  const renderMode = render === "1" || render === "true";
  const parsedTime = time === undefined ? Number.NaN : Number(time);
  const renderTimeMs = renderMode && Number.isFinite(parsedTime) ? Math.max(0, parsedTime) : null;

  return (
    <SprayRevealStage
      format={resolvedFormat}
      variant={variant}
      renderMode={renderMode}
      renderTimeMs={renderTimeMs}
    />
  );
}
