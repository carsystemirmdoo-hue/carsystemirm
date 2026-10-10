import { Footer } from "@/components/layout/Footer";
import { StoreLocator } from "@/components/stores/StoreLocator";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import type { PartnerStore } from "@/lib/partner-stores";
import styles from "./StoresPage.module.css";

export function StoresPage({ stores }: { stores: PartnerStore[] }) {
  return (
    <div className={styles.pageShell}>
      <div className="ds-container">
        <SeoBreadcrumbs
          items={[
            { name: "Početna", path: "/" },
            { name: "Prodavnice", path: "/prodavnice" },
          ]}
        />
      </div>
      <StoreLocator stores={stores} />
      <Footer />
    </div>
  );
}
