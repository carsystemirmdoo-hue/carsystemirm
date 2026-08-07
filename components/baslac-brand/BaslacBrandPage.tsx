import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { BaslacHero } from "./BaslacHero";
import { BaslacMediaSlot } from "./BaslacMediaSlot";
import { BaslacPageShell } from "./BaslacPageShell";
import { BaslacProcessNavigator } from "./BaslacProcessNavigator";
import { BaslacRepairRhythm } from "./BaslacRepairRhythm";
import { getBaslacMediaAvailability } from "./baslacMedia.server";
import {
  baslacCatalogHref,
  baslacClearcoats,
  baslacMedia,
  baslacSectionNavItems,
  baslacSystemLines,
  type BaslacMediaAvailability,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

export function BaslacBrandPage({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const mediaAvailability = getBaslacMediaAvailability();
  const catalogProducts = products.filter(
    (product) =>
      product.productImage &&
      !product.productImage.src.includes("placeholder-product"),
  );

  return (
    <BaslacPageShell>
      <main>
        <BaslacHero availability={mediaAvailability} />
        <BrandSectionNav
          ariaLabel="Brzi pristup baslac programu"
          items={baslacSectionNavItems}
        />
        <BrandPosition />
        <BaslacRepairRhythm availability={mediaAvailability} />
        <SystemLines availability={mediaAvailability} />
        <ProcessSection />
        <ClearcoatSection availability={mediaAvailability} />
        <PrimerSection availability={mediaAvailability} />
        <ColorWorkflow availability={mediaAvailability} />
        <CommercialSection availability={mediaAvailability} />
        <SupportSection />
        <CatalogPreview products={catalogProducts} />
        <FinalCta />
      </main>
      <Footer />
    </BaslacPageShell>
  );
}

function BrandPosition() {
  return (
    <section
      id="overview"
      className={`${styles.section} ${styles.positionSection}`}
      aria-labelledby="baslac-position-title"
    >
      <div className={styles.positionStatement}>
        <p className={styles.sectionKicker}>Sistem za jasan radni tok</p>
        <h2 id="baslac-position-title">
          Manje komplikovanja.
          <br />
          Više kontrole nad procesom.
        </h2>
      </div>
      <div className={styles.positionBody}>
        <p>
          baslac portfolio organizovan je kao povezan refinish sistem: od
          pripreme podloge, preko sistema boje, do završnog laka i tehničke
          podrške.
        </p>
        <dl>
          <div>
            <dt>01</dt>
            <dd>Kompletan sistem od pripreme do završnog sloja</dd>
          </div>
          <div>
            <dt>02</dt>
            <dd>Vodene, solventne i direct-gloss linije</dd>
          </div>
          <div>
            <dt>03</dt>
            <dd>Digitalna koloristika i podrška pri izboru nijanse</dd>
          </div>
          <div>
            <dt>04</dt>
            <dd>Program za putnička i komercijalna vozila</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function SystemLines({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const line45Media = baslacMedia["line-45-system"];

  return (
    <section
      id="color-systems"
      className={`${styles.section} ${styles.linesSection}`}
      aria-labelledby="baslac-lines-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Izbor prema vrsti posla</p>
          <h2 id="baslac-lines-title">Četiri jasna puta kroz sistem boje.</h2>
        </div>
        <p>
          Broj linije označava funkciju i tehnologiju. Konačan izbor potvrđuje
          se prema opremi, podlozi, nijansi i željenom završnom rezultatu.
        </p>
      </header>

      <div className={styles.linesGrid}>
        {baslacSystemLines.map((line, index) => (
          <article
            id={line.id}
            className={styles.linePanel}
            data-featured={index === 0 || undefined}
            key={line.id}
          >
            <span className={styles.lineCode}>{line.code}</span>
            <div className={styles.lineCopy}>
              <p>{line.technology}</p>
              <h3>{line.title}</h3>
              <p>{line.description}</p>
            </div>
            <div className={styles.lineTags}>
              {line.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <Link
              href={
                line.id === "line-35"
                  ? baslacCatalogHref({ query: "35-" })
                  : line.id === "line-30"
                    ? baslacCatalogHref({ query: "30-" })
                    : line.id === "line-30-cv"
                      ? "#commercial"
                      : "/kontakt?tema=proizvod&brend=baslac&sistem=45-line"
              }
            >
              {line.id === "line-45"
                ? "Zatražite preporuku sistema"
                : line.id === "line-30-cv"
                  ? "Otvorite CV program"
                  : "Pretražite proizvode"}
              <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>

      <div className={styles.line45Feature}>
        <BaslacMediaSlot
          availability={availability[line45Media.id]}
          className={styles.line45Media}
          media={line45Media}
        />
        <div className={styles.line45FeatureCopy}>
          <p className={styles.sectionKicker}>Glavni vodeni sistem</p>
          <h3>45 Line povezuje nijansu, blendovanje i završni lak.</h3>
          <p>
            Ovaj pregled rezerviše mesto za stvarni mixing sistem, aplikaciju
            vodene baze ili relevantan panel. Tačan proces i izbor pratećih
            proizvoda potvrđuju se prema važećem tehničkom listu.
          </p>
          <div className={styles.line45FeatureFacts}>
            <span>solid</span>
            <span>metallic</span>
            <span>pearl</span>
            <span>effect</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section
      id="repair-process"
      className={`${styles.section} ${styles.processSection}`}
      aria-labelledby="baslac-process-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Kompletan repair proces</p>
          <h2 id="baslac-process-title">Jedan sistem, osam povezanih faza.</h2>
        </div>
        <p>
          Izaberite fazu da vidite pripadajuće porodice. Konačna kombinacija
          proizvoda, hardenera i razređivača potvrđuje se prema važećem
          tehničkom listu.
        </p>
      </header>
      <BaslacProcessNavigator />
    </section>
  );
}

function ClearcoatSection({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const media = baslacMedia["clearcoat-range"];

  return (
    <section
      id="clearcoats"
      className={`${styles.section} ${styles.clearcoatSection}`}
      aria-labelledby="baslac-clearcoats-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Bezbojni lak prema procesu</p>
          <h2 id="baslac-clearcoats-title">
            Završni sistem prati način rada radionice.
          </h2>
        </div>
        <p>
          Fast, ambient, univerzalni, panel i mat sistemi imaju različite uloge.
          Uslovi rada i tehnički list određuju konačnu kombinaciju.
        </p>
      </header>

      <BaslacMediaSlot
        availability={availability[media.id]}
        className={styles.clearcoatMedia}
        media={media}
      />

      <div className={styles.clearcoatMatrix}>
        {baslacClearcoats.map((clearcoat, index) => (
          <article key={clearcoat.code}>
            <span className={styles.clearcoatIndex}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <p>{clearcoat.role}</p>
              <h3>{clearcoat.code}</h3>
              <strong>{clearcoat.name}</strong>
            </div>
            <dl>
              <div>
                <dt>Proces</dt>
                <dd>{clearcoat.process}</dd>
              </div>
              <div>
                <dt>Sistem</dt>
                <dd>{clearcoat.metric}</dd>
              </div>
            </dl>
            <Link
              href={`/kontakt?tema=proizvod&brend=baslac&proizvod=${encodeURIComponent(
                clearcoat.code,
              )}`}
            >
              Proverite lokalnu dostupnost
              <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>

      <aside className={styles.clearcoatNote}>
        <span>NAPOMENA</span>
        <p>
          Mat i satin završna obrada zahtevaju kontrolisan proces, probnu kartu
          i proveru tehničkog lista pre aplikacije na kompletnom panelu.
        </p>
      </aside>
    </section>
  );
}

const primerGroups = [
  {
    code: "20-22 · 20-24/34/94",
    title: "Sanding primer-filleri",
    text: "Standardno popunjavanje i ravnanje, uključujući grey-shade sistem.",
  },
  {
    code: "20-35 · 20-95",
    title: "Wet-on-wet",
    text: "Proces bez međubrušenja, uz propisani flash-off pre boje.",
  },
  {
    code: "25-30",
    title: "Epoxy primer-filler",
    text: "Antikorozivna zaštita i izolacija, prema izabranom režimu.",
  },
  {
    code: "27-10",
    title: "Washprimer",
    text: "Adhezioni korak za odgovarajuće metalne podloge.",
  },
  {
    code: "21-10 · 21-11 · 21-20",
    title: "Plastika",
    text: "Adhezioni sistemi za pravilno pripremljene obojive plastike.",
  },
];

function PrimerSection({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const media = baslacMedia["primer-process"];

  return (
    <section
      id="primers"
      className={`${styles.section} ${styles.primerSection}`}
      aria-labelledby="baslac-primers-title"
    >
      <div className={styles.primerIntro}>
        <p className={styles.sectionKicker}>Podloga određuje rezultat</p>
        <h2 id="baslac-primers-title">Pet funkcija pre prvog sloja boje.</h2>
        <p>
          Izbor zavisi od podloge, potrebne zaštite, popunjavanja i toga da li
          radni tok uključuje brušenje.
        </p>
        <Link href="/kontakt?tema=podrska&brend=baslac&oblast=podloga">
          Zatražite preporuku za podlogu
          <span aria-hidden="true">↗</span>
        </Link>
      </div>

      <BaslacMediaSlot
        availability={availability[media.id]}
        className={styles.primerMedia}
        media={media}
      />

      <div className={styles.primerStack}>
        {primerGroups.map((group, index) => (
          <article key={group.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p>{group.code}</p>
              <h3>{group.title}</h3>
            </div>
            <p>{group.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ColorWorkflow({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const media = baslacMedia["color-workflow"];
  const steps = [
    ["01", "Vozilo", "Očitavanje realne površine"],
    ["02", "e-finder star", "Merenje nijanse i efekta"],
    ["03", "Formula Finder", "Pretraga odgovarajuće formule"],
    ["04", "Vaga i mixing bank", "Precizno pripremljena mešavina"],
    ["05", "Test karta", "Vizuelna potvrda pre aplikacije"],
  ];

  return (
    <section
      id="koloristika"
      className={`${styles.section} ${styles.colorSection}`}
      aria-labelledby="baslac-color-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Digitalna koloristika</p>
          <h2 id="baslac-color-title">
            Od površine vozila do formule spremne za probu.
          </h2>
        </div>
        <p>
          Merni uređaj, baza formula, vaga i mixing radna stanica imaju jasno
          mesto u istom toku. Refinity ovde predstavljamo kao digitalnu
          platformu, ne kao fizički proizvod.
        </p>
      </header>

      <BaslacMediaSlot
        availability={availability[media.id]}
        className={styles.colorMedia}
        media={media}
      />

      <ol className={styles.colorFlow}>
        {steps.map(([index, title, description]) => (
          <li key={title}>
            <span>{index}</span>
            <strong>{title}</strong>
            <p>{description}</p>
          </li>
        ))}
      </ol>

      <div className={styles.colorTools}>
        <article>
          <span>MERENJE</span>
          <h3>e-finder star</h3>
          <p>Digitalno očitavanje nijanse i efekta sa površine vozila.</p>
        </article>
        <article>
          <span>FORMULE</span>
          <h3>Formula Finder</h3>
          <p>Pristup baslac formulama i izboru odgovarajućeg sistema boje.</p>
        </article>
        <article>
          <span>PLATFORMA</span>
          <h3>Refinity</h3>
          <p>
            Digitalni alati za color management i radne tokove, u zavisnosti od
            lokalno dostupne konfiguracije.
          </p>
        </article>
      </div>

      <div className={styles.colorActions}>
        <Link
          className={styles.primaryButton}
          href="/kontakt?tema=podrska&brend=baslac&oblast=koloristika"
        >
          Pošaljite šifru boje
          <span aria-hidden="true">↗</span>
        </Link>
        <a
          href="https://techinfo.baslac.com/en/"
          target="_blank"
          rel="noreferrer"
        >
          Otvorite zvanični tehnički portal
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}

function CommercialSection({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const media = baslacMedia["commercial-vehicles"];

  return (
    <section
      id="commercial"
      className={`${styles.section} ${styles.commercialSection}`}
      aria-labelledby="baslac-commercial-title"
    >
      <BaslacMediaSlot
        availability={availability[media.id]}
        className={styles.commercialMedia}
        media={media}
      />
      <div className={styles.commercialCopy}>
        <p className={styles.sectionKicker}>Komercijalna vozila</p>
        <h2 id="baslac-commercial-title">
          Direct gloss sistem za velike transportne površine.
        </h2>
        <p>
          Ovaj blok rezerviše jasan prostor za stvarnu primenu na kamionu,
          autobusu ili drugoj velikoj površini, bez generičnog automotive
          vizuala.
        </p>
        <ul>
          <li>30 Line CV program</li>
          <li>Proces prilagođen velikim površinama</li>
          <li>Tehnička potvrda sistema pre primene</li>
        </ul>
        <Link
          className={styles.primaryButton}
          href="/kontakt?tema=proizvod&brend=baslac&program=30-line-cv"
        >
          Razgovarajte sa tehničkim savetnikom
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function SupportSection() {
  const support = [
    {
      index: "01",
      title: "Tehnički listovi",
      text: "Odnos mešanja, sušenje, aplikacija i dozvoljene podloge iz konkretnog TDS dokumenta.",
      href: "https://techinfo.baslac.com/en/",
      external: true,
    },
    {
      index: "02",
      title: "Koloristička podrška",
      text: "Pomoć pri merenju, izboru formule i pripremi test karte.",
      href: "/kontakt?tema=podrska&brend=baslac&oblast=koloristika",
      external: false,
    },
    {
      index: "03",
      title: "Obuka i procesi",
      text: "Strukturisanje standardnih, wet-on-wet, ambient i CV radnih tokova.",
      href: "/kontakt?tema=podrska&brend=baslac&oblast=obuka",
      external: false,
    },
  ];

  return (
    <section
      id="support"
      className={`${styles.section} ${styles.supportSection}`}
      aria-labelledby="baslac-support-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Tehnička podrška</p>
          <h2 id="baslac-support-title">
            Informacija koja vodi do sledećeg koraka.
          </h2>
        </div>
        <p>
          Sistemski proizvod vredi samo kada su odnos mešanja, podloga i režim
          sušenja jasno potvrđeni.
        </p>
      </header>

      <div className={styles.supportList}>
        {support.map((item) => (
          <article key={item.title}>
            <span>{item.index}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            {item.external ? (
              <a href={item.href} target="_blank" rel="noreferrer">
                Otvorite resurs
                <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <Link href={item.href}>
                Kontaktirajte nas
                <span aria-hidden="true">↗</span>
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function CatalogPreview({ products }: { products: CarsystemProduct[] }) {
  return (
    <section
      id="products"
      className={`${styles.section} ${styles.catalogSection}`}
      aria-labelledby="baslac-catalog-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Dostupno u javnom katalogu</p>
          <h2 id="baslac-catalog-title">
            baslac proizvodi sa postojećim lokalnim zapisom.
          </h2>
        </div>
        <p>
          Prikazujemo samo postojeće javne Carsystem zapise. Cenu, pakovanje i
          dostupnost potvrđujemo kroz upit.
        </p>
      </header>

      {products.length > 0 ? (
        <div className={styles.catalogGrid}>
          {products.slice(0, 4).map((product, index) => (
            <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
              <div className={styles.catalogImage}>
                {product.productImage ? (
                  <Image
                    src={product.productImage.src}
                    alt={product.productImage.alt}
                    fill
                    sizes="(min-width: 70rem) 18rem, (min-width: 45rem) 40vw, 82vw"
                  />
                ) : null}
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className={styles.catalogCopy}>
                <p>{product.sku}</p>
                <h3>{product.name}</h3>
                <span>
                  Otvorite proizvod
                  <i aria-hidden="true">↗</i>
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className={styles.emptyCatalog}>
          Javni katalog trenutno nema potvrđene baslac fotografije proizvoda.
        </p>
      )}

      <div className={styles.catalogFooter}>
        <p>
          Potreban vam je proizvod koji još nije prikazan? Pošaljite kod ili
          fotografiju etikete, bez pretpostavke o lokalnom stanju.
        </p>
        <Link className={styles.outlineButton} href={baslacCatalogHref()}>
          Svi baslac proizvodi
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalCta} aria-labelledby="baslac-final-title">
      <span className={styles.finalCtaMark} aria-hidden="true">
        45
      </span>
      <div>
        <p>Potrebna vam je prava kombinacija proizvoda?</p>
        <h2 id="baslac-final-title">
          Pošaljite nam vrstu popravke, podlogu i uslove rada.
        </h2>
      </div>
      <div className={styles.finalCtaActions}>
        <Link
          className={styles.primaryButton}
          href="/kontakt?tema=proizvod&brend=baslac"
        >
          Zatražite preporuku sistema
          <span aria-hidden="true">↗</span>
        </Link>
        <Link href={baslacCatalogHref()}>
          Pogledajte sve baslac proizvode
        </Link>
      </div>
    </section>
  );
}
