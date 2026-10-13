import fs from "node:fs"; import crypto from "node:crypto";
const D = process.env.HOME + "/Carsystem/radno/slike-za-pronalazenje/preuzeto/sata";
const csv = fs.readFileSync("/Users/miledulic/Carsystem/radno/javni-sajt-ispravke/docs/catalog/image-gaps-2026-10/sata-current-official-urls.csv", "utf8").trim().split("\n");
const parse = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; };
const H = parse(csv[0]); const rows = csv.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [H[i], v])));
const out = []; let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => { while (i < rows.length) { const r = rows[i++];
  const rec = { slug: r.slug, article: r.main_article, page: r.product_page_url, url: r.current_image_url, filenameMatches: r.filename_article_matches, note: r.note };
  if (!r.current_image_url) { rec.status = "nema URL"; out.push(rec); continue; }
  try {
    const res = await fetch(r.current_image_url, { headers: { "user-agent": "Mozilla/5.0" } });
    rec.http = res.status;
    if (res.ok) { const b = Buffer.from(await res.arrayBuffer()); const ext = (r.current_image_url.match(/\.(webp|png|jpe?g)(?:\.\w+)?$/i)?.[1] ?? "img").toLowerCase();
      const fname = `sata__${r.slug}__${r.main_article}.${ext}`; fs.writeFileSync(`${D}/${fname}`, b);
      rec.file = fname; rec.bytes = b.length; rec.sha256 = crypto.createHash("sha256").update(b).digest("hex"); rec.status = "preuzeto"; }
    else rec.status = "HTTP " + res.status;
  } catch (e) { rec.status = "greška " + e.name; }
  out.push(rec); } }));
fs.writeFileSync(`${D}/_manifest.json`, JSON.stringify(out, null, 1));
const c = {}; for (const o of out) c[o.status] = (c[o.status] || 0) + 1; console.log(out.length, c);
console.log("filename_article_matches:", out.reduce((a, o) => (a[o.filenameMatches] = (a[o.filenameMatches] || 0) + 1, a), {}));
