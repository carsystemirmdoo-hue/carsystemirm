/**
 * Provera optičkog centriranja Cosmos kompozicije.
 *
 * Meri renderovanu geometriju, ne CSS izvor: alpha centroid packshota, poziciju
 * grafita kroz screenshot diff, stabilnost stage boxa kroz varijante i pixel
 * probe na koordinatama gde su prijavljene crvene vertikalne linije.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodePng, redColumn, redVerticals } from "../lib/qa/png-pixels.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const GROUP = "/proizvodi/grupa/cosmos-lac-easy-max";
const LONG_ROUTE =
  "/proizvodi/cosmos-lac-easy-max-cl-808-ral-7033-400-ml-easy-max-ral-7033-808-cement-grey";
const OUT = "artifacts/optical";
const CODES = ["CL-800", "CL-803", "CL-808", "CL-810", "CL-813"];
const VIEWPORTS = [390, 768, 1024, 1440, 1968];
const STAGE = '[class*="ProductDetailExperience_stage__"]';
const PRODUCT = '[class*="heroProductObject"]';

mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "  OK  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ channel: "chrome" });

/* ---- 1. Stabilnost kroz varijante na 1440 ---------------------------- */
console.log("\n1) Stabilnost kompozicije kroz varijante (1440)");
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(`${BASE}${GROUP}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const perVariant = [];
for (const code of CODES) {
  await page.click(`[aria-pressed][data-variant-code="${code}"], button:has-text("${code}")`).catch(() => {});
  await page.waitForTimeout(600);
  const m = await page.evaluate((sel) => {
    const stage = document.querySelector(sel[0]);
    const img = stage.querySelector(`${sel[1]} img`) ?? stage.querySelector("img");
    const sb = stage.getBoundingClientRect();
    const ib = img.getBoundingClientRect();
    /*
     * `--product-art-color` je custom property; njegova computed vrednost je
     * neizracunat token stream (`color-mix(...)`), ne boja. Prava upotrebljena
     * boja se cita sa elementa koji je koristi.
     */
    const svg = stage.querySelector('[class*="spraySvg"]');
    const art = svg ? getComputedStyle(svg).color : "(spraySvg nije nadjen)";
    const frame = stage.querySelector('[class*="patternFrame"]');
    return {
      stage: { w: +sb.width.toFixed(1), h: +sb.height.toFixed(1) },
      axis: +(ib.left - sb.left + ib.width * (398.1 / 800)).toFixed(1),
      src: img.currentSrc.split("/").pop(),
      art,
      transform: frame ? getComputedStyle(frame).transform : null,
    };
  }, [STAGE, PRODUCT]);
  perVariant.push({ code, ...m });
  writeFileSync(`${OUT}/final-${code.toLowerCase()}-1440.png`, await (await page.$(STAGE)).screenshot());
  console.log(`   ${code}  stage ${m.stage.w}x${m.stage.h}  osa ${m.axis}  art ${m.art}  ${m.src}`);
}

const boxes = new Set(perVariant.map((v) => `${v.stage.w}x${v.stage.h}`));
check(boxes.size === 1, "stage box identičan kroz varijante", [...boxes].join(" | "));
const axes = perVariant.map((v) => v.axis);
const spread = Math.max(...axes) - Math.min(...axes);
check(spread <= 1.5, "osa proizvoda stabilna kroz varijante", `raspon ${spread.toFixed(1)}px`);
check(new Set(perVariant.map((v) => v.src)).size === CODES.length, "svaka varijanta ima svoj packshot");
check(new Set(perVariant.map((v) => v.art)).size === CODES.length, "grafit boja vezana za aktivnu varijantu");
const transforms = new Set(perVariant.map((v) => v.transform));
check(transforms.size === 1, "grafit ne menja geometrijsku osu", [...transforms].join(" | "));

/* ---- 2. Boja grafita ostaje u familiji ------------------------------- */
console.log("\n2) Familija boje grafita (oklab, bez hue rotacije)");
for (const code of ["CL-813", "CL-810"]) {
  const v = perVariant.find((x) => x.code === code);
  const m = v.art.match(/oklab\(([-\d.]+)[, ]+([-\d.]+)[, ]+([-\d.]+)/);
  const rgb = v.art.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  let hue;
  if (m) {
    hue = ((Math.atan2(Number(m[3]), Number(m[2])) * 180) / Math.PI + 360) % 360;
  } else if (rgb) {
    const [r, g, bl] = [+rgb[1] / 255, +rgb[2] / 255, +rgb[3] / 255];
    /* oklab a/b iz sRGB, dovoljno za proveru familije nijanse */
    const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [R, G, B2] = [f(r), f(g), f(bl)];
    const l = Math.cbrt(0.4122 * R + 0.5363 * G + 0.0514 * B2);
    const mm = Math.cbrt(0.2119 * R + 0.6807 * G + 0.1074 * B2);
    const s = Math.cbrt(0.0883 * R + 0.2817 * G + 0.6300 * B2);
    const A = 1.9779 * l - 2.4285 * mm + 0.4506 * s;
    const B3 = 0.0259 * l + 0.7827 * mm - 0.8087 * s;
    hue = ((Math.atan2(B3, A) * 180) / Math.PI + 360) % 360;
  } else {
    check(false, `${code} boja grafita procitana`, v.art || "(prazno)");
    continue;
  }
  const ok = code === "CL-813" ? hue > 45 && hue < 130 : hue > 300 || hue < 45;
  check(ok, `${code} zadržava nijansu`, `hue ${hue.toFixed(0)}° iz ${v.art}`);
}
await page.close();

/* ---- 3. Responsive sweep -------------------------------------------- */
console.log("\n3) Responsive sweep");
for (const width of VIEWPORTS) {
  const p = await browser.newPage({ viewport: { width, height: Math.round(width * 0.9) } });
  await p.goto(`${BASE}${GROUP}?varijanta=CL-808`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  const m = await p.evaluate((sel) => {
    const stage = document.querySelector(sel[0]);
    const img = stage.querySelector(`${sel[1]} img`) ?? stage.querySelector("img");
    const sb = stage.getBoundingClientRect();
    const ib = img.getBoundingClientRect();
    const frame = stage.querySelector('[class*="patternFrame"]');
    const fb = frame.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      /*
       * `object-fit: contain` daje `img` element sirі od stage-a; vidljiv je
       * samo alpha prozor 292..506 od 800. Odsecanje se meri na alphi.
       */
      productCropped:
        ib.left + ib.width * (292 / 800) < sb.left - 0.5 ||
        ib.left + ib.width * (506 / 800) > sb.right + 0.5,
      axisPct: +(((ib.left - sb.left + ib.width * (398.1 / 800)) / sb.width) * 100).toFixed(2),
      grafitPct: +((fb.width / sb.width) * 100).toFixed(1),
      stage: `${sb.width.toFixed(0)}x${sb.height.toFixed(0)}`,
    };
  }, [STAGE, PRODUCT]);
  check(!m.overflow, `${width}px bez horizontalnog overflow-a`);
  check(!m.productCropped, `${width}px proizvod nije odsečen`, `osa ${m.axisPct}% stage ${m.stage}`);
  check(Math.abs(m.axisPct - 50) < 4, `${width}px optička osa stabilna`, `${m.axisPct}%`);
  if (width === 390) {
    writeFileSync(`${OUT}/final-cl-808-390.png`, await (await p.$(STAGE)).screenshot());
    await p.goto(`${BASE}${GROUP}?varijanta=CL-810`, { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    writeFileSync(`${OUT}/final-cl-810-390.png`, await (await p.$(STAGE)).screenshot());
  }
  await p.close();
}

/* ---- 4. Crvene vertikalne linije, 1968x1296 ------------------------- */
console.log("\n4) Pixel probe crvenih vertikalnih linija (1968x1296)");
const rp = await browser.newPage({ viewport: { width: 1968, height: 1296 } });
await rp.goto(`${BASE}${LONG_ROUTE}`, { waitUntil: "networkidle" });
await rp.waitForTimeout(1400);
console.log(`   finalni URL: ${rp.url()}`);
writeFileSync(`${OUT}/red-line-check-1968.png`, await rp.screenshot({ fullPage: false }));
const probe = await rp.evaluate(() => {
  const out = [];
  for (const x of [170, 171, 1797, 1798]) {
    const hits = [];
    for (let y = 80; y < 1200; y += 40) {
      for (const el of document.elementsFromPoint(x, y).slice(0, 3)) {
        const cs = getComputedStyle(el);
        for (const prop of ["borderLeftColor", "borderRightColor", "backgroundColor", "outlineColor"]) {
          const c = cs[prop];
          const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
          if (!m) continue;
          const [r, g, b, a] = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
          const wide = prop.startsWith("border")
            ? parseFloat(cs[prop.replace("Color", "Width")]) > 0
            : el.getBoundingClientRect().width < 6;
          if (a > 0.05 && r > 120 && r > g * 1.8 && r > b * 1.8 && wide) {
            hits.push({ y, prop, c, cls: el.className?.toString().slice(0, 40) });
          }
        }
      }
    }
    out.push({ x, hits });
  }
  return out;
});
for (const { x, hits } of probe) {
  check(hits.length === 0, `x=${x} bez crvene vertikale`, hits.length ? JSON.stringify(hits.slice(0, 2)) : "");
}
await rp.close();

/* ---- 5. Analiza piksela screenshota --------------------------------- */
console.log("\n5) Pixel analiza screenshota (bez CSS pretpostavki)");
const shot = decodePng(readFileSync(`${OUT}/red-line-check-1968.png`));
const ratio = shot.width / 1968;
for (const x of [170, 171, 1797, 1798]) {
  const c = redColumn(shot, x * ratio);
  check(
    c.longest === 0,
    `x=${x} nula crvenih piksela u koloni`,
    `crvenih ${c.count}/${shot.height}, najduzi niz ${c.longest}px`,
  );
}
const verticals = redVerticals(shot);
check(
  verticals.length === 0,
  "nijedna crvena vertikala kroz viewport",
  verticals.length ? `x=${verticals.map((v) => v.x).join(",")}` : `skenirano ${shot.width} kolona`,
);
writeFileSync(`${OUT}/variant-geometry.json`, JSON.stringify(perVariant, null, 2));

await browser.close();
console.log(`\n${fails.length === 0 ? "SVE PROVERE PROŠLE" : `PALO: ${fails.length}`}`);
for (const f of fails) console.log(`  - ${f}`);
process.exit(fails.length === 0 ? 0 : 1);
