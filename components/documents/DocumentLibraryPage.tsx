import { Suspense } from "react";
import { DocumentLibraryExplorer } from "@/components/documents/DocumentLibraryExplorer";
import { Footer } from "@/components/layout/Footer";
import type { BrandDocument } from "@/lib/documents";

export function DocumentLibraryPage({ documents }: { documents: BrandDocument[] }) {
  return (
    <>
      <Suspense fallback={null}>
        <DocumentLibraryExplorer documents={documents} />
      </Suspense>
      <Footer />
    </>
  );
}
