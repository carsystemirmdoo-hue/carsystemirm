"use client";

import { useState } from "react";
import type {
  ResolvedGuide,
  ResolvedProduct,
  ResolvedSource,
  SistemiJob,
  SistemiMaterial,
  SistemiProblem,
  SistemiScale,
  SistemiStep,
} from "@/lib/sistemi/types";
import { InquiryForm } from "./InquiryForm";
import { sourceKey } from "@/lib/sistemi/keys";
import { GuideLinks, ProblemsList, ProductCards, ScaleView, SourceList } from "./SistemiParts";
import styles from "./Sistemi.styles";

type References = {
  products: Record<string, ResolvedProduct>;
  sources: Record<string, ResolvedSource>;
  guides: Record<string, ResolvedGuide>;
};

/** Korak za izabranu varijantu (podlogu, vrstu): izmene iz `pod` zamenjuju opšti tekst. */
function stepFor(step: SistemiStep, choice: string | undefined): SistemiStep {
  const variant = choice ? step.pod?.[choice] : undefined;
  if (!variant) return step;
  return {
    ...step,
    title: variant.title ?? step.title,
    what: variant.what ?? step.what,
    detail: variant.detail ?? step.detail,
    material: variant.material ?? step.material,
    products: variant.products?.length ? variant.products : step.products,
    sources: [...(variant.sources ?? []), ...(step.sources ?? [])],
  };
}

function JobPanel({
  job,
  choice,
  onChoice,
  scales,
  references,
}: {
  job: SistemiJob;
  choice: string | undefined;
  onChoice: (value: string) => void;
  scales: Record<string, SistemiScale>;
  references: References;
}) {
  const steps = job.steps
    .filter((step) => !step.only || (choice ? step.only.includes(choice) : true))
    .map((step) => stepFor(step, choice));
  const option = job.choice?.options.find((item) => item.id === choice);
  const shownInSteps = new Set(steps.flatMap((step) => step.products ?? []));
  const extraProducts = (job.products ?? []).filter((slug) => !shownInSteps.has(slug));

  return (
    <div className={styles.jobPanel}>
      <h3 className={styles.jobTitle}>{job.title}</h3>
      {job.lead ? <p className={styles.stepWhat}>{job.lead}</p> : null}
      <SourceList refs={job.sources} sources={references.sources} />

      {job.choice ? (
        <fieldset className={styles.choice}>
          <legend className={styles.choiceLegend}>{job.choice.question ?? "Izaberite"}</legend>
          <div className={styles.choiceOptions}>
            {job.choice.options.map((item) => (
              <label className={styles.choiceOption} key={item.id}>
                <input
                  checked={choice === item.id}
                  name={`izbor-${job.id}`}
                  onChange={() => onChoice(item.id)}
                  type="radio"
                  value={item.id}
                />
                {item.label}
              </label>
            ))}
          </div>
          {option?.note ? <p className={styles.choiceNote}>{option.note}</p> : null}
        </fieldset>
      ) : null}

      <ol className={styles.steps}>
        {steps.map((step) => {
          const scaleId = step.scale === true ? job.id : typeof step.scale === "string" ? step.scale : undefined;
          const scale = scaleId ? scales[scaleId] : undefined;
          const hasSources = Boolean(step.sources?.some((ref) => references.sources[sourceKey(ref)]));
          const detailParts = [step.detail ? "Zašto" : "", scale ? "vrednosti" : "", hasSources ? "izvor" : ""].filter(Boolean);
          const hasDetails = detailParts.length > 0;
          return (
            <li className={styles.step} key={step.id}>
              <div className={styles.stepBody}>
                <h4 className={styles.stepTitle}>{step.title}</h4>
                <p className={styles.stepWhat}>{step.what}</p>
                {step.material ? (
                  <p className={styles.stepMaterial}>
                    <strong>Materijal: </strong>
                    {step.material}
                  </p>
                ) : null}
                <ProductCards products={references.products} slugs={step.products} />
                <GuideLinks guides={references.guides} slugs={step.guides} />
                {hasDetails ? (
                  <details className={styles.details}>
                    <summary>{detailParts.join(", ").replace(/^./, (letter) => letter.toUpperCase())}</summary>
                    <div className={styles.detailsBody}>
                      {step.detail ? <p>{step.detail}</p> : null}
                      {scale ? <ScaleView choice={choice} scale={scale} sources={references.sources} /> : null}
                      <SourceList refs={step.sources} sources={references.sources} />
                    </div>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {extraProducts.length ? (
        <div className={styles.stepBody}>
          <h4 className={styles.stepTitle}>Još uz ovaj posao</h4>
          <ProductCards products={references.products} slugs={extraProducts} />
        </div>
      ) : null}
      <GuideLinks guides={references.guides} slugs={job.guides} />
    </div>
  );
}

export function ProgramExplorer({
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
  const [jobId, setJobId] = useState(jobs[0]?.id);
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(jobs.filter((job) => job.choice?.options[0]).map((job) => [job.id, job.choice!.options[0].id])),
  );
  const [materialId, setMaterialId] = useState(materials[0]?.id);
  const activeJob = jobs.find((job) => job.id === jobId) ?? jobs[0];
  const activeChoice = activeJob?.choice?.options.find((option) => option.id === choices[activeJob.id]);

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
      <section aria-labelledby="poslovi-naslov" className={styles.section} id="poslovi">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionKicker}>Postupak</p>
          <h2 className={styles.sectionTitle} id="poslovi-naslov">
            {jobsTitle}
          </h2>
        </div>
        <div
          aria-label="Izbor posla"
          className={styles.jobList}
          onKeyDown={(event) => onTabKey(event, jobs.map((job) => job.id), jobId, setJobId)}
          role="tablist"
        >
          {jobs.map((job) => (
            <button
              aria-controls={`posao-${job.id}`}
              aria-selected={job.id === activeJob?.id}
              className={styles.jobButton}
              id={`posao-tab-${job.id}`}
              key={job.id}
              onClick={() => setJobId(job.id)}
              role="tab"
              tabIndex={job.id === activeJob?.id ? 0 : -1}
              type="button"
            >
              <span className={styles.jobButtonLabel}>{job.label ?? job.title}</span>
              {job.desc ? <span className={styles.jobButtonDesc}>{job.desc}</span> : null}
            </button>
          ))}
        </div>
        {jobs.map((job) => (
          <div
            aria-labelledby={`posao-tab-${job.id}`}
            className={styles.panel}
            hidden={job.id !== activeJob?.id}
            id={`posao-${job.id}`}
            key={job.id}
            role="tabpanel"
            tabIndex={0}
          >
            <JobPanel
              choice={choices[job.id]}
              job={job}
              onChoice={(value) => setChoices((current) => ({ ...current, [job.id]: value }))}
              references={references}
              scales={scales}
            />
          </div>
        ))}
      </section>

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
              ["Posao", activeJob?.title ?? ""],
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
