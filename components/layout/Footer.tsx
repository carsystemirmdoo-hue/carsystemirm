import Link from "next/link";
import { FooterReveal } from "@/components/layout/FooterReveal";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import { companyContact } from "@/lib/company-contact";

const catalogLinks = [
  { href: "/katalog", label: "Katalog proizvoda" },
  { href: "/program/boje-i-lakovi", label: "Boje i lakovi" },
  { href: "/program/priprema-i-abrazivi", label: "Priprema i abrazivi" },
  { href: "/program/pistolji-i-oprema", label: "Pištolji i oprema" },
  { href: "/program/poliranje", label: "Poliranje" },
  { href: "/program/potrosni-materijal", label: "Potrošni materijal" },
  { href: "/kategorije/bezbojni-lakovi", label: "Bezbojni lakovi" },
  { href: "/kategorije/prajmeri-i-punioci", label: "Prajmeri i punioci" },
  { href: "/kategorije/bazne-boje", label: "Bazne boje" },
];

const brandLinks = [
  { href: "/brendovi/rm", label: "R-M" },
  { href: "/brendovi/carsystem", label: "Carsystem" },
  { href: "/brendovi/baslac", label: "Baslac" },
  { href: "/brendovi/norbin", label: "Norbin" },
  { href: "/brendovi/sata", label: "SATA" },
  { href: "/brendovi/carfit", label: "Car Fit" },
  { href: "/brendovi/cosmos-lac", label: "Cosmos Lac" },
  { href: "/brendovi/befar", label: "Befar" },
];

const supportLinks = [
  { href: "/prodavnice", label: "Prodavnice" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/kontakt", label: "Pošalji upit" },
  { href: "/kontakt?tema=b2b", label: "B2B saradnja" },
];

export function Footer() {
  return (
    <FooterReveal>
      <footer
        className="cs-animated-footer border-t border-border bg-surface text-foreground"
        data-motion-surface
      >
        <span className="cs-footer-ambient" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1.6fr_0.95fr] lg:gap-12">
            <section className="max-w-md" aria-label="Carsystem i R-M Inđija">
              <p className="font-[var(--font-display)] text-xl font-black uppercase leading-none tracking-normal sm:text-2xl">
                Carsystem <span className="text-accent">i R-M</span> Inđija
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Profesionalni program za pripremu, farbanje, opremu i završnu
                obradu vozila.
              </p>
              <div className="mt-6 flex flex-wrap items-start gap-3">
                <SplitContactCta inquiryHref="/kontakt" />
                <Link
                  className="cs-interactive-surface inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-extrabold !text-foreground transition-colors hover:bg-surface-muted"
                  href="/prodavnice"
                  data-cursor="button"
                  data-motion-surface
                >
                  Pronađi prodavnicu
                </Link>
              </div>
            </section>

            <div className="grid gap-8 sm:grid-cols-3">
              <FooterColumn title="Katalog" links={catalogLinks} />
              <FooterColumn title="Brendovi" links={brandLinks} />
              <FooterColumn title="Podrška" links={supportLinks} />
            </div>

            <section aria-labelledby="footer-contact-title">
              <h2
                id="footer-contact-title"
                className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Kontakt
              </h2>
              <address className="mt-4 space-y-2 text-sm not-italic leading-6 text-muted-foreground">
                <span className="block font-semibold text-foreground">{companyContact.name}</span>
                <span className="block">{companyContact.locationLabel}</span>
                {companyContact.phone && companyContact.phoneHref ? (
                  <a
                    className="cs-link-reveal block !text-muted-foreground transition-colors hover:!text-foreground"
                    href={companyContact.phoneHref}
                    data-cursor="link"
                  >
                    {companyContact.phone}
                  </a>
                ) : null}
                <a
                  className="cs-link-reveal block !text-muted-foreground transition-colors hover:!text-foreground"
                  href={companyContact.emailHref}
                  data-cursor="link"
                >
                  {companyContact.email}
                </a>
                {companyContact.workingHours ? (
                  <span className="block">{companyContact.workingHours}</span>
                ) : null}
              </address>
              <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
                {companyContact.editableNote}
              </p>
            </section>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} Carsystem i R-M Inđija. Sva prava zadržana.
            </p>
            <p>
              Dizajn i razvoj:{" "}
              <a
                className="cs-link-reveal !text-muted-foreground transition-colors hover:!text-foreground"
                href="https://studio-one.rs"
                rel="noreferrer"
                target="_blank"
                data-cursor="link"
              >
                Studio One
              </a>
            </p>
          </div>
        </div>
      </footer>
    </FooterReveal>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="cs-link-reveal text-sm font-medium !text-muted-foreground transition-colors hover:!text-foreground"
              data-cursor="link"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
