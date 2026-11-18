/** Korak pripreme VP cenovnika kako ga čita korisnik (lista i strana pripreme). */
export function stageOf(d: { stage: string; importStatus?: string | null; import_status?: string | null }): {
  label: string;
  tone: "info" | "success" | "neutral" | "warning";
} {
  const imp = d.importStatus ?? d.import_status ?? null;
  if (d.stage === "odbaceno") return { label: "odbačeno", tone: "neutral" };
  if (d.stage === "priprema") return { label: "u pripremi", tone: "info" };
  if (d.stage === "kancelarija") return { label: "čeka kancelariju", tone: "warning" };
  if (imp === "primenjeno") return { label: "primenjeno", tone: "success" };
  if (imp === "odbaceno") return { label: "vlasnik nije prihvatio", tone: "neutral" };
  return { label: "čeka vlasnika", tone: "warning" };
}
