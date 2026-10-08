import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { restorePdfs, runBackup } from "./pdf-backup.mjs";

const AGE = process.env.AGE_BIN ?? "age";
const hasAge = spawnSync(AGE, ["--version"]).status === 0;

test("PDF kopija: nov, promenjen i obrisan fajl; ništa se ne briše iz skladišta; vraćanje proverava otisak", { skip: hasAge ? false : "age nije instaliran" }, async () => {
  const root = mkdtempSync(join(tmpdir(), "pdf-kopija-"));
  const src = join(root, "izvor"), dest = join(root, "skladiste"), state = join(root, "stanje.json");
  mkdirSync(join(src, "2026", "10"), { recursive: true });
  spawnSync("age-keygen", ["-o", join(root, "k.key")]);
  writeFileSync(join(root, "k.pub"), spawnSync("age-keygen", ["-y", join(root, "k.key")]).stdout);
  const opts = { source: src, dest, state, recipients: join(root, "k.pub") };
  const objects = () => readdirSync(join(dest, "objects"), { recursive: true }).filter((f) => String(f).endsWith(".age")).length;
  const indexes = () => readdirSync(join(dest, "index")).sort();
  try {
    writeFileSync(join(src, "2026", "10", "a.pdf"), "%PDF-a1");
    writeFileSync(join(src, "2026", "10", "b.PDF"), "%PDF-b1");
    writeFileSync(join(src, "2026", "10", "beleska.txt"), "nije pdf");
    let s = await runBackup(opts);
    assert.deepEqual([s.novih, s.novihObjekata, objects()], [2, 2, 2]);

    // Ponovni prolaz bez promena: ništa se ne hešira ni ne kopira.
    s = await runBackup(opts);
    assert.deepEqual([s.hesirano, s.novihObjekata], [0, 0]);

    // Promena sadržaja b.PDF (nova veličina i vreme) i nov c.pdf.
    writeFileSync(join(src, "2026", "10", "b.PDF"), "%PDF-b2-izmenjen");
    utimesSync(join(src, "2026", "10", "b.PDF"), new Date(), new Date(Date.now() + 5000));
    writeFileSync(join(src, "2026", "10", "c.pdf"), "%PDF-c1");
    await new Promise((r) => setTimeout(r, 1100));
    s = await runBackup(opts);
    assert.deepEqual([s.promenjenih, s.novih, s.novihObjekata, objects()], [1, 1, 2, 4]);
    const indexDan2 = indexes().at(-1);

    // Original obrisan: skladište zadržava objekat.
    unlinkSync(join(src, "2026", "10", "a.pdf"));
    await new Promise((r) => setTimeout(r, 1100));
    s = await runBackup(opts);
    assert.equal(s.nestalihUIzvoru, 1);
    assert.equal(objects(), 4, "nijedan objekat nije obrisan");
    const st = JSON.parse(readFileSync(state, "utf8"));
    assert.ok(st.files["2026/10/a.pdf"].missingSince);
    assert.equal(st.files["2026/10/b.PDF"].versions.length, 2);

    // Vraćanje iz indeksa drugog dana: a.pdf postoji, b je nova verzija.
    const out = join(root, "vraceno");
    const r = await restorePdfs({ dest, index: join(dest, "index", indexDan2), identity: join(root, "k.key"), out });
    assert.equal(r.problems.length, 0);
    assert.equal(readFileSync(join(out, "2026", "10", "a.pdf"), "utf8"), "%PDF-a1");
    assert.equal(readFileSync(join(out, "2026", "10", "b.PDF"), "utf8"), "%PDF-b2-izmenjen");
    assert.ok(!existsSync(join(out, "2026", "10", "beleska.txt")));
    // U skladištu nema otvorenog PDF-a ni otvorenog indeksa.
    for (const f of readdirSync(dest, { recursive: true })) assert.ok(!/\.(pdf|json)$/i.test(String(f)), `otvoren fajl u skladištu: ${f}`);
    // Skladište unutar izvora se odbija.
    await assert.rejects(runBackup({ ...opts, dest: join(src, "kopija") }), /unutar izvorne/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
