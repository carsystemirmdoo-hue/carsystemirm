import Link from "next/link";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { brandProposals } from "@/lib/pricing/article-group-service";
import { ConfirmBrandButton } from "./ConfirmBrandButton";

export const dynamic = "force-dynamic";

/**
 * Pregledane grupe artikala (brend) za rabat po grupi. Prefiks naziva je samo
 * predlog; grupa važi tek kada je vlasnik potvrdi. BizniSoft grupe (kada stignu
 * u šifarniku) biće posebna, potvrđena grupa.
 */
export default async function ArticleGroupsPage() {
  const user = await requireCapability("view:rabati", "/portal/cene/rabati-iz-faktura/grupe-artikala");
  const groups = await brandProposals();
  const canConfirm = can(user, "prices:approve");
  return (
    <>
      <CrumbLabel segment="grupe-artikala" label="Grupe artikala" />
      <PageHeader
        eyebrow="Finansije · Rabati"
        title="Grupe artikala za rabat"
        description="Rabat po grupi važi samo za potvrđenu grupu. Predlog dolazi iz oznake brenda na početku naziva artikla; vlasnik ga pregleda i potvrdi. Pojedinačni artikal uvek ima prednost nad grupom, a grupa nad osnovnim rabatom kupca."
        actions={<Link className="rr-link" href="/portal/cene/rabati-iz-faktura/predlozi">← Pokrivenost rabata</Link>}
      />
      <section className="portal-panel">
        <div className="portal-table-wrap">
          <table className="portal-table rr-table">
            <thead>
              <tr>
                <th scope="col">Grupa</th>
                <th scope="col">Artikala (predlog)</th>
                <th scope="col">Potvrđeno</th>
                <th scope="col">Primeri</th>
                <th scope="col">Odluka</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.brand}>
                  <th scope="row">
                    {g.brand}
                    {g.outOfProgramme ? <small>van programa: {g.outOfProgramme} (istorija; ne nudi se)</small> : null}
                  </th>
                  <td>{g.proposed}</td>
                  <td>
                    {g.confirmed}
                    {g.other ? <small>drugačije upisano: {g.other} (ne menja se)</small> : null}
                  </td>
                  <td>
                    {g.examples.map((e) => (
                      <small key={e}>{e}</small>
                    ))}
                  </td>
                  <td>{g.ids.length ? (canConfirm ? <ConfirmBrandButton brand={g.brand} count={g.ids.length} /> : <small>čeka potvrdu vlasnika</small>) : <small>potvrđeno</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
