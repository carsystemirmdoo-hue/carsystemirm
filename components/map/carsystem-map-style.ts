import type { StyleSpecification } from "maplibre-gl";

/**
 * Shared Carsystem MapLibre foundation: one free vector-tile style source
 * (OpenFreeMap, no API key, commercial use allowed) with a runtime-derived
 * dark variant, plus site-theme helpers. Every real map on the site (partner
 * locator, contact teaser, homepage company preview) builds on this so the
 * map family stays visually consistent.
 */
export const LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export function readSiteTheme(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Watches the site theme class on <html> and reports changes. Returns a
 * disconnect function. Used by map components to swap map styles in step
 * with the existing ThemeToggle/ThemeScript system.
 */
export function observeSiteTheme(onChange: (theme: "light" | "dark") => void) {
  const observer = new MutationObserver(() => onChange(readSiteTheme()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

let lightStylePromise: Promise<StyleSpecification> | null = null;
let darkStylePromise: Promise<StyleSpecification> | null = null;

/** The tile CDN occasionally serves transient 404s; retry briefly. */
async function fetchJsonWithRetry<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Map request failed: ${response.status} ${url}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Resolves the style's TileJSON indirection (`source.url`) into inline tile
 * URLs at load time, so a transient TileJSON failure is retried here instead
 * of silently stalling MapLibre's style load. TileJSON attribution is kept.
 */
async function resolveSourceTileJson(style: StyleSpecification) {
  const sources = style.sources as Record<string, Record<string, unknown>>;

  await Promise.all(
    Object.values(sources).map(async (source) => {
      if (typeof source.url !== "string") return;
      const tileJson = await fetchJsonWithRetry<Record<string, unknown>>(source.url);
      delete source.url;
      for (const key of ["tiles", "minzoom", "maxzoom", "bounds", "attribution"]) {
        if (tileJson[key] !== undefined) source[key] = tileJson[key];
      }
    }),
  );

  return style;
}

export function loadCarsystemMapStyle(theme: "light" | "dark") {
  if (!lightStylePromise) {
    lightStylePromise = fetchJsonWithRetry<StyleSpecification>(LIGHT_STYLE_URL)
      .then((style) => resolveSourceTileJson(style))
      .catch((error) => {
        // Never cache a failed load; the next call should retry from scratch.
        lightStylePromise = null;
        darkStylePromise = null;
        throw error;
      });
  }

  if (theme === "light") return lightStylePromise;

  if (!darkStylePromise) {
    darkStylePromise = lightStylePromise.then((style) => toDarkStyle(style));
  }

  return darkStylePromise;
}

/* ---------- light → dark style transform ---------- */

const COLOR_PROP_PATTERN = /-color$/;

function toDarkStyle(style: StyleSpecification): StyleSpecification {
  const clone = JSON.parse(JSON.stringify(style)) as StyleSpecification;

  clone.layers = clone.layers.map((layer) => {
    if ("paint" in layer && layer.paint) {
      const paint = layer.paint as Record<string, unknown>;
      Object.keys(paint).forEach((key) => {
        if (COLOR_PROP_PATTERN.test(key)) {
          paint[key] = remapColorValue(paint[key], key.includes("halo"));
        }
      });
    }
    return layer;
  });

  return clone;
}

function remapColorValue(value: unknown, isHalo: boolean): unknown {
  if (typeof value === "string") {
    const parsed = parseCssColor(value);
    return parsed ? darkenColor(parsed, isHalo) : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => remapColorValue(entry, isHalo));
  }

  return value;
}

type Rgba = { r: number; g: number; b: number; a: number };

function parseCssColor(value: string): Rgba | null {
  const hexMatch = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgbMatch = value
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
      a: rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]),
    };
  }

  const hslMatch = value
    .trim()
    .match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (hslMatch) {
    const [r, g, b] = hslToRgb(
      Number(hslMatch[1]) / 360,
      Number(hslMatch[2]) / 100,
      Number(hslMatch[3]) / 100,
    );
    return { r, g, b, a: hslMatch[4] === undefined ? 1 : Number(hslMatch[4]) };
  }

  return null;
}

function darkenColor(color: Rgba, isHalo: boolean): string {
  const [h, s, l] = rgbToHsl(color.r, color.g, color.b);

  // Flip lightness into a compressed dark range: near-white surfaces become
  // near-black land, dark labels become restrained light gray. Halos hug the
  // dark background instead of glowing.
  const flipped = 1 - l;
  const nextL = isHalo
    ? Math.min(0.16, 0.05 + flipped * 0.08)
    : 0.06 + flipped * 0.6;
  const nextS = Math.min(s * 0.5, 0.25);

  const [r, g, b] = hslToRgb(h, nextS, Math.max(0.04, Math.min(nextL, 0.86)));
  return color.a >= 1
    ? `rgb(${r},${g},${b})`
    : `rgba(${r},${g},${b},${color.a})`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }

  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };

  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}
