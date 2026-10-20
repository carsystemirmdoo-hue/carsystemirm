"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALL_PACKS,
  PACK_QUERY_PARAM,
  buildPackIndex,
  packSlug,
} from "@/components/product/variantPacks.mjs";

type PackIndex = ReturnType<typeof buildPackIndex>;

/**
 * Izbor pakovanja na PDP-u porodice (2026-10-20).
 *
 * Drži SAMO izbor zapremine („4 L“, „Sva pakovanja“), ne aktivnu varijantu —
 * aktivna varijanta i dalje živi u `ProductVariantProvider`. Podrazumevano je
 * zapremina aktivne varijante; `?pakovanje=` (zamenom adrese, bez novog koraka
 * istorije) čuva izbor za direktan link i povratak.
 */
export function useVariantPackChoice(
  variants: readonly { id: string; package?: string | null }[],
  groupCount: number,
  activeVariantId: string,
) {
  const packIndex: PackIndex = useMemo(() => buildPackIndex(variants), [variants]);
  const hasPackChoice = groupCount === 1 && packIndex.packs.length > 1;
  const activePacks = packIndex.packsByVariant.get(activeVariantId) ?? [];
  const [packChoice, setPackChoice] = useState<string | null>(null);

  const currentPack =
    packChoice === ALL_PACKS
      ? ALL_PACKS
      : packChoice && activePacks.includes(packChoice)
        ? packChoice
        : (activePacks[0] ?? ALL_PACKS);

  useEffect(() => {
    if (!hasPackChoice) return;
    const apply = () => {
      const requested = new URLSearchParams(window.location.search).get(PACK_QUERY_PARAM);
      if (requested === ALL_PACKS) setPackChoice(ALL_PACKS);
      else {
        const match = packIndex.packs.find((pack) => pack.slug === requested);
        setPackChoice(match ? match.label : null);
      }
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [hasPackChoice, packIndex]);

  /** Upisuje izbor u adresu zamenom; vraća da li aktivna varijanta ostaje validna. */
  function choosePack(label: string) {
    setPackChoice(label);
    const url = new URL(window.location.href);
    const value = label === ALL_PACKS ? ALL_PACKS : packSlug(label);
    url.searchParams.set(PACK_QUERY_PARAM, value);
    // Isti obrazac kao `ProductVariantProvider`: sopstveno stanje (ne interno
    // Next stanje), pa Next sinhronizuje adresu; zamena, ne nov korak istorije.
    window.history.replaceState({ [PACK_QUERY_PARAM]: value }, "", url);
    return label === ALL_PACKS || activePacks.includes(label);
  }

  return { packIndex, hasPackChoice, currentPack, choosePack };
}
