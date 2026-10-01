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

  const [summary, documents] = await Promise.all([
    loadCustomerDocumentSummary(session.customerId),
    loadCustomerDocuments(session.customerId, 20),
  ]);

  return (
    <main className="portal-main">
      <PageHeader
        eyebrow="Pristup za kupce"
        title={session.customerName}
        description={`Prijavljeni ste kao ${session.name}. Nalog vidi isključivo podatke ove firme.`}
      />

      <Panel>
        <SectionHeader
          title="Dokumenti"
          description="Fakture i povrati Vaše firme, iz knjigovodstvenog uvoza."
        />
        {summary.totalDocuments === 0 ? (
          <p>
            Za Vašu firmu još nema uvezenih dokumenata. Kada uvoz iz
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
            <table className="portal-table">
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
        <p className="portal-login-hint">
          Cene i uslovi se potvrđuju uz porudžbinu. Ovaj pregled ih ne prikazuje.
        </p>
      </Panel>

      <p>
        <Link href="/kupac/saglasnosti">
          Saglasnosti za obaveštenja i oglase
        </Link>
      </p>

      <form action={customerSignOutAction}>
        <button className="portal-login-submit" type="submit">
          Odjavite se
        </button>
      </form>
    </main>
  );
}
