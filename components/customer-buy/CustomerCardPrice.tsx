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
  // Cena CELOG pakovanja, samo za potvrđena pakovanja; najniža po svakoj ODOBRENOJ opciji (više pakovanja → „od“).
  const rows = data.options
    .map((opt) => {
      const priced = mine.flatMap((o) => {
        const p = o.byOption[opt.key];
        return o.state === "orderable" && o.pack && p?.status === "cena" && p.packAmounts ? [{ net: p.packAmounts.net, pack: o.pack.label }] : [];
      });
      if (!priced.length) return null;
      const min = priced.reduce((a, b) => (b.net < a.net ? b : a));
      return { key: opt.key, label: opt.label, net: min.net, pack: min.pack, from: priced.length > 1 };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (rows.length === 0) {
    return <span className={styles.cardPrice} data-state="request">Vaša cena na upit</span>;
  }
  return (
    <span className={styles.cardPrice} data-state="price">
      {rows.map((r) => (
        <span key={r.key}>
          {rows.length > 1 ? `${r.label}: ` : "Vaša cena "}
          {r.from ? "od " : ""}
          <strong>{money.format(r.net)} RSD</strong> / {r.pack} bez PDV-a
        </span>
      ))}
    </span>
  );
}
