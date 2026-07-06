import Link from "next/link";
import { CompanyLocationMap } from "@/components/map/CompanyLocationMap";
import {
  getPartnerLocationStats,
  type PartnerStore,
} from "@/lib/partner-stores";
import styles from "./ContactPage.module.css";

export function StoreLocatorTeaser({ stores }: { stores: PartnerStore[] }) {
  const stats = getPartnerLocationStats(stores);

  return (
    <section className={styles.locatorTeaser} aria-labelledby="contact-locator-teaser-title">
      <p className={styles.sectionKicker}>Prodajna mesta</p>
      <h2 id="contact-locator-teaser-title">Tražite najbliže prodajno mesto?</h2>
      <p>
        {stats.locationCount > 0
          ? `${stats.locationCount} partnerskih lokacija u ${stats.cityCount} gradova, sa pretragom i filterima po tipu.`
          : "Lokator prikazuje potvrđene javne partnerske lokacije."}
      </p>
      <CompanyLocationMap className={styles.teaserMap} />
      <Link className={styles.teaserAction} href="/prodavnice">
        Otvori mapu prodavnica →
      </Link>
    </section>
  );
}
