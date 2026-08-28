/**
 * Provera zajedničkog stanja aktivne varijante na PDP-u.
 *
 * Dokazuje ugovor koji unit testovi ne mogu: da klik zaista menja SVE potrošače
 * u pretraživaču, da pri tome ne nastaje ni document ni RSC zahtev, i da skrol
 * ostaje netaknut.
 *
 *   node scripts/verify-product-variant-surface.mjs [baseUrl]
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3310";
const SHOTS = "review-screenshots/product-variant-surface";

const COSMOS = "/proizvodi/grupa/cosmos-lac-easy-max";

const failures = [];
const check = (ok, label, detail = "") => {
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
  return ok;
};

/** Sve što potrošači prikazuju, očitano iz žive strane. */
const SNAPSHOT = () => {
  const stage = document.querySelector("[data-product-hero-visual]");
  const wrapper = document.querySelector("[data-product-stage-treatment]");
  const img = document.querySelector("[data-route-critical]");
  const pressed = document.querySelector('[data-variant-option][aria-pressed="true"]');
  return {
    url: location.pathname + location.search,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    sku: document.querySelector("[data-variant-sku]")?.textContent?.trim() ?? null,
    shade: document.querySelector("[data-variant-shade]")?.textContent?.trim() ?? null,
    imageSrc: img?.getAttribute("src") ?? null,
    imageAlt: img?.getAttribute("alt") ?? null,
    // Grafit/pozadina: boja koju scena postavlja iz aktivne varijante.
    stageColor: stage
      ? getComputedStyle(stage).getPropertyValue("--product-active-color").trim()
      : null,
    stageContrast: stage?.getAttribute("data-product-contrast") ?? null,
    stageType: wrapper?.getAttribute("data-product-stage-type") ?? null,
    stageAspect: stage ? getComputedStyle(stage).aspectRatio : null,
    stageBox: stage
      ? (({ width, height }) => ({ w: Math.round(width), h: Math.round(height) }))(
          stage.getBoundingClientRect(),
        )
      : null,
    activeCard: pressed?.textContent?.trim().slice(0, 40) ?? null,
    cta: document.querySelector("[data-product-inquiry]")?.getAttribute("href") ?? null,
    scrollY: Math.round(window.scrollY),
    overflowX:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

/** Ono što mora da se razlikuje između dve varijante. */
const VARIANT_FIELDS = [
  "url",
  "h1",
  "sku",
  "imageSrc",
  "imageAlt",
  "stageColor",
  "activeCard",
  "cta",
];

function newRecorder(page) {
  const seen = { document: [], rsc: [], image: [], other: [] };
  page.on("request", (request) => {
    const url = request.url();
    const type = request.resourceType();
    if (type === "document") seen.document.push(url);
    else if (type === "image") seen.image.push(url);
    else if (
      // Next App Router traži RSC payload preko `_rsc` parametra ili RSC zaglavlja.
      url.includes("_rsc=") ||
      request.headers()["rsc"] === "1" ||
      request.headers()["next-router-prefetch"] === "1"
    ) {
      seen.rsc.push(url);
    } else seen.other.push(url);
  });
  return seen;
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Slika varijante mora biti stvarno dekodirana pre snimka kadra.
  await page
    .waitForFunction(() => {
      const img = document.querySelector("[data-route-critical]");
      return !img || img.complete;
    }, { timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(350);
}

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });

/* ---------------------------------------------------------------------------
 * 1. Cosmos: klik CL-808 → CL-810 na 1440 px
 * ------------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + COSMOS, { waitUntil: "networkidle" });
  await settle(page);

  /*
   * Skrol se namerno postavlja na kadar u kome su istovremeno vidljivi naslov,
   * šifra/RAL, limenka, grafit i aktivna kartica — isti kadar za obe varijante,
   * da bi poređenje snimaka bilo pošteno. Vrednost je različita od nule, pa
   * ujedno dokazuje i da izbor ne pomera stranu.
   */
  await page.evaluate(() => {
    const title = document.querySelector("h1");
    const top = title ? title.getBoundingClientRect().top + window.scrollY : 300;
    window.scrollTo(0, Math.max(0, Math.round(top - 96)));
  });
  await page.waitForTimeout(200);

  // Reprezentativna varijanta se ČITA sa strane, ne pretpostavlja: server bira
  // prvu iz kataloga, i to je ono na šta fallback mora da se vrati.
  const representative = await page.evaluate(SNAPSHOT);
  console.log(`     reprezentativna varijanta: ${representative.sku}`);

  // Prvi klik: reprezentativna → CL-808. Tek posle njega poređenje CL-808 →
  // CL-810 dokazuje prelaz IZMEĐU dve varijante, a ne samo odlazak sa polazne.
  await page.click('[data-variant-option]:has-text("CL-808")');
  await settle(page);
  const before = await page.evaluate(SNAPSHOT);
  check(before.sku === "CL-808", "prvi izbor je CL-808", before.sku ?? "");
  await page.screenshot({ path: `${SHOTS}/cosmos-cl-808-1440.png` });

  const net = newRecorder(page);
  await page.click('[data-variant-option]:has-text("CL-810")');
  await settle(page);
  const after = await page.evaluate(SNAPSHOT);
  await page.screenshot({ path: `${SHOTS}/cosmos-cl-810-1440.png` });

  for (const field of VARIANT_FIELDS) {
    check(
      before[field] !== after[field],
      `klik menja: ${field}`,
      `${String(before[field]).slice(-38)} → ${String(after[field]).slice(-38)}`,
    );
  }
  check(after.url.includes("varijanta=CL-810"), "URL nosi ?varijanta=CL-810", after.url);
  check(after.h1.includes("810"), "naslov je CL-810", after.h1);
  check(before.h1.includes("808"), "polazni naslov je bio CL-808", before.h1);
  check(after.sku === "CL-810", "šifra je CL-810", after.sku ?? "");
  check(
    after.shade !== null && after.shade !== before.shade,
    "RAL/nijansa se menja",
    `${before.shade} → ${after.shade}`,
  );

  // Mreža: slika sme, navigacija ne sme.
  check(net.document.length === 0, "nema document zahteva", net.document.join(", "));
  check(net.rsc.length === 0, "nema RSC navigacije", net.rsc.join(", "));
  check(net.image.length > 0, "zahtev za novu sliku je dozvoljen", `${net.image.length}`);

  check(before.scrollY === after.scrollY, "skrol očuvan", `${before.scrollY} → ${after.scrollY}`);
  check(
    before.stageBox.w === after.stageBox.w && before.stageBox.h === after.stageBox.h,
    "panel ne menja dimenzije",
    `${JSON.stringify(before.stageBox)} → ${JSON.stringify(after.stageBox)}`,
  );
  check(after.overflowX === 0, "nema horizontalnog prelivanja", String(after.overflowX));

  /* ---- Back / Forward ---- */
  const navNet = newRecorder(page);
  await page.goBack();
  await settle(page);
  const back = await page.evaluate(SNAPSHOT);
  for (const field of VARIANT_FIELDS.filter((f) => f !== "url")) {
    check(back[field] === before[field], `Back vraća: ${field}`, String(back[field]).slice(-38));
  }
  check(navNet.document.length === 0, "Back ne pravi document zahtev", navNet.document.join(", "));
  check(navNet.rsc.length === 0, "Back ne pravi RSC zahtev", navNet.rsc.join(", "));

  await page.goForward();
  await settle(page);
  const forward = await page.evaluate(SNAPSHOT);
  check(forward.h1 === after.h1, "Forward vraća CL-810", forward.h1 ?? "");
  check(forward.sku === after.sku, "Forward vraća šifru CL-810", forward.sku ?? "");

  await page.close();
}

/* ---------------------------------------------------------------------------
 * 1b. Prelaz se ponovo pokrece pri SVAKOJ promeni
 *
 * `interactive` posle prvog izbora ostaje `true`, pa atribut
 * `data-variant-crossfade` stoji trajno. CSS animacija se zato ponovo pokrece
 * iskljucivo kada se `<Image>` cvor iznova montira. Ovde se to meri zivo:
 * `getAnimations()` na slici mora prijaviti animaciju i posle PRVE i posle
 * DRUGE promene, a druga mora krenuti iz pocetka.
 * ------------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + COSMOS, { waitUntil: "networkidle" });
  await settle(page);

  const ANIM = () => {
    const el = document.querySelector("[data-variant-crossfade]");
    if (!el) return { prisutan: false, animacija: 0, vreme: null };
    const a = el
      .getAnimations()
      // CSS Modules hesiraju ime @keyframes-a (`..._productVariantCrossfade__0UecU`),
      // pa se poredi po sadrzaju imena, ne tacnom nizu.
      .filter((x) => x.animationName.includes("productVariantCrossfade"));
    return {
      prisutan: true,
      animacija: a.length,
      vreme: a[0] ? Number(a[0].currentTime) : null,
    };
  };

  // Pri ucitavanju prelaz mora da cuti — prva slika nosi LCP.
  const naUcitavanju = await page.evaluate(ANIM);
  check(
    !naUcitavanju.prisutan,
    "pri ucitavanju nema crossfade atributa",
    JSON.stringify(naUcitavanju),
  );

  await page.click('[data-variant-option]:has-text("CL-808")');
  const prva = await page.evaluate(ANIM);
  await settle(page);

  await page.click('[data-variant-option]:has-text("CL-810")');
  const druga = await page.evaluate(ANIM);
  await settle(page);

  check(prva.animacija >= 1, "prva promena pokrece prelaz", JSON.stringify(prva));
  check(
    druga.animacija >= 1,
    "DRUGA promena ponovo pokrece prelaz",
    JSON.stringify(druga),
  );
  check(
    druga.vreme !== null && druga.vreme < 200,
    "druga animacija krece iz pocetka",
    JSON.stringify(druga),
  );

  // Back vraca varijantu BEZ prelaza.
  await page.goBack();
  await settle(page);
  const posleNazad = await page.evaluate(ANIM);
  check(!posleNazad.prisutan, "Back ne pokrece prelaz", JSON.stringify(posleNazad));

  await page.close();
}

/* ---------------------------------------------------------------------------
 * 2. Direktan URL i nevažeća varijanta
 * ------------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}${COSMOS}?varijanta=CL-810`, { waitUntil: "networkidle" });
  await settle(page);
  const direct = await page.evaluate(SNAPSHOT);
  await page.screenshot({ path: `${SHOTS}/cosmos-cl-810-direktan-url-1440.png` });

  check(direct.h1.includes("810"), "direktan URL: naslov CL-810", direct.h1);
  check(direct.sku === "CL-810", "direktan URL: šifra CL-810", direct.sku ?? "");
  check(direct.imageSrc?.includes("cl-810"), "direktan URL: slika CL-810", direct.imageSrc ?? "");
  check(direct.activeCard?.includes("810"), "direktan URL: aktivna kartica", direct.activeCard ?? "");
  check(direct.cta?.includes("CL-810"), "direktan URL: CTA nosi varijantu", direct.cta ?? "");
  check(direct.stageColor !== "", "direktan URL: grafit ima boju", direct.stageColor ?? "");

  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  // Reprezentativna varijanta se čita bez ijednog parametra — to je ono na šta
  // svaki nevažeći query mora da se vrati.
  await page.goto(BASE + COSMOS, { waitUntil: "networkidle" });
  await settle(page);
  const plain = await page.evaluate(SNAPSHOT);

  for (const query of ["NE-POSTOJI", "", "%20", "../../etc", "<script>"]) {
    await page.goto(`${BASE}${COSMOS}?varijanta=${encodeURIComponent(query)}`, {
      waitUntil: "networkidle",
    });
    await settle(page);
    const bad = await page.evaluate(SNAPSHOT);
    check(
      bad.sku === plain.sku,
      `nevažeća varijanta "${query || "(prazno)"}" pada na reprezentativnu`,
      `${bad.sku} vs ${plain.sku}`,
    );
    check(bad.imageSrc !== null, `"${query || "(prazno)"}" ne ostavlja prazan stage`);
    check(
      bad.activeCard === plain.activeCard && bad.imageSrc === plain.imageSrc,
      `"${query || "(prazno)"}": kartica i slika se ne razilaze`,
      bad.activeCard ?? "",
    );
  }
  check(errors.length === 0, "nema izuzetka na nevažeći query", errors.join("; "));

  await page.close();
}

/* ---------------------------------------------------------------------------
 * 3. Mobilni selektor, 390 px
 * ------------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + COSMOS, { waitUntil: "networkidle" });
  await settle(page);
  const mobile = await page.evaluate(SNAPSHOT);
  check(mobile.overflowX === 0, "390 px: nema prelivanja", String(mobile.overflowX));

  // Kadar mora da pokaže sam selektor, ne samo vrh strane.
  await page.evaluate(() => {
    document
      .querySelector("[data-variant-option]")
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/cosmos-selektor-390.png` });

  // Izbor radi i na mobilnom, i dalje bez navigacije.
  const mobileNet = newRecorder(page);
  const beforeMobile = await page.evaluate(SNAPSHOT);
  await page.click('[data-variant-option]:has-text("CL-810")');
  await settle(page);
  const afterMobile = await page.evaluate(SNAPSHOT);
  check(beforeMobile.sku !== afterMobile.sku, "390 px: izbor menja šifru", afterMobile.sku ?? "");
  check(mobileNet.document.length === 0, "390 px: nema document zahteva");
  check(mobileNet.rsc.length === 0, "390 px: nema RSC navigacije");
  check(
    (await page.evaluate(SNAPSHOT)).overflowX === 0,
    "390 px: nema prelivanja posle izbora",
  );
  await page.close();
}

/* ---------------------------------------------------------------------------
 * 4. Ne-Cosmos porodica — stize uz Baslac commit
 *
 * Broj koraka je namerno zadrzan prazan. Dokaz da mehanizam nije vezan za jedan
 * brend trazi porodicu drugog brenda sa dve stvarne varijante, a jedina takva
 * (/proizvodi/grupa/20-24-2k-primerfiller-grey) dolazi Baslac commitom.
 * Otvaranje rute koja ne postoji dalo bi 404 i lazan pad, pa se korak ne
 * simulira nego izostavlja dok ruta ne postoji.
 *
 * Brand-agnosticnost je do tada pokrivena staticki:
 * components/product/productVariantSurface.test.mjs obara build ako se u
 * zajednickom sloju pojavi grananje po brendu ili hardkodovana sifra.
 * ------------------------------------------------------------------------ */

/* ---------------------------------------------------------------------------
 * 5. Pristupačnost selektora
 * ------------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + COSMOS, { waitUntil: "networkidle" });
  await settle(page);

  const semantics = await page.evaluate(() => {
    const options = [...document.querySelectorAll("[data-variant-option]")];
    const pressed = options.filter((o) => o.getAttribute("aria-pressed") === "true");
    return {
      total: options.length,
      allButtons: options.every((o) => o.tagName === "BUTTON" && o.type === "button"),
      allHaveState: options.every((o) => o.hasAttribute("aria-pressed")),
      pressedCount: pressed.length,
      focusable: options.every((o) => o.tabIndex >= 0 && !o.hasAttribute("aria-hidden")),
      liveRegions: document.querySelectorAll("[aria-live]").length,
    };
  });

  check(semantics.allButtons, "selektor koristi prave <button> kontrole");
  check(semantics.allHaveState, "svaka kontrola ima aria-pressed");
  check(semantics.pressedCount === 1, "tačno jedna aktivna kontrola", String(semantics.pressedCount));
  check(semantics.focusable, "sve kontrole su dohvatljive tastaturom");
  // Jedna najava po promeni; dve bi ista obaveštenja isporučile dvaput.
  check(semantics.liveRegions === 1, "tačno jedna aria-live najava", String(semantics.liveRegions));

  // Izbor tastaturom: fokusiraj kontrolu i pritisni Enter.
  const target = page.locator('[data-variant-option]:has-text("CL-810")');
  await target.focus();
  const focusRing = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el, ":focus-visible");
    return {
      isOption: el?.hasAttribute("data-variant-option") ?? false,
      outline: style.outlineWidth,
      shadow: style.boxShadow !== "none",
    };
  });
  check(focusRing.isOption, "fokus stiže na kontrolu varijante");
  check(
    focusRing.outline !== "0px" || focusRing.shadow,
    "fokus je vidljiv",
    `outline=${focusRing.outline} shadow=${focusRing.shadow}`,
  );

  await page.keyboard.press("Enter");
  await settle(page);
  const viaKeyboard = await page.evaluate(SNAPSHOT);
  check(viaKeyboard.sku === "CL-810", "izbor radi tastaturom", viaKeyboard.sku ?? "");

  // `alt` slike mora da opisuje AKTIVNU varijantu.
  check(
    viaKeyboard.imageAlt?.includes("810") || viaKeyboard.imageAlt?.includes("Purple"),
    "alt slike prati varijantu",
    viaKeyboard.imageAlt ?? "",
  );

  // Fokus ne sme da odskoči na drugi element posle izbora.
  const focusAfter = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-pressed") ?? "izgubljen",
  );
  check(focusAfter === "true", "fokus ostaje na izabranoj kontroli", focusAfter);

  await page.close();
}

/* ---------------------------------------------------------------------------
 * 6. Javne rute i dalje bez korpe
 * ------------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const route of [COSMOS, "/", "/katalog"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const cart = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        controls: document.querySelectorAll(
          '[data-cart], [aria-label*="korp" i], [data-cart-count]',
        ).length,
        addToCart: /dodaj u korpu|dodaj sve u korpu|quick ?add/i.test(text),
        storage: Object.keys(window.localStorage).filter((k) => k.includes("cart")),
      };
    });
    check(
      cart.controls === 0 && !cart.addToCart && cart.storage.length === 0,
      `javna ruta bez korpe: ${route}`,
      JSON.stringify(cart),
    );
  }
  await page.close();
}

await browser.close();

console.log(
  failures.length === 0
    ? "\nSVE PROVERE PROSLE"
    : `\n${failures.length} PROVERA PALO:\n - ${failures.join("\n - ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
