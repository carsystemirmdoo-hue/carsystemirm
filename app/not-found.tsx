import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stranica nije pronađena",
  robots: {
    index: false,
    follow: true,
    noarchive: true,
  },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col justify-center px-4 py-24 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Greška 404
      </p>
      <h1 className="mt-4 font-[var(--font-display)] text-4xl font-black uppercase tracking-tight sm:text-6xl">
        Stranica nije pronađena
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
        Adresa možda više nije aktivna ili je pogrešno uneta. Nastavite ka
        katalogu, brendovima ili kontaktu.
      </p>
      <nav className="mt-8 flex flex-wrap gap-3" aria-label="Korisni linkovi">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-5 font-semibold text-background"
          href="/katalog"
        >
          Otvorite katalog
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-semibold"
          href="/brendovi"
        >
          Pregledajte brendove
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-semibold"
          href="/kontakt"
        >
          Kontakt
        </Link>
      </nav>
    </main>
  );
}
