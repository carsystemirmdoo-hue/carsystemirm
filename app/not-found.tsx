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
      <p className="flex items-center gap-[10px] font-[family-name:var(--font-technical)] text-[length:var(--ds-font-label)] font-medium uppercase leading-[1.3] tracking-[var(--ds-tracking-label)] text-[var(--ds-c-accent-text)] before:h-[2px] before:w-6 before:flex-none before:bg-[var(--ds-c-accent)] before:content-['']">
        Greška 404
      </p>
      <h1 className="mt-4 max-w-[18ch] font-[family-name:var(--font-display)] text-[length:var(--ds-font-h1)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--ds-c-text)]">
        Stranica nije pronađena
      </h1>
      <p className="mt-5 max-w-[var(--ds-w-measure)] text-[length:var(--ds-font-lead)] leading-[1.55] text-[var(--ds-c-text-2)]">
        Adresa možda više nije aktivna ili je pogrešno uneta. Nastavite ka
        katalogu, brendovima ili kontaktu.
      </p>
      <nav className="mt-8 flex flex-wrap gap-3" aria-label="Korisni linkovi">
        <Link
          className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center rounded-[var(--ds-ctl-radius)] px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] no-underline transition-colors border !border-[var(--ds-c-accent)] bg-[var(--ds-c-accent)] !text-[var(--ds-c-on-accent)] hover:!border-[var(--ds-c-accent-hover)] hover:bg-[var(--ds-c-accent-hover)]"
          href="/katalog"
        >
          Otvorite katalog
        </Link>
        <Link
          className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center rounded-[var(--ds-ctl-radius)] px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] no-underline transition-colors border !border-[var(--ds-c-text)] bg-transparent !text-[var(--ds-c-text)] hover:bg-[var(--ds-c-surface-2)]"
          href="/brendovi"
        >
          Pregledajte brendove
        </Link>
        <Link
          className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center rounded-[var(--ds-ctl-radius)] px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] no-underline transition-colors border !border-[var(--ds-c-text)] bg-transparent !text-[var(--ds-c-text)] hover:bg-[var(--ds-c-surface-2)]"
          href="/kontakt"
        >
          Kontakt
        </Link>
      </nav>
    </main>
  );
}
