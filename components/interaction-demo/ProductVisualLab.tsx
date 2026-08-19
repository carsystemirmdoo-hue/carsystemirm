import Image from "next/image";
import { LabScene, type LabSceneKind } from "@/components/interaction-demo/LabScene";
import {
  IconRainPileScene,
  type IconRainVariant,
} from "@/components/interaction-demo/IconRainPileScene";
import {
  IconRainPileSceneV2,
  type IconRainV2Variant,
} from "@/components/interaction-demo/IconRainPileSceneV2";
import { RAIN_VARIANTS, totalDuration } from "@/components/interaction-demo/iconRainPile.mjs";
import { V2_VARIANTS, totalDurationV2 } from "@/components/interaction-demo/iconRainPileV2.mjs";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import fitStyles from "@/components/product/ProductImageFit.generated.module.css";
import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
} from "@/lib/carsystem-data";
import {
  getProductVisualRecipe,
  resolveSceneAccent,
} from "@/lib/product-visual-recipe";
import { getProductCategorySlug } from "@/lib/product-taxonomy";
import styles from "./ProductVisualLab.module.css";

/**
 * Product visual lab — INTERNAL. Not linked from any public navigation and
 * excluded from indexing by `app/interaction-demo/layout.tsx`.
 *
 * Everything on this page is a real catalogue record with its real render.
 * Nothing is mocked: if a product has no image in `public/`, it appears here
 * with that gap visible rather than with a substitute product standing in for
 * it, because the point of the page is to show what the system actually has to
 * cope with.
 */

/**
 * The review sample. Chosen to cover every geometry and colour case the
 * catalogue actually contains — tall and narrow, squat and wide, black, white,
 * a confirmed shade, no shade at all, a heavily padded file, a file with none,
 * a family variant, a very long name, a vector illustration with no measurable
 * content box, and a record with no render at all.
 */
const SAMPLE: { slug: string; why: string }[] = [
  {
    slug: "cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
    why: "Referentni slučaj: crn proizvod, visok i uzak, potvrđena nijansa (cap-sample).",
  },
  {
    slug: "cosmos-lac-molotow-burner-600-ml-mb-600ml-copper",
    why: "Najuži sadržaj u katalogu (aspect 0.257) — test krajnje vitkog oblika.",
  },
  {
    slug: "cosmos-lac-home-400-400-ml-white-smalto-400-white",
    why: "Vrlo svetao proizvod na svetloj podlozi — obrnuti kontrastni rizik.",
  },
  {
    slug: "cosmos-lac-easy-max-cl-800-ral-9010-400-ml-easy-max-ral-9010-800-white",
    why: "RAL-potvrđena boja (paletteSource = variant).",
  },
  {
    slug: "cosmos-lac-flame-blue-fb-106-400-ml-flame-blue-fb-106-signal-yellow",
    why: "Jaka potvrđena boja iz zvanične karte + član multi-variant porodice.",
  },
  {
    slug: "cosmos-lac-fluorescent-marking-591-road-construction-marking-591-orange",
    why: "Najduži naziv proizvoda — test preloma naslova na PDP-u.",
  },
  {
    slug: "b-2p93-uv-bodyfill-r",
    why: "Najgore transparentne margine: sadržaj zauzima 20% širine fajla.",
  },
  {
    slug: "rm-body-filler-white-b-2e11",
    why: "Nizak i širok (aspect 1.88), JPG bez alfa kanala — trim po ivičnoj pozadini.",
  },
  {
    slug: "carsystem-git-elastic-weiss",
    why: "Širok kit, taman ton, PNG koji skoro popunjava platno.",
  },
  {
    slug: "carsystem-p19-brusni-diskovi",
    why: "Abraziv, kvadratno platno bez margina (fill 1.0) — scena bez boje.",
  },
  {
    slug: "carsystem-f19-brusni-diskovi",
    why: "Abraziv, vrlo taman — non-color grupa sa kontrastnim rizikom.",
  },
  {
    slug: "carsystem-finish-serija",
    why: "Poliranje, sadržaj popunjava 94% platna — suprotnost referentnom slučaju.",
  },
  {
    slug: "2520-onyx-easy-blender",
    why: "R-M, vrlo svetla ambalaža, bez atributa boje.",
  },
  {
    slug: "rm-pasta-190-5l",
    why: "Veće pakovanje (5 L) — gornji kraj S/M/L/XL lestvice.",
  },
  {
    slug: "carfit-maskirna-folija-4x5m",
    why: "Maskiranje, skoro kvadratan sadržaj, četvrti brend.",
  },
  {
    slug: "baslac-60-20-razredjivac",
    why: "Baslac, razređivač — boja nije atribut proizvoda.",
  },
  {
    slug: "befar-sundjer-crni-25x150",
    why: "SVG ilustracija: nema izmerenog content box-a, pada na canvas-fit fallback.",
  },
  {
    slug: "norbin-n15-020-5l",
    why: "Nema slike proizvoda — evidentiran nedostatak, bez zamene.",
  },
];

/**
 * The four directions strong enough to review in context. Each is shown in the
 * three surfaces it would actually have to survive, because a scene that only
 * works at one aspect ratio is a picture, not a system.
 */
const DIRECTIONS: {
  kind: LabSceneKind;
  slug: string;
  title: string;
  maturity: "production-ready" | "needs refinement" | "experiment only";
  note: string;
}[] = [
  {
    kind: "controlled-graffiti",
    slug: "cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
    title: "Kontrolisani grafit — sprejevi (654 proizvoda)",
    maturity: "production-ready",
    note: "Jedini pravac koji je već na javnom PDP-u (spray-draw). Meki rub i overspray sada čitaju kao prolaz spreja, ne kao potez markerom.",
  },
  {
    kind: "material-layers",
    slug: "carsystem-p19-brusni-diskovi",
    title: "Material layers — abrazivi i maskiranje (6 proizvoda)",
    maturity: "needs refinement",
    note: "Stepenasta ivica čita kao presek prebrušene reparature. Populacija je premala da opravda zaseban jezik — kandidat za spajanje sa blueprint pravcem.",
  },
  {
    kind: "material-trace",
    slug: "b-2p93-uv-bodyfill-r",
    title: "Material trace — kitovi, lepkovi, zaštita (34 proizvoda)",
    maturity: "needs refinement",
    note: "Trag povučen gletericom sa rebrima i istanjenim krajem. Rizik: na svetloj podlozi ume da izgleda kao mrlja — traži proveru na tamnoj temi.",
  },
  {
    kind: "blueprint",
    slug: "carfit-maskirna-folija-4x5m",
    title: "Blueprint — oprema, radionica, čišćenje (22 proizvoda)",
    maturity: "needs refinement",
    note: "Konstrukciona geometrija bez ijedne skale: niz crtica bi čitao kao mera, a ovi proizvodi je ne objavljuju.",
  },
];

/** The three icon-rain variants under review. */
const RAIN_SHOWCASE: {
  variant: IconRainVariant;
  slug: string;
  title: string;
  maturity: string;
  note: string;
}[] = [
  {
    variant: "precise",
    slug: "carsystem-p19-brusni-diskovi",
    title: "A · Precise icon rain",
    maturity: "needs refinement",
    note: "Sitnije ikonice, uzak pojas otpuštanja, mala rotacija, zbijena gomila. Najpremijumnije i najmirnije — kandidat za stranice grupa.",
  },
  {
    variant: "spill",
    slug: "carsystem-finish-serija",
    title: "B · Workshop spill",
    maturity: "experiment only",
    note: "Mešane veličine, šire rasipanje, četiri komada koja se zaustave izvan gomile. Deluje kao materijal prosut na radnom stolu; najlakše sklizne u neozbiljno.",
  },
  {
    variant: "cascade",
    slug: "carfit-maskirna-folija-4x5m",
    title: "C · Structured cascade",
    maturity: "needs refinement",
    note: "Četiri fiksne kolone, niska i široka osnova ispod proizvoda. Najmirnija i najviše B2B varijanta.",
  },
];

/* ------------------------------------------------------------------ */
/* Icon rain — which implementation the lab shows                     */
/* ------------------------------------------------------------------ */

export type RainView = "v1" | "v2" | "compare";

/**
 * THE ONE LINE THAT REVERTS THE LAB TO V1.
 *
 * Set this to `"v1"` and the page shows only the V1 scenes again, regardless of
 * the `?rain=` parameter's absence. `?rain=v1` does the same thing per-visit.
 * No production surface reads this — it exists purely so V2 can be withdrawn
 * without touching anything else.
 */
const RAIN_DEFAULT_VIEW: RainView = "compare";

export function isRainView(value: string | undefined): value is RainView {
  return value === "v1" || value === "v2" || value === "compare";
}

/**
 * Products used for the V2 evidence.
 *
 * All four have genuine alpha transparency (`boxSource: "alpha"` in the metrics
 * manifest). The Car Fit masking film that appeared in the earlier context row
 * is deliberately absent: it is a JPG with a baked white background, so it
 * renders as a white rectangle on the plate and would prove nothing about the
 * scene behind it. That gap is recorded in the handoff rather than worked
 * around — the file is not edited and no substitute product is invented.
 */
const V2_CASES: {
  slug: string;
  label: string;
  why: string;
}[] = [
  {
    slug: "cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
    label: "Visok · crn",
    why: "Visok i uzak, very-dark — najteži slučaj za tamnu temu.",
  },
  {
    slug: "carsystem-p19-brusni-diskovi",
    label: "Kružan · srednji ton",
    why: "Kružan oblik, aspect 1.0, alpha PNG — glavni kandidat za grupu abrazivi.",
  },
  {
    slug: "carsystem-f19-brusni-diskovi",
    label: "Kružan · crn",
    why: "Isti oblik, very-dark — proverava halo na kružnom proizvodu.",
  },
  {
    slug: "cosmos-lac-home-400-400-ml-white-smalto-400-white",
    label: "Svetao",
    why: "very-light na svetloj podlozi — obrnuti kontrastni rizik.",
  },
];

function loadSample() {
  return SAMPLE.map((entry) => {
    const product = getCarsystemProductBySlug(entry.slug);
    if (!product) return null;
    const recipe = getProductVisualRecipe(product);
    return {
      ...entry,
      product,
      recipe,
      category: getProductCategorySlug(product),
      brandName: getCarsystemBrandBySlug(product.brandSlug)?.name ?? product.brandSlug,
    };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

type SampleEntry = ReturnType<typeof loadSample>[number];

function SceneCard({
  entry,
  kind,
  label,
  scaleClass,
  legacy = false,
  frameClass,
  haloOverride,
}: {
  entry: SampleEntry;
  kind: LabSceneKind;
  label: string;
  scaleClass?: string;
  legacy?: boolean;
  /** Overrides the scene's aspect ratio so one direction can be judged in the
   *  catalog card, the PDP panel and the group hero side by side. */
  frameClass?: string;
  haloOverride?: string;
}) {
  const { product, recipe } = entry;
  const image = product.productImage;
  const hasImage = Boolean(image && !image.src.includes("placeholder-product"));
  /*
   * Colour-led scenes take the product's palette; technical and material scenes
   * take the neutral group tone. Without this rule a blueprint behind a masking
   * film was drawn in the packaging's red — which reads as a colour claim the
   * product never makes.
   */
  const sceneAccents =
    kind === "pigment-field" || kind === "controlled-graffiti" || kind === "swatch-ladder"
      ? recipe.accentColors
      : resolveSceneAccent({ ...recipe, sceneKind: "technical" });
  const accent = sceneAccents[0] ?? "#7a8290";
  const accent2 = sceneAccents[1] ?? accent;
  const halo =
    haloOverride ??
    (recipe.contrastMode === "dark-product"
      ? "oklch(0.74 0.012 250 / 0.34)"
      : recipe.contrastMode === "light-product"
        ? "oklch(0.34 0.014 250 / 0.16)"
        : undefined);

  return (
    <div className={styles.card}>
      <div
        className={`${styles.scene} ${frameClass ?? ""} ${fitStyles.fit}`}
        data-product-fit={hasImage ? image?.src : undefined}
        style={halo ? ({ "--lab-halo": halo } as React.CSSProperties) : undefined}
      >
        <div className={styles.sceneArt} aria-hidden="true">
          <LabScene kind={kind} accent={accent} accent2={accent2} seed={recipe.seed} />
        </div>
        <div className={styles.sceneHalo} aria-hidden="true" />
        {hasImage && image ? (
          <div
            className={`${legacy ? styles.legacyProduct : styles.sceneProduct} ${scaleClass ?? ""}`}
          >
            <Image src={image.src} alt={image.alt} fill sizes="320px" />
          </div>
        ) : (
          <div className={styles.sceneProduct}>
            <span className={styles.tag}>slika nedostaje</span>
          </div>
        )}
      </div>
      <div className={styles.cardMeta}>
        <strong>{label}</strong>
      </div>
    </div>
  );
}

function ContactCard({ entry }: { entry: SampleEntry }) {
  const { product, recipe, category, brandName } = entry;
  const metrics = recipe.metrics;
  const brand = getCarsystemBrandBySlug(product.brandSlug);

  return (
    <div className={styles.card}>
      {brand ? (
        <ProductVisualSurface
          brandName={brandName}
          product={product}
          sizes="260px"
        />
      ) : null}
      <div className={styles.cardMeta}>
        <strong>{product.name}</strong>
        <dl>
          <dt>slug</dt>
          <dd>{product.slug}</dd>
          <dt>grupa</dt>
          <dd>{category ?? "—"}</dd>
          <dt>slika</dt>
          <dd>{product.productImage?.src ?? "—"}</dd>
          <dt>platno</dt>
          <dd>{metrics ? `${metrics.w}×${metrics.h}` : "nije mereno"}</dd>
          <dt>sadržaj</dt>
          <dd>
            {metrics
              ? `${metrics.box[2]}×${metrics.box[3]} (${Math.round(metrics.fx * 100)}%×${Math.round(metrics.fy * 100)}%)`
              : "—"}
          </dd>
          <dt>skala</dt>
          <dd>{recipe.productScale}</dd>
          <dt>paleta</dt>
          <dd>{recipe.paletteSource}</dd>
          <dt>scena</dt>
          <dd>{recipe.sceneKind}</dd>
          <dt>kontrast</dt>
          <dd>{recipe.contrastMode}</dd>
        </dl>
        <p className={styles.note}>{entry.why}</p>
      </div>
    </div>
  );
}

/**
 * One icon-rain card, in either implementation.
 *
 * Both versions receive the same product, the same seed and the same frame, so
 * a side-by-side row differs only in the implementation being judged. The
 * wrapper carries the identifying attributes rather than the scene component,
 * because V1 must not be modified to support this comparison.
 */
function RainCard({
  case: rainCase,
  entry,
  theme,
  variant,
  version,
}: {
  case: { slug: string; label: string; why: string };
  entry: SampleEntry;
  theme: "light" | "dark";
  variant: IconRainV2Variant;
  version: "v1" | "v2";
}) {
  const image = entry.product.productImage;
  const frameClass = `${styles.rainFrame} ${fitStyles.fit}`;
  const productNode = image ? (
    <Image src={image.src} alt={image.alt} fill sizes="360px" />
  ) : null;

  return (
    <div
      className={styles.card}
      data-rain-showcase={variant}
      data-rain-version={version}
      data-rain-theme={theme}
      data-rain-case={rainCase.slug}
    >
      {version === "v1" ? (
        <IconRainPileScene
          categorySlug={entry.category}
          className={frameClass}
          seed={entry.recipe.seed}
          showReplay
          variant={variant as IconRainVariant}
        >
          <div className={styles.rainProduct} data-product-fit={image?.src}>
            {productNode}
          </div>
        </IconRainPileScene>
      ) : (
        <IconRainPileSceneV2
          categorySlug={entry.category}
          className={frameClass}
          contrastMode={entry.recipe.contrastMode}
          seed={entry.recipe.seed}
          showReplay
          theme={theme}
          variant={variant}
        >
          <div data-product-fit={image?.src} style={{ position: "absolute", inset: 0 }}>
            {productNode}
          </div>
        </IconRainPileSceneV2>
      )}
      <div className={styles.cardMeta}>
        <strong>
          {version.toUpperCase()} · {rainCase.label}
        </strong>
        <dl>
          <dt>proizvod</dt>
          <dd>{entry.product.name}</dd>
          <dt>kontrast</dt>
          <dd>{entry.recipe.contrastMode}</dd>
          <dt>ikonica</dt>
          <dd>
            {version === "v1"
              ? RAIN_VARIANTS[variant].count
              : V2_VARIANTS[variant].count}
          </dd>
        </dl>
      </div>
    </div>
  );
}

export function ProductVisualLab({ rainView }: { rainView?: RainView } = {}) {
  const view: RainView = rainView ?? RAIN_DEFAULT_VIEW;
  const showV1 = view === "v1" || view === "compare";
  const showV2 = view === "v2" || view === "compare";
  const sample = loadSample();
  const byslug = (slug: string) => sample.find((entry) => entry.product.slug === slug);

  const reference = byslug(
    "cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
  );
  const white = byslug("cosmos-lac-home-400-400-ml-white-smalto-400-white");
  const colour = byslug(
    "cosmos-lac-flame-blue-fb-106-400-ml-flame-blue-fb-106-signal-yellow",
  );
  const abrasive = byslug("carsystem-p19-brusni-diskovi");
  const tool = byslug("carfit-maskirna-folija-4x5m");
  const padded = byslug("b-2p93-uv-bodyfill-r");

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <span className={styles.kicker}>Interno · nije javna stranica</span>
        <h1>Product Visual Lab</h1>
        <p>
          Poređenje pozadinskih scena, skale i kontrasta na <strong>stvarnim</strong>{" "}
          proizvodima iz kataloga. Nijedan proizvod, naziv, zapremina ni boja nisu
          izmišljeni — sve dolazi iz postojećih zapisa i iz izmerenih piksela
          zvaničnih renderа.
        </p>
        <p>
          Produkcijski je uveden samo geometrijski i kontrastni sloj (fit po
          sadržaju slike, slojevita scena, kontrastni ton dekoracije). Scene
          ispod su predlozi za reviziju i <strong>ne</strong> postoje na javnim
          stranicama.
        </p>
        <nav className={styles.toc}>
          <a href="#kontakt-list">Kontakt list</a>
          <a href="#pre-posle">Pre / posle</a>
          <a href="#skala">S / M / L / XL</a>
          <a href="#scene">Scene</a>
          <a href="#tema">Svetla / tamna</a>
          <a href="#konteksti">Pravci u kontekstu</a>
          <a href="#icon-rain">Icon rain → pile</a>
        </nav>
      </header>

      <section className={styles.section} id="kontakt-list">
        <div className={styles.sectionHead}>
          <h2>1 · Kontakt list — {sample.length} stvarnih proizvoda</h2>
          <p>
            Produkcijska <code>ProductVisualSurface</code> komponenta, ista koja se
            koristi u katalogu. Ispod svake kartice su izmerene vrednosti iz
            <code> data/product-image-metrics.generated.json</code>.
          </p>
        </div>
        <div className={styles.gridWide}>
          {sample.map((entry) => (
            <ContactCard entry={entry} key={entry.product.slug} />
          ))}
        </div>
      </section>

      {reference ? (
        <section className={styles.section} id="pre-posle">
          <div className={styles.sectionHead}>
            <h2>2 · Pre / posle — referentni Cosmos Lac Flame Booster</h2>
            <p>
              Leva kolona reprodukuje raniju geometriju: skala primenjena na fajl
              (66% uz plafon od 260 px), pa proizvod zauzima udeo koji zavisi od
              transparentne margine. Desne kolone primenjuju istu skalu na
              izmereni content box.
            </p>
          </div>
          <div className={styles.grid}>
            <SceneCard
              entry={reference}
              kind="controlled-graffiti"
              label="Pre — skala na fajl, boja poteza = boja proizvoda"
              legacy
              haloOverride="transparent"
            />
            <SceneCard
              entry={reference}
              kind="controlled-graffiti"
              label="Posle — fit po sadržaju, isti potez"
              haloOverride="transparent"
            />
            <SceneCard
              entry={reference}
              kind="controlled-graffiti"
              label="Posle + svetliji graphite potez"
            />
            <SceneCard
              entry={reference}
              kind="neutral"
              label="Posle + neutralni halo, bez poteza"
            />
          </div>
          <p className={styles.note}>
            Merenja na 1440 px: raniji prikaz je davao proizvod visine ~222 px u
            panelu od 634 px (35%); novi daje 476 px u panelu od 645 px (74%) —
            oko 2,1× veći optički prikaz, bez promene slike i bez ručnih margina.
          </p>
        </section>
      ) : null}

      {reference ? (
        <section className={styles.section} id="skala">
          <div className={styles.sectionHead}>
            <h2>3 · S / M / L / XL na istom proizvodu</h2>
            <p>
              Ista slika, četiri koraka lestvice. Sada mere siluetu, ne fajl, pa
              je razlika između koraka konzistentna za sve proizvode bez obzira na
              to koliko praznog prostora njihov render ima.
            </p>
          </div>
          <div className={styles.grid}>
            <SceneCard entry={reference} kind="neutral" label="S — 58 / 74" scaleClass={styles.scaleS} />
            <SceneCard entry={reference} kind="neutral" label="M — 66 / 80" scaleClass={styles.scaleM} />
            <SceneCard entry={reference} kind="neutral" label="L — 74 / 86" scaleClass={styles.scaleL} />
            <SceneCard entry={reference} kind="neutral" label="XL — 82 / 92" scaleClass={styles.scaleXL} />
          </div>
        </section>
      ) : null}

      <section className={styles.section} id="scene">
        <div className={styles.sectionHead}>
          <h2>4 · Predlozi scena po stvarnim grupama</h2>
          <p>
            Scene sa bojom se koriste samo kad je boja potvrđen atribut proizvoda.
            Za sve ostale grupe scena je bez boje — neutralni ton grupe, nikad
            pretpostavljena nijansa.
          </p>
        </div>
        <div className={styles.gridWide}>
          {colour ? (
            <SceneCard entry={colour} kind="pigment-field" label="A · Pigmentno polje — boje (Flame Blue FB-106) · needs refinement" />
          ) : null}
          {reference ? (
            <SceneCard entry={reference} kind="controlled-graffiti" label="B · Kontrolisani grafit — sprejevi (Flame Booster B-901) · production-ready" />
          ) : null}
          {abrasive ? (
            <SceneCard
              entry={abrasive}
              kind="material-layers"
              label="C · Material layers — abrazivi (P19) · needs refinement"
            />
          ) : null}
          {tool ? (
            <SceneCard entry={tool} kind="blueprint" label="D · Blueprint — oprema / radionica (Car Fit folija) · needs refinement" />
          ) : null}
          {padded ? (
            <SceneCard entry={padded} kind="material-trace" label="E · Material trace — kitovi (B 2P93 UV Bodyfill-R) · needs refinement" />
          ) : null}
          {colour ? (
            <SceneCard entry={colour} kind="exploded-halo" label="F · Exploded halo — sistemi i setovi · experiment only" />
          ) : null}
          {reference ? (
            <SceneCard entry={reference} kind="silhouette-field" label="G · Repeated silhouettes — porodice · experiment only" />
          ) : null}
          {white ? (
            <SceneCard entry={white} kind="cross-section" label="H · Cross-section — zaštita i slojevi · experiment only" />
          ) : null}
          {colour ? (
            <SceneCard entry={colour} kind="swatch-ladder" label="I · Swatch ladder — color porodice · experiment only" />
          ) : null}
          {abrasive ? (
            <SceneCard entry={abrasive} kind="grain-arc" label="J · Grain arc — poliranje i abrazivi · experiment only" />
          ) : null}
        </div>
      </section>

      <section className={styles.section} id="tema">
        <div className={styles.sectionHead}>
          <h2>5 · Svetla i tamna tema — kritični kontrastni slučajevi</h2>
          <p>
            Crn proizvod u tamnoj temi i beo proizvod u svetloj temi su isti bag
            iz dva smera. Halo i ton dekoracije se biraju iz izmerene svetline
            proizvoda, pa oba slučaja ostaju čitljiva.
          </p>
        </div>
        <div className={styles.grid}>
          {reference ? (
            <SceneCard entry={reference} kind="controlled-graffiti" label="Svetla tema · crn proizvod" />
          ) : null}
          {white ? (
            <SceneCard entry={white} kind="controlled-graffiti" label="Svetla tema · beo proizvod" />
          ) : null}
        </div>
        <div className={`${styles.darkFrame} dark`} style={{ marginTop: "1.1rem" }}>
          <div className={styles.grid}>
            {reference ? (
              <SceneCard entry={reference} kind="controlled-graffiti" label="Tamna tema · crn proizvod" />
            ) : null}
            {white ? (
              <SceneCard entry={white} kind="controlled-graffiti" label="Tamna tema · beo proizvod" />
            ) : null}
          </div>
        </div>
      </section>

      {abrasive && colour && padded ? (
        <section className={styles.section} id="konteksti">
          <div className={styles.sectionHead}>
            <h2>6 · Četiri najjača pravca u tri stvarna konteksta</h2>
            <p>
              Ista scena, ista skala, tri različite površine: katalog kartica
              (1.1∶1), PDP panel (5∶6) i group hero (16∶9). Pravac koji radi samo
              u jednom formatu nije pravac nego jedna slika.
            </p>
          </div>
          {DIRECTIONS.map((direction) => {
            const entry = byslug(direction.slug);
            if (!entry) return null;
            return (
              <div className={styles.directionRow} key={direction.kind}>
                <div className={styles.directionHead}>
                  <strong>{direction.title}</strong>
                  <span className={styles.tag} data-maturity={direction.maturity}>
                    {direction.maturity}
                  </span>
                  <p>{direction.note}</p>
                </div>
                <div className={styles.contextRow}>
                  <SceneCard
                    entry={entry}
                    kind={direction.kind}
                    label="Katalog kartica · 1.1∶1"
                    frameClass={styles.contextCard}
                  />
                  <SceneCard
                    entry={entry}
                    kind={direction.kind}
                    label="PDP panel · 5∶6"
                    frameClass={styles.contextPdp}
                  />
                  <SceneCard
                    entry={entry}
                    kind={direction.kind}
                    label="Group hero · 16∶9"
                    frameClass={styles.contextHero}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {abrasive && showV1 ? (
        <section className={styles.section} id="icon-rain">
          <div className={styles.sectionHead}>
            <h2>7 · Icon rain → pile — V1 (stvarna animacija)</h2>
            <p>
              Ovo <strong>nisu</strong> dva statična kadra. Svaka ikonica ima
              četiri unapred izračunate tačke — otpuštanje iznad okvira, prvi
              kontakt koji prelazi liniju mirovanja, odskok i konačni položaj — a
              CSS interpolira između njih. Nema physics biblioteke, nema
              JavaScript-a po frejmu.
            </p>
            <p>
              Pokreće se jednom, pri prvom ulasku u viewport. Ukupno{" "}
              <strong>{totalDuration()} ms</strong>. Mirno stanje je već gotova
              gomila, pa je to i ono što vidi server, `prefers-reduced-motion` i
              čitalac bez JavaScript-a. Ikonice dolaze iz stvarne kategorije
              proizvoda — abrazivna scena nikad ne pušta sprej limenke.
            </p>
            <p className={styles.note}>
              Replay dugme postoji samo ovde. Produkcijske površine ga ne
              prosleđuju, a nijedna javna ruta ne uvozi ovu komponentu.
            </p>
          </div>

          <div className={styles.gridWide}>
            {RAIN_SHOWCASE.map((showcase) => {
              const entry = byslug(showcase.slug) ?? abrasive;
              const image = entry.product.productImage;
              const variantConfig = RAIN_VARIANTS[showcase.variant];

              return (
                <div
                  className={styles.card}
                  data-rain-showcase={showcase.variant}
                  data-rain-theme="light"
                  key={showcase.variant}
                >
                  <IconRainPileScene
                    categorySlug={entry.category}
                    className={`${styles.rainFrame} ${fitStyles.fit}`}
                    seed={entry.recipe.seed}
                    showReplay
                    variant={showcase.variant}
                  >
                    <div
                      className={styles.rainProduct}
                      data-product-fit={image?.src}
                    >
                      {image ? (
                        <Image src={image.src} alt={image.alt} fill sizes="360px" />
                      ) : null}
                    </div>
                  </IconRainPileScene>
                  <div className={styles.cardMeta}>
                    <strong>{showcase.title}</strong>
                    <dl>
                      <dt>proizvod</dt>
                      <dd>{entry.product.name}</dd>
                      <dt>grupa</dt>
                      <dd>{entry.category ?? "—"}</dd>
                      <dt>ikonica</dt>
                      <dd>{variantConfig.count} kom</dd>
                      <dt>trajanje</dt>
                      <dd>{totalDuration()} ms</dd>
                      <dt>zrelost</dt>
                      <dd>{showcase.maturity}</dd>
                    </dl>
                    <p className={styles.note}>{showcase.note}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`${styles.darkFrame} dark`} style={{ marginTop: "1.4rem" }}>
            <div className={styles.gridWide}>
              {RAIN_SHOWCASE.map((showcase) => {
                const entry = byslug(showcase.slug) ?? abrasive;
                const image = entry.product.productImage;
                return (
                  <div
                    className={styles.card}
                    data-rain-showcase={showcase.variant}
                    data-rain-theme="dark"
                    key={`dark-${showcase.variant}`}
                  >
                    <IconRainPileScene
                      categorySlug={entry.category}
                      className={`${styles.rainFrame} ${fitStyles.fit}`}
                      seed={entry.recipe.seed}
                      showReplay
                      variant={showcase.variant}
                    >
                      <div className={styles.rainProduct} data-product-fit={image?.src}>
                        {image ? (
                          <Image src={image.src} alt={image.alt} fill sizes="360px" />
                        ) : null}
                      </div>
                    </IconRainPileScene>
                    <div className={styles.cardMeta}>
                      <strong>{showcase.title} · tamna tema</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {showV2 ? (
        <section className={styles.section} id="icon-rain-v2">
          <div className={styles.sectionHead}>
            <h2>8 · Icon rain → pile V2</h2>
            <p>
              V1 je i dalje netaknuta i, u <code>compare</code> režimu, prikazana
              iznad. V2 živi u zasebnim fajlovima
              (<code>IconRainPileSceneV2.tsx</code>,{" "}
              <code>iconRainPileV2.mjs</code>) — brisanjem ta tri fajla i jednog
              lab importa V2 nestaje bez traga.
            </p>
            <p>
              Promene: tačno <strong>24</strong> ikonice umesto 28–34,{" "}
              <strong>1,3–1,6× veće</strong>, najviše {V2_VARIANTS.cascade.glyphVariety}{" "}
              različita oblika po kategoriji, manja rotacija, niska i široka
              gomila sa osnovom koja nosi, senka koja prati{" "}
              <em>stvarnu širinu gomile</em>, i faza{" "}
              <code>complete</code> koja skida <code>will-change</code> kad
              poslednja ikonica sleti. Ukupno {totalDurationV2()} ms.
            </p>
            <p className={styles.note}>
              <code>?rain=v1</code> · <code>?rain=v2</code> ·{" "}
              <code>?rain=compare</code> (podrazumevano). Trajni povratak na V1:
              <code> RAIN_DEFAULT_VIEW = &quot;v1&quot;</code> u
              <code> components/interaction-demo/ProductVisualLab.tsx</code>.
            </p>
          </div>

          {(["cascade", "precise"] as IconRainV2Variant[]).map((variant) => (
            <div className={styles.directionRow} key={`v2-${variant}`}>
              <div className={styles.directionHead}>
                <strong>
                  {variant === "cascade"
                    ? "Structured Cascade V2 — primarni kandidat"
                    : "Precise V2 — rezervni smer"}
                </strong>
                <span className={styles.tag}>
                  {V2_VARIANTS[variant].count} ikonica ·{" "}
                  {V2_VARIANTS[variant].columns > 0
                    ? `${V2_VARIANTS[variant].columns} kolone`
                    : "slobodne putanje"}{" "}
                  · ±{V2_VARIANTS[variant].restRotationRange}°
                </span>
              </div>
              <div className={styles.gridWide}>
                {V2_CASES.map((entry) => {
                  const sampleEntry = byslug(entry.slug);
                  if (!sampleEntry) return null;
                  return (
                    <RainCard
                      case={entry}
                      entry={sampleEntry}
                      key={`${variant}-${entry.slug}`}
                      theme="light"
                      variant={variant}
                      version="v2"
                    />
                  );
                })}
              </div>
            </div>
          ))}

          <div className={`${styles.darkFrame} dark`}>
            <div className={styles.directionHead}>
              <strong style={{ color: "oklch(0.93 0.008 255)" }}>
                Tamna tema — crn proizvod mora ostati čitljiv
              </strong>
            </div>
            <div className={styles.gridWide}>
              {V2_CASES.map((entry) => {
                const sampleEntry = byslug(entry.slug);
                if (!sampleEntry) return null;
                return (
                  <RainCard
                    case={entry}
                    entry={sampleEntry}
                    key={`v2-dark-${entry.slug}`}
                    theme="dark"
                    variant="cascade"
                    version="v2"
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {view === "compare" ? (
        <section className={styles.section} id="icon-rain-compare">
          <div className={styles.sectionHead}>
            <h2>9 · V1 vs V2 — isti proizvod, isti seed, isti format</h2>
            <p>
              Levo V1, desno V2. Sve ostalo je izjednačeno: isti kataloški
              zapis, isti seed izveden iz sluga, isti odnos stranica, ista tema i
              isti viewport. Razlika koju vidite je isključivo razlika između dve
              implementacije.
            </p>
          </div>

          {(["cascade", "precise"] as IconRainV2Variant[]).map((variant) => (
            <div className={styles.directionRow} key={`cmp-${variant}`}>
              <div className={styles.directionHead}>
                <strong>
                  {variant === "cascade"
                    ? "V1 cascade vs Structured Cascade V2"
                    : "V1 precise vs Precise V2"}
                </strong>
                <p>
                  V1: {RAIN_VARIANTS[variant].count} ikonica,{" "}
                  {RAIN_VARIANTS[variant].sizeRange[0]}–
                  {RAIN_VARIANTS[variant].sizeRange[1]} cqw, ±
                  {RAIN_VARIANTS[variant].restRotationRange}° · V2:{" "}
                  {V2_VARIANTS[variant].count} ikonica,{" "}
                  {V2_VARIANTS[variant].sizeRange[0]}–
                  {V2_VARIANTS[variant].sizeRange[1]} cqw, ±
                  {V2_VARIANTS[variant].restRotationRange}°
                </p>
              </div>
              {V2_CASES.map((entry) => {
                const sampleEntry = byslug(entry.slug);
                if (!sampleEntry) return null;
                return (
                  <div
                    className={styles.compareRow}
                    data-compare-case={entry.slug}
                    data-compare-variant={variant}
                    key={`cmp-${variant}-${entry.slug}`}
                  >
                    <RainCard
                      case={entry}
                      entry={sampleEntry}
                      theme="light"
                      variant={variant}
                      version="v1"
                    />
                    <RainCard
                      case={entry}
                      entry={sampleEntry}
                      theme="light"
                      variant={variant}
                      version="v2"
                    />
                  </div>
                );
              })}
            </div>
          ))}

          <div className={`${styles.darkFrame} dark`}>
            <div className={styles.directionHead}>
              <strong style={{ color: "oklch(0.93 0.008 255)" }}>
                Crn proizvod u tamnoj temi — V1 levo, V2 desno
              </strong>
            </div>
            {V2_CASES.filter((entry) => entry.label.includes("crn")).map((entry) => {
              const sampleEntry = byslug(entry.slug);
              if (!sampleEntry) return null;
              return (
                <div
                  className={styles.compareRow}
                  data-compare-case={entry.slug}
                  data-compare-variant="cascade"
                  data-compare-theme="dark"
                  key={`cmp-dark-${entry.slug}`}
                >
                  <RainCard
                    case={entry}
                    entry={sampleEntry}
                    theme="dark"
                    variant="cascade"
                    version="v1"
                  />
                  <RainCard
                    case={entry}
                    entry={sampleEntry}
                    theme="dark"
                    variant="cascade"
                    version="v2"
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

    </main>
  );
}
