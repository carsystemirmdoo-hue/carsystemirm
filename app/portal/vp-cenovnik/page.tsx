import Link from "next/link";
import { Badge, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { listVpDrafts, loadCurrentVp } from "@/lib/pricing/vp-draft-service";
import { stageOf } from "./stage";
import { VpExcelUploadForm } from "./VpForms";

export const metadata = { title: "VP cenovnik" };
export const dynamic = "force-dynamic";

/**
 * VP cenovnik — priprema (2026-11-18): menadžer prodaje → kancelarija → vlasnik.
 * Važeći cenovnik po brendu, izvoz, nova priprema (procenti ili Excel) i spisak priprema.
 */
export default async function VpCenovnikPage() {
  const user = await requireCapability("view:vp_cenovnik", "/portal/vp-cenovnik");
  const [base, drafts] = await Promise.all([loadCurrentVp(), listVpDrafts(user)]);
  const canPrepare = can(user, "pricelist:prepare");
  const canOffice = can(user, "pricelist:office_check");
  const brands = new Map<string, number>();
  for (const r of base) brands.set(r.brand, (brands.get(r.brand) ?? 0) + 1);
  const brandList = [...brands].sort((a, b) => Number(a[0] === "Ostalo") - Number(b[0] === "Ostalo") || a[0].localeCompare(b[0], "sr"));
  const waiting = drafts.filter((d) => (canOffice && d.stage === "kancelarija") || (canPrepare && d.stage === "priprema"));

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="VP cenovnik"
        description="Važeći VP cenovnik po brendu i priprema novog: menadžer prodaje upisuje promene (procenat ili cena), kancelarija proverava staru pored nove cene i unosi u BizniSoft, vlasnik potvrđuje datum važenja."
        meta={<span>{base.length} artikala sa cenom</span>}
      />

      {waiting.length ? (
        <section className="portal-panel">
          <SectionHeader title={`Čeka Vas (${waiting.length})`} description={canOffice && !canPrepare ? "Pripreme koje treba proveriti i poslati vlasniku." : "Pripreme u radu ili za proveru."} />
          <ul className="vp-waiting">
            {waiting.map((d) => (
              <li key={d.id}>
                <Link href={`/portal/vp-cenovnik/${d.id}`}>{d.title}</Link> — {stageOf(d).label}, {d.changedCount} promenjenih cena
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="portal-panel">
        <SectionHeader title="Važeći VP cenovnik" description="Excel ima praznu kolonu „Nova VP“: upišite nove cene i otpremite fajl kao pripremu. Može ceo cenovnik ili jedan brend." />
        <p className="portal-export-links">
          <a className="portal-button" data-variant="primary" href="/api/portal/vp-cenovnik/izvoz?vrsta=vazeci" download>Ceo cenovnik (Excel)</a>
          {canPrepare ? (
            <Link className="portal-button" href="/portal/vp-cenovnik/nova">Nova priprema na ekranu (procenti)</Link>
          ) : null}
        </p>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Brend</th><th className="portal-table-number">Artikala</th><th>Excel</th></tr></thead>
            <tbody>
              {brandList.map(([b, n]) => (
                <tr key={b}>
                  <td>{b}</td>
                  <td className="portal-table-number">{n}</td>
                  <td><a href={`/api/portal/vp-cenovnik/izvoz?vrsta=vazeci&brend=${encodeURIComponent(b)}`} download>preuzmite</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canPrepare ? (
        <section className="portal-panel">
          <SectionHeader title="Nova priprema iz Excela" description="Isti fajl koji ste preuzeli, sa popunjenom kolonom „Nova VP“. Šifre koje ne postoje u portalu se navode i ne uzimaju." />
          <VpExcelUploadForm />
        </section>
      ) : null}

      <section className="portal-panel">
        <SectionHeader title="Pripreme" description="Svaka priprema ostaje sačuvana: ko je pripremio, ko je proverio i kada je primenjena." />
        {drafts.length === 0 ? (
          <p className="portal-empty">Još nema nijedne pripreme.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Naziv</th><th>Korak</th><th className="portal-table-number">Promena</th><th>Predlog važenja</th><th>Pripremio</th><th>Poslednja izmena</th></tr>
              </thead>
              <tbody>
                {drafts.map((d) => {
                  const st = stageOf(d);
                  return (
                    <tr key={d.id}>
                      <td><Link href={`/portal/vp-cenovnik/${d.id}`}>{d.title}</Link>{d.origin === "excel" ? <small className="portal-table-sub"> iz Excela</small> : null}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="portal-table-number">{d.changedCount}</td>
                      <td>{d.importValidFrom ? `važi od ${dmy(d.importValidFrom)}` : d.proposedValidFrom ? dmy(d.proposedValidFrom) : "—"}</td>
                      <td>{d.createdBy}</td>
                      <td>{dmyTime(d.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
