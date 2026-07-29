import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PaintTakeoverFinalArtEntry } from "@/components/paint-takeover/PaintTakeoverFinalArtEntry";

export const metadata: Metadata = {
  title: "Paint takeover final art entry | Interaction demo",
  description:
    "Phase 3A live pregled dijagonalnog ulaznog poteza i finalne painterly kompozicije.",
};

function namespaceArtwork(svg: string, prefix: string) {
  return svg
    .replaceAll(/id="([^"]+)"/g, `id="${prefix}-$1"`)
    .replaceAll(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);
}

export default async function PaintTakeoverFinalArtEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string }>;
}) {
  const { debug } = await searchParams;
  const artwork = await readFile(
    path.join(
      process.cwd(),
      "public/art/paint-takeover/paint-takeover.svg",
    ),
    "utf8",
  );

  return (
    <PaintTakeoverFinalArtEntry
      artwork={artwork}
      debug={debug === "1"}
      entryArtwork={namespaceArtwork(artwork, "entry")}
    />
  );
}
