"use client";

import type { ReactNode } from "react";
import { FamilyBasePdp } from "./FamilyBasePdp";
import type { FamilyBase, FamilyPackshot } from "./familyBaseTypes";

/** Klijentski omotač: funkcija za upit ne može da pređe granicu server → klijent. */
export function RmFamilyPicker({
  familyName,
  systemName,
  eyebrow,
  intro,
  bases,
  packshots,
  swatchNote,
  stageNote,
  children,
}: {
  familyName: string;
  systemName: string;
  eyebrow: string;
  intro: string;
  bases: FamilyBase[];
  packshots: Record<string, FamilyPackshot>;
  swatchNote: string;
  stageNote: string;
  children?: ReactNode;
}) {
  return (
    <FamilyBasePdp
      brand="rm"
      brandLabel="R-M"
      eyebrow={eyebrow}
      familyName={familyName}
      systemName={systemName}
      intro={intro}
      bases={bases}
      packshots={packshots}
      inquiryHref={(base) =>
        `/kontakt?tema=proizvod&brend=rm&proizvod=${encodeURIComponent(base.buySlug)}&sifra=${encodeURIComponent(base.code)}`
      }
      filterLabel="Završnica"
      swatchNote={swatchNote}
      stageNote={stageNote}
    >
      {children}
    </FamilyBasePdp>
  );
}
