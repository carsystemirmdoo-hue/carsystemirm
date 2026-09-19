/**
 * Izvrsni ugovor homepage kampanjskih slajdova.
 *
 * Pokrece se kroz `tsx --test`, pa uvozi stvarne izvoze i proverava VREDNOSTI.
 * Nista se ne cita iz izvornog teksta.
 *
 * Homepage carousel preuzima deo slajdova iz Baslac i R-M podataka, pa greska u
 * tim izvorima ovde izlazi na videlo ranije nego u pretrazivacu.
 */

import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

import { homeCampaignSlides } from "./homeCampaignData.ts";

/** Slajdovi koje odobreni homepage plan mora da sadrzi. */
const OBAVEZNI = ["carsystem", "baslac-20-years", "rm-agilis", "rm-refinity"];

test("svi obavezni slajdovi postoje, tacnim redom", () => {
  const ids = homeCampaignSlides.map((slide) => slide.id);
  assert.deepEqual(
    ids,
    OBAVEZNI,
    `homepage plan trazi ${OBAVEZNI.join(", ")}, a ima ${ids.join(", ")}`,
  );
});

test("identifikatori su neprazni i jedinstveni", () => {
  const ids = homeCampaignSlides.map((slide) => slide.id);
  for (const id of ids) {
    assert.match(id, /^[a-z][a-z0-9-]*$/, `neispravan id: "${id}"`);
  }
  assert.equal(new Set(ids).size, ids.length, `dupliran id: ${ids.join(", ")}`);
});

test("nema dupliranih kampanja", () => {
  // Dva slajda iste kampanje znace da korisnik dva puta vidi istu poruku.
  const naslovi = homeCampaignSlides.map((slide) => slide.title.trim().toLowerCase());
  assert.equal(new Set(naslovi).size, naslovi.length, `dupliran naslov: ${naslovi.join(" | ")}`);

  const desktop = homeCampaignSlides.map((slide) => slide.desktopImage);
  assert.equal(
    new Set(desktop).size,
    desktop.length,
    `dva slajda dele istu desktop sliku: ${desktop.join(", ")}`,
  );
});

test("svaka slika postoji i putanja je javna", async () => {
  for (const slide of homeCampaignSlides) {
    for (const [polje, src] of [
      ["desktopImage", slide.desktopImage],
      ["mobileImage", slide.mobileImage],
    ]) {
      assert.ok(src, `${slide.id}: ${polje} nedostaje`);
      assert.match(src, /^\/images\//, `${slide.id}: ${polje} nije javna putanja`);
      await assert.doesNotReject(
        access(new URL(`../../public${src}`, import.meta.url)),
        `${slide.id}: ${polje} pokazuje na nepostojeci fajl ${src}`,
      );
    }
  }
});

test("alt tekst nije prazan i nije samo razmak", () => {
  for (const slide of homeCampaignSlides) {
    assert.ok(
      typeof slide.imageAlt === "string" && slide.imageAlt.trim().length > 8,
      `${slide.id}: prazan ili prekratak imageAlt: ${JSON.stringify(slide.imageAlt)}`,
    );
  }
});

test("naslov, eyebrow i opis su popunjeni", () => {
  for (const slide of homeCampaignSlides) {
    for (const polje of ["eyebrow", "title", "description"]) {
      assert.ok(
        slide[polje] && String(slide[polje]).trim().length > 0,
        `${slide.id}: prazno polje ${polje}`,
      );
    }
  }
});

test("CTA je interna ruta ili sidro, sa labelom", () => {
  for (const slide of homeCampaignSlides) {
    for (const [ime, cta] of [
      ["primaryCta", slide.primaryCta],
      ["secondaryCta", slide.secondaryCta],
    ]) {
      if (!cta) continue;
      assert.ok(cta.label?.trim(), `${slide.id}: ${ime} bez labele`);
      assert.match(
        cta.href,
        /^(\/[a-z0-9/?=&#_.-]*|#[a-z0-9-]+)$/i,
        `${slide.id}: ${ime} nije interna ruta ni sidro: "${cta.href}"`,
      );
      assert.doesNotMatch(cta.href, /^https?:\/\//, `${slide.id}: ${ime} je spoljna adresa`);
    }
  }
});

test("prvi slajd nosi glavni javni poziv na akciju", () => {
  // „Pronadji najblizu prodavnicu" je primarni javni CTA celog sajta; ne sme
  // nestati iz prvog slajda, koji je jedini serverski renderovan kao h1.
  const prvi = homeCampaignSlides[0];
  assert.equal(prvi.id, "carsystem");
  assert.equal(prvi.primaryCta.href, "/prodavnice");
  assert.match(prvi.primaryCta.label, /prodavnic/i);
});

/* ==========================================================================
 * Semantika naslova
 *
 * Prva tvrdnja je izvrsna (nad podacima). Ostale su SOURCE-CONTRACT: citaju
 * izvor komponente, jer se JSX ne moze renderovati u `tsx --test` bez React
 * test renderera. U izvestaju se ne smeju predstavljati kao browser dokaz.
 * ========================================================================== */

test("nijedan slajd ne duplira stabilni naslov strane", () => {
  const STABILNI = "Profesionalni refinish program za siguran rezultat.";
  for (const slide of homeCampaignSlides) {
    assert.notEqual(
      slide.title.trim(),
      STABILNI,
      `${slide.id}: naslov kampanje je isti kao stabilni naslov strane`,
    );
  }
});

test("[source-contract] carousel ne renderuje nijedan h1 u slajdu", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("./HomeCampaignCarousel.tsx", import.meta.url),
    "utf8",
  );
  const slideBlock = source.slice(source.indexOf("function HomeCampaignSlide"));

  assert.doesNotMatch(slideBlock, /<h1/, "slajd renderuje h1");
  assert.match(slideBlock, /<h2 className=\{styles\.campaignTitle\}>/);
  // Nivo naslova ne sme zavisiti od aktivnog slajda.
  assert.doesNotMatch(
    slideBlock,
    /\{active \?[\s\S]{0,120}<h1/,
    "nivo naslova zavisi od aktivnog slajda",
  );
});

test("[source-contract] stabilni h1 stoji izvan viewporta i sekcija ga imenuje", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("./HomeCampaignCarousel.tsx", import.meta.url),
    "utf8",
  );

  // Tacno jedan h1 i tacno jedan `id="homepage-title"` u celom fajlu.
  assert.equal((source.match(/<h1/g) ?? []).length, 1, "nije tacno jedan h1");
  assert.equal(
    (source.match(/id="homepage-title"/g) ?? []).length,
    1,
    "dupliran id=\"homepage-title\"",
  );

  // h1 je PRE viewporta, dakle nikad unutar slajda sa aria-hidden.
  const h1At = source.indexOf("<h1");
  const viewportAt = source.indexOf("styles.campaignViewport");
  assert.ok(h1At > 0 && h1At < viewportAt, "h1 nije iznad campaignViewport");

  // Sekcija se imenuje stabilnim naslovom.
  assert.match(source, /aria-labelledby="homepage-title"/);
  assert.doesNotMatch(
    source.slice(0, viewportAt),
    /aria-label="Carsystem i R-M kampanjski baneri"/,
    "sekcija i dalje koristi staticki aria-label umesto naslova",
  );

  // Naslov ostaje dostupan citacima: prezentaciju (vidljiv omotac ili
  // `sr-only`) bira potrosac kroz `headingPresentation`, ali h1 nikad ne sme
  // da nosi `aria-hidden` ni `hidden`.
  const h1Tag = source.slice(h1At, source.indexOf(">", h1At));
  assert.doesNotMatch(h1Tag, /aria-hidden|\bhidden\b/, "h1 je sakriven za citace");
});

test("[source-contract] homepage ne renderuje sopstveni drugi h1", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile(
    new URL("./CarsystemHomePage.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(page, /<h1/, "CarsystemHomePage ima sopstveni h1");
  assert.doesNotMatch(page, /id="homepage-title"/, "dupliran homepage-title");
  // Carousel prima karticu lokatora kao `aside` prop, pa tag nosi atribute.
  assert.match(page, /<HomeCampaignCarousel(\s[^>]*)?\/>/);
});
