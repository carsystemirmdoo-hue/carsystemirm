#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadCatalogRuntime } from "./lib/catalog-runtime.mjs";

/*
 * Registar konsolidovanih varijanti — jedini izvor istine o tome šta SME da
 * preusmerava.
 *
 * Ranije je svaki odgovor koji nije 200 na internom linku proizvoda bio
 * `broken-internal-product-link`. Otkako `variant-pdp` porodice preusmeravaju
 * varijantu na svoju grupu, to je prijavljivalo 808 namernih preusmerenja kao
 * kvar i time činilo kapiju neupotrebljivom.
 *
 * Provera se zato ne opušta nego POOŠTRAVA: 307 je prihvatljiv samo za slug
 * koji je ovde registrovan i samo ka tačno onoj adresi koju registar navodi.
 * Nepoznato ili pogrešno usmereno preusmerenje i dalje pada.
 */
const catalogRuntime = loadCatalogRuntime();
const productFamilies = catalogRuntime.requireModule("lib/product-families.ts");
const carsystemData = catalogRuntime.requireModule("lib/carsystem-data.ts");

/** slug varijante -> očekivana adresa preusmerenja (samo `variant-pdp`). */
const expectedRedirect = new Map();
/** slugovi koji su konsolidovani ali se serviraju sa 200 (`collection`). */
const consolidatedNoRedirect = new Set();

for (const product of carsystemData.getAllCarsystemProducts()) {
  const target = productFamilies.variantRedirectTarget(product);
  if (target) expectedRedirect.set(`/proizvodi/${product.slug}`, target);
  else if (productFamilies.getConsolidatedVariantSlugs().has(product.slug)) {
    consolidatedNoRedirect.add(`/proizvodi/${product.slug}`);
  }
}

const projectRoot = process.cwd();
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const value = process.argv[index + 1];
  args.set(key.slice(2), value && !value.startsWith("--") ? value : "true");
  if (value && !value.startsWith("--")) index += 1;
}

const baseUrl = new URL(args.get("base-url") ?? "http://localhost:3000");
const canonicalOrigin = new URL(
  args.get("canonical-host") ?? "https://carsystemirm.com",
).origin;
const concurrency = Math.max(1, Number(args.get("concurrency") ?? 24));

const decodeEntities = (value = "") =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

const stripTags = (value = "") =>
  decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

const getAttribute = (tag, name) => {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i"),
  );
  return decodeEntities(match?.[1] ?? match?.[2] ?? "");
};

const getMeta = (html, attribute, value) => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find(
    (item) => getAttribute(item, attribute).toLowerCase() === value.toLowerCase(),
  );
  return tag ? getAttribute(tag, "content") : "";
};

const getCanonical = (html) => {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = links.find((item) =>
    getAttribute(item, "rel").toLowerCase().split(/\s+/).includes("canonical"),
  );
  return tag ? getAttribute(tag, "href") : "";
};

function getJsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  return blocks.map((match) => JSON.parse(decodeEntities(match[1]).trim()));
}

function collectTypes(value, target = new Set()) {
  if (!value || typeof value !== "object") return target;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTypes(item, target));
    return target;
  }
  if (typeof value["@type"] === "string") target.add(value["@type"]);
  if (Array.isArray(value["@type"])) value["@type"].forEach((item) => target.add(item));
  Object.values(value).forEach((item) => collectTypes(item, target));
  return target;
}

function containsForbiddenProductCommercialData(value, insideProduct = false) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((item) =>
      containsForbiddenProductCommercialData(item, insideProduct),
    );
  }
  const isProduct =
    value["@type"] === "Product" ||
    (Array.isArray(value["@type"]) && value["@type"].includes("Product"));
  const productScope = insideProduct || isProduct;
  if (
    productScope &&
    ["offers", "price", "priceCurrency", "availability", "aggregateRating", "review"].some(
      (property) => Object.hasOwn(value, property),
    )
  ) {
    return true;
  }
  return Object.values(value).some((item) =>
    containsForbiddenProductCommercialData(item, productScope),
  );
}

async function mapConcurrent(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(items.length, limit) }, async () => {
      while (cursor < items.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await callback(items[current], current);
      }
    }),
  );
  return results;
}

async function fetchLocal(pathname, options = {}) {
  return fetch(new URL(pathname, baseUrl), {
    redirect: "manual",
    headers: { "user-agent": "CarsystemSeoValidator/1.0" },
    ...options,
  });
}

async function isServerReady() {
  try {
    return (await fetchLocal("/")).status > 0;
  } catch {
    return false;
  }
}

async function withServer(callback) {
  let serverProcess;
  if (args.get("start-server") === "true" && !(await isServerReady())) {
    const port = baseUrl.port || "3000";
    serverProcess = spawn("npm", ["run", "start", "--", "-p", port], {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await isServerReady()) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!(await isServerReady())) {
      serverProcess.kill("SIGTERM");
      throw new Error(`Production server nije dostupan na ${baseUrl.origin}.`);
    }
  }
  try {
    return await callback();
  } finally {
    serverProcess?.kill("SIGTERM");
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const resolved = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(resolved) : [resolved];
    }),
  );
  return nested.flat();
}

async function validate() {
  const failures = [];
  const warnings = [];
  const pass = [];
  const fail = (code, route, message) => failures.push({ code, route, message });
  const warn = (code, route, message) => warnings.push({ code, route, message });

  const sitemapResponse = await fetchLocal("/sitemap.xml");
  const sitemapXml = await sitemapResponse.text();
  if (sitemapResponse.status !== 200) {
    fail("sitemap-status", "/sitemap.xml", `HTTP ${sitemapResponse.status}`);
  }
  const sitemapUrls = [
    ...sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi),
  ].map((match) => decodeEntities(match[1]).trim());
  const sitemapPaths = sitemapUrls.map((value) => {
    const url = new URL(value);
    if (url.origin !== canonicalOrigin) {
      fail("sitemap-origin", url.pathname, `Pogrešan origin: ${url.origin}`);
    }
    return `${url.pathname}${url.search}`;
  });
  if (new Set(sitemapUrls).size !== sitemapUrls.length) {
    fail("duplicate-sitemap-url", "/sitemap.xml", "Sitemap sadrži duplikate.");
  }
  /** Putanje iz sitemapa, za provere indeksabilnosti odredišta preusmerenja. */
  const sitemapPathSet = new Set(sitemapPaths);

  const pages = await mapConcurrent(sitemapPaths, concurrency, async (route) => {
    const response = await fetchLocal(route);
    const html = await response.text();
    let jsonLd = [];
    try {
      jsonLd = getJsonLd(html);
    } catch (error) {
      fail(
        "invalid-json-ld",
        route,
        error instanceof Error ? error.message : String(error),
      );
    }
    const title = stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const description = getMeta(html, "name", "description");
    const robots = getMeta(html, "name", "robots").toLowerCase();
    const canonical = getCanonical(html);
    const h1Count = (html.match(/<h1\b/gi) ?? []).length;
    const ogImage = getMeta(html, "property", "og:image");
    const types = [...collectTypes(jsonLd)];
    const internalProductLinks = [
      ...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi),
    ]
      .map((match) => decodeEntities(match[1]))
      .filter((href) => href.startsWith("/proizvodi/"));

    if (response.status !== 200) {
      fail("sitemap-url-status", route, `HTTP ${response.status}`);
    }
    if (/noindex/.test(robots)) {
      fail("noindex-in-sitemap", route, robots);
    }
    if (!title) fail("missing-title", route, "Nedostaje title.");
    if (!description) fail("missing-description", route, "Nedostaje description.");
    if (!canonical) {
      fail("missing-canonical", route, "Nedostaje canonical.");
    } else {
      const canonicalUrl = new URL(canonical);
      const expected = `${canonicalOrigin}${new URL(route, canonicalOrigin).pathname}`;
      if (canonicalUrl.toString().replace(/\/$/, "") !== expected.replace(/\/$/, "")) {
        fail("wrong-canonical", route, `${canonical} != ${expected}`);
      }
    }
    if (h1Count !== 1) {
      fail("invalid-h1-count", route, `Pronađeno H1: ${h1Count}`);
    }
    if (!ogImage) fail("missing-og-image", route, "Nedostaje og:image.");
    if (!types.length) fail("missing-json-ld", route, "Nedostaje JSON-LD.");
    if (
      route.startsWith("/proizvodi/") &&
      (!types.includes("Product") || !types.includes("BreadcrumbList"))
    ) {
      fail("product-schema", route, `Tipovi: ${types.join(", ")}`);
    }
    if (
      ["/brendovi/", "/program/", "/kategorije/"].some((prefix) =>
        route.startsWith(prefix),
      ) &&
      !types.includes("BreadcrumbList")
    ) {
      fail("missing-breadcrumb-schema", route, "Nedostaje BreadcrumbList.");
    }
    if (containsForbiddenProductCommercialData(jsonLd)) {
      fail(
        "invented-product-commercial-data",
        route,
        "Product JSON-LD sadrži Offer/cenu/lager/recenziju.",
      );
    }

    return {
      route,
      response,
      html,
      title,
      description,
      canonical,
      ogImage,
      jsonLd,
      types,
      internalProductLinks,
    };
  });

  const productPages = pages.filter((page) => page.route.startsWith("/proizvodi/"));
  const productCanonicals = productPages.map((page) => page.canonical);
  if (new Set(productCanonicals).size !== productCanonicals.length) {
    fail(
      "duplicate-product-canonical",
      "/proizvodi",
      "Različiti PDP URL-ovi dele canonical.",
    );
  }
  const productSlugs = productPages.map((page) => page.route);
  if (new Set(productSlugs).size !== productSlugs.length) {
    fail("duplicate-product-slug", "/proizvodi", "Duplirani product slug.");
  }

  // A product link is valid when it resolves, not when it appears in the
  // sitemap. Since the ProductGroup consolidation, variant pages are
  // deliberately excluded from the sitemap while remaining fully crawlable and
  // linked, so sitemap membership is no longer the right test.
  const sitemapProductSet = new Set(productSlugs);
  const linkedProductPaths = new Set();
  for (const page of pages) {
    for (const href of page.internalProductLinks) {
      linkedProductPaths.add(new URL(href, canonicalOrigin).pathname);
    }
  }

  const offSitemapLinks = [...linkedProductPaths].filter(
    (pathname) => !sitemapProductSet.has(pathname),
  );

  /*
   * Kvalitet internog linkovanja.
   *
   * Link na varijantu koja preusmerava nije kvar, ali jeste nepotreban skok —
   * i, dok ga je katalog masovno pravio, razlog zašto 31 od 48 ProductGroup
   * stranica nije imala nijedan direktan link. Kanonski entitet mora biti i
   * ono na šta se linkuje.
   */
  for (const pathname of linkedProductPaths) {
    const target = expectedRedirect.get(pathname);
    if (!target) continue;
    fail(
      "internal-link-to-redirecting-variant",
      pathname,
      `Interni link vodi na varijantu koja preusmerava; linkujte ${target.split("?")[0]}.`,
    );
  }

  /*
   * Politika preusmerenja se proverava nad REGISTROM, ne nad linkovima.
   *
   * Pošto katalog više ne linkuje varijante koje preusmeravaju, provera vezana
   * za linkove nikada se ne bi izvršila — a upravo ta preusmerenja moraju
   * ostati ispravna. Zato se prolazi kroz svih registrovanih 808 ruta.
   */
  const groupDestinationCache = new Map();
  async function groupDestination(pathname) {
    if (!groupDestinationCache.has(pathname)) {
      groupDestinationCache.set(
        pathname,
        (async () => {
          const response = await fetchLocal(pathname, { redirect: "manual" });
          const html = response.status === 200 ? await response.text() : "";
          return { status: response.status, canonical: getCanonical(html) ?? "" };
        })(),
      );
    }
    return groupDestinationCache.get(pathname);
  }

  await mapConcurrent([...expectedRedirect.keys()], concurrency, async (pathname) => {
    const expected = expectedRedirect.get(pathname);
    const hop = await fetchLocal(pathname, { redirect: "manual" });
    if (hop.status !== 307 && hop.status !== 308) {
      fail(
        "consolidated-variant-not-redirecting",
        pathname,
        `Registrovana varijanta vraća HTTP ${hop.status} umesto preusmerenja.`,
      );
      return;
    }
    const location = hop.headers.get("location") ?? "";
    const actual = new URL(location, canonicalOrigin);
    if (`${actual.pathname}${actual.search}` !== expected) {
      fail(
        "variant-redirect-wrong-destination",
        pathname,
        `Preusmerenje vodi na ${actual.pathname}${actual.search}, očekivano ${expected}.`,
      );
      return;
    }
    const destination = await groupDestination(actual.pathname);
    if (destination.status !== 200) {
      fail(
        "variant-redirect-chain",
        pathname,
        `Odredište ${actual.pathname} vraća HTTP ${destination.status} — preusmerenje nije jednohopno.`,
      );
      return;
    }
    if (destination.canonical !== `${canonicalOrigin}${actual.pathname}`) {
      fail(
        "variant-redirect-destination-not-canonical",
        pathname,
        `Odredište ${actual.pathname} nije self-canonical (${destination.canonical}).`,
      );
      return;
    }
    if (!sitemapPathSet.has(actual.pathname)) {
      fail(
        "variant-redirect-destination-not-indexable",
        pathname,
        `Odredište ${actual.pathname} nije u sitemapu.`,
      );
    }
    if (sitemapProductSet.has(pathname)) {
      fail("consolidated-variant-in-sitemap", pathname, "Varijanta koja preusmerava je u sitemapu.");
    }
  });
  pass.push(
    `${expectedRedirect.size} konsolidovanih varijanti preusmerava jednim skokom na svoju ProductGroup rutu, koja je self-canonical i u sitemapu.`,
  );

  await mapConcurrent(offSitemapLinks, concurrency, async (pathname) => {
    const response = await fetchLocal(pathname);
    if (response.status !== 200) {
      fail("broken-internal-product-link", pathname, `HTTP ${response.status}`);
      return;
    }
    // Anything linked but off-sitemap must be a consolidated variant, i.e. it
    // must canonicalise to a family page. A 200 page that is neither in the
    // sitemap nor consolidated would be an orphaned indexable duplicate.
    const html = await response.text();
    const canonical = getCanonical(html) ?? "";
    if (!canonical.includes("/proizvodi/grupa/")) {
      fail(
        "off-sitemap-product-without-group-canonical",
        pathname,
        `Nije u sitemapu, a canonical nije grupa: ${canonical || "nedostaje"}`,
      );
    }
  });

  const consolidatedVariantCount = offSitemapLinks.length;

  const ogImages = [...new Set(pages.map((page) => page.ogImage).filter(Boolean))];
  await mapConcurrent(ogImages, concurrency, async (image) => {
    const imageUrl = new URL(image);
    const response = await fetchLocal(`${imageUrl.pathname}${imageUrl.search}`);
    if (response.status !== 200) {
      fail("broken-og-image", imageUrl.pathname, `HTTP ${response.status}`);
    }
  });

  const appPaths = JSON.parse(
    await readFile(
      path.join(projectRoot, ".next/server/app-paths-manifest.json"),
      "utf8",
    ),
  );
  const noindexRoutes = Object.keys(appPaths)
    .filter(
      (route) =>
        route.endsWith("/page") &&
        !route.includes("[") &&
        (route.startsWith("/interaction-demo/") ||
          route.startsWith("/social-exports/") ||
          route.startsWith("/site-u-pripremi/")),
    )
    .map((route) => route.replace(/\/page$/, ""));
  noindexRoutes.push("/preview");
  await mapConcurrent(noindexRoutes, concurrency, async (route) => {
    const response = await fetchLocal(route);
    if (response.status >= 300 && response.status < 400) return;
    const html = await response.text();
    const robots = [
      getMeta(html, "name", "robots"),
      response.headers.get("x-robots-tag") ?? "",
    ]
      .filter(Boolean)
      .join(", ")
      .toLowerCase();
    if (response.status === 200 && !robots.includes("noindex")) {
      fail("indexable-preview-demo", route, robots || "robots metadata nedostaje");
    }
  });

  const noindexQueryRoutes = [
    "/katalog?q=lak",
    "/katalog?sort=naziv",
    "/katalog?brend=rm",
    "/katalog?page=2",
    "/kontakt?tema=proizvod",
  ];
  await mapConcurrent(noindexQueryRoutes, concurrency, async (route) => {
    const response = await fetchLocal(route);
    const html = await response.text();
    const robots = [
      getMeta(html, "name", "robots"),
      response.headers.get("x-robots-tag") ?? "",
    ]
      .filter(Boolean)
      .join(", ")
      .toLowerCase();
    const canonical = getCanonical(html);
    const expectedCanonical = `${canonicalOrigin}${new URL(route, canonicalOrigin).pathname}`;
    if (response.status !== 200 || !robots.includes("noindex")) {
      fail("indexable-query-url", route, robots || `HTTP ${response.status}`);
    }
    if (canonical !== expectedCanonical) {
      fail("query-canonical", route, `${canonical} != ${expectedCanonical}`);
    }
  });

  const robotsResponse = await fetchLocal("/robots.txt");
  const robotsText = await robotsResponse.text();
  if (
    robotsResponse.status !== 200 ||
    !robotsText.includes(`${canonicalOrigin}/sitemap.xml`) ||
    !robotsText.includes("Allow: /")
  ) {
    fail("robots", "/robots.txt", robotsText);
  }

  const missingResponse = await fetchLocal("/seo-validator-missing-route");
  const missingHtml = await missingResponse.text();
  if (missingResponse.status !== 404) {
    fail("not-found-status", "/seo-validator-missing-route", `HTTP ${missingResponse.status}`);
  }
  if (!getMeta(missingHtml, "name", "robots").toLowerCase().includes("noindex")) {
    fail("not-found-indexable", "/seo-validator-missing-route", "404 nema noindex.");
  }

  const redirectResponse = await fetchLocal(
    "/proizvodi/clear-harden-r-h-2p15",
  );
  const redirectLocation = redirectResponse.headers.get("location") ?? "";
  if (
    ![307, 308].includes(redirectResponse.status) ||
    !redirectLocation.endsWith("/proizvodi/h-2p15-clear-harden-r")
  ) {
    fail(
      "h2p15-redirect",
      "/proizvodi/clear-harden-r-h-2p15",
      `HTTP ${redirectResponse.status}, Location ${redirectLocation}`,
    );
  }

  const rmData = JSON.parse(
    await readFile(
      path.join(projectRoot, "data/rm-imported-products.generated.json"),
      "utf8",
    ),
  );
  if (rmData.products.length !== 59) {
    fail("rm-product-count", "/proizvodi", `Pronađeno ${rmData.products.length}.`);
  }
  for (const product of rmData.products) {
    const route = `/proizvodi/${product.slug}`;
    const page = pages.find((item) => item.route === route);
    if (!page) {
      fail("rm-product-missing", route, "R-M PDP nije u sitemapu.");
      continue;
    }
    if (!page.title.includes(product.productCode)) {
      fail("rm-product-title-code", route, page.title);
    }
    const serialized = JSON.stringify(page.jsonLd);
    if (
      !serialized.includes(product.canonicalName) ||
      !serialized.includes('"name":"R-M"')
    ) {
      fail("rm-product-schema-content", route, "Naziv ili R-M brand nije tačan.");
    }
    const expectedOgPath = `/images/og/products/rm/${product.slug}.jpg`;
    if (new URL(page.ogImage).pathname !== expectedOgPath) {
      fail("rm-product-og", route, page.ogImage);
    }
    for (const documentPath of [
      product.documents.productInformation,
      product.documents.technicalDataSheet,
    ].filter(Boolean)) {
      const response = await fetchLocal(documentPath);
      if (response.status !== 200) {
        fail("broken-pdf", route, `${documentPath}: HTTP ${response.status}`);
      }
      const robotsHeader = response.headers.get("x-robots-tag") ?? "";
      if (!robotsHeader.toLowerCase().includes("noindex")) {
        fail("pdf-indexable", documentPath, "X-Robots-Tag noindex nedostaje.");
      }
    }
  }

  const pdfFiles = (await listFiles(path.join(projectRoot, "public/documents/products/rm")))
    .filter((file) => file.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length !== 117) {
    warn("pdf-count", "/documents/products/rm", `Pronađeno ${pdfFiles.length}, očekivano 117.`);
  }

  const requiredRoutes = [
    "/",
    "/katalog",
    "/brendovi/rm",
    "/brendovi/baslac",
    "/proizvodi/c-2p42-race-finish-r",
    "/proizvodi/2220-agilis-activator",
    "/proizvodi/p-2p81-race-wet-fill-r-white",
    "/proizvodi/b-2p93-uv-bodyfill-r",
    "/prodavnice",
    "/kontakt",
  ];
  for (const route of requiredRoutes) {
    if (!pages.some((page) => page.route === route)) {
      fail("required-route", route, "Ruta nije u sitemapu.");
    }
  }

  if (!failures.length) {
    pass.push(
      `${sitemapUrls.length} sitemap URL-ova vraća 200, ima produkcioni canonical, title, description, H1 i OG sliku.`,
      `${productPages.length} PDP stranica ima jedinstven canonical i Product JSON-LD bez Offer/cene/lagera.`,
      "Svih 59 R-M PDP stranica ima kod u title-u, R-M schema podatke, BreadcrumbList i zasebnu OG sliku.",
      `${pdfFiles.length} lokalnih R-M PDF dokumenata je dostupno uz X-Robots-Tag noindex.`,
      `${consolidatedVariantCount} povezanih varijanti van sitemapa vraća 200 i canonical na stranicu grupe.`,
    );
  }

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.origin,
    canonicalOrigin,
    summary: {
      sitemapUrls: sitemapUrls.length,
      productPages: productPages.length,
      rmProducts: rmData.products.length,
      pdfFiles: pdfFiles.length,
      failures: failures.length,
      warnings: warnings.length,
    },
    pass,
    failures,
    warnings,
  };
  await mkdir(path.join(projectRoot, "docs/seo"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "docs/seo/SEO_VALIDATION.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

withServer(validate).catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
