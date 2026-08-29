import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customerExternalIdentifiers,
  customers,
  type ExternalIdentityStatus,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  decideIdentityWrite,
  ExternalIdentityError,
  identityKey,
  normalizePartnerCode,
} from "@/lib/commercial/externalIdentity.mjs";

export type IdentityActor = { id: string; name: string; role: string };

export type ExternalIdentityView = {
  id: string;
  sourceSystem: string;
  issuerCode: string;
  externalPartnerCode: string;
  sourceName: string | null;
  status: ExternalIdentityStatus;
  note: string | null;
  conflictReason: string | null;
  customerId: string | null;
  customerName: string | null;
  /**
   * PIB je ovde radi pregleda kancelarije, ne radi odlučivanja.
   * Nijedna funkcija u ovom modulu ne grana po njemu.
   */
  customerPib: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

/**
 * Upisuje šifru partnera koja je stigla iz izvora.
 *
 * Ne povezuje ništa samo od sebe kada bi to značilo izbor: dolazna šifra koja
 * već pokazuje na drugog kupca završava kao `conflict`, ne kao prepis. Sistem
 * koji „reši" takav slučaj sam je sistem koji jednom kupcu pokaže tuđe cene,
 * i to bez ijednog traga da je nešto odlučio.
 */
export async function registerExternalIdentifier(
  input: {
    sourceSystem: string;
    issuerCode: string;
    externalPartnerCode: string;
    sourceName?: string | null;
    customerId?: string | null;
  },
  actor: IdentityActor,
): Promise<{ id: string; status: ExternalIdentityStatus; conflict: string | null }> {
  // Baca pre ijednog upita ako je oblik neispravan — vodeće nule uključene.
  const code = normalizePartnerCode(input.externalPartnerCode);
  identityKey({ ...input, externalPartnerCode: code });

  const db = getDb();
  const existing = await db
    .select({
      id: customerExternalIdentifiers.id,
      customerId: customerExternalIdentifiers.customerId,
      status: customerExternalIdentifiers.status,
    })
    .from(customerExternalIdentifiers)
    .where(
      and(
        eq(customerExternalIdentifiers.sourceSystem, input.sourceSystem),
        eq(customerExternalIdentifiers.issuerCode, input.issuerCode),
        eq(customerExternalIdentifiers.externalPartnerCode, code),
      ),
    )
    .limit(1);

  const decision = decideIdentityWrite({
    incoming: { ...input, externalPartnerCode: code },
    existing: existing[0] ?? null,
  });

  const correlationId = randomUUID();

  if (decision.action === "noop") {
    return { id: existing[0].id, status: existing[0].status, conflict: null };
  }

  if (decision.action === "create") {
    const status: ExternalIdentityStatus = input.customerId ? "mapped" : "unmapped";
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(customerExternalIdentifiers)
        .values({
          sourceSystem: input.sourceSystem,
          issuerCode: input.issuerCode,
          externalPartnerCode: code,
          sourceName: input.sourceName ?? null,
          customerId: input.customerId ?? null,
          status,
          createdBy: actor.id,
        })
        .returning({ id: customerExternalIdentifiers.id });

      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.externalIdentifierRegistered,
          entityType: "Šifra partnera",
          entityId: created.id,
          // Šifra i izdavalac su poslovni identitet, ne osetljiv podatak.
          // PIB se namerno NE upisuje u trag.
          entityLabel: `${input.sourceSystem}/${input.issuerCode}/${code}`,
          after: { status, customerId: input.customerId ?? null },
          reason: "Šifra partnera evidentirana iz izvora.",
          correlationId,
        },
        tx,
      );
      return { id: created.id, status, conflict: null };
    });
  }

  const row = existing[0];

  if (decision.action === "attach") {
    return db.transaction(async (tx) => {
      await tx
        .update(customerExternalIdentifiers)
        .set({
          customerId: input.customerId!,
          status: "mapped",
          sourceName: input.sourceName ?? null,
          updatedAt: sql`now()`,
        })
        .where(eq(customerExternalIdentifiers.id, row.id));

      await recordAudit(
        {
          actor,
          action: AUDIT_ACTIONS.externalIdentifierMapped,
          entityType: "Šifra partnera",
          entityId: row.id,
          entityLabel: `${input.sourceSystem}/${input.issuerCode}/${code}`,
          before: { status: row.status, customerId: null },
          after: { status: "mapped", customerId: input.customerId },
          reason: "Šifra povezana sa kupcem po tačnom poklapanju šifre.",
          correlationId,
        },
        tx,
      );
      return { id: row.id, status: "mapped" as const, conflict: null };
    });
  }

  // decision.action === "conflict"
  return db.transaction(async (tx) => {
    await tx
      .update(customerExternalIdentifiers)
      .set({
        status: "conflict",
        conflictReason: decision.reason ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(customerExternalIdentifiers.id, row.id));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.externalIdentifierConflict,
        entityType: "Šifra partnera",
        entityId: row.id,
        entityLabel: `${input.sourceSystem}/${input.issuerCode}/${code}`,
        before: { status: row.status, customerId: row.customerId },
        after: { status: "conflict", pokusaniKupac: input.customerId ?? null },
        reason: decision.reason ?? "Konflikt spoljnog identiteta.",
        correlationId,
      },
      tx,
    );
    return { id: row.id, status: "conflict" as const, conflict: decision.reason ?? null };
  });
}

/**
 * Ručno razrešenje: čovek određuje čija je šifra.
 *
 * Jedini put kojim `conflict` izlazi iz konflikta. Razlog je obavezan — bez
 * njega bi u tragu ostalo samo da se nešto promenilo, a ne i zašto.
 */
export async function resolveExternalIdentifier(
  input: {
    id: string;
    customerId: string | null;
    status: Extract<ExternalIdentityStatus, "mapped" | "unmapped" | "disabled">;
    reason: string;
  },
  actor: IdentityActor,
): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new ExternalIdentityError(
      "Razrešenje traži razlog (najmanje 3 znaka).",
      "missing_reason",
    );
  }
  if (input.status === "mapped" && !input.customerId) {
    throw new ExternalIdentityError(
      "Povezivanje traži kupca — potvrda bez kupca ne znači ništa.",
      "missing_customer",
    );
  }

  const db = getDb();
  const before = await db
    .select({
      id: customerExternalIdentifiers.id,
      status: customerExternalIdentifiers.status,
      customerId: customerExternalIdentifiers.customerId,
      sourceSystem: customerExternalIdentifiers.sourceSystem,
      issuerCode: customerExternalIdentifiers.issuerCode,
      externalPartnerCode: customerExternalIdentifiers.externalPartnerCode,
    })
    .from(customerExternalIdentifiers)
    .where(eq(customerExternalIdentifiers.id, input.id))
    .limit(1);

  const row = before[0];
  if (!row) throw new ExternalIdentityError("Šifra partnera ne postoji.", "not_found");

  await db.transaction(async (tx) => {
    await tx
      .update(customerExternalIdentifiers)
      .set({
        // `unmapped` mora ostati bez kupca — isti uslov stoji i kao CHECK u bazi.
        customerId: input.status === "unmapped" ? null : input.customerId,
        status: input.status,
        note: reason,
        conflictReason: null,
        verifiedBy: actor.id,
        verifiedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerExternalIdentifiers.id, input.id));

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.externalIdentifierResolved,
        entityType: "Šifra partnera",
        entityId: input.id,
        entityLabel: `${row.sourceSystem}/${row.issuerCode}/${row.externalPartnerCode}`,
        before: { status: row.status, customerId: row.customerId },
        after: { status: input.status, customerId: input.customerId ?? null },
        reason,
        correlationId: randomUUID(),
      },
      tx,
    );
  });
}

/** Pregled za kancelariju i gazdu; `status` filtrira listu. */
export async function listExternalIdentifiers(filter?: {
  status?: ExternalIdentityStatus;
  search?: string;
}): Promise<ExternalIdentityView[]> {
  const db = getDb();

  const conditions = [];
  if (filter?.status) {
    conditions.push(eq(customerExternalIdentifiers.status, filter.status));
  }
  if (filter?.search?.trim()) {
    const needle = `%${filter.search.trim()}%`;
    /*
     * Pretraga po šifri i nazivu je za ČOVEKA i nema nikakve veze sa
     * povezivanjem. Rezultat ove funkcije nikada ne ulazi u automatsku odluku —
     * `registerExternalIdentifier` gleda isključivo tačan ključ.
     */
    conditions.push(
      sql`(${customerExternalIdentifiers.externalPartnerCode} ILIKE ${needle}
           OR ${customerExternalIdentifiers.sourceName} ILIKE ${needle}
           OR ${customers.name} ILIKE ${needle})`,
    );
  }

  const rows = await db
    .select({
      id: customerExternalIdentifiers.id,
      sourceSystem: customerExternalIdentifiers.sourceSystem,
      issuerCode: customerExternalIdentifiers.issuerCode,
      externalPartnerCode: customerExternalIdentifiers.externalPartnerCode,
      sourceName: customerExternalIdentifiers.sourceName,
      status: customerExternalIdentifiers.status,
      note: customerExternalIdentifiers.note,
      conflictReason: customerExternalIdentifiers.conflictReason,
      customerId: customerExternalIdentifiers.customerId,
      customerName: customers.name,
      customerPib: customers.pib,
      verifiedAt: customerExternalIdentifiers.verifiedAt,
      createdAt: customerExternalIdentifiers.createdAt,
    })
    .from(customerExternalIdentifiers)
    .leftJoin(customers, eq(customers.id, customerExternalIdentifiers.customerId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      asc(customerExternalIdentifiers.issuerCode),
      asc(customerExternalIdentifiers.externalPartnerCode),
    )
    .limit(500);

  return rows;
}

/** Brojači po stanju — ulaz za zaglavlje ekrana. */
export async function countExternalIdentifiersByStatus(): Promise<
  Record<ExternalIdentityStatus, number>
> {
  const db = getDb();
  const rows = await db
    .select({
      status: customerExternalIdentifiers.status,
      total: count(),
    })
    .from(customerExternalIdentifiers)
    .groupBy(customerExternalIdentifiers.status);

  const empty: Record<ExternalIdentityStatus, number> = {
    unmapped: 0,
    mapped: 0,
    conflict: 0,
    disabled: 0,
  };
  for (const row of rows) empty[row.status] = row.total;
  return empty;
}

/**
 * Kupac po šifri partnera — tačno poklapanje ili ništa.
 *
 * Vraća `null` i kada šifra postoji ali nije potvrđena. Nepotvrđena veza nije
 * slabiji oblik veze nego odsustvo veze.
 */
export async function findCustomerByPartnerCode(query: {
  sourceSystem: string;
  issuerCode: string;
  externalPartnerCode: string;
}): Promise<string | null> {
  const code = normalizePartnerCode(query.externalPartnerCode);
  const db = getDb();
  const rows = await db
    .select({ customerId: customerExternalIdentifiers.customerId })
    .from(customerExternalIdentifiers)
    .where(
      and(
        eq(customerExternalIdentifiers.sourceSystem, query.sourceSystem),
        eq(customerExternalIdentifiers.issuerCode, query.issuerCode),
        eq(customerExternalIdentifiers.externalPartnerCode, code),
        eq(customerExternalIdentifiers.status, "mapped"),
      ),
    )
    .limit(1);
  return rows[0]?.customerId ?? null;
}

// Pozivaoci moraju moci da razlikuju poslovno odbijanje od stvarne greske.
export { ExternalIdentityError };
