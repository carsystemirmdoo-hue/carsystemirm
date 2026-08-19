#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

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
  args.get("canonical-host") ?? process.env.NEXT_PUBLIC_SITE_URL ?? baseUrl.origin,
).origin;
const label = args.get("label") === "after" ? "after" : "before";
const outputDirectory = path.resolve(
  projectRoot,
  args.get("output-dir") ?? "docs/seo",
);
const concurrency = Math.max(1, Number(args.get("concurrency") ?? 24));
const includeFilterSamples = args.get("filter-samples") !== "false";

const decodeEntities = (value = "") =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const stripTags = (value = "") =>
  decodeEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

const getAttribute = (tag, name) => {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i"),
  );
  return decodeEntities(match?.[1] ?? match?.[2] ?? "");
};

const hasAttribute = (tag, name) =>
  new RegExp(`\\s${name}(?:\\s*=|\\s|\\/?>)`, "i").test(tag);

const getMeta = (html, attribute, value) => {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find(
    (item) => getAttribute(item, attribute).toLowerCase() === value.toLowerCase(),
  );
  return tag ? getAttribute(tag, "content") : "";
};

const getLink = (html, rel) => {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = tags.find((item) =>
    getAttribute(item, "rel")
      .toLowerCase()
      .split(/\s+/)
      .includes(rel.toLowerCase()),
  );
  return tag ? getAttribute(tag, "href") : "";
};

const csvCell = (value) => {
  if (value === null || value === undefined) return "";
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
};

const toCsv = (rows, columns) => {
  const header = columns.map(([labelValue]) => csvCell(labelValue)).join(",");
  const lines = rows.map((row) =>
    columns.map(([, getter]) => csvCell(getter(row))).join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
};

const normalizePath = (pathname) => {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
};

const pathWithSearch = (url) => `${normalizePath(url.pathname)}${url.search}`;

function classifyRoute(route) {
  const pathname = new URL(route, baseUrl).pathname;
  if (pathname === "/") return { type: "home", expectedIndex: true };
  if (pathname === "/katalog") {
    return {
      type: new URL(route, baseUrl).search ? "filtered-catalog" : "catalog",
      expectedIndex: !new URL(route, baseUrl).search,
    };
  }
  if (pathname.startsWith("/katalog/strana/")) {
    return { type: "catalog", expectedIndex: true };
  }
  if (pathname.startsWith("/kategorije/")) {
    return { type: "category", expectedIndex: true };
  }
  if (pathname === "/brendovi") return { type: "brand", expectedIndex: true };
  if (pathname.startsWith("/brendovi/")) return { type: "brand", expectedIndex: true };
  if (pathname === "/program") return { type: "program", expectedIndex: true };
  if (pathname.startsWith("/program/")) return { type: "program", expectedIndex: true };
  if (pathname.startsWith("/proizvodi/")) return { type: "product", expectedIndex: true };
  if (pathname === "/prodavnice") return { type: "store", expectedIndex: true };
  if (pathname === "/kontakt") return { type: "contact", expectedIndex: true };
  if (pathname.startsWith("/preview")) return { type: "preview", expectedIndex: false };
  if (pathname.startsWith("/interaction-demo")) return { type: "demo", expectedIndex: false };
  if (pathname.startsWith("/social-exports")) return { type: "demo", expectedIndex: false };
  if (pathname.startsWith("/site-u-pripremi")) return { type: "draft", expectedIndex: false };
  if (pathname.startsWith("/seo-audit-missing")) {
    return { type: "not-found", expectedIndex: false };
  }
  return { type: "legal", expectedIndex: true };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
}

async function discoverRoutes() {
  const routes = new Set();
  const prerenderManifest = await readJson(".next/prerender-manifest.json");
  for (const route of Object.keys(prerenderManifest.routes ?? {})) {
    if (
      route === "/robots.txt" ||
      route === "/sitemap.xml" ||
      route === "/favicon.ico" ||
      route === "/_not-found"
    ) {
      continue;
    }
    routes.add(normalizePath(route));
  }

  const appPaths = await readJson(".next/server/app-paths-manifest.json");
  for (const appPath of Object.keys(appPaths)) {
    if (!appPath.endsWith("/page") || appPath.includes("[") || appPath === "/_not-found/page") {
      continue;
    }
    const route = appPath === "/page" ? "/" : appPath.replace(/\/page$/, "");
    routes.add(normalizePath(route));
  }

  routes.add("/preview");
  routes.add("/preview/seo-audit");
  routes.add("/seo-audit-missing-route");

  if (includeFilterSamples) {
    routes.add("/katalog?q=lak");
    routes.add("/katalog?sort=naziv");
    routes.add("/katalog?brend=rm");
    routes.add("/katalog?page=2");
  }

  return [...routes].sort((left, right) => left.localeCompare(right, "sr"));
}

async function mapConcurrent(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await callback(items[current], current);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function fetchPage(route) {
  const requestedUrl = new URL(route, baseUrl);
  let response;
  try {
    response = await fetch(requestedUrl, {
      redirect: "manual",
      headers: { "user-agent": "CarsystemSeoAudit/1.0" },
    });
  } catch (error) {
    return {
      route,
      requestedUrl: requestedUrl.toString(),
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const redirectLocation = response.headers.get("location") ?? "";
  const html = contentType.includes("text/html") ? await response.text() : "";
  const headHtml = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const title = stripTags(
    headHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  );
  const description = getMeta(headHtml, "name", "description");
  const robots = [
    getMeta(headHtml, "name", "robots"),
    response.headers.get("x-robots-tag") ?? "",
  ]
    .filter(Boolean)
    .join(", ")
    .toLowerCase();
  const canonical = getLink(headHtml, "canonical");
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const headings = [...html.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(
    (match) => ({
      level: Number(match[1].slice(1)),
      text: stripTags(match[2]),
    }),
  );
  const anchors = (html.match(/<a\b[^>]*>/gi) ?? []).map((tag) => ({
    href: getAttribute(tag, "href"),
    text: stripTags(
      html.match(
        new RegExp(
          `${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)<\\/a>`,
          "i",
        ),
      )?.[1] ?? "",
    ),
  }));
  const images = (html.match(/<img\b[^>]*>/gi) ?? []).map((tag) => ({
    src: getAttribute(tag, "src"),
    alt: getAttribute(tag, "alt"),
    altPresent: hasAttribute(tag, "alt"),
    width: getAttribute(tag, "width"),
    height: getAttribute(tag, "height"),
    nextImageMode: getAttribute(tag, "data-nimg"),
    loading: getAttribute(tag, "loading"),
    fetchPriority: getAttribute(tag, "fetchpriority"),
  }));

  const jsonLdBlocks = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => decodeEntities(match[1]).trim());
  const jsonLd = [];
  const invalidJsonLd = [];
  for (const block of jsonLdBlocks) {
    try {
      jsonLd.push(JSON.parse(block));
    } catch (error) {
      invalidJsonLd.push(error instanceof Error ? error.message : String(error));
    }
  }
  const jsonLdTypes = new Set();
  const collectTypes = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(collectTypes);
      return;
    }
    if (typeof node["@type"] === "string") jsonLdTypes.add(node["@type"]);
    if (Array.isArray(node["@type"])) node["@type"].forEach((type) => jsonLdTypes.add(type));
    Object.values(node).forEach(collectTypes);
  };
  jsonLd.forEach(collectTypes);

  const internalLinks = [];
  const externalLinks = [];
  for (const anchor of anchors) {
    if (!anchor.href || /^(?:#|mailto:|tel:|javascript:)/i.test(anchor.href)) continue;
    try {
      const resolved = new URL(anchor.href, requestedUrl);
      if (resolved.origin === requestedUrl.origin || resolved.origin === canonicalOrigin) {
        internalLinks.push({
          href: pathWithSearch(resolved),
          text: anchor.text,
        });
      } else if (/^https?:$/.test(resolved.protocol)) {
        externalLinks.push(resolved.toString());
      }
    } catch {
      internalLinks.push({ href: anchor.href, text: anchor.text });
    }
  }

  const { type, expectedIndex } = classifyRoute(route);
  const isHtml = contentType.includes("text/html");
  const noindex = /(?:^|,|\s)noindex(?:$|,|\s)/i.test(robots);
  const indexable = response.status >= 200 && response.status < 300 && isHtml && !noindex;
  const expectedCanonical = `${canonicalOrigin}${normalizePath(requestedUrl.pathname)}`;
  let canonicalCorrect = false;
  let canonicalConsolidated = false;
  if (canonical) {
    try {
      const canonicalUrl = new URL(canonical, canonicalOrigin);
      const sameOrigin = canonicalUrl.origin === canonicalOrigin;
      const selfReferencing =
        normalizePath(canonicalUrl.pathname) === normalizePath(requestedUrl.pathname);
      // A product variant intentionally canonicalises to its ProductGroup page.
      // That is a correct consolidation, not a canonical error, so it is
      // tracked separately rather than counted as `wrongCanonical`.
      canonicalConsolidated =
        sameOrigin &&
        !selfReferencing &&
        requestedUrl.pathname.startsWith("/proizvodi/") &&
        canonicalUrl.pathname.startsWith("/proizvodi/grupa/");
      canonicalCorrect =
        sameOrigin &&
        canonicalUrl.search === "" &&
        (selfReferencing || canonicalConsolidated);
    } catch {
      canonicalCorrect = false;
    }
  }

  return {
    route,
    type,
    expectedIndex,
    requestedUrl: requestedUrl.toString(),
    status: response.status,
    redirectLocation,
    contentType,
    indexable,
    robots,
    title,
    titleLength: [...title].length,
    description,
    descriptionLength: [...description].length,
    canonical,
    expectedCanonical,
    canonicalCorrect,
    canonicalConsolidated,
    canonicalStatus: null,
    lang: getAttribute(htmlTag, "lang"),
    h1: headings.filter((heading) => heading.level === 1).map((heading) => heading.text),
    h1Count: headings.filter((heading) => heading.level === 1).length,
    headings,
    ogTitle: getMeta(headHtml, "property", "og:title"),
    ogDescription: getMeta(headHtml, "property", "og:description"),
    ogImage: getMeta(headHtml, "property", "og:image"),
    twitterCard: getMeta(headHtml, "name", "twitter:card"),
    twitterTitle: getMeta(headHtml, "name", "twitter:title"),
    twitterDescription: getMeta(headHtml, "name", "twitter:description"),
    twitterImage: getMeta(headHtml, "name", "twitter:image"),
    jsonLdTypes: [...jsonLdTypes].sort(),
    jsonLd,
    invalidJsonLd,
    hasBreadcrumb: jsonLdTypes.has("BreadcrumbList"),
    internalLinks,
    externalLinks,
    images,
    imagesMissingAlt: images.filter((image) => !image.altPresent).length,
    imagesEmptyAlt: images.filter((image) => image.altPresent && image.alt === "").length,
    imagesMissingDimensions: images.filter(
      (image) =>
        (!image.width || !image.height) && image.nextImageMode !== "fill",
    ).length,
    brokenLinks: [],
    orphan: false,
    inSitemap: false,
    error: "",
  };
}

function titleDuplicates(pages) {
  const counts = new Map();
  for (const page of pages.filter((item) => item.indexable && item.title)) {
    counts.set(page.title, (counts.get(page.title) ?? 0) + 1);
  }
  return counts;
}

function descriptionDuplicates(pages) {
  const counts = new Map();
  for (const page of pages.filter((item) => item.indexable && item.description)) {
    counts.set(page.description, (counts.get(page.description) ?? 0) + 1);
  }
  return counts;
}

async function main() {
  const routes = await discoverRoutes();
  const pages = await mapConcurrent(routes, concurrency, fetchPage);

  const sitemapResponse = await fetch(new URL("/sitemap.xml", baseUrl));
  const sitemapXml = sitemapResponse.ok ? await sitemapResponse.text() : "";
  const sitemapUrls = [
    ...sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi),
  ].map((match) => decodeEntities(match[1]).trim());
  const sitemapPaths = new Set(
    sitemapUrls.map((url) => {
      try {
        return normalizePath(new URL(url).pathname);
      } catch {
        return "";
      }
    }),
  );

  const internalTargets = new Set();
  for (const page of pages) {
    for (const link of page.internalLinks ?? []) {
      const target = new URL(link.href, baseUrl);
      if (
        !target.pathname.startsWith("/_next/") &&
        !/\.(?:avif|css|gif|ico|jpe?g|js|map|pdf|png|svg|txt|webp|xml)$/i.test(
          target.pathname,
        )
      ) {
        internalTargets.add(pathWithSearch(target));
      }
    }
  }
  const targetStatuses = new Map();
  await mapConcurrent([...internalTargets], concurrency, async (target) => {
    try {
      const response = await fetch(new URL(target, baseUrl), {
        redirect: "manual",
        headers: { "user-agent": "CarsystemSeoAudit/1.0" },
      });
      targetStatuses.set(target, response.status);
    } catch {
      targetStatuses.set(target, 0);
    }
  });

  const canonicalTargets = new Set(
    pages.filter((page) => page.canonical).map((page) => {
      try {
        const value = new URL(page.canonical);
        return normalizePath(value.pathname);
      } catch {
        return "";
      }
    }),
  );
  const canonicalStatuses = new Map();
  await mapConcurrent([...canonicalTargets], concurrency, async (target) => {
    if (!target) return;
    try {
      const response = await fetch(new URL(target, baseUrl), {
        redirect: "manual",
        headers: { "user-agent": "CarsystemSeoAudit/1.0" },
      });
      canonicalStatuses.set(target, response.status);
    } catch {
      canonicalStatuses.set(target, 0);
    }
  });

  const inbound = new Map();
  for (const page of pages.filter((item) => item.indexable)) {
    for (const link of page.internalLinks) {
      const target = normalizePath(new URL(link.href, baseUrl).pathname);
      inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }

  for (const page of pages) {
    const pageUrl = new URL(page.route, baseUrl);
    const pathname = normalizePath(pageUrl.pathname);
    page.inSitemap = !pageUrl.search && sitemapPaths.has(pathname);
    page.orphan =
      page.indexable && pathname !== "/" && (inbound.get(pathname) ?? 0) === 0;
    page.brokenLinks = page.internalLinks
      .filter((link) => {
        const status = targetStatuses.get(pathWithSearch(new URL(link.href, baseUrl)));
        return status === 0 || status >= 400;
      })
      .map((link) => link.href);
    page.canonicalStatus = page.canonical
      ? canonicalStatuses.get(normalizePath(new URL(page.canonical).pathname)) ?? 0
      : null;
  }

  const imageTargets = new Set(
    pages.flatMap((page) =>
      [
        ...(page.images ?? []).map((image) => image.src),
        page.ogImage,
        page.twitterImage,
      ].filter(Boolean),
    ),
  );
  const imageStatuses = new Map();
  await mapConcurrent([...imageTargets], concurrency, async (target) => {
    try {
      const response = await fetch(new URL(target, baseUrl), {
        redirect: "manual",
        headers: { "user-agent": "CarsystemSeoAudit/1.0" },
      });
      imageStatuses.set(target, response.status);
    } catch {
      imageStatuses.set(target, 0);
    }
  });

  const duplicateTitles = titleDuplicates(pages);
  const duplicateDescriptions = descriptionDuplicates(pages);
  for (const page of pages) {
    page.titleDuplicateCount = duplicateTitles.get(page.title) ?? 0;
    page.descriptionDuplicateCount = duplicateDescriptions.get(page.description) ?? 0;
  }

  const htmlPages = pages.filter((page) => page.contentType?.includes("text/html"));
  const indexablePages = htmlPages.filter((page) => page.indexable);
  const issues = [];
  const addIssue = (page, code, severity, message) => {
    issues.push({ route: page.route, code, severity, message });
  };
  for (const page of pages) {
    if (page.expectedIndex && page.indexable && !page.title) {
      addIssue(page, "missing-title", "critical", "Indeksabilna stranica nema title.");
    }
    if (page.expectedIndex && page.indexable && !page.description) {
      addIssue(
        page,
        "missing-description",
        "critical",
        "Indeksabilna stranica nema meta description.",
      );
    }
    if (page.expectedIndex && page.indexable && !page.canonical) {
      addIssue(page, "missing-canonical", "critical", "Indeksabilna stranica nema canonical.");
    }
    if (page.expectedIndex && page.indexable && page.canonical && !page.canonicalCorrect) {
      addIssue(
        page,
        "wrong-canonical",
        "critical",
        `Canonical nije produkcioni self-reference: ${page.canonical}`,
      );
    }
    if (page.expectedIndex && page.indexable && page.h1Count === 0) {
      addIssue(page, "missing-h1", "critical", "Indeksabilna stranica nema H1.");
    }
    if (page.h1Count > 1) {
      addIssue(page, "multiple-h1", "warning", `Stranica ima ${page.h1Count} H1 elemenata.`);
    }
    if (!page.expectedIndex && page.indexable) {
      addIssue(
        page,
        "unexpected-indexable",
        "critical",
        "Preview, demo, draft ili filter URL je indeksabilan.",
      );
    }
    if (page.expectedIndex && !page.indexable) {
      addIssue(page, "unexpected-noindex", "critical", "Produkcioni URL nije indeksabilan.");
    }
    if (page.invalidJsonLd?.length) {
      addIssue(page, "invalid-json-ld", "critical", page.invalidJsonLd.join("; "));
    }
    if (page.brokenLinks?.length) {
      addIssue(
        page,
        "broken-internal-links",
        "critical",
        `Broken interni linkovi: ${[...new Set(page.brokenLinks)].join(", ")}`,
      );
    }
  }

  const uniqueBrokenLinks = new Set(pages.flatMap((page) => page.brokenLinks ?? []));
  const summary = {
    auditedRoutes: pages.length,
    htmlPages: htmlPages.length,
    indexable: indexablePages.length,
    noindex: htmlPages.filter(
      (page) => page.status >= 200 && page.status < 300 && !page.indexable,
    ).length,
    redirects: pages.filter((page) => page.status >= 300 && page.status < 400).length,
    missingTitle: indexablePages.filter((page) => !page.title).length,
    duplicateTitlePages: indexablePages.filter((page) => page.titleDuplicateCount > 1).length,
    missingDescription: indexablePages.filter((page) => !page.description).length,
    duplicateDescriptionPages: indexablePages.filter(
      (page) => page.descriptionDuplicateCount > 1,
    ).length,
    missingCanonical: indexablePages.filter((page) => !page.canonical).length,
    wrongCanonical: indexablePages.filter(
      (page) => page.canonical && !page.canonicalCorrect,
    ).length,
    consolidatedVariantCanonicals: indexablePages.filter(
      (page) => page.canonicalConsolidated,
    ).length,
    missingH1: indexablePages.filter((page) => page.h1Count === 0).length,
    multipleH1: indexablePages.filter((page) => page.h1Count > 1).length,
    missingOgImage: indexablePages.filter((page) => !page.ogImage).length,
    missingStructuredData: indexablePages.filter(
      (page) => page.jsonLdTypes.length === 0,
    ).length,
    pagesWithBrokenLinks: pages.filter((page) => page.brokenLinks?.length).length,
    uniqueBrokenLinks: uniqueBrokenLinks.size,
    orphanPages: indexablePages.filter((page) => page.orphan).length,
    imagesMissingAlt: htmlPages.reduce((sum, page) => sum + page.imagesMissingAlt, 0),
    imagesEmptyAlt: htmlPages.reduce((sum, page) => sum + page.imagesEmptyAlt, 0),
    imagesMissingDimensions: htmlPages.reduce(
      (sum, page) => sum + page.imagesMissingDimensions,
      0,
    ),
    indexableFilterSamples: pages.filter(
      (page) => page.type === "filtered-catalog" && page.indexable,
    ).length,
    indexablePreviewDemo: pages.filter(
      (page) =>
        ["preview", "demo", "draft"].includes(page.type) && page.indexable,
    ).length,
    noindexUrlsInSitemap: pages.filter((page) => page.inSitemap && !page.indexable)
      .length,
    sitemapUrls: sitemapUrls.length,
    productPagesWithoutProductSchema: pages.filter(
      (page) =>
        page.type === "product" &&
        page.indexable &&
        !page.jsonLdTypes.includes("Product"),
    ).length,
    pagesWithoutBreadcrumbSchema: indexablePages.filter(
      (page) =>
        ["brand", "program", "product", "store", "contact"].includes(page.type) &&
        !page.hasBreadcrumb,
    ).length,
  };

  await mkdir(outputDirectory, { recursive: true });
  const suffix = label.toUpperCase();
  const metadataColumns = [
    ["URL", (row) => row.route],
    ["HTTP status", (row) => row.status],
    ["Indexable", (row) => row.indexable],
    ["Robots", (row) => row.robots],
    ["Title", (row) => row.title],
    ["Title length", (row) => row.titleLength],
    ["Title duplicate count", (row) => row.titleDuplicateCount],
    ["Description", (row) => row.description],
    ["Description length", (row) => row.descriptionLength],
    ["Description duplicate count", (row) => row.descriptionDuplicateCount],
    ["Canonical", (row) => row.canonical],
    ["Canonical status", (row) => row.canonicalStatus],
    ["Canonical correct", (row) => row.canonicalCorrect],
    ["H1", (row) => row.h1],
    ["H1 count", (row) => row.h1Count],
    ["Headings", (row) => row.headings?.map((item) => `H${item.level}:${item.text}`)],
    ["HTML lang", (row) => row.lang],
    ["OG title", (row) => row.ogTitle],
    ["OG description", (row) => row.ogDescription],
    ["OG image", (row) => row.ogImage],
    ["Twitter card", (row) => row.twitterCard],
    ["Twitter title", (row) => row.twitterTitle],
    ["Twitter description", (row) => row.twitterDescription],
    ["Twitter image", (row) => row.twitterImage],
    ["JSON-LD types", (row) => row.jsonLdTypes],
    ["Breadcrumb", (row) => row.hasBreadcrumb],
    ["Internal links", (row) => row.internalLinks?.length ?? 0],
    ["External links", (row) => row.externalLinks?.length ?? 0],
    ["Broken links", (row) => row.brokenLinks],
    ["Images", (row) => row.images?.length ?? 0],
    ["Images missing alt", (row) => row.imagesMissingAlt],
    ["Images missing dimensions", (row) => row.imagesMissingDimensions],
    ["In sitemap", (row) => row.inSitemap],
    ["Orphan", (row) => row.orphan],
  ];
  const routeColumns = [
    ["URL", (row) => row.route],
    ["Route type", (row) => row.type],
    ["Expected index", (row) => row.expectedIndex],
    ["Actual indexable", (row) => row.indexable],
    ["HTTP status", (row) => row.status],
    ["Canonical", (row) => row.canonical],
    ["In sitemap", (row) => row.inSitemap],
    ["Redirect", (row) => row.redirectLocation],
    ["Orphan", (row) => row.orphan],
  ];
  const imageRows = pages.flatMap((page) =>
    (page.images ?? []).map((image) => {
      const format = (() => {
        try {
          const imageUrl = new URL(image.src, baseUrl);
          if (imageUrl.pathname === "/_next/image") {
            return path.extname(imageUrl.searchParams.get("url") ?? "").slice(1);
          }
          return path.extname(imageUrl.pathname).slice(1);
        } catch {
          return "";
        }
      })();
      const status = imageStatuses.get(image.src) ?? 0;
      const recommendations = [
        !image.altPresent ? "Dodati alt atribut." : "",
        (!image.width || !image.height) && image.nextImageMode !== "fill"
          ? "Dodati stabilne dimenzije."
          : "",
        status >= 400 || status === 0 ? "Popraviti broken image URL." : "",
      ].filter(Boolean);
      return {
        route: page.route,
        ...image,
        format,
        status,
        recommendation:
          recommendations.join(" ") || "Bez automatski pronađene greške.",
      };
    }),
  );
  const imageColumns = [
    ["Ruta", (row) => row.route],
    ["Src", (row) => row.src],
    ["Alt", (row) => row.alt],
    ["Width", (row) => row.width],
    ["Height", (row) => row.height],
    ["Layout", (row) =>
      row.nextImageMode === "fill" ? "Next Image fill" : "Eksplicitne dimenzije"],
    ["Loading", (row) => row.loading],
    ["Priority", (row) => row.fetchPriority],
    ["Format", (row) => row.format],
    ["Status", (row) => row.status],
    ["Preporuka", (row) => row.recommendation],
  ];
  const canonicalColumns = [
    ["Source URL", (row) => row.route],
    ["Canonical URL", (row) => row.canonical],
    ["Index status", (row) => (row.indexable ? "index" : "noindex")],
    ["Redirect status", (row) => row.redirectLocation],
    [
      "Razlog",
      (row) =>
        row.canonicalCorrect
          ? "Produkcioni self-reference"
          : row.canonical
            ? "Canonical zahteva proveru"
            : "Noindex/redirect ili canonical nedostaje",
    ],
  ];

  const summaryRows = [
    ["Ukupno auditovanih URL-ova", summary.auditedRoutes],
    ["Pronađenih HTML stranica", summary.htmlPages],
    ["Indeksabilnih", summary.indexable],
    ["Noindex", summary.noindex],
    ["Redirect URL-ova", summary.redirects],
    ["Bez title-a", summary.missingTitle],
    ["Sa dupliranim title-om", summary.duplicateTitlePages],
    ["Bez meta description-a", summary.missingDescription],
    ["Sa dupliranim opisom", summary.duplicateDescriptionPages],
    ["Bez canonical-a", summary.missingCanonical],
    ["Sa pogrešnim canonical-om", summary.wrongCanonical],
    [
      "Varijanti konsolidovanih na grupu (namerno)",
      summary.consolidatedVariantCanonicals,
    ],
    ["Bez H1", summary.missingH1],
    ["Sa više H1", summary.multipleH1],
    ["Bez Open Graph slike", summary.missingOgImage],
    ["Bez structured data", summary.missingStructuredData],
    ["Sa broken linkovima", summary.pagesWithBrokenLinks],
    ["Jedinstvenih broken linkova", summary.uniqueBrokenLinks],
    ["Orphan stranica", summary.orphanPages],
    ["Slika bez alt teksta", summary.imagesMissingAlt],
    ["Slika sa praznim dekorativnim alt-om", summary.imagesEmptyAlt],
    ["Slika bez dimenzija", summary.imagesMissingDimensions],
    ["Indeksabilnih filter uzoraka", summary.indexableFilterSamples],
    ["Indeksabilnih preview/demo/draft ruta", summary.indexablePreviewDemo],
    ["Noindex URL-ova u sitemapu", summary.noindexUrlsInSitemap],
    ["URL-ova u sitemapu", summary.sitemapUrls],
    ["PDP bez Product schema", summary.productPagesWithoutProductSchema],
    ["Relevantnih stranica bez Breadcrumb schema", summary.pagesWithoutBreadcrumbSchema],
  ];
  const report = `# SEO audit ${suffix}

- Datum: ${new Date().toISOString()}
- Audit origin: \`${baseUrl.origin}\`
- Očekivani produkcioni canonical host: \`${canonicalOrigin}\`
- Izvor ruta: Next.js prerender i app-paths manifest, sitemap i kontrolni filter/preview/404 URL-ovi
- Napomena: filter metrika koristi četiri reprezentativna query URL-a, ne pokušava da generiše beskonačan skup kombinacija.

| Metrika | Broj |
| --- | ---: |
${summaryRows.map(([name, value]) => `| ${name} | ${value} |`).join("\n")}

## Najčešći kritični problemi

${Object.entries(
  issues
    .filter((issue) => issue.severity === "critical")
    .reduce((counts, issue) => {
      counts[issue.code] = (counts[issue.code] ?? 0) + 1;
      return counts;
    }, {}),
)
  .sort((left, right) => right[1] - left[1])
  .map(([code, count]) => `- \`${code}\`: ${count}`)
  .join("\n") || "- Nema kritičnih problema u obuhvatu audita."}
`;

  await Promise.all([
    writeFile(path.join(outputDirectory, `SEO_AUDIT_${suffix}.md`), report),
    writeFile(
      path.join(outputDirectory, `SEO_METADATA_${suffix}.csv`),
      toCsv(pages, metadataColumns),
    ),
    writeFile(
      path.join(outputDirectory, `SEO_ISSUES_${suffix}.json`),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, issues }, null, 2)}\n`,
    ),
    label === "before"
      ? writeFile(
          path.join(outputDirectory, "SEO_ROUTE_INVENTORY.csv"),
          toCsv(pages, routeColumns),
        )
      : Promise.resolve(),
    writeFile(
      path.join(outputDirectory, "SEO_IMAGE_AUDIT.csv"),
      toCsv(imageRows, imageColumns),
    ),
    writeFile(
      path.join(outputDirectory, "SEO_CANONICAL_MAP.csv"),
      toCsv(pages, canonicalColumns),
    ),
  ]);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function isServerReady() {
  try {
    const response = await fetch(baseUrl, { redirect: "manual" });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function runAudit() {
  let serverProcess;
  if (args.get("start-server") === "true" && !(await isServerReady())) {
    const port = baseUrl.port || (baseUrl.protocol === "https:" ? "443" : "80");
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
    await main();
  } finally {
    serverProcess?.kill("SIGTERM");
  }
}

runAudit().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
