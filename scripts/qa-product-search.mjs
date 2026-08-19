#!/usr/bin/env node
/**
 * QA pretrage proizvoda — runtime ugovori koje unit testovi ne mogu da dokažu.
 *
 * Engine i rangiranje pokriva `lib/search/*.test.mjs`. Ovde se proverava ono
 * što postoji samo u pravom browseru: koliko puta se asset preuzima, da li
 * worker preživi 20 ciklusa otvaranja i zatvaranja, da li spor odgovor može da
 * pregazi noviji upit, da li Retry stvarno ponavlja pao zahtev, i da li panel
 * na 360 px pravi horizontalni overflow.
 *
 * Kači se na VEĆ POKRENUT dev/preview server i nikada ga ne pokreće sam — dva
 * Next procesa ne smeju da dele dist direktorijum.
 *
 * Usage: node scripts/qa-product-search.mjs [--base-url=…] [--out=…]
 */

import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";
const outDir = args.out ?? "tmp/qa/search";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
  { name: "360", width: 360, height: 740 },
];

const results = [];
const failures = [];
const expect = (condition, message) => {
  results.push({ ok: Boolean(condition), message });
  if (!condition) failures.push(message);
};

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

/** Prati SVAKI zahtev za search asset kroz ceo život stranice. */
function trackIndexRequests(page) {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/katalog/search-index.json")) requests.push(request.url());
  });
  return requests;
}

function trackConsoleErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

async function openSearchFromHeader(page) {
  await page.click('button[aria-label="Pretražite proizvode"]');
  await page.waitForSelector('[role="dialog"]');
}

/**
 * Otvaranje prečicom, sa čekanjem.
 *
 * Provera odmah posle `press()` je trka sa React render-om, ne dokaz — panel se
 * montira u sledećem tiku. `Meta` je macOS, `Control` ostatak sveta; provider
 * prihvata oba, pa se probaju redom.
 */
async function openSearchByShortcut(page) {
  for (const shortcut of ["Meta+k", "Control+k"]) {
    await page.keyboard.press(shortcut);
    try {
      await page.waitForSelector('[role="dialog"] input', { timeout: 1500 });
      return true;
    } catch {
      /* probaj drugi modifikator */
    }
  }
  return false;
}

async function typeQuery(page, query) {
  const input = page.locator('[role="dialog"] input');
  await input.fill(query);
  await page.waitForTimeout(350);
}

/**
 * Čeka da pretraga SLEGNE: rezultati, prazno stanje ili greška.
 *
 * Fiksni `waitForTimeout` bi merio brzinu dev servera, a ne ispravnost — prvi
 * upit u sesiji plaća i preuzimanje asseta i gradnju indeksa u workeru, što na
 * hladnom dev serveru ume da traje sekundama.
 */
async function waitForSettledSearch(page, timeout = 15000) {
  await page
    .locator(
      '[role="dialog"] [role="option"], [role="dialog"] p:text("Nema rezultata za"), [role="dialog"] p:text("Pretraga trenutno nije dostupna")',
    )
    .first()
    .waitFor({ timeout })
    .catch(() => {});
}

/* -------------------------------------------------------------------------- */
/* 1. Lenjo učitavanje i broj zahteva                                          */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = trackIndexRequests(page);
  const errors = trackConsoleErrors(page);

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  expect(requests.length === 0, `Homepage bez namere pretrage: ${requests.length} zahteva za indeks (očekivano 0).`);

  await openSearchFromHeader(page);
  expect(
    requests.length === 0,
    `Otvaranje panela bez ijednog znaka: ${requests.length} zahteva (očekivano 0).`,
  );

  await typeQuery(page, "antichip");
  await waitForSettledSearch(page);
  expect(requests.length === 1, `Prva pretraga: ${requests.length} zahteva (očekivano 1).`);

  const firstRows = await page.locator('[role="option"]').count();
  expect(firstRows > 1, `Prva pretraga nije dala rezultate (${firstRows} redova).`);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await openSearchFromHeader(page);
  await typeQuery(page, "molotow chrome");
  await waitForSettledSearch(page);
  expect(
    requests.length === 1,
    `Druga pretraga je napravila nov zahtev (ukupno ${requests.length}).`,
  );

  /* 20 ciklusa otvaranja/zatvaranja: bez curenja worker-a, listenera i zahteva. */
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(40);
    await openSearchFromHeader(page);
    await page.waitForTimeout(40);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  const leaked = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    bodyOverflow: document.body.style.overflow,
    bodyPadding: document.body.style.paddingRight,
  }));
  expect(leaked.dialogs === 0, `Posle 20 ciklusa ostalo je ${leaked.dialogs} dijaloga u DOM-u.`);
  expect(
    leaked.bodyOverflow === "" && leaked.bodyPadding === "",
    `Scroll lock nije vraćen (overflow="${leaked.bodyOverflow}", paddingRight="${leaked.bodyPadding}").`,
  );
  expect(
    requests.length === 1,
    `20 ciklusa je napravilo ${requests.length} zahteva za indeks (očekivano 1).`,
  );
  expect(errors.length === 0, `Console greške: ${errors.slice(0, 3).join(" | ")}`);

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 2. Dva ulaza istovremeno ne prave dva zahteva                               */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = trackIndexRequests(page);
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  /*
   * Homepage kontrola i Header lupa dele isti panel i isti modul-level promise;
   * ovde se paralelno pokreće učitavanje i odmah otvara panel, pa bi svaka
   * implementacija sa keširanjem po komponenti napravila dva zahteva.
   */
  await page.evaluate(() => {
    document.querySelector('button[aria-label="Pretražite proizvode"]')?.click();
  });
  await page.waitForSelector('[role="dialog"]');
  await typeQuery(page, "ral");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const homepageTrigger = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Pretražite proizvode"),
    );
    homepageTrigger?.click();
  });
  await page.waitForTimeout(500);

  expect(
    requests.length === 1,
    `Dva ulazna mesta su napravila ${requests.length} zahteva (očekivano 1).`,
  );
  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 2b. Jednoslovni upit: bez pretrage, bez asseta, bez slepe navigacije        */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = trackIndexRequests(page);
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  await openSearchFromHeader(page);
  await page.locator('[role="dialog"] input').fill("c");
  await page.waitForTimeout(700);

  expect(
    requests.length === 0,
    `Jedan znak je povukao indeks (${requests.length} zahteva, očekivano 0).`,
  );
  expect(
    (await page.locator('[role="option"]').count()) === 0,
    "Jedan znak je pokrenuo široku pretragu.",
  );
  expect(
    await page
      .locator('[role="dialog"] p:not(.sr-only)', { hasText: "Unesite najmanje 2 znaka" })
      .first()
      .isVisible(),
    "Nedostaje poruka „Unesite najmanje 2 znaka“.",
  );

  /* Najava za čitače ekrana mora reći isto što i vidljiva poruka. */
  const announced = await page.evaluate(
    () => document.querySelector('[role="dialog"] [role="status"]')?.textContent ?? "",
  );
  expect(
    announced.includes("najmanje 2 znaka"),
    `\`role="status"\` najava za jedan znak glasi „${announced}".`,
  );

  /* Enter ne sme da odvede na beskorisan katalog rezultat. */
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  expect(
    !page.url().includes("q=c"),
    `Enter na jednom znaku je navigirao na ${page.url()}.`,
  );
  expect(
    (await page.locator('[role="dialog"]').count()) === 1,
    "Enter na jednom znaku je zatvorio panel.",
  );

  /* Drugi znak odmah radi. */
  await page.locator('[role="dialog"] input').fill("cl");
  await waitForSettledSearch(page);
  expect(
    (await page.locator('[role="option"]').count()) > 1,
    "Dva znaka ne vraćaju rezultate.",
  );
  expect(requests.length === 1, `Dva znaka: ${requests.length} zahteva (očekivano 1).`);

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 3. Trka upita — sporiji odgovor ne sme da pregazi noviji                    */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await openSearchFromHeader(page);

  const input = page.locator('[role="dialog"] input');
  await input.fill("a");
  await input.fill("an");
  await input.fill("ant");
  await input.fill("antichip");
  await input.fill("c2e50");
  await page.waitForTimeout(900);

  const rows = await page.locator('[role="option"]').allTextContents();
  expect(
    rows.some((row) => row.includes("C 2E50")),
    `Posle brze izmene upita prikazan je zastareo rezultat: ${rows[0] ?? "(prazno)"}`,
  );
  expect(
    !rows.some((row) => row.includes("Antichip")),
    "Rezultat prethodnog upita je ostao na ekranu.",
  );
  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 4. Greška i Retry                                                           */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let failNext = true;
  await page.route("**/katalog/search-index.json", async (route) => {
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 500, body: "fail" });
      return;
    }
    await route.continue();
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await openSearchFromHeader(page);
  await typeQuery(page, "antichip");
  await waitForSettledSearch(page);

  /*
   * Namerno se traži VIDLJIVI tekst, ne `role="status"` poruka: obe postoje i
   * obe su tačne, ali samo prva dokazuje da je korisnik zaista nešto video.
   */
  const errorVisible = await page
    .locator('[role="dialog"] p:not(.sr-only)', { hasText: "Pretraga trenutno nije dostupna" })
    .first()
    .isVisible();
  expect(errorVisible, "Neuspelo učitavanje indeksa ne prikazuje stanje greške.");

  const noEmptyLie = !(await page
    .locator('[role="dialog"]')
    .getByText("Nema rezultata za")
    .first()
    .isVisible()
    .catch(() => false));
  expect(noEmptyLie, "Greška je prikazana kao „nema rezultata“.");

  await page.getByRole("button", { name: "Pokušaj ponovo" }).click();
  /*
   * Čeka se baš rezultat, ne „slegnuto stanje": poruka o grešci je još na
   * ekranu u trenutku klika, pa bi opšte čekanje odmah prošlo i merilo stanje
   * pre oporavka.
   */
  await page
    .locator('[role="dialog"] [role="option"]')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  const recovered = await page.locator('[role="option"]').count();
  expect(recovered > 1, `Retry nije oporavio pretragu (${recovered} redova).`);
  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 5. Tastatura, fokus i ARIA                                                  */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  const openedByShortcut = await openSearchByShortcut(page);
  expect(openedByShortcut, "Cmd/Ctrl+K ne otvara pretragu.");
  expect(
    (await page.locator('[role="dialog"]').count()) === 1,
    "Prečica je otvorila više od jednog dijaloga.",
  );

  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(focusedTag === "INPUT", `Fokus posle otvaranja je na ${focusedTag}, ne na polju.`);

  await typeQuery(page, "antichip");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  const active = await page.evaluate(() => {
    const input = document.querySelector('[role="dialog"] input');
    const id = input?.getAttribute("aria-activedescendant");
    const option = id ? document.getElementById(id) : null;
    return {
      id,
      selected: option?.getAttribute("aria-selected"),
      insideListbox: Boolean(option?.closest('[role="listbox"]')),
      role: option?.getAttribute("role"),
    };
  });
  expect(Boolean(active.id), "`aria-activedescendant` nije postavljen posle strelice.");
  expect(active.insideListbox, "`aria-activedescendant` pokazuje van liste kojom upravlja.");
  expect(active.role === "option", `Aktivni element ima role="${active.role}".`);
  expect(active.selected === "true", "Aktivna opcija nema `aria-selected=true`.");

  const dialogName = await page.evaluate(() =>
    document.querySelector('[role="dialog"]')?.getAttribute("aria-label"),
  );
  expect(Boolean(dialogName), "Dijalog nema pristupačno ime.");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const restored = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  expect(
    restored === "Pretražite proizvode" || restored === null,
    `Fokus posle zatvaranja je na „${restored}“.`,
  );

  /* Prečica ne sme da se otme dok korisnik kuca u drugom polju. */
  await page.goto(`${baseUrl}/kontakt`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const anyInput = page.locator("input[type=text], input:not([type])").first();
  if ((await anyInput.count()) > 0) {
    await anyInput.click();
    await page.keyboard.press("/");
    const openedBySlash = await page.locator('[role="dialog"]').count();
    expect(openedBySlash === 0, "Prečica „/“ se otima dok korisnik kuca u drugom polju.");
  }
  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 6. Viewporti: overflow, touch target, snimci                                */
/* -------------------------------------------------------------------------- */

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  /*
   * Na uskim ekranima je lupa u mobilnom meniju; prečica otvara isti panel bez
   * obzira na to koja je kontrola vidljiva, pa je QA ista na svim širinama.
   */
  const opened = await openSearchByShortcut(page);
  expect(opened, `Prečica ne otvara pretragu na ${viewport.name} px.`);
  await typeQuery(page, "antichip 400 ml");
  await waitForSettledSearch(page);

  const metrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[role="option"]')];
    return {
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      minRowHeight: rows.length
        ? Math.min(...rows.map((row) => row.getBoundingClientRect().height))
        : 0,
      panelWidth: document.querySelector('[role="dialog"]')?.getBoundingClientRect().width ?? 0,
      inputVisible: (() => {
        const input = document.querySelector('[role="dialog"] input');
        if (!input) return false;
        const box = input.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight;
      })(),
    };
  });

  expect(
    !metrics.horizontalOverflow,
    `Horizontalni overflow na ${viewport.name} px.`,
  );
  expect(
    metrics.minRowHeight >= (viewport.width < 768 ? 44 : 40),
    `Red rezultata na ${viewport.name} px je visok ${metrics.minRowHeight.toFixed(0)} px.`,
  );
  expect(metrics.inputVisible, `Polje za unos nije vidljivo na ${viewport.name} px.`);
  expect(
    metrics.panelWidth <= viewport.width,
    `Panel (${metrics.panelWidth.toFixed(0)} px) je širi od ekrana na ${viewport.name} px.`,
  );

  await page.screenshot({ path: join(outDir, `search-${viewport.name}.png`) });

  /*
   * Tamna tema, na najširem i najužem. Sajt bira temu preko `data-theme` na
   * <html> (`ThemeScript`), pa `emulateMedia` ne bi ništa promenio kad postoji
   * sačuvan izbor — tema se zato prebacuje istim ugovorom koji koristi
   * `ThemeToggle`.
   */
  if (viewport.name === "1440" || viewport.name === "360") {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(outDir, `search-${viewport.name}-dark.png`) });

    const darkContrast = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]');
      const style = panel ? getComputedStyle(panel) : null;
      return { background: style?.backgroundColor ?? "", color: style?.color ?? "" };
    });
    expect(
      darkContrast.background !== "" && darkContrast.background !== "rgba(0, 0, 0, 0)",
      `Panel u tamnoj temi nema sopstvenu pozadinu na ${viewport.name} px.`,
    );

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
      document.documentElement.classList.remove("dark");
    });
  }

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 7. Mobilna navigacija predaje fokus pretrazi                                */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  /*
   * Mobilna navigacija pri zatvaranju vraća fokus na hamburger kadar kasnije.
   * Kada je zatvara baš dugme pretrage, taj povratak mora izostati — inače
   * korisnik dobije otvoren panel u koji ne može da kuca.
   */
  await page.click('button[aria-label="Otvori meni"]');
  await page.waitForTimeout(350);

  const searchButton = page
    .locator("button", { hasText: "Pretražite proizvode" })
    .filter({ has: page.locator("svg") })
    .last();
  await searchButton.click();
  await page.waitForSelector('[role="dialog"] input');
  await page.waitForTimeout(600);

  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(
    focusedTag === "INPUT",
    `Fokus posle otvaranja iz mobilne navigacije je na ${focusedTag}, ne na polju.`,
  );
  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 8. Katalog kao destinacija                                                  */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = trackIndexRequests(page);
  await page.goto(`${baseUrl}/katalog`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.waitForTimeout(600);
  expect(
    requests.length === 0,
    `/katalog bez \`q\` je povukao indeks (${requests.length} zahteva).`,
  );

  await page.goto(`${baseUrl}/katalog?q=antichip%20400%20ml`, { waitUntil: "load" });
  await page
    .locator('a[href^="/proizvodi/"]')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  expect(requests.length === 1, `Direktan /katalog?q= nije povukao indeks tačno jednom.`);

  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/proizvodi/"]')].slice(0, 10).map((a) => a.getAttribute("href")),
  );
  expect(hrefs.length > 0, "Direktan /katalog?q= nije prikazao nijedan rezultat.");

  /* Svaki prikazan href mora biti stvarna stranica, ne 404. */
  for (const href of hrefs.slice(0, 3)) {
    const response = await page.request.get(`${baseUrl}${href}`);
    expect(response.ok(), `Rezultat vodi na ${response.status()}: ${href}`);
  }

  /* Panel → „Prikaži sve" → katalog sa istim upitom. */
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await openSearchFromHeader(page);
  await typeQuery(page, "antichip");
  await waitForSettledSearch(page);
  await page.locator('[role="option"]').last().click();
  await page.waitForURL(/\/katalog\?q=/);
  expect(
    page.url().includes("q=antichip"),
    `„Prikaži sve“ je odvelo na ${page.url()}.`,
  );
  await page.close();
}

await browser.close();

const report = {
  baseUrl,
  checks: results.length,
  failed: failures.length,
  results,
};
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));

if (failures.length) {
  console.error(`QA pretrage: ${failures.length} od ${results.length} provera nije prošlo:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`QA pretrage: svih ${results.length} provera prošlo. Snimci: ${outDir}`);
