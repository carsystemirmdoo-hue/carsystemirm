/**
 * Zaklju5ava mehanizam optičke kalibracije Cosmos kompozicije.
 *
 * Merenje je uradjeno u browseru (`scripts/verify-cosmos-optical.mjs`); ovi
 * testovi cuvaju nacin na koji je rezultat merenja upisan u CSS, da se ne bi
 * vratio ni viewport-vezan offset ni per-SKU rucne korekcije.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decodePng, redColumn, redVerticals } from "../../lib/qa/png-pixels.mjs";

const stageCss = readFileSync(
  new URL("./ProductDetailExperience.module.css", import.meta.url),
  "utf8",
);
const backdropCss = readFileSync(
  new URL("./ProductHeroSprayBackdrop.module.css", import.meta.url),
  "utf8",
);

const OFFSET = "--product-stage-spray-offset-x";

/** Pravila se citaju bez komentara; objasnjenje merenja nije pravilo. */
const stageRules = stageCss.replace(/\/\*[\s\S]*?\*\//g, "");

test("optička osa je jedan podatak na nivou porodice, ne per-SKU pravila", () => {
  const declarations = stageCss.match(new RegExp(`^\\s*${OFFSET}\\s*:`, "gm")) ?? [];
  assert.equal(
    declarations.length,
    1,
    `${OFFSET} se deklarise ${declarations.length} puta; kalibracija mora ostati jedna`,
  );
  assert.equal(
    /CL-8\d\d/i.test(stageRules),
    false,
    "stage CSS ne sme sadrzati rucna pravila po SKU oznaci",
  );
});

test("offset je relativan prema stage-u, ne fiksni desktop piksel", () => {
  const value = stageCss.match(new RegExp(`${OFFSET}\\s*:\\s*([^;]+);`))?.[1].trim();
  assert.ok(value, `${OFFSET} nije pronadjen`);
  assert.match(value, /^-?[\d.]+%$/, `offset mora biti procenat stage-a, a dobijeno je "${value}"`);
  assert.equal(/vw|vh|px/.test(value), false, "viewport i piksel jedinice se raspadaju na 390px");
});

test("backdrop ne senči kalibraciju mrtvim fallbackom", () => {
  const fallback = backdropCss.match(new RegExp(`var\\(${OFFSET},\\s*([^)]*)\\)`))?.[1].trim();
  assert.ok(fallback !== undefined, "backdrop mora citati kalibraciju iz stage-a");
  assert.equal(
    /%/.test(fallback),
    false,
    `fallback "${fallback}" izgleda kao druga kalibracija; upstream vrednost je uvek definisana`,
  );
});

test("boja grafita se mesa u oklab, da žuta ne bi otišla u tirkiznu", () => {
  /*
   * Provera je namerno uska. Ostala `color-mix(in oklch)` pravila mesaju dve
   * fiksne boje za UI hromiranje, gde rotacija nijanse nije rizik. Opasan je
   * samo lanac koji uzima promenljivu boju proizvoda.
   */
  const declarations = stageCss.match(/--product-art-color:[\s\S]*?;/g) ?? [];
  assert.ok(declarations.length > 0, "--product-art-color nije pronadjen");
  for (const declaration of declarations) {
    if (!declaration.includes("color-mix")) continue;
    assert.match(
      declaration,
      /in\s+oklab/,
      `boja grafita se mesa u nedozvoljenom prostoru: ${declaration.replace(/\s+/g, " ")}`,
    );
  }
});

test("snimak 1968x1296 nema crvenu vertikalu ni na jednoj koloni", () => {
  const path = new URL("../../artifacts/optical/red-line-check-1968.png", import.meta.url);
  let shot;
  try {
    shot = decodePng(readFileSync(path));
  } catch (error) {
    if (error.code === "ENOENT") {
      /* Artefakt pravi verifikator; bez njega se ova provera preskace. */
      return;
    }
    throw error;
  }

  const scale = shot.width / 1968;
  for (const x of [170, 171, 1797, 1798]) {
    const column = redColumn(shot, x * scale);
    assert.equal(column.longest, 0, `x=${x} ima crveni niz od ${column.longest}px`);
  }
  const verticals = redVerticals(shot);
  assert.deepEqual(
    verticals.map((v) => v.x),
    [],
    "postoji kolona sa crvenim pikselima kroz vecinu viewporta",
  );
});
