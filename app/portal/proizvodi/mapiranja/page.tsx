import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import type { ProductMappingStatus } from "@/db/schema/commercial";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  countArticleMappingsByStatus,
  listArticleMappings,
} from "@/lib/commercial/mapping-service";
import {
  PRODUCT_MAPPING_LABELS,
  PRODUCT_MAPPING_TONES,
} from "@/lib/portal/status-labels";
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
  const params = await searchParams;

  const [rows, counts] = await Promise.all([
    listArticleMappings({ status: parseStatus(params.status), search: params.q }),
    countArticleMappingsByStatus(),
  ]);

  const total = STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Mapiranja artikala"
        description="Veza BizniSoft artikla i kataloškog proizvoda pravi se po TAČNOJ internoj šifri, nikad po nazivu. Nemapiran artikal ostaje potpuno vidljiv interno — ono što nema je slika i PDP."
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
                <span>Primeni</span>
              </button>
            </form>
            <p className="portal-login-hint">
              {"„Predloži po šifri"} traži tačno poklapanje interne šifre. Dva
              kataloška proizvoda sa istom šifrom daju konflikt, ne izbor.
            </p>
          </section>

          <MappingReview rows={rows} canManage={canManage} />
        </>
      )}
    </>
  );
}
