import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  articleCatalogMappings,
  articles,
  type ProductMappingStatus,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { notify } from "@/lib/notifications/notification-service";
import {
  ProductMappingError,
  proposeExactMapping,
  rejectMappingTransition,
} from "@/lib/commercial/productMapping.mjs";

export type MappingActor = { id: string; name: string; role: string };

export type ArticleMappingView = {
  articleId: string;
  articleCode: string;
  articleName: string;
  brand: string | null;
  productGroup: string | null;
  mappingId: string | null;
  status: ProductMappingStatus;
  catalogProductSlug: string | null;
  catalogVariantId: string | null;
  note: string | null;
  conflictReason: string | null;
  confirmedAt: Date | null;
};

/** Kataloški proizvod sveden na ono što mapiranje uopšte sme da gleda. */
export type CatalogCandidate = { slug: string; internalCode?: string | null };

/**
 * Predlaže vezu za jedan artikal, isključivo po tačnoj internoj šifri.
 *
 * Predlog NIJE primena. Red ostaje `suggested` dok ga čovek ne potvrdi, a
 * `suggested` ne otvara ni sliku, ni PDP, ni bilo šta prema kupcu.
 */
export async function proposeMappingForArticle(
  input: { articleId: string; catalogProducts: readonly CatalogCandidate[] },
  actor: MappingActor,
): Promise<{ status: ProductMappingStatus; catalogProductSlug: string | null }> {
  const db = getDb();
  const found = await db
    .select({ id: articles.id, code: articles.code, name: articles.name })
    .from(articles)
    .where(eq(articles.id, input.articleId))
    .limit(1);

  const article = found[0];
  if (!article) throw new ProductMappingError("Artikal ne postoji.", "not_found");

  const live = await loadLiveMapping(input.articleId);
  if (live && (live.status === "mapped" || live.status === "conflict")) {
    /*
     * Potvrđenu vezu predlog ne dira, i konflikt ne „rešava" ponovnim
     * pokretanjem. Oba stanja su rezultat odluke — prvo čovekove, drugo
     * izričitog zaustavljanja — i predlog nije ovlašćen da ih poništi.
     */
    return { status: live.status, catalogProductSlug: live.catalogProductSlug };
  }

  const proposal = proposeExactMapping({
    articleCode: article.code,
    catalogProducts: input.catalogProducts,
  });

  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    const values = {
      articleId: article.id,
      catalogProductSlug: proposal.catalogProductSlug,
      status: proposal.status as ProductMappingStatus,
      conflictReason: proposal.reason,
      proposedBy: actor.id,
      proposedAt: sql`now()`,
      updatedAt: sql`now()`,
    };

    if (live) {
      await tx
        .update(articleCatalogMappings)
        .set(values)
        .where(eq(articleCatalogMappings.id, live.id));
    } else {
      await tx.insert(articleCatalogMappings).values(values);
    }

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.productMappingProposed,
        entityType: "Mapiranje artikla",
        entityId: article.id,
        entityLabel: `${article.code} — ${article.name}`,
        before: live
          ? { status: live.status, slug: live.catalogProductSlug }
          : { status: "unmapped", slug: null },
        after: { status: proposal.status, slug: proposal.catalogProductSlug },
        reason:
          proposal.reason ??
          "Predlog po tačnom poklapanju interne šifre; naziv nije korišćen.",
        correlationId,
      },
      tx,
    );
  });

  return { status: proposal.status as ProductMappingStatus, catalogProductSlug: proposal.catalogProductSlug };
}

/**
 * Ručna potvrda ili poništavanje veze.
 *
 * Prelaz prolazi kroz istu čistu funkciju koju testovi dokazuju bez baze, pa se
 * pravilo „potvrda traži proizvod i razlog" ne može razići između to dvoje.
 */
export async function decideMapping(
  input: {
    articleId: string;
    status: Extract<ProductMappingStatus, "mapped" | "rejected" | "unmapped">;
    catalogProductSlug?: string | null;
    catalogVariantId?: string | null;
    note: string;
  },
  actor: MappingActor,
): Promise<void> {
  const live = await loadLiveMapping(input.articleId);
  const from = live?.status ?? "unmapped";

  const refusal = rejectMappingTransition({
    from,
    to: input.status,
    catalogProductSlug: input.catalogProductSlug,
    note: input.note,
  });
  if (refusal) throw new ProductMappingError(refusal, "bad_transition");

  const db = getDb();
  const found = await db
    .select({ code: articles.code, name: articles.name })
    .from(articles)
    .where(eq(articles.id, input.articleId))
    .limit(1);
  const article = found[0];
  if (!article) throw new ProductMappingError("Artikal ne postoji.", "not_found");

  const note = input.note.trim();
  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    const values = {
      articleId: input.articleId,
      status: input.status,
      // `unmapped` i `rejected` ne smeju zadržati slug: prazna veza koja i dalje
      // nosi proizvod je tačno oblik koji bi negde procurio kao „skoro potvrđen".
      catalogProductSlug: input.status === "mapped" ? input.catalogProductSlug! : null,
      catalogVariantId: input.status === "mapped" ? (input.catalogVariantId ?? null) : null,
      note,
      conflictReason: null,
      confirmedBy: input.status === "mapped" ? actor.id : null,
      confirmedAt: input.status === "mapped" ? sql`now()` : null,
      updatedAt: sql`now()`,
    };

    if (live) {
      await tx
        .update(articleCatalogMappings)
        .set(values)
        .where(eq(articleCatalogMappings.id, live.id));
    } else {
      await tx.insert(articleCatalogMappings).values(values);
    }

    await recordAudit(
      {
        actor,
        action:
          input.status === "mapped"
            ? AUDIT_ACTIONS.productMappingConfirmed
            : AUDIT_ACTIONS.productMappingRevoked,
        entityType: "Mapiranje artikla",
        entityId: input.articleId,
        entityLabel: `${article.code} — ${article.name}`,
        before: { status: from, slug: live?.catalogProductSlug ?? null },
        after: { status: input.status, slug: values.catalogProductSlug },
        reason: note,
        correlationId,
      },
      tx,
    );

    /*
     * Obavestenje ide SAMO kada se menja ono sto kupac vidi.
     *
     * Ulazak u `mapped` otvara sliku i PDP; izlazak iz `mapped` ih zatvara.
     * Prelazi izmedju `unmapped`, `suggested` i `conflict` kupcu ne menjaju
     * nista, pa bi obavestenje o njima bilo sum koji uci ljude da preskacu
     * listu.
     */
    const bilo = from === "mapped";
    const jeste = input.status === "mapped";
    if (bilo !== jeste) {
      await notify(
        {
          kind: "mapping_customer_facing_changed",
          severity: "warning",
          requiredCapability: "mappings:manage",
          title: jeste
            ? "Artikal je dobio kataloski identitet"
            : "Artiklu je oduzet kataloski identitet",
          body:
            `${article.code} — ${article.name}: ` +
            (jeste
              ? `povezan sa „${values.catalogProductSlug}". Od sada sme da prikaze sliku i PDP.`
              : "veza je ponistena. Artikal ostaje vidljiv interno, ali bez slike i PDP-a."),
          entityType: "Mapiranje artikla",
          entityId: input.articleId,
          actionHref: "/portal/proizvodi/mapiranja",
          // Sifra artikla je poslovni identifikator, ne osetljiv podatak.
          context: { sifra: article.code, stanje: input.status },
          correlationId,
          dedupeKey: `mapping_customer_facing:${input.articleId}:${input.status}`,
        },
        tx,
      );
    }
  });
}

/** Živi (neodbijeni) red mapiranja za artikal, ili `null`. */
async function loadLiveMapping(articleId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: articleCatalogMappings.id,
      status: articleCatalogMappings.status,
      catalogProductSlug: articleCatalogMappings.catalogProductSlug,
    })
    .from(articleCatalogMappings)
    .where(
      and(
        eq(articleCatalogMappings.articleId, articleId),
        ne(articleCatalogMappings.status, "rejected"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Artikli sa stanjem mapiranja.
 *
 * `LEFT JOIN` je namerno: artikal bez ijednog reda mapiranja i dalje mora biti
 * na listi, kao `unmapped`. Nemapiran artikal je poslovno stvaran i vidi ga i
 * kancelarija i gazda i komercijalista — ono što nema je kataloški identitet.
 */
export async function listArticleMappings(filter?: {
  status?: ProductMappingStatus;
  search?: string;
}): Promise<ArticleMappingView[]> {
  const db = getDb();

  const conditions = [];
  if (filter?.status) {
    conditions.push(
      filter.status === "unmapped"
        ? sql`coalesce(${articleCatalogMappings.status}, 'unmapped') = 'unmapped'`
        : eq(articleCatalogMappings.status, filter.status),
    );
  }
  if (filter?.search?.trim()) {
    const needle = `%${filter.search.trim()}%`;
    // Pretraga za čoveka; ne ulazi ni u jedan automatski predlog.
    conditions.push(
      sql`(${articles.code} ILIKE ${needle} OR ${articles.name} ILIKE ${needle})`,
    );
  }

  const rows = await db
    .select({
      articleId: articles.id,
      articleCode: articles.code,
      articleName: articles.name,
      brand: articles.brand,
      productGroup: articles.productGroup,
      mappingId: articleCatalogMappings.id,
      status: articleCatalogMappings.status,
      catalogProductSlug: articleCatalogMappings.catalogProductSlug,
      catalogVariantId: articleCatalogMappings.catalogVariantId,
      note: articleCatalogMappings.note,
      conflictReason: articleCatalogMappings.conflictReason,
      confirmedAt: articleCatalogMappings.confirmedAt,
    })
    .from(articles)
    .leftJoin(
      articleCatalogMappings,
      and(
        eq(articleCatalogMappings.articleId, articles.id),
        ne(articleCatalogMappings.status, "rejected"),
      ),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(articles.code))
    .limit(500);

  return rows.map((row) => ({
    ...row,
    status: row.status ?? ("unmapped" as ProductMappingStatus),
  }));
}

/** Brojači po stanju, uključujući artikle bez ijednog reda mapiranja. */
export async function countArticleMappingsByStatus(): Promise<
  Record<ProductMappingStatus, number>
> {
  const db = getDb();
  const rows = await db
    .select({
      status: sql<ProductMappingStatus>`coalesce(${articleCatalogMappings.status}, 'unmapped')`,
      total: count(),
    })
    .from(articles)
    .leftJoin(
      articleCatalogMappings,
      and(
        eq(articleCatalogMappings.articleId, articles.id),
        ne(articleCatalogMappings.status, "rejected"),
      ),
    )
    .groupBy(sql`coalesce(${articleCatalogMappings.status}, 'unmapped')`);

  const empty: Record<ProductMappingStatus, number> = {
    unmapped: 0,
    suggested: 0,
    mapped: 0,
    conflict: 0,
    rejected: 0,
  };
  for (const row of rows) empty[row.status] = row.total;
  return empty;
}

/**
 * Ugovor za budući bulk uvoz internih šifara iz Excel liste.
 *
 * Namerno samo ugovor: u ovoj fazi se katalog NE uvozi i ne pokušava se
 * mapiranje svih ~3.500 proizvoda. Oblik stoji ovde da bi uvoz kad dođe imao
 * gde da se prikači, i da bi već sada bilo jasno šta uvoz sme a šta ne.
 */
export type MappingImportRow = {
  /** BizniSoft šifra artikla — uvek string, vodeće nule su deo vrednosti. */
  articleCode: string;
  /** Interna šifra kataloškog proizvoda; prazna vrednost znači „ne diraj". */
  internalCode: string | null;
};

/**
 * Šta bulk uvoz sme.
 *
 * Postoji kao vrednost da bi ugovor bio pod testom, a ne samo u tekstu.
 */
export const MAPPING_IMPORT_CONTRACT = {
  /** Uvoz sme da predloži, nikad da potvrdi. Potvrda je uvek čovekova. */
  maxProducedStatus: "suggested" as const,
  /** Poklapanje isključivo po tačnoj šifri. */
  matching: "exact_internal_code" as const,
  /** Uvoz ne sme da pipne red koji je čovek već potvrdio ili odbio. */
  neverOverwrites: ["mapped", "rejected"] as const,
  /** Dvosmislena šifra ide u `conflict`, ne u izbor. */
  ambiguousBecomes: "conflict" as const,
};
