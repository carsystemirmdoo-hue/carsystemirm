import { PhaseNotice } from "@/components/portal/PhaseNotice";

export interface FilterOptions {
  customers: { id: string; name: string }[];
  salespeople: { id: string; name: string }[];
  productGroups: string[];
}

export interface AppliedFilter {
  from?: string;
  to?: string;
  kupac?: string;
  komercijalista?: string;
  grupa?: string;
  prikaz?: string;
}

/**
 * Filteri kao obična HTML forma sa GET metodom.
 *
 * Stanje živi u adresi, pa je pretraga deljiva, može se sačuvati kao obeleživač
 * i preživljava osvežavanje — bez klijentskog stanja koje bi se izgubilo.
 */
export function SalesFilters({
  action,
  options,
  applied,
  views,
  exportView,
}: {
  action: string;
  options: FilterOptions;
  applied: AppliedFilter;
  views?: { key: string; label: string }[];
  exportView: string;
}) {
  const exportParams = new URLSearchParams();
  exportParams.set("view", exportView);
  if (applied.from) exportParams.set("from", applied.from);
  if (applied.to) exportParams.set("to", applied.to);
  if (applied.kupac) exportParams.set("customerId", applied.kupac);
  if (applied.komercijalista)
    exportParams.set("salespersonId", applied.komercijalista);
  if (applied.grupa) exportParams.set("productGroup", applied.grupa);

  return (
    <section className="portal-panel">
      <form action={action} method="get" className="portal-settings-form">
        <label>
          <span>Period od</span>
          <input type="date" name="from" defaultValue={applied.from ?? ""} />
        </label>
        <label>
          <span>Period do</span>
          <input type="date" name="to" defaultValue={applied.to ?? ""} />
        </label>
        <label>
          <span>Kupac</span>
          <select name="kupac" defaultValue={applied.kupac ?? ""}>
            <option value="">svi kupci</option>
            {options.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Komercijalista</span>
          <select
            name="komercijalista"
            defaultValue={applied.komercijalista ?? ""}
          >
            <option value="">svi</option>
            {options.salespeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Grupa proizvoda</span>
          <select name="grupa" defaultValue={applied.grupa ?? ""}>
            <option value="">sve grupe</option>
            {options.productGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        {views ? (
          <label>
            <span>Prikaz</span>
            <select name="prikaz" defaultValue={applied.prikaz ?? views[0].key}>
              {views.map((view) => (
                <option key={view.key} value={view.key}>
                  {view.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="portal-button" data-variant="primary">
          Primenite filtere
        </button>
      </form>

      <div className="portal-phase-notice">
        <h3>Izvoz trenutnog prikaza</h3>
        <p className="portal-export-links">
          {(["xlsx", "csv", "pdf"] as const).map((format) => (
            <a
              key={format}
              className="portal-button"
              href={`/api/portal/izvoz?format=${format}&${exportParams.toString()}`}
            >
              {format.toUpperCase()}
            </a>
          ))}
        </p>
        <p className="portal-phase-notice-tag">
          Izvoz poštuje primenjene filtere i Vaš opseg pristupa — sadrži tačno
          ono što vidite na ekranu, sa vremenom nastanka u zaglavlju.
        </p>
      </div>
    </section>
  );
}

/** Prikaz kada uvoz još nije obavljen — razdvaja „nema podataka“ od „nije povezano“. */
export function NoInvoicesYet({ screen }: { screen: string }) {
  return (
    <PhaseNotice
      icon="sync"
      title={`${screen} čeka prvi uvoz faktura`}
      summary="Baza je spremna i ekran radi, ali još nije uvezena nijedna faktura. Uvezite fajl na ekranu Importi da bi se brojke popunile."
      requires={[
        "Izvoz iz BiznisSoft-a u CSV formatu (tačka-zarez ili zarez kao razdvajač).",
        "Kolone: pib, kupac, broj_dokumenta, datum, vrsta_dokumenta, sifra_artikla, kolicina, cena, iznos_stavke.",
        "Dozvola za uvoz — ekran Importi.",
      ]}
      phase="uvoz je dostupan odmah"
    />
  );
}
