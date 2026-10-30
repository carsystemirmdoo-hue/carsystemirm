import Link from "next/link";
import type {
  ResolvedGuide,
  ResolvedProduct,
  ResolvedSource,
  SistemiProblem,
  SistemiScale,
  SourceRef,
} from "@/lib/sistemi/types";
import { sourceKey } from "@/lib/sistemi/keys";
import styles from "./Sistemi.styles";

/*
 * Delovi bez stanja, upotrebljivi i na serveru i u klijentskim komponentama stranica
 * „Sistemi i programi“.
 */

export function SourceList({
  refs,
  sources,
}: {
  refs?: SourceRef[];
  sources: Record<string, ResolvedSource>;
}) {
  const keys = [...new Set((refs ?? []).map(sourceKey))];
  const resolved = keys.map((key) => sources[key]).filter((source): source is ResolvedSource => Boolean(source));
  if (resolved.length === 0) return null;
  return (
    <div>
      <span className={styles.sourceLabel}>Izvor</span>
      <ul className={styles.sources}>
        {resolved.map((source) => (
          <li key={`${source.label}-${source.strana}`}>
            {source.href ? (
              <a href={source.href} rel="noopener noreferrer" target="_blank">
                {source.label}
              </a>
            ) : (
              source.label
            )}
            , str. {source.strana}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlaceholderIcon() {
  return (
    <svg aria-hidden="true" className={styles.productPlaceholder} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <rect height="16" rx="1.5" width="18" x="3" y="4" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

export function ProductCards({
  slugs,
  products,
}: {
  slugs?: string[];
  products: Record<string, ResolvedProduct>;
}) {
  const items = (slugs ?? [])
    .map((slug) => products[slug])
    .filter((product): product is ResolvedProduct => Boolean(product));
  if (items.length === 0) return null;
  return (
    <ul className={styles.productRow}>
      {items.map((product) => (
        <li className={styles.productCard} key={product.slug}>
          <span className={styles.productMedia}>
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- mala sličica; ista slika kao u katalogu
              <img alt="" decoding="async" height={56} loading="lazy" src={product.image.src} width={56} />
            ) : (
              <PlaceholderIcon />
            )}
          </span>
          <span className={styles.productText}>
            <span className={styles.productBrand}>{product.brandName}</span>
            <Link className={styles.productName} href={product.href}>
              {product.name}
            </Link>
            {product.document ? (
              <a
                className={styles.productDoc}
                href={product.document.href}
                rel={product.document.external ? "noopener noreferrer" : undefined}
                target="_blank"
              >
                {product.document.title}
                {product.document.external ? " (sajt proizvođača)" : ""}
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GuideLinks({ slugs, guides }: { slugs?: string[]; guides: Record<string, ResolvedGuide> }) {
  const items = (slugs ?? []).map((slug) => guides[slug]).filter((guide): guide is ResolvedGuide => Boolean(guide));
  if (items.length === 0) return null;
  return (
    <p className={styles.stepMaterial}>
      <strong>Vodič: </strong>
      {items.map((guide, index) => (
        <span key={guide.slug}>
          {index > 0 ? ", " : ""}
          <Link className={styles.textLink} href={guide.href}>
            {guide.title}
          </Link>
        </span>
      ))}
    </p>
  );
}

/** Položaj vrednosti na skali: deo-po-deo linearno između podeoka (redna skala). */
function position(value: number, ticks: number[]): number {
  if (ticks.length < 2) return 0;
  if (value <= ticks[0]) return 0;
  const last = ticks.length - 1;
  if (value >= ticks[last]) return 100;
  for (let index = 0; index < last; index += 1) {
    const from = ticks[index];
    const to = ticks[index + 1];
    if (value >= from && value <= to) {
      return ((index + (value - from) / (to - from)) / last) * 100;
    }
  }
  return 100;
}

export function ScaleView({
  scale,
  choice,
  sources,
}: {
  scale: SistemiScale;
  choice?: string;
  sources: Record<string, ResolvedSource>;
}) {
  const items = scale.items.filter((item) => !choice || !item.pods || item.pods.includes(choice));
  if (items.length === 0) return null;
  const ticks = scale.ticks ?? [];
  return (
    <figure className={styles.scale}>
      <figcaption className={styles.scaleTitle}>{scale.note ?? scale.title ?? "Vrednosti iz tehničkih listova"}</figcaption>
      <ul className={styles.scaleItems}>
        {items.map((item) => (
          <li className={styles.scaleItem} key={item.id}>
            <span className={styles.scaleName}>{item.name}</span>
            {ticks.length > 1 && item.bars?.length ? (
              <span aria-hidden="true" className={styles.scaleTrack}>
                {item.bars.map(([label, from, to, variant]) => {
                  const left = position(from, ticks);
                  const right = position(to, ticks);
                  return (
                    <span
                      className={styles.scaleBar}
                      data-variant={variant ?? "a"}
                      key={`${label}-${from}-${to}`}
                      style={{ left: `${left}%`, width: `${Math.max(right - left, 1.5)}%` }}
                    />
                  );
                })}
              </span>
            ) : null}
            {item.text ? <p className={styles.scaleText}>{item.text}</p> : null}
            <SourceList refs={[item.source]} sources={sources} />
          </li>
        ))}
      </ul>
      {ticks.length > 1 ? (
        <span aria-hidden="true" className={styles.scaleTicks}>
          {(scale.tickLabels ?? ticks.map(String)).map((tick, index) => (
            <span key={`${tick}-${index}`}>{tick}</span>
          ))}
        </span>
      ) : null}
      {scale.footer ? <p className={styles.scaleFooter}>{scale.footer}</p> : null}
    </figure>
  );
}

export function ProblemsList({
  problems,
  sources,
  guides,
}: {
  problems: SistemiProblem[];
  sources: Record<string, ResolvedSource>;
  guides: Record<string, ResolvedGuide>;
}) {
  return (
    <ul className={styles.problems}>
      {problems.map((problem) => (
        <li key={problem.title}>
          <details className={styles.problem}>
            <summary>{problem.title}</summary>
            <div className={styles.problemBody}>
              {problem.symptom ? (
                <p>
                  <strong>Kako izgleda: </strong>
                  {problem.symptom}
                </p>
              ) : null}
              {problem.causes?.length ? (
                <div>
                  <strong>Mogući uzroci</strong>
                  <ul>
                    {problem.causes.map((cause) => (
                      <li key={cause}>{cause}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {problem.check ? (
                <p>
                  <strong>Šta proveriti: </strong>
                  {problem.check}
                </p>
              ) : null}
              <GuideLinks guides={guides} slugs={problem.guides} />
              <SourceList refs={problem.sources} sources={sources} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
