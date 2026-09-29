import Link from "next/link";
import { requireCustomerSession } from "@/lib/authz/customer-session";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  await requireCustomerSession("/kupac/porudzbine");
  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Porudžbine</h2>
          <p>Porudžbine koje vaša firma šalje kroz nalog. Fakture su posebna celina.</p>
        </div>
      </div>
      <div className="portal-panel-body ka-empty">
        <p>
          <strong>Poručivanje kroz nalog još nije uključeno.</strong> Zato ovde još nema nijedne
          porudžbine. Porudžbine i dalje šaljete kao do sada — svom komercijalisti ili telefonom.
        </p>
        <p>
          Kada poručivanje bude uključeno, ovde ćete videti svaku poslatu porudžbinu, njeno stanje i
          fakturu koja je iz nje nastala.
        </p>
        <p>
          <Link href="/kupac/fakture">Pogledajte izdate fakture →</Link>
        </p>
      </div>
    </section>
  );
}
