import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Autoplay/tranzicija state machine zivi u deljenom hook-u i pokriven je
// testovima u `components/motion/brandCampaignCarousel.test.mjs`. Ovde se
// proverava samo da R-M kampanjski hero i dalje koristi taj hook i da mu
// prosledjuje ispravan ugovor.
const campaignStageUrl = new URL("./RmCampaignStage.tsx", import.meta.url);

test("R-M kampanjski hero koristi deljeni carousel hook", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(
    source,
    /import \{ useBrandCampaignCarousel \} from "@\/components\/motion\/useBrandCampaignCarousel";/,
  );
  assert.match(source, /slideCount: rmCampaignSlides\.length/);
  assert.match(source, /stageRef,/);
});

test("R-M ne drzi sopstveni autoplay timer ni scroll/visibility slusace", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.doesNotMatch(source, /setInterval|setTimeout\(/);
  assert.doesNotMatch(source, /autoplayTimerRef|progressFrameRef/);
  assert.doesNotMatch(source, /visibilitychange/);
  assert.doesNotMatch(source, /addEventListener\("scroll"/);
  assert.doesNotMatch(source, /IntersectionObserver|intersectionRatio/);
});

test("preload bira asset prema mobilnom breakpoint-u", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(source, /const resolveSlideAssets = useCallback/);
  assert.match(
    source,
    /window\.matchMedia\("\(max-width: 50rem\)"\)\.matches\s*\?\s*slide\.mobileImage\s*:\s*slide\.desktopImage/,
  );
});

test("kontrole ostaju pristupacne i onemogucene tokom tranzicije", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(source, /aria-roledescription="carousel"/);
  assert.match(source, /aria-label="Prethodni R-M banner"/);
  assert.match(source, /aria-label="Sledeći R-M banner"/);
  assert.match(source, /disabled=\{controlsBusy\}/);
  assert.match(source, /ref=\{registerProgressFill\(index\)\}/);
  assert.match(source, /onAnimationEnd=\{handleWipeAnimationEnd\}/);
});

test("prvi R-M slajd ostaje jedini LCP kandidat", async () => {
  const source = await readFile(campaignStageUrl, "utf8");

  assert.match(
    source,
    /fetchPriority=\{\s*slide\.id === "agilis-performance" \? "high" : "auto"\s*\}/,
  );
  assert.match(
    source,
    /loading=\{slide\.id === "agilis-performance" \? "eager" : "lazy"\}/,
  );
});

/* ==========================================================================
 * Podaci slajdova — izvrsno, nad stvarnim vrednostima
 *
 * Ostatak fajla cita izvorni tekst komponente. Ovi testovi ne: uvoze
 * `rmCampaignSlides` i proveravaju same vrednosti. Bez njih su nepostojeca
 * slika i dupliran identifikator prolazili kroz sve provere, ukljucujuci build
 * — Next ne otkriva `<img src>` koji ne postoji.
 * ========================================================================== */

test("svaki slajd ima neprazan i jedinstven identifikator", async () => {
  const { rmCampaignSlides } = await import("./rmBrandData");
  const ids = rmCampaignSlides.map((slide) => slide.id);

  assert.ok(ids.length >= 3, `ocekivano bar 3 slajda, ima ${ids.length}`);
  for (const id of ids) {
    assert.match(id, /^[a-z][a-z0-9-]*$/, `neispravan id slajda: "${id}"`);
  }
  // Identitet ide u `data-active-slide` i temu prelaza; duplikat cini oba
  // dvosmislenim.
  assert.equal(
    new Set(ids).size,
    ids.length,
    `dupliran identifikator slajda: ${ids.join(", ")}`,
  );
});

test("svaka slide slika postoji u public folderu", async () => {
  const { rmCampaignSlides } = await import("./rmBrandData");
  const { access } = await import("node:fs/promises");

  for (const slide of rmCampaignSlides) {
    for (const [polje, src] of [
      ["desktopImage", slide.desktopImage],
      ["mobileImage", slide.mobileImage],
    ]) {
      assert.ok(src, `${slide.id}: ${polje} nedostaje`);
      assert.match(src, /^\/images\//, `${slide.id}: ${polje} nije javna putanja`);
      const url = new URL(`../../public${src}`, import.meta.url);
      await assert.doesNotReject(
        access(url),
        `${slide.id}: ${polje} pokazuje na nepostojeci fajl ${src}`,
      );
    }
    assert.ok(
      slide.imageAlt && slide.imageAlt.trim().length > 0,
      `${slide.id}: prazan imageAlt`,
    );
  }
});

test("CTA rute su interne i vode na postojecu rutu ili sidro", async () => {
  const { rmCampaignSlides } = await import("./rmBrandData");

  for (const slide of rmCampaignSlides) {
    for (const [ime, cta] of [
      ["primaryCta", slide.primaryCta],
      ["secondaryCta", slide.secondaryCta],
    ]) {
      if (!cta) continue;
      assert.ok(cta.label?.trim(), `${slide.id}: ${ime} bez labele`);
      assert.match(
        cta.href,
        /^(\/[a-z0-9/?=&_.-]*|#[a-z0-9-]+)$/i,
        `${slide.id}: ${ime} nije interna ruta ni sidro: "${cta.href}"`,
      );
      // Spoljna adresa bi izvela korisnika sa sajta bez najave.
      assert.doesNotMatch(cta.href, /^https?:\/\//, `${slide.id}: ${ime} je spoljna`);
    }
  }
});
