#!/usr/bin/env node
/*
 * Review harness za homepage paint takeover.
 *
 * Dva režima:
 *   --sweep   numerički prolaz kroz scroll opseg sekcije: beleži sve driving
 *             CSS promenljive, html[data-paint-takeover] i prosečnu luminansu
 *             kadra, pa prijavljuje diskontinuitete (flash / sevanje).
 *   --shots   snima ključne faze (pre ulaska, entry brush, threshold, active,
 *             downstream) za light i dark temu, desktop i mobile.
 *
 * Upotreba:
 *   node scripts/review-paint-takeover.mjs --sweep --port 3015
 *   node scripts/review-paint-takeover.mjs --shots --port 3015
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    port: 3015,
    sweep: false,
    shots: false,
    step: 16,
    out: path.join(projectRoot, "review-screenshots", "paint-takeover"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sweep") args.sweep = true;
    else if (arg === "--shots") args.shots = true;
    else if (arg === "--port") args.port = Number(argv[++i]);
    else if (arg === "--step") args.step = Number(argv[++i]);
    else if (arg === "--out") args.out = path.resolve(argv[++i]);
  }
  if (!args.sweep && !args.shots) {
    args.sweep = true;
    args.shots = true;
  }
  return args;
}

/** Prosečna luminansa i luminansa leve tekst-zone, mereno u stranici. */
const PROBE = `() => {
  const pt = document.getElementById('paint-takeover');
  const range = Math.max(1, pt.offsetHeight - innerHeight);
  const style = pt.style;
  const header = document.querySelector('header');
  const num = (name) => {
    const raw = style.getPropertyValue(name).trim();
    return raw ? parseFloat(raw) : 0;
  };
  return {
    progress: +(-pt.getBoundingClientRect().top / range).toFixed(5),
    background: num('--background-opacity'),
    contrast: num('--contrast-opacity'),
    wash: num('--color-wash-opacity'),
    content: num('--content-opacity'),
    surfaceOffset: num('--surface-offset'),
    attr: document.documentElement.getAttribute('data-paint-takeover') || '-',
    headerBg: getComputedStyle(header).backgroundColor,
    headerColor: getComputedStyle(header).color,
  };
}`;

async function setTheme(page, theme) {
  await page.evaluate((mode) => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    try {
      localStorage.setItem("theme", mode);
    } catch {
      /* ignore */
    }
  }, theme);
  await page.waitForTimeout(250);
}

async function sectionMetrics(page) {
  return page.evaluate(() => {
    const pt = document.getElementById("paint-takeover");
    const net = document.getElementById("prodavnice-mreza");
    const after = pt.nextElementSibling;
    const abs = (el) => {
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top + scrollY), height: Math.round(b.height) };
    };
    return {
      takeover: abs(pt),
      network: abs(net),
      after: after ? abs(after) : null,
      range: Math.max(1, pt.offsetHeight - innerHeight),
      viewport: innerHeight,
      docHeight: document.documentElement.scrollHeight,
    };
  });
}

/** Srednja luminansa PNG-a bez eksternih zavisnosti: preko canvas-a u stranici. */
async function frameLuminance(page) {
  const shot = await page.screenshot({ type: "png" });
  return page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const w = 64;
    const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let total = 0;
    let left = 0;
    let leftCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const pixel = i / 4;
      const x = pixel % w;
      const lum =
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      total += lum;
      if (x < w * 0.45) {
        left += lum;
        leftCount += 1;
      }
    }
    return {
      mean: +(total / (data.length / 4)).toFixed(2),
      leftMean: +(left / leftCount).toFixed(2),
    };
  }, shot.toString("base64"));
}

async function runSweep(page, args) {
  const metrics = await sectionMetrics(page);
  // Ulazak počinje čitav viewport pre nego što se sekcija pinuje (approach
  // faza u bloku partnerske mreže), pa prolaz mora da pokrije i to.
  const start = metrics.takeover.top - Math.round(metrics.viewport * 1.35);
  const end =
    metrics.takeover.top + metrics.range + Math.round(metrics.viewport * 0.9);
  const rows = [];

  for (let y = start; y <= end; y += args.step) {
    await page.evaluate((top) => {
      window.scrollTo({ top, behavior: "instant" });
    }, y);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const probe = await page.evaluate(`(${PROBE})()`);
    const lum = await frameLuminance(page);
    rows.push({ y, ...probe, ...lum });
  }

  const jumps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const a = rows[i - 1];
    const b = rows[i];
    const dLum = b.mean - a.mean;
    const dVars = Math.max(
      Math.abs(b.background - a.background),
      Math.abs(b.contrast - a.contrast),
      Math.abs(b.wash - a.wash),
      Math.abs(b.content - a.content),
    );
    // Flash = luminansa kadra skoči preko praga u jednom koraku skrola.
    // Postepena promena boje headera nije defekt i namerno se ne prijavljuje.
    if (Math.abs(dLum) > 9 || dVars > 0.14) {
      jumps.push({
        fromY: a.y,
        toY: b.y,
        progress: b.progress,
        deltaLuminance: +dLum.toFixed(2),
        deltaVars: +dVars.toFixed(4),
        attr: a.attr !== b.attr ? `${a.attr} -> ${b.attr}` : null,
      });
    }
  }

  // Ne-monotonost luminanse: svetlije pa tamnije pa opet svetlije = sevanje.
  const reversals = [];
  for (let i = 2; i < rows.length; i += 1) {
    const d1 = rows[i - 1].mean - rows[i - 2].mean;
    const d2 = rows[i].mean - rows[i - 1].mean;
    if (d1 * d2 < 0 && Math.abs(d1) > 3 && Math.abs(d2) > 3) {
      reversals.push({
        y: rows[i - 1].y,
        progress: rows[i - 1].progress,
        pattern: `${rows[i - 2].mean} -> ${rows[i - 1].mean} -> ${rows[i].mean}`,
      });
    }
  }

  return { metrics, rows, jumps, reversals };
}

const PHASES = [
  { key: "01-before", at: (m) => m.takeover.top - Math.round(m.viewport * 0.75) },
  { key: "02-entry-brush", at: (m) => m.takeover.top - Math.round(m.viewport * 0.3) },
  { key: "03-threshold", at: (m) => m.takeover.top + Math.round(m.range * 0.08) },
  { key: "04-takeover-rise", at: (m) => m.takeover.top + Math.round(m.range * 0.3) },
  { key: "05-takeover-active", at: (m) => m.takeover.top + Math.round(m.range * 0.62) },
  { key: "06-takeover-hold", at: (m) => m.takeover.top + Math.round(m.range * 0.9) },
  {
    key: "07-downstream",
    at: (m) => (m.after ? m.after.top + 120 : m.takeover.top + m.range + 400),
  },
];

async function runShots(page, args, label) {
  const metrics = await sectionMetrics(page);
  const dir = path.join(args.out, label);
  await mkdir(dir, { recursive: true });
  const written = [];
  for (const phase of PHASES) {
    const y = Math.max(0, phase.at(metrics));
    await page.evaluate((top) => {
      window.scrollTo({ top, behavior: "instant" });
    }, y);
    await page.waitForTimeout(220);
    const file = path.join(dir, `${phase.key}.png`);
    await page.screenshot({ path: file });
    written.push(path.relative(projectRoot, file));
  }
  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const executablePath = CHROME_CANDIDATES.find((candidate) =>
    existsSync(candidate),
  );
  if (!executablePath) {
    throw new Error(
      "Nije pronađen Chrome. Postavi CHROME_PATH na lokalnu instalaciju.",
    );
  }

  const browser = await chromium.launch({ executablePath });
  const url = `http://localhost:${args.port}/`;
  const report = { url, generatedAt: new Date().toISOString() };

  try {
    for (const viewport of [
      { label: "1440", width: 1440, height: 900 },
      { label: "390", width: 390, height: 844 },
    ]) {
      for (const theme of ["light", "dark"]) {
        const label = `${viewport.label}-${theme}`;
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          reducedMotion: "no-preference",
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await setTheme(page, theme);
        await page.waitForTimeout(600);

        if (args.sweep && viewport.label === "1440") {
          const sweep = await runSweep(page, args);
          report[`sweep-${label}`] = {
            metrics: sweep.metrics,
            jumps: sweep.jumps,
            reversals: sweep.reversals,
            rows: sweep.rows,
          };
          console.log(
            `\n=== SWEEP ${label} === range=${sweep.metrics.range}px rows=${sweep.rows.length}`,
          );
          console.log(`jumps: ${sweep.jumps.length}`);
          for (const jump of sweep.jumps) {
            console.log(
              `  p=${jump.progress.toFixed(3)} y=${jump.fromY}->${jump.toY} dLum=${jump.deltaLuminance} dVars=${jump.deltaVars}` +
                (jump.attr ? ` attr[${jump.attr}]` : "") +
                (jump.header ? ` header[${jump.header}]` : ""),
            );
          }
          console.log(`luminance reversals: ${sweep.reversals.length}`);
          for (const rev of sweep.reversals) {
            console.log(
              `  p=${rev.progress.toFixed(3)} y=${rev.y} ${rev.pattern}`,
            );
          }
        }

        if (args.shots) {
          const files = await runShots(page, args, label);
          report[`shots-${label}`] = files;
          console.log(`\n=== SHOTS ${label} ===`);
          for (const file of files) console.log(`  ${file}`);
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  await mkdir(args.out, { recursive: true });
  const reportFile = path.join(args.out, "report.json");
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${path.relative(projectRoot, reportFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
