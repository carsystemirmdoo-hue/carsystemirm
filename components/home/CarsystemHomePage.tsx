"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProductCategoryGrid } from "@/components/categories/ProductCategoryGrid";
import { useProductSearchDialog } from "@/components/search/ProductSearchProvider";
import { PRODUCT_CATEGORIES } from "@/components/layout/navigation-data";
import { Button } from "@/components/ui/Button";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { CounterUp } from "@/components/ui/CounterUp";
import { CompanyLocationMap } from "@/components/map/CompanyLocationMap";
import { PartnerMap } from "@/components/stores/PartnerMap";
import {
  BrandLogoPlate,
  brandLogos,
  type BrandKey,
  trustBrandKeys,
} from "./BrandLogoPlate";
import { HomeCampaignCarousel } from "./HomeCampaignCarousel";
import { HomeSectionRail } from "./HomeSectionRail";
import { companyContact } from "@/lib/company-contact";
import { findNearestPartnerStore } from "@/lib/nearest-store";
import {
  getPartnerCityLabel,
  getPartnerCityKey,
  getPartnerLocationTypeLabel,
  getPublicPartnerStores,
  type PartnerStore,
} from "@/lib/partner-stores";
import { getCityDisplayEntries } from "@/components/stores/store-locator-display";
import styles from "./CarsystemHomePage.module.css";
import { PaintTakeoverHomeSection } from "./PaintTakeoverHomeSection";

const publicPartnerStores = getPublicPartnerStores();
const cityEntries = getCityDisplayEntries(publicPartnerStores);
const defaultCityEntry = cityEntries[0];
const defaultCity = defaultCityEntry?.key ?? "";
const cityOptions = [
  { label: "Svi gradovi", value: "" },
  ...cityEntries.map((entry) => ({ label: entry.city, value: entry.key })),
];
const homeVisibleStoreIds = new Set(publicPartnerStores.map((store) => store.id));

const trustBrandLinks: Partial<Record<BrandKey, string>> = {
  rm: "/brendovi/rm",
  carsystem: "/brendovi/carsystem",
  baslac: "/brendovi/baslac",
  norbin: "/brendovi/norbin",
  sata: "/brendovi/sata",
  carfit: "/brendovi/carfit",
  cosmosLac: "/brendovi/cosmos-lac",
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

function CategorySearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="10.8" cy="10.8" r="6.1" />
      <path d="m15.3 15.3 4 4" />
    </svg>
  );
}

function formatDistanceKm(distanceKm: number) {
  return `${Math.max(1, Math.round(distanceKm))} km`;
}

export function CarsystemHomePage() {
  const { openSearch } = useProductSearchDialog();
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [selectedMapStoreId, setSelectedMapStoreId] = useState(defaultCityEntry?.id ?? "");
  const [networkMapFailed, setNetworkMapFailed] = useState(false);
  const [locatorStatus, setLocatorStatus] = useState(
    cityEntries.length > 0
      ? "Izaberite grad ili koristite lokaciju."
      : "Potvrđene javne lokacije još nisu unete u lokator.",
  );
  const [showMobileLocator, setShowMobileLocator] = useState(false);
  const [paintDiagnostics, setPaintDiagnostics] = useState({
    debug: false,
    washDisabled: false,
  });

  const selectedStores = useMemo(
    () =>
      selectedCity
        ? publicPartnerStores.filter(
            (store) => getPartnerCityKey(store) === selectedCity,
          )
        : publicPartnerStores,
    [selectedCity],
  );
  const selectedStore = useMemo(
    () =>
      selectedStores.find((store) => store.id === selectedMapStoreId) ??
      selectedStores[0],
    [selectedMapStoreId, selectedStores],
  );

  useEffect(() => {
    let scrollFrame = 0;

    function updateMobileLocator() {
      setShowMobileLocator(window.scrollY > window.innerHeight * 0.72);
    }

    function requestMobileLocatorUpdate() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        updateMobileLocator();
      });
    }

    updateMobileLocator();
    window.addEventListener("scroll", requestMobileLocatorUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestMobileLocatorUpdate);

    return () => {
      window.removeEventListener("scroll", requestMobileLocatorUpdate);
      window.removeEventListener("resize", requestMobileLocatorUpdate);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const debug = searchParams.get("paintDebug") === "1";
    const washDisabled = debug && searchParams.get("wash") === "off";
    const root = document.documentElement;

    setPaintDiagnostics({ debug, washDisabled });
    if (washDisabled) {
      root.setAttribute("data-paint-wash-disabled", "true");
    } else {
      root.removeAttribute("data-paint-wash-disabled");
    }

    return () => root.removeAttribute("data-paint-wash-disabled");
  }, []);

  function handleCityChange(cityKey: string) {
    if (!cityKey) {
      setSelectedCity("");
      setSelectedMapStoreId("");
      setLocatorStatus(`Prikazano je svih ${publicPartnerStores.length} lokacija u mreži.`);
      return;
    }

    const cityEntry = cityEntries.find((entry) => entry.key === cityKey);
    const cityStores = publicPartnerStores.filter(
      (store) => getPartnerCityKey(store) === cityKey,
    );
    setSelectedCity(cityKey);
    setSelectedMapStoreId(cityStores[0]?.id ?? "");
    setLocatorStatus(
      `Prikazano ${cityStores.length} ${cityStores.length === 1 ? "lokacija" : "lokacije"} za grad ${cityEntry?.city ?? cityKey}.`,
    );
  }

  function handleMapStoreSelect(storeId: string) {
    const store = publicPartnerStores.find((item) => item.id === storeId);
    if (!store) return;

    const city = getPartnerCityLabel(store);
    setSelectedCity(getPartnerCityKey(store));
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

        setSelectedCity(getPartnerCityKey(nearest.store));
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
      <HomeCampaignCarousel
        headingPresentation="sr-only"
        aside={
          <LocatorCard
            selectedStore={selectedStore}
            selectedCity={selectedCity}
            locatorStatus={locatorStatus}
            onCityChange={handleCityChange}
            onLocationRequest={handleLocationRequest}
          />
        }
      />

      <section className={styles.trustStrip} aria-labelledby="brand-strip-title">
        <div className={styles.trustInner}>
          <p id="brand-strip-title" className={styles.trustLabel}>
            Programski brendovi
          </p>
          <div className={styles.brandRail} aria-label="Brendovi">
            {trustBrandKeys.map((brandKey) => {
              const href = trustBrandLinks[brandKey];
              const logo = (
                <BrandLogoPlate brandKey={brandKey} tone="mono" variant="rail" />
              );
              const brandName = brandLogos[brandKey].name;

              return href ? (
                <Link
                  aria-label={`Otvori stranicu brenda ${brandName}`}
                  className={styles.brandRailMonoLink}
                  href={href}
                  key={brandKey}
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

      <section
        id="kategorije-proizvoda"
        className={styles.categorySection}
        aria-labelledby="homepage-categories-title"
      >
        <div className={styles.categorySectionInner}>
          <div className={styles.categorySectionHeader}>
            <div>
              <h2 id="homepage-categories-title" data-cursor="headline">
                Kategorije proizvoda
              </h2>
              <p>
                Direktan pristup materijalima, opremi i priboru za profesionalni
                refinish proces.
              </p>
            </div>
            <div className={styles.categorySectionActions}>
              <Button href="/katalog" className={styles.categoryCatalogCta}>
                Pogledajte ceo katalog
              </Button>
              {/*
                Isti panel koji otvara lupa u Headeru — Homepage nema svoju
                pretragu, samo drugu ulaznu tačku u zajedničku.
              */}
              <button
                ref={searchTriggerRef}
                type="button"
                className={`${styles.categorySearchLink} cs-interactive-surface`}
                aria-haspopup="dialog"
                data-cursor="button"
                data-motion-surface
                onClick={() => openSearch(searchTriggerRef.current)}
              >
                <CategorySearchIcon />
                Pretražite proizvode
              </button>
            </div>
          </div>

          <ProductCategoryGrid
            categories={PRODUCT_CATEGORIES}
            layout="homepage"
          />
        </div>
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
              ? `${selectedStore.city} · ${getPartnerLocationTypeLabel(selectedStore)}`
              : "Nema potvrđenih javnih lokacija"}
          </small>
        </span>
      </a>

      <section
        id="prodavnice-mreza"
        className={`${styles.sectionAlt} ${styles.networkSection} ${styles.railTarget}`}
        data-paint-debug-layout={
          paintDiagnostics.debug ? "true" : undefined
        }
        aria-labelledby="network-title"
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>Prodajna i partnerska mreža</p>
            <h2 id="network-title" data-cursor="headline">Pronađite proverenu lokaciju u svom regionu.</h2>
            <p>
              Izaberite grad ili koristite lokaciju da brzo dođete do najbliže
              dostupne partnerske tačke. Za dostupnost proizvoda i tehnički
              savet, upit ide Carsystem i R-M timu.
            </p>
          </div>
          <div className={styles.statPills} data-counter-group>
            <span>
              <strong>
                <CounterUp
                  delayMs={250}
                  durationMs={1450}
                  value={publicPartnerStores.length}
                />
              </strong>
              <small>Lokacija</small>
            </span>
            <span>
              <strong>
                <CounterUp delayMs={250} durationMs={1450} value={cityEntries.length} />
              </strong>
              <small>Gradova</small>
            </span>
            <p className={styles.statContext}>
              <strong>Provereni podaci</strong>
              <span>Objavljuju se samo odobrene javne lokacije</span>
            </p>
          </div>
        </div>

        <div className={styles.networkGrid}>
          <div className={styles.locatorPanel} data-locator-card="">
            <label className={styles.fieldLabel} htmlFor="city-select">
              Grad ili region
            </label>
            <SearchableCombobox
              ariaLabel="Grad ili region"
              disabled={cityEntries.length === 0}
              emptyMessage="Nema gradova koji odgovaraju pretrazi."
              id="city-select"
              onChange={handleCityChange}
              options={cityOptions}
              placeholder="Izaberite grad"
              searchPlaceholder="Pretražite grad"
              sheetTitle="Izaberite grad"
              value={selectedCity}
            />
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
            <StorePreviewList
              onSelect={handleMapStoreSelect}
              selectedId={selectedMapStoreId}
              stores={selectedStores}
            />
          </div>

          <div
            className={styles.mapPanel}
            data-map-wrapper=""
            aria-label="Mapa partnerske mreže"
          >
            {publicPartnerStores.length > 0 && !networkMapFailed ? (
              <PartnerMap
                badgeLabel="Partnerska mreža"
                className={styles.homeNetworkMapCanvas}
                cooperativeGestures
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

      <PaintTakeoverHomeSection
        debugEnabled={paintDiagnostics.debug}
        washDisabled={paintDiagnostics.washDisabled}
      />

      {/*
        Hand-off iz tamnog repa takeovera u svetlu komercijalnu zonu. Nosi ga
        jedan namenski gradijentni pojas iz dizajna, umesto ranijeg chapter
        tinta koji je bojio sve sekcije ispod.
      */}
      <div className={styles.chapterTransition} aria-hidden="true" />

      <section
        className={`${styles.section} ${styles.supportChapter} ${styles.chapterAfter}`}
        aria-labelledby="support-title"
      >
        <div className={styles.supportBand}>
          <div className={styles.supportStatement}>
            <div className={styles.supportCopy}>
              <p className={styles.sectionKicker}>Tehnička podrška i mikseri boja</p>
              <h2 id="support-title" data-cursor="headline">Pravi izbor proizvoda počinje dobrim savetom.</h2>
              <p className={styles.sectionLead}>
                Nijansiranje po formuli proizvođača, savetovanje za pripremu i
                lakiranje, kao i komercijalna podrška za radionice i partnere.
              </p>
              <SplitContactCta
                className={styles.supportContactCta}
                inquiryHref="/kontakt?tema=tehnicka-podrska"
                inquiryLabel="Pošaljite upit podršci"
              />
            </div>
            <figure className={styles.supportVisual}>
              <Image
                src="/products/carsystem/carsystem-finish-serija.png"
                alt="Carsystem Finish serija"
                width={660}
                height={662}
                sizes="(max-width: 900px) 92vw, 38vw"
              />
              <figcaption>Carsystem Finish serija</figcaption>
            </figure>
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
              <article key={title}>
                <span aria-hidden="true" />
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.educationChapter} ${styles.chapterAfter}`}
        aria-labelledby="education-title"
      >
        <div className={styles.educationIndexLayout}>
          <div className={styles.educationIntro}>
            <p className={styles.sectionKicker}>Edukacija i znanje</p>
            <h2 id="education-title" data-cursor="headline">
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

      <section
        className={`${styles.sectionAlt} ${styles.chapterAfter}`}
        aria-labelledby="contact-title"
      >
        <div className={styles.contactGrid}>
          <div className={styles.contactPanel}>
            <p className={styles.sectionKicker}>Centrala, Inđija</p>
            <h2 id="contact-title" data-cursor="headline">Carsystem i R-M Inđija d.o.o.</h2>
            <div className={styles.contactRows}>
              <span>
                <b>Lokacija</b>
                {companyContact.locationLabel}
              </span>
              <span>
                <b>Upiti</b>
                Veleprodaja, tehnička podrška i partnerska mreža.
              </span>
              <span>
                <b>Kontakt</b>
                {companyContact.phone && companyContact.phoneHref ? (
                  <a href={companyContact.phoneHref}>{companyContact.phone}</a>
                ) : (
                  <a href={companyContact.emailHref}>{companyContact.email}</a>
                )}
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

      <section
        id="zavrsni-poziv"
        className={`${styles.finalCta} ${styles.railTarget}`}
        aria-labelledby="final-cta-title"
      >
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
          <h2 id="final-cta-title" data-cursor="headline">
            Pronađite prodavnicu ili pripremite upit za saradnju.
          </h2>
          <span>
            Profesionalni refinish program, tehnička podrška i partnerska mreža
            za radionice i servise.
          </span>
          <div className={styles.finalActions}>
            <a className={`${styles.primaryCta} ${styles.finalPrimaryCta} cs-magnetic-cta cs-theme-wipe-card`} href="/prodavnice" data-cursor="button" data-motion-surface data-motion="theme-wipe">
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

const LOCATOR_COMPACT_QUERY = "(max-width: 53.75rem)";

function LocatorCard({
  selectedStore,
  selectedCity,
  locatorStatus,
  onCityChange,
  onLocationRequest,
}: {
  selectedStore?: PartnerStore;
  selectedCity: string;
  locatorStatus: string;
  onCityChange: (city: string) => void;
  onLocationRequest: () => void;
}) {
  /*
   * Kompaktan prikaz na uskim ekranima: zaglavlje postaje dugme koje otvara
   * detalje. Do hidratacije CSS sam sakriva telo na mobilnom, pa nema bljeska
   * pune kartice preko banera. Na desktopu je kartica uvek otvorena.
   */
  const bodyId = useId();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(LOCATOR_COMPACT_QUERY);
    const sync = () => setCompact(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  const heading = (
    <>
      <span className={styles.buttonIcon}>
        <IconLocation />
      </span>
      <span className={styles.locatorTitle}>Pronađite prodavnicu u mreži</span>
      <small>{selectedStore ? getPartnerCityLabel(selectedStore) : "Mreža"}</small>
    </>
  );

  return (
    <aside
      className={styles.locatorCard}
      aria-label="Lokator prodavnica"
      data-compact={compact || undefined}
      data-open={(compact && open) || undefined}
    >
      {compact ? (
        <button
          type="button"
          className={styles.locatorToggle}
          aria-controls={bodyId}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {heading}
          <span className={styles.locatorChevron} aria-hidden="true" />
        </button>
      ) : (
        <header className={styles.locatorHeader}>{heading}</header>
      )}
      <div className={styles.locatorBody} id={bodyId}>
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
        <SearchableCombobox
          ariaLabel="Izaberite grad"
          disabled={cityEntries.length === 0}
          emptyMessage="Nema gradova koji odgovaraju pretrazi."
          onChange={onCityChange}
          options={cityOptions}
          placeholder="Izaberite grad"
          searchPlaceholder="Pretražite grad"
          sheetTitle="Izaberite grad"
          value={selectedCity}
        />
        <StorePreview store={selectedStore} />
        <p className={styles.locatorStatus}>{locatorStatus}</p>
      </div>
    </aside>
  );
}

function phoneHref(phone: string) {
  const primaryNumber = phone.split("/")[0]?.trim() ?? phone;
  return `tel:${primaryNumber.replace(/[^\d+]/g, "")}`;
}

function StorePreview({ store }: { store?: PartnerStore }) {
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
            <small>{getPartnerLocationTypeLabel(store)}</small>
        </header>
        <p>{store.address}</p>
        <span>{getPartnerCityLabel(store)}</span>
      </div>
    </article>
  );
}

function StorePreviewList({
  onSelect,
  selectedId,
  stores,
}: {
  onSelect: (storeId: string) => void;
  selectedId: string;
  stores: PartnerStore[];
}) {
  if (stores.length === 0) return <StorePreview />;

  return (
    <div className={styles.storePreviewList} aria-label="Lokacije u izabranom gradu">
      {stores.map((store) => {
        const isActive = store.id === selectedId;

        return (
          <article
            className={styles.storePreviewItem}
            data-active={isActive || undefined}
            key={store.id}
          >
            <button
              aria-pressed={isActive}
              className={styles.storePreviewSelect}
              onClick={() => onSelect(store.id)}
              type="button"
            >
              <span className={styles.availableDot} aria-hidden="true" />
              <span className={styles.storePreviewContent}>
                <span className={styles.storePreviewHeading}>
                  <strong>{store.name}</strong>
                  <small>{getPartnerLocationTypeLabel(store)}</small>
                </span>
                <span>{store.address}</span>
                <span>
                  {getPartnerCityLabel(store)} · {getPartnerLocationTypeLabel(store)}
                </span>
              </span>
            </button>
            {store.phone ? (
              <a className={styles.storePreviewPhone} href={phoneHref(store.phone)}>
                {store.phone}
              </a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
