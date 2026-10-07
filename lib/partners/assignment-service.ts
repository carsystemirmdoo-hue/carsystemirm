import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customerAssignments,
  customerExternalIdentifiers,
  customers,
  salespeople,
  users,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { planAssignments } from "@/lib/partners/assignmentPlan.mjs";
import {
  loadCurrentPartnerRecords,
  PARTNER_SOURCE_SYSTEM,
} from "@/lib/partners/partner-registry-service";

export type AssignmentActor = { id: string; name: string; role: string };

export class AssignmentError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AssignmentError";
  }
}

/** Korisnik sme biti cilj dodele samo ako je aktivan komercijalista. */
async function requireSalesRep(userId: string) {
  const [user] = await getDb()
    .select({ id: users.id, name: users.name, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.role !== "komercijalista" || !user.active) {
    throw new AssignmentError("Izabrani korisnik nije aktivan komercijalista.", "not_sales_rep");
  }
  return user;
}

/**
 * Povezuje BizniSoft šifru komercijaliste sa korisnikom portala.
 *
 * `salespeople` već postoji (uvoz faktura ga puni po šifri). Ovde se samo
 * potvrđuje ČIJA je šifra — bez te potvrde plan dodela je ne koristi.
 */
export async function linkSalespersonCode(
  input: { sourceCode: string; userId: string; name?: string },
  actor: AssignmentActor,
): Promise<void> {
  const sourceCode = input.sourceCode.trim();
  if (!sourceCode) throw new AssignmentError("Šifra komercijaliste je obavezna.", "missing_code");
  const user = await requireSalesRep(input.userId);
  const db = getDb();

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ userId: salespeople.userId })
      .from(salespeople)
      .where(eq(salespeople.sourceCode, sourceCode))
      .limit(1);

    await tx
      .insert(salespeople)
      .values({ sourceCode, name: input.name?.trim() || user.name, userId: user.id })
      .onConflictDoUpdate({
        target: salespeople.sourceCode,
        set: { userId: user.id },
      });

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.salespersonCodeLinked,
        entityType: "Šifra komercijaliste",
        entityId: null,
        entityLabel: `${PARTNER_SOURCE_SYSTEM}/${sourceCode}`,
        before: { userId: before?.userId ?? null },
        after: { userId: user.id, korisnik: user.name },
        reason: "Šifra komercijaliste iz BizniSofta povezana sa korisnikom portala.",
        correlationId: randomUUID(),
      },
      tx,
    );
  });
}

/** Ulaz plana, pročitan iz baze. */
async function loadPlanInput(issuerCode: string) {
  const db = getDb();
  const partners = await loadCurrentPartnerRecords(issuerCode);
  const identifiers = await db
    .select({
      partnerCode: customerExternalIdentifiers.externalPartnerCode,
      customerId: customerExternalIdentifiers.customerId,
      status: customerExternalIdentifiers.status,
    })
    .from(customerExternalIdentifiers)
    .where(
      and(
        eq(customerExternalIdentifiers.sourceSystem, PARTNER_SOURCE_SYSTEM),
        eq(customerExternalIdentifiers.issuerCode, issuerCode),
      ),
    );
  const reps = await db
    .select({
      sourceCode: salespeople.sourceCode,
      userId: salespeople.userId,
      userRole: users.role,
      userActive: users.active,
    })
    .from(salespeople)
    .leftJoin(users, eq(users.id, salespeople.userId));
  const existing = await db
    .select({ userId: customerAssignments.userId, customerId: customerAssignments.customerId })
    .from(customerAssignments);
  return {
    partners: partners.map((p) => ({ partnerCode: p.partnerCode, repCode: p.repCode })),
    identifiers,
    salespeople: reps.map((r) => ({
      sourceCode: r.sourceCode,
      userId: r.userId,
      userRole: r.userRole ?? null,
      userActive: r.userActive ?? null,
    })),
    existing,
  };
}

/** Predlog dodela za poslednji uvoz registra — samo čitanje. */
export async function previewAssignmentPlan(issuerCode: string) {
  return planAssignments(await loadPlanInput(issuerCode));
}

/**
 * Primenjuje plan: upisuje SAMO nove dodele, svaku sa tragom.
 *
 * Plan se računa ponovo unutar primene, ne prima se od pozivaoca — ekran koji
 * je prikazao plan pre pet minuta ne sme odlučiti o današnjem stanju.
 */
export async function applyAssignmentPlan(
  issuerCode: string,
  actor: AssignmentActor,
): Promise<{ granted: number; skipped: number }> {
  const plan = planAssignments(await loadPlanInput(issuerCode));
  const db = getDb();
  const correlationId = randomUUID();
  let granted = 0;

  await db.transaction(async (tx) => {
    for (const p of plan.proposed) {
      const inserted = await tx
        .insert(customerAssignments)
        .values({
          userId: p.userId,
          customerId: p.customerId,
          assignedBy: actor.id,
          basis: "biznisoft_rep_code",
        })
        .onConflictDoNothing()
        .returning({ userId: customerAssignments.userId });
      if (inserted.length === 0) continue;
      granted += 1;
      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.customerAssignmentGranted,
          entityType: "Dodela kupca",
          entityId: p.customerId,
          entityLabel: `komercijalista ${p.repCode}`,
          after: { userId: p.userId, osnov: "biznisoft_rep_code", sifrePartnera: p.partnerCodes },
          reason: "Dodela iz šifre komercijaliste na kartici partnera.",
          correlationId,
        },
        tx,
      );
    }
  });

  return { granted, skipped: plan.skipped.length };
}

/** Ručna dodela jednog kupca. */
export async function assignCustomer(
  input: { customerId: string; userId: string; reason: string },
  actor: AssignmentActor,
): Promise<{ created: boolean }> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new AssignmentError("Dodela traži razlog.", "missing_reason");
  const user = await requireSalesRep(input.userId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(customerAssignments)
      .values({ userId: user.id, customerId: input.customerId, assignedBy: actor.id, basis: "manual" })
      .onConflictDoNothing()
      .returning({ userId: customerAssignments.userId });
    if (inserted.length === 0) return { created: false };
    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerAssignmentGranted,
        entityType: "Dodela kupca",
        entityId: input.customerId,
        entityLabel: user.name,
        after: { userId: user.id, osnov: "manual" },
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
    return { created: true };
  });
}

/**
 * Oduzima kupca komercijalisti. Deluje odmah: opseg se čita iz baze pri
 * svakom zahtevu (`loadAssignedCustomerIds`), ne iz tokena.
 */
export async function removeAssignment(
  input: { customerId: string; userId: string; reason: string },
  actor: AssignmentActor,
): Promise<{ removed: boolean }> {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new AssignmentError("Oduzimanje traži razlog.", "missing_reason");
  const db = getDb();
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(customerAssignments)
      .where(
        and(
          eq(customerAssignments.customerId, input.customerId),
          eq(customerAssignments.userId, input.userId),
        ),
      )
      .returning({ basis: customerAssignments.basis });
    if (removed.length === 0) return { removed: false };
    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerAssignmentRemoved,
        entityType: "Dodela kupca",
        entityId: input.customerId,
        entityLabel: null,
        before: { userId: input.userId, osnov: removed[0].basis },
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
    return { removed: true };
  });
}

/** Ko je dodeljen kupcu, za ekran kupca. */
export async function listCustomerAssignees(customerId: string) {
  return getDb()
    .select({
      userId: users.id,
      name: users.name,
      basis: customerAssignments.basis,
      assignedAt: customerAssignments.assignedAt,
    })
    .from(customerAssignments)
    .innerJoin(users, eq(users.id, customerAssignments.userId))
    .where(eq(customerAssignments.customerId, customerId))
    .orderBy(asc(users.name));
}

/** Aktivni komercijalisti i njihove povezane šifre — za izbor u formi. */
export async function listSalesReps() {
  const rows = await getDb().execute<{ id: string; name: string; codes: string[] | null }>(sql`
    SELECT u.id, u.name,
           array_remove(array_agg(s.source_code ORDER BY s.source_code), NULL) AS codes
      FROM users u
      LEFT JOIN salespeople s ON s.user_id = u.id
     WHERE u.role = 'komercijalista' AND u.active
     GROUP BY u.id, u.name
     ORDER BY u.name`);
  return [...rows].map((r) => ({ id: r.id, name: r.name, codes: r.codes ?? [] }));
}

/** Da li kupac postoji (za kapiju forme). */
export async function customerExists(customerId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return Boolean(row);
}

/** Povezane šifre komercijalista (`salespeople`) sa imenom korisnika. */
export async function listSalespersonCodes() {
  return getDb()
    .select({ sourceCode: salespeople.sourceCode, userId: salespeople.userId, userName: users.name })
    .from(salespeople)
    .leftJoin(users, eq(users.id, salespeople.userId))
    .orderBy(asc(salespeople.sourceCode));
}
