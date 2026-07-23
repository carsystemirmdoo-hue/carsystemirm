#!/usr/bin/env node
/*
 * MP4 render za internu scenu /social-exports/spray-reveal (proizvod +
 * spray reveal artwork). Deterministički frame-by-frame pipeline: production
 * server + statički seek režim scene (?render=1&time=0). Sve animacije scene
 * su CSS animacije pauzirane u tačnom trenutku preko --seek promenljive, pa
 * skripta za svaki frame samo postavi --seek na -(frame * 1000/fps) ms i
 * snimi PNG — svaki frame je čista funkcija vremena, bez ikakve zavisnosti
 * od brzine računara. FFmpeg zatim pravi H.264/yuv420p MP4.
 *
 * Upotreba:
 *   npm run render:spray-reveal                        # story + feed + square
 *   npm run render:spray-reveal -- --format story
 *   npm run render:spray-reveal -- --format wide       # bonus 16:9
 *   npm run render:spray-reveal -- --format story --product basecoat
 *   npm run render:spray-reveal -- --all               # sva četiri formata
 *   npm run render:spray-reveal -- --skip-build
 */

import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright-core";

const execFileAsync = promisify(execFile);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "public", "social-exports", "spray-reveal");

const FORMATS = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  wide: { width: 1920, height: 1080 },
};

const DEFAULT_FORMATS = ["story", "feed", "square"];
const DEFAULT_FPS = 60;
const DEFAULT_PORT = 4311;
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    formats: [],
    product: null,
    fps: DEFAULT_FPS,
    port: DEFAULT_PORT,
    skipBuild: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") {
      const value = argv[++i];
      if (!FORMATS[value]) {
        fail(`Nepoznat format: ${value}. Dozvoljeno: ${Object.keys(FORMATS).join(", ")}`);
      }
      args.formats.push(value);
    } else if (arg === "--product") {
      args.product = argv[++i] ?? fail("--product zahteva vrednost");
    } else if (arg === "--all") {
      args.formats = Object.keys(FORMATS);
    } else if (arg === "--fps") {
      args.fps = Number(argv[++i]);
      if (!Number.isFinite(args.fps) || args.fps <= 0) fail("--fps mora biti pozitivan broj");
    } else if (arg === "--port") {
      args.port = Number(argv[++i]);
    } else if (arg === "--skip-build") {
      args.skipBuild = true;
    } else {
      fail(`Nepoznat argument: ${arg}`);
    }
  }

  if (args.formats.length === 0) args.formats = [...DEFAULT_FORMATS];
  return args;
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`▸ ${message}`);
}

async function ensureFfmpeg() {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    await execFileAsync("ffprobe", ["-version"]);
  } catch {
    fail("FFmpeg/ffprobe nisu pronađeni u PATH-u. Instaliraj ih (npr. `brew install ffmpeg`).");
  }
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", cwd: projectRoot, ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${commandArgs.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Server na ${baseUrl} nije postao dostupan u roku od ${timeoutMs}ms`);
}

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  fail(
    "Chrome nije pronađen. Postavi CHROME_PATH ili instaliraj Google Chrome " +
      "(alternativno: `npm i -D playwright && npx playwright install chromium`).",
  );
  return null;
}

async function renderJob(browser, { format, product, fps, baseUrl, jobLabel }) {
  const { width, height } = FORMATS[format];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // Statički seek režim: scena je od starta "na času" (render=1&time=0),
  // sve animacije su pauzirane, a trenutak biramo preko --seek po frame-u.
  const query = new URLSearchParams({ format, render: "1", time: "0" });
  if (product) query.set("product", product);
  const url = `${baseUrl}/social-exports/spray-reveal?${query.toString()}`;

  log(`${jobLabel}: učitavam ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector('[data-export-ready="true"]') !== null,
    { timeout: 30000, polling: 200 },
  );
  await page.waitForFunction(() => document.fonts.status === "loaded", {
    timeout: 30000,
    polling: 200,
  });
  await page.waitForFunction(() => window.__sprayRender?.meta().ready === true, {
    timeout: 30000,
    polling: 200,
  });

  const meta = await page.evaluate(() => window.__sprayRender.meta());
  const frameCount = Math.round((meta.durationMs / 1000) * fps);
  log(
    `${jobLabel}: trajanje ${(meta.durationMs / 1000).toFixed(1)}s, ` +
      `${frameCount} frame-ova @ ${fps}fps`,
  );

  const cdp = await context.newCDPSession(page);

  const framesDir = await mkdtemp(path.join(os.tmpdir(), `spray-${format}-`));
  try {
    for (let frame = 0; frame < frameCount; frame += 1) {
      const timeMs = (frame * 1000) / fps;
      await page.evaluate((seekMs) => {
        const stage = document.querySelector("[data-export-format]");
        stage.style.setProperty("--seek", `${-seekMs}ms`);
      }, timeMs);

      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const framePath = path.join(framesDir, `frame-${String(frame).padStart(6, "0")}.png`);
      await writeFile(framePath, Buffer.from(data, "base64"));
      if (frame % 120 === 0) {
        log(`${jobLabel}: frame ${frame}/${frameCount}`);
      }
    }

    const written = (await readdir(framesDir)).filter((name) => name.endsWith(".png")).length;
    if (written !== frameCount) {
      throw new Error(`Očekivano ${frameCount} frame-ova, snimljeno ${written}`);
    }

    await mkdir(outputDir, { recursive: true });
    const outputName = `spray-reveal-${format}${product ? `-${product}` : ""}.mp4`;
    const outputPath = path.join(outputDir, outputName);

    log(`${jobLabel}: FFmpeg encode -> ${path.relative(projectRoot, outputPath)}`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(framesDir, "frame-%06d.png"),
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      outputPath,
    ]);

    if (consoleErrors.length > 0) {
      console.warn(`⚠ ${jobLabel}: console greške tokom rendera:\n  ${consoleErrors.join("\n  ")}`);
    }

    return outputPath;
  } finally {
    await rm(framesDir, { recursive: true, force: true });
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureFfmpeg();
  const chromePath = findChrome();

  if (!args.skipBuild) {
    log("Pokrećem production build (preskoči sa --skip-build)...");
    await runCommand("npm", ["run", "build"]);
  } else if (!existsSync(path.join(projectRoot, ".next", "BUILD_ID"))) {
    fail("Nema production builda (.next/BUILD_ID). Pokreni bez --skip-build.");
  }

  log(`Startujem next start na portu ${args.port}...`);
  const server = spawn("npx", ["next", "start", "-p", String(args.port)], {
    cwd: projectRoot,
    stdio: "ignore",
    env: { ...process.env, MAINTENANCE_MODE: "false" },
  });
  const baseUrl = `http://localhost:${args.port}`;

  let browser;
  try {
    await waitForServer(baseUrl);

    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        "--hide-scrollbars",
        "--force-color-profile=srgb",
        "--disable-lcd-text",
        "--disable-threaded-animation",
        "--disable-checker-imaging",
      ],
    });

    const outputs = [];
    for (const format of args.formats) {
      const jobLabel = `${format}${args.product ? `/${args.product}` : ""}`;
      const outputPath = await renderJob(browser, {
        format,
        product: args.product,
        fps: args.fps,
        baseUrl,
        jobLabel,
      });
      outputs.push(outputPath);
    }

    console.log("\n✔ Renderovano:");
    for (const outputPath of outputs) {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,codec_name,pix_fmt,avg_frame_rate:format=duration",
        "-of",
        "default=noprint_wrappers=1",
        outputPath,
      ]);
      console.log(`  ${path.relative(projectRoot, outputPath)}`);
      console.log(`    ${stdout.trim().split("\n").join(" | ")}`);
    }
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
