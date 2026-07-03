"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import {
  BrandLogoPlate,
  brandLogos,
  type BrandKey,
  trustBrandKeys,
} from "./BrandLogoPlate";
import { HomeSectionRail } from "./HomeSectionRail";
import { ProcessSection } from "./ProcessSection";
import { ProgramDeckSection } from "./ProgramDeckSection";
import { companyContact } from "@/lib/company-contact";
import { partnerStores } from "@/lib/partner-stores";
import {
  getCityDisplayEntries,
  type CityDisplayEntry,
} from "@/components/stores/store-locator-display";
import styles from "./CarsystemHomePage.module.css";

type Theme = "dark" | "light";

const cityEntries = getCityDisplayEntries(partnerStores);
const defaultCity = cityEntries[0]?.city ?? "Inđija";

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

export function CarsystemHomePage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [locatorStatus, setLocatorStatus] = useState(
    "Ručno izaberi grad ili dozvoli lokaciju.",
  );
  const [showMobileLocator, setShowMobileLocator] = useState(false);

  const selectedStore = useMemo(
    () => cityEntries.find((entry) => entry.city === selectedCity) ?? cityEntries[0],
    [selectedCity],
  );

  // The hero image and PerfectFinishProcess canvas need the theme as a JS
  // value, so mirror the global .dark class (the single source of truth).
  useEffect(() => {
    function syncTheme() {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
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

  function handleLocationRequest() {
    if (!("geolocation" in navigator)) {
      setLocatorStatus("Lokacija nije dostupna u ovom browseru. Izaberi grad ručno.");
      return;
    }

    setLocatorStatus("Tražimo najbližu prodavnicu...");

    navigator.geolocation.getCurrentPosition(
      () => {
        setSelectedCity(defaultCity);
        setLocatorStatus("Lokacija je aktivirana. Prikazana je preporučena lokacija za upit.");
      },
      () => {
        setLocatorStatus("Lokacija nije odobrena. Izaberi grad ručno.");
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 },
    );
  }

  return (
    <main className={styles.home}>
      <HomeSectionRail />
      <section className={styles.hero} aria-labelledby="homepage-title">
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

      <section className={styles.sectionAlt} aria-labelledby="network-title">
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
              {cityEntries.map((entry) => (
                <option key={entry.city}>{entry.city}</option>
              ))}
            </select>
            <button
              type="button"
              className={`${styles.locationButton} cs-magnetic-cta cs-theme-wipe-card`}
              onClick={handleLocationRequest}
              data-cursor="button"
              data-motion-surface
              data-motion="theme-wipe"
            >
              <span className={styles.buttonIcon}>
                <IconLocation />
              </span>
              <span>Dozvoli lokaciju</span>
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

      <section className={styles.section} aria-labelledby="support-title">
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

      <section className={styles.section} aria-labelledby="education-title">
        <div className={styles.educationIndexLayout}>
          <div className={styles.educationIntro}>
            <p className={styles.sectionKicker}>Edukacija i znanje</p>
            <h2 id="education-title">
              Znanje koje pravi razliku u radionici.
            </h2>
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

      <section className={styles.sectionAlt} aria-labelledby="contact-title">
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
  selectedStore: CityDisplayEntry;
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
        <button
          type="button"
          className={`${styles.locationButton} cs-magnetic-cta cs-theme-wipe-card`}
          onClick={onLocationRequest}
          data-cursor="button"
          data-motion-surface
          data-motion="theme-wipe"
        >
          <span className={styles.buttonIcon}>
            <IconLocation />
          </span>
          <span>Dozvoli lokaciju</span>
        </button>
        <select
          value={selectedCity}
          onChange={(event) => onCityChange(event.target.value)}
          aria-label="Izaberi grad"
          className={styles.citySelect}
        >
          {cityEntries.map((entry) => (
            <option key={entry.city}>{entry.city}</option>
          ))}
        </select>
        <StorePreview store={selectedStore} />
        <p className={styles.locatorStatus}>{locatorStatus}</p>
      </div>
    </aside>
  );
}

function StorePreview({ store }: { store: CityDisplayEntry }) {
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
