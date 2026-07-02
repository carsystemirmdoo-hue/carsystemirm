import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/products/ProductGrid";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { getAllBrands, getAllCategories, getFeaturedProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Početna",
  description:
    "Interna preview početna strana Carsystem RM sajta sa profesionalnim refinish programom, brendovima i katalogom proizvoda.",
  alternates: { canonical: "/preview" },
};

export default function PreviewHomePage() {
  const featuredProducts = getFeaturedProducts(3);
  const brands = getAllBrands();
  const categories = getAllCategories();

  return (
    <>
      <Section className="bg-surface">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
              Interni preview
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Carsystem RM profesionalni refinish program
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Radna verzija sajta za pregled kataloga, brendova, dokumentacije i
              osnovnih stranica pre javnog puštanja.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/katalog">Pogledaj proizvode</Button>
              <Button href="/brendovi" variant="secondary">
                Brendovi u ponudi
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-6 shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              Status preview verzije
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-surface p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Proizvodi
                </dt>
                <dd className="mt-2 text-2xl font-bold text-foreground">
                  {featuredProducts.length}+
                </dd>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Brendovi
                </dt>
                <dd className="mt-2 text-2xl font-bold text-foreground">
                  {brands.length}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Kategorije
                </dt>
                <dd className="mt-2 text-2xl font-bold text-foreground">
                  {categories.length}
                </dd>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Režim
                </dt>
                <dd className="mt-2 text-2xl font-bold text-foreground">
                  Static
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Izdvojeni proizvodi
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Primer prikaza kataloga i kartica proizvoda u preview režimu.
            </p>
          </div>
          <Link
            href="/katalog"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Ceo katalog
          </Link>
        </div>

        <div className="mt-8">
          <ProductGrid products={featuredProducts} />
        </div>
      </Section>

      <Section id="prodavnice" muted>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Partnerska mreža
        </h2>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Ovaj blok je rezervisan za budući prikaz prodavnica i partnera.
          Sadržaj će biti dopunjen kada finalni podaci budu spremni.
        </p>
      </Section>
    </>
  );
}
