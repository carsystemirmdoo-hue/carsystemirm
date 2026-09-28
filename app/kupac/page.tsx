import type { Metadata } from "next";
import Link from "next/link";
import { customerSignOutAction } from "@/app/prijava/kupac/actions";
import {
  PageHeader,
  Panel,
  SectionHeader,
} from "@/components/portal/PortalPrimitives";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  loadCustomerDocumentSummary,
  loadCustomerDocuments,
} from "@/lib/customers/customer-queries";
import { DataStrip } from "@/components/portal/DataStrip";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import "../portal/portal.css";

export const metadata: Metadata = {
  title: "Moj nalog · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Kupčev prostor.
 *
 * Nijedan podatak ne dolazi iz adrese. `customerId` je isključivo iz sesije, i
 * ova strana namerno NE prima `searchParams` ni `params` — ne zato što bi ih
 * ignorisala, nego da bi bilo očigledno da ih ni ne može pročitati.
 */
export default async function CustomerHomePage() {
  const session = await requireCustomerSession();

  const [summary, documents, dataset] = await Promise.all([
    loadCustomerDocumentSummary(session.customerId),
    loadCustomerDocuments(session.customerId, 20),
    loadDatasetInfo(),
  ]);

  return (
    <div className="portal-root portal-customer-area">
    <main className="portal-main">
      <DataStrip dataset={dataset} />
      <PageHeader
        eyebrow="Pristup za kupce"
        title={session.customerName}
        description={`Prijavljeni ste kao ${session.name}. Nalog vidi isključivo podatke ove firme.`}
      />

      <Panel>
        <SectionHeader
          title="Dokumenti"
          description="Fakture i povrati vaše firme, iz knjigovodstvenog uvoza."
        />
        <div className="portal-panel-body">
        {summary.totalDocuments === 0 ? (
          <p>
            Za vašu firmu još nema uvezenih dokumenata. Kada uvoz iz
            knjigovodstva bude izvršen, spisak će se pojaviti ovde.
          </p>
        ) : (
          <>
            <p>
              Ukupno dokumenata: <strong>{summary.totalDocuments}</strong>
              {summary.lastIssuedOn ? (
                <> · poslednji izdat {summary.lastIssuedOn}</>
              ) : null}
            </p>
            <div className="portal-table-wrap">
            <table className="portal-table" data-compact="true">
              <thead>
                <tr>
                  <th scope="col">Broj</th>
                  <th scope="col">Datum</th>
                  <th scope="col">Vrsta</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      {document.number}/{document.year}
                    </td>
                    <td>{document.issuedOn}</td>
                    <td>{document.documentKind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        {/*
         * Cene se ovde NE prikazuju.
         *
         * Jedina cena koju bismo danas mogli pokazati je istorijska, sa fakture.
         * Prikazana bez ograde, ona se čita kao obećanje buduće cene — a portal
         * još nema potvrdu iz BizniSofta da je bilo koja buduća cena stvarna.
         * Vidi docs/b2b/01-target-architecture.md, AD-3.
         */}
        <p className="portal-footnote">
          Cene i uslovi se potvrđuju uz porudžbinu. Ovaj pregled ih ne prikazuje.
        </p>
        </div>
      </Panel>

      <p>
        <Link href="/kupac/saglasnosti">
          Saglasnosti za obaveštenja i oglase
        </Link>
      </p>

      <form action={customerSignOutAction} className="portal-customer-signout">
        <button className="portal-button" data-variant="secondary" type="submit">
          Odjavi se
        </button>
      </form>
    </main>
    </div>
  );
}
