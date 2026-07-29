import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PaintTakeoverReferenceAssimilation,
  type ReferenceAssimilationCard,
} from "@/components/paint-takeover/PaintTakeoverReferenceAssimilation";

export const metadata: Metadata = {
  title: "Carsystem brush reference assimilation | Interaction demo",
  description:
    "Pre-Phase 4 isolated comparison proof for six selected hybrid hero strokes.",
};

type ProofManifest = {
  selectedGroups: Array<{
    proofId: string;
    originalId: string;
    label: string;
    family: string;
    origin: string;
    direction: string;
    source: string;
    sourceLabel: string;
  }>;
  perStrokeMetrics: Array<{
    id: string;
    originalId: string;
    label: string;
    source: string;
    current: ReferenceAssimilationCard["metrics"]["current"];
    adapted: ReferenceAssimilationCard["metrics"]["adapted"];
    runtimeDomIncrease: number;
  }>;
};

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBalancedElement(source: string, tagName: string, startAt = 0) {
  const startExpression = new RegExp(`<${tagName}\\b`, "g");
  startExpression.lastIndex = startAt;
  const startMatch = startExpression.exec(source);
  if (!startMatch) throw new Error(`Could not find <${tagName}>.`);

  const expression = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "g");
  expression.lastIndex = startMatch.index;
  let depth = 0;

  for (
    let match = expression.exec(source);
    match;
    match = expression.exec(source)
  ) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return source.slice(startMatch.index, expression.lastIndex);
    }
  }

  throw new Error(`Unbalanced <${tagName}> element.`);
}

function extractGroup(source: string, id: string) {
  const idIndex = source.indexOf(`id="${id}"`);
  if (idIndex < 0) throw new Error(`Missing group ${id}.`);
  const start = source.lastIndexOf("<g", idIndex);
  return extractBalancedElement(source, "g", start);
}

function namespaceSvg(source: string, prefix: string) {
  const ids = [
    ...new Set(
      [...source.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
    ),
  ].sort((a, b) => b.length - a.length);
  let output = source;

  for (const id of ids) {
    const namespaced = `${prefix}-${id}`;
    const escaped = escapeExpression(id);
    output = output
      .replace(new RegExp(`id="${escaped}"`, "g"), `id="${namespaced}"`)
      .replace(
        new RegExp(`url\\(#${escaped}\\)`, "g"),
        `url(#${namespaced})`,
      )
      .replace(
        new RegExp(`((?:xlink:)?href)="#${escaped}"`, "g"),
        `$1="#${namespaced}"`,
      );
  }

  return output.replace(
    /aria-labelledby="([^"]+)"/g,
    (_, labels: string) =>
      `aria-labelledby="${labels
        .split(/\s+/)
        .map((label) => `${prefix}-${label}`)
        .join(" ")}"`,
  );
}

function isolateGroupSvg(source: string, groupId: string, prefix: string) {
  const defs = extractBalancedElement(source, "defs");
  const group = extractGroup(source, groupId);
  return namespaceSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true">${defs}${group}</svg>`,
    prefix,
  );
}

export default async function PaintTakeoverReferenceAssimilationPage() {
  const [currentArtwork, adaptedArtwork, manifestSource] = await Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/paint-takeover-hero-strokes.svg",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/paint-takeover-hero-strokes-reference-proof.svg",
      ),
      "utf8",
    ),
    readFile(
      path.join(
        process.cwd(),
        "public/art/paint-takeover/brush-library/manifest.json",
      ),
      "utf8",
    ),
  ]);
  const manifest = JSON.parse(manifestSource) as ProofManifest;

  const cards: ReferenceAssimilationCard[] = manifest.selectedGroups.map(
    (group, index) => {
      const metrics = manifest.perStrokeMetrics.find(
        (entry) => entry.originalId === group.originalId,
      );
      if (!metrics) throw new Error(`Missing metrics for ${group.originalId}.`);
      const prefix = `reference-card-${String(index + 1).padStart(2, "0")}`;

      return {
        index: index + 1,
        label: group.label,
        family: group.family,
        origin: group.origin,
        direction: group.direction,
        originalId: group.originalId,
        proofId: group.proofId,
        source: group.source,
        sourceLabel: group.sourceLabel,
        currentSvg: isolateGroupSvg(
          currentArtwork,
          group.originalId,
          `${prefix}-current`,
        ),
        adaptedSvg: isolateGroupSvg(
          adaptedArtwork,
          group.proofId,
          `${prefix}-stage`,
        ),
        adaptedStaticSvg: isolateGroupSvg(
          adaptedArtwork,
          group.proofId,
          `${prefix}-static`,
        ),
        adaptedDebugSvg: isolateGroupSvg(
          adaptedArtwork,
          group.proofId,
          `${prefix}-debug`,
        ),
        metrics: {
          current: metrics.current,
          adapted: metrics.adapted,
          runtimeDomIncrease: metrics.runtimeDomIncrease,
        },
      };
    },
  );

  return <PaintTakeoverReferenceAssimilation cards={cards} />;
}
