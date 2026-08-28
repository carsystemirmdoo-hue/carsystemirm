/**
 * Read-only IZVESTAJ o praznim i placeholder media mestima na javnom sajtu.
 *
 * Ovo je reporter, NE gate: ne obara build i ne donosi odluke. Ne menja izvorni
 * kod i ne povezuje fajlove sa proizvodima; sve identitetske odluke ostaju
 * ljudske. Sluzi kao ulaz za rucno odrzavanje kanonskih slotova u
 * `lib/content-assets/content-asset-slots.mjs`.
 *
 * Izlaz je masinski citljiv i STABILAN: bez vremena pokretanja i sa sortiranim
 * listama, da bi se dva prolaza mogla porediti diff-om.
 *
 * OGRANICENJE: `identicalSizeCandidates` poredi SAMO velicinu u bajtovima. To
 * NIJE dokaz bajt-identicnosti — dve razlicite slike iste velicine ce se naci
 * na tom spisku. Spisak je trag za ljudsku proveru, ne zakljucak.
 *
 * Symlinkovi se NE prate; prijavljuju se u `skippedSymlinks`.
 */
import { readFile, stat } from "node:fs/promises";
import { lstatSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".next-dev", ".next-verify",
  ".next-search-dev", ".next-qa-dev", "tmp", "out", "_incoming",
  "review-screenshots",
]);

/** Preskoceni symlinkovi — prijavljuju se, ne cute. */
const skippedSymlinks = [];

/**
 * Obilazak koji NE prati symlinkove.
 *
 * `lstat` umesto oslanjanja na `entry.isDirectory()`: symlink na folder bi
 * inace odveo obilazak van repozitorijuma.
 */
function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    let st;
    try {
      st = lstatSync(full);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) {
      skippedSymlinks.push(path.relative(ROOT, full));
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /\.(ts|tsx|mjs)$/.test(f)).sort();

const IMAGE_PATH = /["'`](\/(?:images|products|brands|art|documents)\/[A-Za-z0-9._\-/]+\.(?:webp|png|jpg|jpeg|avif|svg))["'`]/g;

const referenced = new Map(); // path -> Set(sourceFile)
const placeholderUses = [];
const emptyMedia = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const rel = path.relative(ROOT, file);

  for (const match of source.matchAll(IMAGE_PATH)) {
    const asset = match[1];
    if (!referenced.has(asset)) referenced.set(asset, new Set());
    referenced.get(asset).add(rel);
  }

  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/placeholder/i.test(line) && /(src|image|Image|asset)/.test(line)) {
      placeholderUses.push({ file: rel, line: index + 1, text: line.trim().slice(0, 140) });
    }
    if (/(image|src|cover|photo)\s*:\s*(null|undefined|""|'')/.test(line)) {
      emptyMedia.push({ file: rel, line: index + 1, text: line.trim().slice(0, 140) });
    }
    if (/(TODO|FIXME)/.test(line) && /(slik|foto|image|asset|banner|packshot)/i.test(line)) {
      placeholderUses.push({ file: rel, line: index + 1, text: line.trim().slice(0, 140) });
    }
  });
}

// Nepostojece putanje.
const missing = [];
for (const [asset, sources] of referenced) {
  try {
    await stat(path.join(ROOT, "public", asset));
  } catch {
    missing.push({ asset, sources: [...sources] });
  }
}

// Isti asset koriscen za vise proizvoda/slotova.
const shared = [...referenced.entries()]
  .filter(([, s]) => s.size > 1)
  .map(([asset, s]) => ({ asset, sources: [...s] }));

// Duplikati po sadrzaju u product folderima (ista fotografija, dva proizvoda).
const productDirs = ["public/products", "public/images/brands"];
const bySize = new Map();
for (const dir of productDirs) {
  let entries = [];
  try { entries = walk(path.join(ROOT, dir)); } catch { continue; }
  for (const f of entries) {
    if (!/\.(webp|png|jpg|jpeg|avif)$/.test(f)) continue;
    const size = statSync(f).size;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(path.relative(ROOT, f));
  }
}
const duplicates = [...bySize.entries()]
  .filter(([, list]) => list.length > 1)
  .map(([size, list]) => ({ size, files: list }));

/** Stabilan poredak: izlaz mora biti uporediv diff-om izmedju dva prolaza. */
const poRedu = (a, b) => String(a).localeCompare(String(b), "en");
const poMestu = (a, b) => poRedu(a.file, b.file) || a.line - b.line;

const report = {
  $comment:
    "Reporter, ne gate. `identicalSizeCandidates` poredi samo velicinu u bajtovima " +
    "i NIJE dokaz bajt-identicnosti. Bez vremena pokretanja, da bi izlaz bio uporediv.",
  referencedAssets: referenced.size,
  skippedSymlinks: [...skippedSymlinks].sort(poRedu),
  missingPaths: missing
    .map((m) => ({ asset: m.asset, sources: [...m.sources].sort(poRedu) }))
    .sort((a, b) => poRedu(a.asset, b.asset)),
  placeholderUses: [...placeholderUses].sort(poMestu),
  emptyMediaFields: [...emptyMedia].sort(poMestu),
  sharedAssets: shared
    .map((s) => ({ asset: s.asset, sources: [...s.sources].sort(poRedu) }))
    .sort((a, b) => poRedu(a.asset, b.asset)),
  identicalSizeCandidates: duplicates
    .map((d) => ({ size: d.size, files: [...d.files].sort(poRedu) }))
    .sort((a, b) => a.size - b.size),
};

console.log(JSON.stringify(report, null, 2));
