"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { carsystemUseCases } from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

export function CarsystemUseCases({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const idPrefix = useId();
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const activeUseCase = carsystemUseCases[activeIndex];
  const activeProducts = activeUseCase.productSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is CarsystemProduct => Boolean(product))
    .slice(0, 6);

  function selectAndFocus(index: number) {
    const normalized =
      (index + carsystemUseCases.length) % carsystemUseCases.length;
    setActiveIndex(normalized);
    buttonRefs.current[normalized]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    if (event.key === "Home") selectAndFocus(0);
    else if (event.key === "End") selectAndFocus(carsystemUseCases.length - 1);
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      selectAndFocus(index + 1);
    } else {
      selectAndFocus(index - 1);
    }
  }

  return (
    <section
      id="use-cases"
      className={`${styles.section} ${styles.useCasesSection}`}
      aria-labelledby="carsystem-use-cases-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Izbor prema poslu</p>
          <h2 id="carsystem-use-cases-title">Šta danas radite u radionici?</h2>
        </div>
        <p>
          Izaberite zadatak da povežete praktičnu potrebu sa postojećim
          Carsystem kategorijama i proizvodima.
        </p>
      </header>

      <div className={styles.useCasesLayout}>
        <div
          className={styles.useCaseTabs}
          role="tablist"
          aria-label="Izaberite radionički posao"
          aria-orientation="vertical"
        >
          {carsystemUseCases.map((useCase, index) => (
            <button
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              id={`${idPrefix}-${useCase.id}-tab`}
              role="tab"
              aria-controls={`${idPrefix}-use-case-panel`}
              aria-selected={activeIndex === index}
              data-active={activeIndex === index || undefined}
              tabIndex={activeIndex === index ? 0 : -1}
              key={useCase.id}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {useCase.label}
              <i aria-hidden="true">↗</i>
            </button>
          ))}
        </div>

        <div
          id={`${idPrefix}-use-case-panel`}
          className={styles.useCaseResult}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-${activeUseCase.id}-tab`}
          key={activeUseCase.id}
        >
          <div className={styles.useCaseResultHeader}>
            <p>Preporučeni tok</p>
            <h3>{activeUseCase.title}</h3>
            <span>{activeUseCase.description}</span>
            <ol className={styles.useCaseSequence} aria-label="Redosled kategorija za ovaj posao">
              {activeUseCase.categories.map((category, index) => (
                <li key={category}>
                  <strong>{category}</strong>
                  {index < activeUseCase.categories.length - 1 ? (
                    <span aria-hidden="true">→</span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className={styles.useCaseSequenceNote}>
              Redosled kategorija, ne obavezna kompatibilnost tačno određenih
              artikala — konačan izbor potvrđuje se prema tehničkom listu.
            </p>
          </div>

          <div className={styles.useCaseProducts}>
            {activeProducts.map((product) => (
              <UseCaseProduct key={product.slug} product={product} />
            ))}
          </div>

          <Link className={styles.primaryButton} href={activeUseCase.href}>
            Otvorite preporučene proizvode
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function UseCaseProduct({ product }: { product: CarsystemProduct }) {
  const image = product.productImage ?? product.galleryImages[0] ?? null;

  return (
    <Link href={`/proizvodi/${product.slug}`}>
      <span className={styles.useCaseProductImage}>
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 64rem) 11rem, 42vw"
          />
        ) : (
          <strong aria-hidden="true">CS</strong>
        )}
      </span>
      <span>
        <small>{product.programSlug.replaceAll("-", " ")}</small>
        <strong>{product.name}</strong>
      </span>
      <i aria-hidden="true">↗</i>
    </Link>
  );
}
