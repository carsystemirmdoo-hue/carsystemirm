import { Footer } from "@/components/layout/Footer";
import { StoreLocator } from "@/components/stores/StoreLocator";
import type { PartnerStore } from "@/lib/partner-stores";
import styles from "./StoresPage.module.css";

export function StoresPage({ stores }: { stores: PartnerStore[] }) {
  return (
    <div className={styles.pageShell}>
      <StoreLocator stores={stores} />
      <Footer />
    </div>
  );
}
