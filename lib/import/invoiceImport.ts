import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  articles,
  customers,
  importRows,
  importRuns,
  invoiceLines,
  invoices,
  salespeople,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  holdBackIncompleteInvoices,
  missingRequiredColumns,
  validateInvoiceRow,
} from "@/lib/import/invoiceRow.mjs";
import type { PortalUser } from "@/lib/authz/session";

export interface ImportOutcome {
  runId: number | null;
  status:
    | "uspesno"
    | "uspesno_sa_upozorenjima"
    | "greska"
    | "preskoceno_duplikat";
  rowsRead: number;
  rowsValid: number;
  rowsDuplicate: number;
  rowsWarning: number;
  rowsInvalid: number;
  invoicesCreated: number;
  invoicesUpdated: number;
  message: string;
}

export function fileFingerprint(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

type ValidatedRow = NonNullable<
  ReturnType<typeof validateInvoiceRow>["value"]
>;

/**
 * Uvozi jedan fajl.
 *
 * Idempotentnost počiva na dva ključa:
 *  - otisak sadržaja fajla (`import_runs.file_hash`) — isti fajl se ne obrađuje
 *    dvaput, nego se evidentira kao preskočen duplikat,
 *  - poslovni identitet fakture (pravno lice + vrsta + broj + godina) — ista
 *    faktura iz drugog fajla ažurira postojeći red umesto da napravi novi.
 *
 * Sve se odvija u jednoj transakciji: ili uđe ceo ispravan deo, ili ništa.
 */
export async function importInvoiceFile(
  {
    fileName,
    sourcePath,
    content,
    rows,
    dataDate,
  }: {
    fileName: string;
    sourcePath?: string | null;
    content: string | Buffer;
    rows: Record<string, unknown>[];
    dataDate?: string | null;
  },
  actor: PortalUser,
): Promise<ImportOutcome> {
  const db = getDb();
  const fileHash = fileFingerprint(content);

  const missing = missingRequiredColumns(rows);
  if (missing.length > 0) {
    return {
      runId: null,
      status: "greska",
      rowsRead: rows.length,
      rowsValid: 0,
      rowsDuplicate: 0,
      rowsWarning: 0,
      rowsInvalid: rows.length,
      invoicesCreated: 0,
      invoicesUpdated: 0,
      message: `Fajl nije uvezen: nedostaju kolone ${missing.join(", ")}.`,
    };
  }

  const existing = await db
    .select({ id: importRuns.id, status: importRuns.status })
    .from(importRuns)
    .where(eq(importRuns.fileHash, fileHash))
    .limit(1);

  if (existing.length > 0) {
    // Ponovljeni pokušaj se ne obrađuje, ali se beleži — u istoriji mora da
    // ostane trag da je neko pokušao ponovo da uveze isti fajl.
    await recordAudit({
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action: AUDIT_ACTIONS.importDuplicateAttempt,
      entityType: "Uvoz",
      entityId: String(existing[0].id),
      entityLabel: fileName,
      reason: `Fajl sa istim otiskom je već uvezen (uvoz #${existing[0].id}).`,
    });

    return duplicateOutcome(existing[0].id, rows.length);
  }

  const { rows: validated, heldBack } = holdBackIncompleteInvoices(
    rows.map((row, index) => validateInvoiceRow(row, index + 1)),
    rows,
  );
  const valid = validated.filter((row) => row.value !== null);
  const rowsInvalid = validated.filter((r) => r.status === "neispravan").length;
  const rowsWarning = validated.filter((r) => r.status === "upozorenje").length;

  let invoicesCreated = 0;
  let invoicesUpdated = 0;
  let runId: number | null = null;

  try {
    await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(importRuns)
        .values({
          fileName,
          sourcePath: sourcePath ?? null,
          fileHash,
          dataDate: dataDate ?? null,
          status: "u_toku",
          rowsRead: rows.length,
          startedBy: actor.id,
        })
        .returning({ id: importRuns.id });
      runId = run.id;

      // Svaki red — i ispravan i neispravan — ostavlja trag u privremenom sloju,
      // da bi izveštaj o greškama mogao da se preuzme i posle uvoza.
      type StagedRow = typeof importRows.$inferInsert;
      const staged: StagedRow[] = validated.flatMap<StagedRow>((row) =>
        row.problems.length === 0
          ? [
              {
                runId: run.id,
                rowNumber: row.rowNumber,
                status: row.status as "ispravan",
                field: null,
                message: null,
                raw: rows[row.rowNumber - 1] as Record<string, unknown>,
              },
            ]
          : row.problems.map((problem) => ({
              runId: run.id,
              rowNumber: row.rowNumber,
              status: row.status as "upozorenje" | "neispravan",
              field: problem.field,
              message: problem.message,
              raw: rows[row.rowNumber - 1] as Record<string, unknown>,
            })),
      );
      if (staged.length > 0) await tx.insert(importRows).values(staged);

      // Grupisanje stavki po fakturi prema poslovnom identitetu.
      const grouped = new Map<string, ValidatedRow[]>();
      for (const row of valid) {
        const value = row.value as ValidatedRow;
        const key = [
          value.companyId,
          value.documentKind,
          value.number,
          value.year,
        ].join("|");
        const bucket = grouped.get(key);
        if (bucket) bucket.push(value);
        else grouped.set(key, [value]);
      }

      for (const lines of grouped.values()) {
        const head = lines[0];

        const [customer] = await tx
          .insert(customers)
          .values({ pib: head.pib, name: head.customerName, city: head.city })
          .onConflictDoUpdate({
            target: customers.pib,
            set: { name: head.customerName, updatedAt: sql`now()` },
          })
          .returning({ id: customers.id });

        let salespersonId: string | null = null;
        if (head.salespersonCode) {
          const [person] = await tx
            .insert(salespeople)
            .values({
              sourceCode: head.salespersonCode,
              name: head.salespersonName ?? head.salespersonCode,
            })
            .onConflictDoUpdate({
              target: salespeople.sourceCode,
              set: { name: head.salespersonName ?? head.salespersonCode },
            })
            .returning({ id: salespeople.id });
          salespersonId = person.id;
        }

        const netAmount = lines.reduce((sum, line) => sum + Number(line.lineAmount), 0);
        const taxAmount = lines.reduce(
          (sum, line) => sum + (Number(line.lineAmount) * Number(line.taxPercent)) / 100,
          0,
        );

        const [invoice] = await tx
          .insert(invoices)
          .values({
            companyId: head.companyId,
            documentKind: head.documentKind as never,
            sourceDocumentType: head.sourceDocumentType,
            number: head.number,
            year: head.year as number,
            issuedOn: head.issuedOn as string,
            customerId: customer.id,
            salespersonId,
            netAmount: netAmount.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            totalAmount: (netAmount + taxAmount).toFixed(2),
            importRunId: run.id,
          })
          .onConflictDoUpdate({
            target: [
              invoices.companyId,
              invoices.documentKind,
              invoices.number,
              invoices.year,
            ],
            set: {
              issuedOn: head.issuedOn as string,
              customerId: customer.id,
              salespersonId,
              netAmount: netAmount.toFixed(2),
              taxAmount: taxAmount.toFixed(2),
              totalAmount: (netAmount + taxAmount).toFixed(2),
              sourceDocumentType: head.sourceDocumentType,
              importRunId: run.id,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: invoices.id, createdAt: invoices.createdAt, updatedAt: invoices.updatedAt });

        const isNew = invoice.createdAt.getTime() === invoice.updatedAt.getTime();
        if (isNew) invoicesCreated += 1;
        else invoicesUpdated += 1;

        // Stavke se pišu iznova za tu fakturu: ponovni uvoz istog dokumenta ne
        // sme da nagomila duple stavke.
        await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id));

        for (const line of lines) {
          const [article] = await tx
            .insert(articles)
            .values({
              code: line.articleCode,
              name: line.articleName,
              productGroup: line.productGroup,
              brand: line.brand,
              unit: line.unit,
            })
            .onConflictDoUpdate({
              target: articles.code,
              set: { name: line.articleName, updatedAt: sql`now()` },
            })
            .returning({ id: articles.id });

          await tx.insert(invoiceLines).values({
            invoiceId: invoice.id,
            lineNumber: line.lineNumber,
            articleId: article.id,
            articleCode: line.articleCode,
            description: line.articleName,
            quantity: Number(line.quantity).toFixed(3),
            unitPrice: Number(line.unitPrice).toFixed(4),
            discountPercent: Number(line.discountPercent).toFixed(3),
            taxPercent: Number(line.taxPercent).toFixed(3),
            lineAmount: Number(line.lineAmount).toFixed(2),
          });
        }
      }

      const status =
        rowsInvalid > 0
          ? "greska"
          : rowsWarning > 0
            ? "uspesno_sa_upozorenjima"
            : "uspesno";

      await tx
        .update(importRuns)
        .set({
          status,
          rowsValid: valid.length,
          rowsWarning,
          rowsInvalid,
          invoicesCreated,
          invoicesUpdated,
          finishedAt: sql`now()`,
          message:
            rowsInvalid > 0
              ? `${rowsInvalid} redova nije uvezeno zbog grešaka.`
              : null,
        })
        .where(eq(importRuns.id, run.id));

      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          action: AUDIT_ACTIONS.importCompleted,
          entityType: "Uvoz",
          entityId: String(run.id),
          entityLabel: fileName,
          after: {
            procitano: rows.length,
            ispravno: valid.length,
            upozorenja: rowsWarning,
            greske: rowsInvalid,
            fakture_nove: invoicesCreated,
            fakture_azurirane: invoicesUpdated,
          },
          reason: `Uvoz fajla ${fileName} (otisak ${fileHash.slice(0, 12)}…)`,
          correlationId: `import-${run.id}`,
        },
        tx,
      );
    });
  } catch (error) {
    /*
     * Dva istovremena otpremanja istog fajla: oba prođu proveru otiska iznad,
     * a jedinstveni indeks pusti samo prvo. Drugo je duplikat, ne greška.
     */
    if (!isUniqueViolation(error, "import_runs_file_hash_key")) throw error;
    const [winner] = await db
      .select({ id: importRuns.id })
      .from(importRuns)
      .where(eq(importRuns.fileHash, fileHash))
      .limit(1);
    return duplicateOutcome(winner?.id ?? null, rows.length);
  }

  return {
    runId,
    status:
      rowsInvalid > 0
        ? "greska"
        : rowsWarning > 0
          ? "uspesno_sa_upozorenjima"
          : "uspesno",
    rowsRead: rows.length,
    rowsValid: valid.length,
    rowsDuplicate: 0,
    rowsWarning,
    rowsInvalid,
    invoicesCreated,
    invoicesUpdated,
    message:
      rowsInvalid > 0
        ? `Uvezeno ${valid.length} od ${rows.length} redova. ${rowsInvalid} sa greškom` +
          (heldBack > 0 ? `, od toga ${heldBack} ispravnih stavki zadržano jer faktura nije potpuna.` : ".")
        : `Uvezeno ${valid.length} redova.`,
  };
}

function duplicateOutcome(runId: number | null, rowsRead: number): ImportOutcome {
  return {
    runId,
    status: "preskoceno_duplikat",
    rowsRead,
    rowsValid: 0,
    rowsDuplicate: rowsRead,
    rowsWarning: 0,
    rowsInvalid: 0,
    invoicesCreated: 0,
    invoicesUpdated: 0,
    message: `Preskočeno: isti fajl je već uvezen${runId ? ` (uvoz #${runId})` : ""}.`,
  };
}

/** Postgres 23505 nad datim indeksom, i kada ga Drizzle omota u `cause`. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (candidate.code === "23505" && candidate.constraint_name === constraint) return true;
    current = candidate.cause;
  }
  return false;
}

/** Čita CSV sa `;` ili `,` razdvajačem i vraća redove kao objekte. */
export function parseDelimited(content: string): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitRow(lines[0], delimiter).map((cell) =>
    cell.trim().toLocaleLowerCase("sr-Latn").replace(/\s+/g, "_"),
  );

  return lines.slice(1).map((line) => {
    const cells = splitRow(line, delimiter);
    /** @type {Record<string, unknown>} */
    const row: Record<string, unknown> = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? "";
    });
    return row;
  });
}

function splitRow(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}
