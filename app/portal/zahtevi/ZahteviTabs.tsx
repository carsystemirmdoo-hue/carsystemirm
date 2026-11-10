import Link from "next/link";

/**
 * Zaglavlje sa karticama „Zahtevi kupaca“ — isto na obe strane (2026-11-10).
 * Ranije je strana „Cena i uslovi“ imala drugi naslov, druge nazive i drugi
 * izgled kartica, pa je prelaz izgledao kao skok u drugi deo portala.
 */
export function ZahteviTabs({
  current,
  lead,
  aside,
  openPriceRequests,
}: {
  current: "porudzbine" | "uslovi";
  lead: string;
  aside?: string;
  openPriceRequests: number;
}) {
  // Bez sopstvenog omotača: strana porudžbina je već u `.pn`, strana uslova ga dodaje sama.
  return (
    <>
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Zahtevi kupaca</h1>
          <p className="pn-lead">{lead}</p>
        </div>
        {aside ? <span className="pn-small pn-muted">{aside}</span> : null}
      </header>
      <nav className="pn-tabs" aria-label="Zahtevi kupaca">
        <div className="pn-tabs-scroll">
          <Link href="/portal/zahtevi" aria-current={current === "porudzbine" ? "page" : undefined}>
            Zahtevi za porudžbinu
          </Link>
          <Link href="/portal/zahtevi/uslovi" aria-current={current === "uslovi" ? "page" : undefined}>
            Cena i uslovi{openPriceRequests > 0 ? ` (${openPriceRequests})` : ""}
          </Link>
        </div>
      </nav>
    </>
  );
}
