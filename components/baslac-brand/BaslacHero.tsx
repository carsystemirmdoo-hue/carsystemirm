"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { baslacHeroSlides } from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

type BaslacHeroProduct = {
  alt: string;
  name: string;
  slug: string;
  src: string;
};

export function BaslacHero({
  products,
}: {
  products: BaslacHeroProduct[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeSlide = baslacHeroSlides[activeIndex];
  const visibleProducts = useMemo(() => products.slice(0, 4), [products]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (paused || mediaQuery.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % baslacHeroSlides.length);
    }, 8500);

    return () => window.clearInterval(timer);
  }, [paused]);

  function moveSlide(direction: number) {
    setActiveIndex(
      (current) =>
        (current + direction + baslacHeroSlides.length) %
        baslacHeroSlides.length,
    );
  }

  return (
    <section
      className={styles.hero}
      data-theme={activeSlide.theme}
      aria-labelledby="baslac-hero-title"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={styles.heroBackdrop} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <nav className={styles.breadcrumb} aria-label="Putanja stranice">
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong>baslac</strong>
      </nav>

      <div className={styles.heroStage} key={activeSlide.id}>
        <div className={styles.heroCopy}>
          <div className={styles.heroBrand}>
            <span className={styles.heroLogoPlate}>
              <Image
                src="/brands/baslac.svg"
                alt="baslac"
                width={100}
                height={89}
                priority
              />
            </span>
            <p>{activeSlide.eyebrow}</p>
          </div>
          <h1 id="baslac-hero-title">{activeSlide.title}</h1>
          <p className={styles.heroDescription}>{activeSlide.description}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href={activeSlide.primaryCta.href}>
              {activeSlide.primaryCta.label}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className={styles.secondaryButton}
              href={activeSlide.secondaryCta.href}
            >
              {activeSlide.secondaryCta.label}
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <HeroVisual id={activeSlide.id} products={visibleProducts} />
        </div>
      </div>

      <div className={styles.heroControls}>
        <div className={styles.heroTabs} aria-label="Izaberite baslac temu">
          {baslacHeroSlides.map((slide, index) => (
            <button
              type="button"
              aria-pressed={activeIndex === index}
              data-active={activeIndex === index || undefined}
              key={slide.id}
              onClick={() => setActiveIndex(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {slide.id === "system"
                ? "Sistem"
                : slide.id === "line-45"
                  ? "45 Line"
                  : slide.id === "speed"
                    ? "Brzi lak"
                    : slide.id === "color"
                      ? "Koloristika"
                      : "CV"}
            </button>
          ))}
        </div>
        <div className={styles.heroArrows}>
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            aria-label="Prethodna tema"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            aria-label="Sledeća tema"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}

function HeroVisual({
  id,
  products,
}: {
  id: (typeof baslacHeroSlides)[number]["id"];
  products: BaslacHeroProduct[];
}) {
  if (id === "line-45") {
    return (
      <div className={styles.line45Visual} aria-label="45 Line sistemski prikaz">
        <span className={styles.line45Halo} aria-hidden="true" />
        <div className={styles.line45Plate}>
          <span>45</span>
          <strong>LINE</strong>
          <small>WATERBORNE BASECOAT SYSTEM</small>
        </div>
        <div className={styles.colorFan} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className={styles.line45Legend}>
          <span>solid</span>
          <span>metallic</span>
          <span>pearl</span>
          <span>effect</span>
        </div>
      </div>
    );
  }

  if (id === "speed") {
    return (
      <div className={styles.speedVisual} aria-label="40-100 režimi sušenja">
        <div className={styles.speedDial}>
          <span>40-100</span>
          <strong>HIGH SPEED</strong>
          <small>2K CLEAR VOC</small>
        </div>
        <div className={styles.temperatureScale}>
          <div>
            <span>20°C</span>
            <i style={{ "--bar": "100%" } as CSSProperties} />
            <strong>oko 3 h</strong>
          </div>
          <div>
            <span>40°C</span>
            <i style={{ "--bar": "42%" } as CSSProperties} />
            <strong>20–30 min</strong>
          </div>
          <div>
            <span>60°C</span>
            <i style={{ "--bar": "23%" } as CSSProperties} />
            <strong>10–20 min</strong>
          </div>
        </div>
      </div>
    );
  }

  if (id === "color") {
    const steps = ["Vozilo", "e-finder", "Formula", "Vaga", "Proba"];
    return (
      <div className={styles.colorVisual} aria-label="Digitalni koloristički tok">
        <div className={styles.scanTarget} aria-hidden="true">
          <span />
          <span />
        </div>
        <ol>
          {steps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
        <p>e-finder star · Formula Finder · Refinity</p>
      </div>
    );
  }

  if (id === "cv") {
    return (
      <div className={styles.cvVisual} aria-label="30 Line CV sistemski prikaz">
        <span className={styles.cvCode}>30 LINE CV</span>
        <svg viewBox="0 0 720 330" role="img" aria-label="Kontura kamiona">
          <path d="M72 223h378V90h116l84 89v44h-45" />
          <path d="M450 119h93l57 61H450" />
          <path d="M72 107h325M72 150h325M72 193h325" />
          <circle cx="183" cy="237" r="46" />
          <circle cx="535" cy="237" r="46" />
          <path d="M229 237h260M72 223v14h65" />
        </svg>
        <div className={styles.cvTags}>
          <span>Direct gloss</span>
          <span>Velike površine</span>
          <span>51- hardeneri</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.systemVisual} aria-label="Proizvodi iz javnog baslac kataloga">
      <span className={styles.systemOrbit} aria-hidden="true" />
      <span className={styles.systemNumber}>01–08</span>
      <div className={styles.systemProductLine}>
        {products.map((product, index) => (
          <Link
            href={`/proizvodi/${product.slug}`}
            className={styles.heroProduct}
            style={{ "--product-index": index } as CSSProperties}
            key={product.slug}
          >
            <Image
              src={product.src}
              alt={product.alt}
              fill
              priority
              sizes="(min-width: 70rem) 11rem, (min-width: 48rem) 13vw, 25vw"
            />
            <span>{product.name}</span>
          </Link>
        ))}
      </div>
      <p className={styles.systemCaption}>
        Fotografije iz postojećeg javnog kataloga
      </p>
    </div>
  );
}
