"use client";

/**
 * Zajednički panel pretrage — jedini search UI na javnom sajtu.
 *
 * Otvaraju ga lupa u Headeru, „Pretražite proizvode" na Homepage-u i prečica
 * `Cmd/Ctrl + K`. Ne pravi sopstvenu pretragu: koristi isti indeks, isti engine
 * i isti keš kao `/katalog?q=`, pa se rezultat u panelu i rezultat u katalogu ne
 * mogu razići.
 *
 * Panel je namerno lista GRUPA, ne ravna lista zapisa: sa 715 varijanti bi upit
 * „molotow burner chrome" u Headeru bio deset skoro identičnih redova. Grupisanje
 * je čisto prikazno — „Prikaži sve rezultate" vodi na katalog gde su sve
 * varijante pojedinačno vidljive.
 */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useProductSearch } from "@/components/search/useProductSearch";
import type { ProductSearchRecord } from "@/lib/search/buildSearchIndex";
import type { ProductSearchResult } from "@/lib/search/productSearchClient";
import styles from "./ProductSearchDialog.module.css";

const MAX_GROUPS = 8;
const MAX_MEMBERS = 3;
const MAX_QUERY_LENGTH = 80;

type SearchRow = {
  key: string;
  record: ProductSearchRecord;
  level: "header" | "member";
  memberTotal: number;
  headerMatched: boolean;
};

const KIND_LABEL: Record<ProductSearchRecord["kind"], string> = {
  family: "Proizvod",
  standalone: "Proizvod",
  variant: "Varijanta",
};

/**
 * Redovi za prikaz i za tastaturu, iz jednog izvora.
 *
 * Bitno je da su to isti podaci: strelice se kreću tačno kroz ono što se vidi,
 * pa `aria-activedescendant` uvek pokazuje na postojeći element.
 */
function toRows(result: ProductSearchResult | null): SearchRow[] {
  if (!result) return [];

  const rows: SearchRow[] = [];
  for (const group of result.groups) {
    const header = result.recordAt(group.headerIndex);
    if (!header) continue;

    rows.push({
      key: `h:${header.id}`,
      record: header,
      level: "header",
      memberTotal: group.memberTotal,
      headerMatched: group.headerMatched,
    });

    for (const memberIndex of group.memberIndices) {
      const member = result.recordAt(memberIndex);
      if (!member || member.id === header.id) continue;
      rows.push({
        key: `m:${member.id}`,
        record: member,
        level: "member",
        memberTotal: 0,
        headerMatched: true,
      });
    }
  }
  return rows;
}

function ResultLine({
  record,
  level,
  memberTotal,
}: {
  record: ProductSearchRecord;
  level: SearchRow["level"];
  memberTotal: number;
}) {
  /*
   * Duga interna šifra se ne prikazuje — isto pravilo koje katalog primenjuje
   * kroz `shortCode` (`lib/catalog-listing.ts`). `CL-MOLOTOW-BURNER-400-ML-…`
   * bi pojeo ceo red i istisnuo pakovanje, koje je ono po čemu korisnik zapravo
   * bira varijantu. Pretraga po toj šifri i dalje radi; samo se ne ispisuje.
   */
  const code =
    record.productCode && record.productCode.length <= 24 ? record.productCode : null;

  const meta = [
    record.brandName,
    code,
    level === "member" ? record.quantityLabel ?? record.technicalLine : record.technicalLine,
  ].filter((value): value is string => Boolean(value));

  return (
    <>
      <span className={styles.thumb} aria-hidden="true">
        {record.imageSrc ? (
          <Image src={record.imageSrc} alt="" width={44} height={44} sizes="44px" />
        ) : (
          <span className={styles.thumbFallback} />
        )}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>
          {level === "member" && record.variantName ? record.variantName : record.name}
        </span>
        <span className={styles.rowMeta}>
          {meta.map((value, position) => (
            <span key={`${value}-${position}`}>{value}</span>
          ))}
        </span>
      </span>
      {/*
        Vrsta i broj varijanti dele JEDNU kolonu: kao dva odvojena grid deteta
        bi drugi upao u nov red mreže i podigao visinu svakog reda rezultata.
      */}
      <span className={styles.rowAside}>
        <span className={styles.rowKind}>{KIND_LABEL[record.kind]}</span>
        {memberTotal > 0 ? (
          <span className={styles.rowCount}>
            {memberTotal} {memberTotal === 1 ? "varijanta" : "varijanti"}
          </span>
        ) : null}
      </span>
    </>
  );
}

export function ProductSearchDialog({
  open,
  onClose,
  returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  /** Kontrola koja je otvorila panel — fokus se vraća baš na nju. */
  returnFocusTo: HTMLElement | null;
}) {
  const router = useRouter();
  const dialogId = useId();
  const listId = `${dialogId}-list`;
  const inputId = `${dialogId}-input`;

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { status, result, retry } = useProductSearch(query, {
    enabled: open,
    limit: 60,
    group: true,
    maxGroups: MAX_GROUPS,
    maxMembers: MAX_MEMBERS,
  });

  const rows = useMemo(() => toRows(result), [result]);
  const trimmed = query.trim();
  /** Prekratak upit ne pokreće pretragu i ne nudi prelaz na katalog. */
  const tooShort = status === "too-short";
  const catalogHref = `/katalog?q=${encodeURIComponent(trimmed)}`;
  /** Poslednji red je uvek „Prikaži sve" — i za miš i za tastaturu. */
  const rowCount = rows.length > 0 ? rows.length + 1 : 0;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmed]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  /*
   * Zaključavanje skrola + vraćanje fokusa. Isti obrazac koji Header već koristi
   * za mobilnu navigaciju (`components/layout/Header.tsx`): sačuvaj prethodne
   * vrednosti, nadomesti širinu scrollbar-a da se sadržaj ne pomeri, i vrati sve
   * u cleanup-u — uključujući fokus na kontrolu koja je panel otvorila.
   */
  useEffect(() => {
    /*
     * `mounted` je uslov, ne detalj: portal se crta tek posle prvog rendera, pa
     * u prvom prolazu `inputRef` još ne postoji. Bez ovog uslova bi fokus zavisio
     * od trke između `requestAnimationFrame` i React-ovog re-rendera — a ta trka
     * se gubila baš na `Cmd/Ctrl + K` putanji, gde panel nastaje iz native
     * listenera, pa je polje ostajalo bez fokusa.
     */
    if (!open || !mounted) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    /*
     * Fokus se postavlja odmah, ne kroz `requestAnimationFrame`: `mounted` već
     * garantuje da polje postoji, a rAF se ne izvršava u pozadinskom tabu — pa
     * bi otvaranje pretrage u neaktivnom tabu ostalo bez fokusa sve dok se tab
     * ne vrati u prvi plan.
     */
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      returnFocusTo?.focus();
    };
  }, [mounted, open, returnFocusTo]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  /** Aktivan red uvek ostaje u vidnom polju pri kretanju strelicama. */
  useEffect(() => {
    if (!open || rowCount === 0) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, rowCount]);

  function openRow(index: number) {
    if (index >= rows.length) {
      router.push(catalogHref);
      close();
      return;
    }
    const row = rows[index];
    if (!row) return;
    router.push(row.record.href);
    close();
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (rowCount > 0) setActiveIndex((current) => (current + 1) % rowCount);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (rowCount > 0) setActiveIndex((current) => (current - 1 + rowCount) % rowCount);
      return;
    }
    if (event.key === "Home" && rowCount > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && rowCount > 0) {
      event.preventDefault();
      setActiveIndex(rowCount - 1);
      return;
    }
    if (event.key === "Enter") {
      if (!trimmed) return;
      event.preventDefault();
      /*
       * Enter na jednom znaku ne vodi nikuda: katalog bi otvorio `?q=c` i
       * prikazao prazan rezultat po istom pravilu, pa bi korisnik izgubio panel
       * i dobio stranicu bez ijednog proizvoda. Poruka u panelu je koristan
       * odgovor; navigacija nije.
       */
      if (tooShort) return;
      if (rowCount === 0) {
        router.push(catalogHref);
        close();
        return;
      }
      openRow(activeIndex);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  if (!mounted || !open) return null;

  const showEmpty = trimmed !== "" && status === "ready" && rows.length === 0;
  const isLoadingIndex = status === "loading" || status === "slow";
  const activeRowId = rowCount > 0 ? `${listId}-option-${activeIndex}` : undefined;

  const statusMessage = (() => {
    if (!trimmed) return "";
    if (tooShort) return "Unesite najmanje 2 znaka za pretragu.";
    if (isLoadingIndex) return "Učitavamo pretragu proizvoda.";
    if (status === "error") return "Pretraga trenutno nije dostupna.";
    if (showEmpty) return "Nema rezultata za uneti upit.";
    if (result) {
      return `${result.total} ${result.total === 1 ? "rezultat" : "rezultata"} za „${trimmed}".`;
    }
    return "";
  })();

  return createPortal(
    <div className={styles.layer}>
      <button
        className={styles.scrim}
        type="button"
        tabIndex={-1}
        aria-label="Zatvorite pretragu"
        onClick={close}
      />

      <div
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pretraga proizvoda"
      >
        <div className={styles.searchBar}>
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchGlyph />
          </span>
          <label className="sr-only" htmlFor={inputId}>
            Pretraga proizvoda
          </label>
          <input
            id={inputId}
            ref={inputRef}
            className={styles.input}
            type="text"
            role="combobox"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Naziv proizvoda, šifra, brend ili pakovanje"
            value={query}
            aria-expanded={rowCount > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeRowId}
            onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY_LENGTH))}
            onKeyDown={handleInputKeyDown}
          />
          <button className={styles.close} type="button" onClick={close}>
            <span aria-hidden="true">Esc</span>
            <span className="sr-only">Zatvorite pretragu</span>
          </button>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </p>

        <div className={styles.body}>
          {!trimmed ? (
            <div className={styles.hint}>
              <p className={styles.hintTitle}>Pretražite ceo katalog</p>
              <p className={styles.hintText}>
                Naziv proizvoda, šifra, brend, nijansa ili pakovanje — na primer
                „bezbojni lak“, „RAL 3002“ ili „600 ml“.
              </p>
            </div>
          ) : tooShort ? (
            /*
             * Jedan znak ne pokreće pretragu: ni indeks se ne učitava. Poruka
             * je konkretna („najmanje 2 znaka") umesto praznog stanja, jer
             * prazno stanje ovde nije istina — pretraga još nije ni pokušana.
             */
            <div className={styles.hint}>
              <p className={styles.hintTitle}>Unesite najmanje 2 znaka</p>
              <p className={styles.hintText}>
                Jedan znak bi vratio skoro ceo katalog. Dodajte još jedno slovo
                ili cifru — na primer „cl“, „ral“ ili „2e“.
              </p>
            </div>
          ) : isLoadingIndex ? (
            <div className={styles.hint} aria-busy="true">
              <p className={styles.hintTitle}>
                {status === "slow" ? "Pretraga se još učitava…" : "Učitavamo pretragu…"}
              </p>
              <p className={styles.hintText}>
                {status === "slow"
                  ? "Veza je sporija nego obično. Indeks se učitava samo jednom po poseti."
                  : "Indeks proizvoda se učitava pri prvoj pretrazi."}
              </p>
            </div>
          ) : status === "error" ? (
            <div className={styles.hint}>
              <p className={styles.hintTitle}>Pretraga trenutno nije dostupna</p>
              <p className={styles.hintText}>
                Katalog, kategorije i brendovi rade normalno.
              </p>
              <button className={styles.retry} type="button" onClick={retry}>
                Pokušajte ponovo
              </button>
            </div>
          ) : showEmpty ? (
            <div className={styles.hint}>
              <p className={styles.hintTitle}>Nema rezultata za „{trimmed}“</p>
              <p className={styles.hintText}>
                Proverite šifru ili probajte opštiji pojam — na primer samo naziv
                proizvoda bez pakovanja.
              </p>
            </div>
          ) : (
            <ul
              className={styles.list}
              id={listId}
              role="listbox"
              aria-label={`Rezultati pretrage za ${trimmed}`}
              ref={listRef}
            >
              {rows.map((row, index) => (
                <li key={row.key} role="presentation">
                  <Link
                    className={`${styles.row} ${
                      row.level === "member" ? styles.rowMember : ""
                    }`}
                    href={row.record.href}
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-active={index === activeIndex}
                    data-cursor="link"
                    tabIndex={-1}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={close}
                  >
                    <ResultLine
                      record={row.record}
                      level={row.level}
                      memberTotal={row.level === "header" ? row.memberTotal : 0}
                    />
                  </Link>
                </li>
              ))}

              {/*
                „Prikaži sve" je poslednja opcija LISTE, a ne odvojen podnožni
                link: `aria-activedescendant` sme da pokazuje samo na element
                unutar liste kojom upravlja, pa bi footer izvan nje prekinuo
                combobox ugovor čim se strelicama dođe do njega.
              */}
              <li role="presentation">
                <Link
                  className={styles.showAll}
                  href={catalogHref}
                  id={`${listId}-option-${rows.length}`}
                  role="option"
                  aria-selected={activeIndex === rows.length}
                  data-active={activeIndex === rows.length}
                  data-cursor="link"
                  tabIndex={-1}
                  onMouseMove={() => setActiveIndex(rows.length)}
                  onClick={close}
                >
                  <span>Prikažite sve rezultate za „{trimmed}“</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/*
          Kada liste nema (prazan rezultat, greška, učitavanje), prelaz na
          katalog i dalje mora da postoji — ali kao običan link dostupan
          Tab-om, van combobox semantike.
        */}
        {trimmed && !tooShort && status !== "error" && rows.length === 0 && !isLoadingIndex ? (
          <Link className={styles.showAllStatic} href={catalogHref} onClick={close}>
            <span>Otvorite katalog sa upitom „{trimmed}“</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="5.8" />
      <path d="m15.2 15.2 4.3 4.3" />
    </svg>
  );
}
