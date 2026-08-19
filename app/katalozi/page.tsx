import type { Metadata } from "next";
import { DocumentLibraryPage } from "@/components/documents/DocumentLibraryPage";
import { getPublicDocuments } from "@/lib/documents";
import { collectionPageJsonLd, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Katalozi i dokumentacija",
  description:
    "Zvanični proizvođački katalozi, brošure proizvodnih sistema i tehnički vodiči za brendove koje zastupamo.",
  path: "/katalozi",
  imageAlt: "Katalozi i tehnička dokumentacija",
});

export default function KataloziPage() {
  const documents = getPublicDocuments();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionPageJsonLd({
            name: "Katalozi i dokumentacija",
            description:
              "Zvanični proizvođački katalozi, brošure proizvodnih sistema i tehnički vodiči.",
            path: "/katalozi",
            itemUrls: documents.map((document) => document.file),
          }),
        )}
      />
      <DocumentLibraryPage documents={documents} />
    </>
  );
}
