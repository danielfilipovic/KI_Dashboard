/**
 * Passwort zurücksetzen oder neuen Inhaber anlegen – direkt im Terminal,
 * unabhängig von der .env-Datei.  Aufruf: npm run passwort
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const db = new PrismaClient();

async function main() {
  const rl = createInterface({ input, output });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q: string) => {
    output.write(q);
    const { value, done } = await lines.next();
    if (done) throw new Error("Eingabe abgebrochen.");
    return String(value);
  };
  const users = await db.user.findMany({ select: { email: true, role: true } });
  console.log(users.length ? `Vorhandene Konten: ${users.map((u) => `${u.email} (${u.role})`).join(", ")}` : "Noch kein Konto vorhanden.");
  const email = (await ask("E-Mail: ")).trim().toLowerCase();
  const password = (await ask("Neues Passwort (min. 12 Zeichen, wird angezeigt): ")).trim();
  rl.close();
  if (!email.includes("@")) throw new Error("Ungültige E-Mail.");
  if (password.length < 12) throw new Error("Passwort zu kurz (min. 12 Zeichen).");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Inhaber", role: "OWNER", passwordHash },
  });
  console.log(`✓ Passwort für ${email} gesetzt. Jetzt mit npm run dev starten (bzw. Server neu starten) und anmelden.`);
}

main()
  .catch((e) => { console.error("✗", e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
