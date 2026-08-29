import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  articles,
  customerExternalIdentifiers,
  importRuns,
  invoiceLines,
  invoices,
  sourceDocumentLines,
  sourceDocuments,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { parseBiznisoftPdf, type ParsedDocument } from "@/lib/pdf/extract";
import { normalizePartnerCode } from "@/lib/commercial/externalIdentity.mjs";

export type IngestActor = { id: string; name: string; role: string };

export type IngestOutcome =
  /** Isti fajl je već uvezen. Nije greška i ne menja ništa. */
  | { result: "duplicate_file"; sourceDocumentId: string }
  /** Drugi fajl tvrdi da je isti poslovni dokument. Obe verzije se čuvaju. */
  | { result: "business_key_conflict"; sourceDocumentId: string; conflictsWith: string }
  /** Dokument nije prošao proveru; vidljiv je kancelariji, prometa nema. */
  | { result: "quarantined"; sourceDocumentId: string; status: string }
  /** Prošao, ali kupac nije mapiran — faktura još ne postoji. */
  | { result: "awaiting_customer_mapping"; sourceDocumentId: string; partnerCode: string }
  /** Prošao i proknjižen. */
  | { result: "ingested"; sourceDocumentId: string; invoiceId: string };

/**
 * Redigovana oznaka dokumenta za trag revizije i obaveštenja.
 *
 * Ceo broj dokumenta se NE upisuje: uz izdavaoca i datum on identifikuje
 * konkretnog kupca i posao. U tragu je dovoljan otisak — dokument se pronalazi
 * po `source_document_id`, koji je interni ključ.
 */
export function redactDocumentRef(doc: {
  fileHash: string;
  businessDocumentNumber?: string | null;
}): string {
  const tail = (doc.businessDocumentNumber ?? "").slice(-3);
  return `sd:${doc.fileHash.slice(0, 12)}${tail ? `/…${tail}` : ""}`;
}

/**
 * Uvozi jedan PDF.
 *
 * Ceo posao je JEDNA transakcija: izvorni dokument, njegove stavke, faktura i
 * trag revizije nastaju zajedno ili nikako. Delimičan uvoz je najgori mogući
 * ishod — ostavio bi fakturu bez stavki ili stavke bez fakture, a jedini ledger
 * bi tiho postao netačan.
 */
export async function ingestBiznisoftPdf(
  input: { bytes: Uint8Array; fileName: string; issuerCode: string; runId?: number },
  actor: IngestActor,
): Promise<IngestOutcome> {
  const parsed = await parseBiznisoftPdf(input.bytes);
  const db = getDb();

  /*
   * Idempotentnost po otisku SADRŽAJA, ne po imenu fajla.
   *
   * Ime se preimenuje i ne znači ništa; isti sadržaj je isti dokument. Provera
   * stoji i ovde i kao `UNIQUE` u bazi — ovde da odgovor bude čist „duplikat",
   * u bazi da dva paralelna uploada ne prođu oba.
   */
  const existing = await db
    .select({ id: sourceDocuments.id })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.fileHash, parsed.fileHash))
    .limit(1);

  if (existing[0]) {
    await recordAudit({
      actor,
      action: AUDIT_ACTIONS.pdfDuplicateSkipped,
      entityType: "Izvorni dokument",
      entityId: existing[0].id,
      entityLabel: redactDocumentRef(parsed),
      reason: "Isti fajl je već uvezen; ništa nije promenjeno.",
    });
    return { result: "duplicate_file", sourceDocumentId: existing[0].id };
  }

  const partnerCode = parsed.header.partnerCode.value;
  const docNumber = parsed.header.documentNumber.value;

  /*
   * Drugi fajl sa istim poslovnim ključem.
   *
   * Ne bira se „poslednji" — ni po datumu fajla, ni po redosledu uvoza. Obe
   * verzije se čuvaju, obe idu u ručni pregled, i NIJEDNA ne ulazi u ledger dok
   * čovek ne kaže koja važi.
   */
  let conflictsWith: string | null = null;
  if (parsed.validationStatus === "valid" && docNumber) {
    const twin = await db
      .select({ id: sourceDocuments.id })
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.issuerCode, input.issuerCode),
          eq(sourceDocuments.businessDocumentType, "faktura"),
          eq(sourceDocuments.businessDocumentNumber, docNumber),
          ne(sourceDocuments.revisionStatus, "superseded"),
        ),
      )
      .limit(1);
    conflictsWith = twin[0]?.id ?? null;
  }

  const correlationId = randomUUID();

  return db.transaction(async (tx) => {
    const conflictReason = conflictsWith
      ? "Drugi fajl tvrdi da je isti poslovni dokument. Sistem ne bira — obe verzije čekaju odluku."
      : null;

    const [created] = await tx
      .insert(sourceDocuments)
      .values({
        fileHash: parsed.fileHash,
        fileName: input.fileName,
        pageCount: parsed.pageCount,
        lineCount: parsed.lines.length,
        issuerCode: input.issuerCode,
        businessDocumentType: parsed.documentKind as "faktura" | "nepoznato",
        businessDocumentNumber: docNumber,
        documentDate: parsed.header.documentDate.value,
        ingestionRunId: input.runId ?? null,
        parserVersion: parsed.parserVersion,
        validationStatus: parsed.validationStatus as "valid",
        validationDetail: parsed.validationDetail,
        revisionStatus: conflictsWith ? "conflict" : "original",
        conflictReason,
        manualReview:
          conflictsWith || parsed.validationStatus !== "valid" ? "pending" : "not_required",
      })
      .returning({ id: sourceDocuments.id });

    if (parsed.lines.length > 0) {
      await tx.insert(sourceDocumentLines).values(
        parsed.lines.map((line) => ({
          sourceDocumentId: created.id,
          lineNumber: line.lineNumber,
          articleCode: line.articleCode,
          description: line.description,
          unit: line.unit,
          quantity: line.quantity === null ? null : String(line.quantity),
          unitPrice: line.unitPrice === null ? null : String(line.unitPrice),
          discountPercent: String(line.discountPercent ?? 0),
          taxPercent: line.taxPercent === null ? null : String(line.taxPercent),
          taxAmount: line.taxAmount === null ? null : String(line.taxAmount),
          grossAmount: line.grossAmount === null ? null : String(line.grossAmount),
          rawCells: line.raw,
          lineStatus: line.status,
        })),
      );
    }

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.pdfIngested,
        entityType: "Izvorni dokument",
        entityId: created.id,
        // Redigovano: bez naziva kupca, PIB-a i celog broja dokumenta.
        entityLabel: redactDocumentRef({ ...parsed, businessDocumentNumber: docNumber }),
        after: {
          status: parsed.validationStatus,
          stavki: parsed.lines.length,
          strana: parsed.pageCount,
          parser: parsed.parserVersion,
        },
        reason: conflictReason ?? parsed.validationDetail ?? "Dokument uvezen.",
        correlationId,
      },
      tx,
    );

    if (conflictsWith) {
      return {
        result: "business_key_conflict" as const,
        sourceDocumentId: created.id,
        conflictsWith,
      };
    }

    if (parsed.validationStatus !== "valid" || !partnerCode) {
      return {
        result: "quarantined" as const,
        sourceDocumentId: created.id,
        status: parsed.validationStatus,
      };
    }

    /*
     * Kupac se razrešava EXACT, po (izvor, izdavalac, šifra).
     *
     * Nemapirana šifra ne pravi kupca i ne pravi fakturu. Automatsko otvaranje
     * kupca po šifri sa fakture značilo bi da promet ulazi u ledger pre nego
     * što je iko potvrdio čiji je — a to se ispravlja teže nego što se čeka.
     */
    const code = normalizePartnerCode(partnerCode);
    const mapped = await tx
      .select({ customerId: customerExternalIdentifiers.customerId })
      .from(customerExternalIdentifiers)
      .where(
        and(
          eq(customerExternalIdentifiers.sourceSystem, "biznisoft"),
          eq(customerExternalIdentifiers.issuerCode, input.issuerCode),
          eq(customerExternalIdentifiers.externalPartnerCode, code),
          eq(customerExternalIdentifiers.status, "mapped"),
        ),
      )
      .limit(1);

    const customerId = mapped[0]?.customerId ?? null;

    if (!customerId) {
      // Šifra ulazi u red za ručno razrešavanje, ako već nije tamo.
      await tx
        .insert(customerExternalIdentifiers)
        .values({
          sourceSystem: "biznisoft",
          issuerCode: input.issuerCode,
          externalPartnerCode: code,
          status: "unmapped",
          createdBy: actor.id,
        })
        .onConflictDoNothing();

      await tx
        .update(sourceDocuments)
        .set({ manualReview: "pending", updatedAt: sql`now()` })
        .where(eq(sourceDocuments.id, created.id));

      return {
        result: "awaiting_customer_mapping" as const,
        sourceDocumentId: created.id,
        partnerCode: code,
      };
    }

    const [invoice] = await tx
      .insert(invoices)
      .values({
        companyId: input.issuerCode,
        documentKind: "faktura",
        sourceDocumentType: "Račun-otpremnica",
        number: docNumber!,
        year: Number((parsed.header.documentDate.value ?? "0000").slice(0, 4)),
        issuedOn: parsed.header.documentDate.value!,
        customerId,
        netAmount: String(round2(sumNet(parsed))),
        taxAmount: String(round2(sumTax(parsed))),
        totalAmount: String(round2(parsed.header.printedGrossTotal.value ?? 0)),
      })
      .returning({ id: invoices.id });

    /*
     * Artikal se vezuje EXACT po šifri; nepoznata šifra ne blokira fakturu.
     * `invoice_lines.article_code` je i onako tekst, pa promet ostaje tačan a
     * artikal ide u red za mapiranje.
     */
    for (const line of parsed.lines) {
      const known = line.articleCode
        ? await tx
            .select({ id: articles.id })
            .from(articles)
            .where(eq(articles.code, line.articleCode))
            .limit(1)
        : [];

      await tx.insert(invoiceLines).values({
        invoiceId: invoice.id,
        lineNumber: line.lineNumber,
        articleId: known[0]?.id ?? null,
        articleCode: line.articleCode ?? "",
        description: line.description,
        quantity: String(line.quantity ?? 0),
        unitPrice: String(line.unitPrice ?? 0),
        discountPercent: String(line.discountPercent ?? 0),
        taxPercent: String(line.taxPercent ?? 0),
        lineAmount: String(round2(line.netAmount ?? 0)),
      });
    }

    await tx
      .update(sourceDocuments)
      .set({ invoiceId: invoice.id, updatedAt: sql`now()` })
      .where(eq(sourceDocuments.id, created.id));

    return {
      result: "ingested" as const,
      sourceDocumentId: created.id,
      invoiceId: invoice.id,
    };
  });
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const sumNet = (doc: ParsedDocument) =>
  doc.lines.reduce((sum, l) => sum + (l.netAmount ?? 0), 0);
const sumTax = (doc: ParsedDocument) =>
  doc.lines.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);

/** Otvara `import_runs` zapis za jedan prolaz uvoza. */
export async function openIngestionRun(
  input: { fileName: string; fileHash: string },
  actor: IngestActor,
): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .insert(importRuns)
    .values({
      fileName: input.fileName,
      fileHash: input.fileHash,
      status: "u_toku",
      startedBy: actor.id,
    })
    .onConflictDoNothing()
    .returning({ id: importRuns.id });
  return rows[0]?.id ?? null;
}

/** Dokumenti koji čekaju ručni pregled. */
export async function listPendingReview() {
  const db = getDb();
  return db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.manualReview, "pending"))
    .limit(500);
}

/** Validni dokumenti koji još nisu proknjiženi jer kupac nije mapiran. */
export async function listAwaitingMapping() {
  const db = getDb();
  return db
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.validationStatus, "valid"),
        isNull(sourceDocuments.invoiceId),
      ),
    )
    .limit(500);
}
