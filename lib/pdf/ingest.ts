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
import { parseBiznisoftPdf } from "@/lib/pdf/extract";
import { normalizePartnerCode } from "@/lib/commercial/externalIdentity.mjs";

export type IngestActor = { id: string; name: string; role: string };

/** Odbijeno knjiženje. Poruka je za ekran i ne sadrži podatke o kupcu. */
export class IngestError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "IngestError";
  }
}

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
  const code = partnerCode ? normalizePartnerCode(partnerCode) : null;

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
        externalPartnerCode: code,
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
    const customerId = await resolveMappedCustomer(tx, {
      issuerCode: input.issuerCode,
      externalPartnerCode: code!,
    });

    if (!customerId) {
      // Šifra ulazi u red za ručno razrešavanje, ako već nije tamo.
      await tx
        .insert(customerExternalIdentifiers)
        .values({
          sourceSystem: "biznisoft",
          issuerCode: input.issuerCode,
          externalPartnerCode: code!,
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
        partnerCode: code!,
      };
    }

    const invoiceId = await postSourceDocument(tx, created.id, customerId, actor);

    return {
      result: "ingested" as const,
      sourceDocumentId: created.id,
      invoiceId,
    };
  });
}

/** Tip transakcije koji Drizzle daje `db.transaction`. */
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Kupac po tačnoj šifri partnera. Bez fuzzy poklapanja, bez naziva. */
async function resolveMappedCustomer(
  tx: Tx,
  key: { issuerCode: string; externalPartnerCode: string },
): Promise<string | null> {
  const rows = await tx
    .select({ customerId: customerExternalIdentifiers.customerId })
    .from(customerExternalIdentifiers)
    .where(
      and(
        eq(customerExternalIdentifiers.sourceSystem, "biznisoft"),
        eq(customerExternalIdentifiers.issuerCode, key.issuerCode),
        eq(customerExternalIdentifiers.externalPartnerCode, key.externalPartnerCode),
        eq(customerExternalIdentifiers.status, "mapped"),
      ),
    )
    .limit(1);
  return rows[0]?.customerId ?? null;
}

/**
 * Knjiži jedan izvorni dokument u postojeće `invoices` / `invoice_lines`.
 *
 * Čita iz SAČUVANIH stavki, ne iz PDF-a. Zahvaljujući tome se original posle
 * uvoza više nikad ne otvara — ni kada se kupac mapira mesecima kasnije — pa
 * fajl ne mora da se čuva u sistemu.
 *
 * Ovo je JEDINO mesto koje pravi fakturu iz PDF-a. Druga putanja knjiženja bi
 * značila dva pravila za istu stvar i tiho razilaženje ledgera.
 */
async function postSourceDocument(
  tx: Tx,
  sourceDocumentId: string,
  customerId: string,
  actor: IngestActor,
): Promise<string> {
  const docs = await tx
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, sourceDocumentId))
    .limit(1);
  const doc = docs[0];
  if (!doc) throw new IngestError("Izvorni dokument ne postoji.", "not_found");

  /*
   * Knjiženje se odbija za sve što nije čist original.
   *
   * Ista pravila stoje i kao CHECK u bazi i kao uslov u pogledu ledgera; ovde
   * postoje da bi poruka bila razumljiva, ne da bi bila jedina odbrana.
   */
  if (doc.invoiceId) {
    throw new IngestError("Dokument je već proknjižen.", "already_posted");
  }
  if (doc.validationStatus !== "valid") {
    throw new IngestError("Nevalidan dokument se ne knjiži.", "not_valid");
  }
  if (doc.revisionStatus !== "original") {
    throw new IngestError("Zamenjen ili sporan dokument se ne knjiži.", "not_original");
  }
  if (!doc.businessDocumentNumber || !doc.documentDate) {
    throw new IngestError("Dokument bez broja ili datuma se ne knjiži.", "incomplete");
  }

  const lines = await tx
    .select()
    .from(sourceDocumentLines)
    .where(eq(sourceDocumentLines.sourceDocumentId, sourceDocumentId))
    .orderBy(sourceDocumentLines.lineNumber);

  if (lines.length === 0) {
    throw new IngestError("Dokument bez stavki se ne knjiži.", "no_lines");
  }

  const net = lines.reduce((sum, l) => sum + netOf(l), 0);
  const tax = lines.reduce((sum, l) => sum + Number(l.taxAmount ?? 0), 0);
  const gross = lines.reduce((sum, l) => sum + Number(l.grossAmount ?? 0), 0);

  const [invoice] = await tx
    .insert(invoices)
    .values({
      companyId: doc.issuerCode,
      documentKind: "faktura",
      sourceDocumentType: "Račun-otpremnica",
      number: doc.businessDocumentNumber,
      year: Number(doc.documentDate.slice(0, 4)),
      issuedOn: doc.documentDate,
      customerId,
      netAmount: String(round2(net)),
      taxAmount: String(round2(tax)),
      totalAmount: String(round2(gross)),
    })
    .returning({ id: invoices.id });

  for (const line of lines) {
    /*
     * Nepoznata šifra artikla NE blokira fakturu, ali se ni ne progutа.
     *
     * Artikal se upisuje u postojeći registar `articles`, pa ga zatiče
     * postojeći red za mapiranje na katalog. Bez ovoga bi se šifra videla samo
     * kao tekst na stavci i nikada ne bi stigla ni do jednog ekrana.
     */
    let articleId: string | null = null;
    if (line.articleCode) {
      await tx
        .insert(articles)
        .values({
          code: line.articleCode,
          name: line.description ?? line.articleCode,
          unit: line.unit,
        })
        .onConflictDoNothing();
      const found = await tx
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.code, line.articleCode))
        .limit(1);
      articleId = found[0]?.id ?? null;
    }

    await tx.insert(invoiceLines).values({
      invoiceId: invoice.id,
      lineNumber: line.lineNumber,
      articleId,
      articleCode: line.articleCode ?? "",
      description: line.description,
      quantity: String(line.quantity ?? 0),
      unitPrice: String(line.unitPrice ?? 0),
      discountPercent: String(line.discountPercent ?? 0),
      taxPercent: String(line.taxPercent ?? 0),
      lineAmount: String(round2(netOf(line))),
    });
  }

  await tx
    .update(sourceDocuments)
    .set({
      invoiceId: invoice.id,
      manualReview: "not_required",
      updatedAt: sql`now()`,
    })
    .where(eq(sourceDocuments.id, sourceDocumentId));

  await recordAudit(
    {
      actor,
      action: AUDIT_ACTIONS.pdfPosted,
      entityType: "Izvorni dokument",
      entityId: sourceDocumentId,
      entityLabel: redactDocumentRef(doc),
      after: { invoiceId: invoice.id, stavki: lines.length },
      reason: "Dokument proknjižen u fakture.",
    },
    tx,
  );

  return invoice.id;
}

/**
 * Neto stavke iz sačuvanih vrednosti.
 *
 * Bruto sa dokumenta sadrži PDV, a `invoice_lines.line_amount` je osnovica, pa
 * se oduzima odštampani iznos poreza umesto da se osnovica ponovo računa iz
 * količine i cene. Ponovno računanje bi na dužim dokumentima davalo drugi
 * zaokruženi zbir od onog koji piše na papiru.
 */
function netOf(line: { grossAmount: string | null; taxAmount: string | null }): number {
  return Number(line.grossAmount ?? 0) - Number(line.taxAmount ?? 0);
}

/**
 * Knjiži dokumente koji su čekali mapiranje šifre partnera.
 *
 * Poziva se pošto čovek poveže šifru sa kupcem. Sam ne odlučuje ništa: ako
 * šifra i dalje nije `mapped`, ne knjiži se ništa.
 */
export async function postAwaitingMapping(
  key: { issuerCode: string; externalPartnerCode: string },
  actor: IngestActor,
): Promise<{ posted: string[]; failed: { sourceDocumentId: string; reason: string }[] }> {
  const db = getDb();
  const code = normalizePartnerCode(key.externalPartnerCode);

  return db.transaction(async (tx) => {
    const customerId = await resolveMappedCustomer(tx, {
      issuerCode: key.issuerCode,
      externalPartnerCode: code,
    });
    if (!customerId) {
      throw new IngestError(
        "Šifra partnera nije povezana sa kupcem — nema šta da se knjiži.",
        "not_mapped",
      );
    }

    const waiting = await tx
      .select({ id: sourceDocuments.id })
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.issuerCode, key.issuerCode),
          eq(sourceDocuments.externalPartnerCode, code),
          eq(sourceDocuments.validationStatus, "valid"),
          eq(sourceDocuments.revisionStatus, "original"),
          isNull(sourceDocuments.invoiceId),
        ),
      )
      .orderBy(sourceDocuments.documentDate);

    const posted: string[] = [];
    const failed: { sourceDocumentId: string; reason: string }[] = [];
    for (const row of waiting) {
      try {
        await postSourceDocument(tx, row.id, customerId, actor);
        posted.push(row.id);
      } catch (error) {
        /*
         * Jedan neknjiživ dokument ne ruši ceo prolaz, ali se ni ne prećutkuje.
         * Poruka je iz `IngestError` — bez naziva kupca i bez broja dokumenta.
         */
        if (!(error instanceof IngestError)) throw error;
        failed.push({ sourceDocumentId: row.id, reason: error.message });
      }
    }
    return { posted, failed };
  });
}

const round2 = (value: number) => Math.round(value * 100) / 100;

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
