#!/usr/bin/env node
/**
 * Izvrsni ulaz konektora.
 *
 * Tanak: sav posao je u `src/cli.mjs`, da bi se komande mogle testirati bez
 * pokretanja procesa. Ovde stoji samo izlazni kod, jer ga Task Scheduler cita.
 */
import { main } from "../src/cli.mjs";

process.exitCode = await main();
