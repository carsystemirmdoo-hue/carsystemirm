"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import styles from "./CartPage.module.css";

export function CartPage() {
  const { items, count, setQuantity, remove, clear, ready } = useCart();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Upit za ponudu</p>
        <h1>Lista za upit</h1>
        <p className={styles.lead}>
          Izabrane proizvode šaljemo kao upit. Dostupnost, pakovanje i cenu
          potvrđujemo odgovorom — lista sama po sebi nije porudžbina.
        </p>
      </header>

      {!ready ? null : items.length === 0 ? (
        <div className={styles.empty}>
          <p>Lista je prazna.</p>
          <Link className={styles.primary} href="/katalog?brend=baslac">
            Otvorite Baslac katalog
          </Link>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id}>
                <div className={styles.thumb}>
                  {item.image ? (
                    <Image src={item.image} alt="" width={72} height={92} />
                  ) : null}
                </div>
                <div className={styles.info}>
                  <strong>{item.sku}</strong>
                  <Link href={`/proizvodi/${item.productSlug}`}>{item.name}</Link>
                  {item.volume ? <small>{item.volume}</small> : null}
                </div>
                <label className={styles.qty}>
                  <span>Količina</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(event) =>
                      setQuantity(item.id, Number(event.target.value))
                    }
                  />
                </label>
                <button type="button" onClick={() => remove(item.id)}>
                  Ukloni
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <p>
              Ukupno stavki: <strong>{count}</strong>
            </p>
            <div>
              <Link
                className={styles.primary}
                href={`/kontakt?tema=ponuda&stavki=${count}`}
              >
                Pošaljite upit za odabrane proizvode
              </Link>
              <button type="button" className={styles.ghost} onClick={clear}>
                Isprazni listu
              </button>
            </div>
          </div>
          <p className={styles.note}>
            Pri slanju upita ponovo proveravamo šifru, aktivnost proizvoda,
            dozvoljenu količinu i uslove za vaš nalog.
          </p>
        </>
      )}
    </main>
  );
}
