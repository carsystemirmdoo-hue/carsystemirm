/**
 * Ugovor STRUKTURE zajednickog carousel jezgra.
 *
 * Sve tvrdnje ovde citaju IZVORNI TEKST `useBrandCampaignCarousel.ts`. To NIJE
 * dokaz ponasanja: hook se ne izvrsava, nijedan DOM se ne montira, nijedan
 * tajmer ne otkucava. Ono sto se ovim brani je oblik — da ne postoji drugi
 * autoplay tajmer, da se odluke ne prepisuju pored politike, da svaki globalni
 * listener ima svoj cleanup.
 *
 * Ponasanje se dokazuje izvrsno u `campaignAutoplayPolicy.test.mjs`, nad
 * ciste funkcije: vidljivost, autoplay uslovi, fokus, tastatura i swipe.
 * Sve sto se moglo izvrsiti preslo je tamo; ovde ostaje samo ono sto bez
 * pretrazivaca nema kako da se pokrene.
 *
 * Poznato ogranicenje: refaktor koji zadrzi ime a promeni logiku prosao bi kroz
 * ove tvrdnje. Zato se nove odluke pisu u politiku, ne u hook.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hookUrl = new URL("./useBrandCampaignCarousel.ts", import.meta.url);

test("vidljivost sekcije se meri iz rect-a na scroll/resize, bez IntersectionObservera", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.match(source, /const rect = section\.getBoundingClientRect\(\)/);
  assert.match(source, /resolveCampaignVisibility\(\{/);
  assert.match(source, /window\.addEventListener\("scroll", requestPositionUpdate/);
  assert.match(source, /passive: true/);
  assert.match(source, /window\.addEventListener\("resize", requestPositionUpdate\)/);
  assert.match(source, /scrollFrameRef\.current !== null/);
  assert.match(
    source,
    /window\.requestAnimationFrame\(updateSectionVisibility\)/,
  );
  assert.doesNotMatch(source, /IntersectionObserver|intersectionRatio/);
});

test("autoplay has one timeout ref and no interval or permanent autoplay frame", async () => {
  const source = await readFile(hookUrl, "utf8");

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
  const source = await readFile(hookUrl, "utf8");

  assert.match(source, /requestTokenRef\.current \+= 1/);
  assert.match(source, /pendingRequestRef\.current = false/);
  assert.match(source, /pendingIndexRef\.current = null/);
  assert.match(source, /setPendingIndex\(null\)/);
  assert.match(source, /updateTransitionPhase\("idle"\)/);
  assert.match(
    source,
    /requestTokenRef\.current !== requestToken[\s\S]*!sectionIsVisibleRef\.current[\s\S]*!documentIsVisibleRef\.current/,
  );
});

test("document visibility and reduced motion are part of autoplay eligibility", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  // Uslovi zive u politici; hook joj samo predaje stanje.
  assert.match(
    source,
    /shouldCampaignAutoplay\(\{[\s\S]*documentIsVisible,[\s\S]*reducedMotion,[\s\S]*sectionIsVisible,[\s\S]*slideCount,/,
  );
  assert.match(source, /document\.removeEventListener\("visibilitychange"/);
  assert.match(source, /window\.removeEventListener\("scroll", requestPositionUpdate\)/);
  assert.match(source, /window\.removeEventListener\("resize", requestPositionUpdate\)/);
  assert.match(source, /window\.cancelAnimationFrame\(scrollFrameRef\.current\)/);
});

test("tastatura i swipe se odlucuju u politici, ne u hooku", async () => {
  const source = await readFile(hookUrl, "utf8");

  /*
   * Hook zadrzava samo ono sto trazi DOM: `preventDefault`, `pointerId`,
   * refove. Smer odlucuju ciste funkcije, koje su izvrsno testirane.
   */
  assert.match(source, /resolveCampaignKeyIntent\(event\)/);
  assert.match(source, /shouldCancelCampaignSwipe\(\{ deltaX, deltaY \}\)/);
  assert.match(source, /resolveCampaignSwipeIntent\(\{/);

  // Prepisane kopije odluka bi se razisle sa politikom.
  assert.doesNotMatch(source, /event\.key === "Arrow/);
  assert.doesNotMatch(source, /SWIPE_THRESHOLD_PX = /);

  // Pauze i dalje zivi hook, jer su vezane za njegovo stanje.
  assert.match(source, /updatePauseReason\("manual-hold", manual\)/);
  assert.match(source, /updatePauseReason\("dragging", true\)/);
  assert.match(source, /updatePauseReason\("focus",/);
});

test("hook delegira odluke o pauzi i vidljivosti deljenoj politici", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.match(
    source,
    /from "@\/components\/motion\/campaignAutoplayPolicy\.mjs"/,
    "hook mora koristiti deljenu politiku, ne inline uslove",
  );
  assert.match(source, /shouldCampaignAutoplay\(/);
  assert.match(source, /resolveCampaignVisibility\(/);
  assert.match(source, /isCampaignFocusInteraction\(/);
});

test("hover uopste nije razlog pauze", async () => {
  const source = await readFile(hookUrl, "utf8");

  // Autoplay mora da nastavi i kada kursor miruje iznad heroja ili kontrola.
  assert.doesNotMatch(source, /(stage|hero)\.matches\(":hover"\)/);
  assert.doesNotMatch(source, /updatePauseReason\("hover"/);
  assert.doesNotMatch(source, /onPointerOver|onPointerEnter|onPointerLeave/);
  // Ali aktivan drag i dalje pauzira.
  assert.match(source, /updatePauseReason\("dragging", true\)/);
  assert.match(source, /updatePauseReason\("dragging", false\)/);
});

test("timer je nezavisan od progress rAF petlje", async () => {
  const source = await readFile(hookUrl, "utf8");

  // Promenu slajda pokrece setTimeout deadline, ne requestAnimationFrame.
  assert.match(
    source,
    /autoplayTimerRef\.current = setTimeout\([\s\S]*?void requestSlide\(activeIndexRef\.current \+ 1, false, "next"\);[\s\S]*?\}, autoplayIntervalMs\)/,
  );
  // rAF samo crta progress i nikada ne menja indeks.
  const rafBlock = source.slice(
    source.indexOf("const updateProgress = () =>"),
    source.indexOf("progressFrameRef.current = window.requestAnimationFrame(updateProgress)"),
  );
  assert.doesNotMatch(rafBlock, /requestSlide|setActiveIndex/);
});

test("vidljivost koristi hysteresis pragove, ne binarni rect.bottom <= 0", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.doesNotMatch(source, /rect\.bottom <= 0/);
  assert.match(source, /viewportHeight/);
  assert.match(source, /wasVisible/);
});

test("smer je eksplicitan, pa dva slajda ne kolabiraju na jedan smer", async () => {
  const source = await readFile(hookUrl, "utf8");

  // Kod tacno dva slajda (i+1)%2 === (i-1+2)%2, pa izvedeni smer ne razlikuje
  // next od previous. Smer zato mora doci iz eksplicitnog zahteva.
  assert.match(source, /directionHint\?: "next" \| "previous"/);
  assert.match(source, /const nextDirection =\s*\n?\s*directionHint \?\?/);
  assert.match(
    source,
    /requestSlide\(activeIndexRef\.current - 1, manual, "previous"\)/,
  );
  assert.match(
    source,
    /requestSlide\(activeIndexRef\.current \+ 1, manual, "next"\)/,
  );
  assert.match(
    source,
    /requestSlide\(activeIndexRef\.current \+ 1, false, "next"\)/,
  );
});

test("po montiranoj instanci jedan skup listenera, svaki sa cleanupom", async () => {
  const source = await readFile(hookUrl, "utf8");

  const count = (pattern) => (source.match(pattern) ?? []).length;

  /*
   * Ugovor je PO INSTANCI, ne globalno.
   *
   * Ovde se NE tvrdi da dve montirane instance dele listenere — ne dele.
   * Singleton nije uveden namerno: danas su tri potrosaca na tri razlicite
   * rute, pa dve instance nisu istovremeno na strani. Kada bi bile, dobile bi
   * po svoj skup — sto nije curenje, jer svaka uredno cisti za sobom, ali
   * jeste ponovljeni rad koji bi tada trebalo meriti.
   */
  assert.equal(count(/window\.addEventListener\("scroll"/g), 1);
  assert.equal(count(/window\.removeEventListener\("scroll"/g), 1);
  assert.equal(count(/window\.addEventListener\("resize"/g), 1);
  assert.equal(count(/window\.removeEventListener\("resize"/g), 1);
  assert.equal(count(/document\.addEventListener\("visibilitychange"/g), 1);
  assert.equal(count(/document\.removeEventListener\("visibilitychange"/g), 1);

  // Jedan autoplay timer, jedan progress frame, jedan scroll frame.
  assert.equal(count(/autoplayTimerRef = useRef/g), 1);
  assert.equal(count(/progressFrameRef = useRef/g), 1);
  assert.equal(count(/scrollFrameRef = useRef/g), 1);
  assert.doesNotMatch(source, /setInterval/);

  // Pointer/keyboard listeneri idu kroz React props, ne kroz globalni window.
  assert.doesNotMatch(source, /window\.addEventListener\("(pointer|mouse|touch|key)/);
});
