"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { addToCartAction } from "@/app/kupac/korpa/actions";
import { ensureCustomerSession, hasCustomerMarker } from "@/components/customer-buy/customerSession";
import type { ReorderItem, ReorderList } from "@/lib/customers/reorder";
import styles from "./CatalogReorder.module.css";

type State = (ReorderList & { signedIn: true }) | null;

function srDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
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
    if (!hasCustomerMarker()) return;
    let alive = true;
    // Prvo stanje prijave: sa zapamćenog uređaja ono obnavlja isteklu sesiju.
    ensureCustomerSession()
      .then((s) => (s?.signedIn ? fetch("/api/kupac/poruci-ponovo", { cache: "no-store", credentials: "same-origin" }) : null))
      .then((r) => (r && r.ok ? r.json() : null))
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
            Iz Vaših faktura
            {state.demo ? <span className={styles.demo}>Demo podaci</span> : null}
          </p>
          <h2 id="reorder-title">Poručite ponovo</h2>
          <p className={styles.lead}>
            Artikli koje ste ranije kupovali, iz potvrđenih faktura do {srDay(state.dataUntil)} Cenu i
            dostupnost potvrđuje Vaš komercijalista.
          </p>
        </div>
        <span className={styles.headLinks}>
          {state.items.some((i) => i.orderable) ? (
            <Link href="/kupac/korpa" className={styles.all}>
              Korpa →
            </Link>
          ) : null}
          <Link href="/kupac/fakture" className={styles.all}>
            Sve fakture →
          </Link>
        </span>
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

        {item.orderable && item.order ? <ReorderQuantity item={item} /> : null}

        <div className={styles.actions}>
          {p ? (
            <Link href={p.href} className={styles.primary} tabIndex={-1} aria-hidden="true">
              Otvorite proizvod →
            </Link>
          ) : (
            <Link href={item.invoicesHref} className={styles.secondary}>
              Pogledajte u fakturama →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Brz unos količine — samo za PORUČIV artikal (potvrđena veza, tačna
 * varijanta, stavka aktivnog cenovnika). Server ponovo proverava artikal,
 * količinu i cenu; ovde se ne šalje ni cena ni firma.
 */
function ReorderQuantity({ item }: { item: ReorderItem }) {
  const o = item.order!;
  const [qty, setQty] = useState(String(o.suggestedQuantity));
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const add = () =>
    start(async () => {
      const r = await addToCartAction({ articleCode: item.articleCode, quantity: qty });
      setState(r.ok ? { ok: true, text: `Dodato u korpu (${r.count} ${r.count === 1 ? "stavka" : "stavke"}).` } : { ok: false, text: r.message });
    });
  return (
    <div className={styles.order}>
      <p className={styles.orderFacts}>
        {o.packLabel} · JM {o.unit}
        <br />
        <strong>
          {money.format(o.netPrice)} {o.currency}
        </strong>{" "}
        bez PDV-a / {o.unit} · PDV {o.vatPercent} %
        {o.demoPriceList ? <span className={styles.demoPrice}>demo cenovnik</span> : null}
      </p>
      <div className={styles.orderRow}>
        <label className={styles.qtyLabel}>
          <span>Količina</span>
          <input
            type="number"
            inputMode="decimal"
            min={o.step}
            step={o.step}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={pending}
          />
        </label>
        <button type="button" className={styles.addButton} onClick={add} disabled={pending} aria-busy={pending}>
          {pending ? "Dodajem…" : "Dodajte u korpu"}
        </button>
      </div>
      {state ? (
        <p className={styles.orderMsg} data-ok={state.ok ? "true" : "false"} role="status">
          {state.text} {state.ok ? <Link href="/kupac/korpa">Otvorite korpu →</Link> : null}
        </p>
      ) : null}
    </div>
  );
}
