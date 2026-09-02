import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verifikacija smoke paketa — nad STVARNIM tokom, ne nad nizovima.
 *
 * Raspakuje isporučeni ZIP u putanju koja sadrži razmake i `ČĆŽŠĐ`, pa iz TE
 * putanje pokreće ceo connector suite. To je jedini način da se uhvati kvar
 * koji se u repozitorijumu ne vidi: projekat stoji na putanji bez razmaka i bez
 * srpskih slova, pa je procenat-kodirana putanja godinu dana izgledala ispravno.
 *
 *   npm run connector:smoke:verify
 *
 * Ne izvršava Windows smoke i ne glumi ga.
 */

const OVDE = dirname(fileURLToPath(import.meta.url));
const KOREN = resolve(OVDE, "..", "..");

/** Putanja koja NAMERNO nosi razmake i srpska slova. */
const UNICODE_IME = "Provera Paketa ČĆŽŠĐ";

const nalazi = [];
function korak(naziv, fn) {
  try {
    const detalj = fn();
    nalazi.push({ naziv, ok: true, detalj: detalj ?? "" });
    console.log(`OK    ${naziv}${detalj ? " :: " + detalj : ""}`);
  } catch (e) {
    nalazi.push({ naziv, ok: false, detalj: e.message });
    console.error(`PAD   ${naziv} :: ${e.message}`);
  }
}

if (process.platform === "win32") {
  /*
   * Na Windowsu bi ovaj alat bio suvišan i obmanjujuć: tamo se pokreće STVARNI
   * smoke (`smoke\RUN-SMOKE.cmd`), a ne provera pakovanja.
   */
  console.error("Ova provera se pokreće na mašini koja PAKUJE (macOS/Linux).");
  console.error("Na Windowsu se pokreće sam smoke: smoke\\RUN-SMOKE.cmd");
  process.exit(2);
}

/* --- 1. Pronađi isporučeni ZIP za tekući HEAD. -------------------------- */
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOREN, encoding: "utf8" }).trim();
const KRATKI = HEAD.slice(0, 7);
const IME = `carsystem-windows-smoke-${KRATKI}`;
const IZLAZ = process.env.CS_SMOKE_OUT_DIR
  ? resolve(process.env.CS_SMOKE_OUT_DIR)
  : join(KOREN, "..", "Carsystem-Windows-Smoke");
const ZIP = join(IZLAZ, `${IME}.zip`);

console.log(`Verifikacija paketa za HEAD ${KRATKI}`);
console.log("");

korak("ZIP postoji za tekući HEAD", () => {
  if (!statSync(ZIP).isFile()) throw new Error("nije fajl");
  const sha = createHash("sha256").update(readFileSync(ZIP)).digest("hex");
  return `${statSync(ZIP).size} bajtova, sha256=${sha}`;
});

/* --- 2. Raspakuj u Unicode putanju sa razmacima. ------------------------ */
const baza = mkdtempSync(join(tmpdir(), "cs-verify-"));
const unicodeKoren = join(baza, UNICODE_IME, "raspakovano");
mkdirSync(unicodeKoren, { recursive: true });
const PAKET = join(unicodeKoren, IME);

korak(`raspakivanje u putanju „${UNICODE_IME}“`, () => {
  execFileSync("unzip", ["-q", ZIP, "-d", unicodeKoren]);
  if (!statSync(PAKET).isDirectory()) throw new Error("koren paketa nedostaje");
  if (!/ /.test(PAKET) || !/[ČĆŽŠĐ]/.test(PAKET)) throw new Error("putanja nije vektor");
  return "putanja nosi razmak i srpska slova";
});

/* --- 3. Manifest mora da opisuje TAČNO ono što je raspakovano. ---------- */
korak("manifest: hash, veličina, bez viška i manjka", () => {
  const man = readFileSync(join(PAKET, "MANIFEST.md"), "utf8");
  const unosi = [...man.matchAll(/^\| `([0-9a-f]{64})` \| (\d+) \| `(.+?)` \|$/gm)]
    .map((m) => ({ sha: m[1], n: Number(m[2]), p: m[3] }));
  if (unosi.length === 0) throw new Error("manifest je prazan");

  const naDisku = [];
  const hodaj = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) hodaj(p);
      else naDisku.push(relative(PAKET, p).split(sep).join("/"));
    }
  };
  hodaj(PAKET);

  const lose = [];
  for (const u of unosi) {
    const f = join(PAKET, u.p);
    const b = readFileSync(f);
    if (b.length !== u.n) lose.push(`${u.p}: veličina`);
    if (createHash("sha256").update(b).digest("hex") !== u.sha) lose.push(`${u.p}: hash`);
  }
  const skup = new Set(unosi.map((u) => u.p));
  const visak = naDisku.filter((p) => p !== "MANIFEST.md" && !skup.has(p));
  if (lose.length || visak.length) {
    throw new Error(`neslaganje: ${[...lose, ...visak.map((v) => v + ": višak")].join(", ")}`);
  }
  return `${unosi.length} fajlova, sve se poklapa`;
});

/* --- 4. Ceo suite IZ te putanje. ---------------------------------------- */
/*
 * Ovo je srž provere.
 *
 * Ista sadržina iz obične putanje prolazi; ako procenat-kodiranje ikad ponovo
 * uđe, ovde — i samo ovde — pada.
 */
let rezimeUnicode = null;
korak("connector suite IZ Unicode putanje", () => {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap",
    ...readdirSync(join(PAKET, "connector", "test"))
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => join(PAKET, "connector", "test", f))],
    { encoding: "utf8", cwd: PAKET, timeout: 600000 });

  const izlaz = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const broj = (k) => Number((izlaz.match(new RegExp(`^# ${k} (\\d+)`, "m")) ?? [])[1] ?? -1);
  const pass = broj("pass");
  const fail = broj("fail");
  const skip = broj("skipped");
  const winSkip = (izlaz.match(/^ok \d+ - \[WIN\][^\n]*# SKIP/gm) ?? []).length;

  rezimeUnicode = { pass, fail, skip, winSkip };
  if (fail !== 0) {
    const prvi = (izlaz.match(/^not ok \d+ - (.+)$/m) ?? [])[1] ?? "?";
    throw new Error(`${fail} palo, prvi: ${prvi}`);
  }
  /*
   * Van Windowsa [WIN] testovi MORAJU biti preskočeni, i to izričito.
   * Da ih ovde nema, prolaz bi tvrdio nešto što nije proveravao.
   *
   * Očekivani broj se BROJI iz spakovanog test fajla, ne kuca.
   *
   * Ranije je stajala konstanta `10`; čim je [WIN] skup dobio jedanaesti test,
   * verifikacija je pala nad ispravnim paketom — isti oblik greške koji je
   * `W15-win` imao sa rečenicom „9 od 10". Broj koji se menja ne sme biti
   * zapisan na dva mesta.
   */
  const izvorWin = readFileSync(
    join(PAKET, "connector", "test", "windows-smoke.test.mjs"),
    "utf8",
  );
  const ocekivanoWin = (izvorWin.match(/^test\("\[WIN\]/gm) ?? []).length;
  if (ocekivanoWin === 0) throw new Error("spakovan [WIN] skup nema nijedan test");
  if (winSkip !== ocekivanoWin) {
    throw new Error(`očekivano ${ocekivanoWin} [WIN] skipova, nađeno ${winSkip}`);
  }
  return `pass=${pass} fail=${fail} skipped=${skip} ([WIN] ${winSkip}/${ocekivanoWin})`;
});

/* --- 5. Isti suite iz obične putanje — kontrola. ------------------------ */
korak("connector suite iz obične putanje (kontrola)", () => {
  const plain = join(baza, "plain");
  mkdirSync(plain, { recursive: true });
  execFileSync("unzip", ["-q", ZIP, "-d", plain]);
  const koren = join(plain, IME);
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap",
    ...readdirSync(join(koren, "connector", "test"))
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => join(koren, "connector", "test", f))],
    { encoding: "utf8", cwd: koren, timeout: 600000 });
  const izlaz = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const broj = (k) => Number((izlaz.match(new RegExp(`^# ${k} (\\d+)`, "m")) ?? [])[1] ?? -1);
  const pass = broj("pass");
  const fail = broj("fail");
  if (fail !== 0) throw new Error(`${fail} palo iz obične putanje`);
  /*
   * Obe putanje moraju dati ISTI broj.
   *
   * Razlika bi značila da ime foldera i dalje utiče na ishod — tačno kvar koji
   * se ovim popravlja.
   */
  if (rezimeUnicode && pass !== rezimeUnicode.pass) {
    throw new Error(`obična ${pass} ≠ unicode ${rezimeUnicode.pass}`);
  }
  return `pass=${pass}, isto kao iz Unicode putanje`;
});

/* --- 6. Runner odbija izvršenje na ovoj platformi. ---------------------- */
korak("runner odbija izvršenje van Windowsa", () => {
  const r = spawnSync(process.execPath, [join(PAKET, "smoke", "run-smoke.mjs")], {
    encoding: "utf8", timeout: 60000,
  });
  if (r.status !== 2) throw new Error(`očekivan izlaz 2, dobijen ${r.status}`);
  if (!/ISKLJUČIVO na Windows/.test(r.stderr)) throw new Error("nema jasnog odbijanja");
  if (/SMOKE PASS/.test(`${r.stdout}${r.stderr}`)) throw new Error("runner tvrdi PASS van Windowsa");
  return "izlaz 2, bez ijedne zelene tvrdnje";
});

korak("cleanup odbija izvršenje van Windowsa", () => {
  const r = spawnSync(process.execPath, [join(PAKET, "smoke", "cleanup.mjs")], {
    encoding: "utf8", timeout: 60000,
  });
  if (r.status !== 2) throw new Error(`očekivan izlaz 2, dobijen ${r.status}`);
  return "izlaz 2";
});

/* --- 7. Spakovan konektor radi iz Unicode putanje. ---------------------- */
korak("spakovan konektor se pokreće iz Unicode putanje", () => {
  const r = spawnSync("sh", [join(PAKET, "connector", "dist", "connector.sh"), "--help"], {
    encoding: "utf8", timeout: 60000,
  });
  if (r.status !== 0) throw new Error(`izlaz ${r.status}`);
  for (const k of ["doctor", "init", "poll-once", "watch", "status"]) {
    if (!r.stdout.includes(k)) throw new Error(`nedostaje komanda ${k}`);
  }
  return "pokretač i sve komande prisutne";
});

korak("spakovan konektor odbija test skladište ključa (fail closed)", () => {
  /*
   * Van Windowsa DPAPI ne postoji, pa se ovde vidi upravo grana koja na
   * Windowsu ostaje nedostupna: paket radije STAJE nego što padne na plaintext.
   */
  const r = spawnSync("sh", [join(PAKET, "connector", "dist", "connector.sh"), "doctor"], {
    encoding: "utf8", timeout: 60000,
    env: { ...process.env, CS_CONNECTOR_INSECURE_KEYSTORE: "1", CS_CONNECTOR_STATE_DIR: join(baza, "stanje") },
  });
  if (!/insecure_keystore_refused/.test(r.stdout)) throw new Error("nije odbijeno");
  if (/test-insecure/.test(r.stdout)) throw new Error("izabrano test skladište");
  return "insecure_keystore_refused";
});

/* --- Rezime. ------------------------------------------------------------ */
const palo = nalazi.filter((n) => !n.ok).length;
console.log("");
console.log(`Ukupno: ${nalazi.length - palo}/${nalazi.length} prošlo.`);
console.log("");
if (palo === 0) {
  console.log("Paket je lokalno potvrđen iz Unicode/space putanje.");
  console.log("Windows smoke NIJE izvršen — pokreće se na Windowsu, ručno.");
} else {
  console.log("Paket NIJE potvrđen. Ne predavati.");
}
rmSync(baza, { recursive: true, force: true });
process.exitCode = palo === 0 ? 0 : 1;
