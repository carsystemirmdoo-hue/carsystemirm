#!/usr/bin/env node
/*
 * Layout audit za prelaz: blok partnerske mreže → paint takeover → sledeća
 * sekcija. Meri ko fizički zauzima vertikalni prostor, bez pretpostavki.
 *
 *   node scripts/audit-takeover-layout.mjs --port 3000
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean).find((p) => existsSync(p));

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? process.argv[portArg + 1] : "3000";

const VIEWPORTS = [
  { label: "1536x1024", width: 1536, height: 1024 },
  { label: "1440x900", width: 1440, height: 900 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "390x844", width: 390, height: 844 },
];

const AUDIT = `() => {
  const pick = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 70),
      rect: { top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) },
      offsetHeight: el.offsetHeight,
      css: {
        position: cs.position,
        height: cs.height,
        minHeight: cs.minHeight,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        top: cs.top,
        inset: cs.inset,
        transform: cs.transform === 'none' ? 'none' : 'set',
        overflow: cs.overflow,
        zIndex: cs.zIndex,
        filter: cs.filter,
        willChange: cs.willChange,
        mixBlendMode: cs.mixBlendMode,
      },
    };
  };

  const net = document.querySelector('#prodavnice-mreza');
  const takeover = document.querySelector('#paint-takeover');
  const bridge = document.querySelector('[data-paint-entry-bridge]');
  const bridgeSvg = bridge ? bridge.querySelector('svg') : null;
  const sticky = takeover ? takeover.querySelector(':scope > div') : null;
  const next = takeover ? takeover.nextElementSibling : null;

  // Sva deca <main> u redosledu, sa visinama — traži spacer-e.
  const main = document.querySelector('main') || document.body;
  const flow = Array.from(main.children).map((el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50),
    top: Math.round(el.getBoundingClientRect().top + scrollY),
    h: el.offsetHeight,
    pos: getComputedStyle(el).position,
  }));

  // Ima li iko pin-spacer / spacer semantiku?
  const suspects = Array.from(document.querySelectorAll('*')).filter((el) => {
    const c = typeof el.className === 'string' ? el.className : '';
    return /pin-spacer|spacer|scroll-scene|pin_spacer/i.test(c) ||
           el.hasAttribute('data-spacer') || el.hasAttribute('data-pin-spacer');
  }).map((el) => ({ tag: el.tagName.toLowerCase(), cls: (typeof el.className==='string'?el.className:'').slice(0,60), h: el.offsetHeight }));

  const bridgeBox = bridgeSvg ? (() => {
    try {
      const bb = bridgeSvg.getBBox();
      return { x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height) };
    } catch { return null; }
  })() : null;

  return {
    viewport: { w: innerWidth, h: innerHeight },
    docHeight: document.documentElement.scrollHeight,
    network: pick(net),
    takeover: pick(takeover),
    stickyChild: pick(sticky),
    bridge: pick(bridge),
    bridgeSvgAttrs: bridgeSvg ? {
      viewBox: bridgeSvg.getAttribute('viewBox'),
      preserveAspectRatio: bridgeSvg.getAttribute('preserveAspectRatio'),
      renderedW: Math.round(bridgeSvg.getBoundingClientRect().width),
      renderedH: Math.round(bridgeSvg.getBoundingClientRect().height),
      bbox: bridgeBox,
    } : null,
    nextSection: pick(next),
    gapNetworkToNext: next && net
      ? Math.round((next.getBoundingClientRect().top + scrollY) - (net.getBoundingClientRect().top + scrollY + net.offsetHeight))
      : null,
    flow,
    spacerSuspects: suspects,
  };
}`;

const browser = await chromium.launch({ executablePath: CHROME });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);
  const data = await page.evaluate(`(${AUDIT})()`);
  data.consoleErrors = errors;
  console.log(`\n########## ${vp.label} ##########`);
  console.log(JSON.stringify(data, null, 1));
  await ctx.close();
}
await browser.close();
