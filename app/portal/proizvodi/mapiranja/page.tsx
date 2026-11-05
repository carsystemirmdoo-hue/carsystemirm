import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import type { ProductMappingStatus } from "@/db/schema/commercial";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  ARTICLE_MAPPING_LIST_LIMIT,
  countArticleMappingsByStatus,
  listArticleMappings,
} from "@/lib/commercial/mapping-service";
import {
  PRODUCT_MAPPING_LABELS,
  PRODUCT_MAPPING_TONES,
} from "@/lib/portal/status-labels";
import { loadArticleOrderability } from "@/lib/ordering/ordering-service";
import { getAllCarsystemProducts } from "@/lib/carsystem-data";
import { MappingReview } from "./MappingReview";

export const dynamic = "force-dynamic";

const STATUSES: ProductMappingStatus[] = [
  "unmapped",
  "suggested",
  "mapped",
  "conflict",
  "rejected",
];

function parseStatus(raw: string | undefined): ProductMappingStatus | undefined {
  return STATUSES.includes(raw as ProductMappingStatus)
    ? (raw as ProductMappingStatus)
    : undefined;
}

export default async function ArticleMappingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requireCapability(
    "view:mapiranja",
    "/portal/proizvodi/mapiranja",
  );
  const canManage = can(user, "mappings:manage");
  // Predlog po šifri traži internu šifru na kataloškom proizvodu; danas je nema nijedan (kopija 8. 10.: 0 od 1.920).
  const canProposeByCode = getAllCarsystemProducts().some((product) => Boolean(product.internalCode));
  const params = await searchParams;

  const [rows, counts] = await Promise.all([
    listArticleMappings({ status: parseStatus(params.status), search: params.q }),
    countArticleMappingsByStatus(),
  ]);

  const orderability = await loadArticleOrderability(rows.map((r) => r.articleId));
  const reviewRows = rows.map((r) => ({
    ...r,
    orderable: orderability.get(r.articleId)?.orderable ?? false,
    orderReason: orderability.get(r.articleId)?.reason ?? null,
    catalogName: orderability.get(r.articleId)?.catalogName ?? null,
    variantLabel: orderability.get(r.articleId)?.variantLabel ?? null,
  }));

  const total = STATUSES.reduce((sum, status) => sum + counts[status], 0);
  const selectedStatus = parseStatus(params.status);

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Povezivanje artikala"
        description="Veza BizniSoft artikla (interna šifra) i tačne kataloške varijante pravi se po TAČNOJ šifri, nikad po nazivu. Prodajno pakovanje i JM potvrđuju se posebno. Samo POTVRĐENA veza na tačan proizvod i varijantu, uz stavku aktivnog cenovnika, čini artikal poručivim. Predlog nikad nije poručiv."
        meta={
          <>
            {STATUSES.map((status) => (
              <Badge key={status} tone={PRODUCT_MAPPING_TONES[status]}>
                {PRODUCT_MAPPING_LABELS[status]}: {counts[status]}
              </Badge>
            ))}
          </>
        }
      />

      {total === 0 ? (
        <section className="portal-panel">
          <h2>Još nema uvezenih artikala</h2>
          <p>
            Artikli dolaze iz BizniSoft izvoza. Katalog se u ovoj fazi ne uvozi i
            ne pokušava se mapiranje svih proizvoda — mapira se ono što je stiglo
            kroz promet.
          </p>
        </section>
      ) : (
        <>
          <section className="portal-panel">
            <form className="portal-filters" method="get">
              <label className="portal-field">
                <span>Stanje</span>
                <select name="status" defaultValue={params.status ?? ""}>
                  <option value="">Sva stanja</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PRODUCT_MAPPING_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="portal-field">
                <span>Pretraga po šifri ili nazivu</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ""}
                  maxLength={100}
                />
              </label>
              <button className="portal-button" type="submit" data-variant="primary">
                <span>Primenite</span>
              </button>
            </form>
            <p className="portal-login-hint">
              {canProposeByCode
                ? "„Predložite po šifri“ traži tačno poklapanje interne šifre. Dva kataloška proizvoda sa istom šifrom daju konflikt, ne izbor."
                : "Katalog još ne nosi interne šifre BizniSofta, pa predlog po šifri nije moguć. Vezu potvrdite kroz „Odlučite“: upišite slug kataloškog proizvoda i „Proverite“ — vide se naziv, slika i varijante pre čuvanja."}
            </p>
          </section>

          {rows.length >= ARTICLE_MAPPING_LIST_LIMIT ? (
            <p className="portal-login-hint" role="status">
              Prikazano je prvih {ARTICLE_MAPPING_LIST_LIMIT} artikala po šifri (ukupno u izabranom stanju:{" "}
              {selectedStatus ? counts[selectedStatus] : total}
              ). Ostale nađite pretragom po šifri ili nazivu, ili suzite stanje.
            </p>
          ) : null}

          {!canManage && counts.unmapped + counts.conflict > 0 ? (
            <p className="portal-login-hint">
              Vezu sa katalogom pravi i potvrđuje Vlasnik ili ko ima paket „Mapiranja kupaca i artikala“; sa
              ovog naloga se veza ne menja. Za artikal koji kupac traži, javite mu šifru iz BizniSofta.
            </p>
          ) : null}

          <MappingReview rows={reviewRows} canManage={canManage} canProposeByCode={canProposeByCode} />
        </>
      )}
    </>
  );
}
