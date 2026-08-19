import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import fit from "@/components/product/ProductImageFit.generated.module.css";
import styles from "./SceneStoryboards.module.css";

/**
 * Static storyboards for the three leading scene concepts — INTERNAL.
 *
 * STATIC ONLY, by instruction. There is no client component here, no state, no
 * timer and no keyframe: these are sketches to judge the idea against real
 * products, not another motion demo. The file is a server component precisely
 * so it cannot grow an animation by accident.
 *
 * Concepts drawn here (see docs/PRODUCT_SCENE_CONCEPTS.md):
 *   1 Product Echo            — the scene is the product's own silhouette
 *   2 Material Signature      — one trace describing what the product does
 *   3 Negative-space Reveal   — the scene is built by subtraction
 */

export type StoryboardCase = {
  slug: string;
  label: string;
  group: string;
  note: string;
  imageSrc: string;
  imageAlt: string;
  format: "portrait" | "square" | "landscape";
  tone: string;
};

function Stage({
  children,
  studyCase,
  style,
}: {
  children?: ReactNode;
  studyCase: StoryboardCase;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`${styles.stage} ${fit.fit}`}
      data-format={studyCase.format}
      data-product-fit={studyCase.imageSrc}
      style={style}
    >
      {children}
      <span className={styles.product}>
        <Image src={studyCase.imageSrc} alt={studyCase.imageAlt} fill sizes="320px" />
      </span>
    </div>
  );
}

function Card({
  children,
  studyCase,
  title,
}: {
  children: ReactNode;
  studyCase: StoryboardCase;
  title: string;
}) {
  return (
    <div className={styles.card}>
      {children}
      <div className={styles.cardMeta}>
        <strong>{title}</strong>
        <small>{studyCase.label}</small>
        <small>
          {studyCase.group} · {studyCase.tone}
        </small>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* 1 · Product Echo                                                     */
/* -------------------------------------------------------------------- */

function ProductEcho({ studyCase }: { studyCase: StoryboardCase }) {
  return (
    <Stage studyCase={studyCase}>
      <span className={`${styles.echo} ${styles.echoFar}`} aria-hidden="true">
        <Image src={studyCase.imageSrc} alt="" fill sizes="320px" />
      </span>
      <span className={styles.echo} aria-hidden="true">
        <Image src={studyCase.imageSrc} alt="" fill sizes="320px" />
      </span>
    </Stage>
  );
}

/* -------------------------------------------------------------------- */
/* 2 · Material Signature                                               */
/* -------------------------------------------------------------------- */

/**
 * One trace per group. Each describes a physical action, not a shape:
 *
 *   friction — an abrasive wears a surface: arcs that thin as they leave
 *   spread  — filler is dragged by a blade: a band that tapers and ridges
 *   fold    — film folds over itself: two planes meeting at a crease
 *
 * No trace carries a number, a grade or a thickness.
 */
function MaterialSignature({
  kind,
  studyCase,
}: {
  kind: "friction" | "spread" | "fold";
  studyCase: StoryboardCase;
}) {
  const tone = "currentColor";

  return (
    <Stage studyCase={studyCase} style={{ color: "oklch(0.45 0.026 248)" }}>
      <span className={styles.signature} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {kind === "friction" ? (
            <g fill="none" stroke={tone}>
              {[0, 1, 2, 3, 4].map((index) => (
                <path
                  key={index}
                  d={`M ${-8 + index * 3} ${34 + index * 7} Q 50 ${18 + index * 9}, ${108 - index * 3} ${36 + index * 7}`}
                  strokeWidth={5 - index * 0.7}
                  opacity={0.2 - index * 0.028}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ) : null}

          {kind === "spread" ? (
            <g>
              <defs>
                <linearGradient id="sb-spread" x1="0" x2="1">
                  <stop offset="0%" stopColor={tone} stopOpacity={0.24} />
                  <stop offset="70%" stopColor={tone} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={tone} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <path
                d="M -6 62 C 22 48, 46 72, 70 56 S 96 42, 108 50"
                stroke="url(#sb-spread)"
                strokeWidth={26}
                strokeLinecap="round"
                fill="none"
              />
              {[-2, -1, 0, 1, 2].map((index) => (
                <path
                  key={index}
                  d="M -6 62 C 22 48, 46 72, 70 56 S 96 42, 108 50"
                  stroke={tone}
                  strokeWidth={0.5}
                  opacity={0.2 - Math.abs(index) * 0.045}
                  fill="none"
                  transform={`translate(0 ${index * 5})`}
                />
              ))}
            </g>
          ) : null}

          {kind === "fold" ? (
            <g>
              <path d="M -5 30 L 105 18 L 105 58 L -5 74 Z" fill={tone} opacity={0.1} />
              <path d="M -5 74 L 105 58 L 105 104 L -5 104 Z" fill={tone} opacity={0.17} />
              <path
                d="M -5 74 L 105 58"
                stroke={tone}
                strokeWidth={0.7}
                opacity={0.4}
                fill="none"
              />
              <path
                d="M -5 30 L 105 18"
                stroke={tone}
                strokeWidth={0.5}
                opacity={0.24}
                fill="none"
              />
            </g>
          ) : null}
        </svg>
      </span>
    </Stage>
  );
}

/* -------------------------------------------------------------------- */
/* 3 · Negative-space Reveal                                            */
/* -------------------------------------------------------------------- */

/**
 * A solid field with an opening cut from it. The two `clip-path` values are the
 * field and the bright rim of the cut, so the product reads as something the
 * scene has been opened for.
 */
const NEGATIVE_SHAPES = {
  arch: {
    field: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    edge:
      "polygon(0% 0%, 100% 0%, 100% 8%, 0% 8%, 0% 0%, 26% 100%, 28% 100%, 28% 8%, 26% 8%)",
    opening: "ellipse(30% 40% at 50% 46%)",
  },
  band: {
    field: "polygon(0% 22%, 100% 14%, 100% 86%, 0% 94%)",
    edge: "polygon(0% 22%, 100% 14%, 100% 16%, 0% 24%)",
    opening: "inset(0 0 0 0)",
  },
} as const;

function NegativeSpace({
  shape,
  studyCase,
  tone,
}: {
  shape: keyof typeof NEGATIVE_SHAPES;
  studyCase: StoryboardCase;
  tone: string;
}) {
  const geometry = NEGATIVE_SHAPES[shape];

  return (
    <Stage
      studyCase={studyCase}
      style={
        {
          "--sb-negative-tone": tone,
          "--sb-negative-shape": geometry.field,
          "--sb-negative-edge": geometry.edge,
        } as CSSProperties
      }
    >
      <span className={styles.negative} aria-hidden="true" />
      <span className={styles.negativeEdge} aria-hidden="true" />
    </Stage>
  );
}

/* -------------------------------------------------------------------- */

export function SceneStoryboards({ cases }: { cases: StoryboardCase[] }) {
  const byGroup = (group: string) => cases.filter((entry) => entry.group === group);
  const first = (group: string) => byGroup(group)[0] ?? cases[0];

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <span className={styles.kicker}>Interno · statične skice</span>
        <h1>Storyboard: tri vodeća koncepta</h1>
        <p>
          Statične skice tri najbolje ocenjena univerzalna pravca iz{" "}
          <code>docs/PRODUCT_SCENE_CONCEPTS.md</code>, na <strong>stvarnim</strong>{" "}
          proizvodima iz grupa koje nisu boje, lakovi ni sprejevi.
        </p>
        <p>
          <strong>Nema animacije.</strong> Ovo je server komponenta bez stanja i
          bez keyframe-ova — svrha je da se oceni ideja, ne da se prikaže još
          jedna tehnička demonstracija. Postojeća spray/paint animacija nije
          dirana i ne pojavljuje se ovde.
        </p>
        <p>
          Svi prikazani proizvodi imaju stvarnu alfu (<code>boxSource: alpha</code>),
          jer prva dva koncepta koriste siluetu proizvoda. Proizvodi sa
          zapečenom belom pozadinom (npr. Car Fit folija, R-M Pasta) su namerno
          izostavljeni.
        </p>
      </header>

      <section className={styles.concept}>
        <div className={styles.conceptHead}>
          <h2>1 · Product Echo</h2>
          <p>
            Scena je sam proizvod: isti render, uvećan, pomeren i sveden na jedan
            ton. Ništa se ne crta, pa ništa ne može biti generično niti tvrditi
            osobinu koju proizvod nema. Dva eha daju dubinu — bliži i dalji.
          </p>
        </div>
        <div className={styles.row}>
          {cases.slice(0, 4).map((entry) => (
            <Card key={`echo-${entry.slug}`} studyCase={entry} title="Product Echo">
              <ProductEcho studyCase={entry} />
            </Card>
          ))}
        </div>
        <div className={`${styles.darkBlock} dark`}>
          <div className={styles.row}>
            {cases.slice(0, 3).map((entry) => (
              <Card key={`echo-dark-${entry.slug}`} studyCase={entry} title="Product Echo · tamna">
                <ProductEcho studyCase={entry} />
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.concept}>
        <div className={styles.conceptHead}>
          <h2>2 · Material Signature</h2>
          <p>
            Jedan trag po grupi, koji opisuje <em>radnju</em>, ne oblik: abraziv
            troši površinu, glet se razvlači sečivom, folija se preklapa. Trag
            prolazi iza proizvoda i izlazi sa obe strane — isto prostorno pravilo
            koje već koristi odobrena spray kompozicija.
          </p>
        </div>
        <div className={styles.row}>
          <Card studyCase={first("abrazivi")} title="Trenje — abrazivi">
            <MaterialSignature kind="friction" studyCase={first("abrazivi")} />
          </Card>
          <Card studyCase={first("kitovi")} title="Razvlačenje — kitovi">
            <MaterialSignature kind="spread" studyCase={first("kitovi")} />
          </Card>
          <Card studyCase={first("zastita")} title="Preklop — zaštita">
            <MaterialSignature kind="fold" studyCase={first("zastita")} />
          </Card>
          <Card studyCase={first("poliranje")} title="Trenje — poliranje">
            <MaterialSignature kind="friction" studyCase={first("poliranje")} />
          </Card>
        </div>
        <div className={`${styles.darkBlock} dark`}>
          <div className={styles.row}>
            <Card studyCase={first("abrazivi")} title="Trenje · tamna">
              <MaterialSignature kind="friction" studyCase={first("abrazivi")} />
            </Card>
            <Card studyCase={first("kitovi")} title="Razvlačenje · tamna">
              <MaterialSignature kind="spread" studyCase={first("kitovi")} />
            </Card>
            <Card studyCase={first("zastita")} title="Preklop · tamna">
              <MaterialSignature kind="fold" studyCase={first("zastita")} />
            </Card>
          </div>
        </div>
      </section>

      <section className={styles.concept}>
        <div className={styles.conceptHead}>
          <h2>3 · Negative-space Reveal</h2>
          <p>
            Scena se gradi oduzimanjem: puna površina u tonu grupe iz koje je
            izrezan otvor. Proizvod je ono što otvor otkriva, pa je dekoracija
            odsustvo, a ne dodatak. Obrnuto od svake pozadine koju smo do sada
            probali.
          </p>
        </div>
        <div className={styles.row}>
          <Card studyCase={first("abrazivi")} title="Rez — traka">
            <NegativeSpace shape="band" studyCase={first("abrazivi")} tone="oklch(0.6 0.032 248)" />
          </Card>
          <Card studyCase={first("zastita")} title="Rez — traka">
            <NegativeSpace shape="band" studyCase={first("zastita")} tone="oklch(0.58 0.03 250)" />
          </Card>
          <Card studyCase={first("kitovi")} title="Rez — puna masa">
            <NegativeSpace shape="arch" studyCase={first("kitovi")} tone="oklch(0.66 0.036 92)" />
          </Card>
          <Card studyCase={first("poliranje")} title="Rez — puna masa">
            <NegativeSpace shape="arch" studyCase={first("poliranje")} tone="oklch(0.7 0.028 248)" />
          </Card>
        </div>
        <div className={`${styles.darkBlock} dark`}>
          <div className={styles.row}>
            <Card studyCase={first("abrazivi")} title="Rez · tamna">
              <NegativeSpace shape="band" studyCase={first("abrazivi")} tone="oklch(0.6 0.032 248)" />
            </Card>
            <Card studyCase={first("zastita")} title="Rez · tamna">
              <NegativeSpace shape="band" studyCase={first("zastita")} tone="oklch(0.58 0.03 250)" />
            </Card>
            <Card studyCase={first("kitovi")} title="Rez · tamna">
              <NegativeSpace shape="arch" studyCase={first("kitovi")} tone="oklch(0.66 0.036 92)" />
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
