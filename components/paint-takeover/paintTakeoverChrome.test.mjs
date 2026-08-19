/**
 * Vlasništvo nad temom Headera dok traje takeover.
 *
 * Testira se stvarni resolver i stvarni applier — geometrija ulazi, atributi i
 * CSS varijabla izlaze. Regresije koje ovi testovi hvataju:
 *
 *   - chapter signal koji se posle izlaska ne vraća na nulu (stari
 *     `CHAPTER_FLOOR = 0.34`, zbog kojeg je Header do kraja stranice ostajao
 *     delimično taman);
 *   - zavisnost od smera skrola (stara state mašina sa histerezom je davala
 *     različit rezultat za istu poziciju, zavisno odakle se došlo);
 *   - ostatak `data-paint-takeover` atributa posle unmount-a / route promene.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_ATTRIBUTE,
  CHAPTER_RAMP_PX,
  CHAPTER_VARIABLE,
  createChromeOwnership,
  HEADER_PROBE_FALLBACK,
  probeLineFor,
  resolveTakeoverChrome,
} from "./paintTakeoverChrome.mjs";

const VIEWPORT = 900;
const HEADER_BOTTOM = 88;
/** 155svh, isto kao CSS visina sekcije. */
const SECTION_HEIGHT = Math.round(VIEWPORT * 1.55);

/** Geometrija sekcije za dati scroll offset u odnosu na njen vrh. */
function boundsAt(scrolledPastTop) {
  const top = -scrolledPastTop;
  return { sectionTop: top, sectionBottom: top + SECTION_HEIGHT };
}

function chromeAt(scrolledPastTop, probeLine = HEADER_BOTTOM) {
  return resolveTakeoverChrome({ ...boundsAt(scrolledPastTop), probeLine });
}

function createRoot() {
  const attributes = new Map();
  const properties = new Map();
  return {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    getAttribute: (name) => attributes.get(name) ?? null,
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: (name) => properties.delete(name),
      getPropertyValue: (name) => properties.get(name) ?? "",
      has: (name) => properties.has(name),
    },
  };
}

test("probe linija se izvodi iz visine Headera, ne iz njegove pozicije", () => {
  assert.equal(probeLineFor(88), 88);
  assert.equal(probeLineFor(64), 64);
  // Sakriven header (translate -101%) ima negativnu donju ivicu; visina ostaje
  // ista, pa probe linija ne sme da se pomeri sa smerom skrola.
  assert.equal(probeLineFor(-40), HEADER_PROBE_FALLBACK);
  assert.equal(probeLineFor(0), HEADER_PROBE_FALLBACK);
  assert.equal(probeLineFor(undefined), HEADER_PROBE_FALLBACK);
  assert.equal(probeLineFor(Number.NaN), HEADER_PROBE_FALLBACK);
});

test("iznad sekcije Header je normalan, bez ijednog ostatka", () => {
  const above = chromeAt(-VIEWPORT);
  assert.equal(above.chapter, 0);
  assert.equal(above.owned, false);
  assert.equal(above.phase, "before");
});

test("ulazak odozgo: tema se preuzima tek kad sekcija stigne pod Header", () => {
  // Gornja ivica sekcije je još ispod probe linije (sekcija dolazi odozdo).
  const approaching = chromeAt(-(HEADER_BOTTOM + 10));
  assert.equal(approaching.owned, false);
  assert.equal(approaching.chapter, 0);
  assert.equal(approaching.phase, "before");

  // Gornja ivica je tačno na probe liniji — vlasništvo počinje ovde.
  const atProbe = chromeAt(-HEADER_BOTTOM);
  assert.equal(atProbe.owned, true);
  assert.equal(atProbe.phase, "entering");

  // Posle rampe je signal pun.
  const inside = chromeAt(HEADER_BOTTOM + CHAPTER_RAMP_PX);
  assert.equal(inside.chapter, 1);
  assert.equal(inside.phase, "active");
});

test("izlazak nadole vraća normalan Header, bez praga koji ostaje", () => {
  const leaving = chromeAt(SECTION_HEIGHT - HEADER_BOTTOM - 40);
  assert.equal(leaving.owned, true);
  assert.equal(leaving.phase, "leaving");
  assert.ok(leaving.chapter > 0 && leaving.chapter < 1);

  // Donja ivica je prošla probe liniju.
  const passed = chromeAt(SECTION_HEIGHT - HEADER_BOTTOM);
  assert.equal(passed.owned, false);
  assert.equal(passed.chapter, 0);
  assert.equal(passed.phase, "after");

  // I daleko ispod sekcije — ovde je stari CHAPTER_FLOOR držao 0.34.
  const wellBelow = chromeAt(SECTION_HEIGHT + VIEWPORT * 3);
  assert.equal(wellBelow.chapter, 0);
  assert.equal(wellBelow.owned, false);
});

test("rezultat ne zavisi od smera: sweep nadole i nazad daje iste vrednosti", () => {
  const positions = [];
  for (let y = -VIEWPORT; y <= SECTION_HEIGHT + VIEWPORT; y += 37) {
    positions.push(y);
  }

  const down = positions.map((y) => chromeAt(y));
  const up = [...positions].reverse().map((y) => chromeAt(y));
  up.reverse();

  for (let index = 0; index < positions.length; index += 1) {
    assert.deepEqual(
      down[index],
      up[index],
      `pozicija ${positions[index]} daje različit rezultat u zavisnosti od smera`,
    );
  }
});

test("veliki scroll korak preko cele sekcije ne ostavlja tamnu temu", () => {
  // Skok sa pozicije iznad sekcije na poziciju ispod nje, bez međukoraka.
  const before = chromeAt(-VIEWPORT);
  const after = chromeAt(SECTION_HEIGHT + VIEWPORT);
  assert.equal(before.owned, false);
  assert.equal(after.owned, false);
  assert.equal(after.chapter, 0);
});

test("reload unutar sekcije odmah daje punu temu, bez zagrevanja", () => {
  const middle = chromeAt(Math.round(SECTION_HEIGHT / 2));
  assert.equal(middle.chapter, 1);
  assert.equal(middle.owned, true);
  assert.equal(middle.phase, "active");
});

test("resize menja probe liniju, ne pravilo", () => {
  const tallHeader = chromeAt(100, 140);
  assert.equal(tallHeader.owned, true);
  const shortHeader = chromeAt(100, 60);
  assert.equal(shortHeader.owned, true);

  // Sekcija koja se završava između dve probe linije: vlasništvo prati header.
  const nearBottom = SECTION_HEIGHT - 100;
  assert.equal(chromeAt(nearBottom, 60).owned, true);
  assert.equal(chromeAt(nearBottom, 140).owned, false);
});

test("applier postavlja atribut samo dok je vlasništvo aktivno", () => {
  const root = createRoot();
  const ownership = createChromeOwnership({ root });

  ownership.sync(chromeAt(-VIEWPORT));
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), null);
  assert.equal(root.style.getPropertyValue(CHAPTER_VARIABLE), "0.0000");

  ownership.sync(chromeAt(HEADER_BOTTOM + CHAPTER_RAMP_PX));
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), "active");
  assert.equal(root.style.getPropertyValue(CHAPTER_VARIABLE), "1.0000");

  ownership.sync(chromeAt(SECTION_HEIGHT + VIEWPORT));
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), null);
  assert.equal(root.style.getPropertyValue(CHAPTER_VARIABLE), "0.0000");
});

test("kroz ceo sweep atribut postoji tačno onda kad i vlasništvo", () => {
  const root = createRoot();
  const ownership = createChromeOwnership({ root });

  for (let y = -VIEWPORT; y <= SECTION_HEIGHT + VIEWPORT; y += 23) {
    const chrome = chromeAt(y);
    ownership.sync(chrome);
    const attribute = root.getAttribute(ACTIVE_ATTRIBUTE);
    assert.equal(
      attribute !== null,
      chrome.owned,
      `neusklađen atribut na poziciji ${y}`,
    );
    if (!chrome.owned) {
      assert.equal(root.style.getPropertyValue(CHAPTER_VARIABLE), "0.0000");
    }
  }
});

test("unmount / route promena briše i atribut i chapter varijablu", () => {
  const root = createRoot();
  const ownership = createChromeOwnership({ root });

  ownership.sync(chromeAt(HEADER_BOTTOM + CHAPTER_RAMP_PX));
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), "active");

  ownership.clear();
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), null);
  assert.equal(root.style.has(CHAPTER_VARIABLE), false);
  assert.equal(ownership.state(), null);

  // Posle brisanja sledeći sync mora ponovo da postavi atribut.
  ownership.sync(chromeAt(HEADER_BOTTOM + CHAPTER_RAMP_PX));
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), "active");
});

test("washDisabled režim ne preuzima chrome, ali signal i dalje postoji", () => {
  const root = createRoot();
  const ownership = createChromeOwnership({ root, enabled: false });

  ownership.sync(chromeAt(HEADER_BOTTOM + CHAPTER_RAMP_PX));
  assert.equal(root.getAttribute(ACTIVE_ATTRIBUTE), null);
  assert.equal(root.style.getPropertyValue(CHAPTER_VARIABLE), "1.0000");
});
