import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const campaignStageUrl = new URL("./RmCampaignStage.tsx", import.meta.url);

test("hero pauses only after its bottom edge passes above the viewport", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(source, /const rect = hero\.getBoundingClientRect\(\)/);
  assert.match(source, /const nextIsAboveViewport = rect\.bottom <= 0/);
  assert.match(source, /window\.addEventListener\("scroll", requestPositionUpdate/);
  assert.match(source, /passive: true/);
  assert.match(source, /window\.addEventListener\("resize", requestPositionUpdate\)/);
  assert.match(source, /scrollFrameRef\.current !== null/);
  assert.match(source, /window\.requestAnimationFrame\(\s*updateHeroPosition/);
  assert.doesNotMatch(source, /IntersectionObserver|intersectionRatio/);
});

test("autoplay has one timeout ref and no interval or permanent autoplay frame", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(
    source,
    /const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> \| null>/,
  );
  assert.match(source, /const clearAutoplayTimer = useCallback/);
  assert.doesNotMatch(source, /setInterval|autoplayFrameRef/);
  assert.match(
    source,
    /clearAutoplayTimer\(\);\s*clearProgressFrame\(\);[\s\S]*if \(!shouldAutoplay\) return/,
  );
});

test("offscreen normalization cancels stale preload work and restores idle state", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(source, /requestTokenRef\.current \+= 1/);
  assert.match(source, /pendingRequestRef\.current = false/);
  assert.match(source, /pendingIndexRef\.current = null/);
  assert.match(source, /setPendingIndex\(null\)/);
  assert.match(source, /updateTransitionPhase\("idle"\)/);
  assert.match(
    source,
    /requestTokenRef\.current !== requestToken[\s\S]*isHeroAboveViewportRef\.current[\s\S]*!documentIsVisibleRef\.current/,
  );
});

test("document visibility and reduced motion are part of autoplay eligibility", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(
    source,
    /!isHeroAboveViewport &&\s*documentIsVisible &&\s*!reducedMotion &&\s*rmCampaignSlides\.length > 1/,
  );
  assert.match(source, /document\.removeEventListener\("visibilitychange"/);
  assert.match(source, /window\.removeEventListener\("scroll", requestPositionUpdate\)/);
  assert.match(source, /window\.removeEventListener\("resize", requestPositionUpdate\)/);
  assert.match(source, /window\.cancelAnimationFrame\(scrollFrameRef\.current\)/);
});
