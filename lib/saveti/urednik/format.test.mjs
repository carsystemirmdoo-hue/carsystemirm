import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseArticleMarkdown } from "../markdown.mjs";
import { blokoviUMarkdown, cistTekst, dozvoljenLink, markdownUHtml } from "./format.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = path.join(ROOT, "content/saveti/clanci");

test("svih 224 teksta: blokovi → Markdown → blokovi daje isti sadržaj (urednik ništa ne gubi)", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));
  assert.ok(files.length >= 200);
  for (const file of files) {
    const body = readFileSync(path.join(DIR, file), "utf8").replace(/\r\n/g, "\n").split(/\n---\n/).slice(1).join("\n---\n");
    const first = parseArticleMarkdown(body, file);
    assert.deepEqual(first.errors, [], file);
    const md = blokoviUMarkdown(first.blocks);
    const second = parseArticleMarkdown(md, file);
    assert.deepEqual(second.errors, [], file);
    assert.deepEqual(second.blocks, first.blocks, file);
  }
});

test("HTML urednika: podnaslovi, liste, linkovi; tabela i okvir kao ostrva sa svojim Markdown-om", () => {
  const md = "## Naslov\n\nTekst **jako** i [link](/katalog) uz izvor[^tds].\n\n- prva\n- druga\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> [!upozorenje]\n> Pažnja.";
  const html = markdownUHtml(md);
  assert.match(html, /<h2>Naslov<\/h2>/);
  assert.match(html, /<strong>jako<\/strong>/);
  assert.match(html, /<a href="\/katalog">link<\/a>/);
  assert.match(html, /data-cite="tds"/);
  assert.match(html, /<ul><li>prva<\/li><li>druga<\/li><\/ul>/);
  assert.match(html, /data-vrsta="Tabela"/);
  assert.match(html, /data-md="&gt; \[!upozorenje\]/);
  assert.doesNotMatch(markdownUHtml("<script>alert(1)</script>"), /<script>/);
});

test("tekst iz urednika ne otvara Markdown oznake; linkovi samo sa sajta, https ili mailto", () => {
  assert.equal(cistTekst("2*3 i `x` [^a]"), "2∗3 i ’x’ [ ^a]");
  assert.equal(dozvoljenLink("/katalog?x=1"), "/katalog?x=1");
  assert.equal(dozvoljenLink("https://rmpaint.com"), "https://rmpaint.com");
  assert.equal(dozvoljenLink("javascript:alert(1)"), null);
  assert.equal(dozvoljenLink("//evil.example"), null);
  assert.equal(dozvoljenLink("http://nesigurno.example"), null);
});
