/**
 * Spaja CSS module (zajednički izgled + desktop + mobilni raspored) u jedan objekat klasa
 * (2026-10-22). Element dobija klase iz svih fajlova pod istim imenom, pa se mobilni i
 * desktop raspored uređuju u odvojenim fajlovima bez promene JSX-a i bez duplog DOM-a.
 */
export function mergeResponsiveStyles(...modules: Readonly<Record<string, string>>[]): Readonly<Record<string, string>> {
  const merged: Record<string, string> = {};
  for (const cssModule of modules) {
    for (const [name, className] of Object.entries(cssModule)) {
      merged[name] = merged[name] ? `${merged[name]} ${className}` : className;
    }
  }
  return merged;
}
