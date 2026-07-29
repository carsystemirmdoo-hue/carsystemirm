import type { Metadata } from "next";
import { ContactPage } from "@/components/contact/ContactPage";
import { companyContact } from "@/lib/company-contact";
import { getPublicPartnerStores } from "@/lib/partner-stores";
import { breadcrumbJsonLd, jsonLd } from "@/lib/seo";
import { buildContactMetadata } from "@/lib/seo/metadata-builders";

export const metadata: Metadata = buildContactMetadata();

export default function KontaktRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Kontakt", path: "/kontakt" },
          ]),
        )}
      />
      <ContactPage
        contact={companyContact}
        initialValues={{
          city: "",
          context: "",
          message: "",
          topic: "Opšti upit",
        }}
        stores={getPublicPartnerStores()}
      />
    </>
  );
}
