import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customerExternalIdentifiers,
  customers,
  partnerImports,
  partnerRecords,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { registerExternalIdentifier } from "@/lib/commercial/identity-service";
import { readXlsx } from "@/lib/import/xlsx/readXlsx.mjs";
import {
  analyzePartners,
  diffPartnerSnapshots,
  parsePartnerWorkbook,
  summarizePartners,
} from "@/lib/partners/partnerRegistry.mjs";

export type PartnerActor = { id: string; name: string; role: string };

export const PARTNER_SOURCE_SYSTEM = "biznisoft";

export class PartnerRegistryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "PartnerRegistryError";
  }
}

/** Najveći prihvaćen fajl. Izvoz od ~600 partnera ima desetine kilobajta. */
export const PARTNER_FILE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Analiza bez upisa — isto što i uvoz, samo bez baze.
 *
 * Koristi je i CLI izveštaj, pa kancelarija može da vidi šta bi uvoz zatekao
 * pre nego što ijedan red uđe u bazu.
 */
export function analyzePartnerWorkbook(bytes: Buffer) {
  if (bytes.length > PARTNER_FILE_MAX_BYTES) {
    throw new PartnerRegistryError("Fajl je veći od 5 MB.", "too_large");
  }
  const parsed = parsePartnerWorkbook(readXlsx(bytes));
  const findings = analyzePartners(parsed.partners);
  const summary = summarizePartners(parsed.partners, parsed.aux);
  return { ...parsed, findings, summary };
}

/** Brojke nalaza po vrsti — u bazu i trag idu samo brojke, ne kontakti. */
function countBy<T>(items: readonly T[], key: (t: T) => string) {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
}

/**
 * Upisuje snimak registra partnera.
 *
 * Isti fajl (isti SHA-256) istog izdavaoca se ne upisuje dvaput — vraća se
 * postojeći uvoz. Blokirajući nalaz (dupla šifra) obara ceo uvoz: registar sa
 * dva partnera pod istom šifrom nije snimak, nego greška izvoza.
 */
export async function recordPartnerImport(
  input: { fileName: string; bytes: Buffer; issuerCode: string },
  actor: PartnerActor,
): Promise<{ importId: string; duplicate: boolean; summary: Record<string, unknown> }> {
  const issuerCode = input.issuerCode.trim();
  if (!issuerCode) {
    throw new PartnerRegistryError("Izdavalac je obavezan.", "missing_issuer");
  }
  const analysis = analyzePartnerWorkbook(input.bytes);
  const blocking = analysis.findings.filter((f) => f.severity === "blocking");
  if (blocking.length > 0) {
    throw new PartnerRegistryError(
      `Uvoz zaustavljen: ${blocking.map((f) => f.detail).join(" ")}`,
      "blocking_findings",
    );
  }

  const sha = createHash("sha256").update(input.bytes).digest("hex");
  const db = getDb();

  const [existing] = await db
    .select({ id: partnerImports.id, summary: partnerImports.summary })
    .from(partnerImports)
    .where(
      and(
        eq(partnerImports.sourceSystem, PARTNER_SOURCE_SYSTEM),
        eq(partnerImports.issuerCode, issuerCode),
        eq(partnerImports.fileSha256, sha),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      importId: existing.id,
      duplicate: true,
      summary: existing.summary as Record<string, unknown>,
    };
  }

  const previous = await loadCurrentPartnerRecords(issuerCode);
  const changes = diffPartnerSnapshots(
    previous.map((p) => ({ ...p, emails: p.emails ?? [] })),
    analysis.partners,
  );

  const summary = {
    ...analysis.summary,
    findings: countBy(analysis.findings, (f) => f.kind),
    sheetMismatches: analysis.sheetMismatches.length,
    changesSincePrevious: previous.length === 0 ? null : countBy(changes, (c) => c.change),
    // Šifre, ne nazivi: kritičnu promenu (PIB pod istom šifrom) čovek mora da nađe.
    criticalChanges: changes
      .filter((c) => c.severity === "critical")
      .map((c) => c.partnerCode),
  };

  const importId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(partnerImports)
      .values({
        sourceSystem: PARTNER_SOURCE_SYSTEM,
        issuerCode,
        profile: analysis.profile,
        fileName: input.fileName.slice(0, 200),
        fileSha256: sha,
        partnerCount: analysis.partners.length,
        summary,
        importedBy: actor.id,
      })
      .returning({ id: partnerImports.id });

    const rows = analysis.partners.map((p) => ({
      importId: created.id,
      partnerCode: p.partnerCode,
      name: p.name,
      pib: p.pib,
      pibStatus: p.pibStatus,
      city: p.city,
      address: p.address,
      emailRaw: p.emailRaw,
      emails: p.emails,
      phoneRaw: p.phoneRaw,
      repCode: p.repCode,
      activeInSource: p.activeInSource,
      classification: p.classification,
      sourceSheet: p.sourceSheet,
      sourceRow: p.sourceRow,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      await tx.insert(partnerRecords).values(rows.slice(i, i + 200));
    }

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.partnerImportRecorded,
        entityType: "Registar partnera",
        entityId: created.id,
        entityLabel: `${PARTNER_SOURCE_SYSTEM}/${issuerCode}`,
        after: {
          partnera: analysis.partners.length,
          kandidata: analysis.summary.repAssignedCandidates,
          zaProveru: analysis.summary.needsReview,
          kriticnihPromena: summary.criticalChanges.length,
          sha256: sha.slice(0, 16),
        },
        reason: "Uvezen snimak matičnih podataka partnera. Nije potvrda kupovine.",
        correlationId: randomUUID(),
      },
      tx,
    );
    return created.id;
  });

  return { importId, duplicate: false, summary };
}

export type CurrentPartner = {
  partnerCode: string;
  name: string;
  pib: string | null;
  pibStatus: string;
  city: string | null;
  address: string | null;
  emails: string[] | null;
  repCode: string | null;
  classification: string;
  importId: string;
};

/** Poslednji snimak registra za izdavaoca. */
export async function loadCurrentPartnerRecords(issuerCode: string): Promise<CurrentPartner[]> {
  const db = getDb();
  const [latest] = await db
    .select({ id: partnerImports.id })
    .from(partnerImports)
    .where(
      and(
        eq(partnerImports.sourceSystem, PARTNER_SOURCE_SYSTEM),
        eq(partnerImports.issuerCode, issuerCode),
      ),
    )
    .orderBy(desc(partnerImports.importedAt), desc(partnerImports.id))
    .limit(1);
  if (!latest) return [];
  return db
    .select({
      partnerCode: partnerRecords.partnerCode,
      name: partnerRecords.name,
      pib: partnerRecords.pib,
      pibStatus: partnerRecords.pibStatus,
      city: partnerRecords.city,
      address: partnerRecords.address,
      emails: partnerRecords.emails,
      repCode: partnerRecords.repCode,
      classification: partnerRecords.classification,
      importId: partnerRecords.importId,
    })
    .from(partnerRecords)
    .where(eq(partnerRecords.importId, latest.id))
    .orderBy(asc(partnerRecords.partnerCode));
}

export type PartnerRegistryRow = CurrentPartner & {
  identityStatus: string | null;
  customerId: string | null;
  customerName: string | null;
  /** Postojeći kupac sa istim PIB-om — PREDLOG za čoveka, nikad automatsko spajanje. */
  samePibCustomerId: string | null;
  samePibCustomerName: string | null;
};

/** Registar sa stanjem veze prema kupcu, za ekran kancelarije. */
export async function listPartnerRegistry(issuerCode: string): Promise<{
  latestImport: { id: string; importedAt: Date; fileName: string; summary: unknown } | null;
  rows: PartnerRegistryRow[];
}> {
  const db = getDb();
  const [latest] = await db
    .select({
      id: partnerImports.id,
      importedAt: partnerImports.importedAt,
      fileName: partnerImports.fileName,
      summary: partnerImports.summary,
    })
    .from(partnerImports)
    .where(
      and(
        eq(partnerImports.sourceSystem, PARTNER_SOURCE_SYSTEM),
        eq(partnerImports.issuerCode, issuerCode),
      ),
    )
    .orderBy(desc(partnerImports.importedAt), desc(partnerImports.id))
    .limit(1);
  if (!latest) return { latestImport: null, rows: [] };

  const rows = await db.execute<{
    partner_code: string;
    name: string;
    pib: string | null;
    pib_status: string;
    city: string | null;
    address: string | null;
    emails: string[] | null;
    rep_code: string | null;
    classification: string;
    import_id: string;
    identity_status: string | null;
    customer_id: string | null;
    customer_name: string | null;
    same_pib_customer_id: string | null;
    same_pib_customer_name: string | null;
  }>(sql`
    SELECT r.partner_code, r.name, r.pib, r.pib_status, r.city, r.address, r.emails,
           r.rep_code, r.classification, r.import_id,
           cei.status::text AS identity_status, cei.customer_id, c.name AS customer_name,
           pc.id AS same_pib_customer_id, pc.name AS same_pib_customer_name
      FROM partner_records r
      LEFT JOIN customer_external_identifiers cei
        ON cei.source_system = ${PARTNER_SOURCE_SYSTEM}
       AND cei.issuer_code = ${issuerCode}
       AND cei.external_partner_code = r.partner_code
      LEFT JOIN customers c ON c.id = cei.customer_id
      LEFT JOIN customers pc ON r.pib_status = 'valid' AND pc.pib = r.pib
     WHERE r.import_id = ${latest.id}
     ORDER BY r.classification, r.partner_code
  `);

  return {
    latestImport: latest,
    rows: [...rows].map((r) => ({
      partnerCode: r.partner_code,
      name: r.name,
      pib: r.pib,
      pibStatus: r.pib_status,
      city: r.city,
      address: r.address,
      emails: r.emails,
      repCode: r.rep_code,
      classification: r.classification,
      importId: r.import_id,
      identityStatus: r.identity_status,
      customerId: r.customer_id,
      customerName: r.customer_name,
      samePibCustomerId: r.same_pib_customer_id,
      samePibCustomerName: r.same_pib_customer_name,
    })),
  };
}

/**
 * Povezuje partnera iz registra sa kupcem u portalu — ODLUKA ČOVEKA.
 *
 * Dva izričita načina, bez trećeg:
 *   - `create`: nov kupac. Traži ispravan domaći PIB i da kupac sa tim PIB-om
 *     još ne postoji. Ako postoji, sistem NE spaja — traži `attach`.
 *   - `attach`: postojeći kupac koga je čovek izabrao (npr. poslovnica istog
 *     pravnog lica). Isti PIB je tada samo podrška odluci.
 *
 * Veza se upisuje kroz `registerExternalIdentifier`, pa važe ista pravila
 * sukoba: šifra koja već pokazuje na drugog kupca postaje `conflict`, ne
 * prepis.
 *
 * Ništa od ovoga ne tvrdi da je partner kupovao. Kupac u portalu je firma sa
 * kojom se može raditi; promet dokazuju prodajni dokumenti.
 */
export async function linkPartnerToCustomer(
  input:
    | { issuerCode: string; partnerCode: string; mode: "create"; reason: string }
    | { issuerCode: string; partnerCode: string; mode: "attach"; customerId: string; reason: string },
  actor: PartnerActor,
): Promise<{ customerId: string; identityStatus: string; conflict: string | null }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new PartnerRegistryError("Povezivanje traži razlog (najmanje 3 znaka).", "missing_reason");
  }
  const current = await loadCurrentPartnerRecords(input.issuerCode);
  const partner = current.find((p) => p.partnerCode === input.partnerCode);
  if (!partner) {
    throw new PartnerRegistryError("Šifra ne postoji u poslednjem uvozu registra.", "not_found");
  }

  const db = getDb();

  /*
   * Postojeća veza se proverava PRE ijednog upisa. Inače bi `create` otvorio
   * novog kupca, a registracija šifre zatim završila kao sukob — i ostao bi
   * kupac bez ijedne šifre.
   */
  const [existingIdentity] = await db
    .select({
      customerId: customerExternalIdentifiers.customerId,
      status: customerExternalIdentifiers.status,
    })
    .from(customerExternalIdentifiers)
    .where(
      and(
        eq(customerExternalIdentifiers.sourceSystem, PARTNER_SOURCE_SYSTEM),
        eq(customerExternalIdentifiers.issuerCode, input.issuerCode),
        eq(customerExternalIdentifiers.externalPartnerCode, partner.partnerCode),
      ),
    )
    .limit(1);
  if (existingIdentity?.customerId || existingIdentity?.status === "conflict" || existingIdentity?.status === "disabled") {
    const sameTarget =
      input.mode === "attach" && existingIdentity.customerId === input.customerId;
    if (!sameTarget) {
      throw new PartnerRegistryError(
        "Šifra partnera je već povezana, u sukobu ili isključena. Promenu veze radi kancelarija kroz ekran mapiranja.",
        "already_linked",
      );
    }
  }

  let customerId: string;

  if (input.mode === "create") {
    if (partner.pibStatus !== "valid" || !partner.pib) {
      throw new PartnerRegistryError(
        "Nov kupac traži ispravan domaći PIB. Partner bez PIB-a ili sa stranim brojem se ne otvara automatski.",
        "pib_not_valid",
      );
    }
    const [same] = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.pib, partner.pib))
      .limit(1);
    if (same) {
      throw new PartnerRegistryError(
        `Kupac sa istim PIB-om već postoji („${same.name}"). Ako je ovo ista firma ili njena poslovnica, izaberite „pripoji postojećem".`,
        "pib_exists",
      );
    }
    const [created] = await db
      .insert(customers)
      .values({ pib: partner.pib, name: partner.name, city: partner.city })
      .returning({ id: customers.id });
    customerId = created.id;
  } else {
    const [target] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);
    if (!target) throw new PartnerRegistryError("Izabrani kupac ne postoji.", "customer_not_found");
    customerId = target.id;
  }

  const result = await registerExternalIdentifier(
    {
      sourceSystem: PARTNER_SOURCE_SYSTEM,
      issuerCode: input.issuerCode,
      externalPartnerCode: partner.partnerCode,
      sourceName: partner.name,
      customerId,
    },
    actor,
  );

  await recordAudit({
    actor,
    action: AUDIT_ACTIONS.partnerPromotedToCustomer,
    entityType: "Šifra partnera",
    entityId: result.id,
    entityLabel: `${PARTNER_SOURCE_SYSTEM}/${input.issuerCode}/${partner.partnerCode}`,
    after: { nacin: input.mode, customerId, stanjeVeze: result.status },
    reason,
    correlationId: randomUUID(),
  });

  return { customerId, identityStatus: result.status, conflict: result.conflict };
}

/** Šifre partnera koje su već `mapped` na datog kupca (za izbor osnova potvrde). */
export async function mappedIdentifiersOf(customerId: string) {
  const db = getDb();
  return db
    .select({
      id: customerExternalIdentifiers.id,
      code: customerExternalIdentifiers.externalPartnerCode,
      issuerCode: customerExternalIdentifiers.issuerCode,
    })
    .from(customerExternalIdentifiers)
    .where(
      and(
        eq(customerExternalIdentifiers.customerId, customerId),
        eq(customerExternalIdentifiers.status, "mapped"),
      ),
    );
}

/** Izdavaoci za koje postoji bar jedan uvoz, najnoviji prvi. */
export async function listRegistryIssuers(): Promise<string[]> {
  const rows = await getDb().execute<{ issuer_code: string }>(sql`
    SELECT issuer_code FROM partner_imports
     WHERE source_system = ${PARTNER_SOURCE_SYSTEM}
     GROUP BY issuer_code
     ORDER BY max(imported_at) DESC`);
  return [...rows].map((r) => r.issuer_code);
}
