import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { getDb } from "@/db/client";
import { invoiceReversals, invoices, sourceDocumentLines, sourceDocuments } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { compareStornoToOriginal } from "@/lib/pdf/storno.mjs";
import type { IngestActor } from "@/lib/pdf/ingest";

/**
 * Naknadno pristiglo storno (docs/b2b/48).
 *
 * Storno je i dalje izvorni dokument koji se ne knjiži kao faktura. Ovde se
 * samo beleži VEZA sa originalom, i to isključivo po odštampanoj referenci
 * („…stornira dokument broj X od D…") — nikad po iznosu, datumu ili kupcu.
 *
 * Primenjuje se samo POTPUNO storno (`compareStornoToOriginal` = `full`), uz
 * isti datum originala iz reference. Tada original prestaje da ulazi u promet,
 * preporuke i pokazatelje kupovine (pogledi iz 0033 i
 * `effectiveInvoiceCondition`), a oba dokumenta ostaju vidljiva. Delimično,
 * nesaglasno ili sporno ide na ručni pregled i original OSTAJE u prometu.
 *
 * Redosled dolaska nije bitan: storno bez proknjiženog originala čeka
 * (`waiting_original`) i primenjuje se kada se original proknjiži.
 */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export type ReversalOutcome = { reversalId: string; status: "waiting_original" | "applied" | "review"; reasons: string[] };

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Ista redigovana oznaka kao `redactDocumentRef` u ingest.ts: bez celog broja dokumenta u tragu. */
const ref = (d: { fileHash: string; businessDocumentNumber: string | null }) => {
  const tail = (d.businessDocumentNumber ?? "").slice(-3);
  return `sd:${d.fileHash.slice(0, 12)}${tail ? `/…${tail}` : ""}`;
};

/**
 * Beleži storno čiji je izvorni dokument upravo upisan. Bez odštampane
 * reference vraća `null` — storno tada ostaje na ručnom pregledu kao i ranije.
 */
export async function registerStorno(
  tx: Tx,
  input: { stornoSourceDocumentId: string; issuerCode: string; originalNumber: string | null; originalDate: string | null },
  actor: IngestActor,
): Promise<ReversalOutcome | null> {
  if (!input.originalNumber) return null;
  const [created] = await tx
    .insert(invoiceReversals)
    .values({
      stornoSourceDocumentId: input.stornoSourceDocumentId,
      issuerCode: input.issuerCode,
      originalNumber: input.originalNumber,
      originalDate: input.originalDate,
      status: "waiting_original",
    })
    .onConflictDoNothing({ target: invoiceReversals.stornoSourceDocumentId })
    .returning({ id: invoiceReversals.id });
  if (!created) return null;
  return evaluateReversal(tx, created.id, actor);
}

/**
 * Posle knjiženja fakture: storna koja su je čekala ocenjuju se sada.
 * Zove se iz `postSourceDocument`, pa važi za svaki put knjiženja.
 */
export async function settleWaitingReversals(
  tx: Tx,
  original: { issuerCode: string; number: string },
  actor: IngestActor,
): Promise<ReversalOutcome[]> {
  const waiting = await tx
    .select({ id: invoiceReversals.id })
    .from(invoiceReversals)
    .where(
      and(
        eq(invoiceReversals.issuerCode, original.issuerCode),
        eq(invoiceReversals.originalNumber, original.number),
        eq(invoiceReversals.status, "waiting_original"),
      ),
    );
  const out: ReversalOutcome[] = [];
  for (const w of waiting) out.push(await evaluateReversal(tx, w.id, actor));
  return out;
}

/**
 * Posle razrešenja revizije original nosi druge stavke: ranija ocena storna
 * više nije dokaz, pa se svaka veza sa tom fakturom ocenjuje ponovo.
 */
export async function reevaluateReversalsForInvoice(tx: Tx, invoiceId: string, actor: IngestActor): Promise<ReversalOutcome[]> {
  const linked = await tx
    .select({ id: invoiceReversals.id })
    .from(invoiceReversals)
    .where(eq(invoiceReversals.originalInvoiceId, invoiceId));
  const out: ReversalOutcome[] = [];
  for (const l of linked) out.push(await evaluateReversal(tx, l.id, actor));
  return out;
}

const toCompareLines = (rows: { articleCode: string | null; quantity: string | null; unitPrice: string | null; discountPercent: string | null }[]) =>
  rows.map((l) => ({
    articleCode: l.articleCode,
    quantity: Number(l.quantity ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    discountPercent: Number(l.discountPercent ?? 0),
  }));

async function evaluateReversal(tx: Tx, reversalId: string, actor: IngestActor): Promise<ReversalOutcome> {
  const [r] = await tx.select().from(invoiceReversals).where(eq(invoiceReversals.id, reversalId)).for("update").limit(1);
  const [storno] = await tx.select().from(sourceDocuments).where(eq(sourceDocuments.id, r.stornoSourceDocumentId)).limit(1);
  const label = ref(storno);

  // Original: proknjižen izvorni dokument tog broja, kod istog izdavaoca.
  const originals = await tx
    .select()
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.issuerCode, r.issuerCode),
        eq(sourceDocuments.businessDocumentType, "faktura"),
        eq(sourceDocuments.businessDocumentNumber, r.originalNumber),
        ne(sourceDocuments.revisionStatus, "superseded"),
      ),
    );
  const posted = originals.filter((o) => o.invoiceId);

  if (posted.length === 0) {
    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.stornoWaitingOriginal,
        entityType: "Izvorni dokument",
        entityId: storno.id,
        entityLabel: label,
        reason: "Storno je sačuvan; original još nije proknjižen. Primenjuje se kada original stigne.",
      },
      tx,
    );
    return { reversalId, status: "waiting_original", reasons: [] };
  }

  const reasons: string[] = [];
  if (originals.length > 1) reasons.push("original_has_versions");
  const orig = posted[0];
  if (orig.revisionStatus !== "original" || orig.manualReview === "pending") reasons.push("original_not_clean");
  if (r.originalDate && orig.documentDate !== r.originalDate) reasons.push("original_date_differs");

  const [invoice] = await tx
    .select({ id: invoices.id, net: invoices.netAmount, gross: invoices.totalAmount })
    .from(invoices)
    .where(eq(invoices.id, orig.invoiceId!))
    .limit(1);

  const already = await tx
    .select({ id: invoiceReversals.id })
    .from(invoiceReversals)
    .where(and(eq(invoiceReversals.originalInvoiceId, invoice.id), eq(invoiceReversals.status, "applied")))
    .limit(1);
  if (already[0] && already[0].id !== reversalId) reasons.push("original_already_reversed");

  const lineCols = {
    articleCode: sourceDocumentLines.articleCode,
    quantity: sourceDocumentLines.quantity,
    unitPrice: sourceDocumentLines.unitPrice,
    discountPercent: sourceDocumentLines.discountPercent,
    grossAmount: sourceDocumentLines.grossAmount,
  };
  const stornoLines = await tx.select(lineCols).from(sourceDocumentLines).where(eq(sourceDocumentLines.sourceDocumentId, storno.id));
  const origLines = await tx.select(lineCols).from(sourceDocumentLines).where(eq(sourceDocumentLines.sourceDocumentId, orig.id));
  const cmp = compareStornoToOriginal(
    {
      partnerCode: storno.externalPartnerCode,
      total: round2(stornoLines.reduce((s, l) => s + Number(l.grossAmount ?? 0), 0)),
      lines: toCompareLines(stornoLines),
    },
    { partnerCode: orig.externalPartnerCode, total: Number(invoice.gross), lines: toCompareLines(origLines) },
  );
  reasons.push(...cmp.reasons);

  const applied = cmp.kind === "full" && reasons.length === 0;
  await tx
    .update(invoiceReversals)
    .set({
      status: applied ? "applied" : "review",
      originalSourceDocumentId: orig.id,
      originalInvoiceId: invoice.id,
      comparison: cmp.kind,
      reasons,
      netEffect: applied ? invoice.net : null,
      grossEffect: applied ? invoice.gross : null,
      updatedAt: sql`now()`,
    })
    .where(eq(invoiceReversals.id, reversalId));

  if (applied) {
    // Storno je razrešen dokazom; dokument ostaje, kao i original.
    await tx
      .update(sourceDocuments)
      .set({
        manualReview: "resolved",
        manualReviewNote: `Potpuno storno originala ${r.originalNumber} primenjeno: odštampana referenca, isti kupac, sve stavke poništene.`,
        manualReviewBy: actor.kind === "device" ? null : (actor.id ?? null),
        manualReviewAt: new Date(),
        updatedAt: sql`now()`,
      })
      .where(eq(sourceDocuments.id, storno.id));
  }

  await recordAudit(
    {
      actor,
      action: applied ? AUDIT_ACTIONS.stornoApplied : AUDIT_ACTIONS.stornoReview,
      entityType: "Izvorni dokument",
      entityId: orig.id,
      entityLabel: `${ref(orig)} ← ${label}`,
      before: { uPrometu: true },
      after: applied
        ? { uPrometu: false, neto: invoice.net, bruto: invoice.gross, storno: storno.id }
        : { uPrometu: true, poredjenje: cmp.kind, razlozi: reasons },
      reason: applied
        ? "Potpuno storno sa dokazanom vezom: original isključen iz prometa, preporuka i pokazatelja kupovine. Dokumenti ostaju."
        : "Storno nije potpun ili veza nije čista — original ostaje u prometu do odluke.",
    },
    tx,
  );
  return { reversalId, status: applied ? "applied" : "review", reasons };
}
