/**
 * Web Worker pretrage.
 *
 * Ovde se radi ono što ne sme na main threadu: gradnja inverznog indeksa nad
 * svim zapisima (~20 ms na trenutnih 873, ~80 ms na 3.500) i fuzzy skeniranje
 * rečnika po pritisku tastera. Dok to radi worker, Header animacija, custom
 * kursor i sam unos teksta ostaju bez zastoja.
 *
 * Poruke nose INDEKSE zapisa, ne same zapise: main thread već drži isti niz
 * (dobija ga iz istog fetch-a), pa je odgovor na upit nekoliko stotina brojeva
 * umesto nekoliko stotina objekata kroz structured clone.
 *
 * Fajl je `.mjs` i uvozi samo `.mjs` module bez zavisnosti — isti engine koji
 * koriste testovi i main-thread fallback kada Worker nije dostupan.
 */

import { buildSearchIndex, searchIndex } from "./engine.mjs";
import { groupSearchHits } from "./grouping.mjs";

/** @type {ReturnType<typeof buildSearchIndex> | null} */
let index = null;
/** @type {Map<string, number>} */
let familyIndexBySlug = new Map();

function post(message) {
  self.postMessage(message);
}

self.onmessage = (event) => {
  const message = event.data;

  if (message?.type === "init") {
    const started = Date.now();
    index = buildSearchIndex(message.records);
    familyIndexBySlug = new Map(
      message.records.flatMap((record, position) =>
        record.kind === "family" && record.familySlug
          ? [[record.familySlug, position]]
          : [],
      ),
    );
    post({ type: "ready", records: message.records.length, buildMs: Date.now() - started });
    return;
  }

  if (message?.type === "query") {
    if (!index) {
      post({ type: "error", requestId: message.requestId, reason: "not-ready" });
      return;
    }

    const hits = searchIndex(index, message.query, {
      limit: message.limit ?? 200,
      debug: message.debug === true,
    });

    post({
      type: "result",
      requestId: message.requestId,
      query: message.query,
      total: hits.length,
      hits: hits.map((hit) => hit.index),
      scores: hits.map((hit) => hit.score),
      explain: message.debug === true ? hits.map((hit) => hit.explain ?? null) : undefined,
      groups: message.group
        ? groupSearchHits(hits, {
            familyIndexBySlug,
            maxGroups: message.maxGroups,
            maxMembers: message.maxMembers,
          })
        : undefined,
    });
  }
};
