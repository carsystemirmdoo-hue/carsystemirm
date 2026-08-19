import Link from "next/link";
import { PortalIcon } from "@/components/portal/PortalIcon";

/**
 * Prikazuje se uz HTTP 403 kada korisnik otvori rutu za koju nema dozvolu.
 * Sakrivena stavka u navigaciji je samo kozmetika — ovo je odgovor koji dobija
 * i onaj ko adresu unese ručno.
 */
export default function PortalForbidden() {
  return (
    <div className="portal-state" data-state="permission">
      <span className="portal-state-icon">
        <PortalIcon name="lock" />
      </span>
      <h2>Nemate dozvolu za ovaj ekran</h2>
      <p>
        Vaša uloga i dodeljeni paketi dozvola ne pokrivaju ovaj deo sistema. Ako
        vam je pristup potreban, zatražite ga od Gazde — dodela se evidentira u
        Aktivnostima.
      </p>
      <Link href="/portal" className="portal-button" data-variant="primary">
        Nazad na početnu
      </Link>
    </div>
  );
}
