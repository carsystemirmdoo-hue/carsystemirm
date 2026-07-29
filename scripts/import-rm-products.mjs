import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const zipPath = process.argv[2] ?? "/Users/miledulic/Desktop/Proizvodi.zip";
const generatedDataPath = join(projectRoot, "data", "rm-imported-products.generated.json");
const publicImageRoot = join(projectRoot, "public", "images", "brands", "rm", "products");
const publicDocumentRoot = join(projectRoot, "public", "documents", "products", "rm");
const cwebpPath = "/opt/homebrew/bin/cwebp";

const duplicateFolder = "CLEAR Harden-R H 2P15";
const canonicalDuplicateFolder = "H 2P15 CLEAR Harden-R";
const emptyFolder = "CRYSTAL BASE";

const userPreparedSlugs = new Set([
  "c-5450-ghd-clear",
  "ghd-topcoat",
  "h-380-ghd-hardener",
  "p-2p81-race-wet-fill-r-white",
  "p-2p85-race-wet-fill-r-black",
]);

const assetReviewNotesBySlug = {
  "ghd-topcoat":
    "Dostavljena i izričito odobrena slika u GHD TOPCOAT folderu na etiketi prikazuje GHD HARDENER H 750.",
  "p-2p81-race-wet-fill-r-white":
    "Dostavljena i izričito odobrena slika u P 2P81 folderu na etiketi prikazuje kod P 2P91.",
};

const agilisSystemSlugs = new Set([
  "2220-agilis-activator",
  "2530-agilis-blender",
  "2560-agilis-amplifier",
  "c-2p42-race-finish-r",
  "h-2p15-clear-harden-r",
  "p-2p81-race-wet-fill-r-white",
  "ra-050x-agilis-mix",
]);

const onyxSystemSlugs = new Set([
  "2210-onyx-activator",
  "2520-onyx-easy-blender",
  "c-2a40-airtop",
  "h-2a14-topcure",
  "hb-032-hydromix",
  "hb-036-hydromix-tropical",
  "p-2a41-performfiller-white",
  "r-2a10-airtopthinn",
]);

const graphiteSystemSlugs = new Set([
  "c-5450-ghd-clear",
  "ghd-topcoat",
  "h-380-ghd-hardener",
  "p-5480-ghd-universal-epoxy",
  "p-5530-ghd-uni-wash",
]);

const sourceFeatureBySlug = {
  "2210-onyx-activator":
    "Aditiv za posebne ONYX HD primene i solid-color bazne slojeve prema tehničkom listu.",
  "2220-agilis-activator":
    "Aditiv za AGILIS enterijerske aplikacije i učvršćivač za AGILIS AMPLIFIER A 2560.",
  "2520-onyx-easy-blender":
    "Vodeni dodatak za ONYX HD BLEND'ART popravke i transparentni predpremaz.",
  "2530-agilis-blender":
    "Optimizuje orijentaciju efektnih čestica u zoni blend-in popravke; isporučuje se spreman za upotrebu.",
  "2560-agilis-amplifier":
    "Tonirajuća AGILIS komponenta za wet-on-wet rad na OEM e-coat panelima i unutrašnjim zonama.",
  "2p15-air-tune-r":
    "Dodatak Pioneer lakovima za bržu površinu bez prašine i raniju spremnost za završnu obradu.",
  "2p80-texture-tune-r":
    "Dodatak za kontrolisano formiranje teksture u kompatibilnim Pioneer bezbojnim lakovima.",
  "b-2p93-uv-bodyfill-r":
    "UV fini kit sa brzim procesom, dobrom obradivošću i antikorozivnom zaštitom prema tehničkom listu.",
  "c-2a40-airtop":
    "Vazdušno sušeći Advance bezbojni lak za produktivan rad, od manjih popravki do bočne strane vozila.",
  "c-2a46-ultratop":
    "Produktivan Advance bezbojni lak sa kratkim vremenom sušenja i smanjenom energijom očvršćavanja.",
  "c-2a54-performtop":
    "Univerzalni Advance bezbojni lak za širok spektar primena i jednostavan rad.",
  "c-2a57-mixtop":
    "Advance bezbojni lak pripremljen kao premixed rešenje prema zvaničnoj dokumentaciji.",
  "c-2a63-glosstop": "Advance bezbojni lak za završnicu visokog sjaja.",
  "c-2a64-glosstop": "Advance bezbojni lak za superioran sjaj i završni rezultat visokog nivoa.",
  "c-2a84-protecttop": "Scratch-resistant Advance bezbojni lak za povećanu površinsku zaštitu.",
  "c-2a93-mattop": "Mat Advance bezbojni lak namenjen popravci posebnih OEM mat završnica.",
  "c-2e10-clear-coat-premixed":
    "Element premixed bezbojni lak za primene od pojedinačnih panela do kompletnog prelakiranja.",
  "c-2e50-clear-coat":
    "Element bezbojni lak za primene od pojedinačnih panela do kompletnog prelakiranja.",
  "c-2p15-easy-finish-r":
    "Pioneer eSense bezbojni lak sa jednostavnom pripremom za širok spektar primena.",
  "c-2p30-uv-finish-r":
    "UVA-otvrdnjavajući Pioneer eSense lak za BLEND'ART i veoma kratak proces.",
  "c-2p42-race-finish-r":
    "Pioneer eSense bezbojni lak sa fleksibilnim procesom i optimizovanim vremenom rada.",
  "c-2p45-speed-finish-r":
    "Brzosušeći Pioneer eSense bezbojni lak za više panela i manje popravke.",
  "c-2p55-multi-finish-r":
    "Višenamenski Pioneer eSense bezbojni lak sa jednostavnom primenom.",
  "c-2p62-bright-finish-r":
    "Pioneer eSense bezbojni lak za završnicu naglašenog sjaja.",
  "c-2p85-power-finish-r":
    "Scratch-resistant Pioneer eSense bezbojni lak za visoku površinsku zaštitu.",
  "c-2p91-mat-finish-r":
    "Mat Pioneer eSense bezbojni lak za popravku OEM mat završnica.",
  "c-2p96-satin-finish-r":
    "Satin Pioneer eSense bezbojni lak za popravku OEM mat i svilenkasto-mat završnica.",
  "c-5450-ghd-clear":
    "GRAPHITE HD bezbojni lak za velike površine, sa dobrim nivelisanjem, UV otpornošću i visokim sjajem.",
  "ghd-topcoat":
    "GRAPHITE HD završni premaz za velike površine, sa dobrim nivelisanjem, pokrivnošću i brzim sušenjem.",
  "p-2a41-performfiller-white":
    "Advance prajmer-punilac sa dobrim antikorozivnim, vremenskim i brusnim svojstvima.",
  "p-2a61-multiprotect-white":
    "Beli Advance DTM prajmer-punilac za direktnu primenu na metalnu podlogu.",
  "p-2a63-multiprotect-grey":
    "Sivi Advance DTM prajmer-punilac za direktnu primenu na metalnu podlogu.",
  "p-2a65-multiprotect-black":
    "Crni Advance DTM prajmer-punilac za direktnu primenu na metalnu podlogu.",
  "p-2e23-primer-filler-grey":
    "Dvokomponentni Element poliuretanski punilac sa dobrim punjenjem i obradom brušenjem.",
  "p-2p23-air-purpos-r-grey":
    "Vazdušno sušeći Pioneer eSense DTM prajmer-punilac za zaštitu od korozije i dobru obradivost.",
  "p-2p51-sanding-fill-r-white":
    "Beli Pioneer eSense prajmer-punilac za produktivno brušenje, stabilnu završnicu i zaštitu podloge.",
  "p-2p55-sanding-fill-r-black":
    "Crni Pioneer eSense prajmer-punilac za produktivno brušenje, stabilnu završnicu i zaštitu podloge.",
  "p-2p63-multi-purpos-r-grey":
    "Sivi Pioneer eSense DTM prajmer-punilac za direktnu primenu na metal i antikorozivnu zaštitu.",
  "p-2p81-race-wet-fill-r-white":
    "Beli Pioneer eSense wet-on-wet punilac za brz rad na novim e-coat panelima bez brušenja.",
  "p-2p85-race-wet-fill-r-black":
    "Crni Pioneer eSense wet-on-wet punilac za brz rad na novim e-coat panelima bez brušenja.",
  "p-2p92-uv-fill-r-light-grey":
    "Svetlosivi Pioneer eSense UV prajmer-punilac za antikorozivnu zaštitu i stabilnu završnicu.",
  "p-2p94-uv-fill-r-dark-grey":
    "Tamnosivi Pioneer eSense UV prajmer-punilac za antikorozivnu zaštitu i stabilnu završnicu.",
  "p-5480-ghd-universal-epoxy":
    "Univerzalni GRAPHITE HD epoksidni prajmer za različite metalne podloge i antikorozivnu zaštitu.",
  "p-5530-ghd-uni-wash":
    "GRAPHITE HD wash prajmer za velike površine, brzo sušenje i antikorozivnu zaštitu.",
  "pm-2e32-filler-light-grey": "Svetlosivi 1K Element punilac u aerosolu za reparaturnu primenu.",
  "pm-2e34-filler-dark-grey": "Tamnosivi 1K Element punilac u aerosolu za reparaturnu primenu.",
  "ra-050x-agilis-mix":
    "AGILIS razređivač za visoku temperaturu, nisku vlažnost i veće površine; koristi se sa solid i effect nijansama.",
};

const categoryLabels = {
  additive: "Aditiv",
  basecoat: "Bazna boja",
  bodyfiller: "Kit",
  clearcoat: "Bezbojni lak",
  hardener: "Učvršćivač",
  "primer-filler": "Prajmer i punilac",
  thinner: "Razređivač",
};

function ensureCommand(command) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.error) throw new Error(`Nedostaje alat: ${command}`);
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findSourceRoot(extractRoot) {
  const direct = join(extractRoot, "Proizvodi");
  if (existsSync(direct)) return direct;
  const candidates = readdirSync(extractRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(extractRoot, entry.name));
  if (candidates.length === 1) return candidates[0];
  throw new Error("ZIP ne sadrži jednoznačan Proizvodi folder.");
}

function slugFromProductPdf(productPdfPath) {
  return basename(productPdfPath, ".pdf").replace(/^rm-long-/, "").replace(/-\d+$/, "");
}

function productCode(name) {
  if (name === "GHD TOPCOAT") return "GHD TOPCOAT";
  if (name === "ProtectTOP C 2A84") return "C 2A84";
  if (name === "EASY C 2P15") return "C 2P15";
  const match = name.match(/^(HB|PM|RA|[A-Z])\s+([0-9A-Z]+)/);
  return match ? `${match[1]} ${match[2]}` : name;
}

function categoryFor(code, name) {
  if (name === "GHD TOPCOAT" || code.startsWith("HB ")) return "basecoat";
  if (code.startsWith("C ")) return "clearcoat";
  if (code.startsWith("P ") || code.startsWith("PM ")) return "primer-filler";
  if (code.startsWith("H ")) return "hardener";
  if (code.startsWith("R ") || code.startsWith("RA ")) return "thinner";
  if (code.startsWith("A ")) return "additive";
  if (code.startsWith("B ")) return "bodyfiller";
  throw new Error(`Nepoznata kategorija za ${name}`);
}

function seriesFor(code) {
  if (code.includes("2P")) return "pioneer";
  if (code.includes("2A")) return "advance";
  if (code.includes("2E")) return "element";
  return null;
}

function systemFor(slug) {
  if (agilisSystemSlugs.has(slug)) return "agilis";
  if (onyxSystemSlugs.has(slug)) return "onyx-hd";
  if (graphiteSystemSlugs.has(slug)) return "graphite-hd";
  return null;
}

function technologyFor({ category, name, slug, system }) {
  const normalized = name.toLowerCase();
  if (normalized.includes("uv ")) return "uv";
  if (normalized.includes("wet ")) return "wet-on-wet";
  if (normalized.includes("air") && !normalized.includes("hardener")) return "air-drying";
  if (
    normalized.includes("multiprotect") ||
    normalized.includes("multi purpos") ||
    normalized.includes("epoxy")
  ) {
    return "dtm";
  }
  if (
    category === "basecoat" ||
    ["2210-onyx-activator", "2220-agilis-activator", "2520-onyx-easy-blender", "2530-agilis-blender", "2560-agilis-amplifier", "ra-050x-agilis-mix"].includes(slug)
  ) {
    return "waterborne";
  }
  if (category === "clearcoat" || category === "hardener") return "2k";
  if (system === "graphite-hd" && category === "primer-filler") return "2k";
  return null;
}

function finishFor(category, name) {
  if (category !== "clearcoat") return null;
  const normalized = name.toLowerCase();
  if (normalized.includes("satin")) return "satin";
  if (normalized.includes("mat")) return "matte";
  return "gloss";
}

function groupDirectory({ series, system }) {
  if (system === "agilis") return "agilis";
  if (system === "onyx-hd") return "onyx";
  if (system === "graphite-hd") return "graphite";
  return series ?? "support";
}

function contextLabel(system, series) {
  if (system === "agilis") return "AGILIS";
  if (system === "onyx-hd") return "ONYX HD";
  if (system === "graphite-hd") return "GRAPHITE HD";
  if (series === "pioneer") return "Pioneer Series";
  if (series === "advance") return "Advance Series";
  if (series === "element") return "Element Series";
  return "R-M";
}

function fallbackFeature(category, context) {
  return `${categoryLabels[category]} iz ${context} programa, dokumentovan kroz dostavljeni zvanični R-M materijal.`;
}

function phaseAndProgram(category, slug) {
  if (category === "bodyfiller") {
    return { phaseSlug: "priprema", programSlug: "priprema-povrsine" };
  }
  if (category === "primer-filler" || slug === "h-380-ghd-hardener") {
    return { phaseSlug: "podloga", programSlug: "priprema-povrsine" };
  }
  if (category === "basecoat" || agilisSystemSlugs.has(slug) && ["additive", "thinner"].includes(category)) {
    return { phaseSlug: "boja", programSlug: "boje-i-lakovi" };
  }
  if (onyxSystemSlugs.has(slug) && ["additive", "thinner"].includes(category)) {
    return { phaseSlug: "boja", programSlug: "boje-i-lakovi" };
  }
  return { phaseSlug: "lak", programSlug: "boje-i-lakovi" };
}

if (!existsSync(zipPath)) throw new Error(`ZIP nije pronađen: ${zipPath}`);
ensureCommand(cwebpPath);

const extractRoot = mkdtempSync(join(tmpdir(), "rm-products-import-"));
const unzipResult = spawnSync("unzip", ["-q", zipPath, "-d", extractRoot], { encoding: "utf8" });
if (unzipResult.status !== 0) throw new Error(`ZIP raspakivanje nije uspelo: ${unzipResult.stderr}`);

const sourceRoot = findSourceRoot(extractRoot);
const folders = readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, "en"));

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"]);
const rawSources = folders.map((sourceFolder) => {
  const folderPath = join(sourceRoot, sourceFolder);
  const directFiles = readdirSync(folderPath)
    .map((name) => join(folderPath, name))
    .filter((path) => statSync(path).isFile());
  const image = directFiles.find((path) => imageExtensions.has(extname(path).toLowerCase())) ?? null;
  const pdfs = walkFiles(folderPath).filter((path) => extname(path).toLowerCase() === ".pdf");
  const productPdf = pdfs.find((path) => basename(path).toLowerCase().startsWith("rm-long-")) ?? null;
  const technicalPdf = pdfs.find((path) => path !== productPdf) ?? null;
  return { sourceFolder, folderPath, image, productPdf, technicalPdf, pdfs };
});

const imageHashGroups = new Map();
for (const source of rawSources) {
  if (!source.image) continue;
  const hash = sha256(source.image);
  imageHashGroups.set(hash, [...(imageHashGroups.get(hash) ?? []), source.sourceFolder]);
}
const duplicateImageGroups = [...imageHashGroups.values()].filter((group) => group.length > 1);

const pdfHashGroups = new Map();
for (const source of rawSources) {
  for (const pdf of source.pdfs) {
    const hash = sha256(pdf);
    pdfHashGroups.set(hash, [...(pdfHashGroups.get(hash) ?? []), pdf]);
  }
}
const duplicatePdfGroups = [...pdfHashGroups.values()].filter((group) => group.length > 1);

const canonicalRawSources = rawSources.filter(
  (source) => source.sourceFolder !== duplicateFolder && source.sourceFolder !== emptyFolder,
);

if (folders.length !== 61) throw new Error(`Očekivano 61 folder, pronađeno ${folders.length}.`);
if (rawSources.filter((source) => source.image).length !== 60) throw new Error("Audit slike nije 60/61.");
if (rawSources.filter((source) => source.pdfs.length > 0).length !== 60) {
  throw new Error("Audit dokumentacije nije 60/61.");
}
if (canonicalRawSources.length !== 59) throw new Error("Canonical skup nije 59 proizvoda.");
if (
  duplicateImageGroups.length !== 1 ||
  !duplicateImageGroups[0].includes(duplicateFolder) ||
  !duplicateImageGroups[0].includes(canonicalDuplicateFolder)
) {
  throw new Error("Neočekivana deduplikacija po slici.");
}

mkdirSync(dirname(generatedDataPath), { recursive: true });
mkdirSync(publicImageRoot, { recursive: true });
mkdirSync(publicDocumentRoot, { recursive: true });
const previousGeneratedData = existsSync(generatedDataPath)
  ? JSON.parse(readFileSync(generatedDataPath, "utf8"))
  : null;
const previousProductsBySlug = new Map(
  (previousGeneratedData?.products ?? []).map((product) => [product.slug, product]),
);

const productEntries = canonicalRawSources.map((source) => {
  if (!source.image || !source.productPdf) {
    throw new Error(`Canonical proizvod nema sliku ili product PDF: ${source.sourceFolder}`);
  }
  const slug = slugFromProductPdf(source.productPdf);
  const code = productCode(source.sourceFolder);
  const category = categoryFor(code, source.sourceFolder);
  const series = seriesFor(code);
  const system = systemFor(slug);
  const technology = technologyFor({ category, name: source.sourceFolder, slug, system });
  const finish = finishFor(category, source.sourceFolder);
  const group = groupDirectory({ series, system });
  const { phaseSlug, programSlug } = phaseAndProgram(category, slug);
  const context = contextLabel(system, series);
  const imagePublicPath = `/images/brands/rm/products/${group}/rm-${slug}.webp`;
  const imageOutputPath = join(projectRoot, "public", imagePublicPath);
  const documentDirectory = join(publicDocumentRoot, slug);
  const productPdfPublicPath = `/documents/products/rm/${slug}/rm-${slug}-product-information.pdf`;
  const technicalPdfPublicPath = source.technicalPdf
    ? `/documents/products/rm/${slug}/rm-${slug}-technical-data-sheet.pdf`
    : null;
  const sourceImageSha256 = sha256(source.image);

  mkdirSync(dirname(imageOutputPath), { recursive: true });
  mkdirSync(documentDirectory, { recursive: true });
  const previousProduct = previousProductsBySlug.get(slug);
  const imageIsCurrent =
    existsSync(imageOutputPath) &&
    previousProduct?.image?.sourceSha256 === sourceImageSha256;
  if (!imageIsCurrent) {
    const webpResult = spawnSync(
      cwebpPath,
      [
        "-quiet",
        "-q",
        userPreparedSlugs.has(slug) ? "90" : "86",
        "-alpha_q",
        "100",
        "-m",
        "6",
        source.image,
        "-o",
        imageOutputPath,
      ],
      { encoding: "utf8" },
    );
    if (webpResult.status !== 0) {
      throw new Error(`WebP optimizacija nije uspela za ${slug}: ${webpResult.stderr}`);
    }
  }

  cpSync(source.productPdf, join(projectRoot, "public", productPdfPublicPath));
  if (source.technicalPdf && technicalPdfPublicPath) {
    cpSync(source.technicalPdf, join(projectRoot, "public", technicalPdfPublicPath));
  }

  const feature = sourceFeatureBySlug[slug] ?? fallbackFeature(category, context);
  return {
    slug,
    canonicalName: source.sourceFolder,
    productCode: code,
    image: {
      alt: `${source.sourceFolder}, dostavljeni prikaz proizvoda`,
      assetSource: userPreparedSlugs.has(slug) ? "user-prepared" : "supplied-product-archive",
      originalFilename: basename(source.image),
      sourceSha256: sourceImageSha256,
      src: imagePublicPath,
    },
    documents: {
      productInformation: productPdfPublicPath,
      technicalDataSheet: technicalPdfPublicPath,
    },
    taxonomy: {
      category,
      finish,
      phaseSlug,
      programSlug,
      series,
      system,
      technology,
    },
    content: {
      benefit: feature,
      context,
      purpose: feature,
      shortDescription: feature,
      technicalReviewStatus: source.technicalPdf ? "confirmed" : "needs_confirmation",
    },
    contentReview: {
      status:
        source.technicalPdf === null || assetReviewNotesBySlug[slug]
          ? "needs_confirmation"
          : "confirmed",
      notes: [
        ...(source.technicalPdf === null
          ? ["Folder sadrži product-information PDF, ali nema zaseban tehnički list."]
          : []),
        ...(assetReviewNotesBySlug[slug] ? [assetReviewNotesBySlug[slug]] : []),
      ],
    },
    source: {
      sourceFolder: source.sourceFolder,
      technicalPdfOriginalFilename: source.technicalPdf ? decodeURIComponent(basename(source.technicalPdf)) : null,
      productPdfOriginalFilename: basename(source.productPdf),
    },
  };
});

const productBySourceFolder = new Map(productEntries.map((product) => [product.source.sourceFolder, product]));
const duplicateCanonical = productBySourceFolder.get(canonicalDuplicateFolder);
if (!duplicateCanonical) throw new Error("Canonical H 2P15 proizvod nije pronađen.");

const sourceManifest = rawSources.map((source) => {
  const duplicate = source.sourceFolder === duplicateFolder;
  const canonicalProduct = duplicate ? duplicateCanonical : productBySourceFolder.get(source.sourceFolder);
  return {
    sourceFolder: source.sourceFolder,
    canonicalName: duplicate ? canonicalDuplicateFolder : source.sourceFolder,
    productCode: canonicalProduct?.productCode ?? null,
    imagePath: canonicalProduct?.image.src ?? null,
    productPdfPath: canonicalProduct?.documents.productInformation ?? null,
    technicalPdfPath: canonicalProduct?.documents.technicalDataSheet ?? null,
    isDuplicate: duplicate,
    importStatus: duplicate
      ? "duplicate"
      : source.image === null
        ? "missing-image"
        : source.pdfs.length === 0
          ? "missing-documentation"
          : "ready",
    duplicateOf: duplicate ? duplicateCanonical.slug : null,
  };
});

const generated = {
  schemaVersion: 1,
  audit: {
    folderCount: folders.length,
    foldersWithDocumentation: rawSources.filter((source) => source.pdfs.length > 0).length,
    foldersWithImage: rawSources.filter((source) => source.image).length,
    uniqueProductCount: productEntries.length,
    duplicateFolders: [duplicateFolder, canonicalDuplicateFolder],
    duplicateCanonicalSlug: duplicateCanonical.slug,
    duplicateImageGroupCount: duplicateImageGroups.length,
    duplicatePdfGroupCount: duplicatePdfGroups.length,
    emptyFolders: [emptyFolder],
    canonicalProductInformationPdfCount: productEntries.filter(
      (product) => product.documents.productInformation,
    ).length,
    canonicalTechnicalPdfCount: productEntries.filter(
      (product) => product.documents.technicalDataSheet,
    ).length,
    contentReviewCount: productEntries.filter(
      (product) => product.contentReview.status === "needs_confirmation",
    ).length,
  },
  sources: sourceManifest,
  products: productEntries,
};

writeFileSync(generatedDataPath, `${JSON.stringify(generated, null, 2)}\n`);
console.log(JSON.stringify(generated.audit, null, 2));
