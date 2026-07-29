import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PaintTakeoverHybrid,
  type HybridViewMode,
} from "@/components/paint-takeover/PaintTakeoverHybrid";

export const metadata: Metadata = {
  title: "Paint takeover hybrid | Interaction demo",
  description:
    "Phase 3B pregled laganog painterly background i hero SVG sistema.",
};

function normalizeMode(value?: string): HybridViewMode {
  if (value === "background" || value === "hero") return value;
  return "hybrid";
}

export default async function PaintTakeoverHybridPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string; view?: string }>;
}) {
  const { debug, view } = await searchParams;
  const heroArtwork = await readFile(
    path.join(
      process.cwd(),
      "public/art/paint-takeover/paint-takeover-hero-strokes.svg",
    ),
    "utf8",
  );

  return (
    <PaintTakeoverHybrid
      debug={debug === "1"}
      heroArtwork={heroArtwork}
      initialMode={normalizeMode(view)}
    />
  );
}
