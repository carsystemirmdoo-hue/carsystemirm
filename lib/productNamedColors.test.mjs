import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BASLAC_SWATCH_VERIFICATION,
  NAMED_COLOR_TOKENS,
  PRODUCT_NAMED_COLORS,
  PRODUCT_SHADE_BLOCKLIST,
  getProductNamedColor,
  getProductShadeBlockReason,
} from "./productNamedColors.mjs";

test("svaki unos ima token ili uzorak boje i izvor", () => {
  for (const [slug, entry] of Object.entries(PRODUCT_NAMED_COLORS)) {
    assert.ok(entry.token || entry.color, `${slug}: nema ni token ni boju`);
    if (entry.token) assert.ok(NAMED_COLOR_TOKENS[entry.token], `${slug}: nepoznat token ${entry.token}`);
    assert.ok(entry.source.length > 10, `${slug}: nema izvor`);
    assert.match(getProductNamedColor({ slug }).color, /^#[0-9A-F]{6}$/i);
  }
  assert.equal(getProductNamedColor({ slug: "nepoznat" }), null);
});

test("token odgovara boji iz naziva (naziv je signal, ne dokaz — ali ne sme da protivreči)", () => {
  for (const [slug, entry] of Object.entries(PRODUCT_NAMED_COLORS)) {
    if (!entry.token) continue;
    const last = entry.token.split("-").pop();
    assert.ok(
      slug.includes(entry.token) || slug.includes(last) || /^rm-pasta-190/.test(slug),
      `${slug} ↔ ${entry.token}`,
    );
  }
});

test("Carsystem abrazivi imaju boju serije, ne boju brenda — a P.23 bez izvora ostaje na brendu", () => {
  for (const slug of ["carsystem-p19-brusni-diskovi", "carsystem-f19-brusni-diskovi", "carsystem-f23-brusni-diskovi", "carsystem-finish-serija"]) {
    const entry = PRODUCT_NAMED_COLORS[slug];
    assert.ok(entry?.series, `${slug}: nema seriju`);
    assert.notEqual(entry.color?.toUpperCase(), "#E30613", `${slug}: boja brenda umesto boje serije`);
  }
  assert.ok(getProductShadeBlockReason({ slug: "carsystem-p23-brusni-diskovi" }));
});

test("blokada nijanse nosi razlog, a R-M DIAMONT slučajevi su razrešeni po šifri", () => {
  for (const [slug, reason] of Object.entries(PRODUCT_SHADE_BLOCKLIST)) assert.ok(reason.length > 20, slug);
  assert.equal(getProductNamedColor({ slug: "rm-pasta-190-1l" }).token, "white");
  assert.ok(getProductShadeBlockReason({ slug: "rm-pasta-190-5l" }));
  assert.ok(getProductShadeBlockReason({ slug: "rm-diamont-bazna-boja" }));
});

test("Baslac swatch-evi su provereni prema zvaničnim tinting chart-ovima (45/35/30)", () => {
  const entries = Object.entries(BASLAC_SWATCH_VERIFICATION);
  const statuses = entries.map(([, s]) => s);
  // svaki ton ima ishod provere; konverteri/aditivi/tehnički deo nisu tonovi i nisu u mapi
  assert.ok(entries.length >= 140);
  assert.ok(statuses.filter((s) => s === "chart-2026-09-15-verified").length >= 120);
  assert.ok(statuses.filter((s) => s === "chart-2026-09-15-replaced").length >= 8);
  assert.ok(statuses.filter((s) => s === "not-in-chart").length <= 8);
  for (const [code, s] of entries) {
    assert.match(code, /^(30|35|45|49)-[A-Z]\d{2,4}$/, code);
    assert.match(s, /^(chart-2026-09-15-(verified|replaced)|chart-sample-unclear-kept-swatch|not-in-chart|no-chart)$/, `${code}: ${s}`);
  }
  // biserni tonovi više nisu „bela" zamena: chart daje njihovu boju
  for (const code of ["35-M332", "35-M341", "35-M352", "35-M312"]) assert.equal(BASLAC_SWATCH_VERIFICATION[code], "chart-2026-09-15-replaced");
});

test("orijentacione boje idu u karticu kroz getProductShadeSource, ne u PDP grafit", () => {
  const motion = readFileSync(new URL("../components/product/productMotion.ts", import.meta.url), "utf8");
  assert.match(motion, /getProductNamedColor\(product\)/);
  assert.match(motion, /precision: "orientation", source: named\.source/);
  // grafit i dalje čita samo pravilo „proizvod je boja"
  assert.match(motion, /export function shouldRenderProductHeroSpray\(product: CarsystemProduct\) \{\s*return isPaintProduct\(product\);/);
});
