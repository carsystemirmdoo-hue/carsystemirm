import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { importRows, importRuns } from "@/db/schema";
import { ImportUpload } from "@/features/portal/ImportUpload";
import { PdfImportUpload } from "@/features/portal/PdfImportUpload";
import { AutoRecomputeStatus } from "@/components/portal/AutoRecomputeStatus";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadRecomputeStatus } from "@/lib/recommendations/auto-recompute";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  u_toku: "u toku",
  uspesno: "uspešno",
  uspesno_sa_upozorenjima: "uspešno uz upozorenja",
  greska: "greška",
  preskoceno_duplikat: "preskočeno, isti fajl",
};

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ uvoz?: string }>;
}) {
  const user = await requireCapability("view:importi", "/portal/importi");
  const { uvoz } = await searchParams;
  const recompute = await loadRecomputeStatus();

  const db = getDb();
  const runs = await db
    .select()
    .from(importRuns)
    .orderBy(desc(importRuns.startedAt))
    .limit(50);

  const selectedId = uvoz ? Number(uvoz) : (runs[0]?.id ?? null);
  const problems = selectedId
    ? await db
        .select()
        .from(importRows)
        .where(
          sql`${importRows.runId} = ${selectedId} AND ${importRows.status} IN ('upozorenje','neispravan')`,
        )
        .orderBy(importRows.rowNumber)
        .limit(500)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Importi"
        description="Svaki uvoz ostavlja trag: pročitani redovi, ispravni, upozorenja, greške i otisak fajla. Izvorni fajlovi se nikada ne menjaju."
      />

      <AutoRecomputeStatus status={recompute} canRetry={can(user, "recommendations:retry_auto")} />

      <PdfImportUpload />

      <ImportUpload />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Istorija uvoza</h2>
            <p>
              Ponovljeni uvoz istog fajla se prepoznaje po otisku sadržaja i
              preskače, ali ostaje zabeležen.
            </p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Fajl</th>
                <th scope="col">Vreme</th>
                <th scope="col">Status</th>
                <th scope="col">Pročitano</th>
                <th scope="col">Ispravno</th>
                <th scope="col">Upozorenja</th>
                <th scope="col">Greške</th>
                <th scope="col">Nove</th>
                <th scope="col">Ažurirane</th>
                <th scope="col">Otisak</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} data-active={run.id === selectedId}>
                  <th scope="row">
                    <Link href={`/portal/importi?uvoz=${run.id}`}>
                      {run.fileName}
                    </Link>
                    <small>{run.sourcePath ?? "—"}</small>
                  </th>
                  <td>
                    {new Intl.DateTimeFormat("sr-Latn-RS", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(run.startedAt)}
                  </td>
                  <td>{STATUS_LABELS[run.status] ?? run.status}</td>
                  <td className="portal-table-number">{run.rowsRead}</td>
                  <td className="portal-table-number">{run.rowsValid}</td>
                  <td className="portal-table-number">{run.rowsWarning}</td>
                  <td className="portal-table-number">{run.rowsInvalid}</td>
                  <td className="portal-table-number">{run.invoicesCreated}</td>
                  <td className="portal-table-number">{run.invoicesUpdated}</td>
                  <td>
                    <code>{run.fileHash.slice(0, 12)}…</code>
                  </td>
                </tr>
              ))}
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    Još nije obavljen nijedan uvoz. Otpremite prvi fajl iznad.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId ? (
        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Izveštaj o greškama — uvoz #{selectedId}</h2>
              <p>
                Redovi sa greškom nisu uvezeni. Upozorenja jesu, ali traže
                proveru u knjigovodstvu.
              </p>
            </div>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Red</th>
                  <th scope="col">Vrsta</th>
                  <th scope="col">Polje</th>
                  <th scope="col">Poruka</th>
                  <th scope="col">Izvorni red</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem) => (
                  <tr key={problem.id}>
                    <td className="portal-table-number">{problem.rowNumber}</td>
                    <td>{problem.status}</td>
                    <td>{problem.field ?? "—"}</td>
                    <td>{problem.message ?? "—"}</td>
                    <td>
                      <code>
                        {JSON.stringify(problem.raw).slice(0, 120)}
                      </code>
                    </td>
                  </tr>
                ))}
                {problems.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      Nema grešaka ni upozorenja u ovom uvozu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
