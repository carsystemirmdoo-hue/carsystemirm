"use client";

import { useEffect, useState } from "react";
import type {
  SistemiJob,
  SistemiMaterial,
  SistemiProblem,
  SistemiScale,
} from "@/lib/sistemi/types";
import { InquiryForm } from "./InquiryForm";
import { ProgramGuide, type GuideReferences } from "./ProgramGuide";
import { GuideLinks, ProblemsList, ProductCards, SourceList } from "./SistemiParts";
import styles from "./Sistemi.styles";

type References = GuideReferences;

export function ProgramExplorer({
  programSlug,
  programName,
  jobs,
  scales,
  materials,
  references,
  jobsTitle,
  materialsTitle,
  materialsLead,
  problems,
  email,
  emailHref,
}: {
  programSlug: string;
  programName: string;
  jobs: SistemiJob[];
  scales: Record<string, SistemiScale>;
  materials: SistemiMaterial[];
  references: References;
  jobsTitle: string;
  materialsTitle: string;
  materialsLead: string;
  problems: SistemiProblem[];
  email: string;
  emailHref: string;
}) {
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [materialId, setMaterialId] = useState(materials[0]?.id);
  const activeJob = jobs.find((job) => job.id === jobId);
  const activeChoice = activeJob?.choice?.options.find((option) => option.id === choices[activeJob.id]);

  // Izbor iz adrese (`?posao=…&izbor=…`) pri otvaranju stranice.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const job = jobs.find((item) => item.id === params.get("posao"));
    if (!job) return;
    setJobId(job.id);
    const choice = params.get("izbor");
    if (choice && job.choice?.options.some((option) => option.id === choice)) setChoices({ [job.id]: choice });
    // Veza sa izabranim poslom (npr. sa pregleda celine) otvara rezultat, ne samo kartice.
    window.setTimeout(() => document.getElementById("poslovi-rezultat")?.scrollIntoView({ block: "start" }), 60);
  }, [jobs]);

  // Izbor u adresu, bez novog unosa u istoriju (povratak ostaje na prethodnoj stranici).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (jobId) url.searchParams.set("posao", jobId);
    else url.searchParams.delete("posao");
    const choice = jobId ? choices[jobId] : undefined;
    if (choice) url.searchParams.set("izbor", choice);
    else url.searchParams.delete("izbor");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [jobId, choices]);

  function focusTab(list: HTMLElement | null, index: number) {
    const tabs = list?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[index]?.focus();
  }

  function onTabKey(event: React.KeyboardEvent<HTMLElement>, ids: string[], current: string | undefined, select: (id: string) => void) {
    const index = ids.indexOf(current ?? "");
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % ids.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    if (next < 0) return;
    event.preventDefault();
    select(ids[next]);
    focusTab(event.currentTarget, next);
  }

  return (
    <>
      <ProgramGuide
        choice={jobId ? choices[jobId] : undefined}
        jobId={jobId}
        jobs={jobs}
        onChoice={(value) => jobId && setChoices((current) => ({ ...current, [jobId]: value }))}
        onJob={setJobId}
        program={programSlug}
        references={references}
        scales={scales}
        title={jobsTitle}
      />

      {materials.length ? (
        <section aria-labelledby="materijali-naslov" className={styles.section} id="materijali">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Izbor</p>
            <h2 className={styles.sectionTitle} id="materijali-naslov">
              {materialsTitle}
            </h2>
            <p className={styles.sectionLead}>{materialsLead}</p>
          </div>
          <div
            aria-label={materialsTitle}
            className={styles.tabList}
            onKeyDown={(event) => onTabKey(event, materials.map((item) => item.id), materialId, setMaterialId)}
            role="tablist"
          >
            {materials.map((item) => (
              <button
                aria-controls={`materijal-${item.id}`}
                aria-selected={item.id === materialId}
                className={styles.tab}
                id={`materijal-tab-${item.id}`}
                key={item.id}
                onClick={() => setMaterialId(item.id)}
                role="tab"
                tabIndex={item.id === materialId ? 0 : -1}
                type="button"
              >
                <span className={styles.tabLabel}>{item.label}</span>
                {item.hint ? <span className={styles.tabHint}>{item.hint}</span> : null}
              </button>
            ))}
          </div>
          {materials.map((item) => (
            <div
              aria-labelledby={`materijal-tab-${item.id}`}
              className={styles.panel}
              hidden={item.id !== materialId}
              id={`materijal-${item.id}`}
              key={item.id}
              role="tabpanel"
              tabIndex={0}
            >
              <div className={styles.tabPanel}>
                {item.title ? <h3 className={styles.jobTitle}>{item.title}</h3> : null}
                {item.lead ? <p className={styles.stepWhat}>{item.lead}</p> : null}
                <SourceList refs={item.sources} sources={references.sources} />
                {item.rows.length ? (
                  <dl className={styles.facts}>
                    {item.rows.map((row) => (
                      <div className={styles.fact} key={row.k}>
                        <dt>{row.k}</dt>
                        <dd>
                          {row.v}
                          <SourceList refs={row.sources} sources={references.sources} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <ProductCards products={references.products} slugs={item.products} />
                <GuideLinks guides={references.guides} slugs={item.guides} />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {problems.length ? (
        <section aria-labelledby="greske-naslov" className={styles.section} id="greske">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Provera</p>
            <h2 className={styles.sectionTitle} id="greske-naslov">
              Česte greške
            </h2>
            <p className={styles.sectionLead}>Kako greška izgleda, mogući uzroci i šta proveriti pre ponavljanja posla.</p>
          </div>
          <ProblemsList guides={references.guides} problems={problems} sources={references.sources} />
        </section>
      ) : null}

      <section aria-labelledby="pitanje-naslov" className={styles.section} id="pitanje">
        <div className={`${styles.panel} ${styles.formPanel}`}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Tehnička podrška</p>
            <h2 className={styles.sectionTitle} id="pitanje-naslov">
              Pitanje o ovom poslu
            </h2>
            <p className={styles.sectionLead}>
              Navedite materijal i šifru proizvoda ako ih znate.
            </p>
          </div>
          <InquiryForm
            context={[
              ["Program", programName],
              ...(activeJob ? ([["Posao", activeJob.title]] as [string, string][]) : []),
              ...(activeChoice ? ([[activeJob?.choice?.question ?? "Izbor", activeChoice.label]] as [string, string][]) : []),
            ]}
            email={email}
            emailHref={emailHref}
            messagePlaceholder="Na primer: koji materijal koristite i šta Vas zanima"
            topic="Tehnička podrška"
          />
        </div>
      </section>
    </>
  );
}
