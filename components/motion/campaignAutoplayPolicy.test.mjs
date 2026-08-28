import assert from "node:assert/strict";
import test from "node:test";
import * as policy from "./campaignAutoplayPolicy.mjs";

test("hero potpuno vidljiv na scrollY = 0 znaci autoplay", () => {
  // 1440x900, sticky header 89px, hero 812px — stvarne izmerene vrednosti.
  const visible = policy.resolveCampaignVisibility({
    top: 89,
    bottom: 901,
    viewportHeight: 900,
    wasVisible: false,
  });
  assert.equal(visible, true, "hero na vrhu stranice mora biti vidljiv");

  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 4,
      documentIsVisible: true,
      sectionIsVisible: visible,
      reducedMotion: false,
      pauseReasons: [],
      pendingIndex: null,
      transitionPhase: "idle",
    }),
    true,
  );
});

test("sticky header ne cini hero nevidljivim", () => {
  // Hero visi 739px (Baslac), header prekriva gornjih 89px.
  const ratio = policy.campaignVisibleRatio({
    top: 89,
    bottom: 828,
    viewportHeight: 900,
  });
  assert.equal(ratio, 1, "ceo hero je unutar viewporta");
});

test("hero visi od viewporta i dalje moze biti potpuno vidljiv", () => {
  // Mobilni: hero 800px, viewport 844px, ali pocinje na 104px.
  const ratio = policy.campaignVisibleRatio({
    top: 104,
    bottom: 904,
    viewportHeight: 844,
  });
  assert.ok(ratio > 0.9, `ocekivano > 0.9, dobijeno ${ratio}`);
});

test("hero van viewporta pauzira autoplay", () => {
  const visible = policy.resolveCampaignVisibility({
    top: -812,
    bottom: 0,
    viewportHeight: 900,
    wasVisible: true,
  });
  assert.equal(visible, false);

  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 4,
      documentIsVisible: true,
      sectionIsVisible: visible,
      reducedMotion: false,
      pauseReasons: ["offscreen"],
      pendingIndex: null,
      transitionPhase: "idle",
    }),
    false,
  );
});

test("progress ne sme poceti tek kada hero izlazi sa ekrana", () => {
  // Hero 32% vidljiv — jos uvek radi (iznad exit praga).
  assert.equal(
    policy.resolveCampaignVisibility({
      top: -551,
      bottom: 261,
      viewportHeight: 900,
      wasVisible: true,
    }),
    true,
  );
  // Hero 12% vidljiv — vise nije relevantno vidljiv.
  assert.equal(
    policy.resolveCampaignVisibility({
      top: -712,
      bottom: 100,
      viewportHeight: 900,
      wasVisible: true,
    }),
    false,
  );
});

test("hysteresis ne treperi na jednoj granici", () => {
  // Hero 812px, 284px vidljivo => 35% — izmedju exit (25%) i enter (45%) praga.
  const at35 = { top: -528, bottom: 284, viewportHeight: 900 };
  // Dolazeci odozdo (nije bio vidljiv) 35% nije dovoljno za ulaz.
  assert.equal(
    policy.resolveCampaignVisibility({ ...at35, wasVisible: false }),
    false,
  );
  // Ali ako je vec bio vidljiv, 35% ga zadrzava vidljivim.
  assert.equal(
    policy.resolveCampaignVisibility({ ...at35, wasVisible: true }),
    true,
  );
});

test("povratak heroja u viewport vraca autoplay", () => {
  const visible = policy.resolveCampaignVisibility({
    top: 89,
    bottom: 901,
    viewportHeight: 900,
    wasVisible: false,
  });
  assert.equal(visible, true);
  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 2,
      documentIsVisible: true,
      sectionIsVisible: visible,
      reducedMotion: false,
      pauseReasons: [],
      pendingIndex: null,
      transitionPhase: "idle",
    }),
    true,
  );
});

test("obican scroll dok hero ostaje vidljiv ne zaklucava carousel", () => {
  let wasVisible = true;
  // Simulacija sporog skrola kroz prvih 300px — hero ostaje dominantan.
  for (let scroll = 0; scroll <= 300; scroll += 25) {
    wasVisible = policy.resolveCampaignVisibility({
      top: 89 - scroll,
      bottom: 901 - scroll,
      viewportHeight: 900,
      wasVisible,
    });
    assert.equal(wasVisible, true, `zakljucano na scrollY=${scroll}`);
  }
});

test("skrivena kartica pauzira i vraca autoplay", () => {
  const base = {
    slideCount: 4,
    sectionIsVisible: true,
    reducedMotion: false,
    pendingIndex: null,
    transitionPhase: "idle",
  };
  assert.equal(
    policy.shouldCampaignAutoplay({
      ...base,
      documentIsVisible: false,
      pauseReasons: ["document-hidden"],
    }),
    false,
  );
  assert.equal(
    policy.shouldCampaignAutoplay({
      ...base,
      documentIsVisible: true,
      pauseReasons: [],
    }),
    true,
  );
});

test("hover vise nije razlog pauze", () => {
  // Korisnicki zahtev: kursor koji miruje nad herojem ne sme zaustaviti autoplay.
  assert.equal(typeof policy.isCampaignInteractiveTarget, "undefined");
  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 4,
      documentIsVisible: true,
      sectionIsVisible: true,
      reducedMotion: false,
      pauseReasons: [],
      pendingIndex: null,
      transitionPhase: "idle",
    }),
    true,
  );
});

test("aktivan drag i eksplicitna korisnicka pauza blokiraju autoplay", () => {
  const base = {
    slideCount: 4, documentIsVisible: true, sectionIsVisible: true,
    reducedMotion: false, pendingIndex: null, transitionPhase: "idle",
  };
  assert.equal(policy.shouldCampaignAutoplay({ ...base, pauseReasons: ["dragging"] }), false);
  assert.equal(policy.shouldCampaignAutoplay({ ...base, pauseReasons: ["user-paused"] }), false);
  assert.equal(policy.hasBlockingPauseReason(["dragging"]), true);
  assert.equal(policy.hasBlockingPauseReason(["user-paused"]), true);
});

test("default fokus na body nije korisnicka interakcija", () => {
  const stage = { contains: () => true };
  assert.equal(
    policy.isCampaignFocusInteraction({
      activeElement: { tagName: "BODY" },
      stage,
      matchesFocusVisible: false,
    }),
    false,
  );
  // Programatski fokus bez :focus-visible se ne racuna.
  assert.equal(
    policy.isCampaignFocusInteraction({
      activeElement: { tagName: "BUTTON" },
      stage,
      matchesFocusVisible: false,
    }),
    false,
  );
  // Stvarna tastaturna fokus interakcija se racuna.
  assert.equal(
    policy.isCampaignFocusInteraction({
      activeElement: { tagName: "BUTTON" },
      stage,
      matchesFocusVisible: true,
    }),
    true,
  );
  // Fokus izvan sekcije se ne racuna.
  assert.equal(
    policy.isCampaignFocusInteraction({
      activeElement: { tagName: "BUTTON" },
      stage: { contains: () => false },
      matchesFocusVisible: true,
    }),
    false,
  );
});

test("manual-hold nije blokada nego odlozeno pokretanje", () => {
  assert.equal(policy.hasBlockingPauseReason(["manual-hold"]), false);
  assert.equal(policy.hasBlockingPauseReason(["manual-hold", "hover"]), true);
  assert.equal(policy.hasBlockingPauseReason([]), false);
});

test("reduced motion onemogucava autoplay", () => {
  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 4,
      documentIsVisible: true,
      sectionIsVisible: true,
      reducedMotion: true,
      pauseReasons: ["reduced-motion"],
      pendingIndex: null,
      transitionPhase: "idle",
    }),
    false,
  );
});

test("jedan slajd nikada ne pokrece autoplay", () => {
  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 1,
      documentIsVisible: true,
      sectionIsVisible: true,
      reducedMotion: false,
      pauseReasons: [],
      pendingIndex: null,
      transitionPhase: "idle",
    }),
    false,
  );
});

test("tranzicija u toku ne pokrece drugi timer", () => {
  assert.equal(
    policy.shouldCampaignAutoplay({
      slideCount: 4,
      documentIsVisible: true,
      sectionIsVisible: true,
      reducedMotion: false,
      pauseReasons: ["transition"],
      pendingIndex: 1,
      transitionPhase: "covering",
    }),
    false,
  );
});

/* ==========================================================================
 * Tastatura i swipe — izvršno, ne regexom
 * ========================================================================== */

test("ArrowLeft i ArrowRight daju očekivani smer", () => {
  assert.equal(policy.resolveCampaignKeyIntent({ key: "ArrowLeft" }), "previous");
  assert.equal(policy.resolveCampaignKeyIntent({ key: "ArrowRight" }), "next");
});

test("ostali tasteri ne pomeraju carousel", () => {
  for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "Escape", "a"]) {
    assert.equal(policy.resolveCampaignKeyIntent({ key }), null, key);
  }
});

test("modifikator vraća taster pretraživaču", () => {
  // `Alt+←` je „nazad" u istoriji; carousel je ne sme preoteti.
  assert.equal(
    policy.resolveCampaignKeyIntent({ key: "ArrowLeft", altKey: true }),
    null,
  );
  assert.equal(
    policy.resolveCampaignKeyIntent({ key: "ArrowRight", ctrlKey: true }),
    null,
  );
  assert.equal(
    policy.resolveCampaignKeyIntent({ key: "ArrowRight", metaKey: true }),
    null,
  );
});

test("pragovi imaju konkretne vrednosti, ne samo relativne", () => {
  /*
   * Bez ovoga bi ostali testovi bili tautologija: svi racunaju granicu IZ
   * konstante, pa bi prosli i da prag padne na 1 px. Ovde se vrednost tvrdi,
   * a ispod se proverava konkretan pokret koji pri manjem pragu vise ne bi
   * bio odbijen.
   */
  assert.equal(policy.CAMPAIGN_SWIPE_THRESHOLD_PX, 44);
  assert.equal(policy.CAMPAIGN_SWIPE_CANCEL_PX, 12);
  assert.equal(policy.CAMPAIGN_SWIPE_AXIS_RATIO, 1.2);

  // Kratak drag od 20 px je promasen dodir, ne namera.
  assert.equal(policy.resolveCampaignSwipeIntent({ deltaX: 20, deltaY: 0 }), null);
  assert.equal(policy.resolveCampaignSwipeIntent({ deltaX: -20, deltaY: 0 }), null);
  // Vertikalni trzaj od 6 px jos nije skrol.
  assert.equal(policy.shouldCancelCampaignSwipe({ deltaX: 2, deltaY: 6 }), false);
});

test("swipe ispod praga ne menja slajd", () => {
  const prag = policy.CAMPAIGN_SWIPE_THRESHOLD_PX;
  // Tačno jedan piksel ispod praga — granica se proverava, ne pogađa.
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: prag - 1, deltaY: 0 }),
    null,
  );
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: -(prag - 1), deltaY: 0 }),
    null,
  );
  assert.equal(policy.resolveCampaignSwipeIntent({ deltaX: 0, deltaY: 0 }), null);
});

test("swipe preko praga menja slajd u odgovarajućem smeru", () => {
  const prag = policy.CAMPAIGN_SWIPE_THRESHOLD_PX;
  // Prst vuče sadržaj udesno → otkriva se ono što je bilo levo.
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: prag, deltaY: 0 }),
    "previous",
  );
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: -prag, deltaY: 0 }),
    "next",
  );
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: 200, deltaY: 30 }),
    "previous",
  );
});

test("skrol koji je skrenuo u stranu nije swipe", () => {
  const prag = policy.CAMPAIGN_SWIPE_THRESHOLD_PX;
  // Horizontala mora nadjačati vertikalu za faktor CAMPAIGN_SWIPE_AXIS_RATIO.
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: prag, deltaY: prag }),
    null,
  );
  assert.equal(
    policy.resolveCampaignSwipeIntent({
      deltaX: 100,
      deltaY: 100 / policy.CAMPAIGN_SWIPE_AXIS_RATIO,
    }),
    null,
    "tačno na granici odnosa osa se ne računa kao swipe",
  );
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: 100, deltaY: 80 }),
    "previous",
    "iznad granice odnosa jeste swipe",
  );
});

test("otkazan pokret ne menja slajd ni kada je pomeraj velik", () => {
  assert.equal(
    policy.resolveCampaignSwipeIntent({ deltaX: 400, deltaY: 0, cancelled: true }),
    null,
  );
});

test("pokret se otkazuje čim vertikala prevlada", () => {
  const otkaz = policy.CAMPAIGN_SWIPE_CANCEL_PX;
  assert.equal(
    policy.shouldCancelCampaignSwipe({ deltaX: 4, deltaY: otkaz + 1 }),
    true,
  );
  // Na samoj granici se još ne otkazuje.
  assert.equal(
    policy.shouldCancelCampaignSwipe({ deltaX: 4, deltaY: otkaz }),
    false,
  );
  // Horizontalni pokret se ne otkazuje bez obzira na dužinu.
  assert.equal(
    policy.shouldCancelCampaignSwipe({ deltaX: 300, deltaY: 20 }),
    false,
  );
});
