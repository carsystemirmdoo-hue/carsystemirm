#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const value = process.argv[index + 1];
  args.set(key.slice(2), value && !value.startsWith("--") ? value : "true");
  if (value && !value.startsWith("--")) index += 1;
}

const label = args.get("label") === "after" ? "after" : "before";
const baseUrl = new URL(args.get("base-url") ?? "http://localhost:3000");
const outputDirectory = path.resolve(
  process.cwd(),
  args.get("output-dir") ?? `artifacts/seo/performance/${label}`,
);
const reportPath = path.resolve(
  process.cwd(),
  args.get("report") ?? `docs/seo/SEO_PERFORMANCE_${label.toUpperCase()}.md`,
);

const routes = [
  { key: "home", label: "Početna", path: "/" },
  { key: "catalog", label: "Katalog", path: "/katalog" },
  { key: "rm-brand", label: "R-M brend", path: "/brendovi/rm" },
  {
    key: "rm-product",
    label: "Tipičan R-M PDP",
    path: "/proizvodi/2220-agilis-activator",
  },
  {
    key: "rm-product-heavy",
    label: "R-M PDP sa tehničkim podacima",
    path: "/proizvodi/c-2p42-race-finish-r",
  },
  { key: "stores", label: "Prodavnice", path: "/prodavnice" },
  { key: "contact", label: "Kontakt", path: "/kontakt" },
];

const profiles = [
  { key: "mobile", flags: [] },
  {
    key: "desktop",
    flags: ["--preset=desktop"],
  },
];

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function score(value) {
  return typeof value === "number" ? Math.round(value * 100) : "n/a";
}

function metric(audit) {
  return typeof audit?.numericValue === "number" ? audit.numericValue : null;
}

function formatMs(value) {
  if (value === null) return "n/a";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
}

function formatCls(value) {
  return value === null ? "n/a" : value.toFixed(3);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  const results = [];

  for (const profile of profiles) {
    for (const route of routes) {
      const outputPath = path.join(outputDirectory, `${route.key}-${profile.key}.json`);
      const url = new URL(route.path, baseUrl).toString();
      process.stdout.write(`Lighthouse ${profile.key}: ${route.path}\n`);
      try {
        await run("npx", [
          "--yes",
          "lighthouse@latest",
          url,
          "--quiet",
          "--output=json",
          `--output-path=${outputPath}`,
          "--only-categories=performance,accessibility,seo",
          '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
          ...profile.flags,
        ]);
        const report = JSON.parse(await readFile(outputPath, "utf8"));
        results.push({
          route: route.label,
          path: route.path,
          profile: profile.key,
          performance: score(report.categories?.performance?.score),
          accessibility: score(report.categories?.accessibility?.score),
          seo: score(report.categories?.seo?.score),
          lcp: metric(report.audits?.["largest-contentful-paint"]),
          cls: metric(report.audits?.["cumulative-layout-shift"]),
          tbt: metric(report.audits?.["total-blocking-time"]),
          inp: metric(report.audits?.["interaction-to-next-paint"]),
          fcp: metric(report.audits?.["first-contentful-paint"]),
          status: "ok",
        });
      } catch (error) {
        results.push({
          route: route.label,
          path: route.path,
          profile: profile.key,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const tableRows = results.map((result) => {
    if (result.status === "error") {
      return `| ${result.route} | ${result.profile} | greška | greška | greška | n/a | n/a | n/a | ${result.error.replaceAll("|", "\\|")} |`;
    }
    return `| ${result.route} | ${result.profile} | ${result.performance} | ${result.accessibility} | ${result.seo} | ${formatMs(result.lcp)} | ${formatCls(result.cls)} | ${formatMs(result.tbt)} | |`;
  });

  const report = `# SEO performance ${label.toUpperCase()}

- Datum: ${new Date().toISOString()}
- Okruženje: lokalni Next.js production build na \`${baseUrl.origin}\`
- Alat: Lighthouse, laboratorijsko merenje
- Profili: mobile i desktop
- Napomena: ovo nisu CrUX/field podaci. INP zahteva realne korisničke interakcije; Lighthouse TBT je naveden kao laboratorijski signal odziva.

| Šablon | Profil | Performance | Accessibility | SEO | LCP | CLS | TBT | Napomena |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${tableRows.join("\n")}

## Ciljevi

- LCP: do 2,5 s
- INP: do 200 ms u field podacima
- CLS: do 0,1

Sirovi JSON izveštaji su u \`${path.relative(process.cwd(), outputDirectory)}\`.
`;

  await writeFile(reportPath, report);
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
