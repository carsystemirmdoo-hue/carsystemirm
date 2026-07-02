"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type FocusEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BRAND_LINKS,
  PROGRAM_LINKS,
  type MegaLink,
} from "@/components/layout/navigation-data";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import {
  BrandLogoPlate,
  brandLogos,
  type BrandKey,
  trustBrandKeys,
} from "./BrandLogoPlate";
import { ProcessSection } from "./ProcessSection";
import { ProgramDeckSection } from "./ProgramDeckSection";
import { companyContact } from "@/lib/company-contact";
import styles from "./CarsystemHomePage.module.css";

type Theme = "dark" | "light";
type DropdownKey = "programi" | "brendovi";

type Store = {
  city: string;
  name: string;
  address: string;
  detail: string;
  region: string;
};

const mobileNavLinks = [
  { href: "/katalog", label: "Katalog" },
  { href: "/program", label: "Programi" },
  { href: "/brendovi", label: "Brendovi" },
  { href: "/prodavnice", label: "Prodavnice" },
  { href: "/kontakt", label: "Kontakt" },
] as const;

const footerCatalogLinks = [
  { href: "/katalog", label: "Katalog proizvoda" },
  { href: "/program/boje-i-lakovi", label: "Boje i lakovi" },
  { href: "/program/priprema-i-abrazivi", label: "Priprema i abrazivi" },
  { href: "/program/pistolji-i-oprema", label: "Pištolji i oprema" },
  { href: "/program/poliranje", label: "Poliranje" },
  { href: "/program/potrosni-materijal", label: "Potrošni materijal" },
] as const;

const footerBrandLinks = [
  { href: "/brendovi/rm", label: "R-M" },
  { href: "/brendovi/carsystem", label: "Carsystem" },
  { href: "/brendovi/baslac", label: "Baslac" },
  { href: "/brendovi/sata", label: "SATA" },
  { href: "/brendovi/carfit", label: "Car Fit" },
  { href: "/brendovi/cosmos-spray", label: "Cosmos Spray" },
] as const;

const footerSupportLinks = [
  { href: "/prodavnice", label: "Prodavnice" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/kontakt", label: "Pošalji upit" },
  { href: "/kontakt?tema=b2b", label: "B2B saradnja" },
] as const;

const stores: Store[] = [
  {
    city: "Inđija",
    name: "Carsystem i R-M Inđija",
    address: "Centrala, Inđija",
    detail: "Veleprodaja i tehnička podrška",
    region: "Srem",
  },
  {
    city: "Beograd",
    name: "Partnerska mreža, Beograd",
    address: "Kontakt za najbližu prodavnicu u regionu",
    detail: "Rutiranje preko centrale",
    region: "Beograd",
  },
  {
    city: "Novi Sad",
    name: "Partnerska mreža, Novi Sad",
    address: "Kontakt za najbližu prodavnicu u regionu",
    detail: "Rutiranje preko centrale",
    region: "Vojvodina",
  },
  {
    city: "Niš",
    name: "Partnerska mreža, Niš",
    address: "Kontakt za najbližu prodavnicu u regionu",
    detail: "Rutiranje preko centrale",
    region: "Jug Srbije",
  },
  {
    city: "Kragujevac",
    name: "Partnerska mreža, Kragujevac",
    address: "Kontakt za najbližu prodavnicu u regionu",
    detail: "Rutiranje preko centrale",
    region: "Šumadija",
  },
  {
    city: "Subotica",
    name: "Partnerska mreža, Subotica",
    address: "Kontakt za najbližu prodavnicu u regionu",
    detail: "Rutiranje preko centrale",
    region: "Sever Srbije",
  },
];

const trustBrandLinks: Partial<Record<BrandKey, string>> = {
  rm: "/brendovi/rm",
  carsystem: "/brendovi/carsystem",
  baslac: "/brendovi/baslac",
  norbin: "/brendovi/norbin",
  sata: "/brendovi/sata",
  carfit: "/brendovi/carfit",
  cosmosLac: "/brendovi/cosmos-spray",
  befar: "/brendovi/befar",
};

const educationItems = [
  {
    category: "Priprema",
    title: "Priprema površine bez grešaka",
    readTime: "4 min",
    slug: "priprema-povrsine",
  },
  {
    category: "Boje",
    title: "Kako izabrati pravi lak",
    readTime: "5 min",
    slug: "izbor-laka",
  },
  {
    category: "Poliranje",
    title: "Poliranje do visokog sjaja",
    readTime: "4 min",
    slug: "poliranje-visoki-sjaj",
  },
  {
    category: "Problemi",
    title: "Najčešće greške u farbanju",
    readTime: "6 min",
    slug: "greske-u-farbanju",
  },
  {
    category: "Proces",
    title: "Redosled rada od podloge do završnog sloja",
    readTime: "7 min",
    slug: "redosled-refinish-procesa",
  },
] as const;

function IconLocation() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

const THEME_STORAGE_KEY = "theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Fall back to the class set by ThemeScript.
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyStoredTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still works for the current session.
  }
}

export function CarsystemHomePage() {
  const programPanelId = useId();
  const brandPanelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const [selectedCity, setSelectedCity] = useState("Inđija");
  const [locatorStatus, setLocatorStatus] = useState(
    "Ručno izaberi grad ili dozvoli lokaciju.",
  );
  const [showMobileLocator, setShowMobileLocator] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);

  const selectedStore = useMemo(
    () => stores.find((store) => store.city === selectedCity) ?? stores[0],
    [selectedCity],
  );

  useEffect(() => {
    setTheme(getStoredTheme());

    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setTheme(event.newValue);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null);
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenDropdown(null);
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    function updateMobileLocator() {
      setShowMobileLocator(window.scrollY > window.innerHeight * 0.72);
    }

    updateMobileLocator();
    window.addEventListener("scroll", updateMobileLocator, { passive: true });
    window.addEventListener("resize", updateMobileLocator);

    return () => {
      window.removeEventListener("scroll", updateMobileLocator);
      window.removeEventListener("resize", updateMobileLocator);
    };
  }, []);

  useEffect(() => {
    let previousY = window.scrollY;
    let ticking = false;

    function updateHeaderVisibility() {
      const nextY = window.scrollY;
      const delta = nextY - previousY;

      setHeaderCompact(nextY > 24);
      setHeaderHidden(nextY > 132 && delta > 0);

      if (delta < -6 || nextY < 48) {
        setHeaderHidden(false);
      }

      previousY = Math.max(nextY, 0);
      ticking = false;
    }

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeaderVisibility);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateHeaderVisibility();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyStoredTheme(nextTheme);
  }

  function handleDropdownBlur(event: FocusEvent<HTMLDivElement>, dropdown: DropdownKey) {
    const nextTarget = event.relatedTarget;

    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setOpenDropdown((current) => (current === dropdown ? null : current));
    }
  }

  function closeNavigation() {
    setOpenDropdown(null);
    setMenuOpen(false);
  }

  function handleLocationRequest() {
    if (!("geolocation" in navigator)) {
      setLocatorStatus("Lokacija nije dostupna u ovom browseru. Izaberi grad ručno.");
      return;
    }

    setLocatorStatus("Tražimo najbližu prodavnicu...");

    navigator.geolocation.getCurrentPosition(
      () => {
        setSelectedCity("Inđija");
        setLocatorStatus("Lokacija je aktivirana. Prikazana je preporučena lokacija za upit.");
      },
      () => {
        setLocatorStatus("Lokacija nije odobrena. Izaberi grad ručno.");
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
  }

  return (
    <main className={styles.home} data-theme={theme}>
      <header
        ref={headerRef}
        className={styles.header}
        data-compact={headerCompact || undefined}
        data-hidden={headerHidden && !menuOpen ? true : undefined}
      >
        <nav className={styles.nav} aria-label="Glavna navigacija">
          <Link
            className={`${styles.brandMark} cs-link-reveal`}
            href="/"
            aria-label="Carsystem i R-M početna"
            data-cursor="link"
          >
            <BrandLogoPlate brandKey="carsystem" variant="header" />
            <span className={styles.brandText}>
              <span>Carsystem</span>
              <strong>R-M Inđija</strong>
            </span>
          </Link>

          <div className={styles.navLinks}>
            <Link href="/katalog" className="cs-link-reveal" data-cursor="link">
              Katalog
            </Link>
            <HomeDesktopMegaMenu
              id={programPanelId}
              label="Programi"
              href="/program"
              open={openDropdown === "programi"}
              onOpen={() => setOpenDropdown("programi")}
              onToggle={() =>
                setOpenDropdown((current) => (current === "programi" ? null : "programi"))
              }
              onClose={() => setOpenDropdown(null)}
              onBlur={(event) => handleDropdownBlur(event, "programi")}
              featured={{
                href: "/program",
                title: "Program po fazama procesa",
                description: "Priprema, podloga, boja, lak i poliranje povezani sa proizvodima.",
                cta: "Svi programi",
              }}
              links={PROGRAM_LINKS}
            />
            <HomeDesktopMegaMenu
              id={brandPanelId}
              label="Brendovi"
              href="/brendovi"
              open={openDropdown === "brendovi"}
              onOpen={() => setOpenDropdown("brendovi")}
              onToggle={() =>
                setOpenDropdown((current) => (current === "brendovi" ? null : "brendovi"))
              }
              onClose={() => setOpenDropdown(null)}
              onBlur={(event) => handleDropdownBlur(event, "brendovi")}
              featured={{
                href: "/brendovi",
                title: "Brendovi u Carsystem programu",
                description: "Refinish sistemi, oprema i materijali kroz partnersku mrežu.",
                cta: "Svi brendovi",
              }}
              links={BRAND_LINKS}
              withLogos
            />
            <Link href="/prodavnice" className="cs-link-reveal" data-cursor="link">
              Prodavnice
            </Link>
            <Link href="/kontakt" className="cs-link-reveal" data-cursor="link">
              Kontakt
            </Link>
          </div>

          <div className={styles.navActions}>
            <button
              type="button"
              className={styles.iconButton}
              data-cursor="button"
              data-motion-surface
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Uključi svetlu temu" : "Uključi tamnu temu"}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            </button>
            <a
              className={`${styles.subtleButton} cs-interactive-surface`}
              href="/kontakt?tema=b2b"
              data-cursor="button"
              data-motion-surface
            >
              B2B saradnja
            </a>
            <a
              className={`${styles.headerCta} cs-magnetic-cta cs-theme-wipe-card`}
              href="/prodavnice"
              data-cursor="button"
              data-motion-surface
              data-motion="theme-wipe"
            >
              <span className={styles.buttonIcon}>
                <IconLocation />
              </span>
              <span>Prodavnice</span>
            </a>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label="Otvori meni"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div id="mobile-menu" className={styles.mobileMenu}>
            {mobileNavLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeNavigation}>
                {link.label}
              </Link>
            ))}
            <div className={styles.mobileMenuGroups}>
              <div>
                {PROGRAM_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={closeNavigation}>
                    {link.title}
                  </Link>
                ))}
              </div>
              <div>
                {BRAND_LINKS.slice(0, 6).map((link) => (
                  <Link key={link.href} href={link.href} onClick={closeNavigation}>
                    {link.title}
                  </Link>
                ))}
              </div>
            </div>
            <div className={styles.mobileMenuActions}>
              <Link href="/kontakt?tema=b2b" onClick={closeNavigation}>
                B2B saradnja
              </Link>
              <Link href="/prodavnice" onClick={closeNavigation}>
                Prodavnice
              </Link>
            </div>
          </div>
        )}
      </header>

      <section id="top" className={styles.hero} aria-labelledby="homepage-title">
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            src={theme === "dark" ? "/images/home/hero-dark.png" : "/images/home/hero-light.png"}
            alt=""
            fill
            priority
            sizes="(min-width: 900px) 68vw, 100vw"
            className={styles.heroImage}
          />
          <span className={styles.mistOne} />
          <span className={styles.mistTwo} />
          <span className={styles.mistThree} />
        </div>
        <div className={styles.heroFade} />

        <div className={styles.processBadge}>
          <span className={styles.liveDot} />
          Refinish proces
          <span className={styles.badgeBars} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Profesionalni refinish sistem, Srbija</p>
            <h1 id="homepage-title" className={styles.heroTitle}>
              Tehnologija.
              <br />
              Kvalitet.
              <br />
              <span>Poverenje.</span>
            </h1>
            <p className={styles.heroIntro}>
              Carsystem i R-M Inđija povezuje profesionalne refinish brendove,
              katalog proizvoda, tehničku podršku i partnersku mrežu prodavnica.
            </p>
            <div className={styles.ctaRow}>
              <a
                className={`${styles.primaryCta} cs-magnetic-cta cs-theme-wipe-card`}
                href="/prodavnice"
                data-cursor="button"
                data-motion-surface
                data-motion="theme-wipe"
              >
                <span className={styles.buttonIcon}>
                  <IconLocation />
                </span>
                <span>Pronađi najbližu prodavnicu</span>
              </a>
              <a className={`${styles.secondaryCta} cs-interactive-surface`} href="/katalog" data-cursor="button" data-motion-surface>
                Pregledaj katalog
              </a>
              <a className={`${styles.textCta} cs-link-reveal`} href="/kontakt?tema=b2b" data-cursor="link">
                B2B saradnja
              </a>
            </div>
            <p className={styles.proofLine}>
              <span />
              Stručna tehnička podrška i mešanje boja po formuli proizvođača.
            </p>
            <div className={styles.heroChips} aria-label="Glavne mogućnosti">
              <span>Brendovi u ponudi</span>
              <span>Partner lokator</span>
              <span>B2B spremno</span>
            </div>
          </div>
        </div>

        <LocatorCard
          selectedStore={selectedStore}
          selectedCity={selectedCity}
          locatorStatus={locatorStatus}
          onCityChange={setSelectedCity}
          onLocationRequest={handleLocationRequest}
        />
      </section>

      <a
        className={`${styles.mobileLocator} ${
          showMobileLocator ? styles.mobileLocatorVisible : ""
        }`}
        href="/prodavnice"
      >
        <span className={styles.buttonIcon}>
          <IconLocation />
        </span>
        <span>
          <strong>Pronađi najbližu prodavnicu</strong>
          <small>
            {selectedStore.city} · {selectedStore.region}
          </small>
        </span>
      </a>

      <section className={styles.trustStrip} aria-labelledby="brand-strip-title">
        <div className={styles.trustInner}>
          <p id="brand-strip-title" className={styles.trustLabel}>
            Brendovi u ponudi
          </p>
          <div className={styles.brandRail} aria-label="Brendovi">
            {trustBrandKeys.map((brandKey) => {
              const href = trustBrandLinks[brandKey];
              const logo = <BrandLogoPlate brandKey={brandKey} variant="rail" />;
              const brandName = brandLogos[brandKey].name;

              return href ? (
                <Link
                  aria-label={`Otvori stranicu brenda ${brandName}`}
                  className={`${styles.brandRailLink} cs-image-surface`}
                  href={href}
                  key={brandKey}
                  data-cursor="image"
                  data-motion-surface
                >
                  {logo}
                </Link>
              ) : (
                <span className={styles.brandRailStatic} key={brandKey}>
                  {logo}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <ProcessSection theme={theme} />

      <section id="mreza" className={styles.sectionAlt} aria-labelledby="network-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>Partnerska mreža, Srbija</p>
            <h2 id="network-title">Pronađi prodavnicu u svom regionu.</h2>
            <p>
              Lokator je prva tačka javnog sajta: korisnik bira grad, zatim šalje
              upit ili traži najbližu partnersku prodavnicu.
            </p>
          </div>
          <div className={styles.statPills}>
            <span>Lokalno rutiranje</span>
            <span>Ručni fallback</span>
          </div>
        </div>

        <div className={styles.networkGrid}>
          <div className={styles.locatorPanel}>
            <label className={styles.fieldLabel} htmlFor="city-select">
              Izaberi grad ili region
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(event) => {
                setSelectedCity(event.target.value);
                setLocatorStatus("Prikazan je rezultat za izabrani grad.");
              }}
              className={styles.citySelect}
            >
              {stores.map((store) => (
                <option key={store.city}>{store.city}</option>
              ))}
            </select>
            <button
              type="button"
              className={styles.locationButton}
              onClick={handleLocationRequest}
            >
              <span className={styles.buttonIcon}>
                <IconLocation />
              </span>
              Dozvoli lokaciju
            </button>
            <p className={styles.locatorStatus}>{locatorStatus}</p>
            <StorePreview store={selectedStore} />
          </div>

          <div className={styles.mapPanel} aria-label="Mapa partnerske mreže">
            <div className={styles.mapGrid} />
            <span className={styles.serbiaMapShape} aria-hidden="true" />
            <svg className={styles.mapLines} viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M50 24 L40 40 L62 38 L48 58 L70 56 L36 70" />
            </svg>
            {[
              ["Inđija", 50, 24, true],
              ["Beograd", 40, 40, false],
              ["Novi Sad", 62, 38, false],
              ["Kragujevac", 48, 58, false],
              ["Niš", 70, 56, false],
              ["Subotica", 36, 70, false],
            ].map(([city, left, top, active]) => (
              <span
                key={String(city)}
                className={`${styles.mapPin} ${active ? styles.mapPinActive : ""}`}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <i />
                <b>{city}</b>
              </span>
            ))}
            <p>Mapa je pripremljena za OpenStreetMap/Leaflet integraciju.</p>
          </div>
        </div>
      </section>

      <ProgramDeckSection />

      <section id="podrska" className={styles.section} aria-labelledby="support-title">
        <div className={styles.supportBand}>
          <div className={styles.supportStatement}>
            <p className={styles.sectionKicker}>Tehnička podrška, mikseri boja</p>
            <h2 id="support-title">Podrška koja rešava problem, ne samo prodaje proizvod.</h2>
            <p className={styles.sectionLead}>
              Mešanje i nijansiranje po formuli proizvođača, savetovanje i
              komercijalna podrška, uz tim koji razume rad u lakirnici.
            </p>
            <SplitContactCta
              inquiryHref="/kontakt?tema=tehnicka-podrska"
              inquiryLabel="Pošalji upit podršci"
            />
          </div>

          <div className={styles.supportMetricStrip} aria-label="Podaci o podršci">
            {[
              ["Formula", "Mešanje boja"],
              ["Proces", "Priprema do laka"],
              ["Mreža", "Partner prodavnice"],
              ["Tim", "Tehnička podrška"],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>

          <div className={styles.supportServiceGrid}>
            {[
              ["Mikseri boja", "Precizno nijansiranje po formuli proizvođača."],
              ["Tehnička podrška", "Savetovanje za podlogu, lakiranje i završnu obradu."],
              ["Komercijalni tim", "Rutiranje upita prema najbližoj prodavnici i regionu."],
            ].map(([title, text]) => (
              <article
                className="cs-gloss-card"
                key={title}
                data-cursor="card"
                data-motion-surface
              >
                <span aria-hidden="true" />
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="edukacija" className={styles.section} aria-labelledby="education-title">
        <div className={styles.educationIndexLayout}>
          <div className={styles.educationIntro}>
            <p className={styles.sectionKicker}>Edukacija i znanje</p>
            <h2 id="education-title">Znanje koje pravi razliku u radionici.</h2>
            <p>
              Kratak, tehnički indeks tema za pripremu upita, razgovor sa
              podrškom i stabilniji radni proces.
            </p>
            <Link className={styles.textLink} href="/kontakt?tema=tehnicka-podrska">
              Sve teme
            </Link>
          </div>
          <div className={styles.educationIndexRows}>
            {educationItems.map((item, index) => (
              <Link
                key={item.slug}
                href={`/kontakt?tema=tehnicka-podrska&tema-saznanja=${item.slug}`}
                className={`${styles.educationIndexRow} cs-interactive-surface`}
                data-cursor="link"
                data-motion-surface
              >
                <span className={styles.educationIndex}>{String(index + 1).padStart(2, "0")}</span>
                <small>{item.category}</small>
                <strong>{item.title}</strong>
                <em>{item.readTime}</em>
                <b aria-hidden="true">→</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="kontakt" className={styles.sectionAlt} aria-labelledby="contact-title">
        <div className={styles.contactGrid}>
          <div className={styles.contactPanel}>
            <p className={styles.sectionKicker}>Centrala, Inđija</p>
            <h2 id="contact-title">Carsystem i R-M Inđija d.o.o.</h2>
            <div className={styles.contactRows}>
              <span>
                <b>Lokacija</b>
                Inđija, Srbija
              </span>
              <span>
                <b>Upiti</b>
                Veleprodaja, tehnička podrška i partnerska mreža
              </span>
              <span>
                <b>Kontakt</b>
                <a href={companyContact.phoneHref}>{companyContact.phone}</a>
                <small>ili pošalji upit za najbližu prodavnicu i podršku</small>
              </span>
            </div>
            <div className={styles.ctaRow}>
              <a className={`${styles.primaryCta} cs-magnetic-cta cs-theme-wipe-card`} href="/kontakt" data-cursor="button" data-motion-surface data-motion="theme-wipe">
                <span>Kontaktiraj veleprodaju</span>
              </a>
              <a className={`${styles.secondaryCta} cs-interactive-surface`} href="/prodavnice" data-cursor="button" data-motion-surface>
                Sve lokacije
              </a>
            </div>
          </div>
          <div className={styles.contactMap}>
            <div className={styles.mapGrid} />
            <span className={styles.serbiaMapShape} aria-hidden="true" />
            <span className={styles.centerPin}>
              <i />
              Centrala, Inđija
            </span>
          </div>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="final-cta-title">
        <Image
          src="/images/home/hero-dark.png"
          alt=""
          fill
          sizes="100vw"
          className={styles.finalImage}
        />
        <div className={styles.finalShade} />
        <div className={styles.finalContent}>
          <p>Carsystem i R-M, Inđija</p>
          <h2 id="final-cta-title">
            Pronađite najbližu prodavnicu ili pripremite upit za saradnju.
          </h2>
          <span>
            Profesionalni refinish program, tehnička podrška i partnerska mreža,
            sve na jednom mestu.
          </span>
          <div className={styles.finalActions}>
            <a className={`${styles.primaryCta} cs-magnetic-cta cs-theme-wipe-card`} href="/prodavnice" data-cursor="button" data-motion-surface data-motion="theme-wipe">
              <span>Pronađi prodavnicu</span>
            </a>
            <a className={`${styles.secondaryOnDark} cs-interactive-surface`} href="/katalog" data-cursor="button" data-motion-surface>
              Pregledaj katalog
            </a>
            <a className={`${styles.secondaryOnDark} cs-interactive-surface`} href="/kontakt?tema=b2b" data-cursor="button" data-motion-surface>
              B2B saradnja
            </a>
          </div>
        </div>
      </section>

      <footer className={`${styles.footer} cs-animated-footer`} data-motion-surface>
        <span className="cs-footer-ambient" aria-hidden="true" />
        <div className={styles.footerGrid}>
          <div>
            <strong className={styles.footerBrand}>Carsystem i R-M Inđija</strong>
            <p>
              Profesionalni program za pripremu, farbanje, opremu i završnu
              obradu vozila.
            </p>
            <div className={styles.footerActions}>
              <a className={`${styles.primaryCta} cs-magnetic-cta cs-theme-wipe-card`} href="/kontakt" data-cursor="button" data-motion-surface data-motion="theme-wipe">
                <span>Pošalji upit</span>
              </a>
              <a className={`${styles.secondaryCta} cs-interactive-surface`} href="/prodavnice" data-cursor="button" data-motion-surface>
                Pronađi prodavnicu
              </a>
            </div>
          </div>
          <FooterColumn title="Katalog" links={footerCatalogLinks} />
          <FooterColumn title="Brendovi" links={footerBrandLinks} />
          <FooterColumn title="Podrška" links={footerSupportLinks} />
          <div>
            <h3>Kontakt</h3>
            <strong>{companyContact.name}</strong>
            <span>{companyContact.locationLabel}</span>
            <a href={companyContact.phoneHref}>{companyContact.phone}</a>
            <a href={companyContact.emailHref}>{companyContact.email}</a>
            <span>{companyContact.workingHours}</span>
            <p>{companyContact.editableNote}</p>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} Carsystem i R-M Inđija. Sva prava zadržana.
          </span>
          <span>
            Dizajn i razvoj:{" "}
            <a href="https://studio-one.rs" rel="noreferrer" target="_blank">
              Studio One
            </a>
          </span>
        </div>
      </footer>
    </main>
  );
}

function LocatorCard({
  selectedStore,
  selectedCity,
  locatorStatus,
  onCityChange,
  onLocationRequest,
}: {
  selectedStore: Store;
  selectedCity: string;
  locatorStatus: string;
  onCityChange: (city: string) => void;
  onLocationRequest: () => void;
}) {
  return (
    <aside className={styles.locatorCard} aria-label="Lokator prodavnica">
      <header>
        <span className={styles.buttonIcon}>
          <IconLocation />
        </span>
        Pronađi najbližu prodavnicu
        <small>Mreža</small>
      </header>
      <div className={styles.locatorBody}>
        <button type="button" className={styles.locationButton} onClick={onLocationRequest}>
          <span className={styles.buttonIcon}>
            <IconLocation />
          </span>
          Dozvoli lokaciju
        </button>
        <select
          value={selectedCity}
          onChange={(event) => onCityChange(event.target.value)}
          aria-label="Izaberi grad"
          className={styles.citySelect}
        >
          {stores.map((store) => (
            <option key={store.city}>{store.city}</option>
          ))}
        </select>
        <StorePreview store={selectedStore} />
        <p className={styles.locatorStatus}>{locatorStatus}</p>
      </div>
    </aside>
  );
}

function StorePreview({ store }: { store: Store }) {
  return (
    <article className={styles.storePreview}>
      <span className={styles.availableDot} />
      <div>
        <header>
          <strong>{store.name}</strong>
          <small>{store.region}</small>
        </header>
        <p>{store.address}</p>
        <span>{store.detail}</span>
      </div>
    </article>
  );
}

function HomeDesktopMegaMenu({
  featured,
  href,
  id,
  label,
  links,
  onBlur,
  onClose,
  onOpen,
  onToggle,
  open,
  withLogos = false,
}: {
  featured: {
    href: string;
    title: string;
    description: string;
    cta: string;
  };
  href: string;
  id: string;
  label: string;
  links: MegaLink[];
  onBlur: (event: FocusEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onOpen: () => void;
  onToggle: () => void;
  open: boolean;
  withLogos?: boolean;
}) {
  return (
    <div
      className={styles.navMegaItem}
      data-open={open || undefined}
      onBlur={onBlur}
      onFocus={onOpen}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <span className={styles.navMegaTrigger}>
        <Link
          className={`${styles.navMegaLabel} cs-link-reveal`}
          href={href}
          onClick={onClose}
          data-cursor="link"
        >
          {label}
        </Link>
        <button
          type="button"
          aria-controls={id}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={`${open ? "Sakrij" : "Prikaži"} ${label.toLowerCase()} meni`}
          className={styles.navMegaButton}
          data-cursor="button"
          data-motion-surface
          onClick={onToggle}
        >
          <span aria-hidden="true" />
        </button>
      </span>

      {open ? (
        <div id={id} className={styles.navMegaPanel} aria-label={`${label} navigacija`}>
          <Link
            className={`${styles.navMegaFeatured} cs-gloss-card`}
            href={featured.href}
            onClick={onClose}
            data-cursor="card"
            data-motion-surface
          >
            <small>Pregled sistema</small>
            <strong>{featured.title}</strong>
            <span>{featured.description}</span>
            <em>{featured.cta}</em>
          </Link>
          <div className={withLogos ? styles.navMegaLogoGrid : styles.navMegaGrid}>
            {links.map((link) => (
              <Link
                className={`${styles.navMegaLink} cs-gloss-card`}
                href={link.href}
                key={link.href}
                onClick={onClose}
                data-cursor={withLogos ? "image" : "card"}
                data-motion-surface
              >
                {withLogos ? (
                  <span className={styles.navMegaLogo} aria-hidden="true">
                    {link.logo ? (
                      <Image src={link.logo} alt="" width={82} height={42} />
                    ) : (
                      link.title
                    )}
                  </span>
                ) : (
                  <i aria-hidden="true" />
                )}
                <span>
                  <strong>{link.title}</strong>
                  <small>{link.meta ?? link.description}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {links.map((link) => (
        <a
          className="cs-link-reveal"
          href={link.href}
          key={`${title}-${link.href}-${link.label}`}
          data-cursor="link"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
