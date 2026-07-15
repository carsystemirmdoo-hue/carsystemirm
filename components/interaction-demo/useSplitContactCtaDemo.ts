"use client";

import { type RefObject, useEffect } from "react";

/*
 * Deterministic Reels/TikTok loop for ?demo=1, shared by the split contact CTA
 * showcase stages. It never forks the interaction: it flips the same
 * data-pointer-active attribute the production MotionSystem writes on the
 * .cs-magnetic-cta / [data-motion-surface] root (which the production
 * SplitContactCta CSS opens on) and marks each option with data-demo-hover so
 * the option lifts run through the production anchor's own transition. It adds
 * one showcase-only attribute, data-demo-armed, so the sequence can hold a
 * visible "pointer has arrived / armed" state *before* the split — the
 * choreography the showcase layer animates (arrive -> arm -> expand ->
 * separate). Both attributes drive real CSS states, not a faked video overlay.
 *
 * The visible motion is production/showcase CSS easing; this timeline only
 * schedules the discrete state changes with setTimeout (no per-frame stepping),
 * which advances deterministically under the virtual-time capture used to
 * record a genuinely smooth 60 fps take.
 *
 * 0.00s default closed CTA (only the inquiry button)
 * 0.60s armed: pointer lands, the CTA lifts + gains an accent ring
 * 1.25s split begins: container expands, then the call option separates out
 * ~1.75s split fully resolved (call option above inquiry)
 * 2.45s first option (CALL US) receives the hover lift
 * 3.20s first option returns
 * 3.60s second option (SEND INQUIRY) receives the hover lift
 * 4.35s second option returns
 * 4.80s collapse: the two options merge back into one CTA
 * 5.45s disarm: the CTA settles to its resting state
 * 7.20s clean loop boundary
 */
export const splitContactDemoLoopMs = 7200;

type DemoStep =
  | { at: number; target: "root"; open: boolean }
  | { at: number; target: "armed"; armed: boolean }
  | { at: number; target: "call" | "inquiry"; hover: boolean };

const demoTimeline: DemoStep[] = [
  { at: 0, target: "root", open: false },
  { at: 0, target: "armed", armed: false },
  { at: 0, target: "call", hover: false },
  { at: 0, target: "inquiry", hover: false },
  { at: 600, target: "armed", armed: true },
  { at: 1250, target: "root", open: true },
  { at: 2450, target: "call", hover: true },
  { at: 3200, target: "call", hover: false },
  { at: 3600, target: "inquiry", hover: true },
  { at: 4350, target: "inquiry", hover: false },
  { at: 4800, target: "root", open: false },
  { at: 5450, target: "armed", armed: false },
];

export function useSplitContactCtaDemo<TElement extends HTMLElement>(
  frameRef: RefObject<TElement>,
  isDemoMode: boolean,
) {
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !isDemoMode) return undefined;

    /* The production CTA root carries data-motion-surface; the two options are
       its only anchors, in DOM order call -> inquiry. */
    const root = frame.querySelector<HTMLElement>("[data-motion-surface]");
    if (!root) return undefined;
    const anchors = Array.from(root.querySelectorAll<HTMLElement>("a"));
    const callOption = anchors[0] ?? null;
    const inquiryOption = anchors[1] ?? null;

    const timers: number[] = [];

    function applyStep(step: DemoStep) {
      if (step.target === "root") {
        root!.dataset.pointerActive = step.open ? "true" : "false";
        return;
      }
      if (step.target === "armed") {
        root!.dataset.demoArmed = step.armed ? "true" : "false";
        return;
      }
      const option = step.target === "call" ? callOption : inquiryOption;
      if (option) option.dataset.demoHover = step.hover ? "true" : "false";
    }

    function scheduleLoop() {
      timers.length = 0;
      for (const step of demoTimeline) {
        timers.push(window.setTimeout(() => applyStep(step), step.at));
      }
      timers.push(window.setTimeout(scheduleLoop, splitContactDemoLoopMs));
    }

    /* Fonts settle the CTA width before the first cycle. */
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      scheduleLoop();
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      root.dataset.pointerActive = "false";
      root.dataset.demoArmed = "false";
      if (callOption) callOption.dataset.demoHover = "false";
      if (inquiryOption) inquiryOption.dataset.demoHover = "false";
    };
  }, [frameRef, isDemoMode]);
}
