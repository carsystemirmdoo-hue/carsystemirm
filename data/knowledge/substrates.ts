import type { Substrate } from "@/lib/knowledge/entities";

/**
 * Controlled substrate vocabulary.
 *
 * Descriptions state what the material *is*. They deliberately do not say how
 * to prepare, prime or paint it — that is a technical claim, belongs on a
 * product's `substrates` claim with a TDS reference behind it, and is not
 * something this file is entitled to assert.
 */
export const substrates: Substrate[] = [
  {
    slug: "celik",
    name: "Čelik",
    description:
      "Nelegirani ili niskolegirani čelični lim, najčešći nosivi materijal karoserije.",
    terminologySlug: "celicni-lim",
  },
  {
    slug: "pocinkovani-lim",
    name: "Pocinkovani lim",
    description:
      "Čelični lim sa nanetim slojem cinka radi zaštite od korozije.",
  },
  {
    slug: "aluminijum",
    name: "Aluminijum",
    description:
      "Aluminijumske legure koje se koriste za pojedine delove karoserije i poklopce.",
  },
  {
    slug: "plastika",
    name: "Plastika",
    description:
      "Polimerni delovi karoserije, uključujući PP, ABS, PC i EPDM modifikovane materijale.",
    terminologySlug: "plastika-branik",
  },
  {
    slug: "stakloplastika",
    name: "Stakloplastika",
    description:
      "Poliesterski kompozit ojačan staklenim vlaknima (GRP), sreće se na dodatnoj opremi i starijim karoserijama.",
  },
  {
    slug: "e-coat",
    name: "Kataforetski sloj (e-coat)",
    description:
      "Fabrički nanet elektroforetski temeljni sloj na novim delovima karoserije.",
  },
  {
    slug: "stari-lak",
    name: "Stari lak",
    description:
      "Postojeći, ranije nanet sistem laka koji ostaje na delu površine tokom popravke.",
  },
  {
    slug: "poliesterski-kit",
    name: "Poliesterski kit",
    description:
      "Obrađena površina poliesterske ispune nakon brušenja.",
  },
  {
    slug: "temeljna-boja",
    name: "Temeljni sloj",
    description:
      "Nanet i pripremljen temeljni sloj koji prima naredni sistem boje.",
  },
];

export function getSubstrate(slug: string) {
  return substrates.find((substrate) => substrate.slug === slug);
}
