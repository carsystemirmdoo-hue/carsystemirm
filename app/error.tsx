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
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Greška pri prikazu
      </p>
      <h1 className="mt-4 font-[var(--font-display)] text-4xl font-black uppercase tracking-tight sm:text-5xl">
        Stranica nije mogla da se prikaže
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
        Došlo je do greške u pregledaču. Pokušajte ponovo. Ako se greška
        ponavlja, ažurirajte pregledač (Chrome, Edge ili Firefox) ili otvorite
        sajt u drugom pregledaču.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 font-semibold text-background"
          onClick={() => reset()}
          type="button"
        >
          Pokušajte ponovo
        </button>
        <a
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-semibold"
          href={inPortal ? "/portal" : "/"}
        >
          {inPortal ? "Nazad u portal" : "Početna stranica"}
        </a>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">Oznaka greške: {error.digest}</p>
      ) : null}
    </main>
  );
}
