/**
 * IZVRSNI testovi content-asset infrastrukture.
 *
 * Ponasanje se dokazuje pokretanjem stvarnih skripti nad PRIVREMENIM fixture
 * stablima, ne regexom nad izvorom. Svaki test pravi svoj `mkdtemp` koren i
 * brise ga za sobom; stvarni `_incoming` se nikada ne dira.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, readFile, symlink, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  CONTENT_ASSET_SLOTS,
  SLOT_COLUMNS,
  normalizeRelativePath,
  sortedSlots,
  targetFilesFor,
  validateSlots,
} from "./content-asset-slots.mjs";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const VALIDATOR = path.join(REPO, "scripts/validate-incoming-assets.mjs");
const GENERATOR = path.join(REPO, "scripts/build-content-asset-register.mjs");

/** PNG 1x1 bez alfe (colourType 2). */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP8//8/AwQABf4C/qc1gYQAAAAASUVORK5CYII=",
  "base64",
);

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "ca-fixture-"));
  await mkdir(path.join(dir, "_incoming/assets"), { recursive: true });
  await mkdir(path.join(dir, "public"), { recursive: true });
  await cp(path.join(REPO, "content-asset-manifest.json"), path.join(dir, "content-asset-manifest.json"));
  // Generator pise i Markdown blokove, pa mu i taj fajl mora biti u fixture-u.
  await cp(path.join(REPO, "CONTENT-ASSET-REGISTER.md"), path.join(dir, "CONTENT-ASSET-REGISTER.md"));
  return dir;
}

function run(script, cwd, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/* ==================================================================
 * Kanonski podaci
 * ================================================================ */

test("[izvrsni] kanonski slotovi prolaze validaciju i imaju jedinstvene ID-jeve", () => {
  assert.equal(validateSlots(CONTENT_ASSET_SLOTS).length, 0);
  const ids = CONTENT_ASSET_SLOTS.map((s) => s.slotId);
  assert.equal(new Set(ids).size, ids.length, "duplirani slotId u kanonskim podacima");
  assert.ok(CONTENT_ASSET_SLOTS.length >= 40, `ocekivano bar 40 slotova, ima ${CONTENT_ASSET_SLOTS.length}`);
});

test("[izvrsni] duplirani slotId je odbijen", () => {
  const s = [...CONTENT_ASSET_SLOTS.slice(0, 2), { ...CONTENT_ASSET_SLOTS[0] }];
  const p = validateSlots(s);
  assert.ok(p.some((x) => /duplikat slotId/.test(x)), p.join(" | "));
});

test("[izvrsni] duplirana ciljna putanja je odbijena", () => {
  const prvi = CONTENT_ASSET_SLOTS.find((s) => targetFilesFor(s).length > 0);
  const klon = { ...prvi, slotId: `${prvi.slotId}.klon` };
  const p = validateSlots([prvi, klon]);
  assert.ok(p.some((x) => /ciljna putanja se sudara/.test(x)), p.join(" | "));
});

test("[izvrsni] path traversal i apsolutne putanje su odbijene", () => {
  for (const [put, razlog] of [
    ["../secrets/x.webp", /`\.\.`/],
    ["/etc/passwd", /apsolutna/],
    ["C:/tmp/x.webp", /apsolutna/],
    ["public\\images\\x.webp", /backslash/],
    ["public/x\0.webp", /NUL/],
  ]) {
    const r = normalizeRelativePath(put);
    assert.equal(r.ok, false, `${put} je prosao`);
    assert.match(r.reason, razlog);
  }
  // Ista pravila kroz validaciju slota.
  const los = { ...CONTENT_ASSET_SLOTS[0], slotId: "los", targetPath: "public/../etc/" };
  assert.ok(validateSlots([los]).some((x) => /targetPath odbijen/.test(x)));
});

test("[izvrsni] targetPath mora ostati unutar public/", () => {
  const los = { ...CONTENT_ASSET_SLOTS[0], slotId: "van", targetPath: "assets/images/" };
  assert.ok(validateSlots([los]).some((x) => /van "public\/"/.test(x)));
});

test("[izvrsni] redosled je stabilan i nezavisan od redosleda pisanja", () => {
  const a = sortedSlots(CONTENT_ASSET_SLOTS).map((s) => s.slotId);
  const b = sortedSlots([...CONTENT_ASSET_SLOTS].reverse()).map((s) => s.slotId);
  assert.deepEqual(a, b);
});

/* ==================================================================
 * Generator
 * ================================================================ */

test("[izvrsni] dva generisanja daju bajt-identican CSV i JSON", async () => {
  const dir = await fixture();
  try {
    await cp(path.join(REPO, "public"), path.join(dir, "public"), { recursive: true });
    assert.equal(run(GENERATOR, dir).code, 0);
    const csv1 = await readFile(path.join(dir, "CONTENT-ASSET-REGISTER.csv"));
    const json1 = await readFile(path.join(dir, "content-asset-manifest.json"));
    await new Promise((r) => setTimeout(r, 1100));
    assert.equal(run(GENERATOR, dir).code, 0);
    const csv2 = await readFile(path.join(dir, "CONTENT-ASSET-REGISTER.csv"));
    const json2 = await readFile(path.join(dir, "content-asset-manifest.json"));
    assert.ok(csv1.equals(csv2), "CSV nije reproducibilan");
    assert.ok(json1.equals(json2), "JSON nije reproducibilan");
    assert.doesNotMatch(json1.toString("utf8"), /generatedAt/, "vreme je zavrsilo u versioned fajlu");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] --check pada kada se generisani izlaz rucno promeni", async () => {
  const dir = await fixture();
  try {
    await cp(path.join(REPO, "public"), path.join(dir, "public"), { recursive: true });
    assert.equal(run(GENERATOR, dir).code, 0);
    assert.equal(run(GENERATOR, dir, ["--check"]).code, 0, "cist --check ne prolazi");
    const p = path.join(dir, "content-asset-manifest.json");
    await writeFile(p, (await readFile(p, "utf8")) + "\n");
    const r = run(GENERATOR, dir, ["--check"]);
    assert.equal(r.code, 1, "--check nije pao na izmenjenom izlazu");
    assert.match(r.out, /sadrzaj se razlikuje/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] --check nista ne upisuje", async () => {
  const dir = await fixture();
  try {
    await cp(path.join(REPO, "public"), path.join(dir, "public"), { recursive: true });
    run(GENERATOR, dir);
    const pre = await readFile(path.join(dir, "CONTENT-ASSET-REGISTER.csv"));
    await rm(path.join(dir, "content-asset-manifest.json"));
    run(GENERATOR, dir, ["--check"]);
    const posle = await readFile(path.join(dir, "CONTENT-ASSET-REGISTER.csv"));
    assert.ok(pre.equals(posle), "--check je pisao");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/* ==================================================================
 * Validator ulaznih asseta
 * ================================================================ */

test("[izvrsni] prazan ulaz je neutralan prolaz i to kaze", async () => {
  const dir = await fixture();
  try {
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 0);
    assert.match(r.out, /pregledano: 0/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] rekurzivno nalazi ugnezden fajl i pada zbog njega", async () => {
  const dir = await fixture();
  try {
    const duboko = path.join(dir, "_incoming/assets/unpacked/brand/products");
    await mkdir(duboko, { recursive: true });
    await writeFile(path.join(duboko, "nepoznat-naziv.png"), PNG_1x1);
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1, "ugnezden los fajl nije oborio validator");
    assert.match(r.out, /pregledano: 1/, "ugnezden fajl nije ni pregledan");
    assert.match(r.out, /unpacked\/brand\/products\/nepoznat-naziv\.png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] symlink je odbijen i ne prati se", async () => {
  const dir = await fixture();
  // Meta VAN korena: inace bi je obilazak nasao i bez symlinka.
  const van = await mkdtemp(path.join(tmpdir(), "ca-van-"));
  try {
    await writeFile(path.join(van, "tajna.png"), PNG_1x1);
    await symlink(van, path.join(dir, "_incoming/assets/link"));
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /symlink: ne prati se/);
    assert.doesNotMatch(r.out, /tajna\.png/, "obilazak je usao kroz symlink");
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(van, { recursive: true, force: true });
  }
});

test("[izvrsni] prevelik fajl je odbijen PRE citanja sadrzaja", async () => {
  const dir = await fixture();
  try {
    const f = path.join(dir, "_incoming/assets/ogroman.png");
    // 13 MB smeca: nema PNG potpis, pa bi provera formata pala DRUGACIJOM porukom.
    await writeFile(f, Buffer.alloc(13 * 1024 * 1024, 0x41));
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /iznad granice 12 MB — sadrzaj nije ni citan/);
    assert.doesNotMatch(r.out, /magic bytes ne odgovaraju/, "sadrzaj je ipak citan");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] dupla ekstenzija je odbijena", async () => {
  const dir = await fixture();
  try {
    await writeFile(path.join(dir, "_incoming/assets/x-packshot.png.png"), PNG_1x1);
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /dupla ekstenzija/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] AppleDouble je odbijen", async () => {
  const dir = await fixture();
  try {
    await writeFile(path.join(dir, "_incoming/assets/._x.png"), Buffer.from([0, 5, 22, 7]));
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /AppleDouble/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] ekstenzija koja ne odgovara magic bytes-ima je odbijena", async () => {
  const dir = await fixture();
  try {
    // PNG sadrzaj pod .webp ekstenzijom.
    await writeFile(path.join(dir, "_incoming/assets/lazna.webp"), PNG_1x1);
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /ekstenzija kaze webp, magic bytes kazu png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] SHA-256 duplikat postojeceg public asseta je prijavljen", async () => {
  const dir = await fixture();
  try {
    await mkdir(path.join(dir, "public/images"), { recursive: true });
    await writeFile(path.join(dir, "public/images/vec-postoji.png"), PNG_1x1);
    await writeFile(path.join(dir, "_incoming/assets/kopija.png"), PNG_1x1);
    const r = run(VALIDATOR, dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /duplikat postojeceg asseta: public\/images\/vec-postoji\.png/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/* ==================================================================
 * Paritet dokumentacije
 * ================================================================ */

test("[izvrsni] Markdown registar je TACNO jednak skupu kanonskih slotova", async () => {
  /*
   * Ne „svaki pomenuti ID postoji" — to bi propustilo izostavljen slot. Ovde se
   * poredi ceo skup: nista ne fali, nista nije visak, nista nije dvaput.
   */
  const md = await readFile(path.join(REPO, "CONTENT-ASSET-REGISTER.md"), "utf8");
  const blok = md.slice(
    md.indexOf("<!-- GENERATED:registry"),
    md.indexOf("<!-- /GENERATED:registry"),
  );
  assert.ok(blok.length > 0, "nema GENERATED:registry bloka");

  const idjevi = [...blok.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
  const kanonski = CONTENT_ASSET_SLOTS.map((s) => s.slotId);

  assert.equal(idjevi.length, kanonski.length, `MD ima ${idjevi.length}, kanonskih ${kanonski.length}`);
  assert.equal(new Set(idjevi).size, idjevi.length, "neki slotId je naveden dvaput");
  assert.deepEqual(
    [...new Set(idjevi)].sort(),
    [...kanonski].sort(),
    "skup MD ID-jeva nije jednak kanonskom skupu",
  );
});

test("[izvrsni] Markdown ponavlja i status, prioritet, ciljnu putanju i naziv fajla — sve provereno", async () => {
  const md = await readFile(path.join(REPO, "CONTENT-ASSET-REGISTER.md"), "utf8");
  const blok = md.slice(
    md.indexOf("<!-- GENERATED:registry"),
    md.indexOf("<!-- /GENERATED:registry"),
  );
  const redovi = new Map();
  for (const m of blok.matchAll(/^\| `([^`]+)` \| (.*) \|$/gm)) {
    redovi.set(m[1], m[2].split(" | "));
  }
  for (const slot of CONTENT_ASSET_SLOTS) {
    const celije = redovi.get(slot.slotId);
    assert.ok(celije, `${slot.slotId}: nema reda u MD`);
    // [ruta, sekcija, problem, ocekivani fajl, ciljna putanja, status]
    assert.equal(celije.at(-1), `\`${slot.status}\``, `${slot.slotId}: status se razlikuje`);
    assert.equal(celije.at(-2), `\`${slot.targetPath}\``, `${slot.slotId}: targetPath se razlikuje`);
    const ocekivan = slot.expectedDesktopFilename
      ? `\`${slot.expectedDesktopFilename}\``
      : "—";
    assert.equal(celije.at(-3), ocekivan, `${slot.slotId}: ocekivani fajl se razlikuje`);
  }
  // Prioritet: svaki slot mora biti u sekciji svog prioriteta.
  for (const p of ["P0", "P1", "P2", "P3"]) {
    const grupa = CONTENT_ASSET_SLOTS.filter((s) => s.priority === p);
    if (grupa.length === 0) continue;
    const start = blok.indexOf(`### ${p} `);
    assert.ok(start > -1, `nema sekcije ${p}`);
    const kraj = ["P0", "P1", "P2", "P3"]
      .map((x) => blok.indexOf(`### ${x} `))
      .filter((i) => i > start)
      .sort((a, b) => a - b)[0] ?? blok.length;
    const sekcija = blok.slice(start, kraj);
    assert.match(sekcija, new RegExp(`\\(${grupa.length}\\)`), `${p}: pogresan broj u naslovu`);
    for (const s of grupa) {
      assert.ok(sekcija.includes(`\`${s.slotId}\``), `${s.slotId} nije u sekciji ${p}`);
    }
  }
});

test("[izvrsni] commitovani CSV i JSON su u koraku sa kanonskim podacima", () => {
  const r = run(GENERATOR, REPO, ["--check"]);
  assert.equal(r.code, 0, `assets:register:check pada:\n${r.out}`);
});

test("[izvrsni] CSV zaglavlje odgovara SLOT_COLUMNS", async () => {
  const csv = await readFile(path.join(REPO, "CONTENT-ASSET-REGISTER.csv"), "utf8");
  assert.equal(csv.split("\n")[0], SLOT_COLUMNS.join(","));
  assert.ok(csv.endsWith("\n"), "CSV nema stabilan zavrsni newline");
});

test("[izvrsni] commitovani artefakti su tacno ono sto generator pravi", () => {
  /*
   * Ovaj test je u glavnom `npm test` lancu. Ako neko promeni kanonski modul i
   * zaboravi `npm run assets:register`, obican `npm test` mora pasti — ne sme
   * zavisiti od toga da li je neko rucno pokrenuo `assets:register:check`.
   */
  const r = run(GENERATOR, REPO, ["--check"]);
  assert.equal(r.code, 0, `commitovani izlazi nisu u koraku:\n${r.out}`);
});

test("[izvrsni] artefakti imaju stabilan zavrsni newline i tacne brojeve", async () => {
  const csv = await readFile(path.join(REPO, "CONTENT-ASSET-REGISTER.csv"), "utf8");
  const json = await readFile(path.join(REPO, "content-asset-manifest.json"), "utf8");
  const md = await readFile(path.join(REPO, "CONTENT-ASSET-REGISTER.md"), "utf8");

  assert.ok(csv.endsWith("\n") && !csv.endsWith("\n\n"), "CSV newline nije stabilan");
  assert.ok(json.endsWith("\n") && !json.endsWith("\n\n"), "JSON newline nije stabilan");
  assert.ok(md.endsWith("\n"), "MD nema zavrsni newline");

  const manifest = JSON.parse(json);
  assert.equal(manifest.totals.slots, 48, "totals.slots nije 48");
  assert.equal(manifest.slots.length, 48, "manifest.slots.length nije 48");
  assert.doesNotMatch(json, /generatedAt/, "vreme je u versioned fajlu");

  // Tacno 48 data redova: CSV celije umeju biti visecalne, pa se broji parsiranjem.
  const bezZaglavlja = csv.slice(csv.indexOf("\n") + 1);
  let redova = 0;
  let uNavodnicima = false;
  for (let i = 0; i < bezZaglavlja.length; i += 1) {
    const c = bezZaglavlja[i];
    if (c === '"') uNavodnicima = !uNavodnicima;
    else if (c === "\n" && !uNavodnicima) redova += 1;
  }
  assert.equal(redova, 48, `CSV ima ${redova} data redova, ocekivano 48`);
});

/* ==================================================================
 * Scanner — reporter, ali sa ugovorom
 * ================================================================ */

const SCANNER = path.join(REPO, "scripts/scan-content-assets.mjs");

async function scannerFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "ca-scan-"));
  await mkdir(path.join(dir, "components"), { recursive: true });
  await mkdir(path.join(dir, "public/products"), { recursive: true });
  /*
   * Fajlovi se PRAVE obrnutim redosledom od azbucnog. Da skener ne sortira,
   * izlaz bi pratio redosled obilaska i tvrdnja o poretku bi pala.
   */
  for (const ime of ["Z", "M", "A"]) {
    await writeFile(
      path.join(dir, `components/${ime}.tsx`),
      `export const v = "/images/${ime.toLowerCase()}.webp"; // placeholder image\n` +
        "export const e = { image: null };\n",
    );
  }
  // Dve RAZLICITE slike iste velicine — kandidat po velicini, ne po sadrzaju.
  await writeFile(path.join(dir, "public/products/p1.png"), Buffer.alloc(64, 0x11));
  await writeFile(path.join(dir, "public/products/p2.png"), Buffer.alloc(64, 0x22));
  return dir;
}

test("[izvrsni] scanner: dva pokretanja daju bajt-identican izlaz", async () => {
  const dir = await scannerFixture();
  try {
    const a = run(SCANNER, dir);
    await new Promise((r) => setTimeout(r, 1100));
    const b = run(SCANNER, dir);
    assert.equal(a.code, 0);
    assert.equal(a.out, b.out, "izlaz skenera nije stabilan izmedju dva prolaza");
    assert.doesNotMatch(a.out, /generatedAt/, "nestabilan timestamp u masinskom izlazu");

    /*
     * Determinizam NIJE isto sto i stabilan poredak: dva prolaza istog koda daju
     * isti redosled i kada je taj redosled obrnut. Zato se proverava da je izlaz
     * stvarno SORTIRAN, nezavisno od redosleda obilaska.
     */
    const izvestaj = JSON.parse(a.out);
    const kljuc = (x) => `${x.file}:${String(x.line).padStart(6, "0")}`;
    for (const polje of ["placeholderUses", "emptyMediaFields"]) {
      const lista = izvestaj[polje].map(kljuc);
      assert.ok(lista.length >= 3, `${polje}: fixture nije dao dovoljno unosa`);
      assert.deepEqual(lista, [...lista].sort(), `${polje} nije sortiran`);
    }
    const putanje = izvestaj.missingPaths.map((m) => m.asset);
    assert.deepEqual(putanje, [...putanje].sort(), "missingPaths nije sortiran");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("[izvrsni] scanner ne prati symlink i prijavljuje ga", async () => {
  const dir = await scannerFixture();
  /*
   * Meta symlinka mora biti VAN fixture korena. Da je unutra, obilazak bi je
   * nasao direktno i test bi „prosao" a da symlink nije ni bio na ispitu.
   */
  const van = await mkdtemp(path.join(tmpdir(), "ca-van-"));
  try {
    await writeFile(path.join(van, "Tajni.tsx"), 'export const x = "/images/tajna.webp";\n');
    await symlink(van, path.join(dir, "components/link"));
    const r = run(SCANNER, dir);
    const izvestaj = JSON.parse(r.out);
    assert.ok(
      izvestaj.skippedSymlinks.some((p) => p.endsWith("components/link")),
      "symlink nije prijavljen u skippedSymlinks",
    );
    assert.doesNotMatch(r.out, /tajna\.webp/, "obilazak je usao kroz symlink");
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(van, { recursive: true, force: true });
  }
});

test("[izvrsni] identicalSizeCandidates ne tvrdi sadrzajnu identicnost", async () => {
  const dir = await scannerFixture();
  try {
    const r = run(SCANNER, dir);
    const izvestaj = JSON.parse(r.out);
    const kandidat = izvestaj.identicalSizeCandidates.find((d) => d.size === 64);
    assert.ok(kandidat, "dva fajla iste velicine nisu prijavljena kao kandidati");
    assert.equal(kandidat.files.length, 2);
    // Fajlovi su RAZLICITOG sadrzaja — spisak je trag, ne zakljucak.
    const [f1, f2] = kandidat.files.map((f) => path.join(dir, f));
    const h1 = createHash("sha256").update(await readFile(f1)).digest("hex");
    const h2 = createHash("sha256").update(await readFile(f2)).digest("hex");
    assert.notEqual(h1, h2, "fixture nije postavljen: fajlovi su isti");
    assert.match(
      izvestaj.$comment,
      /NIJE dokaz bajt-identicnosti/,
      "izlaz ne upozorava da je poredjenje samo po velicini",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
