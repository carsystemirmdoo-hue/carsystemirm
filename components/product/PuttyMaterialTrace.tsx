"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  PUTTY_COLOR_PRESETS,
  puttyDuotoneTransfer,
  type PuttyMaterialTraceConfig,
  PUTTY_MATERIAL_TRACE_ASPECT,
  PUTTY_MATERIAL_TRACE_ASSETS,
  PUTTY_MATERIAL_TRACE_CANVAS,
  PUTTY_MATERIAL_TRACE_REVEAL_DELAY_MS,
  PUTTY_MATERIAL_TRACE_REVEAL_DURATION_MS,
  PUTTY_MATERIAL_TRACE_REVEAL_END,
  PUTTY_MATERIAL_TRACE_REVEAL_PATH,
  PUTTY_MATERIAL_TRACE_REVEAL_SPLINE,
  PUTTY_MATERIAL_TRACE_REVEAL_START,
  PUTTY_MATERIAL_TRACE_WIDTH,
} from "@/lib/putty-material-trace";
import styles from "./PuttyMaterialTrace.module.css";

/**
 * Dva sloja traga kita, odozdo nagore: senka pa materijal.
 *
 * Komponenta je čisto dekorativna — `aria-hidden`, bez pointer eventova i bez
 * teksta. Ne dodiruje sloj proizvoda, koji ostaje iznad nje po `z-index` skali
 * panela.
 *
 * Otkrivanje (Faza 2H-A): fotografski PNG-ovi se NE diraju i ne zamenjuju. Oba
 * su `<image>` u istom SVG-u, unutar `<g>` koji nosi jednu `clipPath` sa
 * nepravilnom vodećom ivicom; ta maska se prevlači sleva nadesno. Pošto klip
 * stoji na zajedničkoj grupi, materijal i senka se ne mogu razdvojiti.
 *
 * Zašto rasteri žive u SVG-u, a ne kao HTML slojevi: Chrome ne preračunava
 * `clip-path: url(…)` na HTML elementu kada se sadržaj te maske animira — ni
 * CSS transformom ni SMIL-om. Provereno na ovom panelu: trag je ostajao
 * nevidljiv i u završnom stanju. Klipovanje SVG sadržaja SVG maskom se
 * osvežava ispravno, a kao bonus user space SVG-a JESTE koordinatni sistem
 * asseta (1413 × 1086), pa se maska autoriše u njegovim jedinicama.
 */
export function PuttyMaterialTrace({ config }: { config: PuttyMaterialTraceConfig }) {
  /*
   * `useId` daje jedinstven id po instanci, pa dva panela na istoj stranici ne
   * dele masku. Dvotačke iz React formata se uklanjaju jer `url(#…)` sa njima
   * nije pouzdan u CSS-u.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `putty-reveal-${uid}`;
  const tintId = `putty-tint-${uid}`;

  /*
   * Boja se menja samo na sloju materijala. Senka je crna sa alfom i mora
   * ostati neutralna, pa filter nikada ne dodiruje njen `<image>`.
   */
  const preset = PUTTY_COLOR_PRESETS[config.colorPreset];
  const transfer = preset.target ? puttyDuotoneTransfer(preset.target) : null;
  const sweepRef = useRef<SVGPathElement | null>(null);
  const animateRef = useRef<SVGAnimateTransformElement | null>(null);
  const [isReady, setReady] = useState(false);

  /*
   * Povlačenje kreće tek kada su OBA rastera u kešu — inače bi maska prešla
   * preko praznog mesta i efekat bi bio potrošen pre nego što se materijal
   * pojavi. Predučitavanje ide preko `Image()`, pa ne zavisi od `load`
   * događaja na `<image>`; greška se broji isto, da se ne zaglavi zauvek.
   */
  useEffect(() => {
    let live = true;
    const load = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      });

    void Promise.all([
      load(PUTTY_MATERIAL_TRACE_ASSETS.shadow),
      load(PUTTY_MATERIAL_TRACE_ASSETS.material),
    ]).then(() => {
      if (live) setReady(true);
    });

    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    /*
     * Bez pokreta: maska odmah stoji u završnoj poziciji. Trag je dekoracija,
     * pa je ispravno da za takvog korisnika jednostavno već bude tu.
     */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sweepRef.current?.setAttribute(
        "transform",
        `translate(${PUTTY_MATERIAL_TRACE_REVEAL_END} 0)`,
      );
      return;
    }
    /*
     * Kratka pauza pre poteza. Ranije je konstanta postojala ali se nigde nije
     * primenjivala, pa je povlačenje kretalo istog trenutka.
     */
    const timer = window.setTimeout(() => {
      animateRef.current?.beginElement();
    }, PUTTY_MATERIAL_TRACE_REVEAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isReady]);

  return (
    <span
      className={styles.trace}
      style={{
        "--putty-trace-width": PUTTY_MATERIAL_TRACE_WIDTH,
        "--putty-trace-aspect": PUTTY_MATERIAL_TRACE_ASPECT,
      } as React.CSSProperties}
      aria-hidden="true"
      data-putty-material-trace
      data-putty-reveal={isReady ? "running" : "idle"}
      data-putty-family={config.family}
      data-putty-color={config.colorPreset}
    >
      <svg
        className={styles.canvas}
        viewBox={`0 0 ${PUTTY_MATERIAL_TRACE_CANVAS.width} ${PUTTY_MATERIAL_TRACE_CANVAS.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/*
            Transform stoji na samom `<path>`. `<g>` unutar `<clipPath>` nije
            dozvoljen sadržaj po SVG specifikaciji — browser ga tiho ignoriše,
            maska ispadne prazna i isklipuje ceo sloj.
          */}
          <clipPath id={clipId}>
            <path
              ref={sweepRef}
              d={PUTTY_MATERIAL_TRACE_REVEAL_PATH}
              transform={`translate(${PUTTY_MATERIAL_TRACE_REVEAL_START} 0)`}
            >
              <animateTransform
                ref={animateRef}
                attributeName="transform"
                type="translate"
                from={`${PUTTY_MATERIAL_TRACE_REVEAL_START} 0`}
                to={`${PUTTY_MATERIAL_TRACE_REVEAL_END} 0`}
                dur={`${PUTTY_MATERIAL_TRACE_REVEAL_DURATION_MS}ms`}
                begin="indefinite"
                fill="freeze"
                calcMode="spline"
                keyTimes="0;1"
                keySplines={PUTTY_MATERIAL_TRACE_REVEAL_SPLINE}
              />
            </path>
          </clipPath>

          {transfer ? (
            <filter id={tintId} colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncR type="linear" slope={transfer[0].slope} intercept={transfer[0].intercept} />
                <feFuncG type="linear" slope={transfer[1].slope} intercept={transfer[1].intercept} />
                <feFuncB type="linear" slope={transfer[2].slope} intercept={transfer[2].intercept} />
              </feComponentTransfer>
            </filter>
          ) : null}
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <image
            href={PUTTY_MATERIAL_TRACE_ASSETS.shadow}
            x="0"
            y="0"
            width={PUTTY_MATERIAL_TRACE_CANVAS.width}
            height={PUTTY_MATERIAL_TRACE_CANVAS.height}
            data-putty-trace-layer="shadow"
          />
          <image
            href={PUTTY_MATERIAL_TRACE_ASSETS.material}
            x="0"
            y="0"
            width={PUTTY_MATERIAL_TRACE_CANVAS.width}
            height={PUTTY_MATERIAL_TRACE_CANVAS.height}
            data-putty-trace-layer="material"
            filter={transfer ? `url(#${tintId})` : undefined}
          />
        </g>
      </svg>
    </span>
  );
}
