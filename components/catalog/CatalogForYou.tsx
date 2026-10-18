"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addRequestItemAction } from "@/app/kupac/naruci/actions";
import { ensureCustomerSession, hasCustomerMarker } from "@/components/customer-buy/customerSession";
import type { ForYou, ForYouCard } from "@/lib/customers/for-you";
import { compactPrice } from "@/lib/pricing/compactPrice.mjs";
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
  const cards = [...data.refill, ...data.frequent];
  // Ista napomena o raspoloživosti na svakoj kartici → jednom, u zaglavlju.
  const sharedStock = cards.length > 0 && cards.every((c) => c.stock?.state === "zastareo") ? cards[0].stock!.text : null;
  return (
    <section className={styles.root} aria-labelledby="licno-naslov">
      <header className={styles.head}>
        <h2 id="licno-naslov">Za Vas</h2>
        {data.demo ? <span className={styles.demo}>{data.demoLabel ?? "Demo podaci"}</span> : null}
        {data.demo || sharedStock ? (
          <p className={styles.headNote}>
            {data.demo ? "Istorija kupovina je sintetička; cene su iz demo rabata i iste su kao u korpi." : null}
            {data.demo && sharedStock ? " " : null}
            {sharedStock}
          </p>
        ) : null}
        {!data.demo ? (
          <Link href="/kupac/fakture" className={styles.headLink}>
            Fakture →
          </Link>
        ) : null}
      </header>
      {data.refill.length ? (
        <Rail id="licno-dopuna" title="Vreme je za dopunu" note="Prema ritmu Vaših ranijih kupovina" cards={data.refill} hideStock={Boolean(sharedStock)} />
      ) : null}
      <Rail id="licno-najcesce" title="Najčešće kupujete" cards={data.frequent} hideStock={Boolean(sharedStock)} />
    </section>
  );
}

/**
 * Ručni karusel: strelice + prevlačenje (izvorni horizontalni skrol sa „snap“), bez automatskog
 * pomeranja. Strelice pomeraju za vidljivu širinu; na krajevima su onemogućene.
 */
function Rail({ id, title, note, cards, hideStock }: { id: string; title: string; note?: string; cards: ForYouCard[]; hideStock: boolean }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);
  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.9, 200), behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className={styles.group}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle} id={`${id}-naslov`}>
          {title}
          {note ? <small>{note}</small> : null}
        </h3>
        {edges.start && edges.end ? null : (
          <div className={styles.railNav}>
            <button type="button" onClick={() => move(-1)} disabled={edges.start} aria-controls={id} aria-label={`Prethodni proizvodi: ${title}`}>
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" onClick={() => move(1)} disabled={edges.end} aria-controls={id} aria-label={`Sledeći proizvodi: ${title}`}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
      <ul className={styles.list} id={id} ref={track} aria-labelledby={`${id}-naslov`}>
        {cards.map((c) => (
          <Card key={`${id}-${c.articleId}`} card={c} hideStock={hideStock} />
        ))}
      </ul>
    </div>
  );
}

const unitText = (u: string) => (u === "LIT" ? "L" : u === "KOM" ? "kom" : u === "KG" ? "kg" : u.toLowerCase());

function priceView(card: ForYouCard) {
  const p = card.price;
  if (!p) return null;
  // Celo pakovanje kada je potvrđeno za sve opcije; inače cena po JM, jasno označena.
  const byPack = !p.single && p.byOption.every((o) => o.packNet !== null);
  return compactPrice(
    p.byOption.map((o) => ({ code: o.code, net: byPack ? o.packNet! : o.unitNet })),
    { pack: byPack ? card.packLabel : `po ${unitText(p.unit)}` },
  );
}

function Card({ card, hideStock }: { card: ForYouCard; hideStock: boolean }) {
  const view = priceView(card);
  const packText = card.packLabel && card.packLabel !== "1 kom" ? card.packLabel : null;
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
        <p className={styles.meta}>{[card.variantLabel, view ? null : packText].filter(Boolean).join(" · ") || "\u00a0"}</p>
        {card.reason ? <p className={styles.reason}>{card.reason}</p> : null}
        <div className={styles.price}>
          {view ? (
            <>
              <strong>{view.amounts}</strong>
              <span>{view.detail}</span>
            </>
          ) : (
            <span>Cena na upit</span>
          )}
        </div>
        {card.stock && !hideStock ? (
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
