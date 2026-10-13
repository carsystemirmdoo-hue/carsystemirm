"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  addRequestItemAction,
  companionSuggestionsAction,
} from "@/app/kupac/naruci/actions";
import type { CompanionSuggestion } from "@/lib/ordering/companions";
import styles from "./CompanionPanel.module.css";

/** Događaj posle uspešnog dodavanja artikla u korpu (Izbor robe i katalog). */
export const PICKED_EVENT = "cs-izabrano";
export type PickedDetail = { articleId: string; packs: number };

const money = new Intl.NumberFormat("sr-Latn-RS", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Mali panel pri dnu ekrana: uz izabrani artikal nudi odgovarajući poklopac ili herter
 * (odluke vlasnika 2026-10-13). Ništa se ne dodaje samo — kupac upisuje broj i potvrđuje.
 * Herter: samo iz tehničkog lista proizvođača; više opcija se prikazuje bez unapred izabrane;
 * broj pakovanja se predlaže samo uz potvrđen odnos, osnovu odnosa i pakovanja.
 * Bez podataka o stanju zaliha (izvor ne postoji).
 */
export function CompanionPanel() {
  const [items, setItems] = useState<CompanionSuggestion[]>([]);
  const [packs, setPacks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let last = 0;
    const onPicked = (e: Event) => {
      const d = (e as CustomEvent<PickedDetail>).detail;
      if (!d?.articleId) return;
      const ticket = ++last;
      companionSuggestionsAction(d.articleId, Math.max(1, d.packs || 1))
        .then((r) => {
          if (ticket !== last) return;
          setMsg(null);
          setItems(r.suggestions);
          setPacks(
            Object.fromEntries(
              r.suggestions.map((s) => [
                s.articleId,
                s.suggestedPacks ? String(s.suggestedPacks) : "",
              ]),
            ),
          );
        })
        .catch(() => setItems([]));
    };
    window.addEventListener(PICKED_EVENT, onPicked);
    return () => window.removeEventListener(PICKED_EVENT, onPicked);
  }, []);

  // Posle dodavanja poslednjeg predloga panel ostaje sa potvrdom dok ga kupac ne zatvori.
  if (!items.length && !msg) return null;
  const close = () => {
    setItems([]);
    setMsg(null);
  };
  const lids = items.filter((s) => s.kind === "poklopac");
  const hardeners = items.filter((s) => s.kind === "herter");
  const matching = items.filter((s) => s.kind === "kompatibilno");

  const row = (s: CompanionSuggestion) => {
    const value = packs[s.articleId] ?? "";
    return (
      <li key={s.articleId} className={styles.item}>
        <span className={styles.name}>
          {s.choiceLabel ? <strong>{s.choiceLabel}</strong> : null}
          <span>{s.articleName}</span>
          <small>
            šifra {s.articleCode} · pakovanje: {s.packLabel}
            {s.packNet !== null
              ? ` · ${money.format(s.packNet)} RSD bez PDV-a po pakovanju${s.optionLabel ? ` (${s.optionLabel})` : ""}`
              : ""}
          </small>
          {s.suggestionText ? <small>{s.suggestionText}</small> : null}
        </span>
        {s.mode === "upit" ? (
          <span className={styles.actions}>
            {/* Nije potvrđena ponuda/prodajna jedinica: samo upit, nikad direktno dodavanje. */}
            {s.inquiryHref ? (
              <Link className={styles.inquiry} href={s.inquiryHref}>
                Pošaljite upit
              </Link>
            ) : (
              <small>Upit kancelariji ili komercijalisti</small>
            )}
          </span>
        ) : (
          <span className={styles.actions}>
            <input
              className={styles.qty}
              inputMode="numeric"
              value={value}
              placeholder="br."
              onChange={(e) =>
                setPacks((p) => ({ ...p, [s.articleId]: e.target.value }))
              }
              aria-label={`Broj pakovanja, ${s.articleName}`}
            />
            <button
              type="button"
              className={styles.add}
              disabled={pending || !value.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addRequestItemAction({
                    articleId: s.articleId,
                    packs: value.trim(),
                  });
                  if (r.ok)
                    window.dispatchEvent(
                      new CustomEvent("cs-korpa", {
                        detail: { count: r.count },
                      }),
                    );
                  setMsg(
                    r.ok
                      ? {
                          ok: true,
                          text: `${s.kind === "herter" ? "Herter" : s.kind === "poklopac" ? "Poklopac" : "Artikal"} je dodat u korpu.`,
                        }
                      : { ok: false, text: r.message },
                  );
                  if (r.ok)
                    setItems((all) =>
                      all.filter((x) => x.articleId !== s.articleId),
                    );
                })
              }
            >
              {pending ? "Dodaje se…" : "Dodajte"}
            </button>
          </span>
        )}
      </li>
    );
  };

  const ratio = hardeners.find((h) => h.ratioText)?.ratioText;
  const source = hardeners.find((h) => h.sourceUrl)?.sourceUrl;
  return (
    <aside
      className={styles.panel}
      aria-label="Odgovarajući pribor"
      role="region"
    >
      <div className={styles.head}>
        <strong>Uz izabrani artikal</strong>
        <button
          type="button"
          className={styles.close}
          onClick={close}
          aria-label="Zatvorite predlog"
        >
          ×
        </button>
      </div>
      {lids.length ? (
        <>
          <span className={styles.group}>Odgovarajući poklopac</span>
          <ul className={styles.list}>{lids.map(row)}</ul>
        </>
      ) : null}
      {matching.length ? (
        <>
          <span className={styles.group}>Kompatibilno uz izabrani artikal</span>
          <ul className={styles.list}>{matching.map(row)}</ul>
        </>
      ) : null}
      {hardeners.length ? (
        <>
          <span className={styles.group}>
            {hardeners.length > 1
              ? "Odgovarajući herter — izaberite prema uslovima rada"
              : "Odgovarajući herter"}
            {ratio ? ` · odnos ${ratio}` : ""}
          </span>
          <ul className={styles.list}>{hardeners.map(row)}</ul>
          {source ? (
            <small className={styles.note}>
              Izvor:{" "}
              <a href={source} target="_blank" rel="noreferrer">
                tehnički list proizvođača
              </a>
            </small>
          ) : null}
        </>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={msg && !msg.ok ? styles.error : styles.note}
      >
        {msg ? msg.text : "Ne dodaje se automatski."}{" "}
        {msg?.ok ? <Link href="/kupac/korpa">Korpa</Link> : null}
      </p>
    </aside>
  );
}
