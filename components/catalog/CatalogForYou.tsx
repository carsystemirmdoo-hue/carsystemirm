"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { addRequestItemAction } from "@/app/kupac/naruci/actions";
import { ensureCustomerSession, hasCustomerMarker } from "@/components/customer-buy/customerSession";
import type { ForYou, ForYouCard } from "@/lib/customers/for-you";
import styles from "./CatalogForYou.module.css";

export type ForYouRanking = ForYou["ranking"] & { enoughHistory: boolean };

/** Lični redosled za katalog (CatalogExplorer) — događaj + poslednja vrednost, bez zajedničkog konteksta. */
export const FOR_YOU_EVENT = "cs-licno";
declare global {
  interface Window {
    __csZaVas?: ForYouRanking;
  }
}

/**
 * „Za Vas“ na vrhu kataloga — samo za prijavljenog kupca (iz sesije; komponenta ne šalje nijedan
 * podatak). Dve grupe: „Najčešće kupujete“ i „Vreme je za dopunu“ (samo uz dovoljno podataka).
 * Bez istorije: jedna kratka poruka. Anonimni posetilac ne pravi zahtev i ne vidi ništa.
 */
export function CatalogForYou() {
  const [data, setData] = useState<(ForYou & { signedIn: true }) | null>(null);
  useEffect(() => {
    if (!hasCustomerMarker()) return;
    let alive = true;
    ensureCustomerSession()
      .then((s) => (s?.signedIn ? fetch("/api/kupac/licno", { cache: "no-store", credentials: "same-origin" }) : null))
      .then((r) => (r && r.ok ? r.json() : null))
      .then((body) => {
        if (!alive || !body?.signedIn) return;
        setData(body);
        const ranking: ForYouRanking = { ...body.ranking, enoughHistory: body.enoughHistory };
        window.__csZaVas = ranking;
        window.dispatchEvent(new CustomEvent(FOR_YOU_EVENT, { detail: ranking }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;
  const has = data.frequent.length > 0;
  if (!has) {
    return (
      <p className={styles.quiet}>
        Kada budu potvrđene Vaše prve kupovine, ovde ćete videti proizvode koje najčešće kupujete.{" "}
        <a href="#katalog-proizvodi">Pregledajte katalog ↓</a>
      </p>
    );
  }
  return (
    <section className={styles.root} aria-labelledby="licno-naslov">
      <header className={styles.head}>
        <h2 id="licno-naslov">Za Vas</h2>
        {data.demo ? <span className={styles.demo}>{data.demoLabel ?? "Demo podaci"} · demo cene</span> : null}
        {data.demo ? <p className={styles.headNote}>Prikaz za proveru: istorija i cene su sintetičke. U korpi važi cena iz cenovnika.</p> : null}
        {!data.demo ? (
          <Link href="/kupac/fakture" className={styles.headLink}>
            Fakture →
          </Link>
        ) : null}
      </header>
      {data.refill.length ? (
        <Group title="Vreme je za dopunu" note="Prema ritmu Vaših ranijih kupovina." cards={data.refill} />
      ) : null}
      <Group title="Najčešće kupujete" cards={data.frequent} />
    </section>
  );
}

const INITIAL_CARDS = 4;

function Group({ title, note, cards }: { title: string; note?: string; cards: ForYouCard[] }) {
  // Kratko na prvi pogled (i na telefonu); ostatak na zahtev, bez skrivanja kontrola.
  const [all, setAll] = useState(false);
  const shown = all ? cards : cards.slice(0, INITIAL_CARDS);
  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>
        {title}
        {note ? <small>{note}</small> : null}
      </h3>
      <ul className={styles.list}>
        {shown.map((c) => (
          <Card key={`${title}-${c.articleId}`} card={c} />
        ))}
      </ul>
      {cards.length > INITIAL_CARDS ? (
        <button type="button" className={styles.more} onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? "Prikažite manje" : `Prikažite još ${cards.length - INITIAL_CARDS}`}
        </button>
      ) : null}
    </div>
  );
}

const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitText = (u: string) => (u === "LIT" ? "L" : u === "KOM" ? "kom" : u === "KG" ? "kg" : u.toLowerCase());

function Card({ card }: { card: ForYouCard }) {
  const p = card.price;
  return (
    <li className={styles.card}>
      <Link href={card.href} className={styles.media} tabIndex={-1} aria-hidden="true">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image.src} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.noImage}>Bez slike</span>
        )}
      </Link>
      <div className={styles.body}>
        <h4 className={styles.name}>
          <Link href={card.href}>{card.name}</Link>
        </h4>
        {card.variantLabel || card.packLabel ? (
          <p className={styles.meta}>{[card.variantLabel, card.packLabel && card.packLabel !== "1 kom" ? card.packLabel : null].filter(Boolean).join(" · ")}</p>
        ) : null}
        {card.reason ? <p className={styles.reason}>{card.reason}</p> : null}
        {p ? (
          <div className={styles.price}>
            {p.kind === "demo" ? <span className={styles.demoTag}>Demo cena</span> : null}
            <p>
              {p.packNet !== null && !p.single ? (
                <>
                  <strong>{money.format(p.packNet)} RSD</strong> <span>/ pakovanje</span>
                </>
              ) : (
                <>
                  <strong>{money.format(p.unitNet)} RSD</strong> <span>/ {unitText(p.unit)}</span>
                </>
              )}
            </p>
            <p className={styles.vat}>
              {p.perUnit && !p.single ? `${money.format(p.unitNet)} RSD / ${unitText(p.unit)} · ` : ""}bez PDV-a{p.optionLabel ? ` · ${p.optionLabel}` : ""}
            </p>
          </div>
        ) : null}
        {card.stock ? (
          <p className={styles.stock} data-state={card.stock.state}>
            {card.stock.text}
          </p>
        ) : null}
        {card.orderable ? <AddToCart card={card} /> : null}
      </div>
    </li>
  );
}

function AddToCart({ card }: { card: ForYouCard }) {
  const [packs, setPacks] = useState(card.suggestedPacks === null ? "" : String(card.suggestedPacks));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const add = () =>
    start(async () => {
      const r = await addRequestItemAction({ articleId: card.articleId, packs: packs.trim() });
      setMsg(r.ok ? { ok: true, text: "Dodato u korpu." } : { ok: false, text: r.message });
      if (r.ok) window.dispatchEvent(new CustomEvent("cs-korpa", { detail: { count: r.count } }));
    });
  return (
    <div className={styles.order}>
      {card.suggestionNote ? <p className={styles.note}>{card.suggestionNote}</p> : null}
      <div className={styles.orderRow}>
        <label>
          <span className={styles.srOnly}>Broj pakovanja, {card.name}</span>
          <input type="number" inputMode="numeric" min={1} step={1} value={packs} placeholder="broj" onChange={(e) => setPacks(e.target.value)} disabled={pending} />
        </label>
        <button type="button" onClick={add} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Dodajem…" : "Dodajte u korpu"}
        </button>
      </div>
      {msg ? (
        <p className={styles.msg} data-ok={msg.ok ? "true" : "false"} role="status">
          {msg.text} {msg.ok ? <Link href="/kupac/korpa">Korpa →</Link> : null}
        </p>
      ) : null}
    </div>
  );
}
