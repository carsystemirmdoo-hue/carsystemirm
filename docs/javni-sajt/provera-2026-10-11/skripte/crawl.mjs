import fs from "node:fs";
const BASE = "http://localhost:3220";
const DIR = new URL(".", import.meta.url).pathname;
const inv = JSON.parse(fs.readFileSync(DIR + "inventory.json", "utf8"));
const sm = await (await fetch(BASE + "/sitemap.xml")).text();
const urls = new Map();
for (const m of sm.matchAll(/<loc>https:\/\/carsystemirm\.com([^<]*)<\/loc>/g)) urls.set(m[1] || "/", "sitemap");
for (const p of inv.products) { if (!urls.has(p.canonical)) urls.set(p.canonical, "canonical"); const own = "/proizvodi/" + p.slug; if (!urls.has(own)) urls.set(own, "slug"); }
for (const u of ["/vodici", "/prijava", "/korpa", "/katalog?brend=rupes", "/brendovi/rupes", "/o-nama", "/nepostojeca-stranica-test", "/robots.txt", "/sitemap.xml", "/katalog?kategorija=bazne-boje"]) if (!urls.has(u)) urls.set(u, "extra");
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const attr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`, "i")); return m ? dec(m[1]) : null; };
function analyze(html) {
  const head = html.slice(0, html.indexOf("</head>") + 7);
  const title = dec((head.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const metas = [...head.matchAll(/<meta[^>]+>/g)].map((m) => m[0]);
  const meta = (n) => { const t = metas.find((x) => attr(x, "name") === n || attr(x, "property") === n); return t ? attr(t, "content") : null; };
  const canon = (head.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || null;
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<template[\s\S]*?<\/template>/g, "");
  const main = body; 
  const imgs = [...body.matchAll(/<img[^>]*>/g)].map((m) => ({ src: attr(m[0], "src"), alt: attr(m[0], "alt"), cls: attr(m[0], "class") }));
  const hrefs = [...body.matchAll(/<a[^>]*\shref="([^"]*)"[^>]*>/g)].map((m) => dec(m[1]));
  const h1 = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => dec(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
  const h2 = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => dec(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
  const aria = [...body.matchAll(/aria-label="([^"]*)"/g)].map((m) => dec(m[1]));
  const segs = dec(body.replace(/<[^>]+>/g, "\n")).split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const mainHtml = body.slice(Math.max(0, body.indexOf("<main")), body.lastIndexOf("<footer") > 0 ? body.lastIndexOf("<footer") : body.length);
  const segsMain = dec(mainHtml.replace(/<[^>]+>/g, "\n")).split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const hasImg = [...body.matchAll(/data-product-has-image="(true|false)"/g)].map((m) => m[1]);
  const docItems = [...body.matchAll(/<li><span class="[^"]*DocumentKind[^"]*">([^<]*)<\/span>([\s\S]*?)<\/li>/g)].map((m) => { const t = dec(m[2].replace(/<[^>]+>/g, "|").replace(/\|+/g, "|")); const href = (m[2].match(/href="([^"]*)"/) || [])[1]; return { kind: m[1], text: t, href: href ? dec(href) : null }; });
  const allDocLinks = [...body.matchAll(/href="([^"]*\.(?:pdf|PDF)[^"]*)"/g)].map((m) => dec(m[1]));
  const fallbacks = (body.match(/heroProductFallback/g) || []).length;
  const ldjson = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => { try { const j = JSON.parse(m[1]); return [].concat(j["@graph"] ?? j).map((x) => x["@type"]).flat().join(","); } catch { return "INVALID"; } });
  const htmlLang = (html.match(/<html[^>]*lang="([^"]*)"/) || [])[1];
  return { segsMain, hasImg, docItems, allDocLinks, fallbacks, ldjson, htmlLang, title, desc: meta("description"), robots: meta("robots"), ogImage: meta("og:image"), ogTitle: meta("og:title"), canon, h1, h2, imgs, hrefs, aria, segs };
}
const results = [];
const list = [...urls.entries()];
let i = 0;
async function worker() {
  while (i < list.length) {
    const [u, origin] = list[i++];
    const r = { url: u, origin };
    try {
      const res = await fetch(BASE + u, { redirect: "manual" });
      r.status = res.status;
      if (res.status >= 300 && res.status < 400) { r.location = res.headers.get("location"); }
      else if ((res.headers.get("content-type") || "").includes("html")) { Object.assign(r, analyze(await res.text())); }
      else { await res.arrayBuffer(); }
    } catch (e) { r.error = String(e); }
    results.push(r);
    if (results.length % 200 === 0) console.error(results.length + "/" + list.length);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(DIR + "pages.json", JSON.stringify(results));
console.log("pages", results.length);
