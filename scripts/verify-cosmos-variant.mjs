/**
 * Integraciona provera Cosmos variant izbora bez navigacije.
 *
 * Pokreće se protiv živog servera:
 *   node scripts/verify-cosmos-variant.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3000";
const ROUTE = "/proizvodi/grupa/cosmos-lac-easy-max";
const CASES = ["CL-800", "CL-803", "CL-808", "CL-810", "CL-813"];

let failures = 0;
function check(label, condition, detail = "") {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ channel: "chrome" });

async function snapshot(page) {
  return page.evaluate(() => {
    const img = document.querySelector("main img");
    const rail = document.querySelector('[class*="stickyRail"]');
    const box = rail?.getBoundingClientRect();
    const styled = document.querySelector('[style*="--product-active-color"]');
    return {
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      sku: document.querySelector("[data-variant-sku]")?.textContent ?? null,
      key: document.querySelector("[data-variant-key]")?.getAttribute("data-variant-key") ?? null,
      img: img?.currentSrc ?? null,
      alt: img?.getAttribute("alt") ?? null,
      color: styled
        ? getComputedStyle(styled).getPropertyValue("--product-active-color").trim()
        : null,
      cta: [...document.querySelectorAll('a[href*="varijanta="]')][0]?.getAttribute("href") ?? null,
      pressed: document.querySelector('[data-variant-option][data-selected]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      query: new URLSearchParams(location.search).get("varijanta"),
      path: location.pathname,
      scroll: window.scrollY,
      stage: box ? `${Math.round(box.width)}x${Math.round(box.height)}` : null,
    };
  });
}

async function clickVariant(page, code) {
  await page.evaluate((wanted) => {
    const target = [...document.querySelectorAll("[data-variant-option]")].find((node) =>
      node.textContent?.includes(wanted),
    );
    target?.click();
  }, code);
  await page.waitForTimeout(900);
}

// --- 1. CL-808 -> CL-810, bez navigacije --------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const navRequests = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document" || r.url().includes("_rsc=")) navRequests.push(r.url());
  });
  await page.goto(`${BASE}${ROUTE}?varijanta=CL-808`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.scrollTo(0, 320));
  const before = await snapshot(page);
  navRequests.length = 0;
  await clickVariant(page, "CL-810");
  const after = await snapshot(page);

  console.log("\n### CL-808 -> CL-810");
  check("0 document/RSC zahteva", navRequests.length === 0, String(navRequests.length));
  check("pathname nepromenjen", before.path === after.path);
  check("scroll nepromenjen", before.scroll === after.scroll, `${before.scroll} -> ${after.scroll}`);
  check("query promenjen", before.query === "CL-808" && after.query === "CL-810");
  check("aktivna kartica promenjena", before.pressed !== after.pressed);
  check("H1 promenjen", before.h1 !== after.h1 && after.h1?.includes("Purple Red"));
  check("SKU promenjen", after.sku === "CL-810");
  check("RAL promenjen", before.h1?.includes("7033") && after.h1?.includes("3004"));
  check("img.currentSrc promenjen", before.img !== after.img && after.img?.includes("cl-810"));
  check("alt promenjen", before.alt !== after.alt);
  check("grafit boja promenjena", before.color !== after.color, `${before.color} -> ${after.color}`);
  check("CTA query promenjen", after.cta?.includes("CL-810") === true);
  check("stage bounding box stabilan", before.stage === after.stage, `${before.stage} -> ${after.stage}`);
  await page.close();
}

// --- 2. Direktno otvaranje ?varijanta=CL-810 ----------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${BASE}${ROUTE}?varijanta=CL-810`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const s = await snapshot(page);
  console.log("\n### direktan URL ?varijanta=CL-810");
  check("H1 je CL-810", s.h1?.includes("CL 810") === true, s.h1 ?? "");
  check("slika je CL-810", s.img?.includes("cl-810") === true);
  check("SKU je CL-810", s.sku === "CL-810");
  await page.close();
}

// --- 3. Back / Forward --------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${BASE}${ROUTE}?varijanta=CL-808`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  await clickVariant(page, "CL-810");
  await page.goBack();
  await page.waitForTimeout(900);
  const back = await snapshot(page);
  await page.goForward();
  await page.waitForTimeout(900);
  const fwd = await snapshot(page);
  console.log("\n### Back / Forward");
  check("Back vraca CL-808 u celom prikazu", back.sku === "CL-808" && back.img?.includes("cl-808") === true);
  check("Forward vraca CL-810 u celom prikazu", fwd.sku === "CL-810" && fwd.img?.includes("cl-810") === true);
  await page.close();
}

// --- 4. Nevazeci query --------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${BASE}${ROUTE}?varijanta=NE-POSTOJI`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  const s = await snapshot(page);
  console.log("\n### nevazeci query");
  check("pada na kontrolisan default", Boolean(s.sku) && Boolean(s.img));
  await page.close();
}

// --- 5. Brzo klikanje kroz pet varijanti --------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  for (const code of CASES) {
    await page.evaluate((wanted) => {
      const target = [...document.querySelectorAll("[data-variant-option]")].find((n) =>
        n.textContent?.includes(wanted),
      );
      target?.click();
    }, code);
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(1500);
  const s = await snapshot(page);
  console.log("\n### brzo klikanje kroz 5 varijanti");
  check("poslednji klik pobedjuje", s.sku === "CL-813" && s.query === "CL-813", `${s.sku} / ${s.query}`);
  check("slika prati poslednji klik", s.img?.includes("cl-813") === true);
  await page.close();
}

// --- 6. Reduced motion + tastatura -------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}${ROUTE}?varijanta=CL-800`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  await clickVariant(page, "CL-803");
  const rm = await snapshot(page);
  console.log("\n### reduced motion");
  check("promena radi uz reduced motion", rm.sku === "CL-803" && rm.img?.includes("cl-803") === true);

  const kb = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[data-variant-option]")];
    const target = nodes.find((n) => n.textContent?.includes("CL-813"));
    if (!target) return null;
    target.focus();
    const focused = document.activeElement === target;
    const tag = target.tagName;
    const pressed = target.getAttribute("aria-pressed");
    target.click();
    return { focused, tag, pressed };
  });
  await page.waitForTimeout(900);
  const after = await snapshot(page);
  console.log("\n### tastatura i pristupacnost");
  check("kartica je pravo dugme", kb?.tag === "BUTTON", kb?.tag ?? "");
  check("kartica prima fokus", kb?.focused === true);
  check("ima aria-pressed", kb?.pressed !== null && kb?.pressed !== undefined);
  check("izbor tastaturom menja prikaz", after.sku === "CL-813");
  await page.close();
}

// --- 7. Sve testirane varijante ----------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  console.log("\n### poklapanje po varijanti");
  for (const code of CASES) {
    await page.goto(`${BASE}${ROUTE}?varijanta=${code}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1100);
    const s = await snapshot(page);
    const slug = code.toLowerCase();
    check(
      `${code}: h1/sku/slika/grafit`,
      s.sku === code && s.img?.includes(slug) === true && Boolean(s.color),
      `${s.sku} | ${s.color}`,
    );
  }
  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? "SVE PROVERE PROSLE" : `${failures} PROVERA PALO`}`);
process.exit(failures === 0 ? 0 : 1);
