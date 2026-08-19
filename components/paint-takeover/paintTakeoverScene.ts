/**
 * Tipizovan omotač nad `paintTakeoverScene.mjs`. Implementacija je u `.mjs`
 * zbog `node --test`; ovde su samo tipovi.
 */
import { resolveTakeoverScene as resolveImpl } from "./paintTakeoverScene.mjs";
import type { FinalReviewMode } from "./paintTakeoverTypes";

export type TakeoverSceneWindows = {
  surface: readonly [number, number];
  background: readonly [number, number];
  content: readonly [number, number];
  contentMobile: readonly [number, number];
  contrast: readonly [number, number];
  strokes: readonly [number, number];
  hold: readonly [number, number];
  chapter: readonly [number, number];
};

export type TakeoverSceneInput = {
  /** Monotoni 0..1 signal: approach faza + pinovani kadar. */
  timeline: number;
  windows: TakeoverSceneWindows;
  mode?: FinalReviewMode;
  reducedMotion?: boolean;
  mobile?: boolean;
  washDisabled?: boolean;
  /** Postoji li razrešen artwork (grupe ili linije) u DOM-u. */
  hasArtwork?: boolean;
};

export type TakeoverScene = {
  surface: number;
  surfaceOffsetSvh: number;
  artworkOffsetSvh: number;
  backgroundProgress: number;
  backgroundOpacity: number;
  backgroundScale: number;
  backgroundXVw: number;
  backgroundYPx: number;
  content: number;
  contentOpacity: number;
  contentOffsetPx: number;
  contrastOpacity: number;
  colorWashOpacity: number;
  heroOpacity: number;
  lineworkProgress: number;
  holdDrift: number;
};

export function resolveTakeoverScene(input: TakeoverSceneInput): TakeoverScene {
  return resolveImpl(input) as TakeoverScene;
}
