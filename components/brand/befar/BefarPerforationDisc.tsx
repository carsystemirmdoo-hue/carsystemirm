import type { BefarPerforation } from "@/lib/befar-brand-data";

type Props = {
  perforation: BefarPerforation;
  /** Bez animacije — sekcija je server-rendered, reveal radi CSS. */
  className?: string;
  titleId?: string;
};

const VIEW = 200;
const CENTER = VIEW / 2;
/** Poluprečnik diska u viewBox jedinicama; ostavlja rub za ivicu. */
const DISC_R = 88;

/**
 * Perforacija Befar međupodloške, crtana iz `rings` definicije.
 *
 * Shema, ne CAD replika: ukupan broj otvora je tačan i odgovara Befarovoj
 * oznaci (7 / 15 / 62), a raspored je izveden iz fotografije proizvoda
 * (`public/brands/befar/products/befar-interface-pad-multihole-face.webp`).
 * Prstenovi su rotirani tako da se otvori ne poklapaju radijalno.
 */
export function BefarPerforationDisc({ perforation, className, titleId }: Props) {
  const holes: Array<{ x: number; y: number; r: number; key: string }> = [];

  perforation.rings.forEach((ring, ringIndex) => {
    const radius = (ring.r / 100) * DISC_R;
    // Naizmenično pomeranje faze da otvori susednih prstenova ne stoje u istoj osi.
    const phase = ringIndex % 2 === 0 ? 0 : Math.PI / ring.count;

    for (let i = 0; i < ring.count; i += 1) {
      const angle = phase + (i / ring.count) * Math.PI * 2;
      holes.push({
        x: CENTER + Math.cos(angle) * radius,
        y: CENTER + Math.sin(angle) * radius,
        r: ring.size / 2,
        key: `${ringIndex}-${i}`,
      });
    }
  });

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-labelledby={titleId}
      focusable="false"
    >
      {titleId ? (
        <title id={titleId}>{`Šema međupodloške sa ${perforation.holes} otvora`}</title>
      ) : null}

      {/* ivica diska — narandžasti rub kao na proizvodu */}
      <circle cx={CENTER} cy={CENTER} r={DISC_R + 4} className="befarDiscEdge" />
      {/* telo diska */}
      <circle cx={CENTER} cy={CENTER} r={DISC_R} className="befarDiscBody" />

      <g className="befarDiscHoles">
        {holes.map((hole, index) => (
          <circle
            cx={hole.x}
            cy={hole.y}
            key={hole.key}
            r={hole.r}
            style={{ "--befar-hole-index": index } as React.CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
}
