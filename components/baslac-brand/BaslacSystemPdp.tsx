"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  baslacAssetSlot,
  baslacBaseSlug,
  baslacFinishLabels,
  baslacLineExamplePackshot,
  baslacMatchesQuery,
  baslacPublicBases,
  type BaslacBase,
  type BaslacFinish,
  type BaslacSystemId,
} from "@/lib/baslac-systems";
import {
  VARIANT_QUERY_PARAM,
  baslacVariantQueryValue,
  resolveBaslacBase,
} from "./baslacVariantState.mjs";
import { CustomerBuyPanel } from "@/components/customer-buy/CustomerBuyPanel";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { BackToResults } from "@/components/product/BackToResults";
import { ALL_PACKS, PACK_QUERY_PARAM, packSlug } from "@/components/product/variantPacks.mjs";
import { srPlural } from "@/lib/sr-plural";
import styles from "./BaslacSystemPdp.module.css";


function volumeText(volumeL: number | null) {
  return volumeL === null ? "Na upit" : `${String(volumeL).replace(".", ",")} L`;
}

/**
 * Slika prati zapreminu AKTIVNE varijante. Bez fallbacka na drugu zapreminu —
 * limenka od 3,5 L ne sme stajati dok je izabrana baza od 1 L.
 */
function packshotFor(base: BaslacBase | null, system: BaslacSystemId) {
  if (!base) return null;
  return baslacAssetSlot(system, base.volumeL)?.src ?? null;
}


export function BaslacSystemPdp({
  familyName,
  system,
  systemName,
  intro,
  lineDocument,
}: {
  familyName: string;
  system: BaslacSystemId;
  systemName: string;
  intro: string;
  lineDocument?: { href: string; title: string };
}) {
  const bases = useMemo(() => baslacPublicBases(system), [system]);

  const [activeCode, setActiveCode] = useState(bases[0]?.code ?? "");
  const [query, setQuery] = useState("");
  const [finish, setFinish] = useState<BaslacFinish | "all">("all");
  /*
   * Zapremina (2026-10-20): `null` = prati aktivnu bazu (iz `?varijanta=` ili
   * kartice sa koje je korisnik došao); „sva“ = sve zapremine u grupama.
   * Izbor se čuva u `?pakovanje=` zamenom adrese, bez novog koraka istorije.
   */
  const [volumeChoice, setVolumeChoice] = useState<string | null>(ALL_PACKS);

  const searchId = useId();
  const finishId = useId();

  const finishes = useMemo(
    () => Array.from(new Set(bases.map((item) => item.finish))).sort(),
    [bases],
  );
  const volumes = useMemo(
    () =>
      Array.from(
        new Set(
          bases
            .map((item) => item.volumeL)
            .filter((value): value is number => value !== null),
        ),
      ).sort((a, b) => a - b),
    [bases],
  );

  const volumeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of bases) {
      if (item.volumeL === null) continue;
      counts.set(String(item.volumeL), (counts.get(String(item.volumeL)) ?? 0) + 1);
    }
    return counts;
  }, [bases]);

  const active = bases.find((item) => item.code === activeCode) ?? bases[0] ?? null;
  const volume =
    volumeChoice ?? (active?.volumeL != null && volumes.length > 1 ? String(active.volumeL) : ALL_PACKS);

  const visible = useMemo(
    () =>
      bases.filter(
        (item) =>
          baslacMatchesQuery(item, query) &&
          (finish === "all" || item.finish === finish) &&
          (volume === ALL_PACKS || String(item.volumeL) === volume),
      ),
    [bases, query, finish, volume],
  );

  /** „Sva pakovanja“: grupe po zapremini, od najveće, samo one koje postoje. */
  const visibleGroups = useMemo(() => {
    if (volume !== ALL_PACKS) return [{ key: volume, label: null as string | null, items: visible }];
    const byVolume = new Map<string, BaslacBase[]>();
    for (const item of visible) {
      const key = item.volumeL === null ? "upit" : String(item.volumeL);
      byVolume.set(key, [...(byVolume.get(key) ?? []), item]);
    }
    return [...byVolume.entries()]
      .sort(([a], [b]) => (b === "upit" ? -1 : a === "upit" ? 1 : Number(b) - Number(a)))
      .map(([key, items]) => ({
        key,
        label: key === "upit" ? "Pakovanje na upit" : volumeText(Number(key)),
        items,
      }));
  }, [visible, volume]);

  /**
   * Izbor baze menja URL bez reloada i BEZ novog koraka istorije (2026-10-20):
   * posle pregledanih deset baza jedan „Nazad“ vraća na prethodnu stranicu.
   * Direktan link `?varijanta=` i dalje otvara izabranu bazu.
   */
  const selectVariant = useCallback(
    (code: string, push = false) => {
      setActiveCode(code);
      const url = new URL(window.location.href);
      const value = baslacVariantQueryValue(
        bases.find((item) => item.code === code) ?? null,
      );
      url.searchParams.set(VARIANT_QUERY_PARAM, value);
      const state = { [VARIANT_QUERY_PARAM]: value };
      if (push) window.history.pushState(state, "", url);
      else window.history.replaceState(state, "", url);
    },
    [bases],
  );

  useEffect(() => {
    const apply = () => {
      /*
       * Razresavanje ide kroz `resolveBaslacBase`, koji deli pravilo sa
       * `ProductVariantProvider`: trazena → pocetna → prva.
       *
       * Kljucna razlika u odnosu na raniju verziju: kada „Nazad" ukloni
       * `?varijanta=`, stanje se VRACA na pocetnu bazu umesto da ostane na
       * prethodno izabranoj. Adresa i prikaz se vise ne mogu razici.
       */
      const requested = new URLSearchParams(window.location.search).get(
        VARIANT_QUERY_PARAM,
      );
      const resolved = resolveBaslacBase(bases, requested, bases[0]?.code);
      if (resolved) setActiveCode(resolved.code);
      const requestedPack = new URLSearchParams(window.location.search).get(PACK_QUERY_PARAM);
      const packVolume = volumes.find((value) => packSlug(volumeText(value)) === requestedPack);
      /*
       * Ulaz bez `?varijanta=` i bez `?pakovanje=` (kartica porodice u katalogu, meni,
       * brend stranica) nema svoju zapreminu: prikazuju se SVA pakovanja u grupama.
       * Ulaz sa baze (pretraga, kartica zapremine) prati zapreminu te baze.
       */
      setVolumeChoice(
        requestedPack === ALL_PACKS
          ? ALL_PACKS
          : packVolume != null
            ? String(packVolume)
            : requested
              ? null
              : ALL_PACKS,
      );
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [bases, volumes]);

  function chooseVolume(next: string) {
    setVolumeChoice(next);
    const url = new URL(window.location.href);
    const value = next === ALL_PACKS ? ALL_PACKS : packSlug(volumeText(Number(next)));
    url.searchParams.set(PACK_QUERY_PARAM, value);
    window.history.replaceState({ [PACK_QUERY_PARAM]: value }, "", url);
    // Zapremina i izabrana baza moraju se poklapati.
    if (next !== ALL_PACKS && String(active?.volumeL) !== next) {
      const first = bases.find(
        (item) =>
          String(item.volumeL) === next &&
          baslacMatchesQuery(item, query) &&
          (finish === "all" || item.finish === finish),
      ) ?? bases.find((item) => String(item.volumeL) === next);
      if (first) selectVariant(first.code);
    }
  }

  const packshot = packshotFor(active, system);
  /*
   * Bez slike tačne zapremine prikazuje se primer ambalaže LINIJE (generička limenka bez šifre
   * nijanse), uz natpis da ne prikazuje izabranu nijansu ni zapreminu.
   */
  const lineExample = packshot ? null : baslacLineExamplePackshot(system);


  return (
    <div className={styles.pdp}>
      <header className={styles.pageHeader}>
        <BackToResults className={styles.backToResults} />
        <p className={styles.eyebrow}>Baslac sistem boja</p>
        <h1>{familyName}</h1>
        <p className={styles.lead}>{intro}</p>
      </header>

      {/* Leva strana — stabilan image stage, slika prati zapreminu. */}
      <div className={styles.stageColumn}>
        <div className={styles.stage} data-pending={packshot || lineExample ? undefined : "true"} data-example={lineExample ? "line" : undefined}>
          {packshot ? (
            <Image
              src={packshot}
              alt={`Baslac ${systemName} ambalaža ${volumeText(active?.volumeL ?? null)}`}
              width={520}
              height={680}
              priority
              sizes="(max-width: 60rem) 70vw, 26rem"
            />
          ) : lineExample ? (
            <figure className={styles.lineExample}>
              <Image
                src={lineExample.src}
                alt={lineExample.alt}
                width={520}
                height={680}
                priority
                sizes="(max-width: 60rem) 70vw, 26rem"
              />
              <figcaption>
                Primer ambalaže linije — ne prikazuje izabranu nijansu ni zapreminu.
              </figcaption>
            </figure>
          ) : (
            <div className={styles.stagePlaceholder}>
              <span aria-hidden="true">Baslac</span>
              <strong>{systemName}</strong>
              <strong>{volumeText(active?.volumeL ?? null)}</strong>
              <p>Zvanična fotografija ambalaže za ovo pakovanje je u pripremi.</p>
            </div>
          )}
          <div className={styles.stageMeta}>
            <span className={styles.brandMark}>Baslac</span>
            <span className={styles.volumeMark}>
              {volumeText(active?.volumeL ?? null)}
            </span>
          </div>
        </div>
        <p className={styles.stageNote}>
          Jedna ambalaža po sistemu i pakovanju. Baze se razlikuju šifrom,
          nijansom i završnicom, ne limenkom.
        </p>
      </div>

      {/* Desna strana — sve baze odmah, bez međukoraka. */}
      <div className={styles.pickerColumn}>
        <header className={styles.pickerHeader}>
          <p className={styles.kicker}>{systemName}</p>
          <h2>Dostupne baze</h2>
        </header>

        <div className={styles.filters}>
          <div className={styles.field}>
            <label htmlFor={searchId}>Pretraga po šifri ili nazivu</label>
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder={
                bases[0]
                  ? `npr. ${bases[0].code}, ${bases[0].code.replace(/-/g, "")}`
                  : "npr. šifra ili naziv"
              }
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={finishId}>Završnica</label>
            <SearchableCombobox
              id={finishId}
              ariaLabel="Završnica"
              emptyMessage="Nema završnica"
              placeholder="Sve završnice"
              searchable={false}
              value={finish}
              onChange={(next) => setFinish(next as BaslacFinish | "all")}
              options={[
                { value: "all", label: "Sve završnice" },
                ...finishes.map((value) => ({ value, label: baslacFinishLabels[value] })),
              ]}
            />
          </div>
        </div>

        {volumes.length > 1 ? (
          <div className={styles.packSwitch} role="group" aria-label="Pakovanje">
            <span className={styles.packSwitchLabel}>Pakovanje</span>
            <div className={styles.packSwitchOptions}>
              {volumes.map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={volume === String(value)}
                  data-selected={volume === String(value) || undefined}
                  onClick={() => chooseVolume(String(value))}
                >
                  {volumeText(value)}
                  {value === 0.1 ? <span className={styles.packSwitchNote}>koncentrat</span> : null}
                  <small>{volumeCounts.get(String(value)) ?? 0}</small>
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
          {srPlural(visible.length, "Prikazana", "Prikazane", "Prikazano")}{" "}
          {visible.length} od {bases.length}{" "}
          {srPlural(bases.length, "baze", "baze", "baza")}
        </p>

        {visibleGroups.map((group) => (
          <section
            className={styles.volumeGroup}
            key={group.key}
            aria-label={group.label ? `Pakovanje ${group.label}` : undefined}
          >
            {group.label ? (
              <h3 className={styles.volumeGroupTitle}>
                {group.label}
                <small>{group.items.length}</small>
              </h3>
            ) : null}
            <ul className={styles.grid}>
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
                        selectVariant(item.code);
                        // „Sva pakovanja“ ostaje i posle izbora baze i povratka „Nazad“.
                        if (volume === ALL_PACKS) chooseVolume(ALL_PACKS);
                      }}
                    >
                      <span
                        className={styles.swatch}
                        data-finish={item.finish}
                        style={{ background: item.swatch }}
                        aria-hidden="true"
                      />
                      <span className={styles.cardBody}>
                        <strong>{item.code}</strong>
                        <span className={styles.cardName}>{item.name}</span>
                        <small>
                          {volumeText(item.volumeL)} · {baslacFinishLabels[item.finish]}
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
        {visible.length === 0 ? (
          <p className={styles.empty}>Nema baza koje odgovaraju izabranim filterima.</p>
        ) : null}

        {active ? (
          <div className={styles.activePanel}>
            <div className={styles.activeInfo}>
              <p className={styles.kicker}>Izabrana baza</p>
              <h3>
                {active.code} · {active.name}
              </h3>
              <p className={styles.activeMeta}>
                {volumeText(active.volumeL)} · {baslacFinishLabels[active.finish]}
              </p>
              <p className={styles.availability}>Dostupnost se potvrđuje</p>
            </div>
            <div className={styles.activeActions}>
              <Link
                className={styles.inquiryButton}
                href={`/kontakt?tema=proizvod&brend=baslac&sistem=${encodeURIComponent(
                  systemName,
                )}&sifra=${encodeURIComponent(active.code)}`}
              >
                Pošaljite upit
                <span aria-hidden="true">↗</span>
              </Link>
              <p className={styles.inquiryNote}>
                Dostupnost, pakovanje i uslove potvrđujemo odgovorom na upit.
              </p>
            </div>
          </div>
        ) : null}
        {/* Prijavljeni kupac: ista kupovina kao na strani proizvoda (potvrđena veza baze, cena, pakovanje). */}
        {active ? <CustomerBuyPanel key={active.code} fallbackSlug={baslacBaseSlug(active)} fallbackName={`${active.code} · ${active.name}`} /> : null}


        <p className={styles.swatchNote}>
          Prikazani kvadratić boje predstavlja orijentacionu grupu pigmenta, a ne
          garantovanu automobilsku nijansu.
        </p>

        {lineDocument ? (
          <section className={styles.documents} aria-labelledby={`${searchId}-dokumentacija`}>
            <h3 id={`${searchId}-dokumentacija`} className={styles.kicker}>
              Dokumentacija
            </h3>
            <a href={lineDocument.href} target="_blank" rel="noopener">
              Tehnički list sistema — {lineDocument.title}
              <small>PDF · engleski · baslac</small>
            </a>
          </section>
        ) : null}
      </div>

    </div>
  );
}
