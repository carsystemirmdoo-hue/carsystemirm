"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReorderItem, ReorderList } from "@/lib/customers/reorder";
import styles from "./CatalogReorder.module.css";

type State = (ReorderList & { signedIn: true }) | null;

function srDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}.`;
}

/**
 * „Poručite ponovo" na početku kataloga — samo za prijavljenog kupca.
 *
 * Katalog ostaje statičan: lista se traži posle učitavanja, i to samo kada
 * postoji marker prijave (`cs_kupac`). Anonimni posetilac ne pravi nijedan
 * zahtev i ne vidi ništa. Server bira kupca iz sesije; komponenta mu ne šalje
 * nijedan podatak.
 */
export function CatalogReorder() {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    if (!/(?:^|;\s*)cs_kupac=1/.test(document.cookie)) return;
    let alive = true;
    fetch("/api/kupac/poruci-ponovo", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => alive && setState(body?.signedIn ? body : null))
      .catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  return (
    <section className={styles.reorder} aria-labelledby="reorder-title">
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>
            Iz vaših faktura
            {state.demo ? <span className={styles.demo}>Demo podaci</span> : null}
          </p>
          <h2 id="reorder-title">Poručite ponovo</h2>
          <p className={styles.lead}>
            Artikli koje ste ranije kupovali, iz potvrđenih faktura do {srDay(state.dataUntil)} Cenu i
            dostupnost potvrđuje vaš komercijalista.
          </p>
        </div>
        <Link href="/kupac/fakture" className={styles.all}>
          Sve fakture →
        </Link>
      </header>

      {state.items.length === 0 ? (
        <p className={styles.empty}>
          U potvrđenim fakturama još nema kupovina za prikaz. Kada prve fakture budu uvezene, ovde će se
          pojaviti artikli koje kupujete.
        </p>
      ) : (
        <ol className={styles.list}>
          {state.items.map((item) => (
            <ReorderCard key={item.articleCode} item={item} />
          ))}
        </ol>
      )}

      {state.totalArticles > state.items.length ? (
        <p className={styles.more}>
          Prikazano {state.items.length} od {state.totalArticles} kupljenih artikala — ostali su u fakturama.
        </p>
      ) : null}
    </section>
  );
}

function ReorderCard({ item }: { item: ReorderItem }) {
  const p = item.product;
  return (
    <li className={styles.card} data-linked={p ? "true" : "false"}>
      <div className={styles.media} aria-hidden={p?.image ? undefined : true}>
        {p?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image.src} alt={p.image.alt} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.noImage}>{p ? "Bez slike" : "Nije povezano sa katalogom"}</span>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.name}>
          {p ? (
            <Link href={p.href} className={styles.stretch}>
              {p.name}
            </Link>
          ) : (
            item.documentName
          )}
        </h3>
        {p?.variantLabel ? <p className={styles.variant}>Varijanta: {p.variantLabel}</p> : null}
        {/* Naslov nepovezanog artikla već JESTE naziv sa fakture — ne ponavlja se. */}
        <p className={styles.doc}>
          {p ? (
            <>
              Na fakturi: {item.documentName} · <span>{item.articleCode}</span>
            </>
          ) : (
            <>
              Šifra na fakturi: <span>{item.articleCode}</span>
            </>
          )}
        </p>
        {p?.demoLink ? <span className={styles.demoLink}>Demo veza</span> : null}

        <p className={styles.reason}>{item.reason}</p>
        {item.usualQuantity ? (
          <p className={styles.qty}>
            Uobičajeno po kupovini: <strong>{item.usualQuantity}</strong>
          </p>
        ) : null}

        {/*
          F7: ovde dolaze brz unos količine i „Dodaj u korpu", kada `item.orderable`
          postane `true` (korpa, važeća cena kupca i potvrda porudžbine). Do tada
          nema dugmeta — lažno dugme bi obećalo porudžbinu koja ne postoji.
        */}
        <div className={styles.actions}>
          {p ? (
            <Link href={p.href} className={styles.primary} tabIndex={-1} aria-hidden="true">
              Otvori proizvod →
            </Link>
          ) : (
            <Link href={item.invoicesHref} className={styles.secondary}>
              Pogledaj u fakturama →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
