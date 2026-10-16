import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { articlePackSizes, articles, internalEquipment, stockImportLines, stockImports, systemSettings, users } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { customerDisplayDecision, customerStockLine, normalizeDisplayPolicy, STOCK_DISPLAY_SETTING } from "@/lib/stock/displayPolicy.mjs";
import { isSinglePiece } from "@/lib/ordering/packRule.mjs";
import { catalogOfferFacts } from "@/lib/ordering/ordering-service";
import { readStockFileAsync } from "@/lib/stock/readStockFile.mjs";
import { stockContentFingerprint } from "@/lib/stock/contentFingerprint.mjs";
import { buildArticleIndex, codeKey, linkLine, wholePacks } from "@/lib/stock/stockLink.mjs";

/**
 * Lager: otpremanje XLSX/CSV → pregled → potvrda → važeći snimak (dok. 65).
 *
 *  - Otpremanje i odluka traže `imports:write` (vlasnik i kancelarija). Kupci nikad ne
 *    stižu ovde: /portal je samo za interne naloge.
 *  - Isti fajl (SHA-256) ne pravi duplikat; neuspešan fajl se beleži kao 'neuspesno' i
 *    ne menja važeći snimak.
 *  - Potvrda je jedna transakcija sa zaključavanjem reda: ili je snimak važeći, ili nije.
 *  - Čuvaju se šifra, naziv i izvorna količina; cene i marže iz izveštaja nikad.
 */

export class StockImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StockImportError";
  }
}

type Actor = Pick<PortalUser, "id" | "name" | "role"> & { permissions?: readonly string[] };
const ENTITY = "Lager";

function assertCanImport(actor: Actor) {
  if (!can(actor as PortalUser, "imports:write")) throw new StockImportError("forbidden", "Lager otpremaju samo vlasnik i kancelarija.");
}

const safeName = (n: string) => n.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200) || "lager";

type Problem = { code: string; row?: number; detail?: string; count?: number };
export type StockImportSummary = {
  lines: number;
  zeros: number;
  negative: number;
  decimals: number;
  emptyQuantity: number;
  repeatedHeaders: number;
  unrecognizedRows: number;
  linked: number;
  unlinked: number;
  collisions: number;
  linkedViaKey: number;
  packConfirmed: number;
  packMissing: number;
  control: Record<string, unknown>;
  sheet: string | null;
  stockFilter: string | null;
  /** Stavke kod kojih se JM iz izveštaja razlikuje od potvrđene JM pakovanja (do 500). */
  jmRazlike?: { sifra: string; izvestaj: string; potvrdjeno: string }[];
  jmIzIzvestaja?: boolean;
};

/** JM razlika se pamti u sažetku otpremanja: tada nema broja pakovanja za tu stavku. */
function jmMismatchCodes(summary: unknown): Set<string> {
  const list = (summary as StockImportSummary | null)?.jmRazlike ?? [];
  return new Set(list.map((x) => x.sifra));
}

/* =========================================================================
 * Veza sa artiklima (uvek iz potvrđenih tabela, u trenutku čitanja)
 * ====================================================================== */

type Queryable = Pick<ReturnType<typeof getDb>, "select">;

async function linkContext(q: Queryable = getDb()) {
  const [arts, packs] = await Promise.all([
    q.select({ id: articles.id, code: articles.code }).from(articles),
    q
      .select({ articleId: articlePackSizes.articleId, unit: articlePackSizes.unit, packQuantity: articlePackSizes.packQuantity, label: articlePackSizes.label, fractionalOk: articlePackSizes.fractionalOk })
      .from(articlePackSizes),
  ]);
  return {
    index: buildArticleIndex(arts),
    packs: new Map(packs.map((p) => [p.articleId, { unit: p.unit, packQuantity: Number(p.packQuantity), label: p.label, fractionalOk: p.fractionalOk }])),
  };
}

function summarize(lines: { sourceCode: string; codeKey: string | null; quantity: number | null }[], ctx: Awaited<ReturnType<typeof linkContext>>) {
  const s = { linked: 0, unlinked: 0, collisions: 0, linkedViaKey: 0, packConfirmed: 0, packMissing: 0 };
  for (const l of lines) {
    const link = linkLine(l, ctx.index, ctx.packs);
    if (link.link === "povezan") {
      s.linked++;
      if (!link.exactCode) s.linkedViaKey++;
      if (link.packStatus === "potvrdjeno") s.packConfirmed++;
      else s.packMissing++;
    } else if (link.link === "sudar") s.collisions++;
    else s.unlinked++;
  }
  return s;
}

/* =========================================================================
 * Pravilo čuvanja (0051): detaljne stavke samo za dva poslednja potvrđena snimka
 * ====================================================================== */

type TxLike = Pick<ReturnType<typeof getDb>, "execute">;

/** Isti ključ drži i `stock_import_retention()` — potvrde i čišćenja idu jedno za drugim. */
async function lockRetention(tx: TxLike) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('stock_imports_retention'))`);
}

/**
 * Ograničen postupak u bazi (SECURITY DEFINER): briše stavke starijih potvrđenih snimaka i
 * nepotvrđenih/odbačenih otpremanja starijih od 7 dana. Aplikacija nema opšte pravo brisanja.
 */
async function applyRetention(tx: TxLike) {
  const rows = await tx.execute<{ purged_imports: number; purged_lines: number }>(sql`SELECT purged_imports, purged_lines FROM stock_import_retention()`);
  const r = [...rows][0];
  return { purgedImports: Number(r?.purged_imports ?? 0), purgedLines: Number(r?.purged_lines ?? 0) };
}

/* =========================================================================
 * Otpremanje
 * ====================================================================== */

export type StockUploadResult = { importId: string; duplicate: boolean; status: string; recheckOf?: string | null; sameContent?: boolean };

export async function uploadStockReport(actor: Actor, input: { fileName: string; bytes: Uint8Array }): Promise<StockUploadResult> {
  assertCanImport(actor);
  const file = await readStockFileAsync(input.bytes);
  const r = file.report;
  const db = getDb();
  const earlier = await db
    .select({ id: stockImports.id, status: stockImports.status, parserVersion: stockImports.parserVersion, uploadedAt: stockImports.uploadedAt })
    .from(stockImports)
    .where(eq(stockImports.fileSha256, file.sha256))
    .orderBy(desc(stockImports.uploadedAt));
  // Isti fajl (SHA-256) sa istom verzijom čitača, ili zapis koji je prošao proveru → postojeći zapis.
  const same = earlier.find((e) => e.parserVersion === r.parser) ?? earlier.find((e) => e.status !== "neuspesno");
  if (same) return { importId: same.id, duplicate: true, status: same.status };
  // Ostaje: isti fajl je ranije pao na STARIJOJ verziji čitača → nova provera, stari pokušaj ostaje u istoriji (0052).
  const recheckOf = earlier[0]?.id ?? null;
  // Isti SADRŽAJ u drugom fajlu (npr. PDF i XLSX istog stanja, 0053) → postojeći zapis, bez drugog snimka.
  const contentSha256 = r.ok ? stockContentFingerprint(r.meta, r.lines) : null;
  if (contentSha256) {
    const [twin] = await db
      .select({ id: stockImports.id, status: stockImports.status })
      .from(stockImports)
      .where(and(eq(stockImports.contentSha256, contentSha256), inArray(stockImports.status, ["pregled", "potvrdjeno"])))
      .limit(1);
    if (twin) return { importId: twin.id, duplicate: true, status: twin.status, sameContent: true };
  }

  const ctx = r.ok ? await linkContext(db) : null;
  // JM iz izveštaja (raspored B) samo PROVERAVA potvrđeno pakovanje — nikad ga ne zamenjuje.
  const jmRazlike: { sifra: string; izvestaj: string; potvrdjeno: string }[] = [];
  if (ctx) {
    for (const l of r.lines) {
      if (!l.unit) continue;
      const link = linkLine(l, ctx.index, ctx.packs);
      if (link.unit && link.unit !== l.unit) jmRazlike.push({ sifra: l.sourceCode, izvestaj: l.unit, potvrdjeno: link.unit });
    }
  }
  const warnings = [...r.warnings];
  if (jmRazlike.length) warnings.push({ code: "jm_razlikuje_od_potvrde", count: jmRazlike.length });
  const summary: StockImportSummary = {
    lines: r.lines.length,
    zeros: r.stats.zeros ?? 0,
    negative: r.stats.negative ?? 0,
    decimals: r.stats.decimals ?? 0,
    emptyQuantity: r.stats.emptyQuantity ?? 0,
    repeatedHeaders: r.stats.repeatedHeaders ?? 0,
    unrecognizedRows: r.stats.unrecognizedRows ?? 0,
    ...(ctx ? summarize(r.lines, ctx) : { linked: 0, unlinked: 0, collisions: 0, linkedViaKey: 0, packConfirmed: 0, packMissing: 0 }),
    control: r.control,
    sheet: file.sheet,
    stockFilter: r.meta.stockFilter,
    jmIzIzvestaja: r.lines.some((l) => Boolean(l.unit)),
    jmRazlike: jmRazlike.slice(0, 500),
  };
  const status = r.ok ? "pregled" : "neuspesno";

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(stockImports)
      .values({
        fileSha256: file.sha256,
        contentSha256,
        fileName: safeName(input.fileName),
        fileBytes: file.bytes,
        fileFormat: file.format,
        parserVersion: r.parser,
        warehouseCode: r.meta.warehouseCode,
        warehouseName: r.meta.warehouseName,
        stockDate: r.meta.stockDate,
        printedOn: r.meta.printedOn,
        lineCount: r.ok ? r.lines.length : 0,
        summary,
        problems: { errors: r.errors.slice(0, 200), warnings: warnings.slice(0, 200) },
        status,
        uploadedBy: actor.id,
        decidedAt: status === "neuspesno" ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning({ id: stockImports.id });
    if (!created) {
      // Paralelan upload istog fajla ili sadržaja: pobedio je drugi zahtev — prikazuje se njegov zapis.
      const [other] = await tx
        .select({ id: stockImports.id, status: stockImports.status })
        .from(stockImports)
        .where(contentSha256 ? sql`${stockImports.fileSha256} = ${file.sha256} OR ${stockImports.contentSha256} = ${contentSha256}` : eq(stockImports.fileSha256, file.sha256))
        .orderBy(desc(stockImports.uploadedAt))
        .limit(1);
      return { importId: other.id, duplicate: true, status: other.status, sameContent: Boolean(contentSha256) };
    }
    if (r.ok) {
      for (let i = 0; i < r.lines.length; i += 500) {
        await tx.insert(stockImportLines).values(
          r.lines.slice(i, i + 500).map((l, j) => ({
            importId: created.id,
            lineNo: i + j + 1,
            sourceRow: l.row,
            sourceCode: l.sourceCode,
            codeKey: l.codeKey,
            name: l.name.slice(0, 300),
            quantity: l.quantity === null ? null : String(l.quantity),
          })),
        );
      }
    }
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.stockImportUploaded,
        entityType: ENTITY,
        entityId: created.id,
        entityLabel: `${safeName(input.fileName).slice(0, 120)}${r.meta.stockDate ? ` (stanje ${r.meta.stockDate})` : ""}`,
        after: { sha256: file.sha256, status, lines: summary.lines, errors: r.errors.length, warnings: warnings.length, stockDate: r.meta.stockDate, parser: r.parser, ponovnaProveraZa: recheckOf },
      },
      tx,
    );
    // Rok od 7 dana za nepotvrđena/odbačena; dva poslednja potvrđena snimka se ne diraju.
    await applyRetention(tx);
    return { importId: created.id, duplicate: false, status, recheckOf };
  });
}

/* =========================================================================
 * Pregled
 * ====================================================================== */

export type StockLineView = {
  lineNo: number;
  /** Oprema — izdaje se na revers (0054): van prodaje i van nerešenih pakovanja. */
  equipment: boolean;
  sourceRow: number;
  sourceCode: string;
  name: string;
  quantity: number | null;
  link: "povezan" | "nepovezan" | "sudar";
  articleCode: string | null;
  exactCode: boolean;
  unit: string | null;
  packLabel: string | null;
  packs: number | null;
  packReason: string | null;
};

export async function loadStockImport(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = getDb();
  const [imp] = await db
    .select({ imp: stockImports, uploader: users.name })
    .from(stockImports)
    .leftJoin(users, eq(users.id, stockImports.uploadedBy))
    .where(eq(stockImports.id, id))
    .limit(1);
  if (!imp) return null;
  const [decider] = imp.imp.decidedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, imp.imp.decidedBy)) : [];
  const rows = await db.select().from(stockImportLines).where(eq(stockImportLines.importId, id)).orderBy(stockImportLines.lineNo);
  const ctx = await linkContext(db);
  const jmBad = jmMismatchCodes(imp.imp.summary);
  // Oprema koja se izdaje na revers (0054): nije prodajna stavka i nije nerešeno pakovanje.
  const equipment = new Set((await db.select({ k: internalEquipment.codeKey }).from(internalEquipment)).map((e) => e.k));
  const lines: StockLineView[] = rows.map((l) => {
    const quantity = l.quantity === null ? null : Number(l.quantity);
    const link = linkLine({ sourceCode: l.sourceCode, codeKey: l.codeKey }, ctx.index, ctx.packs);
    const p = jmBad.has(l.sourceCode) ? ({ status: "nema_broja", reason: "jm_razlika" } as const) : wholePacks({ quantity, link });
    return {
      lineNo: l.lineNo,
      equipment: l.codeKey !== null && equipment.has(l.codeKey),
      sourceRow: l.sourceRow,
      sourceCode: l.sourceCode,
      name: l.name,
      quantity,
      link: link.link,
      articleCode: link.articleCode,
      exactCode: link.exactCode,
      unit: link.unit,
      packLabel: link.pack?.label ?? null,
      packs: p.status === "ok" ? p.packs : null,
      packReason: p.status === "ok" ? null : p.reason,
    };
  });
  const current = await currentStockSnapshot();
  return { header: imp.imp, uploaderName: imp.uploader, deciderName: decider?.name ?? null, lines, live: summarize(rows.map((l) => ({ sourceCode: l.sourceCode, codeKey: l.codeKey, quantity: null })), ctx), current };
}

export async function listStockImports(limit = 50) {
  return getDb()
    .select({
      id: stockImports.id,
      fileName: stockImports.fileName,
      status: stockImports.status,
      stockDate: stockImports.stockDate,
      printedOn: stockImports.printedOn,
      lineCount: stockImports.lineCount,
      uploadedAt: stockImports.uploadedAt,
      decidedAt: stockImports.decidedAt,
      uploaderName: users.name,
      warehouseCode: stockImports.warehouseCode,
      warehouseName: stockImports.warehouseName,
      linesPurgedAt: stockImports.linesPurgedAt,
      linesPurgedReason: stockImports.linesPurgedReason,
    })
    .from(stockImports)
    .leftJoin(users, eq(users.id, stockImports.uploadedBy))
    .orderBy(desc(stockImports.uploadedAt))
    .limit(limit);
}

/** Važeći snimak = poslednje potvrđeno otpremanje. */
export async function currentStockSnapshot() {
  const [row] = await getDb()
    .select({ id: stockImports.id, stockDate: stockImports.stockDate, printedOn: stockImports.printedOn, confirmedAt: stockImports.decidedAt, lineCount: stockImports.lineCount, fileName: stockImports.fileName })
    .from(stockImports)
    .where(eq(stockImports.status, "potvrdjeno"))
    .orderBy(desc(stockImports.decidedAt))
    .limit(1);
  return row ?? null;
}

/* =========================================================================
 * Odluka
 * ====================================================================== */

export async function confirmStockImport(actor: Actor, input: { importId: string; note?: string | null }) {
  assertCanImport(actor);
  const note = input.note?.trim().slice(0, 500) || null;
  return getDb().transaction(async (tx) => {
    // Paralelne potvrde se izvršavaju jedna za drugom (isto zaključavanje kao čišćenje).
    await lockRetention(tx);
    const locked = await tx.execute<{ id: string; status: string; stock_date: string | null; problems: { errors?: Problem[] }; file_name: string; line_count: number; purged: boolean }>(sql`
      SELECT id, status::text AS status, stock_date::text AS stock_date, problems, file_name, line_count, lines_purged_at IS NOT NULL AS purged
        FROM stock_imports WHERE id = ${input.importId}::uuid FOR UPDATE`);
    const imp = [...locked][0];
    if (!imp) throw new StockImportError("nema", "Otpremanje ne postoji.");
    if (imp.status !== "pregled") throw new StockImportError("odluceno", "O ovom otpremanju je već odlučeno.");
    if (imp.purged) throw new StockImportError("uklonjeno", "Stavke ovog otpremanja su uklonjene po pravilu čuvanja (starije od 7 dana). Otpremite nov izvoz.");
    if ((imp.problems?.errors ?? []).length) throw new StockImportError("greske", "Fajl ima greške koje blokiraju uvoz.");
    // Snimak sa starijim datumom stanja ne sme da zameni noviji važeći snimak.
    const cur = await tx.execute<{ stock_date: string }>(sql`
      SELECT stock_date::text AS stock_date FROM stock_imports
       WHERE status = 'potvrdjeno' ORDER BY decided_at DESC LIMIT 1 FOR UPDATE`);
    const currentDate = [...cur][0]?.stock_date ?? null;
    if (currentDate && imp.stock_date && imp.stock_date < currentDate) {
      throw new StockImportError("stariji", `Važeći snimak je od ${currentDate}; ovaj fajl je stariji (${imp.stock_date}).`);
    }
    const updated = await tx
      .update(stockImports)
      .set({ status: "potvrdjeno", decidedBy: actor.id, decidedAt: new Date(), decisionNote: note })
      .where(and(eq(stockImports.id, input.importId), eq(stockImports.status, "pregled")))
      .returning({ id: stockImports.id });
    if (!updated.length) throw new StockImportError("odluceno", "O ovom otpremanju je već odlučeno.");
    // Atomski sa potvrdom: ostaju stavke ovog i prethodnog potvrđenog snimka.
    const retention = await applyRetention(tx);
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.stockImportConfirmed,
        entityType: ENTITY,
        entityId: input.importId,
        entityLabel: `${imp.file_name.slice(0, 120)} — stanje ${imp.stock_date}`,
        after: { stockDate: imp.stock_date, lines: imp.line_count, previousStockDate: currentDate, retention },
        reason: note,
      },
      tx,
    );
    return { stockDate: imp.stock_date, retention };
  });
}

export async function discardStockImport(actor: Actor, input: { importId: string; note: string }) {
  assertCanImport(actor);
  const note = input.note.trim();
  if (note.length < 5) throw new StockImportError("razlog", "Upišite razlog odbacivanja (bar 5 znakova).");
  return getDb().transaction(async (tx) => {
    const updated = await tx
      .update(stockImports)
      .set({ status: "odbaceno", decidedBy: actor.id, decidedAt: new Date(), decisionNote: note.slice(0, 500) })
      .where(and(eq(stockImports.id, input.importId), eq(stockImports.status, "pregled")))
      .returning({ id: stockImports.id, fileName: stockImports.fileName });
    if (!updated.length) throw new StockImportError("odluceno", "O ovom otpremanju je već odlučeno ili ne postoji.");
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.stockImportDiscarded,
        entityType: ENTITY,
        entityId: input.importId,
        entityLabel: updated[0].fileName.slice(0, 120),
        reason: note,
      },
      tx,
    );
    await applyRetention(tx);
  });
}

/* =========================================================================
 * Prikaz kupcu (dok. 65 §4) — prekidač vlasnika, prag svežine od vremena stanja
 * ====================================================================== */

export async function stockDisplayPolicy() {
  const [row] = await getDb().select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, STOCK_DISPLAY_SETTING)).limit(1);
  return normalizeDisplayPolicy(row?.value ?? null);
}

/** Šta kupac vidi u bloku stanja za jedan BizniSoft artikal (bez cene, šifre i internog naziva). */
export type CustomerStockItem = { articleId: string; slug: string; variantKey: string | null; label: string; order: number };

/**
 * Artikli za kupčev prikaz stanja — NEZAVISNO od toga da li je kupcu uključeno poručivanje:
 * potvrđena veza sa tačnom karticom/varijantom, u programu, nije „samo upit za nabavku“ i nije
 * oprema koja se izdaje na revers (0054). Ne sadrži cene, šifre ni interne nazive.
 */
export async function loadCatalogStockItems(): Promise<CustomerStockItem[]> {
  const rows = [...(await getDb().execute<{ id: string; slug: string; variant: string | null; unit: string; pq: string | null; label: string | null }>(sql`
    SELECT a.id, m.catalog_product_slug AS slug, m.catalog_variant_id AS variant, a.unit, ps.pack_quantity::text AS pq, ps.label
      FROM article_catalog_mappings m
      JOIN articles a ON a.id = m.article_id
      LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id
     WHERE m.status = 'mapped' AND m.catalog_product_slug IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM internal_equipment e WHERE e.code_key = regexp_replace(a.code, '^0+(?=[0-9])', ''))
       AND NOT COALESCE((SELECT d.procurement_only FROM article_offer_decisions d WHERE d.article_id = a.id ORDER BY d.decided_at DESC LIMIT 1), false)`))];
  const items: CustomerStockItem[] = [];
  for (const r of rows) {
    const facts = catalogOfferFacts(r.slug, r.variant);
    if (!facts.productExists || !facts.link) continue;
    const quantity = r.pq === null ? null : Number(r.pq);
    const label = quantity === null ? "" : isSinglePiece({ quantity, label: r.label ?? "" }, r.unit) ? `1 ${String(r.unit).toUpperCase() === "LIT" ? "L" : "kom"}` : (r.label ?? "");
    items.push({ articleId: r.id, slug: facts.link.slug, variantKey: facts.link.variantKey, label, order: quantity ?? 0 });
  }
  return items;
}

export type CustomerStockLine = { state: "ima" | "nema" | "upit"; text: string };
export type CustomerStock =
  | { state: "iskljuceno" }
  | { state: "zastareo"; stockDate: string }
  | { state: "svez"; stockDate: string; validUntil: Date; byArticle: Map<string, CustomerStockLine> };

/**
 * Šta prijavljeni kupac vidi o stanju za date artikle (po id-ju).
 *
 * - isključeno (prekidač, nema snimka, nema praga) → ništa se ne prikazuje i ne čitaju se stavke;
 * - snimak stariji od praga → samo „potrebna je provera“, bez brojeva;
 * - svež snimak → broj celih pakovanja samo uz potvrđenu vezu šifre, JM i pakovanje; sve ostalo
 *   (izostavljena šifra, sudar, nepotvrđeno pakovanje, razlika JM, negativno ili prazno stanje)
 *   je „Raspoloživost na upit“. Izostavljena šifra nije nula.
 */
export async function customerStockFor(articleIds: string[], now = new Date()): Promise<CustomerStock> {
  if (!articleIds.length || process.env.STOCK_CUSTOMER_DISPLAY === "0") return { state: "iskljuceno" };
  const db = getDb();
  const [policyRow] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, STOCK_DISPLAY_SETTING)).limit(1);
  if (!normalizeDisplayPolicy(policyRow?.value ?? null).enabled) return { state: "iskljuceno" };
  const snapshot = await currentStockSnapshot();
  const decision = customerDisplayDecision({
    env: process.env,
    policy: policyRow?.value ?? null,
    snapshot: snapshot?.stockDate ? { stockDate: snapshot.stockDate } : null,
    now,
  });
  if (!decision.show) return decision.reason === "zastareo_snimak" && snapshot?.stockDate ? { state: "zastareo", stockDate: snapshot.stockDate } : { state: "iskljuceno" };
  if (!snapshot?.stockDate) return { state: "iskljuceno" };
  const arts = await db.select({ id: articles.id, code: articles.code, unit: articles.unit }).from(articles).where(inArray(articles.id, articleIds));
  const ctx = await linkContext(db);
  const keys = [...new Set(arts.map((a) => codeKey(a.code)).filter((k): k is string => k !== null))];
  const lines = keys.length
    ? await db.select().from(stockImportLines).where(and(eq(stockImportLines.importId, snapshot.id), inArray(stockImportLines.codeKey, keys)))
    : [];
  const [snapSummary] = await db.select({ summary: stockImports.summary }).from(stockImports).where(eq(stockImports.id, snapshot.id));
  const jmBad = jmMismatchCodes(snapSummary?.summary ?? null);
  // Dva reda izvoza sa istim ključem šifre (npr. „91“ i „091“) su nejasni → bez broja.
  const keyCount = new Map<string | null, number>();
  for (const l of lines) keyCount.set(l.codeKey, (keyCount.get(l.codeKey) ?? 0) + 1);
  const byKey = new Map(lines.filter((l) => keyCount.get(l.codeKey) === 1).map((l) => [l.codeKey, l]));
  const byArticle = new Map<string, CustomerStockLine>();
  for (const a of arts) {
    const line = byKey.get(codeKey(a.code));
    const link = line ? linkLine({ sourceCode: line.sourceCode, codeKey: line.codeKey }, ctx.index, ctx.packs) : null;
    const packs =
      !line || !link || link.articleId !== a.id
        ? ({ status: "nema_broja", reason: !line ? "nije_u_izvozu" : "nepovezan" } as const)
        : jmBad.has(line.sourceCode)
          ? ({ status: "nema_broja", reason: "jm_razlika" } as const)
          : wholePacks({ quantity: line.quantity === null ? null : Number(line.quantity), link });
    const pack = link?.pack ?? null;
    byArticle.set(
      a.id,
      customerStockLine(packs, {
        label: pack?.label ?? null,
        unit: link?.unit ?? a.unit,
        single: pack ? isSinglePiece({ quantity: pack.packQuantity, label: pack.label }, link?.unit ?? a.unit) : false,
      }),
    );
  }
  return { state: "svez", stockDate: snapshot.stockDate, validUntil: decision.validUntil, byArticle };
}
