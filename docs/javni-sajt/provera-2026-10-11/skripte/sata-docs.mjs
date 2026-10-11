import fs from "node:fs";
const REPO = "/Users/miledulic/Carsystem/radno/javni-sajt-ispravke";
const OUT = process.argv[2];
const ds = JSON.parse(fs.readFileSync(`${REPO}/data/sata-catalog-products.generated.json`, "utf8"));
const all = [...ds.products, ...Object.values(ds.enrichments ?? {}), ...((ds.phase2?.products) ?? [])];
const recs = all.filter((p) => p && p.documents?.length && p.sourceUrl);
const fileOf = (u) => decodeURIComponent(new URL(u).pathname.split("/").pop());
const results = [];
for (const p of recs) {
  const status = [];
  for (const d of p.documents) {
    const r = await fetch(d.href, { method: "HEAD", headers: { "user-agent": "Mozilla/5.0" } }).catch(() => null);
    status.push({ d, ok: r?.ok ?? false, code: r?.status });
  }
  if (status.every((s) => s.ok)) continue;
  const res = await fetch(p.sourceUrl, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await res.text();
  fs.writeFileSync(`${OUT}/${p.slug}.html`, html);
  const links = [...new Set([...html.matchAll(/https:\/\/www\.sata\.com\/media\/[^"'\s<>]+?\.pdf(?:\.pdf)?(?:\?ts=\d+)?/gi)].map((m) => m[0].replace(/&amp;/g, "&")))];
  for (const s of status.filter((x) => !x.ok)) {
    const want = fileOf(s.d.href).toUpperCase();
    const cands = links.filter((l) => fileOf(l).toUpperCase() === want);
    let verified = null;
    for (const c of cands) {
      const r = await fetch(c, { headers: { "user-agent": "Mozilla/5.0", range: "bytes=0-4" } });
      const b = Buffer.from(await r.arrayBuffer()).toString();
      if (r.ok && b.startsWith("%PDF")) { verified = c; break; }
    }
    results.push({ slug: p.slug, familyId: p.familyId, page: p.sourceUrl, pageStatus: res.status, kind: s.d.kind, old: s.d.href, oldStatus: s.code, file: want, candidates: cands.length, replacement: verified, pdfLinksOnPage: links.length });
  }
}
fs.writeFileSync(`${OUT}/../sata-docs.json`, JSON.stringify(results, null, 1));
const c = { total: results.length, replaced: results.filter((r) => r.replacement).length };
console.log(c);
for (const r of results.filter((r) => !r.replacement)) console.log("NEMA", r.slug, r.file, "pdf na strani:", r.pdfLinksOnPage, r.pageStatus);
