"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CarfitMedia } from "./CarfitMedia";
import type { CarfitTaskView } from "./carfit-view";
import styles from "./CarfitBrandPage.module.css";

/**
 * Centralna interakcija stranice: izbor posla → materijal za taj posao.
 *
 * ARIA tablist model, klik kao primarna akcija (bez hover zavisnosti), a visina
 * panela se ne menja skokovito jer se svaka kolona renderuje uvek.
 */
export function CarfitTaskSelector({ tasks }: { tasks: CarfitTaskView[] }) {
  const [activeId, setActiveId] = useState(tasks[0]?.id ?? "");
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const activeIndex = Math.max(
    0,
    tasks.findIndex((task) => task.id === activeId),
  );
  const activeTask = tasks[activeIndex];

  const registerTab = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) tabRefs.current.set(id, node);
    else tabRefs.current.delete(id);
  }, []);

  // Hero markeri menjaju aktivan task preko custom eventa.
  useEffect(() => {
    function handleSelect(event: Event) {
      const detail = (event as CustomEvent<{ taskId?: string }>).detail;
      if (!detail?.taskId) return;
      if (!tasks.some((task) => task.id === detail.taskId)) return;
      setActiveId(detail.taskId);
    }

    window.addEventListener("carfit:select-task", handleSelect);
    return () => window.removeEventListener("carfit:select-task", handleSelect);
  }, [tasks]);

  function focusTab(index: number) {
    const next = tasks[(index + tasks.length) % tasks.length];
    if (!next) return;
    setActiveId(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusTab(activeIndex + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusTab(activeIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(tasks.length - 1);
        break;
      default:
        break;
    }
  }

  if (!activeTask) return null;

  const panelId = `carfit-task-panel-${activeTask.id}`;

  return (
    <div className={styles.taskLayout}>
      <div
        className={styles.taskList}
        role="tablist"
        aria-label="Poslovi u radionici"
        aria-orientation="vertical"
        onKeyDown={handleKeyDown}
      >
        {tasks.map((task) => {
          const selected = task.id === activeTask.id;
          return (
            <button
              key={task.id}
              ref={(node) => registerTab(task.id, node)}
              className={styles.taskTab}
              type="button"
              role="tab"
              id={`carfit-task-tab-${task.id}`}
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(task.id)}
            >
              <span className={styles.taskTabCode}>{task.code}</span>
              <span>
                <span className={styles.taskTabLabel}>{task.label}</span>
                <span className={styles.taskTabMarker}>{task.marker}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={styles.taskStrip}
        role="tablist"
        aria-label="Poslovi u radionici"
        onKeyDown={handleKeyDown}
      >
        {tasks.map((task) => {
          const selected = task.id === activeTask.id;
          return (
            <button
              key={task.id}
              className={styles.taskChip}
              type="button"
              role="tab"
              id={`carfit-task-chip-${task.id}`}
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={(event) => {
                setActiveId(task.id);
                event.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                  inline: "center",
                });
              }}
            >
              <span className={styles.taskTabCode}>{task.code}</span>
              {task.label}
            </button>
          );
        })}
      </div>

      <section
        className={styles.taskPanel}
        id={panelId}
        role="tabpanel"
        aria-label={activeTask.label}
        tabIndex={-1}
      >
        <header className={styles.taskPanelHead}>
          <p className={styles.taskPanelCode}>
            {activeTask.code} — {activeTask.marker}
          </p>
          <h3 className={styles.taskPanelTitle}>{activeTask.lead}</h3>
          <p className={styles.taskPanelBody}>{activeTask.body}</p>
        </header>

        <div className={styles.taskPanelGrid}>
          <div className={styles.taskPanelCol}>
            <p className={styles.taskColTitle}>Redosled koraka</p>
            <ol className={styles.workflow}>
              {activeTask.workflow.map((step) => (
                <li className={styles.workflowItem} key={step.code}>
                  <span className={styles.workflowCode}>{step.code}</span>
                  <span>
                    <span className={styles.workflowTitle}>{step.title}</span>
                    <span className={styles.workflowNote}>{step.note}</span>
                  </span>
                </li>
              ))}
            </ol>

            {activeTask.categories.length > 0 ? (
              <>
                <p className={styles.taskColTitle}>Materijal za ovaj korak</p>
                <div className={styles.tagRow}>
                  {activeTask.categories.map((category) =>
                    category.href ? (
                      <Link
                        className={`${styles.tag} ${styles.tagLink}`}
                        href={category.href}
                        key={category.id}
                      >
                        {category.name}
                      </Link>
                    ) : (
                      <span className={styles.tag} key={category.id}>
                        {category.name}
                      </span>
                    ),
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className={styles.taskPanelCol}>
            <div className={styles.taskMedia}>
              <CarfitMedia
                mark={activeTask.marker}
                sizes="(min-width: 64rem) 30vw, (min-width: 48rem) 45vw, 92vw"
                slot={activeTask.media}
              />
            </div>

            {activeTask.products.length > 0 ? (
              <>
                <p className={styles.taskColTitle}>
                  Iz našeg kataloga · {activeTask.products.length}
                </p>
                <div className={styles.miniProducts}>
                  {activeTask.products.map((product) => (
                    <Link className={styles.miniProduct} href={product.href} key={product.slug}>
                      <span className={styles.miniThumb}>
                        {product.image ? (
                          <Image
                            alt=""
                            height={120}
                            sizes="56px"
                            src={product.image.src}
                            width={120}
                          />
                        ) : null}
                      </span>
                      <span>
                        <span className={styles.miniName}>{product.name}</span>
                        <span className={styles.miniMeta}>
                          {product.sku} · {product.status}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            ) : activeTask.scopeNote ? (
              <div className={styles.scopeNote}>
                <p className={styles.scopeNoteTitle}>{activeTask.scopeNote.title}</p>
                <p className={styles.scopeNoteBody}>{activeTask.scopeNote.body}</p>
              </div>
            ) : null}

            {activeTask.catalogTarget ? (
              <Link className={styles.btnLink} href={activeTask.catalogTarget.href}>
                {activeTask.catalogTarget.label}
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
