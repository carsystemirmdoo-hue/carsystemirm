"use client";

import { useEffect } from "react";

/**
 * Granica greške za sve stranice ispod korenog layouta.
 *
 * Bez nje svaka greška u klijentskom kodu (npr. API koji stariji pregledač
 * nema) završava Next-ovim praznim ekranom „Application error“. Ovde
 * posetilac dobija objašnjenje, ponovni pokušaj i put dalje, a zaglavlje iz
 * layouta ostaje.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const inPortal =
    typeof window !== "undefined" && window.location.pathname.startsWith("/portal");

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col justify-center px-4 py-24 sm:px-6">
      <p className="flex items-center gap-[10px] font-[family-name:var(--font-technical)] text-[length:var(--ds-font-label)] font-medium uppercase leading-[1.3] tracking-[var(--ds-tracking-label)] text-[var(--ds-c-accent-text)] before:h-[2px] before:w-6 before:flex-none before:bg-[var(--ds-c-accent)] before:content-['']">
        Greška pri prikazu
      </p>
      <h1 className="mt-4 max-w-[18ch] font-[family-name:var(--font-display)] text-[length:var(--ds-font-h1)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--ds-c-text)]">
        Stranica nije mogla da se prikaže
      </h1>
      <p className="mt-5 max-w-[var(--ds-w-measure)] text-[length:var(--ds-font-lead)] leading-[1.55] text-[var(--ds-c-text-2)]">
        Došlo je do greške u pregledaču. Pokušajte ponovo. Ako se greška
        ponavlja, ažurirajte pregledač (Chrome, Edge ili Firefox) ili otvorite
        sajt u drugom pregledaču.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center rounded-[var(--ds-ctl-radius)] px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] no-underline transition-colors border !border-[var(--ds-c-accent)] bg-[var(--ds-c-accent)] !text-[var(--ds-c-on-accent)] hover:!border-[var(--ds-c-accent-hover)] hover:bg-[var(--ds-c-accent-hover)] cursor-pointer"
          onClick={() => reset()}
          type="button"
        >
          Pokušajte ponovo
        </button>
        <a
          className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center rounded-[var(--ds-ctl-radius)] px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] no-underline transition-colors border !border-[var(--ds-c-text)] bg-transparent !text-[var(--ds-c-text)] hover:bg-[var(--ds-c-surface-2)]"
          href={inPortal ? "/portal" : "/"}
        >
          {inPortal ? "Nazad u portal" : "Početna stranica"}
        </a>
      </div>
      {error.digest ? (
        <p className="mt-6 font-[family-name:var(--font-technical)] text-[length:var(--ds-font-legal)] text-[var(--ds-c-text-2)]">Oznaka greške: {error.digest}</p>
      ) : null}
    </main>
  );
}
