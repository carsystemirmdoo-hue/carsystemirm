import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configUrl = new URL("./paintTakeoverMotionConfig.ts", import.meta.url);
const hookUrl = new URL("./usePaintTakeoverMotion.ts", import.meta.url);
const sectionCssUrl = new URL(
  "../home/PaintTakeoverHomeSection.module.css",
  import.meta.url,
);

const readConfig = () => readFile(configUrl, "utf8");

function numericConst(source, name) {
  const match = source.match(
    new RegExp(`export const ${name} =\\s*([0-9.]+)`),
  );
  assert.ok(match, `${name} nije pronađen u konfiguraciji`);
  return Number(match[1]);
}

function windowFor(source, name) {
  const match = source.match(
    new RegExp(`${name}: \\[\\s*([0-9.]+),\\s*([0-9.]+)\\s*\\]`),
  );
  assert.ok(match, `prozor ${name} nije pronađen`);
  return [Number(match[1]), Number(match[2])];
}

/**
 * Ovo je invarijanta koja je i bila slomljena: approach faza je merena preko
 * cele viewport visine (100svh), a sticky kadar je imao samo 58svh za 82%
 * timeline-a. Brzina timeline-a je na pinu skakala ~7.9× i sve što je tada bilo
 * u toku — white→dark wipe, chapter signal — završavalo se u ~60px skrola.
 *
 * Visina sekcije u CSS-u i ENTRY_LEAD_VH moraju da dele isti budžet piksela.
 */
test("CSS visina sekcije prati STICKY_TRAVEL_VH iz konfiguracije", async () => {
  const config = await readConfig();
  const css = await readFile(sectionCssUrl, "utf8");

  const stickyTravel = numericConst(config, "STICKY_TRAVEL_VH");
  const expectedHeight = (1 + stickyTravel) * 100;

  const heights = [...css.matchAll(/height:\s*([0-9.]+)svh/g)].map((m) =>
    Number(m[1]),
  );
  const sectionHeights = heights.filter((value) => value > 100);

  assert.ok(
    sectionHeights.length > 0,
    "visina sekcije u svh jedinicama nije pronađena",
  );
  for (const height of sectionHeights) {
    assert.ok(
      Math.abs(height - expectedHeight) < 1e-6,
      `visina ${height}svh ne odgovara (1 + STICKY_TRAVEL_VH) * 100 = ${expectedHeight}svh`,
    );
  }
});

test("approach se meri preko ENTRY_LEAD_VH, a udeo se izvodi iz izmerenih piksela", async () => {
  const hook = await readFile(hookUrl, "utf8");

  assert.match(hook, /viewportHeight \* ENTRY_LEAD_VH/);
  assert.match(hook, /\(entryLead - bounds\.top\) \/ entryLead/);
  // Udeo mora biti izveden, ne konstanta: time je brzina kontinualna i kada se
  // stvarna visina sekcije razlikuje od nominalne (svh, zaokruživanje).
  assert.match(hook, /entryShareFor\(entryLead, scrollRange\)/);
  assert.doesNotMatch(hook, /viewportHeight - bounds\.top\) \/ viewportHeight/);
});

test("ENTRY_SHARE je izveden iz geometrije, ne zakucan", async () => {
  const config = await readConfig();
  const lead = numericConst(config, "ENTRY_LEAD_VH");
  const sticky = numericConst(config, "STICKY_TRAVEL_VH");

  assert.match(
    config,
    /export const ENTRY_SHARE =\s*\n?\s*ENTRY_LEAD_VH \/ \(ENTRY_LEAD_VH \+ STICKY_TRAVEL_VH\)/,
  );
  assert.ok(lead > 0 && sticky > 0);
  /*
   * Lead mora da pokrije bar jednu viewport visinu. Gornja ivica sekcije ulazi
   * u kadar tačno jedan viewport pre pinovanja; ako je lead kraći, postoji
   * pojas u kome je svetla ploča takeovera na ekranu a timeline je još 0 — to
   * je bio "veliki prazan beli prostor" između blokova.
   */
  assert.ok(
    lead >= 1,
    `ENTRY_LEAD_VH (${lead}) mora biti >= 1 da nema praznog kadra pre ulaska`,
  );
});

/**
 * White→dark wipe mora da preseca pin. Ako bi ceo prozor bio posle pina,
 * prelaz bi opet počeo naglo u pinovanom kadru umesto da se ista svetla
 * površina "pretvara" još u bloku partnerske mreže.
 */
test("surface i chapter prozori presecaju pin", async () => {
  const config = await readConfig();
  const lead = numericConst(config, "ENTRY_LEAD_VH");
  const sticky = numericConst(config, "STICKY_TRAVEL_VH");
  const pin = lead / (lead + sticky);

  for (const name of ["surface", "chapter"]) {
    const [start, end] = windowFor(config, name);
    assert.ok(start < pin, `${name} mora da počne pre pina (${pin})`);
    assert.ok(end > pin, `${name} mora da se završi posle pina (${pin})`);
  }
});

test("potezi se povlače kao kratki gestovi, ne preko celog prozora", async () => {
  const config = await readConfig();
  const block = config.match(
    /export const LINE_WINDOWS = \[([\s\S]*?)\] as const;/,
  );
  assert.ok(block, "LINE_WINDOWS nije pronađen");

  const windows = [...block[1].matchAll(/\[\s*([0-9.]+),\s*([0-9.]+)\s*\]/g)].map(
    (m) => [Number(m[1]), Number(m[2])],
  );
  assert.equal(windows.length, 6);

  for (const [start, end] of windows) {
    const span = end - start;
    // Ranije je svaki potez zauzimao ~0.62 prozora pa se čitao kao sporo
    // izvlačenje linije umesto kao zamah četke.
    assert.ok(
      span > 0.2 && span <= 0.36,
      `raspon poteza ${span.toFixed(2)} nije u opsegu kratkog gesta`,
    );
  }
  // Stagger mora da raste monotono da se potezi ne bi palili u grupi.
  for (let i = 1; i < windows.length; i += 1) {
    assert.ok(windows[i][0] > windows[i - 1][0]);
  }
  assert.ok(windows.at(-1)[1] <= 1);
});

test("potezi koriste ease-out, ne smoothstep", async () => {
  const config = await readConfig();
  const hook = await readFile(hookUrl, "utf8");

  assert.match(config, /export function easeBrushStroke/);
  assert.match(hook, /easeBrushStroke\(\s*normalize\(lineworkProgress/);
});
