"use client";

/**
 * React sloj nad deljenim klijentom pretrage.
 *
 * Koriste ga i panel (Header/Homepage) i katalog, pa oba dobijaju identično
 * ponašanje učitavanja, grešaka i zaštite od zastarelog odgovora — bez dva
 * skupa pravila koja se razilaze.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureSearchIndex,
  type ProductSearchResult,
} from "@/lib/search/productSearchClient";
import { MIN_QUERY_LENGTH } from "@/lib/search/engine.mjs";
import { compactText } from "@/lib/search/normalize.mjs";

export type ProductSearchStatus =
  | "idle"
  /** Upit je prekratak — ne pokreće se ni učitavanje indeksa. */
  | "too-short"
  | "loading"
  | "slow"
  | "searching"
  | "ready"
  | "error";

/**
 * Posle koliko milisekundi učitavanje prelazi u „traje duže nego obično".
 *
 * Ispod ovoga poruka bi treperila na svakoj normalnoj vezi; iznad ovoga
 * korisnik na sporoj vezi ostaje bez objašnjenja zašto ništa ne piše.
 */
const SLOW_LOAD_MS = 900;

export function useProductSearch(
  query: string,
  options: {
    enabled?: boolean;
    limit?: number;
    group?: boolean;
    maxGroups?: number;
    maxMembers?: number;
    debug?: boolean;
  } = {},
) {
  const {
    enabled = true,
    limit = 200,
    group = false,
    maxGroups,
    maxMembers,
    debug = false,
  } = options;

  const [status, setStatus] = useState<ProductSearchStatus>("idle");
  const [result, setResult] = useState<ProductSearchResult | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  /*
   * Redni broj upita. Odgovor sa manjim brojem od poslednjeg poslatog se
   * odbacuje: kucanje „ral" pa „ral 3002" ne sme da završi tako što sporiji
   * odgovor za „ral" pregazi već prikazan rezultat za „ral 3002".
   */
  const sequenceRef = useRef(0);
  const trimmed = query.trim();
  /*
   * Prekratak upit se zaustavlja OVDE, pre `ensureSearchIndex()`: jedan otkucan
   * znak ne sme ni da povuče asset od 650 KB, a kamoli da pokrene pretragu.
   * Dužina se meri kompaktno, isto kao u engine-u, pa se UI i engine ne mogu
   * razići oko toga šta je prekratko.
   */
  const tooShort = compactText(trimmed).length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!enabled || !trimmed) {
      setStatus("idle");
      return undefined;
    }

    if (tooShort) {
      setStatus("too-short");
      return undefined;
    }

    sequenceRef.current += 1;
    const sequence = sequenceRef.current;
    let cancelled = false;

    /*
     * Dok stiže nov rezultat, prethodni ostaje na ekranu i status je
     * „searching" — bez toga bi lista nestala pa se vratila na svaki znak, što
     * je i skok layout-a i treptanje.
     */
    setStatus((current) => (current === "ready" ? "searching" : "loading"));

    const slowTimer = window.setTimeout(() => {
      if (cancelled || sequenceRef.current !== sequence) return;
      setStatus((current) => (current === "loading" ? "slow" : current));
    }, SLOW_LOAD_MS);

    ensureSearchIndex()
      .then((index) => index.query(trimmed, { limit, group, maxGroups, maxMembers, debug }))
      .then((value) => {
        if (cancelled || sequenceRef.current !== sequence) return;
        setResult(value);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled || sequenceRef.current !== sequence) return;
        setStatus("error");
      })
      .finally(() => {
        window.clearTimeout(slowTimer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [debug, enabled, group, limit, maxGroups, maxMembers, retryToken, tooShort, trimmed]);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  /*
   * Rezultat se izlaže samo kad odgovara TRENUTNOM upitu. Time je nemoguće da
   * panel prikaže stari skup uz novi tekst u polju, čak i pri brzom brisanju.
   */
  const current = result && result.query === trimmed ? result : null;

  return { status, result: current, retry };
}
