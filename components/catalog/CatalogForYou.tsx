"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
 * podatak). Jedna kratka lista (2026-11-04, umesto dva karusela velikih kartica): prvo stavke za
 * dopunu, zatim one koje kupac najčešće kupuje, bez ponavljanja; prvih pet redova, ostalo na
 * „Prikažite sve“. Katalog ispod je već poređan po istoj istoriji (`cs-licno`).
 * Bez istorije: jedna kratka poruka. Anonimni posetilac ne pravi zahtev i ne vidi ništa.
 */
const VISIBLE_ROWS = 5;

type ForYouRow = { card: ForYouCard; kind: "dopuna" | "najcesce" };

export function CatalogForYou() {
  const [data, setData] = useState<(ForYou & { signedIn: true }) | null>(null);
  const [expanded, setExpanded] = useState(false);
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
  if (!data.frequent.length) {
    return (
      <p className={styles.quiet}>
        Kada budu potvrđene Vaše prve kupovine, ovde ćete videti proizvode koje najčešće kupujete.{" "}
        <a href="#katalog-proizvodi">Pregledajte katalog ↓</a>
      </p>
    );
  }
  const seen = new Set<string>();
  const rows: ForYouRow[] = [];
  for (const [list, kind] of [[data.refill, "dopuna"], [data.frequent, "najcesce"]] as const) {
    for (const card of list) {
      if (seen.has(card.articleId)) continue;
      seen.add(card.articleId);
      rows.push({ card, kind });
    }
  }
  const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  // Ista napomena o raspoloživosti u svakom redu → jednom, u zaglavlju.
  const sharedStock = rows.every((r) => r.card.stock?.state === "zastareo") ? rows[0].card.stock!.text : null;
  return (
    <section className={styles.root} aria-labelledby="licno-naslov">
      <header className={styles.head}>
        <h2 id="licno-naslov">Za Vas</h2>
        <span className={styles.headSub}>Prema Vašim kupovinama</span>
        {data.demo ? <span className={styles.demo}>{data.demoLabel ?? "Demo podaci"}</span> : null}
        {!data.demo ? (
          <Link href="/kupac/fakture" className={styles.headLink}>
            Fakture →
          </Link>
        ) : null}
        {data.demo || sharedStock ? (
          <p className={styles.headNote}>
            {data.demo ? "Istorija kupovina je sintetička; cene su iz demo rabata i iste su kao u korpi." : null}
            {data.demo && sharedStock ? " " : null}
            {sharedStock}
          </p>
        ) : null}
      </header>
      <ul className={styles.rows} id="licno-lista">
        {shown.map((row) => (
          <Row key={row.card.articleId} row={row} hideStock={Boolean(sharedStock)} />
        ))}
      </ul>
      {rows.length > VISIBLE_ROWS ? (
        <button type="button" className={styles.more} aria-expanded={expanded} aria-controls="licno-lista" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Prikažite manje ↑" : `Prikažite sve (${rows.length}) ↓`}
        </button>
      ) : null}
    </section>
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

function Row({ row, hideStock }: { row: ForYouRow; hideStock: boolean }) {
  const { card, kind } = row;
  const view = priceView(card);
  const packText = card.packLabel && card.packLabel !== "1 kom" ? card.packLabel : null;
  const meta = [card.variantLabel, view ? null : packText].filter(Boolean).join(" · ");
  return (
    <li className={styles.row} data-kind={kind}>
      <Link href={card.href} className={styles.thumb} tabIndex={-1} aria-hidden="true">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image.src} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.noImage}>—</span>
        )}
      </Link>
      <div className={styles.info}>
        <p className={styles.kind}>{kind === "dopuna" ? "Vreme je za dopunu" : "Najčešće kupujete"}</p>
        <h3 className={styles.name}>
          <Link href={card.href}>{card.name}</Link>
        </h3>
        {meta || card.reason ? <p className={styles.meta}>{[meta, card.reason].filter(Boolean).join(" · ")}</p> : null}
        {card.orderable && card.suggestionNote ? <p className={styles.note}>{card.suggestionNote}</p> : null}
        {card.stock && !hideStock ? (
          <p className={styles.stock} data-state={card.stock.state}>
            {card.stock.text}
          </p>
        ) : null}
      </div>
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
      {card.orderable ? <AddToCart card={card} /> : <span className={styles.orderPlaceholder} aria-hidden="true" />}
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
      <div className={styles.orderRow}>
        <label>
          <span className={styles.srOnly}>Broj pakovanja, {card.name}</span>
          <input type="number" inputMode="numeric" min={1} step={1} value={packs} placeholder="broj" onChange={(e) => setPacks(e.target.value)} disabled={pending} />
        </label>
        <button type="button" onClick={add} disabled={pending} aria-busy={pending || undefined} aria-label={`Dodajte u korpu: ${card.name}`}>
          {pending ? "Dodajem…" : "Dodajte"}
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
