import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.OWNER_EMAIL ?? "").toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? "";
  if (!email || password.length < 12) throw new Error("OWNER_EMAIL und OWNER_PASSWORD (min. 12 Zeichen) in .env setzen");
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await db.user.findUnique({ where: { email } });
  // Passwort aus .env wird bei jedem Setup übernommen – so wirkt eine spätere Änderung in .env.
  await db.user.upsert({
    where: { email },
    update: { passwordHash, role: "OWNER" },
    create: { email, name: process.env.OWNER_NAME ?? "Inhaber", role: "OWNER", passwordHash },
  });
  for (const [key, label, budget] of [["apify", "Apify (Google-Maps-Scraping)", 20], ["anthropic", "Anthropic Claude (KI-Kern)", 30]] as const) {
    await db.integration.upsert({ where: { key }, update: {}, create: { key, label, budgetMonthly: budget } });
  }
  await db.logEntry.create({ data: { source: "setup", message: "Cockpit eingerichtet" } });
  const others = await db.user.findMany({ where: { role: "OWNER", email: { not: email } }, select: { email: true } });
  console.log(`✓ Inhaber ${email} ${existing ? "aktualisiert (Passwort aus .env übernommen)" : "angelegt"}.`);
  if (others.length) console.log(`  Hinweis: weitere Inhaber-Konten vorhanden: ${others.map((o) => o.email).join(", ")}`);
  console.log(`  Login mit: ${email} und dem Passwort aus OWNER_PASSWORD. Start: npm run dev → http://localhost:3000`);
}

main().finally(() => db.$disconnect());
