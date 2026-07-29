import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const dataPath = join(projectRoot, "data", "rm-imported-products.generated.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function publicFile(publicPath) {
  return join(projectRoot, "public", publicPath);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

expect(data.audit.folderCount === 61, "Audit mora imati 61 folder.");
expect(data.audit.foldersWithImage === 60, "Audit mora imati 60 foldera sa slikom.");
expect(
  data.audit.foldersWithDocumentation === 60,
  "Audit mora imati 60 foldera sa dokumentacijom.",
);
expect(data.audit.uniqueProductCount === 59, "Audit mora imati 59 canonical proizvoda.");
expect(
  data.audit.duplicateCanonicalSlug === "h-2p15-clear-harden-r",
  "H 2P15 canonical slug nije tačan.",
);
expect(
  data.audit.emptyFolders.length === 1 && data.audit.emptyFolders[0] === "CRYSTAL BASE",
  "CRYSTAL BASE mora biti jedini prazan folder.",
);
expect(
  data.audit.canonicalProductInformationPdfCount === 59,
  "Mora postojati 59 product-information PDF-ova.",
);
expect(
  data.audit.canonicalTechnicalPdfCount === 58,
  "Mora postojati 58 tehničkih PDF-ova.",
);

const slugs = data.products.map((product) => product.slug);
expect(new Set(slugs).size === 59, "Canonical slugovi moraju biti jedinstveni.");
expect(
  slugs.filter((slug) => slug === "h-2p15-clear-harden-r").length === 1,
  "H 2P15 sme postojati samo jednom.",
);
expect(
  slugs.every((slug) => !slug.includes("crystal-base")),
  "CRYSTAL BASE ne sme imati pojedinačni product page.",
);

const imageHashes = new Map();
for (const product of data.products) {
  const imagePath = publicFile(product.image.src);
  expect(existsSync(imagePath), `Nedostaje slika: ${product.image.src}`);
  if (existsSync(imagePath)) {
    expect(statSync(imagePath).size > 0, `Prazna slika: ${product.image.src}`);
    const bytes = readFileSync(imagePath);
    expect(
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP",
      `Slika nije validan WebP: ${product.image.src}`,
    );
    const hash = sha256(imagePath);
    imageHashes.set(hash, [...(imageHashes.get(hash) ?? []), product.slug]);
  }

  const productPdfPath = publicFile(product.documents.productInformation);
  expect(existsSync(productPdfPath), `Nedostaje product PDF: ${product.slug}`);
  if (existsSync(productPdfPath)) {
    expect(
      readFileSync(productPdfPath).subarray(0, 4).toString("ascii") === "%PDF",
      `Product dokument nije PDF: ${product.slug}`,
    );
  }

  if (product.documents.technicalDataSheet) {
    const technicalPdfPath = publicFile(product.documents.technicalDataSheet);
    expect(existsSync(technicalPdfPath), `Nedostaje tehnički PDF: ${product.slug}`);
    if (existsSync(technicalPdfPath)) {
      expect(
        readFileSync(technicalPdfPath).subarray(0, 4).toString("ascii") === "%PDF",
        `Tehnički dokument nije PDF: ${product.slug}`,
      );
    }
  }
}

const duplicateOutputImages = [...imageHashes.values()].filter((group) => group.length > 1);
expect(
  duplicateOutputImages.length === 0,
  `Canonical WebP asseti ne smeju biti duplirani: ${JSON.stringify(duplicateOutputImages)}`,
);

const sourceStatuses = data.sources.reduce((result, source) => {
  result[source.importStatus] = (result[source.importStatus] ?? 0) + 1;
  return result;
}, {});
expect(sourceStatuses.ready === 59, "Source manifest mora imati 59 ready foldera.");
expect(sourceStatuses.duplicate === 1, "Source manifest mora imati jedan duplicate folder.");
expect(sourceStatuses["missing-image"] === 1, "Source manifest mora evidentirati prazan CRYSTAL BASE.");

const h2p15Sources = data.sources.filter(
  (source) => source.canonicalName === "H 2P15 CLEAR Harden-R",
);
expect(h2p15Sources.length === 2, "Oba H 2P15 source foldera moraju voditi na isti canonical zapis.");
expect(
  h2p15Sources.every((source) => source.duplicateOf === null || source.duplicateOf === "h-2p15-clear-harden-r"),
  "H 2P15 duplicateOf veza nije tačna.",
);

const ra050x = data.products.find((product) => product.slug === "ra-050x-agilis-mix");
expect(ra050x?.image.originalFilename === "RA 050X_1.png", "RA 050X mora koristiti RA 050X_1.png.");
expect(ra050x?.productCode === "RA 050X", "RA 050X product code nije tačan.");

const userPrepared = data.products.filter(
  (product) => product.image.assetSource === "user-prepared",
);
expect(userPrepared.length === 5, "Mora postojati tačno pet user-prepared asseta.");
expect(
  data.products.every((product) => product.documents.productInformation),
  "Svaki canonical proizvod mora imati product-information dokument.",
);

if (failures.length) {
  console.error(`R-M product validacija nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      products: data.products.length,
      productInformationPdfs: data.audit.canonicalProductInformationPdfCount,
      technicalPdfs: data.audit.canonicalTechnicalPdfCount,
      sourceStatuses,
      userPreparedAssets: userPrepared.map((product) => product.slug),
      contentReviewCount: data.audit.contentReviewCount,
    },
    null,
    2,
  ),
);
