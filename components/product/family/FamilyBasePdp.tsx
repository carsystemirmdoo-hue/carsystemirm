"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CustomerBuyPanel } from "@/components/customer-buy/CustomerBuyPanel";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { BackToResults } from "@/components/product/BackToResults";
import { useOptionalProductVariant } from "@/components/product/ProductVariantProvider";
import { ALL_PACKS, PACK_QUERY_PARAM, packSlug } from "@/components/product/variantPacks.mjs";
import { VARIANT_QUERY_PARAM } from "@/components/product/productVariantState.mjs";
import { srPlural } from "@/lib/sr-plural";
import type { FamilyBase, FamilyPackshot } from "./familyBaseTypes";
import styles from "./FamilyBasePdp.module.css";
// Raspored po širini (2026-10-22): desktop i telefon se uređuju u odvojenim fajlovima.
import desktop from "./FamilyBasePdp.desktop.module.css";
import mobile from "./FamilyBasePdp.mobile.module.css";

const layout = (name: "pdp" | "stageColumn" | "stage" | "filters" | "grid" | "pickerColumn" | "cardBody") =>
  [styles[name], desktop[name], mobile[name]].filter(Boolean).join(" ");

/**
 * Zajednički izbor porodice baza (2026-10-21). Baslac je uzor; R-M porodice koriste istu
 * komponentu: ista širina fotografije i zone izbora, ista pretraga, filter efekta, dugmad
 * zapremine, kartice (uzorak, šifra, naziv, zapremina, oznaka izbora), grupe po zapremini i
 * isti prikaz izabrane stavke. Brend se razlikuje samo akcentom i sadržajem.
 *
 * Dva modela izbora:
 *   - „slug“    (Baslac): svaka baza je svoj proizvod; komponenta sama upisuje `?varijanta=`;
 *   - „context“ (R-M):   baza je red kartice; izbor ide kroz `ProductVariantProvider`, koji
 *                        upisuje `?varijanta=` i iz kog panel kupovine čita tačan red.
 *
 * Fotografija prati IZABRANU bazu (njen sistem i zapreminu), ne grupu u vidnom polju.
 * Ulaz sa `?pakovanje=` (kartica zapremine u katalogu) odmah prikazuje tu zapreminu i bira
 * njenu prvu bazu; ulaz bez zapremine prikazuje „Sva pakovanja“.
 */
export function FamilyBasePdp({
  brand,
  brandLabel,
  eyebrow,
  familyName,
  systemName,
  intro,
  bases,
  packshots,
  fallbackPackshot,
  inquiryHref,
  swatchNote,
  stageNote,
  filterLabel = "Završnica",
  lineDocument,
  children,
}: {
  brand: "baslac" | "rm";
  brandLabel: string;
  eyebrow: string;
  familyName: string;
  systemName: string;
  intro: string;
  bases: FamilyBase[];
  /** Fotografija po zapremini (ključ = `volumeKey`). */
  packshots: Record<string, FamilyPackshot>;
  /** Kada za zapreminu nema fotografije: primer ambalaže sistema, uz natpis. */
  fallbackPackshot?: FamilyPackshot | null;
  inquiryHref: (base: FamilyBase) => string;
  swatchNote: string;
  stageNote: string;
  filterLabel?: string;
  lineDocument?: { href: string; title: string };
  children?: ReactNode;
}) {
  const variantContext = useOptionalProductVariant();
  const contextMode = Boolean(variantContext) && bases.some((base) => base.contextKey);

  const [activeCode, setActiveCode] = useState(bases[0]?.code ?? "");
  const [query, setQuery] = useState("");
  const [finish, setFinish] = useState("all");
  const [volumeChoice, setVolumeChoice] = useState<string | null>(ALL_PACKS);
  const searchId = useId();
  const finishId = useId();

  const finishes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const base of bases) if (!seen.has(base.finish)) seen.set(base.finish, base.finishLabel);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], "sr"));
  }, [bases]);

  /** Zapremine od najmanje, sa nazivom i brojem baza. */
  const volumes = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; litres: number; count: number; note?: string }>();
    for (const base of bases) {
      const entry = byKey.get(base.volumeKey) ?? { key: base.volumeKey, label: base.volumeLabel, litres: base.volumeL ?? Number.POSITIVE_INFINITY, count: 0, note: base.volumeNote };
      entry.count += 1;
      byKey.set(base.volumeKey, entry);
    }
    return [...byKey.values()].sort((a, b) => a.litres - b.litres);
  }, [bases]);

  const active = bases.find((item) => item.code === activeCode) ?? bases[0] ?? null;
  const volume = volumeChoice ?? (active && volumes.length > 1 ? active.volumeKey : ALL_PACKS);

  const visible = useMemo(
    () =>
      bases.filter(
        (item) =>
          matchesQuery(item, query) &&
          (finish === "all" || item.finish === finish) &&
          (volume === ALL_PACKS || item.volumeKey === volume),
      ),
    [bases, query, finish, volume],
  );

  /** „Sva pakovanja“: grupe po zapremini, od najveće, samo one koje postoje. */
  const visibleGroups = useMemo(() => {
    if (volume !== ALL_PACKS) return [{ key: volume, label: null as string | null, items: visible }];
    return [...volumes]
      .reverse()
      .map((entry) => ({ key: entry.key, label: entry.label, items: visible.filter((item) => item.volumeKey === entry.key) }))
      .filter((group) => group.items.length > 0);
  }, [visible, volume, volumes]);

  /** Izbor baze menja adresu zamenom, bez novog koraka istorije. */
  const selectBase = useCallback(
    (code: string) => {
      const base = bases.find((item) => item.code === code);
      if (!base) return;
      setActiveCode(code);
      if (contextMode && variantContext && base.contextKey) {
        const view = variantContext.findVariant(base.contextKey);
        if (view) variantContext.selectVariant(view, false);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set(VARIANT_QUERY_PARAM, base.queryValue);
      window.history.replaceState({ [VARIANT_QUERY_PARAM]: base.queryValue }, "", url);
    },
    [bases, contextMode, variantContext],
  );

  const writePack = useCallback((next: string) => {
    const url = new URL(window.location.href);
    const value = next === ALL_PACKS ? ALL_PACKS : packSlug(volumes.find((entry) => entry.key === next)?.label ?? next);
    url.searchParams.set(PACK_QUERY_PARAM, value);
    window.history.replaceState({ ...(window.history.state ?? {}), [PACK_QUERY_PARAM]: value }, "", url);
  }, [volumes]);

  const chooseVolume = useCallback(
    (next: string) => {
      setVolumeChoice(next);
      writePack(next);
      // Zapremina i izabrana baza moraju se poklapati: prelazak bira prvu bazu te zapremine.
      if (next !== ALL_PACKS && active?.volumeKey !== next) {
        const first =
          bases.find((item) => item.volumeKey === next && matchesQuery(item, query) && (finish === "all" || item.finish === finish)) ??
          bases.find((item) => item.volumeKey === next);
        if (first) selectBase(first.code);
      }
    },
    [active, bases, finish, query, selectBase, writePack],
  );

  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get(VARIANT_QUERY_PARAM);
      const requestedPack = params.get(PACK_QUERY_PARAM);
      const resolved = requested ? findBase(bases, requested) : null;
      const pack = volumes.find((entry) => packSlug(entry.label) === requestedPack);
      if (resolved) setActiveCode(resolved.code);
      else if (pack) {
        // Ulaz sa kartice zapremine: odmah ta zapremina i njena prva baza.
        const first = bases.find((item) => item.volumeKey === pack.key);
        if (first) selectBase(first.code);
      } else setActiveCode(bases[0]?.code ?? "");
      setVolumeChoice(requestedPack === ALL_PACKS ? ALL_PACKS : pack ? pack.key : resolved ? null : ALL_PACKS);
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bases, volumes]);

  const packshot = active ? packshots[active.volumeKey] ?? null : null;
  const stageImage = packshot ?? fallbackPackshot ?? null;

  return (
    <div className={layout("pdp")} data-brand={brand}>
      <header className={styles.pageHeader}>
        <BackToResults className={styles.backToResults} />
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{familyName}</h1>
        <p className={styles.lead}>{intro}</p>
      </header>

      {/* Leva strana — stabilna fotografija; prati sistem i zapreminu IZABRANE baze. */}
      <div className={layout("stageColumn")}>
        <div className={layout("stage")} data-pending={stageImage ? undefined : "true"} data-example={!packshot && stageImage ? "line" : undefined}>
          {stageImage ? (
            <figure className={styles.lineExample}>
              <Image
                key={stageImage.src}
                src={stageImage.src}
                alt={stageImage.alt}
                width={520}
                height={680}
                priority
                sizes="(max-width: 60rem) 70vw, 26rem"
              />
              {stageImage.note ? <figcaption>{stageImage.note}</figcaption> : null}
            </figure>
          ) : (
            <div className={styles.stagePlaceholder}>
              <span aria-hidden="true">{brandLabel}</span>
              <strong>{systemName}</strong>
              <strong>{active?.volumeLabel}</strong>
              <p>Zvanična fotografija ambalaže za ovo pakovanje nije pronađena.</p>
            </div>
          )}
          <div className={styles.stageMeta}>
            <span className={styles.brandMark}>{brandLabel}</span>
            <span className={styles.volumeMark}>{active?.volumeLabel}</span>
          </div>
        </div>
        <p className={styles.stageNote}>{stageNote}</p>
      </div>

      {/* Desna strana — sve baze odmah, bez međukoraka. */}
      <div className={layout("pickerColumn")}>
        <header className={styles.pickerHeader}>
          <p className={styles.kicker}>{systemName}</p>
          <h2>Dostupne baze</h2>
        </header>

        <div className={layout("filters")}>
          <div className={styles.field}>
            <label htmlFor={searchId}>Pretraga po šifri ili nazivu</label>
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder={bases[0] ? `npr. ${bases[0].code}, ${bases[0].code.replace(/[-\s]/g, "")}` : "npr. šifra ili naziv"}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={finishId}>{filterLabel}</label>
            <SearchableCombobox
              id={finishId}
              ariaLabel={filterLabel}
              emptyMessage="Nema vrednosti"
              placeholder="Sve"
              searchable={false}
              value={finish}
              onChange={setFinish}
              options={[{ value: "all", label: "Sve" }, ...finishes.map(([value, label]) => ({ value, label }))]}
            />
          </div>
        </div>

        {volumes.length > 1 ? (
          <div className={styles.packSwitch} role="group" aria-label="Pakovanje">
            <span className={styles.packSwitchLabel}>Pakovanje</span>
            <div className={styles.packSwitchOptions}>
              {volumes.map((entry) => (
                <button
                  type="button"
                  key={entry.key}
                  aria-pressed={volume === entry.key}
                  data-selected={volume === entry.key || undefined}
                  onClick={() => chooseVolume(entry.key)}
                >
                  {entry.label}
                  {entry.note ? <span className={styles.packSwitchNote}>{entry.note}</span> : null}
                  <small>{entry.count}</small>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={volume === ALL_PACKS}
                data-selected={volume === ALL_PACKS || undefined}
                onClick={() => chooseVolume(ALL_PACKS)}
              >
                Sva pakovanja
                <small>{bases.length}</small>
              </button>
            </div>
          </div>
        ) : null}

        <p className={styles.count} aria-live="polite">
          {srPlural(visible.length, "Prikazana", "Prikazane", "Prikazano")} {visible.length} od {bases.length}{" "}
          {srPlural(bases.length, "baze", "baze", "baza")}
        </p>

        {visibleGroups.map((group) => (
          <section className={styles.volumeGroup} key={group.key} aria-label={group.label ? `Pakovanje ${group.label}` : undefined}>
            {group.label ? (
              <h3 className={styles.volumeGroupTitle}>
                {group.label}
                <small>{group.items.length}</small>
              </h3>
            ) : null}
            <ul className={layout("grid")}>
              {group.items.map((item) => {
                const isActive = item.code === active?.code;
                return (
                  <li key={item.code}>
                    <button
                      type="button"
                      className={styles.card}
                      data-active={isActive || undefined}
                      aria-pressed={isActive}
                      onClick={() => {
                        selectBase(item.code);
                        // „Sva pakovanja“ ostaje i posle izbora baze i povratka „Nazad“.
                        if (volume === ALL_PACKS) writePack(ALL_PACKS);
                      }}
                    >
                      <span
                        className={styles.swatch}
                        data-finish={item.swatchPattern}
                        style={item.swatch ? { backgroundColor: item.swatch } : undefined}
                        aria-hidden="true"
                      />
                      <span className={layout("cardBody")}>
                        <strong>{item.code}</strong>
                        {item.name ? <span className={styles.cardName}>{item.name}</span> : null}
                        <small>
                          {item.packLabel} · {item.finishLabel}
                        </small>
                      </span>
                      {isActive ? (
                        <span className={styles.activeTick} aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {visible.length === 0 ? <p className={styles.empty}>Nema baza koje odgovaraju izabranim filterima.</p> : null}

        {active ? (
          <div className={styles.activePanel}>
            <div className={styles.activeInfo}>
              <p className={styles.kicker}>Izabrana baza</p>
              <h3>
                {active.code}
                {active.name ? ` · ${active.name}` : ""}
              </h3>
              <p className={styles.activeMeta}>
                {active.packLabel} · {active.finishLabel}
              </p>
              <p className={styles.availability}>Dostupnost se potvrđuje</p>
            </div>
            <div className={styles.activeActions}>
              <Link className={styles.inquiryButton} href={inquiryHref(active)}>
                Pošaljite upit
                <span aria-hidden="true">↗</span>
              </Link>
              <p className={styles.inquiryNote}>Dostupnost, pakovanje i uslove potvrđujemo odgovorom na upit.</p>
            </div>
          </div>
        ) : null}
        {/* Prijavljeni kupac: kupovina tačne baze i pakovanja (potvrđena veza, cena, korpa). */}
        {active ? <CustomerBuyPanel key={active.code} fallbackSlug={active.buySlug} fallbackName={active.buyName} /> : null}

        <p className={styles.swatchNote}>{swatchNote}</p>

        {lineDocument ? (
          <section className={styles.documents} aria-labelledby={`${searchId}-dokumentacija`}>
            <h3 id={`${searchId}-dokumentacija`} className={styles.kicker}>
              Dokumentacija
            </h3>
            <a href={lineDocument.href} target="_blank" rel="noopener">
              {lineDocument.title}
              <small>PDF · {brandLabel}</small>
            </a>
          </section>
        ) : null}

        {children ? <div className={styles.belowPicker}>{children}</div> : null}
      </div>
    </div>
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s-]/g, "");
}

function matchesQuery(item: FamilyBase, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const compact = normalize(needle);
  return item.searchTerms.some((term) => term.toLowerCase().includes(needle) || normalize(term).includes(compact));
}

/** `?varijanta=` → baza: tačna vrednost, pa šifra bez razmaka i crtica („35M1140“, „BC+101“). */
function findBase(bases: FamilyBase[], requested: string) {
  const wanted = normalize(requested);
  return bases.find((base) => base.queryValue === requested || normalize(base.code) === wanted || normalize(base.queryValue) === wanted) ?? null;
}
