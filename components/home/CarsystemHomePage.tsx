"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import { CounterUp } from "@/components/ui/CounterUp";
import { CompanyLocationMap } from "@/components/map/CompanyLocationMap";
import { PartnerMap } from "@/components/stores/PartnerMap";
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
import { findNearestPartnerStore } from "@/lib/nearest-store";
import {
  getPartnerCityLabel,
  getPartnerLocationStats,
  getPublicPartnerStores,
} from "@/lib/partner-stores";
import {
  getCityDisplayEntries,
  type CityDisplayEntry,
} from "@/components/stores/store-locator-display";
import styles from "./CarsystemHomePage.module.css";

const publicPartnerStores = getPublicPartnerStores();
const cityEntries = getCityDisplayEntries(publicPartnerStores);
const defaultCityEntry = cityEntries[0];
const defaultCity = defaultCityEntry?.city ?? "";
const locationStats = getPartnerLocationStats(publicPartnerStores);
const homeVisibleStoreIds = new Set(publicPartnerStores.map((store) => store.id));

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
    title: "Priprema površine pre prajmera",
    readTime: "4 min",
    slug: "priprema-povrsine",
  },
  {
    category: "Boje",
    title: "Izbor laka za završni sloj",
    readTime: "5 min",
    slug: "izbor-laka",
  },
  {
    category: "Poliranje",
    title: "Korekcija i završni sjaj",
    readTime: "4 min",
    slug: "poliranje-visoki-sjaj",
  },
  {
    category: "Problemi",
    title: "Greške koje narušavaju finiš",
    readTime: "6 min",
    slug: "greske-u-farbanju",
  },
  {
    category: "Proces",
    title: "Redosled rada kroz refinish proces",
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

function formatDistanceKm(distanceKm: number) {
  return `${Math.max(1, Math.round(distanceKm))} km`;
}

export function CarsystemHomePage() {
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [selectedMapStoreId, setSelectedMapStoreId] = useState(defaultCityEntry?.id ?? "");
  const [networkMapFailed, setNetworkMapFailed] = useState(false);
  const [locatorStatus, setLocatorStatus] = useState(
    cityEntries.length > 0
      ? "Izaberite grad ili koristite lokaciju za najbližu dostupnu tačku u mreži."
      : "Potvrđene javne lokacije još nisu unete u lokator.",
  );
  const [showMobileLocator, setShowMobileLocator] = useState(false);

  const selectedStore = useMemo(
    () => cityEntries.find((entry) => entry.city === selectedCity) ?? cityEntries[0],
    [selectedCity],
  );

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

  function handleCityChange(city: string) {
    if (!city) {
      setSelectedCity("");
      setLocatorStatus("Potvrđene javne lokacije još nisu unete u lokator.");
      return;
    }

    setSelectedCity(city);
    setSelectedMapStoreId(cityEntries.find((entry) => entry.city === city)?.id ?? "");
    setLocatorStatus(`Prikazana je partnerska tačka za grad ${city}.`);
  }

  function handleMapStoreSelect(storeId: string) {
    const store = publicPartnerStores.find((item) => item.id === storeId);
    if (!store) return;

    const city = getPartnerCityLabel(store);
    setSelectedCity(city);
    setSelectedMapStoreId(store.id);
    setLocatorStatus(`Prikazana je partnerska lokacija: ${store.name}, ${city}.`);
  }

  function handleLocationRequest() {
    if (publicPartnerStores.length === 0) {
      setLocatorStatus("Nema potvrđenih javnih lokacija za poređenje udaljenosti.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocatorStatus("Lokacija nije dostupna u ovom pregledaču. Izaberite grad ručno.");
      return;
    }

    setLocatorStatus("Tražimo najbližu dostupnu tačku u partnerskoj mreži...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestPartnerStore(publicPartnerStores, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        if (!nearest) {
          setLocatorStatus(
            "Trenutno ne možemo da uporedimo lokacije. Izaberite grad ručno iz liste.",
          );
          return;
        }

        setSelectedCity(getPartnerCityLabel(nearest.store));
        setSelectedMapStoreId(nearest.store.id);
        setLocatorStatus(
          `Najbliža dostupna tačka: ${nearest.store.city}, oko ${formatDistanceKm(
            nearest.distanceKm,
          )}. Dostupnost proizvoda potvrđuje se kroz upit.`,
        );
      },
      () => {
        setLocatorStatus("Lokacija nije odobrena. Izaberite grad ručno iz liste.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <main className={styles.home}>
      <HomeSectionRail />
      <section className={styles.hero} aria-labelledby="homepage-title">
        <div className={styles.heroMedia} aria-hidden="true">
          <span className={styles.heroImage} />
          <span className={styles.mistOne} />
          <span className={styles.mistTwo} />
          <span className={styles.mistThree} />
        </div>
        <div className={styles.heroFade} />

        <div className={styles.processBadge}>
          <span className={styles.liveDot} />
          Refinish tok
          <span className={styles.badgeBars} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Carsystem i R-M Inđija, Srbija</p>
            <h1 id="homepage-title" className={styles.heroTitle}>
              Profesionalni
              <br />
              refinish program
              <br />
              <span>za siguran rezultat.</span>
            </h1>
            <p className={styles.heroIntro}>
              Distribucija boja, lakova, pripremnih materijala i opreme za
              lakirnice, uz tehničku podršku i partnersku mrežu u Srbiji i regionu.
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
                <span>Pronađite prodavnicu</span>
              </a>
              <a className={`${styles.secondaryCta} cs-interactive-surface`} href="/katalog" data-cursor="button" data-motion-surface>
                Pregledajte katalog
              </a>
              <a className={`${styles.textCta} cs-link-reveal`} href="/kontakt?tema=b2b" data-cursor="link">
                Upit za saradnju
              </a>
            </div>
            <p className={styles.proofLine}>
              <span />
              Nijansiranje po formuli proizvođača i podrška pri izboru sistema.
            </p>
            <div className={styles.heroChips} aria-label="Glavne mogućnosti">
              <span>Boje i lakovi</span>
              <span>Partnerska mreža</span>
              <span>Tehnička podrška</span>
            </div>
          </div>
        </div>

        <LocatorCard
          selectedStore={selectedStore}
          selectedCity={selectedCity}
          locatorStatus={locatorStatus}
          onCityChange={handleCityChange}
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
          <strong>Prodavnice u mreži</strong>
          <small>
            {selectedStore
              ? `${selectedStore.city} · ${selectedStore.region}`
              : "Nema potvrđenih javnih lokacija"}
          </small>
        </span>
      </a>

      <section className={styles.trustStrip} aria-labelledby="brand-strip-title">
        <div className={styles.trustInner}>
          <p id="brand-strip-title" className={styles.trustLabel}>
            Programski brendovi
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

      <ProcessSection />

      <section className={styles.sectionAlt} aria-labelledby="network-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>Partnerska mreža, Srbija i region</p>
            <h2 id="network-title">Prodavnice i podrška za vaš region.</h2>
            <p>
              Izaberite grad ili koristite lokaciju da brzo dođete do najbliže
              dostupne partnerske tačke. Za dostupnost proizvoda i tehnički
              savet, upit ide Carsystem i R-M timu.
            </p>
          </div>
          <div className={styles.statPills}>
            <span>
              <strong>
                <CounterUp value={locationStats.locationCount} />
              </strong>
              <small>Lokacija</small>
            </span>
            <span>
              <strong>
                <CounterUp value={locationStats.cityCount} />
              </strong>
              <small>Gradova</small>
            </span>
            <span>
              <strong>
                <CounterUp value={locationStats.prodajnoMestoCount} />
              </strong>
              <small>Prodajnih mesta</small>
            </span>
          </div>
        </div>

        <div className={styles.networkGrid}>
          <div className={styles.locatorPanel}>
            <label className={styles.fieldLabel} htmlFor="city-select">
              Grad ili region
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(event) => handleCityChange(event.target.value)}
              className={styles.citySelect}
              disabled={cityEntries.length === 0}
            >
              {cityEntries.length > 0 ? (
                cityEntries.map((entry) => <option key={entry.city}>{entry.city}</option>)
              ) : (
                <option value="">Nema potvrđenih lokacija</option>
              )}
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
              <span>Koristi moju lokaciju</span>
            </button>
            <p className={styles.locatorStatus}>{locatorStatus}</p>
            <StorePreview store={selectedStore} />
          </div>

          <div className={styles.mapPanel} aria-label="Mapa partnerske mreže">
            {publicPartnerStores.length > 0 && !networkMapFailed ? (
              <PartnerMap
                badgeLabel="Partnerska mreža"
                className={styles.homeNetworkMapCanvas}
                hoveredId=""
                onError={() => setNetworkMapFailed(true)}
                onReady={() => setNetworkMapFailed(false)}
                onSelect={handleMapStoreSelect}
                selectedId={selectedMapStoreId}
                stores={publicPartnerStores}
                visibleIds={homeVisibleStoreIds}
              />
            ) : (
              <div className={styles.homeMapFallback}>
                <strong>
                  {publicPartnerStores.length > 0
                    ? "Mapa trenutno nije dostupna."
                    : "Mapa čeka potvrđene javne lokacije."}
                </strong>
                <span>
                  {publicPartnerStores.length > 0
                    ? "Partnerska lista ostaje dostupna na stranici prodavnica."
                    : "Demo i nepotpuni zapisi se ne prikazuju javno."}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <ProgramDeckSection />

      <section className={styles.section} aria-labelledby="support-title">
        <div className={styles.supportBand}>
          <div className={styles.supportStatement}>
            <p className={styles.sectionKicker}>Tehnička podrška i mikseri boja</p>
            <h2 id="support-title">Pravi izbor proizvoda počinje dobrim savetom.</h2>
            <p className={styles.sectionLead}>
              Nijansiranje po formuli proizvođača, savetovanje za pripremu i
              lakiranje, kao i komercijalna podrška za radionice i partnere.
            </p>
            <SplitContactCta
              inquiryHref="/kontakt?tema=tehnicka-podrska"
              inquiryLabel="Pošaljite upit podršci"
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
              ["Mikseri boja", "Nijansiranje prema formuli proizvođača i sistemu koji se koristi."],
              ["Tehnička podrška", "Smernice za podlogu, lakiranje i završnu obradu."],
              ["Komercijalni tim", "Usmeravanje upita ka odgovarajućoj prodavnici ili regionu."],
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
              Znanje za stabilniji rad u lakirnici.
            </h2>
            <p>
              Kratke teme za izbor materijala, pripremu upita i razgovor sa
              tehničkom podrškom.
            </p>
            <Link className={styles.textLink} href="/kontakt?tema=tehnicka-podrska">
              Zatraži tehnički savet
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
                Veleprodaja, tehnička podrška i partnerska mreža.
              </span>
              <span>
                <b>Kontakt</b>
                <a href={companyContact.phoneHref}>{companyContact.phone}</a>
                <small>ili pošaljite upit za prodavnicu, proizvode ili podršku</small>
              </span>
            </div>
            <div className={styles.ctaRow}>
              <a className={`${styles.primaryCta} cs-magnetic-cta cs-theme-wipe-card`} href="/kontakt" data-cursor="button" data-motion-surface data-motion="theme-wipe">
                <span>Kontaktirajte veleprodaju</span>
              </a>
              <a className={`${styles.secondaryCta} cs-interactive-surface`} href="/prodavnice" data-cursor="button" data-motion-surface>
                Prodavnice u mreži
              </a>
            </div>
          </div>
          <div className={styles.contactMap}>
            <CompanyLocationMap className={styles.contactMapCanvas} />
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
            Pronađite prodavnicu ili pripremite upit za saradnju.
          </h2>
          <span>
            Profesionalni refinish program, tehnička podrška i partnerska mreža
            za radionice i servise.
          </span>
          <div className={styles.finalActions}>
            <a className={`${styles.primaryCta} cs-magnetic-cta cs-theme-wipe-card`} href="/prodavnice" data-cursor="button" data-motion-surface data-motion="theme-wipe">
              <span>Prodavnice u mreži</span>
            </a>
            <a className={`${styles.secondaryOnDark} cs-interactive-surface`} href="/katalog" data-cursor="button" data-motion-surface>
              Katalog proizvoda
            </a>
            <a className={`${styles.secondaryOnDark} cs-interactive-surface`} href="/kontakt?tema=b2b" data-cursor="button" data-motion-surface>
              Upit za saradnju
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
  selectedStore?: CityDisplayEntry;
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
        Pronađite prodavnicu u mreži
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
          <span>Koristi moju lokaciju</span>
        </button>
        <select
          value={selectedCity}
          onChange={(event) => onCityChange(event.target.value)}
          aria-label="Izaberite grad"
          className={styles.citySelect}
          disabled={cityEntries.length === 0}
        >
          {cityEntries.length > 0 ? (
            cityEntries.map((entry) => <option key={entry.city}>{entry.city}</option>)
          ) : (
            <option value="">Nema potvrđenih lokacija</option>
          )}
        </select>
        <StorePreview store={selectedStore} />
        <p className={styles.locatorStatus}>{locatorStatus}</p>
      </div>
    </aside>
  );
}

function StorePreview({ store }: { store?: CityDisplayEntry }) {
  if (!store) {
    return (
      <article className={styles.storePreview}>
        <span className={styles.availableDot} />
        <div>
          <header>
            <strong>Nema javnih lokacija</strong>
            <small>U pripremi</small>
          </header>
          <p>Potvrđene prodajne lokacije biće prikazane tek kada podaci budu uneti.</p>
          <span>Bez demo adresa u public lokatoru</span>
        </div>
      </article>
    );
  }

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
