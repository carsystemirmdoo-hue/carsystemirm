"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ContactForm,
  type ContactInitialValues,
  type InquiryTopic,
} from "@/components/contact/ContactForm";
import type { CompanyContact } from "@/lib/company-contact";
import type { PartnerStore } from "@/lib/partner-stores";

function resolveTopic(value: string): InquiryTopic {
  const normalized = value.toLowerCase();

  if (normalized === "proizvod" || normalized === "dokument") return "Proizvod";
  if (normalized === "prodavnica") return "Najbliža prodavnica";
  if (normalized === "tehnicka-podrska" || normalized === "podrska") {
    return "Tehnička podrška";
  }
  if (normalized === "b2b" || normalized === "saradnja") return "B2B saradnja";
  return "Opšti upit";
}

function readableValue(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export function ContactQueryForm({
  contact,
  stores,
}: {
  contact: CompanyContact;
  stores: PartnerStore[];
}) {
  const searchParams = useSearchParams();
  const initialValues = useMemo<ContactInitialValues>(() => {
    const context: string[] = [];
    const product = searchParams.get("proizvod") ?? "";
    const brand = searchParams.get("brand") ?? searchParams.get("brend") ?? "";
    const program = searchParams.get("program") ?? "";
    const storeParam = searchParams.get("prodavnica") ?? "";
    const system = searchParams.get("sistem") ?? "";
    const series = searchParams.get("serija") ?? "";
    const area = searchParams.get("oblast") ?? "";

    if (product) context.push(`Proizvod: ${readableValue(product)}`);
    if (brand) {
      context.push(`Brend: ${brand.toLowerCase() === "rm" ? "R-M" : readableValue(brand)}`);
    }
    if (program) context.push(`Program: ${readableValue(program)}`);
    if (system) context.push(`Sistem: ${readableValue(system)}`);
    if (series) context.push(`Serija: ${readableValue(series)}`);
    if (area) context.push(`Oblast: ${readableValue(area)}`);
    if (storeParam) {
      const normalizedStore = storeParam.toLowerCase();
      const store = stores.find(
        (item) =>
          item.id === storeParam ||
          item.city.toLowerCase() === normalizedStore ||
          item.name.toLowerCase() === normalizedStore,
      );
      context.push(
        `Prodavnica: ${store ? `${store.name}, ${store.city}` : readableValue(storeParam)}`,
      );
    }

    return {
      city: searchParams.get("grad") ?? "",
      context: context.join(" / "),
      message: "",
      topic: resolveTopic(searchParams.get("tema") ?? ""),
    };
  }, [searchParams, stores]);

  return (
    <ContactForm
      contact={contact}
      initialValues={initialValues}
      stores={stores}
    />
  );
}
