/**
 * Politika čuvanja šifrovanih kopija baze VAN GitHub-a.
 *
 * Zadržava se: poslednjih `daily` dana (po jedna, najnovija u danu), poslednjih
 * `weekly` ISO nedelja i poslednjih `monthly` meseci (najnovija u periodu).
 * Kopija koja je zadržana po bilo kom pravilu ostaje. Najnovija kopija se
 * nikad ne briše. GitHub artefakti su samo prolazni (kratak rok u toku posla).
 *
 * PDF objekti se NE brišu ovom politikom — vidi `pdfIndex.mjs`.
 */

export const DEFAULT_RETENTION = Object.freeze({ daily: 14, weekly: 8, monthly: 12 });

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

/**
 * @param {{ id: string, createdAt: string }[]} backups
 * @returns {{ keep: string[], remove: string[], reasons: Record<string, string[]> }}
 */
export function planRetention(backups, policy = DEFAULT_RETENTION) {
  const sorted = [...backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reasons = {};
  const mark = (id, why) => (reasons[id] ??= []).push(why);
  const pick = (keyOf, limit, label) => {
    const seen = new Set();
    for (const b of sorted) {
      const k = keyOf(new Date(b.createdAt));
      if (seen.has(k)) continue;
      if (seen.size >= limit) break;
      seen.add(k);
      mark(b.id, `${label} ${k}`);
    }
  };
  pick((d) => d.toISOString().slice(0, 10), policy.daily, "dnevna");
  pick(isoWeek, policy.weekly, "nedeljna");
  pick((d) => d.toISOString().slice(0, 7), policy.monthly, "mesečna");
  if (sorted[0]) mark(sorted[0].id, "najnovija");
  const keep = sorted.filter((b) => reasons[b.id]).map((b) => b.id);
  const remove = sorted.filter((b) => !reasons[b.id]).map((b) => b.id);
  return { keep, remove, reasons };
}
