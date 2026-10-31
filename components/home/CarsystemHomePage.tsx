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
import { type BrandKey, trustBrandKeys } from "./BrandLogoPlate";
import { BrandMarquee } from "./BrandMarquee";
import { HomeCampaignCarousel } from "./HomeCampaignCarousel";
import { HomeSectionRail } from "./HomeSectionRail";
import { companyContact, toTelHref } from "@/lib/company-contact";
import { type GeoPoint } from "@/lib/nearest-store";
import {
  getPartnerCityLabel,
  getPartnerCityKey,
  getPartnerLocationTypeLabel,
  getPublicPartnerStores,
  hasLocationCategory,
  type PartnerStore,
} from "@/lib/partner-stores";
import {
  distanceKindLabel,
  formatDistanceKm,
  rankStoresByDistance,
  type RankedStore,
} from "@/lib/store-distance";
import { getCityDisplayEntries } from "@/components/stores/store-locator-display";
import styles from "./CarsystemHomePage.module.css";
import { PaintTakeoverHomeSection } from "./PaintTakeoverHomeSection";

const publicPartnerStores = getPublicPartnerStores();
const cityEntries = getCityDisplayEntries(publicPartnerStores);
/** Vrednost koja ne odgovara nijednoj opciji, pa lista prikazuje „Izaberite grad”. */
const NO_CITY_CHOICE = "__bez-izbora__";
const cityOptions = [
  { label: "Svi gradovi", value: "" },
  ...cityEntries.map((entry) => ({ label: entry.city, value: entry.key })),
];
const homeVisibleStoreIds = new Set(publicPartnerStores.map((store) => store.id));
/** Widget u heroju nudi samo gradove; „Svi gradovi” ostaje u odeljku mreže. */
const locatorCityOptions = cityOptions.filter((option) => option.value !== "");
/*
 * Izbor grada se pamti samo u ovom pregledaču (pogodnost, ne podatak). Bez izbora i bez
 * sačuvanog izbora widget počinje sa „Izaberite grad”, bez unapred prikazane lokacije.
 */
const CITY_CHOICE_KEY = "cs-izabran-grad-prodavnica";

function readSavedCity() {
  try {
    const key = window.localStorage.getItem(CITY_CHOICE_KEY);
    return key && cityEntries.some((entry) => entry.key === key) ? key : null;
  } catch {
    return null;
  }
}

function saveCity(key: string) {
  try {
    // „Svi gradovi” (prazan ključ) briše sačuvani grad, pa se pri sledećoj poseti ne vraća stari izbor.
    if (key) window.localStorage.setItem(CITY_CHOICE_KEY, key);
    else window.localStorage.removeItem(CITY_CHOICE_KEY);
  } catch {
    /* bez skladišta izbor važi samo do napuštanja strane */
  }
}

const trustBrandLinks: Partial<Record<BrandKey, string>> = {
  rm: "/brendovi/rm",
  carsystem: "/brendovi/carsystem",
  baslac: "/brendovi/baslac",
  norbin: "/brendovi/norbin",
  cosmosLac: "/brendovi/cosmos-lac",
  befar: "/brendovi/befar",
  carfit: "/brendovi/carfit",
  sata: "/brendovi/sata",
  yachtcare: "/brendovi/yachtcare",
};

/*
 * Stavke vode na obrazac tehničke podrške (sa temom), ne na članak, pa su
 * formulisane kao pitanja za podršku i nemaju vreme čitanja.
 */
const educationItems = [
  {
    category: "Priprema",
    title: "Pitajte nas o pripremi površine pre prajmera",
    slug: "priprema-povrsine",
  },
  {
    category: "Boje",
    title: "Pitajte nas koji lak odgovara završnom sloju",
    slug: "izbor-laka",
  },
  {
    category: "Poliranje",
    title: "Pitajte nas o korekciji i završnom sjaju",
    slug: "poliranje-visoki-sjaj",
  },
  {
    category: "Problemi",
    title: "Opišite nam grešku koja narušava finiš",
    slug: "greske-u-farbanju",
  },
  {
    category: "Proces",
    title: "Pitajte nas o redosledu rada kroz refinish proces",
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

export function CarsystemHomePage() {
  const { openSearch } = useProductSearchDialog();
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  // Bez izbora: sve lokacije, bez unapred izabrane prodavnice (ni u widgetu ni u odeljku mreže).
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedMapStoreId, setSelectedMapStoreId] = useState("");
  const [networkMapFailed, setNetworkMapFailed] = useState(false);
  // Da li je korisnik izabrao grad (lista, mapa, lokacija ili sačuvan izbor). Widget, traka na
  // telefonu i odeljak mreže dele isti izbor; bez njega nijedan ne ističe prodavnicu.
  const [cityChosen, setCityChosen] = useState(false);
  const [locatorStatus, setLocatorStatus] = useState(
    cityEntries.length > 0
      ? "Izaberite grad ili koristite lokaciju."
      : "Potvrđene javne lokacije još nisu unete u lokator.",
  );
  const [showMobileLocator, setShowMobileLocator] = useState(false);
  // „Sve lokacije — po udaljenosti“: postoji tek kada korisnik pokrene geolokaciju.
  // Lokacija se ne šalje nikome; udaljenost se računa u pregledaču.
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
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
  // Lista u odeljku mreže: isti javni skup kao mapa i broj; po udaljenosti kada je
  // lokacija poznata, inače izvorni redosled. Grad je zaseban filter.
  const rankedStores = useMemo<RankedStore[]>(
    () =>
      origin
        ? rankStoresByDistance(selectedStores, origin)
        : selectedStores.map((store) => ({ store, distanceKm: null, kind: "air" as const })),
    [origin, selectedStores],
  );
  const distanceById = useMemo(
    () => new Map(rankedStores.map((item) => [item.store.id, item.distanceKm])),
    [rankedStores],
  );
  const selectedStore = useMemo(
    () =>
      selectedStores.find((store) => store.id === selectedMapStoreId) ??
      (cityChosen && selectedCity ? selectedStores[0] : undefined),
    [cityChosen, selectedCity, selectedMapStoreId, selectedStores],
  );

  useEffect(() => {
    let scrollFrame = 0;

    function updateMobileLocator() {
      // Kada je futer na ekranu, traka bi prekrila njegov poslednji red
      // (pravni podaci firme), pa se tada sklanja.
      const footer = document.querySelector("footer.cs-animated-footer");
      const footerInView =
        footer !== null &&
        footer.getBoundingClientRect().top < window.innerHeight;
      setShowMobileLocator(
        window.scrollY > window.innerHeight * 0.72 && !footerInView,
      );
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

  useEffect(() => {
    const saved = readSavedCity();
    if (!saved) return;
    const savedStores = publicPartnerStores.filter((store) => getPartnerCityKey(store) === saved);
    const savedCity = cityEntries.find((entry) => entry.key === saved)?.city ?? saved;
    setSelectedCity(saved);
    setSelectedMapStoreId(savedStores[0]?.id ?? "");
    setCityChosen(true);
    setLocatorStatus(`Prikazan je Vaš ranije izabran grad: ${savedCity}.`);
  }, []);

  function handleCityChange(cityKey: string) {
    setCityChosen(true);
    saveCity(cityKey);
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

  // Izbor kartice ili markera samo ističe lokaciju; ne filtrira listu na jedan grad.
  function handleMapStoreSelect(storeId: string) {
    const store = publicPartnerStores.find((item) => item.id === storeId);
    if (!store) return;

    const distance = distanceById.get(store.id);
    setSelectedMapStoreId(store.id);
    setLocatorStatus(
      `Istaknuta je lokacija ${store.name}, ${getPartnerCityLabel(store)}${
        typeof distance === "number"
          ? ` — oko ${formatDistanceKm(distance)} ${distanceKindLabel("air")}`
          : ""
      }.`,
    );
    document
      .getElementById(`lokacija-${store.id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function showAllLocations() {
    setSelectedCity("");
    setCityChosen(Boolean(origin));
    setLocatorStatus(
      origin
        ? `Prikazane su sve lokacije (${publicPartnerStores.length}), od najbliže.`
        : `Prikazano je svih ${publicPartnerStores.length} lokacija u mreži.`,
    );
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

    setLocating(true);
    setLocatorStatus("Određujemo Vašu lokaciju…");
    const slow = window.setTimeout(() => {
      setLocatorStatus("Određivanje lokacije traje duže nego obično. Grad možete izabrati i ručno.");
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(slow);
        setLocating(false);
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        // Režim „Sve lokacije — po udaljenosti“: bez filtera grada, svih N lokacija.
        const ranked = rankStoresByDistance(publicPartnerStores, point);
        const nearestPurchase =
          ranked.find((item) => item.distanceKm !== null && hasLocationCategory(item.store, "kupovina")) ??
          ranked.find((item) => item.distanceKm !== null);

        setOrigin(point);
        setSelectedCity("");
        setCityChosen(true);
        setSelectedMapStoreId(nearestPurchase?.store.id ?? "");
        setLocatorStatus(
          nearestPurchase && nearestPurchase.distanceKm !== null
            ? `Sve lokacije (${publicPartnerStores.length}) su poređane od najbliže, ${distanceKindLabel(
                "air",
              )}. Najbliža prodavnica: ${nearestPurchase.store.name}, ${getPartnerCityLabel(
                nearestPurchase.store,
              )} — oko ${formatDistanceKm(nearestPurchase.distanceKm)}.`
            : "Lokacije trenutno nemaju koordinate za poređenje. Izaberite grad iz liste.",
        );
      },
      (error) => {
        window.clearTimeout(slow);
        setLocating(false);
        // Ručni izbor grada ostaje dostupan u svakom slučaju; poruka kaže šta se desilo.
        setLocatorStatus(
          error.code === error.PERMISSION_DENIED
            ? "Pristup lokaciji nije odobren. Izaberite grad iz liste."
            : error.code === error.TIMEOUT
              ? "Određivanje lokacije traje predugo. Pokušajte ponovo ili izaberite grad iz liste."
              : "Uređaj trenutno ne može da odredi lokaciju. Izaberite grad iz liste.",
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }

  return (
    <main className={styles.home}>
      {/* Jedna najava statusa lokatora za čitače ekrana (vidljiv tekst je i u widgetu i u
          odeljku mreže, pa bi dva živa regiona istu poruku pročitala dvaput). */}
      <p className="sr-only" role="status" aria-live="polite">
        {locatorStatus}
      </p>
      <HomeSectionRail />
      <HomeCampaignCarousel
        headingPresentation="sr-only"
        aside={
          <LocatorCard
            selectedDistanceKm={selectedStore ? (distanceById.get(selectedStore.id) ?? null) : null}
            showAllByDistance={Boolean(origin)}
            locating={locating}
            selectedStore={selectedStore}
            selectedCity={cityChosen ? selectedCity : ""}
            locatorStatus={locatorStatus}
            onCityChange={handleCityChange}
            onLocationRequest={handleLocationRequest}
          />
        }
      />

      <section className={styles.trustStrip} aria-label="Programski brendovi">
        <div className={styles.trustInner}>
          <BrandMarquee brandKeys={trustBrandKeys} links={trustBrandLinks} />
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
              {/* Bez prefetch-a: RSC kataloga je najveći na sajtu, a ova veza stoji uz dugme
                  pretrage — prefetch bi se takmičio sa indeksom pretrage. */}
              <Button href="/katalog" className={styles.categoryCatalogCta} prefetch={false}>
                Pogledajte ceo katalog
              </Button>
              {/*
                Isti panel koji otvara lupa u Headeru — Homepage nema svoju
                pretragu, samo drugu ulaznu tačku u zajedničku.
              */}
              <button
                ref={searchTriggerRef}
                type="button"
                className={`${styles.categorySearchLink} cs-cta`}
                data-cta-on="theme"
                aria-haspopup="dialog"
                data-cursor="button"
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
            {publicPartnerStores.length === 0
              ? "Nema potvrđenih javnih lokacija"
              : selectedStore
                ? `${selectedStore.city} · ${getPartnerLocationTypeLabel(selectedStore)}`
                : "Izaberite grad"}
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
              <span>
                Objavljuju se samo odobrene javne lokacije.
              </span>
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
              value={cityChosen ? selectedCity : NO_CITY_CHOICE}
            />
            <button
              type="button"
              className={`${styles.locationButton} ${styles.locationButtonSecondary}`}
              onClick={handleLocationRequest}
              aria-busy={locating || undefined}
              data-cursor="button"
            >
              <span className={styles.buttonIcon}>
                <IconLocation />
              </span>
              <span>{locating ? "Određujemo lokaciju…" : "Koristite svoju lokaciju"}</span>
            </button>
            <p className={styles.locatorStatus}>{locatorStatus}</p>
            <StorePreviewList
              byDistance={Boolean(origin)}
              cityKey={cityChosen ? selectedCity : ""}
              cityLabel={
                selectedCity ? (cityEntries.find((entry) => entry.key === selectedCity)?.city ?? "") : ""
              }
              onSelect={handleMapStoreSelect}
              onShowAll={showAllLocations}
              rankedStores={rankedStores}
              selectedId={selectedMapStoreId}
              totalCount={publicPartnerStores.length}
            />
          </div>

          <div
            className={styles.mapPanel}
            data-map-wrapper=""
            role="group"
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
                origin={origin}
                selectedId={selectedMapStoreId}
                selectedZoom={10}
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
                    : "Lokacije se objavljuju kada podaci budu potvrđeni."}
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
                src="/products/carsystem/catalog/carsystem-paint-system-cps-3-0.webp"
                alt="Carsystem CPS 3.0 — posude sa skalom odnosa mešanja"
                width={660}
                height={726}
                sizes="(max-width: 900px) 92vw, 38vw"
              />
              <figcaption>Posude sa skalom odnosa mešanja</figcaption>
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
              Zatražite tehnički savet
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
            <h2 id="contact-title" data-cursor="headline">{companyContact.name}</h2>
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
              <a className={`${styles.primaryCta} cs-cta`} data-cta-on="theme" href="/kontakt" data-cursor="button">
                <span>Kontaktirajte veleprodaju</span>
              </a>
              <a className={`${styles.secondaryCta} cs-cta`} data-cta-on="theme" href="/prodavnice" data-cursor="button">
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
            <a
              className={`${styles.primaryCta} ${styles.finalPrimaryCta} cs-cta`}
              data-cta-fill="red"
              href="/prodavnice"
              data-cursor="button"
            >
              <span>Prodavnice u mreži</span>
            </a>
            <a className={`${styles.secondaryOnDark} cs-cta`} data-cta-on="dark" href="/katalog" data-cursor="button">
              Katalog proizvoda
            </a>
            <a className={`${styles.secondaryOnDark} cs-cta`} data-cta-on="dark" href="/b2b-saradnja" data-cursor="button">
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
  locating,
  selectedDistanceKm,
  showAllByDistance,
  selectedStore,
  selectedCity,
  locatorStatus,
  onCityChange,
  onLocationRequest,
}: {
  locating: boolean;
  selectedDistanceKm: number | null;
  showAllByDistance: boolean;
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
      <span className={styles.locatorTitle}>
        <span className={styles.locatorTitleFull}>Pronađite najbližu prodavnicu</span>
        <span className={styles.locatorTitleShort}>
          Pronađite prodavnicu
        </span>
      </span>
      {/* Bez izbora nema oznake ispod naslova (ranije „Mreža”). */}
      {selectedStore ? <small>{getPartnerCityLabel(selectedStore)}</small> : null}
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
          className={`${styles.locationButton} ${styles.locationButtonSecondary}`}
          onClick={onLocationRequest}
          aria-busy={locating || undefined}
          data-cursor="button"
        >
          <span className={styles.buttonIcon}>
            <IconLocation />
          </span>
          <span>{locating ? "Određujemo lokaciju…" : "Koristite svoju lokaciju"}</span>
        </button>
        <SearchableCombobox
          ariaLabel="Izaberite grad"
          disabled={cityEntries.length === 0}
          emptyMessage="Nema gradova koji odgovaraju pretrazi."
          onChange={onCityChange}
          options={locatorCityOptions}
          placeholder="Izaberite grad"
          searchPlaceholder="Pretražite grad"
          sheetTitle="Izaberite grad"
          value={selectedCity}
        />
        {/* Bez izbora nema unapred prikazane lokacije; prazan pregled samo kada mreža nema lokacija. */}
        {selectedStore || cityEntries.length === 0 ? (
          <StorePreview distanceKm={selectedDistanceKm} store={selectedStore} />
        ) : null}
        <p className={styles.locatorStatus}>{locatorStatus}</p>
        {showAllByDistance ? (
          <a className={styles.locatorAllLink} href="#prodavnice-mreza">
            Sve lokacije po udaljenosti
            <span aria-hidden="true">↓</span>
          </a>
        ) : null}
      </div>
    </aside>
  );
}

function phoneHref(phone: string) {
  return toTelHref(phone) ?? undefined;
}

function StorePreview({
  distanceKm = null,
  store,
}: {
  distanceKm?: number | null;
  store?: PartnerStore;
}) {
  if (!store) {
    return (
      <article className={styles.storePreview}>
        <span className={styles.availableDot} />
        <div>
          <header>
            <strong>Nema objavljenih lokacija</strong>
            <small>U pripremi</small>
          </header>
          <p>Potvrđene prodajne lokacije biće prikazane tek kada podaci budu uneti.</p>
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
        {distanceKm !== null ? (
          <span className={styles.storeDistance}>
            ≈ {formatDistanceKm(distanceKm)} <small>{distanceKindLabel("air")}</small>
          </span>
        ) : null}
      </div>
    </article>
  );
}

function StorePreviewList({
  byDistance,
  cityKey,
  cityLabel,
  onSelect,
  onShowAll,
  rankedStores,
  selectedId,
  totalCount,
}: {
  byDistance: boolean;
  cityKey: string;
  cityLabel: string;
  onSelect: (storeId: string) => void;
  onShowAll: () => void;
  rankedStores: RankedStore[];
  selectedId: string;
  totalCount: number;
}) {
  if (rankedStores.length === 0) return <StorePreview />;
  return (
    <StorePreviewListBody
      byDistance={byDistance}
      cityKey={cityKey}
      cityLabel={cityLabel}
      key={`${cityKey}-${byDistance}`}
      onSelect={onSelect}
      onShowAll={onShowAll}
      rankedStores={rankedStores}
      selectedId={selectedId}
      totalCount={totalCount}
    />
  );
}

/** Telefon: bez skrola unutar skrola (odluka 2026-10-15) — prve tri, pa „Prikažite još“ po deset. */
const PHONE_FIRST_STORES = 3;
const PHONE_MORE_STEP = 10;

function StorePreviewListBody({
  byDistance,
  cityKey,
  cityLabel,
  onSelect,
  onShowAll,
  rankedStores,
  selectedId,
  totalCount,
}: {
  byDistance: boolean;
  cityKey: string;
  cityLabel: string;
  onSelect: (storeId: string) => void;
  onShowAll: () => void;
  rankedStores: RankedStore[];
  selectedId: string;
  totalCount: number;
}) {
  const [phoneLimit, setPhoneLimit] = useState(PHONE_FIRST_STORES);
  const phoneRemaining = rankedStores.length - phoneLimit;

  // Broj uz vezu = broj lokacija na odredištu: /prodavnice?grad=<ključ> filtrira istim
  // ključem grada (getPartnerCityKey), a /prodavnice bez grada prikazuje sve javne lokacije.
  const moreHref = cityKey ? `/prodavnice?grad=${encodeURIComponent(cityKey)}` : "/prodavnice";

  return (
    <>
      <div className={styles.storeListHeader}>
        <span>
          {byDistance ? "Po udaljenosti" : "Lokacije"} · prikazano {rankedStores.length} od {totalCount}
          {cityLabel ? ` · ${cityLabel}` : ""}
        </span>
        {cityLabel ? (
          <button className={styles.storeListReset} onClick={onShowAll} type="button">
            Sve lokacije
          </button>
        ) : null}
      </div>
      {/* Cela lista je dostupna, ali u sopstvenom okviru, pa početna ne raste sa brojem lokacija. */}
      <div
        className={styles.storePreviewList}
        aria-label={byDistance ? "Lokacije poređane po udaljenosti" : "Lokacije u mreži"}
        role="list"
        tabIndex={0}
      >
        {rankedStores.map(({ store, distanceKm, kind }, index) => {
          const isActive = store.id === selectedId;

          return (
            <article
              className={styles.storePreviewItem}
              data-active={isActive || undefined}
              data-phone-hidden={index >= phoneLimit || undefined}
              id={`lokacija-${store.id}`}
              key={store.id}
              role="listitem"
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
                  {distanceKm !== null ? (
                    <span className={styles.storeDistance}>
                      ≈ {formatDistanceKm(distanceKm)} <small>{distanceKindLabel(kind)}</small>
                    </span>
                  ) : byDistance ? (
                    <span className={styles.storeDistance}>
                      <small>udaljenost nije dostupna</small>
                    </span>
                  ) : null}
                </span>
              </button>
              {store.phone ? (
                <a
                  aria-label={`Pozovite ${store.name}: ${store.phone}`}
                  className={styles.storePreviewPhone}
                  href={phoneHref(store.phone)}
                >
                  {store.phone}
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
      {phoneRemaining > 0 ? (
        <button
          className={styles.storePreviewShowMore}
          onClick={() => setPhoneLimit((limit) => limit + PHONE_MORE_STEP)}
          type="button"
        >
          Prikažite još {Math.min(PHONE_MORE_STEP, phoneRemaining)} (ukupno {rankedStores.length})
        </button>
      ) : null}
      <a className={styles.storePreviewMore} href={moreHref}>
        {cityKey ? `Sve lokacije u gradu (${rankedStores.length})` : `Lokator prodavnica (${totalCount})`}
        <span aria-hidden="true">→</span>
      </a>
    </>
  );
}
