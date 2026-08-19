import type { ReactElement } from "react";

/**
 * Compact decorative glyph set for the icon-rain scene — INTERNAL.
 *
 * Why not the existing category icons
 * -----------------------------------
 * `public/icons/categories/*.svg` already covers all 12 platform categories and
 * is the visual reference this set follows. Those files cannot be used here:
 * they are 1:1 auto-traces of supplied PNGs, between 2 KB and 285 KB each, made
 * of thousands of one-pixel `L x y` segments. The header loads exactly one at a
 * time as an `<img>`; inlining thirty of them into an animated layer would ship
 * megabytes of path data and hand the compositor thirty complex shapes to
 * re-rasterise every frame.
 *
 * These glyphs are therefore hand-authored silhouettes of the SAME objects the
 * traced icons show — a disc, a tape roll, a spray can, a pad, a spatula, a
 * mask — on a 24×24 grid, a handful of commands each.
 *
 * They are decoration and nothing else: no glyph carries a number, a grade, a
 * measurement or a quantity, and no glyph implies a feature a product does not
 * have. The scene that uses them is `aria-hidden`.
 */

export type GlyphId =
  | "disc"
  | "disc-perforated"
  | "sanding-block"
  | "tape-roll"
  | "film-sheet"
  | "paper-strip"
  | "spray-can"
  | "nozzle-cap"
  | "spray-arc"
  | "polishing-pad"
  | "polish-wave"
  | "backing-plate"
  | "spatula"
  | "cartridge"
  | "material-blob"
  | "respirator"
  | "glove"
  | "shield"
  | "spray-gun"
  | "gravity-cup"
  | "droplet"
  | "paint-tin"
  | "brush"
  | "swatch";

/**
 * Each glyph draws inside a 24×24 box. `stroke` glyphs inherit `currentColor`
 * as a stroke, `fill` glyphs as a fill — the scene sets the colour once so the
 * whole field stays a single tone.
 */
const GLYPHS: Record<GlyphId, ReactElement> = {
  disc: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  "disc-perforated": (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="5.4" r="1.05" />
      <circle cx="18.6" cy="12" r="1.05" />
      <circle cx="12" cy="18.6" r="1.05" />
      <circle cx="5.4" cy="12" r="1.05" />
    </>
  ),
  "sanding-block": (
    <>
      <rect x="3" y="8" width="18" height="8" rx="2.4" />
      <path d="M6.5 11.4h11M6.5 13.6h11" />
    </>
  ),
  "tape-roll": (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4" />
      <path d="M20.4 13.4c0 1.6-3.8 2.9-8.4 2.9" />
    </>
  ),
  "film-sheet": (
    <>
      <path d="M4 6.5 20 4v13.5L4 20z" />
      <path d="M4 10.5 20 8" />
    </>
  ),
  "paper-strip": (
    <>
      <path d="M3 9c3.4-1.6 6.7-1.6 9 0s5.6 1.6 9 0v6c-3.4 1.6-6.7 1.6-9 0s-5.6-1.6-9 0z" />
    </>
  ),
  "spray-can": (
    <>
      <rect x="8" y="6.5" width="8" height="15" rx="1.6" />
      <rect x="10" y="2.5" width="4" height="4" rx="0.8" />
    </>
  ),
  "nozzle-cap": (
    <>
      <path d="M8.5 20V11l1.8-3.2h3.4L15.5 11v9z" />
      <path d="M10.6 7.8V5.4h2.8v2.4" />
    </>
  ),
  "spray-arc": (
    <>
      <path d="M6 7.5c4 1.2 8 3.6 12 8" />
      <path d="M4.5 11.5c3.6.4 7.2 2.2 10.6 5.6" />
      <path d="M4 16c2.6-.4 5.2.4 7.8 2.6" />
    </>
  ),
  "polishing-pad": (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.4" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  "polish-wave": (
    <>
      <path d="M3 14c3-4 6-4 9 0s6 4 9 0" />
      <path d="M3 18.5c3-4 6-4 9 0s6 4 9 0" />
    </>
  ),
  "backing-plate": (
    <>
      <ellipse cx="12" cy="13" rx="9" ry="4.2" />
      <path d="M12 8.8V4.2" />
      <rect x="10.4" y="2" width="3.2" height="2.6" rx="0.6" />
    </>
  ),
  spatula: (
    <>
      <path d="M3.5 15.5 12 7l3.2 3.2-8.5 8.5z" />
      <path d="m14.4 8.6 3-3a2 2 0 0 1 2.8 2.8l-3 3" />
    </>
  ),
  cartridge: (
    <>
      <rect x="7" y="6" width="10" height="15" rx="1.4" />
      <path d="M11 6V3.6h2V6" />
      <path d="M9.4 10h5.2" />
    </>
  ),
  "material-blob": (
    <>
      <path d="M4 16.5c2.6-3.4 5.4-4.6 8.4-3.6 3 1 5.6.4 7.6-1.8v6.4c-2.4 1.8-5 2.2-7.8 1.2-2.8-1-5.5-.6-8.2 1.2z" />
    </>
  ),
  respirator: (
    <>
      <path d="M4.5 9.5c2.6-1.6 5.1-2.4 7.5-2.4s4.9.8 7.5 2.4v3.2c0 3.6-2.5 6.4-7.5 8.3-5-1.9-7.5-4.7-7.5-8.3z" />
      <path d="M4.5 12.6h15" />
    </>
  ),
  glove: (
    <>
      <path d="M8 21v-5.4l-2.4-2a2 2 0 0 1 2.6-3L10 12V4.6a1.5 1.5 0 0 1 3 0V11l1.4-.9a1.5 1.5 0 0 1 2.2 1.4V21z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.6 20 6v6.4c0 4.4-3.2 7.6-8 9.2-4.8-1.6-8-4.8-8-9.2V6z" />
    </>
  ),
  "spray-gun": (
    <>
      <path d="M3.5 9h9.5l4 2.4v2.2l-4 2.4H8l-1 4.5H4.2l1.1-4.5H3.5z" />
      <path d="M17 11.8h3.5v2h-3.5" />
      <path d="M8.4 9V5.4h3.4V9" />
    </>
  ),
  "gravity-cup": (
    <>
      <path d="M6.5 4h11l-1.6 10.6a2 2 0 0 1-2 1.7h-3.8a2 2 0 0 1-2-1.7z" />
      <path d="M11 16.3V21" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3.2c3.6 4.4 5.6 7.6 5.6 10.2A5.6 5.6 0 0 1 6.4 13.4c0-2.6 2-5.8 5.6-10.2z" />
    </>
  ),
  "paint-tin": (
    <>
      <rect x="5" y="7.5" width="14" height="13" rx="1.2" />
      <path d="M4 7.5h16" />
      <path d="M8.5 7.5V5a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  brush: (
    <>
      <path d="M9 21v-6h6v6z" />
      <path d="M9.8 15V9.4h4.4V15" />
      <path d="M10.6 9.4V3.4h2.8v6" />
    </>
  ),
  swatch: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="0.8" />
      <rect x="13" y="4" width="7" height="7" rx="0.8" />
      <rect x="4" y="13" width="7" height="7" rx="0.8" />
      <rect x="13" y="13" width="7" height="7" rx="0.8" />
    </>
  ),
};

/** Glyphs rendered as outlines rather than solids. */
const STROKE_GLYPHS = new Set<GlyphId>([
  "disc",
  "disc-perforated",
  "sanding-block",
  "tape-roll",
  "film-sheet",
  "spray-can",
  "nozzle-cap",
  "spray-arc",
  "polishing-pad",
  "polish-wave",
  "backing-plate",
  "spatula",
  "cartridge",
  "respirator",
  "spray-gun",
  "gravity-cup",
  "paint-tin",
  "brush",
  "swatch",
]);

/**
 * Which glyphs belong to which platform category (`lib/productTaxonomy.mjs`).
 *
 * A scene only ever draws glyphs from its own group, so an abrasives page never
 * rains spray cans. Categories with no distinctive object of their own borrow
 * the workshop set rather than inventing an object that does not exist.
 */
export const CATEGORY_GLYPHS: Record<string, GlyphId[]> = {
  abrazivi: ["disc", "disc-perforated", "sanding-block", "backing-plate"],
  maskiranje: ["tape-roll", "film-sheet", "paper-strip"],
  sprejevi: ["spray-can", "nozzle-cap", "spray-arc"],
  boje: ["paint-tin", "brush", "swatch", "droplet"],
  poliranje: ["polishing-pad", "polish-wave", "backing-plate", "disc"],
  kitovi: ["spatula", "cartridge", "material-blob"],
  lepkovi: ["cartridge", "material-blob", "droplet"],
  zastita: ["respirator", "glove", "shield"],
  oprema: ["spray-gun", "gravity-cup", "nozzle-cap"],
  radionica: ["spray-gun", "gravity-cup", "droplet"],
  ciscenje: ["droplet", "gravity-cup", "material-blob"],
  pribor: ["backing-plate", "sanding-block", "spatula"],
};

export const DEFAULT_GLYPHS: GlyphId[] = ["disc", "spray-can", "spatula", "droplet"];

export function glyphsForCategory(categorySlug: string | undefined): GlyphId[] {
  return CATEGORY_GLYPHS[categorySlug ?? ""] ?? DEFAULT_GLYPHS;
}

export function CategoryGlyph({ id }: { id: GlyphId }) {
  const stroke = STROKE_GLYPHS.has(id);

  return (
    <svg
      viewBox="0 0 24 24"
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={stroke ? 1.5 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[id]}
    </svg>
  );
}
