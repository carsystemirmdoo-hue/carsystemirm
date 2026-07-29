import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PaintTakeoverFinal,
  type FinalHeroManifest,
  type FinalReviewMode,
} from "@/components/paint-takeover/PaintTakeoverFinal";

export const metadata: Metadata = {
  title: "Final paint takeover | Interaction demo",
  description:
    "Phase 4 finalni pregled Carsystem hybrid paint takeover sistema.",
};

const reviewModes = new Set<FinalReviewMode>([
  "final",
  "background",
  "hero-static",
  "hero-motion",
  "text-contrast",
  "mask-debug",
]);

function normalizeMode(value?: string): FinalReviewMode {
  return reviewModes.has(value as FinalReviewMode)
    ? (value as FinalReviewMode)
    : "final";
}

export default async function PaintTakeoverFinalPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string; view?: string }>;
}) {
  const { debug, view } = await searchParams;
  const [heroArtwork, manifestSource] = await Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/paint-takeover-hero-strokes-final.svg",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/paint-takeover-final-manifest.json",
      ),
      "utf8",
    ),
  ]);

  return (
    <PaintTakeoverFinal
      debug={debug === "1"}
      heroArtwork={heroArtwork}
      initialMode={normalizeMode(view)}
      manifest={JSON.parse(manifestSource) as FinalHeroManifest}
    />
  );
}
