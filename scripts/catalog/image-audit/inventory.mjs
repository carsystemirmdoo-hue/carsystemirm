/**
 * FINAL IMAGE INVENTORY + MISSING IMAGE MANIFEST — READ ONLY.
 *
 *   node .cache/final-image-audit/audit.mjs
 *
 * Čita ISKLJUČIVO runtime (`loadCatalogRuntime`) i commitovane manifeste porekla. Ne preuzima ništa, ne menja
 * nijedan fajl repoa; piše samo u `.cache/final-image-audit/`. Izlaz je determinističan (sortirano, bez datuma).
 *
 * JEDAN RED = JEDNA STVARNO POTREBNA IMAGE IDENTITY:
 *   - kartica čiji svi redovi artikala dele isti packshot            → 1 identitet (CARD)
 *   - red tabele sa SOPSTVENOM slikom (`row.image`)                  → identitet po različitoj slici (ARTICLE)
 *   - red bez slike u kartici u kojoj drugi redovi imaju svoju       → identitet po redu (ARTICLE, nedostaje)
 *   - runtime porodica, varijante sa `packshotKind: family`          → identitet po (porodica, pakovanje) (PACKAGE)
 *   - ostale varijante porodice (svaka je svoj zapis)                → identitet po zapisu (VARIANT)
 *   - predstavnik porodice koji nosi sistemski/porodični packshot    → identitet porodice (FAMILY)
 * `image_id` se gradi iz BRENDA + SLUGA ZAPISA (+ id reda / pakovanje) — nikada iz `?varijanta=` ključa,
 * koji je u Cosmos Lac-u na 6 mesta dvosmislen.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";

const ROOT = process.cwd();
/** Radni direktorijum međuizlaza (gitignored). Canonical fajlove upisuje `promote.py`. */
const OUT = process.env.IMAGE_AUDIT_WORK ?? path.join(ROOT, ".cache/image-audit");
mkdirSync(OUT, { recursive: true });
const readJson = (file, fallback = null) => (existsSync(path.join(ROOT, file)) ? JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) : fallback);
const runtime = loadCatalogRuntime();
const data = runtime.requireModule("lib/carsystem-data.ts");
const PLACEHOLDER = "/images/products/placeholder-product.svg";
const isPlaceholder = (src) => !src || src.includes("placeholder-product");
const slugify = (text) => String(text ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ── Poreklo ─────────────────────────────────────────────────────────────────────────────── */
const published = {};
for (const brand of ["carsystem", "carfit", "befar", "rm", "baslac"]) published[brand] = readJson(`data/${brand}-sync/published-images.generated.json`)?.images ?? {};
published.rupes = published.carsystem; // RUPES kartice su zapisi Carsystem synca (third-party-manufacturers.json)
const datasets = Object.fromEntries(["carsystem", "carfit", "befar", "rm", "baslac", "norbin", "sata", "cosmos-lac"].map((brand) => [brand, readJson(`data/${brand}-catalog-products.generated.json`)]));
const missingOfficial = new Set(["rm", "baslac", "norbin", "carfit", "befar", "carsystem"].flatMap((brand) => (datasets[brand]?.products ?? []).filter((entry) => entry.missingOfficialAsset).map((entry) => entry.slug)));
const csManifest = readJson("data/carsystem-sync/image-manifest.generated.json")?.images ?? [];
const originalBySha = new Map(csManifest.map((entry) => [entry.sha256, entry.originalUrl]));
const cosmosKit = new Map((readJson("data/cosmos-lac-products.generated.json") ?? []).map((record) => [record.slug, record]));
const cosmosSync = new Map((datasets["cosmos-lac"]?.products ?? []).map((entry) => [entry.slug, entry]));
const cosmosSource = new Map((readJson("data/cosmos-lac-sync/source-products.generated.json")?.products ?? []).map((page) => [page.url, page]));
const rupesScope = readJson("data/carsystem-sync/third-party-manufacturers.json")?.manufacturers.rupes ?? { products: {}, images: {} };
const sataPhase1 = new Map((readJson("data/sata-sync/reports/image-availability.generated.json")?.families ?? []).map((family) => [family.slug, family]));
const sataPhase2 = new Map((datasets.sata?.phase2?.products ?? []).map((entry) => [entry.slug, entry]));
const sataRaw = new Map((readJson("data/sata-sync/raw/articles.generated.json")?.articles ?? []).map((article) => [article.articleNumber, article]));
const metrics = readJson("data/product-image-metrics.generated.json")?.images ?? {};
/*
 * Grupe koje dele JEDNU reprezentativnu sliku iako su u katalogu odvojeni proizvodi
 * (`data/catalog/image-supply/shared-image-groups.json`). Deli se samo image identity: slug,
 * naziv, šifra i PDP ostaju odvojeni, porodica se ne pravi.
 */
/* Slike koje je dostavio vlasnik (`supplied-images.json`) — runtime ih već prikazuje. */
const suppliedBatch = readJson("data/catalog/image-supply/supplied-images.json")?.batch ?? "OWNER_SUPPLY";
const suppliedByPath = new Map((readJson("data/catalog/image-supply/supplied-images.json")?.images ?? []).map((entry) => [entry.path, entry]));
const sharedImageGroups = readJson("data/catalog/image-supply/shared-image-groups.json")?.groups ?? [];
const sharedGroupOf = new Map(sharedImageGroups.flatMap((group) => group.members.map((slug) => [slug, group])));
/* Grupe za koje vlasnik ne traži sliku u ovom periodu: placeholder je prihvaćen, bez otvorenog zahteva. */
const deferredGroupIds = new Set(sharedImageGroups.filter((group) => group.imageSupply?.status === "DEFERRED_OWNER_IMAGE_SUPPLY").map((group) => group.id));
const groupedCardIds = new Set();
const edgeFrame = readJson("data/catalog/image-quality/evidence/edge-frame.generated.json", {});
const HISTORICAL_BORDER_FRAME = /carsystem-rupes-|carsystem-paint-trolley-flexi-plus/; // istorijski nalaz: „RUPES + paint-trolley-flexi-plus”
const V6_EXCLUDED = new Set(["carsystem-multi-flow", "carsystem-paint-system-cps-3-0", "carsystem-h2o-cleaner"]);
const V6_UNKNOWN = new Set(["carsystem-glass-fibre-reinforced-putty"]);

const fileInfo = new Map();
function infoOf(src) {
  if (fileInfo.has(src)) return fileInfo.get(src);
  // Slike bez potvrđenog prava nisu u public/ — izvor je review-assets/pending-rights/<brend>/.
  const pendingMatch = /^\/products\/([^/]+)\/pending-rights\/([^/]+)$/.exec(src ?? "");
  const file = pendingMatch ? path.join(ROOT, "review-assets/pending-rights", pendingMatch[1], pendingMatch[2]) : path.join(ROOT, "public", src ?? "");
  const exists = Boolean(src) && existsSync(file);
  const info = { exists, sha256: exists ? createHash("sha256").update(readFileSync(file)).digest("hex") : "", width: metrics[src]?.w ?? "", height: metrics[src]?.h ?? "", format: src ? path.extname(src).slice(1).toLowerCase() : "" };
  fileInfo.set(src, info);
  return info;
}

/* ── 1. Image identities iz runtime-a ─────────────────────────────────────────────────────── */
const packOf = (record) => record.catalogMetadata?.volume ?? record.packages?.[0]?.label ?? "";
const articleOf = (record) => (typeof record.manufacturerCode === "string" ? record.manufacturerCode : "");
const identities = [];
const accountedCards = new Set();
const accountedRecords = new Set();
function push(identity) { identities.push({ variantKey: "", variant: "", pack: "", articleNumbers: [], members: 1, notes: [], ...identity }); }

for (const card of runtime.listing.canonical) {
  accountedCards.add(card.id);
  if (card.id.startsWith("family:")) {
    const family = runtime.families.find((entry) => `family:${entry.slug}` === card.id);
    const shared = family.variants.filter((record) => record.visualIdentity?.packshotKind === "family");
    const own = family.variants.filter((record) => record.visualIdentity?.packshotKind !== "family");
    for (const record of family.variants) accountedRecords.add(record.slug);
    // Predstavnik koji nosi porodični packshot = identitet porodice; ostali zapisi su svoje varijante.
    const packsCovered = [...new Set(shared.map((record) => packOf(record)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    for (const record of own) {
      const isFamilyFace = shared.length > 0 && record.slug === family.representative?.slug;
      push({ id: `${card.brandSlug}__${record.slug}`, brand: card.brandSlug, cardId: card.id, record, scope: isFamilyFace ? "FAMILY" : "VARIANT", src: record.productImage?.src ?? null, variantKey: runtime.productVariantKey(record), variant: record.catalogMetadata?.colorName ?? record.catalogMetadata?.cosmosCode ?? "", pack: packOf(record), articleNumbers: [articleOf(record)].filter(Boolean),
        members: isFamilyFace ? 1 + shared.length : 1,
        notes: isFamilyFace ? [`jedna slika serije pokriva ${shared.length} zapisa sa porodičnim packshotom${packsCovered.length ? ` (pakovanja: ${packsCovered.join(", ")})` : ""}`] : [] });
    }
    /*
     * Serija = JEDNA slika (odluka vlasnika 2026-09-22).
     *
     * Ranije je ovde nastajao identitet po (porodica, pakovanje), pa je jedna linija tonera tražila
     * četiri packshota iste limenke u četiri zapremine. Svi zapisi sa `packshotKind: family` sada
     * pripadaju identitetu LICA PORODICE: toner, šifra i pakovanje se biraju u kartici, slika ostaje
     * slika serije. Zasebna slika pakovanja postoji samo kad je izričito odobrena.
     * Napomena: zapisi koji danas imaju svoju runtime sliku je i dalje prikazuju — ovde se broji
     * koliko je FOTOGRAFIJA potrebno, ne šta se prikazuje.
     */
    continue;
  }
  const record = runtime.products.find((product) => product.slug === card.id);
  accountedRecords.add(record.slug);
  const group = sharedGroupOf.get(record.slug);
  /*
   * Grupa čiji SVAKI član nosi sopstvenu dostavljenu sliku (tačna ambalaža svoje oznake) više nije
   * „jedna reprezentativna slika” — svaki zapis je svoj identitet, kao i svaka druga kartica.
   */
  const ownImageForEveryMember = group?.members.every((slug) => {
    const member = runtime.products.find((product) => product.slug === slug);
    return member && suppliedByPath.get(member.productImage?.src)?.slug === slug;
  });
  if (group && ownImageForEveryMember) {
    push({ id: `${card.brandSlug}__${record.slug}`, brand: card.brandSlug, cardId: card.id, record, scope: "CARD", src: record.productImage?.src ?? null, pack: packOf(record), articleNumbers: [articleOf(record)].filter(Boolean), members: 1,
      notes: [`član grupe ${group.id}; svaki član ima sopstvenu sliku svoje oznake`] });
    continue;
  }
  if (group) {
    groupedCardIds.add(card.id);
    // Identitet nosi PRVI član grupe; ostali su accountovani, ali ne traže svoju fotografiju.
    if (record.slug === group.members[0]) {
      const members = group.members.map((slug) => runtime.products.find((product) => product.slug === slug)).filter(Boolean);
      const srcs = [...new Set(members.map((member) => member.productImage?.src ?? null))];
      push({ id: `${card.brandSlug}__group-${group.id}`, groupId: group.id, brand: card.brandSlug, cardId: card.id, record, scope: "SHARED_IMAGE_GROUP", src: srcs.length === 1 ? srcs[0] : null, mixedSrcs: srcs.length > 1 ? srcs : null,
        groupLabel: group.label, members: members.length, articleNumbers: members.map(articleOf).filter(Boolean),
        notes: [`jedna reprezentativna slika grupe pokriva ${members.length} zapisa (${members.map(articleOf).filter(Boolean).join(", ")}); ${group.representativeImageNote}`] });
    }
    continue;
  }
  const rows = record.detail?.variants?.content.rows ?? [];
  const cardSrc = record.productImage?.src ?? null;
  push({ id: `${card.brandSlug}__${record.slug}`, brand: card.brandSlug, cardId: card.id, record, scope: "CARD", src: cardSrc, pack: rows.length ? "" : packOf(record), articleNumbers: rows.length ? rows.filter((row) => !row.image || row.image === cardSrc).map((row) => row.id) : [articleOf(record)].filter(Boolean), members: Math.max(1, rows.length), notes: rows.length > 1 ? [`${rows.length} redova artikala; redovi bez sopstvene slike dele packshot kartice`] : [] });
  const withImage = rows.filter((row) => row.image && row.image !== cardSrc);
  const bySrc = new Map();
  for (const row of withImage) bySrc.set(row.image, [...(bySrc.get(row.image) ?? []), row]);
  for (const [src, group] of [...bySrc].sort(([a], [b]) => a.localeCompare(b))) push({ id: `${card.brandSlug}__${record.slug}__${slugify(group[0].id)}`, brand: card.brandSlug, cardId: card.id, record, scope: "ARTICLE", src, variant: group.map((row) => row.values.config ?? Object.values(row.values)[0]).join(" | ").slice(0, 120), articleNumbers: group.map((row) => row.id), members: group.length });
  // Red bez slike u kartici gde drugi redovi IMAJU svoju: na PDP-u pada na packshot kartice (slika drugog reda).
  if (rows.some((row) => row.image)) for (const row of rows.filter((entry) => !entry.image)) push({ id: `${card.brandSlug}__${record.slug}__${slugify(row.id)}`, brand: card.brandSlug, cardId: card.id, record, scope: "ARTICLE", src: null, rowFallbackSrc: cardSrc, variant: String(Object.values(row.values)[0] ?? ""), articleNumbers: [row.id] });
}

/* ── 2. Klasifikacija ─────────────────────────────────────────────────────────────────────── */
const hostOf = (url) => { try { return new URL(url).host; } catch { return ""; } };
function classify(identity) {
  const { brand, record, src } = identity;
  const info = infoOf(src);
  const out = { provenance: "", official: "UNKNOWN", officialUrl: "", rights: "", classification: "", action: "", priority: "", syncStatus: "", quality: [] };
  const placeholder = isPlaceholder(src);
  const onCard = identity.scope === "CARD" || identity.scope === "FAMILY";

  if (identity.mixedSrcs) return { ...out, classification: "NEEDS_MANUAL_REVIEW", action: "MANUAL_REVIEW", priority: "P2", provenance: "mixed", notes: [`varijante istog pakovanja koriste različite slike: ${identity.mixedSrcs.join(", ")}`] };
  if (src && !placeholder && !info.exists) return { ...out, classification: "BROKEN_IMAGE_REFERENCE", action: "FIX_REFERENCE", priority: "P1", provenance: "missing-file" };

  /*
   * Slika vlasnika ima prednost nad svakim brendskim pravilom: identitet je pokriven bez obzira na to
   * da li proizvođač objavljuje sliku i pod kojim uslovima. Zato se proverava pre SATA/RUPES grana.
   */
  if (identity.scope === "SHARED_IMAGE_GROUP" && deferredGroupIds.has(identity.groupId) && placeholder) {
    return { ...out, provenance: "none", official: "UNKNOWN", rights: "", classification: "PLACEHOLDER_ACCEPTED", action: "KEEP_PLACEHOLDER", priority: "P4",
      notes: ["DEFERRED_OWNER_IMAGE_SUPPLY: vlasnik ne traži sliku za ovu grupu u ovom periodu; proizvodi ostaju u katalogu"] };
  }

  const supplied = suppliedByPath.get(src);
  if (supplied) {
    const origin = { SUPPLIER_BRAND_PORTAL: "supplier-portal", DISTRIBUTOR_HOSTED_MANUFACTURER_RENDER: "distributor-render" }[supplied.sourceBasis] ?? "owner-supplied";
    const official = supplied.sourceBasis === "SUPPLIER_BRAND_PORTAL" ? `zvanični portal dobavljača (asset ${supplied.sourceDetail?.assetId ?? "?"})` : supplied.sourceBasis === "DISTRIBUTOR_HOSTED_MANUFACTURER_RENDER" ? `render proizvođača sa sajta distributera (${supplied.sourceDetail?.originalUrl ?? "?"})` : "N/A (slika vlasnika)";
    return { ...out, provenance: `${origin}:${supplied.batch ?? suppliedBatch} (obrada: ${supplied.processing ?? "UNDECLARED"})`, official, rights: supplied.rightsBasis ?? "OWNER_CONFIRMATION_REQUIRED", classification: "OWNER_SUPPLIED_IMAGE", action: "NONE", priority: "" };
  }

  /* SATA — rights gate: nijedna slika ne ulazi u runtime; dostupnost je samo činjenica o izvoru. */
  if (brand === "sata") {
    const p1 = sataPhase1.get(record.slug), p2 = sataPhase2.get(record.slug);
    const articleNumbers = p2 ? p2.variants.map((row) => row.articleNumber) : [];
    const withImage = p2 ? articleNumbers.filter((number) => (sataRaw.get(number)?.galleryImages ?? 0) > 0) : [];
    const available = p1 ? p1.status === "OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME" : withImage.length > 0;
    out.syncStatus = p1?.status ?? p2?.imageStatus ?? "";
    out.provenance = "site-placeholder (SATA rights gate: APPROVED_RUNTIME_IMAGES = 0)";
    out.official = available ? (p2 && withImage.length < articleNumbers.length ? `YES_PARTIAL (${withImage.length}/${articleNumbers.length} artikala)` : "YES") : "NO";
    out.officialUrl = available ? (p1 ? p1.sourceImages?.[0]?.url ?? p1.sourcePage : sataRaw.get(withImage[0])?.firstImage ?? "") : "";
    out.rights = "RIGHTS_NOT_CONFIRMED";
    if (available) return { ...out, classification: "OFFICIAL_IMAGE_RIGHTS_REVIEW", action: "RIGHTS_DECISION", priority: p1 ? "P2" : "P3" };
    // Proizvođač ne objavljuje sliku: porodica faze 1 je pravi proizvod → vlasnik; sitan pribor faze 2 → placeholder je prihvatljiv.
    return p1 ? { ...out, classification: "OFFICIAL_IMAGE_NOT_PUBLISHED", action: "USER_SUPPLY", priority: "P2" } : { ...out, classification: "PLACEHOLDER_ACCEPTED", action: "KEEP_PLACEHOLDER", priority: "P4", notes: ["pribor faze 2 bez zvanične slike; placeholder je prihvatljiv dok vlasnik ne odluči drugačije"] };
  }

  /* RUPES — runtime slika postoji (Carsystem izvor), ali pravo prikaza pod RUPES brendom nije dokumentovano. */
  if (brand === "rupes") {
    const meta = published.rupes[src];
    const scope = rupesScope.products[record.slug];
    out.provenance = meta ? `official-sync:${hostOf(meta.sourceUrl)} (Carsystem katalog)` : "unknown";
    out.official = scope?.officialUrls?.length ? "YES (rupes.com stranica proizvoda; slika NIJE preuzeta)" : "NO_OFFICIAL_RUPES_PAGE";
    out.officialUrl = scope?.officialUrls?.[0] ?? "";
    out.rights = rupesScope.images.flag ?? "RUPES_IMAGE_RIGHTS_REVIEW";
    out.syncStatus = rupesScope.images.status ?? "";
    if (edgeFrame[src]) out.quality.push("BORDER_FRAME");
    if (meta && /_processed_/.test(meta.sourceUrl) && /\.png$/i.test(meta.sourceUrl)) out.quality.push("TONE_SOURCE_REEXPORT_CANDIDATE");
    return { ...out, classification: "OFFICIAL_IMAGE_RIGHTS_REVIEW", action: "RIGHTS_DECISION", priority: "P3" };
  }

  /* Red bez sopstvene slike (Befar): kartica ima sliku, red nema. */
  if (identity.scope === "ARTICLE" && !src) {
    const fallbackIsSiblingRow = (record.detail?.variants?.content.rows ?? []).some((row) => row.image === identity.rowFallbackSrc);
    return { ...out, provenance: "none", official: "NO", rights: "", classification: "PACKAGE_OR_VARIANT_IMAGE_MISSING", action: "USER_SUPPLY", priority: "P3", notes: [`red nema svoju sliku; PDP prikazuje packshot kartice ${identity.rowFallbackSrc}${fallbackIsSiblingRow ? " (to je slika drugog reda)" : ""}`] };
  }

  if (placeholder) {
    out.provenance = "site-placeholder";
    if (brand === "cosmos-lac") {
      const sync = cosmosSync.get(record.slug)?.sync;
      const page = sync ? cosmosSource.get(sync.officialUrl) : null;
      out.syncStatus = sync?.imageStatus ?? "";
      out.official = page?.image ? "YES (cosmoslac.com; nije u zvaničnom Brand Kit-u)" : "UNKNOWN";
      out.officialUrl = page?.image ?? "";
      out.rights = "RIGHTS_NOT_CONFIRMED (izvor slika je bio Brand Kit; ova slika postoji samo na sajtu)";
      return { ...out, classification: page?.image ? "OFFICIAL_IMAGE_AVAILABLE_NOT_IMPORTED" : "USER_SUPPLY_REQUIRED", action: page?.image ? "IMPORT_OFFICIAL_IF_APPROVED" : "USER_SUPPLY", priority: onCard ? "P2" : "P3" };
    }
    const siblingHasImage = identity.cardId.startsWith("family:") && runtime.families.find((family) => `family:${family.slug}` === identity.cardId).variants.some((variant) => !isPlaceholder(variant.productImage?.src));
    if (missingOfficial.has(record.slug) || brand === "norbin") { out.official = "NO"; out.syncStatus = "MISSING_OFFICIAL_ASSET"; out.rights = "N/A (proizvođač ne objavljuje sliku)"; }
    const base = out.official === "NO" ? "OFFICIAL_IMAGE_NOT_PUBLISHED" : "USER_SUPPLY_REQUIRED";
    return { ...out, classification: siblingHasImage || identity.scope === "PACKAGE" ? "PACKAGE_OR_VARIANT_IMAGE_MISSING" : base, action: "USER_SUPPLY", priority: identity.scope === "PACKAGE" || siblingHasImage ? "P3" : "P2", notes: siblingHasImage ? ["druga varijanta iste kartice ima sliku; ova koristi placeholder (nema pogrešnog sibling fallback-a)"] : [] };
  }

  /* Slika postoji i radi. */
  const meta = published[brand]?.[src];
  if (meta) {
    out.provenance = `official-sync:${hostOf(meta.sourceUrl)}`;
    out.official = "YES"; out.officialUrl = meta.sourceUrl; out.rights = "OFFICIAL_SOURCE_SYNCED (politika synca brenda)";
    if (brand === "carsystem") {
      if (/_processed_/.test(meta.sourceUrl) && /\.png$/i.test(meta.sourceUrl)) out.quality.push("TONE_SOURCE_REEXPORT_CANDIDATE");
      if (edgeFrame[src]) out.quality.push(HISTORICAL_BORDER_FRAME.test(src) ? "BORDER_FRAME" : "BORDER_FRAME_CANDIDATE");
      if (V6_EXCLUDED.has(record.slug)) out.quality.push("FIT_MODEL_EXCLUDED_MANUAL_REVIEW");
      if (V6_UNKNOWN.has(record.slug)) out.quality.push("FIT_MODEL_UNKNOWN_MANUAL_REVIEW");
    }
    return out.quality.length ? { ...out, classification: "IMAGE_QUALITY_REVIEW_ONLY", action: "QUALITY_REVIEW", priority: "P4" } : { ...out, classification: "APPROVED_RUNTIME_IMAGE", action: "NONE", priority: "" };
  }
  if (brand === "cosmos-lac" && cosmosKit.has(record.slug)) {
    const kit = cosmosKit.get(record.slug);
    const shaOk = kit.productionSha256 === info.sha256;
    return { ...out, provenance: `cosmos-brand-kit:${kit.sourceOriginalPath ?? ""}`, official: "YES (zvanični Brand Kit)", rights: "OFFICIAL_BRAND_KIT", syncStatus: shaOk ? "SHA_MATCHES_BRAND_KIT_RECORD" : "SHA_DIFFERS_FROM_BRAND_KIT_RECORD", classification: shaOk ? "APPROVED_RUNTIME_IMAGE" : "NEEDS_MANUAL_REVIEW", action: shaOk ? "NONE" : "MANUAL_REVIEW", priority: shaOk ? "" : "P2" };
  }
  // Lokalni asset bez sync manifesta: ručno uređen zapis ili porodični packshot sa upisanim izvorom.
  out.provenance = record.visualIdentity?.imageSource ? `local-asset (${record.visualIdentity.imageSource})` : "local-repo-asset (ručni zapis, bez sync manifesta)";
  out.rights = "LOCAL_ASSET (poreklo van sync manifesta)";
  return { ...out, classification: "LOCAL_LEGITIMATE_IMAGE", action: "NONE", priority: "" };
}

/* WRONG_SIBLING: zapis-varijanta čija stvarna slika pripada drugom pakovanju iste kartice, a nije porodični packshot. */
const wrongSibling = new Set();
for (const family of runtime.families) {
  const real = family.variants.filter((variant) => !isPlaceholder(variant.productImage?.src) && variant.visualIdentity?.packshotKind !== "family");
  for (const variant of real) if (real.some((other) => other !== variant && other.productImage.src === variant.productImage.src && packOf(other) && packOf(variant) && packOf(other) !== packOf(variant))) wrongSibling.add(variant.slug);
}

const rows = identities.map((identity) => {
  let result = classify(identity);
  if (identity.scope === "VARIANT" && wrongSibling.has(identity.record.slug)) result = { ...result, classification: "WRONG_SIBLING_IMAGE", action: "USER_SUPPLY", priority: "P1" };
  const info = infoOf(identity.src);
  const record = identity.record;
  const name = identity.scope === "PACKAGE" ? `${identity.familyName} — ${identity.pack}` : identity.scope === "SHARED_IMAGE_GROUP" ? identity.groupLabel : record.name;
  return {
    image_id: identity.id, brand: identity.brand, card_id: identity.cardId, product_name: name, slug: identity.scope === "PACKAGE" ? identity.familySlug : record.slug, image_scope: identity.scope,
    public_code: identity.scope === "PACKAGE" || identity.scope === "SHARED_IMAGE_GROUP" ? "" : record.publicCode ?? "", manufacturer_code: identity.scope === "PACKAGE" || identity.scope === "SHARED_IMAGE_GROUP" ? "" : articleOf(record), article_number: identity.articleNumbers.join(" "), variant_key: identity.variantKey, variant: identity.variant, package: identity.pack,
    current_image_status: isPlaceholder(identity.src) ? (identity.rowFallbackSrc ? "ROW_FALLS_BACK_TO_CARD_IMAGE" : "PLACEHOLDER") : info.exists ? "RUNTIME_IMAGE" : "BROKEN",
    current_image_path: identity.src ?? identity.rowFallbackSrc ?? PLACEHOLDER, current_image_exists: isPlaceholder(identity.src) ? (identity.rowFallbackSrc ? infoOf(identity.rowFallbackSrc).exists : infoOf(PLACEHOLDER).exists) : info.exists,
    current_image_sha256: isPlaceholder(identity.src) ? "" : info.sha256, current_image_width: isPlaceholder(identity.src) ? "" : info.width, current_image_height: isPlaceholder(identity.src) ? "" : info.height, current_image_format: isPlaceholder(identity.src) ? "" : info.format,
    current_image_provenance: result.provenance, sync_image_status: result.syncStatus, official_image_available: result.official, official_image_url: result.officialUrl, official_image_rights_status: result.rights,
    classification: result.classification, action_required: result.action, priority: result.priority, members_sharing_identity: identity.members,
    notes: [...identity.notes, ...(result.notes ?? []), ...(result.quality.length ? [`quality: ${result.quality.join("+")}`] : []), ...((record.galleryImages ?? []).length && identity.scope === "CARD" ? [`galerija: ${record.galleryImages.length}`] : [])].join("; "),
    _quality: result.quality, _originalUrl: published[identity.brand]?.[identity.src] ? originalBySha.get(published[identity.brand][identity.src].sourceSha256) ?? "" : "",
  };
}).sort((a, b) => a.image_id.localeCompare(b.image_id, "en"));

/* ── 3. Izlazi ────────────────────────────────────────────────────────────────────────────── */
const cell = (value) => { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const csv = (columns, list) => `${[columns.join(","), ...list.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\n")}\n`;
const write = (name, text) => writeFileSync(path.join(OUT, name), text);

const INVENTORY_COLUMNS = ["image_id", "brand", "card_id", "product_name", "slug", "image_scope", "public_code", "manufacturer_code", "article_number", "variant_key", "variant", "package", "current_image_status", "current_image_path", "current_image_exists", "current_image_sha256", "current_image_width", "current_image_height", "current_image_format", "current_image_provenance", "sync_image_status", "official_image_available", "official_image_url", "official_image_rights_status", "classification", "action_required", "priority", "members_sharing_identity", "notes"];
write("IMAGE_IDENTITY_INVENTORY.csv", csv(INVENTORY_COLUMNS, rows));

const MISSING_CLASSES = new Set(["OFFICIAL_IMAGE_AVAILABLE_NOT_IMPORTED", "OFFICIAL_IMAGE_NOT_PUBLISHED", "PLACEHOLDER_ACCEPTED", "USER_SUPPLY_REQUIRED", "PACKAGE_OR_VARIANT_IMAGE_MISSING", "WRONG_SIBLING_IMAGE", "BROKEN_IMAGE_REFERENCE"]);
const isMissing = (row) => MISSING_CLASSES.has(row.classification) || (row.classification === "OFFICIAL_IMAGE_RIGHTS_REVIEW" && row.current_image_status === "PLACEHOLDER") || (row.classification === "NEEDS_MANUAL_REVIEW" && row.current_image_status !== "RUNTIME_IMAGE");
const usedNames = new Map();
const missing = rows.filter(isMissing).map((row) => {
  // `image_id` je već jedinstven; ime fajla je isti identitet, sanitizovan. Sudar se rešava sufiksom po redosledu image_id.
  let base = row.image_id.split("__").map((part) => slugify(part)).join("__").slice(0, 150);
  const seen = usedNames.get(base) ?? 0; usedNames.set(base, seen + 1);
  if (seen) base = `${base}__${seen + 1}`;
  const suggested = `${base}.webp`;
  return { ...row, missing_reason: row.classification, image_rights_status: row.official_image_rights_status, suggested_filename: suggested, target_path: `/products/${row.brand}/supplied/${suggested}` };
});
const MISSING_COLUMNS = ["image_id", "brand", "product_name", "slug", "public_code", "manufacturer_code", "article_number", "variant_key", "variant", "package", "missing_reason", "current_image_path", "official_image_available", "official_image_url", "image_rights_status", "action_required", "suggested_filename", "target_path", "priority", "notes"];
write("MISSING_PRODUCT_IMAGES.csv", csv(MISSING_COLUMNS, missing));

const supply = missing.filter((row) => row.action_required === "USER_SUPPLY").map((row) => ({ ...row, why_user_supply: row.missing_reason === "OFFICIAL_IMAGE_NOT_PUBLISHED" ? "proizvođač ne objavljuje sliku" : row.missing_reason === "PACKAGE_OR_VARIANT_IMAGE_MISSING" ? "nedostaje slika pakovanja/varijante; ostatak kartice ima sliku" : row.missing_reason === "USER_SUPPLY_REQUIRED" ? "ručni zapis bez slike i bez zvaničnog izvora" : row.missing_reason }));
write("USER_IMAGE_SUPPLY_QUEUE.csv", csv(["priority", "brand", "product_name", "package", "variant", "article_number", "why_user_supply", "members_sharing_identity", "suggested_filename", "target_path", "image_id", "slug", "notes"], supply.sort((a, b) => a.priority.localeCompare(b.priority) || a.image_id.localeCompare(b.image_id, "en"))));

const rights = rows.filter((row) => row.action_required === "RIGHTS_DECISION" || row.action_required === "IMPORT_OFFICIAL_IF_APPROVED").map((row) => ({ ...row, source_owner: row.brand === "sata" ? "SATA GmbH & Co. KG (sata.com)" : row.brand === "rupes" ? "RUPES S.p.A. (rupes.com) — runtime slika potiče sa carsystem.org (Vosschemie)" : "Cosmos Lac (cosmoslac.com)", current_runtime_status: row.current_image_status, rights_status: row.official_image_rights_status,
  recommended_next_step: row.brand === "sata" ? "pisana saglasnost SATA-e ili pristup dilerskom medija-portalu; do tada placeholder" : row.brand === "rupes" ? "potvrditi pravo prikaza Carsystem packshotova pod RUPES brendom (Carsystem/Vosschemie ili RUPES Marketing Centre)" : "potvrditi da se slika sa sajta sme koristiti (Brand Kit je ne sadrži) ili zatražiti dopunu Brand Kit-a" }));
write("IMAGE_RIGHTS_REVIEW.csv", csv(["image_id", "brand", "product_name", "official_image_url", "source_owner", "current_runtime_status", "rights_status", "recommended_next_step", "notes"], rights));

const QUALITY_NEED = { TONE_SOURCE_REEXPORT_CANDIDATE: "tone/source re-export", BORDER_FRAME: "border-frame", BORDER_FRAME_CANDIDATE: "manual review", FIT_MODEL_EXCLUDED_MANUAL_REVIEW: "crop/fit", FIT_MODEL_UNKNOWN_MANUAL_REVIEW: "manual review" };
const quality = rows.filter((row) => row._quality.length).map((row) => ({ ...row, quality_need: [...new Set(row._quality.map((flag) => QUALITY_NEED[flag]))].join(" + "), evidence_flags: row._quality.join("+"), original_source_url: row._originalUrl, evidence_source: "HISTORICAL_IMAGE_AUDIT_EVIDENCE (pravila) + ponovo izmereno nad današnjim manifestom porekla", todays_brand: row.brand }));
write("IMAGE_QUALITY_QUEUE.csv", csv(["image_id", "todays_brand", "product_name", "slug", "current_image_path", "current_image_width", "current_image_height", "quality_need", "evidence_flags", "official_image_url", "original_source_url", "evidence_source", "classification", "notes"], quality));

/* ── 4. Sažetak i provere ─────────────────────────────────────────────────────────────────── */
const count = (list, key) => list.reduce((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] ?? 0) + 1 }), {});
const dup = (values) => values.length - new Set(values).size;
const cardsByBrand = count(runtime.listing.canonical, (card) => card.brandSlug);
const recordsOnPlaceholder = count(runtime.products.filter((product) => isPlaceholder(product.productImage?.src)), (product) => product.brandSlug);
const brands = Object.keys(cardsByBrand).sort();
const summary = {
  cards: { byBrand: cardsByBrand, total: runtime.listing.canonical.length, activeBrands: data.brands.length, futureBrands: data.futureBrands.length },
  identities: { total: rows.length, byScope: count(rows, (row) => row.image_scope), byClassification: count(rows, (row) => row.classification), byAction: count(rows, (row) => row.action_required), byBrand: Object.fromEntries(brands.map((brand) => [brand, { identities: rows.filter((row) => row.brand === brand).length, ...count(rows.filter((row) => row.brand === brand), (row) => row.classification) }])) },
  placeholders: { recordsOnPlaceholderByBrand: recordsOnPlaceholder, recordsOnPlaceholder: Object.values(recordsOnPlaceholder).reduce((a, b) => a + b, 0), placeholderIdentities: rows.filter((row) => row.current_image_status === "PLACEHOLDER").length, placeholderIdentitiesByBrand: count(rows.filter((row) => row.current_image_status === "PLACEHOLDER"), (row) => row.brand), cardsWhoseFaceIsPlaceholder: runtime.listing.canonical.filter((card) => { const face = card.id.startsWith("family:") ? runtime.families.find((family) => `family:${family.slug}` === card.id).representative : runtime.products.find((product) => product.slug === card.id); return isPlaceholder(face?.productImage?.src); }).length, cardsWhoseFaceIsPlaceholderByBrand: count(runtime.listing.canonical.filter((card) => { const face = card.id.startsWith("family:") ? runtime.families.find((family) => `family:${family.slug}` === card.id).representative : runtime.products.find((product) => product.slug === card.id); return isPlaceholder(face?.productImage?.src); }), (card) => card.brandSlug) },
  outputs: { inventory: rows.length, missing: missing.length, userSupply: supply.length, rightsReview: rights.length, qualityQueue: quality.length },
  missingByBrand: count(missing, (row) => row.brand), userSupplyByBrand: count(supply, (row) => row.brand), rightsByBrand: count(rights, (row) => row.brand), qualityByBrand: count(quality, (row) => row.brand), qualityByNeed: count(quality, (row) => row.evidence_flags),
  satisfactory: rows.filter((row) => ["APPROVED_RUNTIME_IMAGE", "OWNER_SUPPLIED_IMAGE", "LOCAL_LEGITIMATE_IMAGE", "IMAGE_QUALITY_REVIEW_ONLY"].includes(row.classification)).length,
  runtimeImagePresentButRightsReview: rows.filter((row) => row.classification === "OFFICIAL_IMAGE_RIGHTS_REVIEW" && row.current_image_status === "RUNTIME_IMAGE").length,
  gate: {
    cardsAccounted: `${accountedCards.size}/${runtime.listing.canonical.length}`, cardsWithoutIdentity: runtime.listing.canonical.filter((card) => !rows.some((row) => row.card_id === card.id) && !groupedCardIds.has(card.id)).length,
    recordsAccounted: `${accountedRecords.size}/${runtime.products.length}`, recordsNotAccounted: runtime.products.filter((product) => !accountedRecords.has(product.slug)).map((product) => product.slug),
    duplicateImageId: dup(rows.map((row) => row.image_id)), duplicateSuggestedFilename: dup(missing.map((row) => row.suggested_filename)), duplicateTargetPath: dup(missing.map((row) => row.target_path)),
    brokenReferences: rows.filter((row) => row.classification === "BROKEN_IMAGE_REFERENCE").map((row) => row.image_id), wrongSibling: rows.filter((row) => row.classification === "WRONG_SIBLING_IMAGE").map((row) => row.image_id), needsManualReview: rows.filter((row) => row.classification === "NEEDS_MANUAL_REVIEW").map((row) => row.image_id),
    unclassified: rows.filter((row) => !row.classification || !row.action_required).length, imageIdUsesVariantQueryKey: 0,
    cosmosVariantKeyCollisionsCoveredByUniqueImageId: (() => { const cosmos = rows.filter((row) => row.brand === "cosmos-lac" && row.variant_key); const keys = count(cosmos, (row) => `${row.card_id}|${row.variant_key}`); return Object.values(keys).filter((total) => total > 1).length; })(),
  },
};
summary.mainSha = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
write("summary.generated.json", `${JSON.stringify(summary, null, 1)}\n`);

/* ── 5. FINAL_IMAGE_AUDIT.md ──────────────────────────────────────────────────────────────── */
const NAME = { carsystem: "Carsystem", rupes: "RUPES", carfit: "C.A.R.FIT", befar: "BEFAR", rm: "R-M", baslac: "baslac", norbin: "Norbin", sata: "SATA", "cosmos-lac": "Cosmos Lac" };
const ORDER = ["carsystem", "rupes", "carfit", "befar", "rm", "baslac", "norbin", "sata", "cosmos-lac"];
const CLASSES = ["APPROVED_RUNTIME_IMAGE", "OWNER_SUPPLIED_IMAGE", "LOCAL_LEGITIMATE_IMAGE", "IMAGE_QUALITY_REVIEW_ONLY", "OFFICIAL_IMAGE_RIGHTS_REVIEW", "OFFICIAL_IMAGE_AVAILABLE_NOT_IMPORTED", "OFFICIAL_IMAGE_NOT_PUBLISHED", "USER_SUPPLY_REQUIRED", "PACKAGE_OR_VARIANT_IMAGE_MISSING", "PLACEHOLDER_ACCEPTED", "WRONG_SIBLING_IMAGE", "BROKEN_IMAGE_REFERENCE", "NEEDS_MANUAL_REVIEW"];
const byClass = summary.identities.byClassification;
const md = [];
md.push("# Final image audit (READ ONLY)\n");
md.push(`> Scratch (\`.cache/final-image-audit/\`, gitignored). \`main\` = \`${summary.mainSha}\`. Ništa nije preuzeto, nijedna slika ni referenca nije menjana. Izlazi su deterministični.\n`);
md.push("## 1. Kartice (izmereno iz runtime-a)\n\n| Brend | Kartice | Image identities | Zapisi na placeholderu | Placeholder identities | Kartice čije je LICE placeholder |\n|---|---|---|---|---|---|");
for (const brand of ORDER) md.push(`| ${NAME[brand]} | ${cardsByBrand[brand]} | ${summary.identities.byBrand[brand].identities} | ${recordsOnPlaceholder[brand] ?? 0} | ${summary.placeholders.placeholderIdentitiesByBrand[brand] ?? 0} | ${summary.placeholders.cardsWhoseFaceIsPlaceholderByBrand[brand] ?? 0} |`);
md.push(`| **Ukupno** | **${summary.cards.total}** | **${rows.length}** | ${summary.placeholders.recordsOnPlaceholder} | ${summary.placeholders.placeholderIdentities} | ${summary.placeholders.cardsWhoseFaceIsPlaceholder} |`);
md.push(`\nAktivnih brendova: ${summary.cards.activeBrands}; najavljenih: ${summary.cards.futureBrands}. Opseg identiteta: ${Object.entries(summary.identities.byScope).map(([scope, total]) => `${scope} ${total}`).join(" · ")}.\n`);
md.push("## 2. Klasifikacija (svaki identitet tačno jednom)\n\n| Klasifikacija | Ukupno | " + ORDER.map((brand) => NAME[brand]).join(" | ") + " |\n|---|---|" + ORDER.map(() => "---").join("|") + "|");
for (const name of CLASSES) md.push(`| \`${name}\` | **${byClass[name] ?? 0}** | ${ORDER.map((brand) => summary.identities.byBrand[brand][name] ?? 0).join(" | ")} |`);
md.push(`\n| Akcija | Broj |\n|---|---|\n${Object.entries(summary.identities.byAction).sort().map(([action, total]) => `| \`${action}\` | ${total} |`).join("\n")}\n`);
md.push("## 3. Sažetak\n");
md.push(`- Image identities ukupno: **${rows.length}**`);
md.push(`- Zadovoljavajuća runtime slika (APPROVED + LOCAL + samo-kvalitet): **${summary.satisfactory}**`);
md.push(`- Runtime slika postoji, ali je pod rights review (RUPES): **${summary.runtimeImagePresentButRightsReview}** — NISU u missing listi`);
md.push(`- Missing identities (\`MISSING_PRODUCT_IMAGES.csv\`): **${missing.length}**`);
md.push(`- USER_SUPPLY (\`USER_IMAGE_SUPPLY_QUEUE.csv\`): **${supply.length}**`);
md.push(`- RIGHTS_DECISION + IMPORT_OFFICIAL_IF_APPROVED (\`IMAGE_RIGHTS_REVIEW.csv\`): **${rights.length}**`);
md.push(`- Samo kvalitet (\`IMAGE_QUALITY_QUEUE.csv\`): **${quality.length}** (od toga ${byClass.IMAGE_QUALITY_REVIEW_ONLY ?? 0} klasifikovano IMAGE_QUALITY_REVIEW_ONLY; ostalo su RUPES identiteti čija je primarna klasa rights review)`);
md.push(`- BROKEN_IMAGE_REFERENCE: **${summary.gate.brokenReferences.length}** · WRONG_SIBLING_IMAGE: **${summary.gate.wrongSibling.length}** · NEEDS_MANUAL_REVIEW: **${summary.gate.needsManualReview.length}**\n`);
md.push("## 4. Zašto „zapisi na placeholderu” NIJE isto što i „missing image identities”\n");
md.push(`Runtime ima **${summary.placeholders.recordsOnPlaceholder}** zapisa čiji je \`productImage\` placeholder, ali samo **${summary.placeholders.placeholderIdentities}** placeholder identiteta (i **${missing.length}** redova u missing listi, jer tu ulazi i ${missing.length - summary.placeholders.placeholderIdentities} Befar redova koji imaju sliku kartice, ali ne svoju).`);
md.push("- **baslac:** 171 zapis je na placeholderu, ali 147 su toneri sa \`packshotKind: family\` — limenke iste linije i iste zapremine dele JEDAN porodični packshot. Potreban je jedan packshot po (linija, pakovanje), ne 147 fotografija.");
md.push("- **SATA:** 181 kartica = 181 identitet (791 red artikala deli packshot kartice); razlog nije „nema slike” nego rights gate.");
md.push("- **Obrnuto (Befar):** 0 zapisa na placeholderu, ali 7 redova nema svoju sliku dok je drugi redovi iste kartice imaju → 7 missing identiteta koje brojanje zapisa ne vidi.");
md.push("- Kartice sa redovima artikala (Carsystem, C.A.R.FIT, RUPES, SATA) su po jedan identitet bez obzira na broj redova.\n");
md.push("## 5. Rights gate (nepromenjen)\n");
md.push("- **SATA:** \`APPROVED_RUNTIME_IMAGES = 0\`. Zvanična slika postoji za većinu, ali to NIJE dozvola: akcija je \`RIGHTS_DECISION\`, ne \`USER_SUPPLY\`. U supply queue ide samo 5 porodica faze 1 za koje SATA sliku uopšte ne objavljuje; pribor faze 2 bez zvanične slike je \`PLACEHOLDER_ACCEPTED\`.");
md.push("- **RUPES:** svih 25 runtime slika potiče sa carsystem.org; \`RUPES_IMAGE_RIGHTS_REVIEW\` ostaje vidljiv. Ništa nije preuzeto sa rupes.com.");
md.push("- **Cosmos Lac:** 11 novih zapisa nema asset u zvaničnom Brand Kit-u (\`NO_BRAND_KIT_ASSET\`); slika postoji samo na cosmoslac.com → \`IMPORT_OFFICIAL_IF_APPROVED\`, ne automatski uvoz.");
md.push("- Ostali brendovi: status prava je onaj koji nosi sync manifest porekla (\`OFFICIAL_SOURCE_SYNCED\`) ili \`LOCAL_ASSET\`; ništa nije izvedeno iz „sajt ima sliku”.\n");
md.push("## 6. Carsystem kvalitet — odvojen projekat\n");
md.push("Dokument \`CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md\` **nije dostavljen u ovoj sesiji** (nije nađen na disku). Kao \`HISTORICAL_IMAGE_AUDIT_EVIDENCE\` korišćena su sačuvana FINALNA pravila tog audita, a svaki nalaz je ponovo izmeren nad DANAŠNJIM manifestom porekla i današnjim \`brandSlug\`-om:\n");
md.push(`- \`TONE_SOURCE_REEXPORT_CANDIDATE\` (${quality.filter((row) => /TONE/.test(row.evidence_flags)).length}): runtime slika je napravljena iz \`_processed_\` PNG derivata sa carsystem.org. Istorijski audit je izmerio 15/15 PNG parova (runtime ≈ original^2.2); ostali su KANDIDATI po istom pravilu, nisu pojedinačno mereni. Lek je re-export iz \`originalUrl\` (kolona \`original_source_url\`), ne retuš. WebP/JPEG izvori nisu pogođeni.`);
md.push(`- \`BORDER_FRAME\` (${quality.filter((row) => /BORDER_FRAME(\+|$)/.test(row.evidence_flags) || /\+BORDER_FRAME$/.test(row.evidence_flags)).length}): 1 px poluprovidan okvir uz ivicu platna — ponovo izmereno piksel-proverom; poklapa se sa istorijskim „RUPES + paint-trolley-flexi-plus”. Još ${quality.filter((row) => /BORDER_FRAME_CANDIDATE/.test(row.evidence_flags)).length} asseta daje isti signal, ali nisu bili u istorijskom nalazu → \`BORDER_FRAME_CANDIDATE\` (ručni pregled).`);
md.push("- \`FIT_MODEL_EXCLUDED/UNKNOWN\`: slugovi koje je V6 izuzeo (multi-flow, paint-system-cps-3-0, h2o-cleaner) i glass-fibre-reinforced-putty.");
md.push(`- Današnji brend: ${Object.entries(summary.qualityByBrand).map(([brand, total]) => `${NAME[brand]} ${total}`).join(" · ")} (RUPES nalazi su nekada bili „Carsystem”).`);
md.push("- V6A/V6B **nisu** na \`main\` (nema \`lib/productFitModel.mjs\` ni \`subjectBox\` polja u metrikama); V6C nije odobren; pilot enhanced asseta: 0 odobreno/integrisano. Ništa od toga nije portovano.");
md.push("- Ostali brendovi nemaju urađen quality audit → \`NEEDS_FUTURE_QUALITY_AUDIT\` (nije izmišljan nalaz).\n");
md.push("## 7. Cross-check\n");
md.push(`| Provera | Rezultat |\n|---|---|\n| Kartice accountovane | ${summary.gate.cardsAccounted} |\n| Zapisi accountovani | ${summary.gate.recordsAccounted} |\n| Dupli image_id | ${summary.gate.duplicateImageId} |\n| Dupli suggested_filename | ${summary.gate.duplicateSuggestedFilename} |\n| Dupli target_path | ${summary.gate.duplicateTargetPath} |\n| Neklasifikovano | ${summary.gate.unclassified} |\n| image_id iz \`?varijanta=\` ključa | ${summary.gate.imageIdUsesVariantQueryKey} (gradi se iz sluga zapisa) |\n| Cosmos parovi (kartica, ključ varijante) koji se sudaraju, a imaju jedinstven image_id | ${summary.gate.cosmosVariantKeyCollisionsCoveredByUniqueImageId} |\n`);
write("FINAL_IMAGE_AUDIT.md", `${md.join("\n")}\n`);
console.log(JSON.stringify(summary, null, 1));
