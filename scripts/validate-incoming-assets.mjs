/**
 * Read-only validator za dostavljene content assete.
 *
 * Rekurzivno obilazi `_incoming/assets/**` i proverava svaki fajl protiv
 * `content-asset-manifest.json`: naziv, format, magic bytes, dimenzije, alfa
 * kanal, velicinu i duplikate. NE upisuje nista i NE povezuje fajl sa
 * proizvodom — kod identity konflikta samo prijavljuje.
 *
 *   node scripts/validate-incoming-assets.mjs
 *
 * Izlazni kod: 0 kada nema problema, 1 kada postoji makar jedan.
 *
 * Prazan ili nepostojeci ulazni folder je NEUTRALAN prolaz (exit 0): to znaci
 * da nema sta da se proveri, a ne da je nesto proslo proveru. Broj stvarno
 * pregledanih fajlova se uvek ispisuje da se ta razlika vidi.
 *
 * Bezbednosne granice
 * -------------------
 * - symlink se NE prati i prijavljuje se kao problem;
 * - svaka stvarna putanja mora ostati unutar `_incoming/assets`;
 * - velicina se proverava PRE citanja sadrzaja;
 * - hash se racuna streamom, fajl se ne ucitava ceo u memoriju.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, lstatSync, openSync, readSync, closeSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INCOMING = path.join(ROOT, "_incoming/assets");
const MANIFEST = path.join(ROOT, "content-asset-manifest.json");

/**
 * Gornja granica velicine ulaznog fajla.
 *
 * Mereno nad postojecim assetima: 1000 fajlova u `public/`, median 27 KB,
 * p95 104 KB, najveci 2,03 MB; najveci zateceni ulazni PNG je 1,65 MB. Ulazni
 * fajlovi su izvori pre konverzije u WebP, pa smeju biti osetno veci od izlaza.
 * 12 MB daje oko sedmostruku rezervu nad najvecim vidjenim ulazom, a i dalje
 * hvata nesporazume (arhive, TIFF dumpove, video). Granica se proverava PRE
 * citanja sadrzaja.
 */
export const MAX_BYTES = 12 * 1024 * 1024;

/** Zaglavlje koje se cita za magic bytes i dimenzije. */
const HEADER_BYTES = 64 * 1024;

const ALLOWED_EXT = /\.(webp|png|jpe?g|avif)$/i;

if (!existsSync(MANIFEST)) {
  console.error(
    "Nedostaje content-asset-manifest.json. Pokrenite: npm run assets:register",
  );
  process.exit(1);
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

const expected = new Map();
for (const slot of manifest.slots) {
  for (const key of ["expectedDesktopFilename", "expectedMobileFilename"]) {
    const name = slot[key];
    if (!name || name.includes("{")) continue;
    expected.set(name, { slot, variant: key === "expectedDesktopFilename" ? "desktop" : "mobile" });
  }
}

/* ------------------------------------------------------------- obilazak */

/**
 * Rekurzivan obilazak koji NE prati symlinkove.
 *
 * `lstat` umesto `stat`: symlink na folder van korena inace odvede obilazak
 * bilo gde. Symlink se ne preskace tiho — vraca se kao nalaz, da bi validator
 * mogao da ga prijavi kao problem.
 */
function walk(dir, out = { files: [], symlinks: [] }) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const full = path.join(dir, entry.name);
    let st;
    try {
      st = lstatSync(full);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) {
      out.symlinks.push(full);
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.files.push({ full, size: st.size });
  }
  return out;
}

/** Da li stvarna putanja ostaje unutar dozvoljenog korena. */
function unutarKorena(file, koren) {
  try {
    const stvarna = realpathSync(file);
    const korenStvarni = realpathSync(koren);
    return stvarna === korenStvarni || stvarna.startsWith(korenStvarni + path.sep);
  } catch {
    return false;
  }
}

/** Prvih `HEADER_BYTES` bajtova — dovoljno za magic bytes i dimenzije. */
function readHeader(file) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    const read = readSync(fd, buf, 0, HEADER_BYTES, 0);
    return buf.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

/** SHA-256 streamom; fajl se ne ucitava ceo u memoriju. */
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

/* --------------------------------------------------------- format i alfa */

/** Minimalno citanje formata i dimenzija iz zaglavlja, bez zavisnosti. */
function readImageMeta(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return {
      format: "png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      hasAlpha: [4, 6].includes(buffer[25]),
    };
  }
  if (buffer.length >= 16 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = buffer.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X") {
      return { format: "webp", width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3), hasAlpha: Boolean(buffer[20] & 0x10) };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, hasAlpha: Boolean((bits >> 28) & 1) };
    }
    if (chunk === "VP8 ") {
      return { format: "webp", width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, hasAlpha: false };
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { format: "jpeg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), hasAlpha: false };
      }
      offset += 2 + length;
    }
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp" && /avif|avis/.test(buffer.subarray(8, 12).toString("ascii"))) {
    return { format: "avif", width: null, height: null, hasAlpha: null };
  }
  return null;
}

/** Ekstenzija koju magic bytes stvarno potvrdjuju. */
function formatIzEkstenzije(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  return ext.replace(".", "");
}

/**
 * Heuristika za lazni checkerboard i potpuno neprovidan alfa kanal.
 *
 * Koristi Pillow preko `python3` ako je dostupan. Bez njega se dubinska
 * analiza preskace — osnovne provere i dalje rade.
 */
function analysePixels(file) {
  try {
    const script = `
import sys, json
from PIL import Image
im = Image.open(sys.argv[1])
out = {"alphaIsFullyOpaque": False, "looksLikePaintedCheckerboard": False,
       "alphaMin": None, "alphaMax": None}
if "A" in im.getbands():
    alpha = im.getchannel("A")
    lo, hi = alpha.getextrema()
    out["alphaMin"], out["alphaMax"] = lo, hi
    out["alphaIsFullyOpaque"] = lo == 255 and hi == 255
rgb = im.convert("RGB")
w, h = rgb.size
corner = rgb.crop((0, 0, min(64, w), min(64, h)))
colours = corner.getcolors(maxcolors=64) or []
if len(colours) == 2:
    (c1, v1), (c2, v2) = sorted(colours, key=lambda x: -x[0])[:2]
    def light(v):
        return all(ch > 180 for ch in v)
    if light(v1) and light(v2) and abs(c1 - c2) / max(c1 + c2, 1) < 0.35:
        out["looksLikePaintedCheckerboard"] = True
print(json.dumps(out))
`;
    const result = spawnSync("python3", ["-c", script, file], { encoding: "utf8" });
    if (result.status === 0 && result.stdout) return JSON.parse(result.stdout);
  } catch {
    /* bez Pillow-a preskacemo dubinsku analizu */
  }
  return {};
}

/* ------------------------------------------------------------ duplikati */

const publicHashes = new Map();
{
  const { files } = walk(path.join(ROOT, "public"));
  for (const { full } of files) {
    if (!ALLOWED_EXT.test(full)) continue;
    const hash = await hashFile(full);
    if (!publicHashes.has(hash)) publicHashes.set(hash, []);
    publicHashes.get(hash).push(path.relative(ROOT, full));
  }
}

/* -------------------------------------------------------------- provera */

if (!existsSync(INCOMING)) {
  console.log(`Folder ${path.relative(ROOT, INCOMING)} ne postoji — nema fajlova za proveru.`);
  console.log(`pregledano: 0, problema: 0, ocekivanih naziva u manifestu: ${expected.size}`);
  process.exit(0);
}

const { files, symlinks } = walk(INCOMING);
let problems = 0;

for (const link of symlinks) {
  problems += 1;
  console.log(`PROBLEM ${path.relative(ROOT, link)}`);
  console.log("        - symlink: ne prati se i ne prihvata se kao ulazni asset");
}

let pregledano = 0;

for (const { full, size } of files) {
  const rel = path.relative(ROOT, full);
  const file = path.basename(full);
  const issues = [];
  pregledano += 1;

  if (!unutarKorena(full, INCOMING)) {
    issues.push("stvarna putanja izlazi iz `_incoming/assets`");
  }

  // Velicina PRE citanja sadrzaja.
  if (size > MAX_BYTES) {
    issues.push(
      `fajl je ${(size / 1048576).toFixed(2)} MB, iznad granice ${(MAX_BYTES / 1048576).toFixed(0)} MB — sadrzaj nije ni citan`,
    );
  }

  if (/^\._/.test(file)) {
    issues.push("AppleDouble resource-fork fajl (`._*`) — ne ide u javne assete");
  }
  if (file === ".DS_Store") issues.push(".DS_Store — ne ide u javne assete");
  if (!ALLOWED_EXT.test(file)) {
    issues.push("nedozvoljena ekstenzija (podrzano: webp, png, jpg, jpeg, avif)");
  }
  if (file !== file.toLowerCase()) issues.push("naziv nije lowercase");
  if (/\.(png|webp|jpe?g|avif)\.(png|webp|jpe?g|avif)$/i.test(file)) {
    issues.push("dupla ekstenzija (npr. .png.png) — ispravi naziv pre importa");
  }
  if (/\s/.test(file)) issues.push("naziv sadrzi razmak");
  if (/[čćžšđ]/i.test(file)) issues.push("naziv sadrzi dijakritiku");
  if (/(final|copy|new|v\d+)(?=[-._])/i.test(file)) {
    issues.push("naziv sadrzi 'final'/'copy'/'new'/'vN'");
  }
  if (/^(chatgpt|dall[-_ ]?e|midjourney|firefly|stable[-_ ]?diffusion|gemini|sora)\b/i.test(file)) {
    issues.push(
      "naziv ukazuje na AI-generisanu sliku; ambalaza, etikete i logotipi se ne generisu vestacki",
    );
  }

  const match = expected.get(file);
  if (!match && ALLOWED_EXT.test(file) && !/^\._/.test(file)) {
    issues.push("naziv nije u manifestu — proverite `expectedDesktopFilename`/`expectedMobileFilename`");
  }

  // Sadrzaj se cita SAMO kada je velicina u granicama.
  let meta = null;
  if (size <= MAX_BYTES) {
    try {
      meta = readImageMeta(readHeader(full));
    } catch {
      issues.push("zaglavlje se ne moze procitati");
    }
    if (!meta) {
      if (ALLOWED_EXT.test(file)) issues.push("magic bytes ne odgovaraju nijednom podrzanom formatu");
    } else {
      const ocekivan = formatIzEkstenzije(file);
      if (ocekivan && meta.format !== ocekivan) {
        issues.push(`ekstenzija kaze ${ocekivan}, magic bytes kazu ${meta.format}`);
      }
      Object.assign(meta, analysePixels(full));

      const slot = match?.slot;
      const dims = /(\d+)x(\d+)/.exec(slot?.minDimensions ?? "");
      if (dims && meta.width && meta.height) {
        const [, minW, minH] = dims.map(Number);
        if (meta.width < minW || meta.height < minH) {
          issues.push(`dimenzije ${meta.width}x${meta.height} su ispod minimuma ${minW}x${minH}`);
        }
      }
      const expectsTransparent = slot?.background === "transparent" || /packshot/i.test(file);
      if (expectsTransparent && meta.hasAlpha !== null) {
        if (!meta.hasAlpha) {
          issues.push("ocekuje se transparentna pozadina, fajl uopste nema alfa kanal");
        } else if (meta.alphaIsFullyOpaque) {
          issues.push("alfa kanal postoji ali je potpuno neprovidan — pozadina nije stvarno transparentna");
        }
        if (meta.looksLikePaintedCheckerboard) {
          issues.push("detektovan checkerboard urezan u piksele: lazna transparentnost, a ne alfa kanal");
        }
        if (meta.alphaMin != null && meta.alphaMin !== 0) {
          issues.push(`alpha min = ${meta.alphaMin}, ocekivano 0 (nema stvarno providnih piksela)`);
        }
        if (meta.alphaMax != null && meta.alphaMax !== 255) {
          issues.push(`alpha max = ${meta.alphaMax}, ocekivano 255 (proizvod nije potpuno neproviran)`);
        }
      }
      if (slot?.background === "full" && meta.hasAlpha) {
        issues.push("slot zahteva punu pozadinu, fajl ima alfa kanal (moguce providne ivice)");
      }

      const hash = await hashFile(full);
      if (publicHashes.has(hash)) {
        issues.push(`duplikat postojeceg asseta: ${publicHashes.get(hash).join(", ")}`);
      }
    }
  }

  const blockedByIdentity =
    match && ["NEEDS_IDENTITY_RESOLUTION", "NEEDS_PRODUCT_DECISION"].includes(match.slot.status);

  if (issues.length === 0 && !blockedByIdentity) {
    console.log(`OK      ${rel} -> ${match.slot.slotId} (${match.variant})`);
    continue;
  }

  problems += 1;
  console.log(`PROBLEM ${rel}`);
  for (const issue of issues) console.log(`        - ${issue}`);
  if (blockedByIdentity) {
    console.log(`        - slot je ${match.slot.status}: fajl se NE povezuje automatski, potrebna ljudska odluka`);
  }
}

console.log(
  `\npregledano: ${pregledano} fajlova (+${symlinks.length} symlink), problema: ${problems}, ` +
    `ocekivanih naziva u manifestu: ${expected.size}`,
);
process.exit(problems === 0 ? 0 : 1);
