"use client";

import { useMemo } from "react";
import {
  baslacAssetSlots,
  baslacBaseSlug,
  baslacFinishLabels,
  baslacLineExamplePackshot,
  baslacPublicBases,
  baslacSearchAliases,
  type BaslacBase,
  type BaslacSystemId,
} from "@/lib/baslac-systems";
import { baslacVariantQueryValue } from "./baslacVariantState.mjs";
import { FamilyBasePdp } from "@/components/product/family/FamilyBasePdp";
import type { FamilyBase, FamilyPackshot } from "@/components/product/family/familyBaseTypes";

function volumeText(volumeL: number | null) {
  return volumeL === null ? "Na upit" : `${String(volumeL).replace(".", ",")} L`;
}

function volumeKey(volumeL: number | null) {
  return volumeL === null ? "upit" : String(volumeL);
}

/** Baslac baza → stavka zajedničkog izbora. Svaka baza je svoj proizvod (izbor po slug-u). */
export function toFamilyBase(base: BaslacBase): FamilyBase {
  return {
    code: base.code,
    name: base.name,
    volumeL: base.volumeL,
    volumeKey: volumeKey(base.volumeL),
    volumeLabel: volumeText(base.volumeL),
    ...(base.volumeL === 0.1 ? { volumeNote: "koncentrat" } : {}),
    packLabel: volumeText(base.volumeL),
    finish: base.finish,
    finishLabel: baslacFinishLabels[base.finish],
    // Bez potvrđenog naziva i efekta: neutralan (šrafiran) kvadratić, bez boje.
    ...(base.finish === "unknown" ? {} : { swatch: base.swatch }),
    swatchPattern: base.finish === "unknown" ? "neutral" : base.finish,
    queryValue: baslacVariantQueryValue(base),
    buySlug: baslacBaseSlug(base),
    buyName: `${base.code} · ${base.name}`,
    searchTerms: baslacSearchAliases(base),
  };
}

/**
 * Fotografija po zapremini sistema. Bez fallbacka na drugu zapreminu: limenka od 3,5 L ne
 * predstavlja bazu od 1 L. Reprezentativna fotografija sa šifrom jedne baze nosi natpis.
 */
function packshotsFor(system: BaslacSystemId, systemName: string): Record<string, FamilyPackshot> {
  const result: Record<string, FamilyPackshot> = {};
  for (const slot of baslacAssetSlots()) {
    if (slot.system !== system || !slot.src) continue;
    const volume = volumeText(slot.volumeL);
    result[volumeKey(slot.volumeL)] = {
      src: slot.src,
      alt: `Baslac ${systemName} ambalaža ${volume}${slot.shownCode ? ` (na fotografiji baza ${slot.shownCode})` : ""}`,
      ...(slot.shownCode
        ? { note: `Reprezentativna ambalaža ${volume} — na fotografiji baza ${slot.shownCode}; izabrana baza ima svoju etiketu.` }
        : {}),
    };
  }
  return result;
}

export function BaslacSystemPdp({
  familyName,
  system,
  systemName,
  intro,
  lineDocument,
}: {
  familyName: string;
  system: BaslacSystemId;
  systemName: string;
  intro: string;
  lineDocument?: { href: string; title: string };
}) {
  const bases = useMemo(() => baslacPublicBases(system).map(toFamilyBase), [system]);
  const packshots = useMemo(() => packshotsFor(system, systemName), [system, systemName]);
  const lineExample = baslacLineExamplePackshot(system);

  return (
    <FamilyBasePdp
      brand="baslac"
      brandLabel="Baslac"
      eyebrow="Baslac sistem boja"
      familyName={familyName}
      systemName={systemName}
      intro={intro}
      bases={bases}
      packshots={packshots}
      fallbackPackshot={
        lineExample
          ? { ...lineExample, note: "Primer ambalaže linije — ne prikazuje izabranu nijansu ni zapreminu." }
          : null
      }
      inquiryHref={(base) =>
        `/kontakt?tema=proizvod&brend=baslac&sistem=${encodeURIComponent(systemName)}&sifra=${encodeURIComponent(base.code)}`
      }
      swatchNote="Prikazani kvadratić boje predstavlja orijentacionu grupu pigmenta, a ne garantovanu automobilsku nijansu."
      stageNote="Jedna ambalaža po sistemu i pakovanju. Baze se razlikuju šifrom, nijansom i završnicom, ne limenkom."
      lineDocument={lineDocument ? { href: lineDocument.href, title: `Tehnički list sistema — ${lineDocument.title}` } : undefined}
    />
  );
}
