"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  baslacAssetSlot,
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
}: {
  familyName: string;
  system: BaslacSystemId;
  systemName: string;
  intro: string;
}) {
  const bases = useMemo(() => baslacPublicBases(system), [system]);

  const [activeCode, setActiveCode] = useState(bases[0]?.code ?? "");
  const [query, setQuery] = useState("");
  const [finish, setFinish] = useState<BaslacFinish | "all">("all");
  const [volume, setVolume] = useState("all");

  const searchId = useId();
  const finishId = useId();
  const volumeId = useId();

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

  const visible = useMemo(
    () =>
      bases.filter(
        (item) =>
          baslacMatchesQuery(item, query) &&
          (finish === "all" || item.finish === finish) &&
          (volume === "all" || String(item.volumeL) === volume),
      ),
    [bases, query, finish, volume],
  );

  const active = bases.find((item) => item.code === activeCode) ?? bases[0] ?? null;

  /** Izbor varijante menja URL bez reloada; Back/Forward prati izbor. */
  const selectVariant = useCallback(
    (code: string, push = true) => {
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
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [bases]);

  const packshot = packshotFor(active, system);
  /*
   * Bez slike tačne zapremine prikazuje se primer ambalaže LINIJE (generička limenka bez šifre
   * nijanse), uz natpis da ne prikazuje izabranu nijansu ni zapreminu.
   */
  const lineExample = packshot ? null : baslacLineExamplePackshot(system);


  return (
    <div className={styles.pdp}>
      <header className={styles.pageHeader}>
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
            <select
              id={finishId}
              value={finish}
              onChange={(event) => setFinish(event.target.value as BaslacFinish | "all")}
            >
              <option value="all">Sve završnice</option>
              {finishes.map((value) => (
                <option key={value} value={value}>
                  {baslacFinishLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={volumeId}>Pakovanje</label>
            <select
              id={volumeId}
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
            >
              <option value="all">Sva pakovanja</option>
              {volumes.map((value) => (
                <option key={value} value={String(value)}>
                  {volumeText(value)}
                  {value === 0.1 ? " · koncentrat" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className={styles.count} aria-live="polite">
          Prikazano {visible.length} od {bases.length} baza
        </p>

        <ul className={styles.grid}>
          {visible.map((item) => {
            const isActive = item.code === active?.code;
            return (
              <li key={item.code}>
                <button
                  type="button"
                  className={styles.card}
                  data-active={isActive || undefined}
                  aria-pressed={isActive}
                  onClick={() => selectVariant(item.code)}
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
          {visible.length === 0 ? (
            <li className={styles.empty}>
              Nema baza koje odgovaraju izabranim filterima.
            </li>
          ) : null}
        </ul>

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


        <p className={styles.swatchNote}>
          Prikazani kvadratić boje predstavlja orijentacionu grupu pigmenta, a ne
          garantovanu automobilsku nijansu.
        </p>
      </div>

    </div>
  );
}
