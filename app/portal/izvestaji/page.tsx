import Link from "next/link";
import { can } from "@/lib/authz/permissions.mjs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";


export const metadata = { title: "Izveštaji" };

export const dynamic = "force-dynamic";

/*
 * Izvoz već postoji na ekranima prometa (XLSX, CSV, PDF, sa filterima i
 * opsegom korisnika). Ranije je ovde stajalo „čeka uvoz faktura", iako se
 * fakture odavno uvoze; ekran sada vodi na mesta gde izvoz radi.
 */
const MESTA = [
  { href: "/portal/prodaja", label: "Prodaja", opis: "promet po kupcu i stavke", cap: "view:prodaja" },
  { href: "/portal/analitika", label: "Analitika", opis: "po danima, mesecima i godinama", cap: "view:analitika" },
  { href: "/portal/povrati", label: "Povrati i minus fakture", opis: "negativni dokumenti", cap: "view:povrati" },
] as const;

export default async function Page() {
  const user = await requireCapability("view:izvestaji", "/portal/izvestaji");
  const mesta = MESTA.filter((m) => can(user, m.cap));

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Izveštaji"
        description="Izvoz u XLSX, CSV i PDF, uz poštovanje filtera, izabranog perioda i dozvola korisnika."
      />
      <section className="portal-panel">
        <h2>Gde se pravi izvoz</h2>
        <p>
          Izvoz se pravi na ekranu sa podacima, dugmetom „Izvoz trenutnog prikaza“: uzima iste filtere
          i period koje vidite, i nikad ne sadrži kupce van Vašeg opsega. Sačuvani i zakazani izveštaji
          još ne postoje.
        </p>
        <ul>
          {mesta.map((m) => (
            <li key={m.href}>
              <Link href={m.href}>{m.label}</Link> — {m.opis}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
