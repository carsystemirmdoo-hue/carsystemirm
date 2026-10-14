"use client";

import { useEffect } from "react";

/**
 * Poslednja granica: greška u samom korenom layoutu (zaglavlje, sistem
 * pokreta, pretraga). Zamenjuje ceo dokument, pa nosi sopstveni <html> i
 * stilove u liniji — globalni CSS ovde nije zagarantovan.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Stanje prekrivača iz korenog layouta ne sme da ostane na novom dokumentu.
    delete document.documentElement.dataset.routeTransition;
    document.body.removeAttribute("aria-busy");
  }, [error]);

  return (
    <html lang="sr-Latn">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          /* Vrednosti sistema A u liniji (globalni CSS ovde nije zagarantovan). */
          background: "#f6f7f8",
          color: "#0e1114",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
          <p style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#b20e29", margin: 0 }}>
            <span aria-hidden="true" style={{ width: 24, height: 2, flex: "none", background: "#c8102e" }} />
            Carsystem i R-M
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "16px 0 0" }}>
            Stranica nije mogla da se prikaže
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: "#4a505a", marginTop: 20 }}>
            Došlo je do greške u pregledaču. Pokušajte ponovo. Ako se greška
            ponavlja, ažurirajte pregledač (Chrome, Edge ili Firefox) ili
            otvorite sajt u drugom pregledaču.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            <button
              onClick={() => reset()}
              style={{ minHeight: 44, padding: "0 18px", border: "1px solid #c8102e", borderRadius: 2, background: "#c8102e", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
              type="button"
            >
              Pokušajte ponovo
            </button>
            {/* Puno učitavanje namerno: posle greške u layoutu klijentska navigacija nije pouzdana. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 18px", border: "1px solid #0e1114", borderRadius: 2, color: "#0e1114", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
            >
              Početna stranica
            </a>
          </div>
          {error.digest ? (
            <p style={{ fontSize: 13, color: "#4a505a", marginTop: 24 }}>Oznaka greške: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
