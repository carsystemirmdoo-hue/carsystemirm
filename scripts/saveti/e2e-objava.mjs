/**
 * Provera celog toka objave na produkcionom buildu (next build + next start).
 *
 *   node scripts/saveti/e2e-objava.mjs            (Node ≥ 22; traje nekoliko minuta)
 *
 * Radi u IZOLOVANOJ kopiji repozitorijuma (tmp/saveti/e2e-kopija), sa veštačkim
 * stanjem koje se nikada ne komituje:
 *   - raspored je aktivan, termin 0 = pilot članak (prošao), termin 1 prazan,
 *     termin 2 = test članak (u budućnosti za trenutak A, prošao za trenutak B);
 *   - oba članka imaju lokalno test-odobrenje.
 * Sat servera se pomera promenljivom SAVETI_SAT (radi samo van Vercela).
 *
 * Proverava:
 *   A (pre termina): budući članak 404, nije u /vodici, sitemapu ni feedu;
 *     zakazani posao bez tajne odbijen; sa tajnom isti izveštaj dva puta.
 *   B (posle termina, isti build — keš iz builda i 404 keširan u A):
 *     članak postaje dostupan, a spiskovi i sitemap ga dobijaju posle
 *     osvežavanja zakazanim poslom.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, realpathSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const COPY = path.join(ROOT, "tmp/saveti/e2e-kopija");
const PORT = 3530;
const SECRET = "e2e-lokalna-tajna-0123456789";
const TIME_A = "2026-10-10T12:00:00+02:00";
const TIME_B = "2026-10-11T09:30:00+02:00";
const FUTURE_SLUG = "e2e-buduci-clanak";
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function prepareCopy() {
  rmSync(COPY, { recursive: true, force: true });
  mkdirSync(COPY, { recursive: true });
  execFileSync("rsync", [
    "-a",
    "--exclude", "node_modules", "--exclude", ".next*", "--exclude", "tmp", "--exclude", ".git",
    `${ROOT}/`, `${COPY}/`,
  ]);
  symlinkSync(realpathSync(path.join(ROOT, "node_modules")), path.join(COPY, "node_modules"));

  const dataFile = path.join(COPY, "data/saveti/clanci.generated.json");
  const data = JSON.parse(readFileSync(dataFile, "utf8"));
  const pilot = data.clanci.find((item) => item.status.pisanje === "napisano");
  if (!pilot) throw new Error("nema nijednog napisanog članka za probu");
  const approve = (item) => ({
    ...item,
    status: { ...item.status, tehnickaProvera: "provereno", jezickaProvera: "provereno" },
    odobrenje: { odobrio: "E2E TEST", uloga: "test", datum: "2026-10-01T09:00:00+02:00", otisak: item.otisak },
  });
  const future = approve({
    ...pilot,
    id: "SV-9999",
    slug: FUTURE_SLUG,
    naslov: "E2E budući članak za proveru objave",
    metaNaslov: "E2E budući članak",
    otisak: "e2e-otisak",
    povezani: [],
  });
  const clanci = data.clanci.map((item) => (item.id === pilot.id ? approve(item) : item));
  clanci.push(future);
  writeFileSync(dataFile, JSON.stringify({ ...data, clanci }));
  writeFileSync(
    path.join(COPY, "content/saveti/raspored.json"),
    JSON.stringify({
      podesavanja: {
        aktivan: true,
        pocetniDatum: "2026-10-05",
        vremeObjave: "09:00",
        vremenskaZona: "Europe/Belgrade",
        razmakDana: 3,
        pauzaOd: null,
      },
      termini: [
        { redniBroj: 0, datum: "2026-10-05", clanak: pilot.id },
        { redniBroj: 1, datum: "2026-10-08", clanak: null },
        { redniBroj: 2, datum: "2026-10-11", clanak: "SV-9999" },
      ],
    }),
  );
  writeFileSync(path.join(COPY, "data/saveti/status.generated.json"), JSON.stringify({ rasporedAktivan: true }));
  return pilot;
}

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: COPY, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    child.stdout.on("data", (chunk) => (log += chunk));
    child.stderr.on("data", (chunk) => (log += chunk));
    child.on("exit", (code) => (code === 0 ? resolve(log) : reject(new Error(`${cmd} ${args.join(" ")} → ${code}\n${log.slice(-3000)}`))));
  });
}

async function startServer(time) {
  const child = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: COPY,
    env: { ...process.env, NEXT_DIST_DIR: ".next-e2e", SAVETI_SAT: time, CRON_SECRET: SECRET, MAINTENANCE_MODE: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/vodici`, { redirect: "manual" });
      if (response.status < 500) return { child, log: () => log };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill("SIGTERM");
  throw new Error(`server nije krenuo\n${log.slice(-2000)}`);
}

async function stop(server) {
  server.child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

const get = async (url, headers = {}) => {
  const response = await fetch(`http://127.0.0.1:${PORT}${url}`, { headers, redirect: "manual" });
  return { status: response.status, text: await response.text() };
};

const pilot = prepareCopy();
console.log(`kopija: ${COPY}; pilot: ${pilot.slug}`);
console.log("next build (trenutak A)…");
await run("npx", ["next", "build"], { NEXT_DIST_DIR: ".next-e2e", SAVETI_SAT: TIME_A, MAINTENANCE_MODE: "false" });

/* ---------- A: pre termina ---------- */
let server = await startServer(TIME_A);
{
  const article = await get(`/vodici/${FUTURE_SLUG}`);
  check("A: budući članak daje 404", article.status === 404, `status ${article.status}`);
  const pilotPage = await get(`/vodici/${pilot.slug}`);
  check("A: objavljen pilot daje 200", pilotPage.status === 200, `status ${pilotPage.status}`);
  check("A: pilot ima Article JSON-LD sa datePublished termina", /"datePublished":"2026-10-05T07:00:00.000Z"/.test(pilotPage.text));
  check("A: pilot ima lang sr-Latn i og:locale sr_RS", /<html[^>]*lang="sr-Latn"/.test(pilotPage.text) && /og:locale" content="sr_RS"/.test(pilotPage.text));
  check("A: pilot ima canonical", new RegExp(`rel="canonical" href="https://carsystemirm.com/vodici/${pilot.slug}"`).test(pilotPage.text));
  const index = await get("/vodici");
  check("A: /vodici ne sadrži budući članak", !index.text.includes(FUTURE_SLUG));
  check("A: /vodici sadrži pilot", index.text.includes(`/vodici/${pilot.slug}`));
  const sitemap = await get("/sitemap.xml");
  check("A: sitemap ne sadrži budući članak", !sitemap.text.includes(FUTURE_SLUG));
  check("A: sitemap sadrži pilot sa lastmod", sitemap.text.includes(`/vodici/${pilot.slug}</loc>`) && /<lastmod>2026-10-05/.test(sitemap.text));
  const feed = await get("/vodici/feed");
  check("A: feed ne sadrži budući članak", !feed.text.includes(FUTURE_SLUG) && feed.text.includes(pilot.slug));
  const category = await get(`/vodici/kategorije/${pilot.kategorija}`);
  check("A: kategorija ne sadrži budući članak", !category.text.includes(FUTURE_SLUG), `status ${category.status}`);
  const noAuth = await get("/api/saveti/objava");
  check("A: zakazani posao bez tajne je odbijen", noAuth.status === 401, `status ${noAuth.status}`);
  const auth = { authorization: `Bearer ${SECRET}` };
  const first = await get("/api/saveti/objava", auth);
  const second = await get("/api/saveti/objava", auth);
  const strip = (text) => JSON.stringify({ ...JSON.parse(text), vreme: undefined });
  check("A: zakazani posao sa tajnom radi i ponovljen daje isto", first.status === 200 && strip(first.text) === strip(second.text), first.text.slice(0, 300));
  check("A: prazan termin ima razlog", /"stanje":"prazan"/.test(first.text) && /nema spremnog/.test(first.text));
  const full = await get("/api/saveti/objava?pregled=sve", auth);
  check("A: pregled svih termina navodi budući kao zakazan", /"clanak":"SV-9999","stanje":"zakazan"/.test(full.text));
}
await stop(server);

/* ---------- B: posle termina, isti build ---------- */
server = await startServer(TIME_B);
{
  const article = await get(`/vodici/${FUTURE_SLUG}`);
  // 404 iz trenutka A je možda keširan (ISR); posao ga osvežava.
  const auth = { authorization: `Bearer ${SECRET}` };
  const job = await get("/api/saveti/objava", auth);
  check("B: zakazani posao javlja da je termin objavljen", /"clanak":"SV-9999","stanje":"objavljen"/.test(job.text), job.text.slice(0, 400));
  await get(`/vodici/${FUTURE_SLUG}`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const after = await get(`/vodici/${FUTURE_SLUG}`);
  check("B: članak je dostupan posle termina", after.status === 200, `prvi zahtev ${article.status}, posle osvežavanja ${after.status}`);
  check("B: datum objave je trenutak termina (09:00 lokalno)", /"datePublished":"2026-10-11T07:00:00.000Z"/.test(after.text));
  await get("/vodici");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const index = await get("/vodici");
  check("B: /vodici posle osvežavanja sadrži novi članak", index.text.includes(`/vodici/${FUTURE_SLUG}`));
  await get("/sitemap.xml");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const sitemap = await get("/sitemap.xml");
  check("B: sitemap posle osvežavanja sadrži novi članak", sitemap.text.includes(`/vodici/${FUTURE_SLUG}</loc>`));
}
await stop(server);

const failed = results.filter((result) => !result.ok);
writeFileSync(path.join(ROOT, "tmp/saveti/e2e-rezultat.json"), JSON.stringify({ vreme: new Date().toISOString(), results }, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} provera prošlo`);
if (!process.argv.includes("--zadrzi")) rmSync(COPY, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
