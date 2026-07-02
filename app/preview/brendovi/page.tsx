import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { getAllBrands } from "@/lib/products";

export const metadata: Metadata = {
  title: "Brendovi",
  description:
    "Brendovi u ponudi kod Carsystem i R-M Inđija — profesionalni automobilski refinish program.",
  alternates: { canonical: "/preview/brendovi" },
};

export default function BrandsPage() {
  const brands = getAllBrands();

  return (
    <Section>
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Brendovi
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        Brendovi u ponudi kod Carsystem i R-M Inđija.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={`/brendovi/${brand.slug}`}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-lg"
          >
            <div className="relative h-16 w-32">
              <Image
                src={brand.logo}
                alt={`${brand.name} logo`}
                fill
                sizes="128px"
                className="object-contain object-left"
              />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {brand.name}
            </h2>
            <p className="text-sm text-muted-foreground">{brand.description}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
