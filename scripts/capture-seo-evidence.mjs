#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputDirectory = path.join(root, "docs/seo/evidence");
const baseUrl = new URL("http://localhost:3100");
const startServer = process.argv.includes("--start-server");
let server;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(new URL("/robots.txt", baseUrl));
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(250);
  }
  throw new Error("Production server nije dostupan na portu 3100.");
}

function extractHead(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  return `<!doctype html>\n<head>\n${head.replace(/></g, ">\n<")}\n</head>\n`;
}

function extractJsonLd(html) {
  return [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => JSON.parse(match[1]));
}

function containsType(node, expectedType) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((item) => containsType(item, expectedType));
  if (node["@type"] === expectedType) return true;
  if (Array.isArray(node["@type"]) && node["@type"].includes(expectedType)) return true;
  return Object.values(node).some((item) => containsType(item, expectedType));
}

function findJsonLd(blocks, type) {
  const block = blocks.find((item) => containsType(item, type));
  if (!block) throw new Error(`JSON-LD tip nije pronađen: ${type}`);
  return block;
}

async function getRoute(route, options) {
  return fetch(new URL(route, baseUrl), {
    redirect: "manual",
    headers: { "user-agent": "CarsystemSeoEvidence/1.0" },
    ...options,
  });
}

try {
  if (startServer) {
    server = spawn("npm", ["start", "--", "-p", "3100"], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  await waitForServer();
  await mkdir(outputDirectory, { recursive: true });

  const [homeResponse, rmResponse, productResponse, storesResponse] =
    await Promise.all([
      getRoute("/"),
      getRoute("/brendovi/rm"),
      getRoute("/proizvodi/2220-agilis-activator"),
      getRoute("/prodavnice"),
    ]);
  const [homeHtml, rmHtml, productHtml, storesHtml] = await Promise.all([
    homeResponse.text(),
    rmResponse.text(),
    productResponse.text(),
    storesResponse.text(),
  ]);
  const homeJsonLd = extractJsonLd(homeHtml);
  const productJsonLd = extractJsonLd(productHtml);
  const storesJsonLd = extractJsonLd(storesHtml);

  await Promise.all([
    writeFile(path.join(outputDirectory, "home-head.html"), extractHead(homeHtml)),
    writeFile(path.join(outputDirectory, "rm-brand-head.html"), extractHead(rmHtml)),
    writeFile(path.join(outputDirectory, "rm-product-head.html"), extractHead(productHtml)),
    writeFile(
      path.join(outputDirectory, "organization-website-jsonld.json"),
      `${JSON.stringify(findJsonLd(homeJsonLd, "Organization"), null, 2)}\n`,
    ),
    writeFile(
      path.join(outputDirectory, "product-jsonld.json"),
      `${JSON.stringify(findJsonLd(productJsonLd, "Product"), null, 2)}\n`,
    ),
    writeFile(
      path.join(outputDirectory, "breadcrumb-jsonld.json"),
      `${JSON.stringify(findJsonLd(productJsonLd, "BreadcrumbList"), null, 2)}\n`,
    ),
    writeFile(
      path.join(outputDirectory, "local-business-jsonld.json"),
      `${JSON.stringify(findJsonLd(storesJsonLd, "LocalBusiness"), null, 2)}\n`,
    ),
  ]);

  const [
    robotsResponse,
    sitemapResponse,
    filterResponse,
    contactQueryResponse,
    pdfResponse,
    redirectResponse,
    missingResponse,
  ] = await Promise.all([
    getRoute("/robots.txt"),
    getRoute("/sitemap.xml"),
    getRoute("/katalog?q=lak"),
    getRoute("/kontakt?tema=proizvod"),
    getRoute(
      "/documents/products/rm/2220-agilis-activator/rm-2220-agilis-activator-product-information.pdf",
    ),
    getRoute("/proizvodi/clear-harden-r-h-2p15"),
    getRoute("/seo-evidence-missing-route"),
  ]);
  const [robotsText, sitemapText, missingHtml] = await Promise.all([
    robotsResponse.text(),
    sitemapResponse.text(),
    missingResponse.text(),
  ]);
  const sitemapCount = [...sitemapText.matchAll(/<loc>/g)].length;
  const httpEvidence = {
    generatedAt: new Date().toISOString(),
    robots: { status: robotsResponse.status },
    sitemap: { status: sitemapResponse.status, urlCount: sitemapCount },
    filterQuery: {
      status: filterResponse.status,
      xRobotsTag: filterResponse.headers.get("x-robots-tag"),
    },
    contactQuery: {
      status: contactQueryResponse.status,
      xRobotsTag: contactQueryResponse.headers.get("x-robots-tag"),
    },
    pdf: {
      status: pdfResponse.status,
      xRobotsTag: pdfResponse.headers.get("x-robots-tag"),
    },
    duplicateRedirect: {
      status: redirectResponse.status,
      location: redirectResponse.headers.get("location"),
    },
    notFound: {
      status: missingResponse.status,
      robots:
        missingHtml.match(
          /<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i,
        )?.[1] ?? "",
      canonicalPresent: /<link\b[^>]*rel=["']canonical["']/i.test(missingHtml),
    },
  };

  await Promise.all([
    writeFile(path.join(outputDirectory, "robots.txt"), robotsText),
    writeFile(path.join(outputDirectory, "sitemap.xml"), sitemapText),
    writeFile(
      path.join(outputDirectory, "http-evidence.json"),
      `${JSON.stringify(httpEvidence, null, 2)}\n`,
    ),
    writeFile(
      path.join(outputDirectory, "README.md"),
      `# SEO dokazni artefakti

- home-head.html: stvarni head početne.
- rm-brand-head.html: stvarni head R-M brand stranice.
- rm-product-head.html: stvarni head tipičnog R-M PDP-a.
- product-jsonld.json: Product JSON-LD sa PDP-a A 2220.
- breadcrumb-jsonld.json: BreadcrumbList sa istog PDP-a.
- organization-website-jsonld.json: Organization/WebSite/WebPage graf sa početne.
- local-business-jsonld.json: CollectionPage i devet verified Store/LocalBusiness objekata.
- robots.txt: stvarni lokalni production output.
- sitemap.xml: stvarni lokalni production output sa ${sitemapCount} URL-ova.
- http-evidence.json: statusi, X-Robots-Tag, redirect i 404 dokaz.

Social preview za A 2220:

../../public/images/og/products/rm/2220-agilis-activator.jpg
`,
    ),
  ]);

  console.log(JSON.stringify(httpEvidence, null, 2));
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 2_000);
    });
  }
}
