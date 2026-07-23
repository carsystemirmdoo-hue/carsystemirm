#!/usr/bin/env node
/*
 * MP4 render za internu scenu /social-exports/refinish-systems.
 *
 * Deterministički frame-by-frame pipeline:
 *  1. production build + `next start` na lokalnom portu;
 *  2. scena se učitava sa ?render=1 i čeka da svi asseti/fontovi budu spremni;
 *  3. uključuje se CDP virtual time (Emulation.setVirtualTimePolicy) pa se
 *     tek onda scena startuje — svi tajmeri i CSS animacije od tog trenutka
 *     teku isključivo po virtuelnom satu;
 *  4. sat se pomera za tačno 1000/fps ms po frame-u i svaki frame se snima
 *     kao PNG u privremeni direktorijum van repozitorijuma;
 *  5. FFmpeg spaja frame-ove u H.264 MP4 (yuv420p, faststart);
 *  6. privremeni frame-ovi se brišu tek posle uspešnog encode-a.
 *
 * Render zato ne zavisi od brzine računara: frame N je uvek stanje scene u
 * trenutku N * (1000/fps) ms od starta vremenske linije.
 *
 * Upotreba:
 *   npm run render:refinish-systems                  # story + feed + square
 *   npm run render:refinish-systems -- --format story
 *   npm run render:refinish-systems -- --format story --program carsystem
 *   npm run render:refinish-systems -- --all         # sva tri formata
 *   npm run render:refinish-systems -- --skip-build  # preskoči next build
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
const outputDir = path.join(projectRoot, "public", "social-exports", "refinish-systems");

const FORMATS = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
};

const DEFAULT_FPS = 60;
const DEFAULT_PORT = 4310;
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function parseArgs(argv) {
  const args = { formats: [], program: null, fps: DEFAULT_FPS, port: DEFAULT_PORT, skipBuild: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") {
      const value = argv[++i];
      if (!FORMATS[value]) fail(`Nepoznat format: ${value}. Dozvoljeno: ${Object.keys(FORMATS).join(", ")}`);
      args.formats.push(value);
    } else if (arg === "--program") {
      args.program = argv[++i] ?? fail("--program zahteva vrednost");
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

  if (args.formats.length === 0) args.formats = Object.keys(FORMATS);
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

/** Pomeri virtuelni sat za budgetMs i sačekaj da se budžet potroši. */
function advanceVirtualTime(cdp, budgetMs) {
  return new Promise((resolve, reject) => {
    const onExpired = () => {
      cdp.off("Emulation.virtualTimeBudgetExpired", onExpired);
      resolve(undefined);
    };
    cdp.on("Emulation.virtualTimeBudgetExpired", onExpired);
    cdp
      .send("Emulation.setVirtualTimePolicy", {
        policy: "pauseIfNetworkFetchesPending",
        budget: budgetMs,
        maxVirtualTimeTaskStarvationCount: 1000000,
      })
      .catch(reject);
  });
}

async function renderJob(browser, { format, program, fps, baseUrl, jobLabel }) {
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

  const query = new URLSearchParams({ format, render: "1" });
  if (program) query.set("program", program);
  const url = `${baseUrl}/social-exports/refinish-systems?${query.toString()}`;

  log(`${jobLabel}: učitavam ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });
  // Interval polling umesto default rAF pollinga: uz BeginFrameControl
  // requestAnimationFrame ne kuca sam pa bi rAF čekanja visila.
  await page.waitForFunction(
    () => document.querySelector('[data-export-ready="true"]') !== null,
    { timeout: 30000, polling: 200 },
  );
  await page.waitForFunction(() => document.fonts.status === "loaded", {
    timeout: 30000,
    polling: 200,
  });
  await page.waitForFunction(() => window.__refinishRender?.meta().ready === true, {
    timeout: 30000,
    polling: 200,
  });

  const meta = await page.evaluate(() => window.__refinishRender.meta());
  const durationMs = meta.holdMs + meta.steps * meta.stepMs + meta.endMs;
  const frameCount = Math.round((durationMs / 1000) * fps);
  const frameBudgetMs = 1000 / fps;
  log(
    `${jobLabel}: ${meta.steps} koraka, trajanje ${(durationMs / 1000).toFixed(1)}s, ` +
      `${frameCount} frame-ova @ ${fps}fps`,
  );

  // Virtual time se pauzira PRE starta scene: od ovog trenutka svi tajmeri i
  // CSS animacije čekaju budžete koje dodeljujemo za tačno jedan frame.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  await page.evaluate(() => window.__refinishRender.start());

  const framesDir = await mkdtemp(path.join(os.tmpdir(), `refinish-${format}-`));
  try {
    // Preferiramo HeadlessExperimental.beginFrame: compositing na zahtev,
    // pa svaki snimljeni frame odgovara tačno trenutnom virtuelnom vremenu.
    // Ako domen nije dostupan, padamo na Page.captureScreenshot.
    let useBeginFrame = true;
    let lastFrameBuffer = null;

    async function captureFrame() {
      if (useBeginFrame) {
        try {
          const result = await cdp.send("HeadlessExperimental.beginFrame", {
            screenshot: { format: "png" },
          });
          if (result.screenshotData) {
            lastFrameBuffer = Buffer.from(result.screenshotData, "base64");
          }
          // Bez screenshotData nije bilo izmena (statičan kadar) — namerno
          // ponavljamo prethodni identičan frame.
          if (lastFrameBuffer) return lastFrameBuffer;
        } catch {
          useBeginFrame = false;
          log(`${jobLabel}: beginFrame nedostupan, koristim captureScreenshot`);
        }
      }

      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      lastFrameBuffer = Buffer.from(data, "base64");
      return lastFrameBuffer;
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      if (frame > 0) await advanceVirtualTime(cdp, frameBudgetMs);
      const framePath = path.join(framesDir, `frame-${String(frame).padStart(6, "0")}.png`);
      await writeFile(framePath, await captureFrame());
      if (frame % 120 === 0) {
        log(`${jobLabel}: frame ${frame}/${frameCount}`);
      }
    }

    const written = (await readdir(framesDir)).filter((name) => name.endsWith(".png")).length;
    if (written !== frameCount) {
      throw new Error(`Očekivano ${frameCount} frame-ova, snimljeno ${written}`);
    }

    await mkdir(outputDir, { recursive: true });
    const outputName = `refinish-systems-${format}${program ? `-${program}` : ""}.mp4`;
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
        // Deterministički compositing pod virtuelnim satom: frame-ove
        // proizvodimo eksplicitno (BeginFrameControl), a pipeline se uvek
        // izvršava do kraja pre svakog crtanja.
        "--enable-begin-frame-control",
        "--run-all-compositor-stages-before-draw",
        "--disable-new-content-rendering-timeout",
        "--disable-threaded-animation",
        "--disable-checker-imaging",
      ],
    });

    const outputs = [];
    for (const format of args.formats) {
      const jobLabel = `${format}${args.program ? `/${args.program}` : ""}`;
      const outputPath = await renderJob(browser, {
        format,
        program: args.program,
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
