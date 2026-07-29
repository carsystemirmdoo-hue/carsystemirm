import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { BaslacHero } from "./BaslacHero";
import { BaslacProcessNavigator } from "./BaslacProcessNavigator";
import {
  baslacCatalogHref,
  baslacClearcoats,
  baslacQuickAccess,
  baslacSystemLines,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

export function BaslacBrandPage({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const catalogProducts = products.filter(
    (product) =>
      product.productImage &&
      !product.productImage.src.includes("placeholder-product"),
  );
  const heroProducts = catalogProducts.map((product) => ({
    alt: product.productImage?.alt ?? product.name,
    name: product.name,
    slug: product.slug,
    src: product.productImage?.src ?? "",
  }));

  return (
    <div className={styles.baslacPage}>
      <main>
        <BaslacHero products={heroProducts} />
        <BaslacQuickAccess />
        <BrandPosition />
        <SystemLines />
        <ProcessSection />
        <ClearcoatSection />
        <PrimerSection />
        <ColorWorkflow />
        <CommercialSection />
        <CatalogPreview products={catalogProducts} />
        <SupportSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function BaslacQuickAccess() {
  return (
    <nav className={styles.quickAccess} aria-label="Brzi pristup baslac programu">
      <div className={styles.quickAccessRail}>
        {baslacQuickAccess.map((item) => (
          <Link
            href={item.href}
            data-dominant={item.dominant || undefined}
            key={item.label}
          >
            {item.label}
            <span aria-hidden="true">{item.dominant ? "↗" : "↓"}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function BrandPosition() {
  return (
    <section
      className={`${styles.section} ${styles.positionSection}`}
      aria-labelledby="baslac-position-title"
    >
      <div className={styles.positionStatement}>
        <p className={styles.sectionKicker}>Sistem koji ima smisla u radionici</p>
        <h2 id="baslac-position-title">
          Manje komplikovanja.
          <br />
          Više kontrole nad procesom.
        </h2>
      </div>
      <div className={styles.positionBody}>
        <p>
          baslac je profesionalni value refinish sistem sa tehnologijom velikog
          proizvođača. Portfolio je organizovan da olakša izbor proizvoda,
          obuku tima i kontrolu troška po popravci.
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
            <dd>Digitalna koloristika i tehnička podrška</dd>
          </div>
          <div>
            <dt>04</dt>
            <dd>Putnička i komercijalna vozila</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function SystemLines() {
  return (
    <section
      id="line-systems"
      className={`${styles.section} ${styles.linesSection}`}
      aria-labelledby="baslac-lines-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Izaberite prema vrsti posla</p>
          <h2 id="baslac-lines-title">Četiri jasna puta kroz sistem boje.</h2>
        </div>
        <p>
          Broj linije označava funkciju i tehnologiju, ne nivo kvaliteta.
          Izaberite sistem prema opremi, podlozi i završnom rezultatu.
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
        <div className={styles.line45FeatureMark} aria-hidden="true">
          <span>45</span>
          <strong>LINE</strong>
        </div>
        <div className={styles.line45FeatureCopy}>
          <p className={styles.sectionKicker}>Glavni vodeni sistem</p>
          <h3>45 Line povezuje nijansu, blendovanje i završni lak.</h3>
          <p>
            Solid, metallic, pearl i effect nijanse rade sa 45-R45. Za
            trostepene nijanse i blendovanje koristi se 45-W10, dok 50-45
            omogućava predviđeni aktivirani proces.
          </p>
        </div>
        <div className={styles.line45FeatureFacts}>
          <div>
            <strong>45-R45</strong>
            <span>vodeni reducer</span>
          </div>
          <div>
            <strong>45-W10</strong>
            <span>blend i translucent proces</span>
          </div>
          <div>
            <strong>50-45</strong>
            <span>basecoat aktivator</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section
      id="proces"
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
          proizvoda, hardenera i razređivača uvek se potvrđuje prema važećem
          tehničkom listu.
        </p>
      </header>
      <BaslacProcessNavigator />
    </section>
  );
}

function ClearcoatSection() {
  return (
    <section
      id="clearcoats"
      className={`${styles.section} ${styles.clearcoatSection}`}
      aria-labelledby="baslac-clearcoats-title"
    >
      <header className={`${styles.sectionHeader} ${styles.clearcoatHeader}`}>
        <div>
          <p className={styles.sectionKicker}>Bezbojni lak prema procesu</p>
          <h2 id="baslac-clearcoats-title">
            Ne birate samo limenku.
            <br />
            Birate ritam popravke.
          </h2>
        </div>
        <p>
          Brzi, ambient, univerzalni, panel i mat sistemi imaju različitu ulogu.
          Vreme zavisi od hardenera, površine, temperature i propisanog TDS
          procesa.
        </p>
      </header>

      <div className={styles.clearcoatMatrix}>
        {baslacClearcoats.map((clearcoat, index) => (
          <article data-tone={clearcoat.tone} key={clearcoat.code}>
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
        <span>40-620</span>
        <p>
          Mat i satin nisu odvojene marketinške linije. 40-620 se koristi
          samostalno ili u kombinaciji sa 40-440/450 radi kontrolisanog nivoa
          sjaja, uz obaveznu probnu kartu i lakiranje kompletnog panela.
        </p>
      </aside>
    </section>
  );
}

function PrimerSection() {
  const primerGroups = [
    {
      code: "20-22 · 20-24/34/94",
      title: "Sanding primer-filleri",
      text: "Standardno popunjavanje i ravnanje, uključujući grey-shade sistem.",
    },
    {
      code: "20-35 · 20-95",
      title: "Wet-on-wet",
      text: "Brži proces bez brušenja, uz propisani flash-off pre boje.",
    },
    {
      code: "25-30",
      title: "Epoxy primer-filler",
      text: "Antikorozivna zaštita i izolacija, u sanding ili wet-on-wet režimu.",
    },
    {
      code: "27-10",
      title: "Washprimer",
      text: "Adhezija za čelik, aluminijum i pocinkovane podloge.",
    },
    {
      code: "21-10 · 21-11 · 21-20",
      title: "Plastika",
      text: "Adhezioni sistemi za pravilno pripremljene obojive automobilske plastike.",
    },
  ];

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
          Prajmer nije generičan međusloj. Izbor zavisi od podloge, zaštite,
          potrebnog popunjavanja i toga da li proces uključuje brušenje.
        </p>
        <Link href="/kontakt?tema=podrska&brend=baslac&oblast=podloga">
          Zatražite preporuku za podlogu
          <span aria-hidden="true">↗</span>
        </Link>
      </div>

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

function ColorWorkflow() {
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
      <div className={styles.colorGlow} aria-hidden="true" />
      <header className={styles.colorHeader}>
        <div>
          <p className={styles.sectionKicker}>Digitalna koloristika</p>
          <h2 id="baslac-color-title">
            Od površine vozila do formule spremne za probu.
          </h2>
        </div>
        <p>
          e-finder star je merni uređaj, Formula Finder je baza formula, a
          Refinity je šira digitalna platforma. Svaki alat ima jasno mesto u
          istom toku.
        </p>
      </header>

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
          <p>Online pristup baslac formulama i izboru sistema boje.</p>
        </article>
        <article>
          <span>PLATFORMA</span>
          <h3>Refinity</h3>
          <p>
            Color Management, zalihe i optimizacija rada, u zavisnosti od
            lokalno dostupne konfiguracije.
          </p>
        </article>
      </div>

      <div className={styles.colorActions}>
        <Link
          className={styles.lightButton}
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

function CommercialSection() {
  return (
    <section
      id="commercial"
      className={`${styles.section} ${styles.commercialSection}`}
      aria-labelledby="baslac-commercial-title"
    >
      <div className={styles.commercialVisual} aria-hidden="true">
        <span>30</span>
        <strong>LINE CV</strong>
        <svg viewBox="0 0 760 260">
          <path d="M40 190h465V42h118l92 98v50h-50" />
          <path d="M505 76h93l61 66H505" />
          <circle cx="162" cy="204" r="42" />
          <circle cx="592" cy="204" r="42" />
          <path d="M204 204h346M40 190v14h80M40 82h400M40 124h400M40 166h400" />
        </svg>
      </div>
      <div className={styles.commercialCopy}>
        <p className={styles.sectionKicker}>Komercijalna vozila</p>
        <h2 id="baslac-commercial-title">
          Direct gloss za velike površine i duže radne cikluse.
        </h2>
        <p>
          30 Line CV pokriva autobuse, kamione, prikolice, šasije i druge
          transportne aplikacije. Brzina se bira kroz 51-515, 51-520 ili
          51-530, dok 81-30 podržava predviđene DTM i chassis procese.
        </p>
        <ul>
          <li>2K direct-gloss završna boja</li>
          <li>Namenski izbor brzine hardenera</li>
          <li>Proces za velike transportne površine</li>
        </ul>
        <Link
          className={styles.darkButton}
          href="/kontakt?tema=proizvod&brend=baslac&program=30-line-cv"
        >
          Razgovarajte sa tehničkim savetnikom
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function CatalogPreview({ products }: { products: CarsystemProduct[] }) {
  return (
    <section
      className={`${styles.section} ${styles.catalogSection}`}
      aria-labelledby="baslac-catalog-title"
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Dostupno u javnom katalogu</p>
          <h2 id="baslac-catalog-title">Proizvodi sa postojećim lokalnim zapisom.</h2>
        </div>
        <p>
          Ovo nije globalni baslac katalog niti potvrda lagera. Prikazujemo
          samo postojeće Carsystem zapise, a cenu, pakovanje i dostupnost
          potvrđujemo kroz upit.
        </p>
      </header>

      {products.length > 0 ? (
        <div className={styles.catalogGrid}>
          {products.slice(0, 4).map((product, index) => (
            <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
              <div className={styles.catalogImage}>
                {product.productImage && (
                  <Image
                    src={product.productImage.src}
                    alt={product.productImage.alt}
                    fill
                    sizes="(min-width: 70rem) 18rem, (min-width: 45rem) 40vw, 82vw"
                  />
                )}
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
      text: "e-finder star, Formula Finder, Refinity i praktična pomoć pri izboru formule.",
      href: "/kontakt?tema=podrska&brend=baslac&oblast=koloristika",
      external: false,
    },
    {
      index: "03",
      title: "Obuka i procesi",
      text: "Standardni, wet-on-wet, plastični, mat, ambient i CV sistemi za svakodnevni rad.",
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
          <h2 id="baslac-support-title">Informacija koja vodi do sledećeg koraka.</h2>
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
          className={styles.lightButton}
          href="/kontakt?tema=proizvod&brend=baslac"
        >
          Zatražite preporuku sistema
          <span aria-hidden="true">↗</span>
        </Link>
        <Link href={baslacCatalogHref()}>Pogledajte sve baslac proizvode</Link>
      </div>
    </section>
  );
}
