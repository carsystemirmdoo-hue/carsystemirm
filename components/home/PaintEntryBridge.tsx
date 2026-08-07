import styles from "./PaintEntryBridge.module.css";

type PaintEntryBridgeProps = {
  debug?: boolean;
};

/**
 * Prvi signal promene poglavlja — painterly potezi koji žive u bloku
 * partnerske mreže, iza mape i iza locator kartice.
 *
 * Tri stvari su bitne i lako se izgube:
 *
 * 1. Sloj je dekorativan i stoji IZA sadržaja (z-index 1, sadržaj je na 2),
 *    sa pointer-events: none, pa ne blokira interakciju sa mapom ni karticom.
 * 2. Reveal je vezan za --paint-approach, isti signal koji vozi i sam takeover.
 *    Zato ulazak nije zaseban efekat koji se "upali" pa stane, nego početak
 *    jednog neprekidnog prelaza.
 * 3. Wrapper ima visinu 0 i vezan je za donju granicu sekcije; sve što crta je
 *    u `.canvas` koji drži originalni odnos viewBox-a. Bez toga se grafika
 *    anizotropno rastegne po visini i potez postane mrlja.
 *
 * Ivice su organske preko feTurbulence/feDisplacementMap — filteri su statični
 * (animiraju se samo maska i opacity), pa se ne preračunavaju po frame-u.
 * Filter regioni su namerno uski: svaki procenat je dodatna rasterizovana
 * površina.
 */
export function PaintEntryBridge({ debug = false }: PaintEntryBridgeProps) {
  return (
    <div
      className={styles.bridge}
      data-debug-outline={debug ? "true" : undefined}
      data-paint-entry-bridge=""
      aria-hidden="true"
    >
      <div className={styles.canvas}>
      <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 760">
        <defs>
          <filter
            id="paint-entry-bristle"
            x="-4%"
            y="-12%"
            width="108%"
            height="124%"
          >
            <feTurbulence
              baseFrequency="0.012 0.06"
              numOctaves="2"
              result="noise"
              seed="7"
              type="fractalNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="26"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter
            id="paint-entry-dry"
            x="-4%"
            y="-14%"
            width="108%"
            height="128%"
          >
            <feTurbulence
              baseFrequency="0.02 0.11"
              numOctaves="2"
              result="noise"
              seed="19"
              type="fractalNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="34"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {/*
            Blur 22 → 9 i filter region 124%×220% → 106%×118%. Uz izotropnu
            skalu (aspect-ratio na .canvas) ovo je jedini glow sloj i ne širi
            vizuelni bounding box preko samog poteza.
          */}
          <filter
            id="paint-entry-haze"
            x="-3%"
            y="-9%"
            width="106%"
            height="118%"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* Široki mekani nanos — daje dubinu, ne čita se kao linija. */}
        <path
          className={styles.haze}
          filter="url(#paint-entry-haze)"
          d="M-140 600 C320 588 760 540 1140 452 C1520 364 1780 262 2060 96 L2060 232 C1770 388 1500 486 1132 574 C752 664 320 706 -140 716Z"
        />

        {/*
          Grupisano pod JEDNIM filterom. Ranije je svaki path nosio
          `filter=` zasebno, pa se feTurbulence šum računao po jednom putu —
          četiri rasterizacije umesto dve.
        */}
        <g filter="url(#paint-entry-bristle)">
        {/* Glavni potez: prolazi iza mape i kartice, ne po praznom prostoru. */}
        <path
          className={styles.brushCore}
          d="M-120 566 C330 556 764 512 1146 424 C1528 336 1792 232 2056 72 L2056 138 C1786 300 1524 400 1150 490 C766 580 330 622 -120 632Z"
        />
        <path
          className={styles.underpull}
          d="M-120 618 C330 610 770 566 1152 478 C1534 390 1800 286 2060 126 L2060 168 C1792 332 1530 434 1156 522 C772 612 330 654 -120 662Z"
        />

        </g>

        {/* Suvi trag četke — fragmenti koji prate glavni potez. */}
        <g filter="url(#paint-entry-dry)">
        <path
          className={styles.dryBrush}
          d="M420 566 L590 540 L742 516 L806 522 L700 552 L536 580Z
             M960 470 L1108 436 L1236 408 L1298 414 L1180 448 L1030 484Z
             M1454 340 L1590 300 L1712 262 L1776 262 L1652 302 L1520 346Z"
        />
        <path
          className={styles.dryBrushFar}
          d="M120 640 L316 620 L488 592 L372 626 L204 654Z
             M760 528 L910 490 L1024 462 L906 500 L806 536Z
             M1264 408 L1400 368 L1522 326 L1420 372 L1304 414Z"
        />

        </g>

        {/* Sprej / overspray, ne simetrično. */}
        <circle className={styles.spray} cx="330" cy="612" r="9" />
        <circle className={styles.spray} cx="392" cy="634" r="3.4" />
        <circle className={styles.spray} cx="268" cy="596" r="2.2" />
        <circle className={styles.spray} cx="742" cy="536" r="5.2" />
        <circle className={styles.spray} cx="1204" cy="426" r="7" />
        <circle className={styles.spray} cx="1256" cy="452" r="2.6" />
        <circle className={styles.sprayBlue} cx="1556" cy="306" r="6" />
        <circle className={styles.sprayBlue} cx="1628" cy="278" r="2.8" />
        <circle className={styles.sprayBlue} cx="1492" cy="336" r="3.2" />
      </svg>
      </div>
    </div>
  );
}
