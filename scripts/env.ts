/**
 * Prüft die .env und trägt fehlende Geheimwerte automatisch ein.
 * Legt .env aus .env.example an, falls sie fehlt. Überschreibt NIE vorhandene Werte.
 * Aufruf: npm run env   (läuft auch automatisch bei npm run setup)
 */
import fs from "node:fs";
import crypto from "node:crypto";

const FILE = ".env";
if (!fs.existsSync(FILE)) {
  fs.copyFileSync(".env.example", FILE);
  console.log("• .env aus .env.example angelegt");
}

let text = fs.readFileSync(FILE, "utf8");
const random = () => crypto.randomBytes(32).toString("base64");

function current(name: string): string | null {
  const m = text.match(new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*"?([^"\\r\\n]*)"?[ \\t]*\\r?$`, "m"));
  return m ? m[1].trim() : null;
}
function set(name: string, value: string) {
  const line = `${name}="${value}"`;
  const re = new RegExp(`^[ \\t]*#?[ \\t]*${name}[ \\t]*=[^\\r\\n]*`, "m");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}${eol}${line}${eol}`;
}

let changed = false;
const enc = current("ENCRYPTION_KEY");
if (!enc) { set("ENCRYPTION_KEY", random()); changed = true; console.log("✓ ENCRYPTION_KEY erzeugt"); }
else if (Buffer.from(enc, "base64").length !== 32)
  console.log("✗ ENCRYPTION_KEY ist vorhanden, aber ungültig (muss 32 Byte base64 sein). Zeile löschen und npm run env erneut ausführen.");
else console.log("✓ ENCRYPTION_KEY vorhanden");

const ses = current("SESSION_SECRET");
if (!ses || ses.length < 32) { set("SESSION_SECRET", random()); changed = true; console.log("✓ SESSION_SECRET erzeugt"); }
else console.log("✓ SESSION_SECRET vorhanden");

if (!current("DATABASE_URL")) { set("DATABASE_URL", "file:./dev.db"); changed = true; console.log("✓ DATABASE_URL gesetzt"); }

if (changed) {
  fs.writeFileSync(FILE, text);
  console.log("→ .env gespeichert. Läuft der Server schon, bitte mit Strg + C stoppen und mit npm run dev neu starten.");
}
