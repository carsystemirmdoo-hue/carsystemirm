/**
 * SATA — code-native tehnički prikazi.
 *
 * Nemamo nijednu SATA fotografiju sa potvrđenim pravom korišćenja
 * (`docs/SATA_CONTENT_ASSET_MAP.md`), pa se svaki vizuelni element crta iz koda.
 * Nijedan od ovih prikaza nije reprodukcija SATA grafike niti prikaz proizvoda —
 * to su dijagrami odnosa koje opisuje `docs/SATA_RESEARCH.md`.
 *
 * Sve su server komponente: čist SVG, bez stanja i bez klijentskog JS-a. Svi su
 * dekorativni (`aria-hidden`) jer podatak koji nose postoji i u tekstu pored njih.
 */

import styles from "./SataBrandPage.module.css";

/**
 * Oblik mlaza za `I` i `O` mlaznicu.
 *
 * `I` — izdužen, uska suva zona, suvlji centar.
 * `O` — ovalan, šira suva zona, vlažno jezgro.
 *
 * Geometrija je shematska ilustracija te razlike, ne merni prikaz.
 */
export function SataSprayFan({ shape }: { shape: "I" | "O" }) {
  const isControl = shape === "I";

  return (
    <svg
      aria-hidden="true"
      className={styles.fanSvg}
      focusable="false"
      viewBox="0 0 120 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Suva zona — spoljna kontura mlaza. */}
      <ellipse
        className={styles.fanOuter}
        cx="60"
        cy="80"
        rx={isControl ? 22 : 38}
        ry={isControl ? 62 : 50}
      />
      {/* Jezgro — kod `O` vlažno i široko, kod `I` uže i suvlje. */}
      <ellipse
        className={styles.fanCore}
        cx="60"
        cy="80"
        data-dry={isControl || undefined}
        rx={isControl ? 9 : 24}
        ry={isControl ? 46 : 33}
      />
      {/* Osa nanošenja. */}
      <line className={styles.fanAxis} x1="60" x2="60" y1="8" y2="152" />
    </svg>
  );
}

/**
 * Tri stepena filtracije, sa deklarisanim granicama.
 * Izvor brojeva: `SATA filter 584`, art. 1099953.
 */
export function SataFilterStack() {
  const stages = [
    { id: 1, limit: "> 5 µm" },
    { id: 2, limit: "> 0,01 µm" },
    { id: 3, limit: "uljne pare" },
  ];

  return (
    <svg
      aria-hidden="true"
      className={styles.filterSvg}
      focusable="false"
      viewBox="0 0 260 96"
      xmlns="http://www.w3.org/2000/svg"
    >
      {stages.map((stage, index) => {
        const x = index * 88;
        return (
          <g key={stage.id}>
            <rect
              className={styles.filterCell}
              height="52"
              rx="1"
              width="72"
              x={x}
              y="22"
            />
            {/* Gustina rastera raste sa stepenom — vizuelni ekvivalent finoće. */}
            {Array.from({ length: 3 + index * 3 }, (_, line) => (
              <line
                className={styles.filterMesh}
                key={line}
                x1={x + 6 + line * (60 / (3 + index * 3))}
                x2={x + 6 + line * (60 / (3 + index * 3))}
                y1="28"
                y2="68"
              />
            ))}
            <text className={styles.filterIndex} x={x + 6} y="16">
              {`0${stage.id}`}
            </text>
            <text className={styles.filterLimit} x={x + 6} y="90">
              {stage.limit}
            </text>
            {index < stages.length - 1 ? (
              <line
                className={styles.filterFlow}
                x1={x + 74}
                x2={x + 86}
                y1="48"
                y2="48"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Odstupanje stvarnog od zadatog pritiska, sa pragom alarma na 0,2 bar.
 * Izvor praga: `adam X pro`. Kriva je shematska — ne prikazuje izmereni signal.
 */
export function SataPressureTrace() {
  return (
    <svg
      aria-hidden="true"
      className={styles.traceSvg}
      focusable="false"
      viewBox="0 0 260 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Zadata vrednost. */}
      <line className={styles.traceTarget} x1="0" x2="260" y1="40" y2="40" />
      {/* Granice tolerancije. */}
      <line className={styles.traceLimit} x1="0" x2="260" y1="20" y2="20" />
      <line className={styles.traceLimit} x1="0" x2="260" y1="60" y2="60" />
      {/* Stvarna vrednost — ostaje unutar granica. */}
      <path
        className={styles.traceActual}
        d="M0 40 C 18 30, 32 46, 52 38 S 88 28, 108 42 S 146 52, 168 36 S 208 26, 230 41 L 260 38"
        fill="none"
      />
    </svg>
  );
}
