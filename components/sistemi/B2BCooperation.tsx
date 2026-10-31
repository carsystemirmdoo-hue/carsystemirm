"use client";

import { useRef, useState } from "react";
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
  const [segmentId, setSegmentId] = useState<(typeof SEGMENTS)[number]["id"] | null>(null);
  const segment = SEGMENTS.find((item) => item.id === segmentId);
  const formRef = useRef<HTMLElement>(null);
  const [prepared, setPrepared] = useState(false);

  function choose(id: (typeof SEGMENTS)[number]["id"]) {
    const first = segmentId === null;
    setSegmentId(id);
    setPrepared(false);
    if (!first) return;
    window.requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      formRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }

  return (
    <>
      <section aria-labelledby="ko-ste-naslov" className={styles.section} id="ko-ste">
        <ol aria-label="Koraci" className={styles.stepper}>
          <li data-state={segment ? "done" : "current"}>Vrsta firme</li>
          <li data-state={prepared ? "done" : segment ? "current" : undefined}>Podaci</li>
          <li data-state={prepared ? "current" : undefined}>Slanje iz Vašeg programa za e-poštu</li>
        </ol>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle} id="ko-ste-naslov">
            Ko ste?
          </h2>
        </div>
        <fieldset className={styles.segments}>
          <legend className={styles.visuallyHidden}>Vrsta firme</legend>
          {SEGMENTS.map((item) => (
            <label className={styles.segment} key={item.id}>
              <input checked={segmentId === item.id} name="vrsta-firme" onChange={() => choose(item.id)} type="radio" value={item.id} />
              <span className={styles.segmentLabel}>{item.label}</span>
              <span className={styles.segmentDesc}>{item.desc}</span>
            </label>
          ))}
        </fieldset>
      </section>

      {segment ? (
        <section aria-labelledby="forma-naslov" className={styles.section} id="forma" ref={formRef}>
          <div className={`${styles.panel} ${styles.formPanel}`}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionKicker}>{segment.label}</p>
              <h2 className={styles.sectionTitle} id="forma-naslov">
                Recite nam nešto o firmi
              </h2>
              <div>
                <h3 className={styles.columnTitle}>Pripremite</h3>
                <ul className={styles.bullets}>
                  {segment.prepare.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <p className={styles.formNote}>Uslove saradnje dogovarate sa timom.</p>
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
              onPrepared={() => setPrepared(true)}
              submitLabel="Pripremite predlog"
              topic="B2B saradnja"
            />
          </div>
        </section>
      ) : (
        <section aria-label="Predlog saradnje" className={styles.section} id="forma" ref={formRef}>
          <p className={styles.formNote}>
            Proizvodi su u{" "}
            <a className={styles.textLink} href="/katalog">
              katalogu
            </a>
            , a dokumenti proizvođača u{" "}
            <a className={styles.textLink} href="/dokumentacija">
              biblioteci
            </a>
            .
          </p>
        </section>
      )}
    </>
  );
}
