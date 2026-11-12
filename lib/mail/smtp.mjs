import { randomBytes } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

/**
 * Minimalan SMTP klijent (2026-11-12) — slanje mejla porudžbine preko firminog Gmail naloga
 * (smtp.gmail.com:465, šifrovano od prvog bajta, AUTH PLAIN sa lozinkom za aplikacije).
 *
 * Bez plaćenog servisa i bez nove zavisnosti (COST_CONTROL). Namerno uzak: jedna poruka po vezi,
 * HTML + tekst (multipart/alternative), UTF-8 naslov. Lozinka i tela odgovora se nikad ne
 * ispisuju i ne vraćaju — greška nosi samo stabilan kod.
 */

export class SmtpError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = "SmtpError";
    this.code = code;
  }
}

const b64 = (/** @type {string} */ s) => Buffer.from(s, "utf8").toString("base64");
const wrap76 = (/** @type {string} */ s) => s.replace(/.{1,76}/g, "$&\r\n");
const encodeHeader = (/** @type {string} */ s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const ADDR = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** Ispravna jedna adresa (bez imena, bez zareza) — štiti i od ubacivanja zaglavlja. */
export function isAddress(/** @type {string} */ a) {
  return typeof a === "string" && a.length <= 254 && ADDR.test(a);
}

/**
 * Sadržaj poruke (RFC 5322 + MIME), sa CRLF i tačkom na početku reda udvojenom (dot-stuffing).
 * @param {{ from: string, fromName?: string, to: string[], subject: string, html: string, text: string, date?: Date, messageIdHost?: string }} m
 */
export function buildMessage(m) {
  const boundary = `cs-${randomBytes(12).toString("hex")}`;
  const host = m.messageIdHost ?? m.from.split("@")[1] ?? "localhost";
  const lines = [
    `From: ${m.fromName ? `${encodeHeader(m.fromName)} <${m.from}>` : m.from}`,
    `To: ${m.to.join(", ")}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${(m.date ?? new Date()).toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${randomBytes(16).toString("hex")}@${host}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(m.text)).trimEnd(),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(m.html)).trimEnd(),
    `--${boundary}--`,
    "",
  ];
  return lines.join("\r\n").replace(/\r\n\./g, "\r\n..");
}

/**
 * Šalje jednu poruku. `secure: true` = TLS od početka (port 465); `false` samo za lokalni test.
 *
 * @param {{ host: string, port: number, secure: boolean, user: string, pass: string, timeoutMs?: number, rejectUnauthorized?: boolean }} server
 * @param {{ from: string, fromName?: string, to: string[], subject: string, html: string, text: string }} message
 * @returns {Promise<{ accepted: string[] }>}
 */
export async function sendMail(server, message) {
  const to = [...new Set(message.to)];
  if (!to.length) throw new SmtpError("no_recipients", "Nema primalaca.");
  for (const a of [message.from, ...to]) if (!isAddress(a)) throw new SmtpError("bad_address", "Neispravna adresa.");
  if (/[\r\n]/.test(message.subject) || /[\r\n]/.test(message.fromName ?? "")) throw new SmtpError("bad_header", "Neispravan naslov.");
  const data = buildMessage({ ...message, to });

  const socket = server.secure
    ? tls.connect({ host: server.host, port: server.port, servername: server.host, rejectUnauthorized: server.rejectUnauthorized ?? true })
    : net.connect({ host: server.host, port: server.port });
  socket.setTimeout(server.timeoutMs ?? 20_000);

  /** @type {string} */
  let buffer = "";
  /** @type {((r: { code: number, text: string }) => void) | null} */
  let waiting = null;
  /** @type {{ code: number, text: string }[]} */
  const replies = [];
  /** @type {Error | null} */
  let failure = null;

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    // Odgovor je završen kada red ima kod i razmak („250 OK“), ne crticu („250-…“).
    let m;
    while ((m = /^(\d{3})([ -])(.*)\r?\n/m.exec(buffer))) {
      const lineEnd = buffer.indexOf("\n", m.index) + 1;
      const done = m[2] === " ";
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd);
      if (!done) continue;
      const reply = { code: Number(m[1]), text: line.trim() };
      if (waiting) {
        const w = waiting;
        waiting = null;
        w(reply);
      } else replies.push(reply);
    }
  });
  const fail = (/** @type {Error} */ e) => {
    failure = e;
    if (waiting) {
      const w = waiting;
      waiting = null;
      w({ code: 0, text: "" });
    }
  };
  socket.on("timeout", () => {
    fail(new SmtpError("timeout", "Server za mejl ne odgovara."));
    socket.destroy();
  });
  socket.on("error", () => fail(new SmtpError("connection", "Veza sa serverom za mejl nije uspela.")));
  socket.on("close", () => fail(new SmtpError("closed", "Server za mejl je prekinuo vezu.")));

  const read = () =>
    new Promise((resolve) => {
      if (replies.length) return resolve(/** @type {{ code: number, text: string }} */ (replies.shift()));
      if (failure) return resolve({ code: 0, text: "" });
      waiting = resolve;
    });
  /** @param {string | null} line @param {number[]} ok @param {string} code */
  const step = async (line, ok, code) => {
    if (line !== null) socket.write(`${line}\r\n`);
    const r = /** @type {{ code: number }} */ (await read());
    if (failure) throw failure;
    if (!ok.includes(r.code)) throw new SmtpError(code, `Server za mejl je odbio korak (${code}, ${r.code}).`);
    return r;
  };

  try {
    await step(null, [220], "greeting");
    await step(`EHLO ${message.from.split("@")[1] ?? "localhost"}`, [250], "ehlo");
    await step(`AUTH PLAIN ${Buffer.from(`\0${server.user}\0${server.pass}`, "utf8").toString("base64")}`, [235], "auth");
    await step(`MAIL FROM:<${message.from}>`, [250], "mail_from");
    const accepted = [];
    for (const a of to) {
      await step(`RCPT TO:<${a}>`, [250, 251], "rcpt");
      accepted.push(a);
    }
    await step("DATA", [354], "data");
    await step(`${data}\r\n.`, [250], "data_end");
    // Poruka je primljena (250); odjava je ljubaznost — njen ishod ne menja rezultat.
    await step("QUIT", [221], "quit").catch(() => undefined);
    return { accepted };
  } finally {
    socket.end();
    socket.destroy();
  }
}
