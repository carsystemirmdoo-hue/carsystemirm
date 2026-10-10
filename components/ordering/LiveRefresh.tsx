"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const INTERVAL_MS = 15000;

/** Da li strana ima obrazac sa nesnimljenim izmenama (obrasci se obeležavaju sa `data-unsaved="true"`). */
function hasUnsavedForm() {
  return Boolean(document.querySelector('[data-unsaved="true"]'));
}

/**
 * Automatsko osvežavanje liste, detalja ili korpe.
 *
 * Periodično (dok je kartica vidljiva) i pri povratku u karticu pita samo
 * otisak stanja. Ako se promenio: bez nesnimljenih izmena strana se tiho
 * osvežava; sa njima se prikazuje obaveštenje — ništa iz obrasca se ne briše
 * dok korisnik sam ne izabere osvežavanje.
 */
export function LiveRefresh({ endpoint, stamp, what = "Prikaz" }: { endpoint: string; stamp: string | null; what?: string }) {
  const router = useRouter();
  const seen = useRef(stamp);
  const [changed, setChanged] = useState(false);
  const busy = useRef(false);

  // Nov prikaz sa servera (posle osvežavanja ili sopstvene radnje) postaje polazno stanje.
  useEffect(() => {
    seen.current = stamp;
    setChanged(false);
  }, [stamp]);

  const check = useCallback(async () => {
    if (busy.current || document.visibilityState !== "visible") return;
    busy.current = true;
    try {
      const r = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) return;
      const { stamp: now } = (await r.json()) as { stamp: string | null };
      if (now === seen.current) return;
      if (hasUnsavedForm()) setChanged(true);
      else router.refresh();
    } catch {
      // Bez mreže: sledeći pokušaj u sledećem intervalu ili pri povratku u karticu.
    } finally {
      busy.current = false;
    }
  }, [endpoint, router]);

  useEffect(() => {
    const timer = window.setInterval(check, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  if (!changed) return null;
  return (
    <div className="pn-live" role="status" aria-live="polite" aria-label={`${what}: novo stanje`}>
      <span>
        <strong>Stanje se u međuvremenu promenilo</strong> (drugi prozor, kupac ili kancelarija). Vaš nesnimljen unos je
        zadržan — pregledajte novo stanje pre slanja.
      </span>
      <button type="button" className="pn-btn" data-size="sm" onClick={() => router.refresh()}>
        Prikažite novo stanje
      </button>
    </div>
  );
}
