import type { Metadata } from "next";
import { ContactPage } from "@/components/contact/ContactPage";
import type { ContactInitialValues } from "@/components/contact/ContactForm";
import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  getProgramGroupBySlug,
  getPublicProgramGroupBySlug,
} from "@/lib/carsystem-data";
import { companyContact } from "@/lib/company-contact";
import { getPublicPartnerStores } from "@/lib/partner-stores";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Kontakt",
  description:
    "Pošaljite upit za Carsystem i R-M proizvode, tehničku podršku i najbližu prodavnicu.",
  path: "/kontakt",
});

type ContactRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function resolveTopic(value: string): ContactInitialValues["topic"] {
  const normalized = value.toLowerCase();

  if (normalized === "proizvod") return "Proizvod";
  if (normalized === "prodavnica") return "Najbliža prodavnica";
  if (normalized === "tehnicka-podrska" || normalized === "podrska") {
    return "Tehnička podrška";
  }
  if (normalized === "b2b" || normalized === "saradnja") return "B2B saradnja";
  if (normalized === "opsti" || normalized === "opsti-upit") return "Opšti upit";

  if (
    value === "Proizvod" ||
    value === "Tehnička podrška" ||
    value === "Najbliža prodavnica" ||
    value === "B2B saradnja" ||
    value === "Opšti upit"
  ) {
    return value;
  }

  return "Opšti upit";
}

function resolveContext(params: Record<string, string | string[] | undefined>) {
  const context: string[] = [];
  const productSlug = firstParam(params.proizvod);
  const brandSlug = firstParam(params.brand ?? params.brend);
  const programSlug = firstParam(params.program);
  const storeParam = firstParam(params.prodavnica);

  if (productSlug) {
    const product = getCarsystemProductBySlug(productSlug);
    context.push(`Proizvod: ${product?.name ?? productSlug}`);
  }

  if (brandSlug) {
    const brand = getCarsystemBrandBySlug(brandSlug);
    context.push(`Brend: ${brand?.name ?? brandSlug}`);
  }

  if (programSlug) {
    const program =
      getPublicProgramGroupBySlug(programSlug) ?? getProgramGroupBySlug(programSlug);
    context.push(`Program: ${program?.name ?? programSlug}`);
  }

  if (storeParam) {
    const normalizedStore = storeParam.toLowerCase();
    const store = getPublicPartnerStores().find((item) => {
      return (
        item.id === storeParam ||
        item.city.toLowerCase() === normalizedStore ||
        item.name.toLowerCase() === normalizedStore
      );
    });

    context.push(`Prodavnica: ${store ? `${store.name}, ${store.city}` : storeParam}`);
  }

  return context.join(" / ");
}

export default async function KontaktRoute({ searchParams }: ContactRouteProps) {
  const params = (await searchParams) ?? {};
  const topic = resolveTopic(firstParam(params.tema));
  const context = resolveContext(params);

  return (
    <ContactPage
      contact={companyContact}
      initialValues={{
        city: firstParam(params.grad),
        context,
        message: "",
        topic,
      }}
      stores={getPublicPartnerStores()}
    />
  );
}
