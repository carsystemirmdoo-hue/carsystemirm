import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { getFeaturedDocuments } from "@/lib/documents";
import {
  baslacFamilyPackshots,
  baslacPublicBases,
  type BaslacSystemId,
} from "@/lib/baslac-systems";
import { BaslacGreyShade } from "./BaslacGreyShade";
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
  // Proizvodi se više ne filtriraju po tome da li imaju fotografiju — pogrešna
  // fotografija je gora od kontrolisanog placeholdera.
  const catalogProducts = products;

  return (
    <BaslacPageShell>
      <main>
        <BaslacHero />
        <BrandSectionNav
          ariaLabel="Brzi pristup Baslac programu"
          items={baslacSectionNavItems}
        />
        <BrandPosition />
        <BaslacRepairRhythm availability={mediaAvailability} />
        <SystemLines availability={mediaAvailability} />
        <ProcessSection />
        <ClearcoatSection availability={mediaAvailability} />
        <PrimerSection />
        <BaslacGreyShade />
        <ColorWorkflow availability={mediaAvailability} />
        <CommercialSection availability={mediaAvailability} />
        <SupportSection />
        <BaslacSystemsAndProducts products={catalogProducts} />
        <DocumentLibrary />
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
          Baslac portfolio organizovan je kao povezan refinish sistem: od
          pripreme podloge, preko sistema boje, do završnog laka i tehničke
          podrške.
        </p>
        <ul className={styles.positionFacts}>
          <li>Kompletan sistem od pripreme do završnog sloja</li>
          <li>Vodene, solventne i direct-gloss linije</li>
          <li>Digitalna koloristika i podrška pri izboru nijanse</li>
          <li>Program za putnička i komercijalna vozila</li>
        </ul>
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
                      : "/kontakt?tema=proizvod&brend=Baslac&sistem=45-line"
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
            Sistem se isporučuje u više formata, od kanistera od 5 L do boca
            od 0,1 L. Na slici su primeri iz programa: converter, dve bazne boje i
            biserna komponenta. Tačan proces i izbor pratećih proizvoda potvrđuju
            se prema važećem tehničkom listu.
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
        {baslacClearcoats.map((clearcoat) => (
          <article key={clearcoat.code}>
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

/*
 * Sekcija prajmera nema medijski slot.
 *
 * `availability` i `baslacMedia["primer-process"]` su ostali iz ranije verzije
 * koja je ovde imala sliku; sadrzaj je od tada iskljucivo tekstualan, pa se ni
 * jedno ni drugo vise ne cita.
 */
function PrimerSection() {
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

      <div className={styles.primerPackshots}>
        {[
          ["/products/baslac/baslac--20-24-2k-primerfiller-grey-1l-packshot.webp", "20-24", "2K Primerfiller Grey, 1 L"],
          ["/products/baslac/baslac--20-34-2k-primerfiller-white-4l-packshot.webp", "20-34", "2K Primerfiller White, 4 L"],
          ["/products/baslac/baslac--20-35-2k-primerfiller-wet-on-wet-white-3l-packshot.webp", "20-35", "Wet-on-Wet White, 3 L"],
          ["/products/baslac/baslac--20-94-2k-primerfiller-black-4l-packshot.webp", "20-94", "2K Primerfiller Black, 4 L"],
          ["/products/baslac/baslac--20-95-2k-primerfiller-wet-on-wet-black-3l-packshot.webp", "20-95", "Wet-on-Wet Black, 3 L"],
          ["/products/baslac/baslac--25-30-2k-ep-primerfiller-4l-packshot.webp", "25-30", "2K Primerfiller EP, 4 L"],
          ["/products/baslac/baslac--27-10-2k-washprimer-4l-packshot.webp", "27-10", "2K Washprimer, 4 L"],
        ].map(([src, code, label]) => (
          <figure key={code}>
            <Image
              src={src}
              alt={`Baslac ${code} — ${label}`}
              width={300}
              height={400}
              sizes="(max-width: 48rem) 40vw, 12rem"
              loading="lazy"
            />
            <figcaption>
              <strong>{code}</strong>
              <span>{label}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className={styles.primerStack}>
        {primerGroups.map((group) => (
          <article key={group.title}>
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
          <p>Pristup Baslac formulama i izboru odgovarajućeg sistema boje.</p>
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
          Kamioni, dostavna vozila i autobusi traže sistem koji pokriva velike
          površine i zadržava ujednačen sjaj. Ilustracija je zvanični baslac
          render dostavnog vozila, a izbor sistema i procesa potvrđuje se sa
          tehničkim savetnikom.
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
      title: "Tehnički listovi",
      text: "Odnos mešanja, sušenje, aplikacija i dozvoljene podloge iz konkretnog TDS dokumenta.",
      href: "https://techinfo.baslac.com/en/",
      external: true,
    },
    {
      title: "Koloristička podrška",
      text: "Pomoć pri merenju, izboru formule i pripremi test karte.",
      href: "/kontakt?tema=podrska&brend=baslac&oblast=koloristika",
      external: false,
    },
    {
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

function BaslacFamilyPackshot({ system }: { system: BaslacSystemId }) {
  const packshot = baslacFamilyPackshots[system];

  if (!packshot.src) {
    return (
      <div className={styles.familyPackshot} data-pending="true">
        <span className={styles.familyPackshotMark} aria-hidden="true">
          Baslac
        </span>
        <p>Zvanična fotografija ambalaže je u pripremi.</p>
      </div>
    );
  }

  return (
    <figure
      className={styles.familyPackshot}
      data-kind={packshot.kind ?? "family"}
    >
      <Image
        src={packshot.src}
        alt={packshot.alt}
        width={420}
        height={560}
        sizes="(max-width: 60rem) 40vw, 15rem"
        loading="lazy"
      />
      <figcaption>
        {packshot.kind === "example"
          ? "Primer ambalaže"
          : "Zajednička ambalaža porodice"}
      </figcaption>
    </figure>
  );
}

function BaslacSystemsAndProducts({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const groups = [
    {
      id: "sistem-line-45",
      title: "Line 45 — vodeni bazni sistem",
      text: "Vodeni mixing sistem sa solid, transparent, metallic i pearl komponentama, reducerom i aditivima.",
      count: baslacPublicBases("line-45").length,
      selector: "line-45" as const,
    },
    {
      id: "sistem-line-35",
      title: "Line 35 — konvencionalni bazni sistem",
      text: "Mixing sistem sa solid, transparent, metallic, pearl i Xirallic baznim komponentama. Nijansa se meša po formuli.",
      count: baslacPublicBases("line-35").length,
      selector: "line-35" as const,
    },
    {
      id: "sistem-line-30",
      title: "Line 30 — 2K završne boje",
      text: "Pigmentirani 2K sistem sa direktnim sjajem, uključujući mixing clear i converter za komercijalna vozila.",
      count: baslacPublicBases("line-30").length,
      selector: "line-30" as const,
    },
  ];

  return (
    <section
      id="products"
      className={`${styles.section} ${styles.catalogSection}`}
      aria-labelledby="baslac-catalog-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Program po sistemima</p>
          <h2 id="baslac-catalog-title">Baslac sistemi i proizvodi</h2>
        </div>
        <p>
          Izaberite sistem boja, pripremni materijal ili završni proizvod.
          Unutar svake porodice dostupne su odgovarajuće varijante, pakovanja i
          tehnička dokumentacija.
        </p>
      </header>

      {groups.map((group) => (
        <article className={styles.systemGroup} id={group.id} key={group.id}>
          <div className={styles.systemGroupHeader}>
            <div>
              <h3>{group.title}</h3>
              <p>{group.text}</p>
            </div>
            <span className={styles.systemGroupCount}>
              {group.count} baza
            </span>
          </div>
          <div className={styles.systemGroupBody}>
            <BaslacFamilyPackshot system={group.selector} />
            <div className={styles.systemGroupCopy}>
              <p>
                Sve baze, pretraga, filteri i dodavanje u listu nalaze se na
                stranici sistema.
              </p>
              <Link
                className={styles.primaryButton}
                href={`/proizvodi/grupa/baslac-${group.selector}`}
              >
                Otvorite {group.title.split(" — ")[0]}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </article>
      ))}

      {products.length > 0 ? (
        <article className={styles.systemGroup}>
          <div className={styles.systemGroupHeader}>
            <div>
              <h3>Proizvodi sa otvorenom stranicom</h3>
              <p>
                Artikli koji već imaju svoju stranicu sa tehničkim podacima i
                dokumentacijom.
              </p>
            </div>
          </div>
          <div className={styles.catalogGrid}>
            {products.slice(0, 4).map((product) => (
              <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
                <div className={styles.catalogImage} data-pending={
                  product.productImage?.src.includes("placeholder-product") ||
                  undefined
                }>
                  {product.productImage ? (
                    <Image
                      src={product.productImage.src}
                      alt={product.productImage.alt}
                      fill
                      sizes="(min-width: 70rem) 18rem, (min-width: 45rem) 40vw, 82vw"
                    />
                  ) : null}
                </div>
                <div className={styles.catalogCopy}>
                  <p>{product.sku}</p>
                  <h4>{product.name}</h4>
                  <span>
                    Otvorite proizvod
                    <i aria-hidden="true">↗</i>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </article>
      ) : null}

      <div className={styles.catalogFooter}>
        <p>
          Ne vidite artikal koji vam treba? Pošaljite oznaku sa etikete i
          potvrđujemo pakovanje, dokumentaciju i dostupnost.
        </p>
        <Link className={styles.outlineButton} href={baslacCatalogHref()}>
          Svi Baslac proizvodi
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function DocumentLibrary() {
  const documents = getFeaturedDocuments("Baslac");
  if (documents.length === 0) return null;

  return (
    <section
      className={`${styles.section} ${styles.documentsSection}`}
      aria-labelledby="baslac-documents-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Tehnička dokumentacija</p>
          <h2 id="baslac-documents-title">
            Sistemi i tehnički vodiči direktno od baslac.
          </h2>
        </div>
        <p>
          Karbon, hrom, plastika i kontrola sjaja — konkretni sistemi iz
          zvanične baslac tehničke dokumentacije.
        </p>
      </header>

      <div className={styles.documentsGrid}>
        {documents.map((document) => (
          <DocumentCard key={document.id} document={document} />
        ))}
      </div>

      <div className={styles.catalogFooter}>
        <Link className={styles.outlineButton} href="/katalozi?brand=baslac">
          Svi baslac dokumenti
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
          Pogledajte sve Baslac proizvode
        </Link>
      </div>
    </section>
  );
}
