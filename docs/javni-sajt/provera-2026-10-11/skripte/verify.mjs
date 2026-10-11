// Provera ključnih nalaza javnog sajta (pre/posle ispravki). Upotreba: node verify.mjs http://localhost:3520 [grupe...]
import { chromium } from "/Users/miledulic/Carsystem/carsystem/node_modules/playwright-core/index.mjs";
const BASE = process.argv[2] || "http://localhost:3520";
const only = new Set(process.argv.slice(3));
const want = (g) => !only.size || only.has(g);
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const html = async (u) => (await (await fetch(BASE + u)).text());
const text = async (u) => dec((await html(u)).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " | ")).replace(/\s+/g, " ");
const out = {};

if (want("carfit") || want("tema")) {
  const b = await chromium.launch();
  if (want("carfit")) {
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const p = await (await b.newContext({ viewport: vp, isMobile: vp.width < 500 })).newPage();
      await p.goto(BASE + "/brendovi/carfit", { waitUntil: "networkidle" });
      const res = [];
      for (const n of [0, 40, 110]) {
        const c = p.locator("article[class*=productCard]").nth(n);
        await c.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
        res.push(await c.evaluate((e) => { let x = e, min = 1; while (x) { min = Math.min(min, +getComputedStyle(x).opacity); x = x.parentElement; } return min; }));
      }
      out[`carfit_${vp.width}_min_opacity_kartica_0_40_110`] = res;
    }
  }
  if (want("tema")) {
    for (const u of ["/brendovi/norbin", "/brendovi/sata", "/brendovi/rm"]) {
      for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const p = await (await b.newContext({ viewport: vp, colorScheme: "dark", isMobile: vp.width < 500 })).newPage();
        await p.goto(BASE + u, { waitUntil: "networkidle" });
        const share = await p.evaluate(async () => {
          // udeo površine glavnih blokova čija je pozadina svetla
          const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; if (c.startsWith("oklch")) return +m[0] > 1 ? +m[0] / 100 : +m[0]; const a = c.startsWith("rgba") ? +m[3] : 1; if (a < 0.5) return null; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
          let light = 0, tot = 0;
          for (const el of document.querySelectorAll("main *")) {
            const r = el.getBoundingClientRect(); if (r.width < innerWidth * 0.6 || r.height < 120) continue;
            const L = lum(getComputedStyle(el).backgroundColor); if (L === null) continue;
            tot += r.height; if (L > 0.75) light += r.height;
          }
          return tot ? Math.round((light / tot) * 100) : 0;
        });
        out[`tema_dark_${u}_${vp.width}_svetlih_blokova_pct`] = share;
      }
    }
  }
  await b.close();
}

if (want("katalozi")) {
  const h = await html("/katalozi");
  out.katalozi_ssr_pdf_linkova = (h.replace(/<script[\s\S]*?<\/script>/g, "").match(/href="\/documents\/[^"]+\.pdf"/g) || []).length;
}
if (want("tekst")) {
  const checks = {
    "/brendovi/carsystem": ["javnih Carsystem zapisa", "lokalnog kataloga", "Lokalni javni katalog", "postojeći lokalni zapisi", "Opremljam", "poliru"],
    "/brendovi/carfit": ["carfit-task-preparation", "carfit-abrasives", "carfit-masking-scene"],
    "/brendovi/norbin": ["bez sistema boje", "učvršđivač", "NORBIN-N15-020-5L", "sa strane sajta", "EMEA"],
    "/brendovi/rm": ["umesto izmišljene ambalaže", "bez izmišljanja", "Direktan ulaz u postojeći katalog"],
    "/brendovi/baslac": ["Pretražite javni katalog", "Refinity ovde predstavljamo", "Proizvodi sa otvorenom stranicom"],
    "/brendovi/cosmos-lac": ["GRAFIT I", "primeri,", "RAL RAL"],
    "/proizvodi/rm-pasta-190-1l": ["U pripremi za javni katalog"],
    "/proizvodi/h-2a14-topcure": ["dostavljeni zvanični R-M materijal"],
    "/kategorije/bazne-boje": ["dostupno je i bez JavaScript-a", "Potvrđeni R-M proizvodi"],
    "/program/boje-i-lakovi": ["Aktivni brendovi vode na javne stranice"],
    "/proizvodi/norbin-n75-020-hardener-fast": ["ne objavljuje tehnički list. | U pripremi"],
    "/proizvodi/carsystem-finish-back-pad-m-14": ["PDF str. 72"],
  };
  const r = {};
  for (const [u, phr] of Object.entries(checks)) { const t = await text(u); r[u] = phr.filter((x) => t.includes(x)); }
  out.tekst_preostale_fraze = r;
}
if (want("tehnika")) {
  const r = {};
  for (const u of ["/proizvodi/rm-a-2a54-blendingadd", "/proizvodi/norbin-n15-v20-clear-voc", "/proizvodi/grupa/norbin-n15-020", "/proizvodi/2520-onyx-easy-blender", "/proizvodi/baslac-40-440-2k-voc-clear", "/proizvodi/baslac-40-450-universal-clear-voc"]) {
    const h = (await html(u)).replace(/<script[\s\S]*?<\/script>/g, "");
    const dl = [...h.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [dec(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(), dec(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()]);
    r[u] = dl.filter(([k]) => /Mlaznica|VOC|Sušenje|Rok upotrebe|Viskozitet|Vreme upotrebe|Odnos/i.test(k)).map(([k, v]) => `${k}: ${v}`);
  }
  out.tehnika = r;
}
if (want("brojevi")) {
  const t = await text("/program");
  out.program_brojevi = [...t.matchAll(/\| (\d+) \| proizvoda/g)].map((m) => +m[1]);
  const k = await text("/katalog");
  out.katalog_hero = (k.match(/\d+ brendova[^|]*\|[^|]*programa|\d+ \| programa|\d+ programa/) || [""])[0];
}
if (want("nav")) {
  const h = await html("/kontakt");
  out.rupes_linkova_u_zaglavlju_i_footeru = (h.match(/href="\/brendovi\/rupes"/g) || []).length;
}
console.log(JSON.stringify(out, null, 1));
