"use client";

import { money, useCustomerOffers } from "./useCustomerOffers";
import styles from "./CustomerBuy.module.css";

/**
 * Cena prijavljenog kupca na kartici kataloga. Samo za proizvode sa POTVRĐENOM
 * vezom i cenom; ostale kartice ostaju kakve jesu (cenu traže na stranici
 * proizvoda). Anonimno: ništa.
 */
export function CustomerCardPrice({ cardKey }: { cardKey: string }) {
  const data = useCustomerOffers();
  if (!data || !data.ordering.enabled) return null;
  const mine = data.offers.filter((o) => o.cardKeys.includes(cardKey));
  if (mine.length === 0) return null;
  const priced = mine.filter((o) => o.state === "orderable" && o.netPrice !== null);
  if (priced.length === 0) {
    return <span className={styles.cardPrice} data-state="request">Vaša cena na upit</span>;
  }
  const min = Math.min(...priced.map((o) => o.netPrice!));
  return (
    <span className={styles.cardPrice} data-state="price">
      Vaša cena {priced.length > 1 ? "od " : ""}
      <strong>
        {money.format(min)} {data.ordering.priceList.currency}
      </strong>{" "}
      bez PDV-a
      {data.ordering.priceList.kind === "demo" ? <em>demo</em> : null}
    </span>
  );
}
