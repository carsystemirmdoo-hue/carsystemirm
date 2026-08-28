/**
 * Čista politika vidljivosti i autoplay-a za brend kampanjske carousele.
 *
 * Odluke su izdvojene iz `useBrandCampaignCarousel` da bi ugovor bio izvršno
 * testiran, a ne samo pročitan iz izvornog koda. Modul je namerno `.mjs` bez
 * DOM zavisnosti, pa `node --test` može da ga pozove direktno.
 *
 * @typedef {"focus" | "offscreen" | "document-hidden" | "manual-hold" | "transition" | "reduced-motion" | "user-paused" | "dragging"} CampaignAutoplayPauseReason
 * @typedef {"idle" | "covering" | "revealing"} CampaignTransitionPhase
 */

/**
 * Hysteresis pragovi: sekcija postaje „vidljiva" na 45%, a prestaje da bude
 * vidljiva ispod 25%. Dva različita praga sprečavaju treperenje na jednoj
 * granici dok korisnik sporo skroluje.
 */
export const CAMPAIGN_VISIBILITY_ENTER_RATIO = 0.45;
export const CAMPAIGN_VISIBILITY_EXIT_RATIO = 0.25;

/**
 * Selektor stvarno interaktivnih elemenata unutar carousel sekcije.
 * Koristi se jos samo za fokus, ne za hover — hover vise ne pauzira autoplay.
 */
export const CAMPAIGN_INTERACTIVE_SELECTOR =
  'a[href], button, [role="button"], input, select, textarea, [data-campaign-interactive]';

/**
 * Koliki deo sekcije je stvarno u viewportu, 0..1.
 *
 * Deli se sa `min(visinaSekcije, viewportHeight)` da hero viši od viewporta
 * može da dosegne 1, umesto da zaglavi na maloj vrednosti.
 *
 * @param {{ top: number, bottom: number, viewportHeight: number }} input
 * @returns {number}
 */
export function campaignVisibleRatio({ top, bottom, viewportHeight }) {
  const height = bottom - top;
  if (height <= 0 || viewportHeight <= 0) return 0;

  const visiblePx = Math.max(
    0,
    Math.min(bottom, viewportHeight) - Math.max(top, 0),
  );
  const reference = Math.min(height, viewportHeight);
  if (reference <= 0) return 0;

  return Math.min(1, Math.max(0, visiblePx / reference));
}

/**
 * Da li se sekcija smatra vidljivom, sa hysteresis-om.
 *
 * Sticky globalni header prekriva samo gornjih ~90px heroja, što je duboko
 * unutar tolerancije ovih pragova — header sam po sebi nikada ne može da
 * učini hero „nevidljivim".
 *
 * @param {{ top: number, bottom: number, viewportHeight: number, wasVisible: boolean }} input
 * @returns {boolean}
 */
export function resolveCampaignVisibility(input) {
  const ratio = campaignVisibleRatio(input);
  if (input.wasVisible) return ratio >= CAMPAIGN_VISIBILITY_EXIT_RATIO;
  return ratio >= CAMPAIGN_VISIBILITY_ENTER_RATIO;
}

/**
 * `manual-hold` nije blokada nego odloženo pokretanje — autoplay se posle
 * cooldowna sam nastavlja. Sve ostale pauze su prave blokade.
 *
 * @param {readonly CampaignAutoplayPauseReason[]} pauseReasons
 * @returns {boolean}
 */
export function hasBlockingPauseReason(pauseReasons) {
  return pauseReasons.some((reason) => reason !== "manual-hold");
}

/**
 * Jedini izvor istine za „da li autoplay sme da radi sada".
 *
 * @param {{
 *   slideCount: number,
 *   documentIsVisible: boolean,
 *   sectionIsVisible: boolean,
 *   reducedMotion: boolean,
 *   pauseReasons: readonly CampaignAutoplayPauseReason[],
 *   pendingIndex: number | null,
 *   transitionPhase: CampaignTransitionPhase,
 * }} input
 * @returns {boolean}
 */
export function shouldCampaignAutoplay({
  slideCount,
  documentIsVisible,
  sectionIsVisible,
  reducedMotion,
  pauseReasons,
  pendingIndex,
  transitionPhase,
}) {
  return (
    slideCount > 1 &&
    documentIsVisible &&
    sectionIsVisible &&
    !reducedMotion &&
    !hasBlockingPauseReason(pauseReasons) &&
    pendingIndex === null &&
    transitionPhase === "idle"
  );
}

/**
 * Da li fokusirani element predstavlja stvarnu korisničku fokus interakciju.
 *
 * Default fokus na `<body>` i programatski fokus (bez `:focus-visible`) se ne
 * računaju.
 *
 * @param {{
 *   activeElement: { tagName?: string } | null,
 *   stage: { contains: (node: never) => boolean } | null,
 *   matchesFocusVisible: boolean,
 * }} input
 * @returns {boolean}
 */
export function isCampaignFocusInteraction({
  activeElement,
  stage,
  matchesFocusVisible,
}) {
  if (!activeElement || !stage) return false;
  if (activeElement.tagName === "BODY" || activeElement.tagName === "HTML") {
    return false;
  }
  if (!matchesFocusVisible) return false;
  return stage.contains(/** @type {never} */ (activeElement));
}

/* ==========================================================================
 * Ručno upravljanje: tastatura i swipe
 *
 * Odluke su ovde, a ne u hooku, iz istog razloga kao i autoplay: da bi se
 * mogle izvršno testirati. Hook zadržava sve što traži DOM — `preventDefault`,
 * `pointerId`, refove — a ovde ostaje samo pitanje „koji je smer, ako ijedan".
 * ========================================================================== */

/**
 * Koliko horizontalnog pomeraja traži swipe.
 *
 * 44 px je isto što i minimalna dodirna meta: kraći pokret je češće promašen
 * dodir nego namera.
 */
export const CAMPAIGN_SWIPE_THRESHOLD_PX = 44;

/**
 * Koliko horizontala mora da nadjača vertikalu da bi pokret bio swipe, a ne
 * skrol koji je slučajno skrenuo u stranu.
 */
export const CAMPAIGN_SWIPE_AXIS_RATIO = 1.2;

/** Vertikalni pomeraj posle kog se pokret prestaje smatrati swipe-om. */
export const CAMPAIGN_SWIPE_CANCEL_PX = 12;

/**
 * Smer koji traži pritisnut taster, ili `null`.
 *
 * Modifikatori se propuštaju dalje: `Alt+←` je navigacija unazad u
 * pretraživaču i carousel je ne sme preoteti.
 *
 * @param {{ key: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean }} event
 * @returns {"previous" | "next" | null}
 */
export function resolveCampaignKeyIntent(event) {
  if (!event) return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "ArrowLeft") return "previous";
  if (event.key === "ArrowRight") return "next";
  return null;
}

/**
 * Da li pokret prestaje da bude swipe zato što je skrenuo u vertikalu.
 *
 * Proverava se tokom pokreta, ne na kraju: kada korisnik krene da skroluje,
 * naknadni horizontalni trzaj ne sme da promeni slajd.
 *
 * @param {{ deltaX: number, deltaY: number }} input
 * @returns {boolean}
 */
export function shouldCancelCampaignSwipe({ deltaX, deltaY }) {
  return (
    Math.abs(deltaY) > Math.abs(deltaX) &&
    Math.abs(deltaY) > CAMPAIGN_SWIPE_CANCEL_PX
  );
}

/**
 * Smer koji traži završen pokret, ili `null`.
 *
 * Pomeraj udesno (`deltaX > 0`) vodi na PRETHODNI slajd — prst vuče sadržaj
 * udesno, pa se otkriva ono što je bilo levo.
 *
 * @param {{ deltaX: number, deltaY: number, cancelled?: boolean }} input
 * @returns {"previous" | "next" | null}
 */
export function resolveCampaignSwipeIntent({ deltaX, deltaY, cancelled = false }) {
  if (cancelled) return null;
  if (Math.abs(deltaX) < CAMPAIGN_SWIPE_THRESHOLD_PX) return null;
  if (Math.abs(deltaX) <= Math.abs(deltaY) * CAMPAIGN_SWIPE_AXIS_RATIO) return null;
  return deltaX > 0 ? "previous" : "next";
}
