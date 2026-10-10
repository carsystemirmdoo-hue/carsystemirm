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
          background: "#f7f7f8",
          color: "#0b0b0d",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#5b5e66" }}>
            Carsystem i R-M
          </p>
          <h1 style={{ fontSize: 36, lineHeight: 1.1, margin: "16px 0 0" }}>
            Stranica nije mogla da se prikaže
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5b5e66", marginTop: 20 }}>
            Došlo je do greške u pregledaču. Pokušajte ponovo. Ako se greška
            ponavlja, ažurirajte pregledač (Chrome, Edge ili Firefox) ili
            otvorite sajt u drugom pregledaču.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            <button
              onClick={() => reset()}
              style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 8, background: "#0b0b0d", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
              type="button"
            >
              Pokušajte ponovo
            </button>
            {/* Puno učitavanje namerno: posle greške u layoutu klijentska navigacija nije pouzdana. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 20px", border: "1px solid #d9dbe0", borderRadius: 8, color: "#0b0b0d", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
            >
              Početna stranica
            </a>
          </div>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#5b5e66", marginTop: 24 }}>Oznaka greške: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
