import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { buildMessage, isAddress, sendMail, SmtpError } from "./smtp.mjs";

/** Lažan SMTP server (bez TLS-a) koji beleži komande i poruku. */
function fakeServer({ authOk = true } = {}) {
  const log = { commands: [], data: "" };
  const server = net.createServer((s) => {
    s.setEncoding("utf8");
    s.on("error", () => {});
    let inData = false;
    let buf = "";
    s.write("220 lazni.test ESMTP\r\n");
    s.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            s.write("250 2.0.0 OK primljeno\r\n");
          } else log.data += `${line}\r\n`;
          continue;
        }
        log.commands.push(line);
        if (line.startsWith("EHLO")) s.write("250-lazni.test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (line.startsWith("AUTH PLAIN")) s.write(authOk ? "235 2.7.0 OK\r\n" : "535 5.7.8 Lose\r\n");
        else if (line.startsWith("MAIL FROM")) s.write("250 OK\r\n");
        else if (line.startsWith("RCPT TO")) s.write("250 OK\r\n");
        else if (line === "DATA") {
          inData = true;
          s.write("354 Go\r\n");
        } else if (line === "QUIT") {
          s.write("221 Bye\r\n");
          s.end();
        }
      }
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, log, port: server.address().port })));
}

const msg = {
  from: "carsystemirmdoo@gmail.com",
  fromName: "Carsystem portal",
  to: ["tamara@example.com", "aca@example.com"],
  subject: "Nova porudžbina Z-123 — Šokčić",
  html: "<p>Zdravo</p>\n.tačka na početku reda",
  text: "Zdravo\n.tačka",
};

test("šalje poruku: EHLO, AUTH PLAIN, MAIL, RCPT za svakog, DATA, QUIT", async () => {
  const { server, log, port } = await fakeServer();
  try {
    const r = await sendMail({ host: "127.0.0.1", port, secure: false, user: "carsystemirmdoo@gmail.com", pass: "abcd efgh ijkl mnop" }, msg);
    assert.deepEqual(r.accepted, msg.to);
    const auth = log.commands.find((c) => c.startsWith("AUTH PLAIN"));
    assert.equal(Buffer.from(auth.slice(11), "base64").toString(), "\0carsystemirmdoo@gmail.com\0abcd efgh ijkl mnop");
    assert.equal(log.commands.filter((c) => c.startsWith("RCPT TO")).length, 2);
    assert.match(log.data, /Subject: =\?UTF-8\?B\?/);
    assert.match(log.data, /multipart\/alternative/);
    assert.ok(log.commands.includes("QUIT"));
  } finally {
    server.close();
  }
});

test("odbijena prijava je greška sa kodom, bez lozinke u poruci", async () => {
  const { server, port } = await fakeServer({ authOk: false });
  try {
    await assert.rejects(
      sendMail({ host: "127.0.0.1", port, secure: false, user: "u@x.rs", pass: "TAJNA-LOZINKA" }, msg),
      (e) => e instanceof SmtpError && e.code === "auth" && !String(e.message).includes("TAJNA"),
    );
  } finally {
    server.close();
  }
});

test("adrese i naslov: bez ubacivanja zaglavlja", async () => {
  assert.equal(isAddress("tamara@example.com"), true);
  assert.equal(isAddress("a@b.rs, c@d.rs"), false);
  assert.equal(isAddress("x\r\nBcc: y@z.rs"), false);
  await assert.rejects(sendMail({ host: "127.0.0.1", port: 1, secure: false, user: "u", pass: "p" }, { ...msg, subject: "a\r\nBcc: x@y.rs" }), (e) => e.code === "bad_header");
  await assert.rejects(sendMail({ host: "127.0.0.1", port: 1, secure: false, user: "u", pass: "p" }, { ...msg, to: [] }), (e) => e.code === "no_recipients");
});

test("telo: tačka na početku reda se udvaja, delovi su base64", () => {
  const m = buildMessage({ ...msg, html: "a", text: "b" });
  assert.ok(!/\r\n\.[^.]/.test(m));
  assert.match(m, /Content-Transfer-Encoding: base64/);
  assert.match(m, /^From: Carsystem portal <carsystemirmdoo@gmail.com>/);
});
