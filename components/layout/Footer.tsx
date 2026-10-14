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
  { href: "/kategorije/ucvrscivaci-i-razredjivaci", label: "Učvršćivači i razređivači" },
];

const brandLinks = [
  { href: "/brendovi/rm", label: "R-M" },
  { href: "/brendovi/carsystem", label: "Carsystem" },
  { href: "/brendovi/baslac", label: "Baslac" },
  { href: "/brendovi/norbin", label: "Norbin" },
  { href: "/brendovi/sata", label: "SATA" },
  { href: "/brendovi/carfit", label: "C.A.R.FIT" },
  { href: "/brendovi/cosmos-lac", label: "Cosmos Lac" },
  { href: "/brendovi/befar", label: "Befar" },
  { href: "/brendovi/yachtcare", label: "Yachtcare" },
];

const supportLinks = [
  { href: "/prodavnice", label: "Prodavnice" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/kontakt?tema=b2b", label: "B2B saradnja" },
];

export function Footer() {
  return (
    <FooterReveal>
      <footer
        className="cs-animated-footer border-t !border-[var(--ds-c-line)] bg-[var(--ds-c-surface)] text-[var(--ds-c-text)]"
        data-motion-surface
      >
        <div className="ds-container py-12 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1.6fr_0.95fr] lg:gap-12">
            <section className="max-w-md" aria-label="O kompaniji Carsystem i R-M">
              <p className="font-[family-name:var(--font-display)] text-xl font-extrabold uppercase leading-none tracking-normal sm:text-2xl">
                Carsystem <span className="text-[var(--ds-c-accent-text)]">i R-M</span>
              </p>
              <p className="mt-4 text-[0.9375rem] leading-[1.6] text-[var(--ds-c-text-2)]">
                Profesionalni program za pripremu, farbanje, opremu i završnu
                obradu vozila.
              </p>
              <div className="mt-6 flex flex-wrap items-start gap-3">
                <SplitContactCta inquiryHref="/kontakt" />
                <Link
                  className="inline-flex min-h-[var(--ds-ctl-h-m)] items-center justify-center rounded-[var(--ds-ctl-radius)] border !border-[var(--ds-c-text)] bg-transparent px-[1.125rem] font-[family-name:var(--font-body)] text-[0.9375rem] font-semibold leading-[1.2] !text-[var(--ds-c-text)] no-underline transition-colors hover:bg-[var(--ds-c-surface-2)]"
                  href="/prodavnice"
                  data-cursor="button"
                >
                  Pronađite prodavnicu
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
                className="font-[family-name:var(--font-technical)] text-[length:var(--ds-font-label)] font-medium uppercase leading-[1.3] tracking-[var(--ds-tracking-label)] text-[var(--ds-c-text-2)]"
              >
                Kontakt
              </h2>
              <address className="mt-4 space-y-2 text-[0.9375rem] not-italic leading-6 text-[var(--ds-c-text-2)]">
                <span className="block font-semibold text-[var(--ds-c-text)]">{companyContact.name}</span>
                <span className="block">{companyContact.locationLabel}</span>
                {companyContact.phone && companyContact.phoneHref ? (
                  <a
                    className="cs-link-reveal block !text-[var(--ds-c-text-2)] transition-colors hover:!text-[var(--ds-c-text)]"
                    href={companyContact.phoneHref}
                    data-cursor="link"
                  >
                    {companyContact.phone}
                  </a>
                ) : null}
                <a
                  className="cs-link-reveal block !text-[var(--ds-c-text-2)] transition-colors hover:!text-[var(--ds-c-text)]"
                  href={companyContact.emailHref}
                  data-cursor="link"
                >
                  {companyContact.email}
                </a>
                {companyContact.workingHours ? (
                  <span className="block">{companyContact.workingHours}</span>
                ) : null}
              </address>
              <p className="mt-4 max-w-xs text-[length:var(--ds-font-small)] leading-[1.5] text-[var(--ds-c-text-2)]">
                {companyContact.editableNote}
              </p>
            </section>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t !border-[var(--ds-c-line)] pt-5 text-[length:var(--ds-font-legal)] leading-[1.5] text-[var(--ds-c-text-2)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {companyContact.legalName} · PIB{" "}
              {companyContact.pib} · MB {companyContact.mb} ·{" "}
              {companyContact.locationLabel}
            </p>
            <p>
              Dizajn i razvoj:{" "}
              <a
                className="cs-link-reveal !text-[var(--ds-c-text-2)] transition-colors hover:!text-[var(--ds-c-text)]"
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
      <h2 className="font-[family-name:var(--font-technical)] text-[length:var(--ds-font-label)] font-medium uppercase leading-[1.3] tracking-[var(--ds-tracking-label)] text-[var(--ds-c-text-2)]">
        {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className="cs-link-reveal text-[0.9375rem] font-normal leading-[1.4] !text-[var(--ds-c-text-2)] transition-colors hover:!text-[var(--ds-c-text)]"
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
