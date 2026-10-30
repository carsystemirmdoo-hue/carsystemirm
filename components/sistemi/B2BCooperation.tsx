"use client";

import { useState } from "react";
import { InquiryForm } from "./InquiryForm";
import styles from "./Sistemi.styles";

/*
 * Vrsta firme menja šta se traži u upitu. Namerno nema obećanja o pogodnostima, rokovima,
 * nalogu u portalu ni prikazu u pretrazi prodavnica: to čeka odluku vlasnika
 * (docs/sistemi/ODLUKE.md, grupa „B2B i portal“).
 */
const SEGMENTS = [
  {
    id: "radionica",
    label: "Radionica ili servis",
    desc: "Lakirnica, autoservis, firma sa sopstvenim vozilima",
    prepare: ["naziv firme i grad", "vrstu posla: lakiranje, servis, sopstveni vozni park", "sistem boja sa kojim sada radite, ako ga imate", "kontakt osobu"],
    field: { label: "Vrsta posla", placeholder: "Na primer: lakirnica, autoservis" },
  },
  {
    id: "prodaja",
    label: "Prodajno mesto",
    desc: "Prodavnica autolakova i opreme",
    prepare: ["naziv firme, grad i adresu prodajnog mesta", "šta danas prodajete", "kontakt osobu"],
    field: { label: "Adresa prodajnog mesta", placeholder: "Ulica i broj" },
  },
  {
    id: "drugo",
    label: "Druga saradnja",
    desc: "Distribucija ili drugi predlog",
    prepare: ["naziv firme i region u kome radite", "kratak opis predloga", "kontakt osobu"],
    field: { label: "Vrsta saradnje", placeholder: "Na primer: distribucija u regionu" },
  },
] as const;

export function B2BCooperation({ email, emailHref }: { email: string; emailHref: string }) {
  const [segmentId, setSegmentId] = useState<(typeof SEGMENTS)[number]["id"]>("radionica");
  const segment = SEGMENTS.find((item) => item.id === segmentId) ?? SEGMENTS[0];

  return (
    <>
      <section aria-labelledby="ko-ste-naslov" className={styles.section} id="ko-ste">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionKicker}>Vrsta firme</p>
          <h2 className={styles.sectionTitle} id="ko-ste-naslov">
            Ko ste?
          </h2>
        </div>
        <fieldset className={styles.segments}>
          <legend className={styles.visuallyHidden}>Vrsta firme</legend>
          {SEGMENTS.map((item) => (
            <label className={styles.segment} key={item.id}>
              <input checked={segmentId === item.id} name="vrsta-firme" onChange={() => setSegmentId(item.id)} type="radio" value={item.id} />
              <span className={styles.segmentLabel}>{item.label}</span>
              <span className={styles.segmentDesc}>{item.desc}</span>
            </label>
          ))}
        </fieldset>
        <div className={`${styles.panel} ${styles.tabPanel}`}>
          <div className={styles.columns}>
            <div>
              <h3 className={styles.columnTitle}>Šta da pripremite</h3>
              <ul className={styles.bullets}>
                {segment.prepare.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.columnTitle}>Prvi korak</h3>
              <p className={styles.stepWhat}>Pošaljite predlog sa ovim podacima kroz formular ispod. Uslove saradnje dogovarate sa timom.</p>
            </div>
            <div>
              <h3 className={styles.columnTitle}>Program</h3>
              <p className={styles.stepWhat}>
                Boje i lakovi, priprema i abrazivi, pištolji i oprema, poliranje i potrošni materijal: proizvodi su u{" "}
                <a className={styles.textLink} href="/katalog">
                  katalogu
                </a>
                , a dokumenti proizvođača u{" "}
                <a className={styles.textLink} href="/dokumentacija">
                  biblioteci
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="forma-naslov" className={styles.section} id="forma">
        <div className={`${styles.panel} ${styles.formPanel}`}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Predlog saradnje</p>
            <h2 className={styles.sectionTitle} id="forma-naslov">
              Recite nam nešto o firmi
            </h2>
            <p className={styles.sectionLead}>Upit stiže timu sa izabranom vrstom firme.</p>
          </div>
          <InquiryForm
            companyRequired
            context={[["Vrsta firme", segment.label]]}
            email={email}
            emailHref={emailHref}
            extraField={segment.field}
            key={segment.id}
            messageLabel="Predlog ili pitanje"
            messagePlaceholder="Šta predlažete i šta Vam je potrebno"
            submitLabel="Pripremite predlog"
            topic="B2B saradnja"
          />
        </div>
      </section>
    </>
  );
}
