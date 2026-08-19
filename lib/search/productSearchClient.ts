"use client";

/**
 * Deljeni klijent pretrage: jedan asset, jedan promise, jedan worker.
 *
 * Sve tri ulazne tačke — lupa u Headeru, „Pretražite proizvode" na Homepage-u i
 * `/katalog?q=` — prolaze kroz OVAJ modul. Zato:
 *
 *   - asset se preuzima najviše jednom po učitanoj stranici, bez obzira koliko
 *     komponenti ga zatraži i koliko puta se remount-uju (state na nivou modula
 *     preživljava remount i Back navigaciju unutar iste sesije);
 *   - dva istovremena otvaranja pretrage dele isti promise u letu, pa ne postoji
 *     put do dva mrežna zahteva;
 *   - neuspeh se pamti tako da ga „Pokušaj ponovo" može očistiti i ponoviti;
 *   - engine postoji u tačno jednom primerku, u workeru, sa main-thread
 *     fallback-om kad Worker nije dostupan (stariji WebView, blokiran blob/CSP).
 *
 * Modul namerno NE koristi React state: da je keš u komponenti, Back sa PDP-a
 * (pun remount `CatalogExplorer`-a, videti belešku uz `CATALOG_SESSION_STORAGE_KEY`)
 * bi ponovo povukao ceo indeks.
 */

import { buildSearchIndex, searchIndex } from "@/lib/search/engine.mjs";
import { groupSearchHits } from "@/lib/search/grouping.mjs";
import type { ProductSearchRecord } from "@/lib/search/buildSearchIndex";

export const SEARCH_INDEX_URL = "/katalog/search-index.json";

/** Stabilno ime worker instance kroz dev i produkciju (vidi `createWorkerBackend`). */
export const SEARCH_WORKER_NAME = "carsystem-product-search";

export type SearchGroup = {
  type: "record" | "family";
  headerIndex: number;
  headerMatched: boolean;
  memberIndices: number[];
  memberTotal: number;
  score: number;
};

export type ProductSearchResult = {
  query: string;
  total: number;
  records: ProductSearchRecord[];
  scores: number[];
  groups: SearchGroup[];
  /** Zapisi po originalnom indeksu — za rezolvovanje `headerIndex` iz grupa. */
  recordAt: (index: number) => ProductSearchRecord | undefined;
  explain?: (unknown | null)[];
};

type LoadedIndex = {
  records: ProductSearchRecord[];
  query: (
    query: string,
    options: { limit?: number; group?: boolean; maxGroups?: number; maxMembers?: number; debug?: boolean },
  ) => Promise<ProductSearchResult>;
  dispose: () => void;
};

/* -------------------------------------------------------------------------- */
/* Modul-level keš                                                             */
/* -------------------------------------------------------------------------- */

let loaded: LoadedIndex | null = null;
let inFlight: Promise<LoadedIndex> | null = null;

/** Broj mrežnih zahteva za asset u ovoj sesiji — koristi ga QA i test. */
let requestCount = 0;

export function getSearchIndexRequestCount() {
  return requestCount;
}

export function isSearchIndexLoaded() {
  return loaded !== null;
}

/**
 * Briše zapamćeni neuspeh, da bi „Pokušaj ponovo" mogao da ponovi zahtev.
 * Uspešno učitan indeks se NE odbacuje — nema šta da se ponavlja.
 */
export function resetFailedSearchIndex() {
  if (!loaded) inFlight = null;
}

/* -------------------------------------------------------------------------- */
/* Worker                                                                      */
/* -------------------------------------------------------------------------- */

type PendingRequest = {
  resolve: (value: {
    hits: number[];
    scores: number[];
    groups?: SearchGroup[];
    explain?: (unknown | null)[];
  }) => void;
  reject: (reason: Error) => void;
};

function createWorkerBackend(records: ProductSearchRecord[]) {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./productSearchWorker.mjs", import.meta.url), {
      type: "module",
      /*
       * Ime nije kozmetika: u produkcijskom bundle-u je ulazni fajl workera
       * heširani chunk (`6558.f5e4c89….js`), pa se po URL-u ne može razlikovati
       * od bilo kog drugog workera na stranici — ni u DevTools-u ni u QA
       * merenju. Ime je jedini stabilan identitet kroz dev i produkciju.
       */
      name: SEARCH_WORKER_NAME,
    });
  } catch {
    return null;
  }

  const pending = new Map<number, PendingRequest>();
  let requestId = 0;
  let ready = false;
  let readyResolve: () => void = () => {};
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });

  worker.onmessage = (event: MessageEvent) => {
    const message = event.data;
    if (message?.type === "ready") {
      ready = true;
      readyResolve();
      return;
    }
    if (message?.type === "result") {
      pending.get(message.requestId)?.resolve(message);
      pending.delete(message.requestId);
      return;
    }
    if (message?.type === "error") {
      pending.get(message.requestId)?.reject(new Error(message.reason ?? "worker-error"));
      pending.delete(message.requestId);
    }
  };

  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new Error("worker-crashed"));
    pending.clear();
  };

  worker.postMessage({ type: "init", records });

  return {
    async run(query: string, options: Record<string, unknown>) {
      if (!ready) await readyPromise;
      requestId += 1;
      const id = requestId;
      return new Promise<{
        hits: number[];
        scores: number[];
        groups?: SearchGroup[];
        explain?: (unknown | null)[];
      }>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "query", requestId: id, query, ...options });
      });
    },
    dispose() {
      for (const request of pending.values()) request.reject(new Error("worker-disposed"));
      pending.clear();
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    },
  };
}

/**
 * Rezervni put kada Worker nije dostupan.
 *
 * Isti engine, samo na main threadu. Ne pokušava da imitira asinhronost preko
 * chunk-ovanja: na 3.500 zapisa jedan upit je i dalje ispod milisekunde, a
 * jednokratna gradnja indeksa se plaća pri prvom otvaranju pretrage, umesto da
 * pretraga uopšte ne radi.
 */
function createInlineBackend(records: ProductSearchRecord[]) {
  const index = buildSearchIndex(records);
  const familyIndexBySlug = new Map<string, number>(
    records.flatMap((record, position) =>
      record.kind === "family" && record.familySlug
        ? ([[record.familySlug, position]] as [string, number][])
        : [],
    ),
  );

  return {
    async run(query: string, options: Record<string, unknown>) {
      const hits = searchIndex(index, query, {
        limit: (options.limit as number) ?? 200,
        debug: options.debug === true,
      });
      return {
        hits: hits.map((hit: { index: number }) => hit.index),
        scores: hits.map((hit: { score: number }) => hit.score),
        explain: options.debug === true
          ? hits.map((hit: { explain?: unknown }) => hit.explain ?? null)
          : undefined,
        groups: options.group
          ? (groupSearchHits(hits, {
              familyIndexBySlug,
              maxGroups: options.maxGroups as number | undefined,
              maxMembers: options.maxMembers as number | undefined,
            }) as SearchGroup[])
          : undefined,
      };
    },
    dispose() {
      /* nema resursa za oslobađanje */
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Učitavanje                                                                  */
/* -------------------------------------------------------------------------- */

async function loadIndex(): Promise<LoadedIndex> {
  requestCount += 1;
  const response = await fetch(SEARCH_INDEX_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = (await response.json()) as { records: ProductSearchRecord[] };
  const records = payload.records ?? [];

  const backend = createWorkerBackend(records) ?? createInlineBackend(records);

  const value: LoadedIndex = {
    records,
    async query(query, options) {
      const raw = await backend.run(query, options);
      return {
        query,
        total: raw.hits.length,
        records: raw.hits.map((position) => records[position]),
        scores: raw.scores,
        groups: raw.groups ?? [],
        recordAt: (position: number) => records[position],
        explain: raw.explain,
      };
    },
    dispose() {
      backend.dispose();
    },
  };

  loaded = value;
  return value;
}

/**
 * Učitava indeks (ili vraća već učitan). Bezbedno je zvati koliko god puta:
 * drugi i svaki naredni poziv dobiju isti promise.
 */
export function ensureSearchIndex(): Promise<LoadedIndex> {
  if (loaded) return Promise.resolve(loaded);
  if (inFlight) return inFlight;

  inFlight = loadIndex().catch((error) => {
    // Neuspeh se ne kešira kao vrednost: sledeći poziv (Retry) sme da pokuša
    // ponovo, umesto da jedan pao zahtev zaključa pretragu do reload-a.
    inFlight = null;
    throw error;
  });

  return inFlight;
}

/**
 * Worker se NE gasi kada se panel zatvori.
 *
 * Zatvaranje panela je česta, jeftina radnja; gašenje workera bi značilo da
 * sledeće otvaranje ponovo gradi indeks (a katalog koji upravo pretražuje
 * ostaje bez engine-a). Instanca je jedna po učitanoj stranici — 20 ciklusa
 * otvaranja i zatvaranja i dalje daje tačno jedan worker i jedan mrežni zahtev.
 * Panel oslobađa SVOJE slušače pri zatvaranju; ovaj modul nema slušače vezane za
 * njegov životni ciklus.
 *
 * Eksplicitan teardown postoji samo za testove i QA merenja.
 */
export function disposeSearchIndexForTeardown() {
  loaded?.dispose();
  loaded = null;
  inFlight = null;
  requestCount = 0;
}
