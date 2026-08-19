/**
 * Tipizovan omotač nad `paintTakeoverChrome.mjs`.
 *
 * Implementacija je namerno u `.mjs` da je `node --test` vozi bez build koraka;
 * ovde su samo tipovi. Ne sme se dodati drugi mehanizam za temu Headera.
 */
import {
  ACTIVE_ATTRIBUTE as ACTIVE_ATTRIBUTE_IMPL,
  CHAPTER_RAMP_PX as CHAPTER_RAMP_PX_IMPL,
  CHAPTER_VARIABLE as CHAPTER_VARIABLE_IMPL,
  createChromeOwnership as createChromeOwnershipImpl,
  HEADER_PROBE_FALLBACK as HEADER_PROBE_FALLBACK_IMPL,
  probeLineFor as probeLineForImpl,
  resolveTakeoverChrome as resolveTakeoverChromeImpl,
} from "./paintTakeoverChrome.mjs";
import type { PaintTakeoverState } from "./paintTakeoverTypes";

export const HEADER_PROBE_FALLBACK: number = HEADER_PROBE_FALLBACK_IMPL;
export const CHAPTER_RAMP_PX: number = CHAPTER_RAMP_PX_IMPL;
export const ACTIVE_ATTRIBUTE: string = ACTIVE_ATTRIBUTE_IMPL;
export const CHAPTER_VARIABLE: string = CHAPTER_VARIABLE_IMPL;

export type TakeoverChromeInput = {
  /** `getBoundingClientRect().top` sekcije takeovera. */
  sectionTop: number;
  /** `getBoundingClientRect().bottom` sekcije takeovera. */
  sectionBottom: number;
  /** Donja ivica sticky Headera u viewport koordinatama. */
  probeLine: number;
  ramp?: number;
};

export type TakeoverChromeResult = {
  /** Kontinualni 0..1 signal koji nose Header, orb i section rail. */
  chapter: number;
  /** Da li probe linija stoji unutar sekcije — vlasništvo nad chrome-om. */
  owned: boolean;
  phase: PaintTakeoverState;
};

export function probeLineFor(headerBottom: number | null | undefined): number {
  return probeLineForImpl(headerBottom) as number;
}

export function resolveTakeoverChrome(
  input: TakeoverChromeInput,
): TakeoverChromeResult {
  return resolveTakeoverChromeImpl(input) as TakeoverChromeResult;
}

export type ChromeOwnership = {
  sync: (chrome: TakeoverChromeResult) => void;
  clear: () => void;
  state: () => PaintTakeoverState | null;
};

export function createChromeOwnership(options: {
  root: HTMLElement;
  enabled?: boolean;
}): ChromeOwnership {
  return createChromeOwnershipImpl(options) as ChromeOwnership;
}
